import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../../core/auth/auth.service';
import { documentoOpcional, formatarTelefone } from '../documento';
import { Cliente, DadosCliente, PessoasService } from '../pessoas.service';

const NOVO = 'novo';

type Confirmando = 'inativar' | 'excluir' | null;

/** Formulário de cliente (RN-14.1): nome obrigatório; documento opcional, mas válido; e-mail com formato válido. */
export function formularioDeCliente(fb: NonNullableFormBuilder) {
  return fb.group({
    nome: ['', [Validators.required, Validators.maxLength(150)]],
    documento: ['', documentoOpcional],
    telefone: ['', [Validators.maxLength(20), Validators.pattern(/^[\d()+\-. ]*$/)]],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    endereco: ['', Validators.maxLength(300)],
    observacoes: ['', Validators.maxLength(1000)],
  });
}

/**
 * Pessoas → Clientes (story 3-7): lista com busca (nome, CPF/CNPJ ou telefone), formulário, inativar/reativar e
 * excluir. Cadastrar e alterar com `clientes.editar`; inativar, reativar e excluir com `clientes.inativar` (RN-14.5).
 */
@Component({
  selector: 'app-clientes',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './clientes.html',
  styleUrl: '../cadastro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Clientes {
  private readonly servico = inject(PessoasService);
  private readonly auth = inject(AuthService);

  protected readonly podeEditar = computed(() => this.auth.temPermissao('clientes.editar'));
  protected readonly podeInativar = computed(() => this.auth.temPermissao('clientes.inativar'));

  protected readonly clientes = signal<Cliente[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionado = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal<Confirmando>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly busca = new FormControl('', { nonNullable: true });
  protected readonly incluirInativos = new FormControl(false, { nonNullable: true });
  protected readonly formulario = formularioDeCliente(inject(NonNullableFormBuilder));
  protected readonly telefone = formatarTelefone;

  protected readonly atual = computed(
    () => this.clientes().find((c) => c.id === this.selecionado()) ?? null,
  );
  protected readonly novo = computed(() => this.selecionado() === NOVO);

  constructor() {
    void this.buscar();
  }

  protected async buscar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.clientes.set(
        await this.servico.listarClientes(this.busca.value, this.incluirInativos.value),
      );
      this.erro.set(null);
    } catch {
      this.erro.set('Não foi possível carregar os clientes. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(cliente: Cliente): void {
    this.selecionado.set(cliente.id);
    this.prepararEdicao();
    this.formulario.reset({
      nome: cliente.nome,
      documento: cliente.documento ?? '',
      telefone: formatarTelefone(cliente.telefone),
      email: cliente.email ?? '',
      endereco: cliente.endereco ?? '',
      observacoes: cliente.observacoes ?? '',
    });
    if (this.podeEditar()) this.formulario.enable();
    else this.formulario.disable();
  }

  protected criarNovo(): void {
    this.selecionado.set(NOVO);
    this.prepararEdicao();
    this.formulario.reset();
    this.formulario.enable();
  }

  private prepararEdicao(): void {
    this.confirmando.set(null);
    this.erro.set(null);
    this.aviso.set(null);
  }

  protected async salvar(): Promise<void> {
    if (this.salvando() || !this.podeEditar()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const v = this.formulario.getRawValue();
    const dados: DadosCliente = {
      nome: v.nome.trim(),
      documento: v.documento.trim() || null,
      telefone: v.telefone.trim() || null,
      email: v.email.trim() || null,
      endereco: v.endereco.trim() || null,
      observacoes: v.observacoes.trim() || null,
    };

    await this.executar(async () => {
      const resultado = this.novo()
        ? await this.servico.cadastrarCliente(dados)
        : await this.servico.alterarCliente(this.selecionado()!, dados);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const salvo = resultado.valor;
      this.clientes.update((lista) =>
        lista.some((c) => c.id === salvo.id)
          ? lista.map((c) => (c.id === salvo.id ? salvo : c))
          : [salvo, ...lista],
      );
      const eraNovo = this.novo();
      this.selecionar(salvo);
      this.aviso.set(eraNovo ? 'Cliente cadastrado' : 'Cliente salvo');
    });
  }

  protected async alternarSituacao(): Promise<void> {
    const cliente = this.atual();
    if (!cliente || this.salvando() || !this.podeInativar()) return;
    if (cliente.ativo && this.confirmando() !== 'inativar') {
      this.confirmando.set('inativar');
      return;
    }

    await this.executar(async () => {
      const resultado = cliente.ativo
        ? await this.servico.inativarCliente(cliente.id)
        : await this.servico.reativarCliente(cliente.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const atualizado = { ...cliente, ativo: !cliente.ativo };
      this.clientes.update((lista) => lista.map((c) => (c.id === cliente.id ? atualizado : c)));
      this.selecionar(atualizado);
      this.aviso.set(cliente.ativo ? 'Cliente inativado' : 'Cliente reativado');
    });
  }

  protected async excluir(): Promise<void> {
    const cliente = this.atual();
    if (!cliente || this.salvando() || !this.podeInativar()) return;
    if (this.confirmando() !== 'excluir') {
      this.confirmando.set('excluir');
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.excluirCliente(cliente.id);
      this.confirmando.set(null);
      // Com histórico: "Este cliente tem histórico. Você pode inativá-lo" (cenário 14.3).
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.clientes.update((lista) => lista.filter((c) => c.id !== cliente.id));
      this.selecionado.set(null);
      this.aviso.set('Cliente excluído');
    });
  }

  private async executar(acao: () => Promise<void>): Promise<void> {
    this.salvando.set(true);
    this.erro.set(null);
    this.aviso.set(null);
    try {
      await acao();
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.salvando.set(false);
    }
  }
}

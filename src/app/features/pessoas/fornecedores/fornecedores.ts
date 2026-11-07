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
import { documentoObrigatorio, formatarTelefone } from '../documento';
import { DadosFornecedor, Fornecedor, PessoasService } from '../pessoas.service';

const NOVO = 'novo';

type Confirmando = 'inativar' | 'excluir' | null;

/** Formulário de fornecedor (RN-14.2): razão social e CNPJ (ou CPF) obrigatórios, documento válido. */
export function formularioDeFornecedor(fb: NonNullableFormBuilder) {
  return fb.group({
    razaoSocial: ['', [Validators.required, Validators.maxLength(150)]],
    documento: ['', documentoObrigatorio],
    nomeFantasia: ['', Validators.maxLength(150)],
    telefone: ['', [Validators.maxLength(20), Validators.pattern(/^[\d()+\-. ]*$/)]],
    email: ['', [Validators.email, Validators.maxLength(256)]],
    contato: ['', Validators.maxLength(150)],
  });
}

/**
 * Pessoas → Fornecedores (story 3-7): lista com busca (razão social, nome fantasia ou CNPJ), formulário,
 * inativar/reativar e excluir. A aba só aparece com `fornecedores.gerenciar`, que o servidor exige em tudo.
 */
@Component({
  selector: 'app-fornecedores',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './fornecedores.html',
  styleUrl: '../cadastro.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fornecedores {
  private readonly servico = inject(PessoasService);

  protected readonly fornecedores = signal<Fornecedor[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionado = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmando = signal<Confirmando>(null);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);

  protected readonly busca = new FormControl('', { nonNullable: true });
  protected readonly incluirInativos = new FormControl(false, { nonNullable: true });
  protected readonly formulario = formularioDeFornecedor(inject(NonNullableFormBuilder));
  protected readonly telefone = formatarTelefone;

  protected readonly atual = computed(
    () => this.fornecedores().find((f) => f.id === this.selecionado()) ?? null,
  );
  protected readonly novo = computed(() => this.selecionado() === NOVO);

  constructor() {
    void this.buscar();
  }

  protected async buscar(): Promise<void> {
    this.carregando.set(true);
    try {
      this.fornecedores.set(
        await this.servico.listarFornecedores(this.busca.value, this.incluirInativos.value),
      );
      this.erro.set(null);
    } catch {
      this.erro.set('Não foi possível carregar os fornecedores. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(fornecedor: Fornecedor): void {
    this.selecionado.set(fornecedor.id);
    this.prepararEdicao();
    this.formulario.reset({
      razaoSocial: fornecedor.razaoSocial,
      documento: fornecedor.documento,
      nomeFantasia: fornecedor.nomeFantasia ?? '',
      telefone: formatarTelefone(fornecedor.telefone),
      email: fornecedor.email ?? '',
      contato: fornecedor.contato ?? '',
    });
  }

  protected criarNovo(): void {
    this.selecionado.set(NOVO);
    this.prepararEdicao();
    this.formulario.reset();
  }

  private prepararEdicao(): void {
    this.confirmando.set(null);
    this.erro.set(null);
    this.aviso.set(null);
  }

  protected async salvar(): Promise<void> {
    if (this.salvando()) return;
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    const v = this.formulario.getRawValue();
    const dados: DadosFornecedor = {
      razaoSocial: v.razaoSocial.trim(),
      documento: v.documento.trim() || null,
      nomeFantasia: v.nomeFantasia.trim() || null,
      telefone: v.telefone.trim() || null,
      email: v.email.trim() || null,
      contato: v.contato.trim() || null,
    };

    await this.executar(async () => {
      const resultado = this.novo()
        ? await this.servico.cadastrarFornecedor(dados)
        : await this.servico.alterarFornecedor(this.selecionado()!, dados);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const salvo = resultado.valor;
      this.fornecedores.update((lista) =>
        lista.some((f) => f.id === salvo.id)
          ? lista.map((f) => (f.id === salvo.id ? salvo : f))
          : [salvo, ...lista],
      );
      const eraNovo = this.novo();
      this.selecionar(salvo);
      this.aviso.set(eraNovo ? 'Fornecedor cadastrado' : 'Fornecedor salvo');
    });
  }

  protected async alternarSituacao(): Promise<void> {
    const fornecedor = this.atual();
    if (!fornecedor || this.salvando()) return;
    if (fornecedor.ativo && this.confirmando() !== 'inativar') {
      this.confirmando.set('inativar');
      return;
    }

    await this.executar(async () => {
      const resultado = fornecedor.ativo
        ? await this.servico.inativarFornecedor(fornecedor.id)
        : await this.servico.reativarFornecedor(fornecedor.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      const atualizado = { ...fornecedor, ativo: !fornecedor.ativo };
      this.fornecedores.update((lista) =>
        lista.map((f) => (f.id === fornecedor.id ? atualizado : f)),
      );
      this.selecionar(atualizado);
      this.aviso.set(fornecedor.ativo ? 'Fornecedor inativado' : 'Fornecedor reativado');
    });
  }

  protected async excluir(): Promise<void> {
    const fornecedor = this.atual();
    if (!fornecedor || this.salvando()) return;
    if (this.confirmando() !== 'excluir') {
      this.confirmando.set('excluir');
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.excluirFornecedor(fornecedor.id);
      this.confirmando.set(null);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.fornecedores.update((lista) => lista.filter((f) => f.id !== fornecedor.id));
      this.selecionado.set(null);
      this.aviso.set('Fornecedor excluído');
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

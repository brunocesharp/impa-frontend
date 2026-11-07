import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { Terminal, TerminaisService } from './terminais.service';

/** Tamanho máximo do nome do terminal (o mesmo do servidor). */
export const NOME_MAXIMO = 60;

/**
 * Configuração → Terminais (story 1-6, T4): registrar este dispositivo, listar, renomear e revogar.
 * Só um terminal registrado acessa o PDV e o caixa (RN-11.1). Quem decide é o servidor (`terminais.gerenciar`).
 */
@Component({
  selector: 'app-terminais',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './terminais.html',
  styleUrl: './terminais.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Terminais {
  private readonly servico = inject(TerminaisService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly terminais = signal<Terminal[]>([]);
  protected readonly carregando = signal(true);
  protected readonly selecionado = signal<string | null>(null);
  protected readonly salvando = signal(false);
  protected readonly confirmandoRevogacao = signal(false);
  protected readonly erro = signal<string | null>(null);
  protected readonly aviso = signal<string | null>(null);
  protected readonly nomeMaximo = NOME_MAXIMO;

  protected readonly registro = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(NOME_MAXIMO), naoEmBranco]],
  });
  protected readonly edicao = this.fb.group({
    nome: ['', [Validators.required, Validators.maxLength(NOME_MAXIMO), naoEmBranco]],
  });

  /** Terminal ativo deste dispositivo (o cookie do terminal está neste navegador). */
  protected readonly desteDispositivo = computed(
    () => this.terminais().find((t) => t.atual && !t.revogadoEm) ?? null,
  );
  protected readonly atual = computed(
    () => this.terminais().find((t) => t.id === this.selecionado()) ?? null,
  );

  constructor() {
    void this.carregar();
  }

  private async carregar(): Promise<void> {
    try {
      this.terminais.set(await this.servico.listar());
    } catch {
      this.erro.set('Não foi possível carregar os terminais. Tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }

  protected selecionar(terminal: Terminal): void {
    this.selecionado.set(terminal.id);
    this.limparMensagens();
    this.edicao.reset({ nome: terminal.nome });
    if (terminal.revogadoEm) this.edicao.disable();
    else this.edicao.enable();
  }

  protected async registrar(): Promise<void> {
    if (this.salvando()) return;
    if (this.registro.invalid) {
      this.registro.markAllAsTouched();
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.registrar(this.registro.getRawValue().nome.trim());
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.registro.reset({ nome: '' });
      this.aviso.set('Dispositivo registrado como terminal');
      await this.recarregarSemFalhar(resultado.valor.id);
    });
  }

  protected async renomear(): Promise<void> {
    const terminal = this.atual();
    if (!terminal || this.salvando()) return;
    if (this.edicao.invalid) {
      this.edicao.markAllAsTouched();
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.renomear(
        terminal.id,
        this.edicao.getRawValue().nome.trim(),
      );
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      this.terminais.update((lista) =>
        lista.map((t) => (t.id === terminal.id ? { ...resultado.valor, atual: t.atual } : t)),
      );
      this.selecionar({ ...resultado.valor, atual: terminal.atual });
      this.aviso.set('Terminal salvo');
    });
  }

  protected async revogar(): Promise<void> {
    const terminal = this.atual();
    if (!terminal || terminal.revogadoEm || this.salvando()) return;
    if (!this.confirmandoRevogacao()) {
      this.confirmandoRevogacao.set(true);
      return;
    }

    await this.executar(async () => {
      const resultado = await this.servico.revogar(terminal.id);
      this.confirmandoRevogacao.set(false);
      if (!resultado.ok) return this.erro.set(resultado.mensagem);

      await this.recarregarSemFalhar(terminal.id);
      this.aviso.set('Terminal revogado: o dispositivo não acessa mais o PDV nem o caixa');
    });
  }

  private limparMensagens(): void {
    this.confirmandoRevogacao.set(false);
    this.erro.set(null);
    this.aviso.set(null);
  }

  private async executar(acao: () => Promise<void>): Promise<void> {
    this.salvando.set(true);
    this.limparMensagens();
    try {
      await acao();
    } catch {
      this.erro.set('Não foi possível falar com o servidor. Tente de novo.');
    } finally {
      this.salvando.set(false);
    }
  }

  /** Lista de novo depois de uma operação que já deu certo; se a lista não vier, a operação não é dada como falha. */
  private async recarregarSemFalhar(id: string): Promise<void> {
    try {
      const lista = await this.servico.listar();
      this.terminais.set(lista);
      const terminal = lista.find((t) => t.id === id);
      if (terminal && this.selecionado() === id) this.selecionar(terminal);
    } catch {
      this.aviso.set('A lista não foi atualizada: recarregue a página.');
    }
  }
}

function naoEmBranco(controle: { value: string }) {
  return controle.value && !controle.value.trim() ? { required: true } : null;
}

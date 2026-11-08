import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import {
  AuditoriaService,
  CampoAuditado,
  FILTROS_VAZIOS,
  FiltrosDeAuditoria,
  PaginaDeAuditoria,
  TAMANHO_DA_PAGINA,
} from './auditoria.service';

/** "antes → depois" de um campo; sensível aparece sem os valores. */
export function antesEDepois(campo: CampoAuditado): string {
  if (campo.omitido) return 'valor protegido';
  return `${campo.antes ?? '—'} → ${campo.depois ?? '—'}`;
}

/**
 * Configuração → Auditoria (story 4.4, M1.6): quem alterou o quê e quando nas operações sensíveis, com os valores
 * antes e depois. Lista filtrável por período, usuário, módulo e entidade. Quem decide é o servidor (`auditoria.ver`).
 */
@Component({
  selector: 'app-auditoria',
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
  templateUrl: './auditoria.html',
  styleUrl: './auditoria.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Auditoria {
  private readonly servico = inject(AuditoriaService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly filtros = this.fb.group({ ...FILTROS_VAZIOS });
  protected readonly resultado = signal<PaginaDeAuditoria | null>(null);
  protected readonly carregando = signal(true);
  protected readonly erro = signal<string | null>(null);
  protected readonly antesEDepois = antesEDepois;

  /** Filtros da consulta que está na tela (a paginação usa estes, não o que está sendo digitado). */
  private aplicados: FiltrosDeAuditoria = { ...FILTROS_VAZIOS };

  protected readonly paginas = computed(() => {
    const r = this.resultado();
    return r ? Math.max(1, Math.ceil(r.total / r.tamanhoDaPagina)) : 1;
  });

  constructor() {
    void this.consultar(1);
  }

  protected filtrar(): void {
    this.aplicados = this.filtros.getRawValue();
    void this.consultar(1);
  }

  protected limpar(): void {
    this.filtros.reset({ ...FILTROS_VAZIOS });
    this.filtrar();
  }

  protected irPara(pagina: number): void {
    if (pagina < 1 || pagina > this.paginas() || this.carregando()) return;
    void this.consultar(pagina);
  }

  private async consultar(pagina: number): Promise<void> {
    this.carregando.set(true);
    this.erro.set(null);
    try {
      this.resultado.set(await this.servico.consultar(this.aplicados, pagina, TAMANHO_DA_PAGINA));
    } catch {
      this.erro.set('Não foi possível consultar a auditoria. Confira os filtros e tente de novo.');
    } finally {
      this.carregando.set(false);
    }
  }
}

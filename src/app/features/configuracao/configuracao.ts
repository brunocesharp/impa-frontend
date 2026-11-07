import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

interface Secao {
  rota: string;
  titulo: string;
  descricao: string;
  icone: string;
  permissao: string;
}

/** Seções de Configuração. Cada uma aparece só para quem tem a permissão (o servidor também confere). */
export const SECOES_CONFIGURACAO: readonly Secao[] = [
  {
    rota: 'perfis',
    titulo: 'Perfis',
    descricao: 'Perfis de acesso e o que cada um pode fazer',
    icone: 'admin_panel_settings',
    permissao: 'perfis.gerenciar',
  },
];

/** Configuração (story 1-3): ponto de entrada das seções; por enquanto, Perfis. */
@Component({
  selector: 'app-configuracao',
  imports: [MatCardModule, MatIconModule, RouterLink],
  template: `
    <div class="secoes">
      @for (secao of secoes(); track secao.rota) {
        <a class="secao" data-secao [routerLink]="secao.rota">
          <mat-card appearance="outlined">
            <mat-icon aria-hidden="true">{{ secao.icone }}</mat-icon>
            <div>
              <h2>{{ secao.titulo }}</h2>
              <p>{{ secao.descricao }}</p>
            </div>
          </mat-card>
        </a>
      } @empty {
        <p class="vazio">Nenhuma seção de configuração disponível para o seu perfil.</p>
      }
    </div>
  `,
  styles: `
    .secoes {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
    .secao {
      color: inherit;
      text-decoration: none;
      border-radius: 12px;
    }
    .secao:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
    mat-card {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      padding: 16px;
      background: var(--impa-superficie);
    }
    mat-card:hover {
      background: color-mix(in srgb, currentColor 6%, var(--impa-superficie));
    }
    mat-icon {
      flex: none;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 18px;
    }
    p {
      margin: 0;
      color: var(--impa-texto-secundario);
    }
    .vazio {
      color: var(--impa-texto-secundario);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Configuracao {
  private readonly auth = inject(AuthService);

  protected readonly secoes = computed(() =>
    SECOES_CONFIGURACAO.filter((s) => this.auth.permissoes().has(s.permissao)),
  );
}

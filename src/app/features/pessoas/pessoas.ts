import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

interface Aba {
  rota: string;
  rotulo: string;
  permissao: string;
}

/**
 * Abas de Pessoas (decisão de 07/11/2026). O item do menu aparece com `clientes.ver`; a aba Fornecedores, só com
 * `fornecedores.gerenciar`. Quem protege os dados é o servidor (RN-1.10).
 */
export const ABAS_PESSOAS: readonly Aba[] = [
  { rota: 'clientes', rotulo: 'Clientes', permissao: 'clientes.ver' },
  { rota: 'fornecedores', rotulo: 'Fornecedores', permissao: 'fornecedores.gerenciar' },
];

/** Pessoas (story 3-7): abas Clientes e Fornecedores. */
@Component({
  selector: 'app-pessoas',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav mat-tab-nav-bar [tabPanel]="painel" aria-label="Pessoas">
      @for (aba of abas(); track aba.rota) {
        <a
          mat-tab-link
          data-aba
          [routerLink]="aba.rota"
          routerLinkActive
          #ativa="routerLinkActive"
          [active]="ativa.isActive"
          >{{ aba.rotulo }}</a
        >
      }
    </nav>
    <mat-tab-nav-panel #painel>
      <div class="conteudo"><router-outlet /></div>
    </mat-tab-nav-panel>
  `,
  styles: `
    :host {
      display: block;
    }
    .conteudo {
      padding-top: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Pessoas {
  private readonly auth = inject(AuthService);

  protected readonly abas = computed(() =>
    ABAS_PESSOAS.filter((a) => this.auth.permissoes().has(a.permissao)),
  );
}

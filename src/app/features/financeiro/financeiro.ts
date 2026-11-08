import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

/** Abas do menu Contas (stories 11-1 e 11-2). Todas com `financeiro.ver`; alterar exige `financeiro.editar` no servidor. */
export const ABAS_FINANCEIRO = [
  { rota: 'a-pagar', rotulo: 'Contas a pagar' },
  { rota: 'categorias', rotulo: 'Categorias' },
  { rota: 'formas-pagamento', rotulo: 'Formas de pagamento' },
] as const;

/** Contas (stories 11-1 e 11-2): contas a pagar, categorias e formas de pagamento financeiras. */
@Component({
  selector: 'app-financeiro',
  imports: [MatTabsModule, RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <nav mat-tab-nav-bar [tabPanel]="painel" aria-label="Contas">
      @for (aba of abas; track aba.rota) {
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
export class Financeiro {
  protected readonly abas = ABAS_FINANCEIRO;
}

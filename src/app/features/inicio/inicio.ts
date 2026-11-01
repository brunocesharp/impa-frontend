import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/auth/auth.service';

/** Página inicial, ainda sem indicadores: estado vazio. */
@Component({
  selector: 'app-inicio',
  imports: [MatCardModule, MatIconModule],
  template: `
    <mat-card appearance="outlined" class="vazio">
      <mat-icon aria-hidden="true">auto_awesome</mat-icon>
      <h2>Bem-vindo{{ nome() ? ', ' + nome() : '' }}</h2>
      <p>Ainda não há nada para mostrar aqui. As funções do IMPA aparecem no menu conforme ficarem prontas.</p>
    </mat-card>
  `,
  styles: `
    .vazio {
      display: grid;
      justify-items: center;
      gap: 8px;
      padding: 48px 24px;
      text-align: center;
      background: var(--impa-superficie);
    }
    mat-icon { font-size: 36px; width: 36px; height: 36px; color: var(--impa-texto-secundario); }
    h2 { margin: 0; font-size: 32px; }
    p { margin: 0; max-width: 52ch; color: var(--impa-texto-secundario); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Inicio {
  private readonly sessao = inject(AuthService).sessao;
  protected readonly nome = () => this.sessao()?.nome ?? '';
}

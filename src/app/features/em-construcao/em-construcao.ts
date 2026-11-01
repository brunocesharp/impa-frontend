import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

/** Destino dos itens do menu cujas telas ainda não existem. */
@Component({
  selector: 'app-em-construcao',
  imports: [MatCardModule, MatIconModule],
  template: `
    <mat-card appearance="outlined" class="vazio">
      <mat-icon aria-hidden="true">construction</mat-icon>
      <h2>{{ titulo() }}</h2>
      <p>Esta tela ainda está em construção.</p>
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
    p { margin: 0; color: var(--impa-texto-secundario); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmConstrucao {
  /** Vem de `data.titulo` da rota (withComponentInputBinding). */
  readonly titulo = input('Em construção');
}

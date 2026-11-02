import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { itensVisiveis } from '../../core/menu/menu';
import { PreferenciaTema, TemaService } from '../../core/tema/tema.service';
import { VersaoService } from '../../core/versao/versao.service';

/**
 * Shell da retaguarda: menu lateral (gaveta no celular), barra superior de 56 px com título, usuário,
 * tema e sair. Os itens do menu vêm das permissões de /api/auth/me.
 */
@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatSidenavModule, MatToolbarModule, MatButtonModule, MatIconModule, MatMenuModule,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly rota = inject(ActivatedRoute);
  private readonly avisos = inject(MatSnackBar);
  protected readonly tema = inject(TemaService);
  protected readonly versao = inject(VersaoService);

  protected readonly sessao = this.auth.sessao;
  protected readonly itens = computed(() => itensVisiveis(this.auth.permissoes()));

  protected readonly celular = toSignal(
    inject(BreakpointObserver).observe('(max-width: 840px)').pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  protected readonly titulo = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.tituloDaRotaAtual()),
    ),
    { initialValue: this.tituloDaRotaAtual() },
  );

  protected readonly opcoesTema: { valor: PreferenciaTema; rotulo: string; icone: string }[] = [
    { valor: 'claro', rotulo: 'Claro', icone: 'light_mode' },
    { valor: 'escuro', rotulo: 'Escuro', icone: 'dark_mode' },
    { valor: 'sistema', rotulo: 'Do sistema', icone: 'contrast' },
  ];

  constructor() {
    void this.versao.carregarApi();
  }

  protected async sair(): Promise<void> {
    try {
      // Sessão encerrada no servidor (ou que já tinha acabado: 400/401).
      await this.auth.sair();
    } catch {
      // Sem rede ou API fora: o cookie pode continuar válido, então não vai ao login (caixa compartilhado).
      this.avisos.open('Não foi possível sair. Tente de novo.', 'OK', { duration: 6000 });
      return;
    }
    await this.router.navigateByUrl('/login');
  }

  private tituloDaRotaAtual(): string {
    let atual = this.rota.snapshot;
    while (atual.firstChild) atual = atual.firstChild;
    return (atual.data['titulo'] as string | undefined) ?? 'Início';
  }
}

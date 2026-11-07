import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { TerminalService } from './terminal.service';

/**
 * Rotas de PDV e caixa (story 1-6, CA-1): só num dispositivo registrado como terminal. Fora dele, vai para a tela
 * "Este computador não está registrado como terminal. Peça ao administrador". Quem protege é o servidor
 * (`RequireTerminal`); o guard só evita abrir a tela para dar erro depois.
 */
export const terminalGuard: CanActivateFn = async (_rota, estado) => {
  const router = inject(Router);
  try {
    const terminal = await inject(TerminalService).atual();
    return terminal ? true : router.createUrlTree(['/terminal-nao-registrado']);
  } catch {
    return router.createUrlTree(['/indisponivel'], { queryParams: { volta: estado.url } });
  }
};

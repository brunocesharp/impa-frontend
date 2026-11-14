import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { ApplicationConfig, isDevMode, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { sessaoExpiradaInterceptor } from './core/auth/sessao-expirada.interceptor';
import { liberacaoInterceptor } from './core/liberacao/liberacao.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      // Antiforgery da API: cookie XSRF-TOKEN → cabeçalho X-XSRF-TOKEN nas requisições que alteram estado.
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
      // A liberação fica por dentro: o 401/403 final (inclusive da requisição refeita) ainda passa pelo da sessão.
      withInterceptors([sessaoExpiradaInterceptor, liberacaoInterceptor]),
    ),
    // Service worker só para os arquivos do app (ngsw-config.json sem dataGroups): nada da API em cache (ADR-010).
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

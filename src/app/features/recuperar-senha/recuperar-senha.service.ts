import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ErroApi } from '../../core/auth/sessao';

/** Mensagem fixa depois do pedido, exista ou não o usuário (cenário 1.10, RN-1.11). */
export const MENSAGEM_PEDIDO_RECEBIDO =
  'Se houver um usuário com esses dados, enviaremos um link para o e-mail cadastrado';

/** Link vencido, já usado ou adulterado (cenário 1.9). */
export const MENSAGEM_LINK_INVALIDO = 'Link inválido ou expirado';

/**
 * 429 do limite próprio da recuperação (`limite-de-recuperacao`): a mesma mensagem do servidor, usada quando a
 * resposta vem sem corpo. Neutra, sem "de entrar": a pessoa não está entrando (R5 da revisão 1).
 */
export const MENSAGEM_MUITOS_PEDIDOS = 'Muitas tentativas. Aguarde um minuto e tente novamente';

/** Aviso do login depois de redefinir. */
export const MENSAGEM_SENHA_REDEFINIDA = 'Senha redefinida. Entre com a nova senha.';

export type ResultadoPedido = { ok: true } | { ok: false; mensagem: string };

export type ResultadoRedefinicao =
  /** `sessaoMantida`: a sessão deste navegador era de outro usuário e continua aberta. */
  | { ok: true; sessaoMantida: boolean }
  | { ok: false; linkInvalido: true }
  | { ok: false; linkInvalido: false; novaSenha?: string; mensagem?: string };

/**
 * Recuperação de senha por e-mail (story 1-8): `POST /api/auth/esqueci-senha` e `POST /api/auth/redefinir-senha`.
 * As duas são anônimas, mas exigem o token XSRF: antes de enviar, consulta a sessão (o que entrega o cookie).
 */
@Injectable({ providedIn: 'root' })
export class RecuperarSenhaService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  async pedir(usuarioOuEmail: string): Promise<ResultadoPedido> {
    await this.auth.carregarSessao();
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/esqueci-senha', { usuarioOuEmail }));
      return { ok: true };
    } catch (erro) {
      if (!(erro instanceof HttpErrorResponse)) throw erro;
      if (erro.status === 429)
        return { ok: false, mensagem: mensagemDe(erro) ?? MENSAGEM_MUITOS_PEDIDOS };
      if (erro.status === 400) {
        const errors = errosDe(erro);
        const primeira = errors && Object.values(errors).flat()[0];
        return {
          ok: false,
          mensagem: primeira ?? mensagemDe(erro) ?? 'Não foi possível enviar. Recarregue a página.',
        };
      }
      throw erro;
    }
  }

  async redefinir(token: string, novaSenha: string): Promise<ResultadoRedefinicao> {
    await this.auth.carregarSessao();
    try {
      await firstValueFrom(this.http.post<void>('/api/auth/redefinir-senha', { token, novaSenha }));
    } catch (erro) {
      if (!(erro instanceof HttpErrorResponse)) throw erro;
      if (erro.status === 429) {
        return {
          ok: false,
          linkInvalido: false,
          mensagem: mensagemDe(erro) ?? MENSAGEM_MUITOS_PEDIDOS,
        };
      }
      if (erro.status === 400) {
        const errors = errosDe(erro);
        if (errors) {
          const porCampo = new Map(
            Object.entries(errors).map(([chave, msgs]) => [chave.toLowerCase(), msgs?.[0]]),
          );
          if (porCampo.has('token')) return { ok: false, linkInvalido: true };
          if (porCampo.get('novasenha'))
            return { ok: false, linkInvalido: false, novaSenha: porCampo.get('novasenha') };
        }
        return {
          ok: false,
          linkInvalido: false,
          mensagem: mensagemDe(erro) ?? 'Não foi possível salvar. Recarregue a página.',
        };
      }
      throw erro;
    }

    // As sessões abertas do dono do link foram encerradas no servidor, inclusive a deste navegador se era dele. A de
    // outro usuário logado aqui (ex.: o operador do caixa) continua aberta (R6 da revisão 1): confere quem ficou.
    if (await this.sessaoContinuaAberta()) return { ok: true, sessaoMantida: true };
    this.auth.encerrarLocalmente(MENSAGEM_SENHA_REDEFINIDA);
    return { ok: true, sessaoMantida: false };
  }

  private async sessaoContinuaAberta(): Promise<boolean> {
    try {
      return (await this.auth.carregarSessao()) !== null;
    } catch {
      return false; // a senha já foi trocada: sem resposta sobre a sessão, segue como se tivesse saído
    }
  }
}

function mensagemDe(erro: HttpErrorResponse): string | null {
  const mensagem = (erro.error as Partial<ErroApi> | null)?.mensagem;
  return typeof mensagem === 'string' && mensagem ? mensagem : null;
}

function errosDe(erro: HttpErrorResponse): Record<string, string[]> | null {
  const errors = (erro.error as { errors?: Record<string, string[]> } | null)?.errors;
  return errors && typeof errors === 'object' ? errors : null;
}

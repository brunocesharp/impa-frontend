import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

/** Campo alterado: `omitido` = sensível (senha, CSC, dado pessoal), sem os valores. */
export interface CampoAuditado {
  campo: string;
  antes: string | null;
  depois: string | null;
  omitido: boolean;
}

/** Operação sensível de `GET /api/auditoria` (story 4.4). */
export interface RegistroDeAuditoria {
  id: string;
  ocorreuEm: string;
  usuarioId: string;
  usuarioNome: string;
  modulo: string;
  entidade: string;
  entidadeId: string;
  operacao: string;
  campos: CampoAuditado[];
}

export interface PaginaDeAuditoria {
  itens: RegistroDeAuditoria[];
  pagina: number;
  tamanhoDaPagina: number;
  total: number;
}

/** Filtros da tela: datas `yyyy-MM-dd` (dia local, inclusive nas duas pontas) e trechos de texto. */
export interface FiltrosDeAuditoria {
  de: string;
  ate: string;
  usuario: string;
  modulo: string;
  entidade: string;
}

export const FILTROS_VAZIOS: FiltrosDeAuditoria = {
  de: '',
  ate: '',
  usuario: '',
  modulo: '',
  entidade: '',
};

export const TAMANHO_DA_PAGINA = 20;

/**
 * Query de `GET /api/auditoria`. O período da tela é por dia local, inclusive; o servidor recebe instantes
 * (`de` inclusive, `ate` exclusive): `de` = 0h do dia, `ate` = 0h do dia seguinte ao escolhido.
 */
export function parametrosDaConsulta(
  filtros: FiltrosDeAuditoria,
  pagina: number,
  tamanho: number,
): Record<string, string> {
  const params: Record<string, string> = {};
  const de = inicioDoDia(filtros.de, 0);
  const ate = inicioDoDia(filtros.ate, 1);
  if (de) params['de'] = de;
  if (ate) params['ate'] = ate;
  for (const chave of ['usuario', 'modulo', 'entidade'] as const) {
    const valor = filtros[chave].trim();
    if (valor) params[chave] = valor;
  }
  params['pagina'] = String(pagina);
  params['tamanho'] = String(tamanho);
  return params;
}

function inicioDoDia(data: string, diasDepois: number): string | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (!partes) return null;
  const [, ano, mes, dia] = partes.map(Number);
  return new Date(ano, mes - 1, dia + diasDepois).toISOString();
}

/** Consulta da auditoria das operações sensíveis (exige `auditoria.ver`). */
@Injectable({ providedIn: 'root' })
export class AuditoriaService {
  private readonly http = inject(HttpClient);

  consultar(
    filtros: FiltrosDeAuditoria,
    pagina: number,
    tamanho = TAMANHO_DA_PAGINA,
  ): Promise<PaginaDeAuditoria> {
    return firstValueFrom(
      this.http.get<PaginaDeAuditoria>('/api/auditoria', {
        params: parametrosDaConsulta(filtros, pagina, tamanho),
      }),
    );
  }
}

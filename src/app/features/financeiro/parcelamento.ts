/** Uma parcela da prévia: "1/3", valor e vencimento (`AAAA-MM-DD`). */
export interface ParcelaPrevia {
  numero: number;
  total: number;
  valor: number;
  vencimento: string;
}

/** Mesmo limite da API (story 11-1). */
export const PARCELAS_MAXIMO = 120;

/**
 * Prévia das parcelas antes de salvar, com a regra da API (RN-23.3): valor dividido em parcelas iguais com a
 * diferença de centavos na primeira; vencimentos mensais no dia do primeiro, ou no último dia do mês que não tem
 * esse dia. Quem grava é o servidor; a prévia só mostra o que ele vai criar. Entrada inválida: lista vazia.
 */
export function calcularParcelas(
  valor: number | null,
  parcelas: number | null,
  primeiroVencimento: string,
): ParcelaPrevia[] {
  const data = /^(\d{4})-(\d{2})-(\d{2})$/.exec(primeiroVencimento ?? '');
  if (valor === null || !(valor > 0) || !Number.isInteger(parcelas) || !data) return [];
  const n = parcelas as number;
  if (n < 1 || n > PARCELAS_MAXIMO) return [];

  const centavos = Math.round(valor * 100);
  if (centavos < n) return [];
  const demais = Math.floor(centavos / n);
  const primeira = centavos - demais * (n - 1);

  const [ano, mes, dia] = [Number(data[1]), Number(data[2]) - 1, Number(data[3])];
  return Array.from({ length: n }, (_, i) => ({
    numero: i + 1,
    total: n,
    valor: (i === 0 ? primeira : demais) / 100,
    vencimento: somarMeses(ano, mes, dia, i),
  }));
}

function somarMeses(ano: number, mes: number, dia: number, meses: number): string {
  const alvo = new Date(Date.UTC(ano, mes + meses, 1));
  const ultimoDia = new Date(
    Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
  ).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimoDia));
  return alvo.toISOString().slice(0, 10);
}

/**
 * Valor digitado em reais: "1.000,00", "1000,5", "333.34" ou "R$ 350,00". Nulo quando não é um número com até dois
 * decimais.
 */
export function lerValor(texto: string | null): number | null {
  let t = (texto ?? '').replace(/R\$/i, '').replace(/\s/g, '');
  if (!t) return null;
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Number(t);
}

const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatarMoeda(valor: number): string {
  return MOEDA.format(valor);
}

/** `AAAA-MM-DD` → `DD/MM/AAAA`. */
export function formatarData(data: string): string {
  const [ano, mes, dia] = data.split('-');
  return `${dia}/${mes}/${ano}`;
}

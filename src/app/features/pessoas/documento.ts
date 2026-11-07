import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Mensagens iguais às do servidor (cenário 14.2 e decisão de 07/11/2026). */
export const MENSAGEM_CPF_INVALIDO = 'CPF inválido';
export const MENSAGEM_CNPJ_INVALIDO = 'CNPJ inválido';
export const MENSAGEM_DOCUMENTO_INVALIDO = 'CPF ou CNPJ inválido';
export const MENSAGEM_DOCUMENTO_DO_FORNECEDOR = 'Informe o CNPJ ou CPF do fornecedor';

export const somenteDigitos = (texto: string | null | undefined): string =>
  (texto ?? '').replace(/\D/g, '');

function digito(numeros: number[], pesos: number[]): number {
  const resto = numeros.reduce((soma, n, i) => soma + n * pesos[i], 0) % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function cpfValido(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return false;
  const n = [...d].map(Number);
  return (
    digito(n.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[9] &&
    digito(n.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === n[10]
  );
}

function cnpjValido(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return false;
  const n = [...d].map(Number);
  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return (
    digito(n.slice(0, 12), pesos1) === n[12] && digito(n.slice(0, 13), [6, ...pesos1]) === n[13]
  );
}

/**
 * Mensagem do documento inválido, ou `null` se válido (ou vazio). Mesma regra do servidor: só dígitos ou máscara
 * (`.`, `-`, `/`, espaço); 11 dígitos é CPF, 14 é CNPJ; sequências repetidas são recusadas.
 */
export function erroDoDocumento(texto: string | null | undefined): string | null {
  const valor = (texto ?? '').trim();
  if (!valor) return null;
  if (!/^[\d./\- ]+$/.test(valor)) return MENSAGEM_DOCUMENTO_INVALIDO;
  const d = somenteDigitos(valor);
  if (d.length === 11) return cpfValido(d) ? null : MENSAGEM_CPF_INVALIDO;
  if (d.length === 14) return cnpjValido(d) ? null : MENSAGEM_CNPJ_INVALIDO;
  return MENSAGEM_DOCUMENTO_INVALIDO;
}

/** Cliente: documento opcional, mas válido quando informado (RN-14.1). Erro: `{ documento: mensagem }`. */
export const documentoOpcional: ValidatorFn = (
  controle: AbstractControl,
): ValidationErrors | null => {
  const erro = erroDoDocumento(controle.value as string);
  return erro ? { documento: erro } : null;
};

/** Fornecedor: documento obrigatório e válido (RN-14.2). Erro: `{ documento: mensagem }`. */
export const documentoObrigatorio: ValidatorFn = (
  controle: AbstractControl,
): ValidationErrors | null => {
  if (!((controle.value as string | null) ?? '').trim())
    return { documento: MENSAGEM_DOCUMENTO_DO_FORNECEDOR };
  return documentoOpcional(controle);
};

/** Telefone só com dígitos, como a API devolve, para exibir: (31) 99999-0000. */
export function formatarTelefone(digitos: string | null | undefined): string {
  const d = somenteDigitos(digitos);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return d;
}

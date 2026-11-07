import { FormControl } from '@angular/forms';
import {
  documentoObrigatorio,
  documentoOpcional,
  erroDoDocumento,
  formatarTelefone,
} from './documento';

describe('documento (story 3-7, cenário 14.2)', () => {
  it('aceita CPF e CNPJ válidos, com ou sem máscara', () => {
    for (const valido of ['529.982.247-25', '52998224725', '11.222.333/0001-81', '11222333000181'])
      expect(erroDoDocumento(valido)).toBeNull();
  });

  it('recusa CPF inválido e sequência repetida com "CPF inválido"', () => {
    expect(erroDoDocumento('111.111.111-11')).toBe('CPF inválido');
    expect(erroDoDocumento('529.982.247-24')).toBe('CPF inválido');
  });

  it('recusa CNPJ inválido com "CNPJ inválido"', () => {
    expect(erroDoDocumento('11.222.333/0001-82')).toBe('CNPJ inválido');
  });

  it('recusa o que não é CPF nem CNPJ', () => {
    expect(erroDoDocumento('1234')).toBe('CPF ou CNPJ inválido');
    expect(erroDoDocumento('529.982.247-2X')).toBe('CPF ou CNPJ inválido');
  });

  it('cliente: documento opcional (vazio é válido)', () => {
    expect(new FormControl('', documentoOpcional).valid).toBe(true);
    expect(new FormControl('111.111.111-11', documentoOpcional).errors).toEqual({
      documento: 'CPF inválido',
    });
  });

  it('fornecedor: documento obrigatório', () => {
    expect(new FormControl('', documentoObrigatorio).errors).toEqual({
      documento: 'Informe o CNPJ ou CPF do fornecedor',
    });
    expect(new FormControl('11.222.333/0001-81', documentoObrigatorio).valid).toBe(true);
  });

  it('formata o telefone guardado só com dígitos', () => {
    expect(formatarTelefone('31999990000')).toBe('(31) 99999-0000');
    expect(formatarTelefone('3133334444')).toBe('(31) 3333-4444');
  });
});

import { calcularParcelas, formatarData, formatarMoeda, lerValor } from './parcelamento';

const semEspacoDuro = (texto: string) => texto.replace(/ /g, ' ');

describe('Parcelamento na tela (story 11-1, RN-23.3)', () => {
  it('cenário 23.1: R$ 1.000,00 em 3 parcelas a partir de 31/01/2027', () => {
    expect(calcularParcelas(1000, 3, '2027-01-31')).toEqual([
      { numero: 1, total: 3, valor: 333.34, vencimento: '2027-01-31' },
      { numero: 2, total: 3, valor: 333.33, vencimento: '2027-02-28' },
      { numero: 3, total: 3, valor: 333.33, vencimento: '2027-03-31' },
    ]);
  });

  it('vencimentos no dia do primeiro, não do anterior', () => {
    expect(calcularParcelas(500, 5, '2027-01-30').map((p) => p.vencimento)).toEqual([
      '2027-01-30',
      '2027-02-28',
      '2027-03-30',
      '2027-04-30',
      '2027-05-30',
    ]);
  });

  it('ano bissexto e virada de ano', () => {
    expect(calcularParcelas(200, 2, '2028-01-31')[1].vencimento).toBe('2028-02-29');
    expect(calcularParcelas(300, 3, '2026-11-15').map((p) => p.vencimento)).toEqual([
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  it('diferença de centavos na primeira', () => {
    const parcelas = calcularParcelas(100, 7, '2027-01-01');
    expect(parcelas[0].valor).toBe(14.32);
    expect(parcelas.slice(1).every((p) => p.valor === 14.28)).toBe(true);
  });

  it('sem prévia quando o valor, a quantidade ou a data não servem', () => {
    expect(calcularParcelas(null, 3, '2027-01-31')).toEqual([]);
    expect(calcularParcelas(0, 3, '2027-01-31')).toEqual([]);
    expect(calcularParcelas(100, 0, '2027-01-31')).toEqual([]);
    expect(calcularParcelas(100, 121, '2027-01-31')).toEqual([]);
    expect(calcularParcelas(0.02, 3, '2027-01-31')).toEqual([]);
    expect(calcularParcelas(100, 3, '')).toEqual([]);
  });

  it('lê o valor como o usuário digita', () => {
    expect(lerValor('1.000,00')).toBe(1000);
    expect(lerValor('1000,5')).toBe(1000.5);
    expect(lerValor('333.34')).toBe(333.34);
    expect(lerValor('2.000')).toBe(2000);
    expect(lerValor(' R$ 350,00 ')).toBe(350);
    expect(lerValor('')).toBeNull();
    expect(lerValor('abc')).toBeNull();
    expect(lerValor('10,001')).toBeNull();
  });

  it('formata moeda e data em pt-BR', () => {
    expect(semEspacoDuro(formatarMoeda(333.34))).toBe('R$ 333,34');
    expect(semEspacoDuro(formatarMoeda(1000))).toBe('R$ 1.000,00');
    expect(formatarData('2027-02-28')).toBe('28/02/2027');
  });
});

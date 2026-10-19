import { describe, expect, it } from 'vitest';
import { montarCSV } from '../csv';

describe('CSV para o Excel em pt-BR', () => {
  it('separa por ponto e vírgula e usa vírgula decimal', () => {
    const csv = montarCSV(
      ['Unidade', 'Faturamento'],
      [
        ['Caverna', 530],
        ['Piscina', 220.5],
      ]
    );

    expect(csv).toBe(
      '"Unidade";"Faturamento"\r\n' + '"Caverna";"530,00"\r\n' + '"Piscina";"220,50"'
    );
  });

  it('escapa aspas e preserva acentos', () => {
    const csv = montarCSV(['Descrição'], [['Pizza "da casa"']]);
    expect(csv).toBe('"Descrição"\r\n"Pizza ""da casa"""');
  });

  it('trata nulo e indefinido como célula vazia', () => {
    const csv = montarCSV(['Chalé', 'Custo'], [[null, undefined]]);
    expect(csv).toBe('"Chalé";"Custo"\r\n"";""');
  });
});

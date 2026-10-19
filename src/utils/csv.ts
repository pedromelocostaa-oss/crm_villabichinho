// CSV para o Excel em pt-BR: separador ponto e vírgula, decimal com vírgula
// e BOM no começo, senão os acentos chegam quebrados.

export type ValorCSV = string | number | null | undefined;

function celula(valor: ValorCSV): string {
  if (valor == null) return '""';
  if (typeof valor === 'number') {
    return `"${valor.toFixed(2).replace('.', ',')}"`;
  }
  return `"${valor.replace(/"/g, '""')}"`;
}

export function montarCSV(cabecalho: string[], linhas: ValorCSV[][]): string {
  return [cabecalho.map((h) => celula(h)).join(';'), ...linhas.map((l) => l.map(celula).join(';'))].join(
    '\r\n'
  );
}

export function baixarCSV(nomeArquivo: string, cabecalho: string[], linhas: ValorCSV[][]): void {
  const conteudo = '﻿' + montarCSV(cabecalho, linhas);
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo.endsWith('.csv') ? nomeArquivo : `${nomeArquivo}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

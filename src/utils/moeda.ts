/** Formata em BRL pt-BR. O dashboard usa 0 casas; lançamento usa centavos. */
export function brl(valor: number | null | undefined, casas: 0 | 2 = 2): string {
  if (valor == null) return '—';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  }).format(valor);
}

/** Converte o que o usuário digita ("12,50", "12.50", "1.234,56") em número. */
export function paraNumero(texto: string): number {
  const limpo = texto.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

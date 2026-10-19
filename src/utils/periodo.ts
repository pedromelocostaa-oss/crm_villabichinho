export type Periodo = 'hoje' | 'semana' | 'mes' | 'personalizado';

export function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function intervalo(periodo: Periodo, de: string, ate: string): [string, string] {
  const hoje = new Date();

  if (periodo === 'hoje') return [iso(hoje), iso(hoje)];

  if (periodo === 'semana') {
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - 6);
    return [iso(inicio), iso(hoje)];
  }

  if (periodo === 'mes') {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    return [iso(inicio), iso(fim)];
  }

  return [de, ate];
}

export function dataBR(iso8601: string): string {
  return new Date(iso8601 + 'T00:00:00').toLocaleDateString('pt-BR');
}

export function rotuloPeriodo(periodo: Periodo, de: string, ate: string): string {
  const hoje = new Date();

  if (periodo === 'hoje') return hoje.toLocaleDateString('pt-BR');
  if (periodo === 'semana') return 'Últimos 7 dias';
  if (periodo === 'mes') {
    const nome = hoje.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    return nome.charAt(0).toUpperCase() + nome.slice(1);
  }
  if (!de || !ate) return 'Escolha o intervalo';
  return `${dataBR(de)} — ${dataBR(ate)}`;
}

// Relatorios consolidados. Cada um responde a uma pergunta que o Pedro
// fez na especificacao, e todos saem em CSV.

import { supabase } from './supabase';
import { faturamentoDoPeriodo, recebimentosDoPeriodo, round2 } from './financeiro';
import type { FaturamentoItem } from '../types/database';

function soma(itens: FaturamentoItem[]): number {
  return round2(itens.reduce((t, i) => t + Number(i.valor_liquido_item), 0));
}

// ─────────────────────────────────────────────────────────────
// Hospedagem: direta x Booking, bruto e liquido de comissao
// ─────────────────────────────────────────────────────────────

export type LinhaHospedagem = {
  origem: string;
  bruto: number;
  comissao: number;
  liquido: number;
};

export async function relatorioHospedagem(
  inicio: string,
  fim: string
): Promise<LinhaHospedagem[]> {
  const itens = (await faturamentoDoPeriodo(inicio, fim)).filter(
    (i) => i.unidade_slug === 'hospedagem'
  );

  const direta = soma(itens.filter((i) => i.centro_slug === 'hospedagem_direta'));
  const itensBooking = itens.filter((i) => i.centro_slug === 'hospedagem_booking');
  const booking = soma(itensBooking);

  const reservas = [...new Set(itensBooking.map((i) => i.reserva_id).filter((r): r is string => !!r))];

  let comissao = 0;
  if (reservas.length > 0) {
    const { data, error } = await supabase
      .from('booking_commissions')
      .select('reserva_id, valor_comissao')
      .in('reserva_id', reservas);
    if (error) throw new Error(`Falha ao consultar comissões: ${error.message}`);
    comissao = round2((data ?? []).reduce((t, c) => t + Number(c.valor_comissao), 0));
  }

  // Reserva direta nao paga comissao: liquido e igual ao bruto.
  return [
    { origem: 'Hospedagem direta', bruto: direta, comissao: 0, liquido: direta },
    { origem: 'Hospedagem Booking', bruto: booking, comissao, liquido: round2(booking - comissao) },
  ];
}

// ─────────────────────────────────────────────────────────────
// Consumo adicional por reserva
// ─────────────────────────────────────────────────────────────

export type LinhaConsumo = {
  reserva_id: string;
  hospede: string;
  chale: string | null;
  hospedagem: number;
  consumo: number;
  total: number;
};

export async function relatorioConsumoPorReserva(
  inicio: string,
  fim: string
): Promise<LinhaConsumo[]> {
  const itens = (await faturamentoDoPeriodo(inicio, fim)).filter((i) => i.reserva_id !== null);
  if (itens.length === 0) return [];

  const porReserva = new Map<string, { hospedagem: number; consumo: number }>();
  for (const item of itens) {
    const id = item.reserva_id as string;
    const atual = porReserva.get(id) ?? { hospedagem: 0, consumo: 0 };
    const valor = Number(item.valor_liquido_item);
    if (item.unidade_slug === 'hospedagem') atual.hospedagem += valor;
    else atual.consumo += valor;
    porReserva.set(id, atual);
  }

  const ids = [...porReserva.keys()];
  const { data: reservas, error } = await supabase
    .from('reservas')
    .select('id, hospede_id, chale_id')
    .in('id', ids);
  if (error) throw new Error(`Falha ao consultar reservas: ${error.message}`);

  const linhas = reservas ?? [];
  const [hospedes, chales] = await Promise.all([
    supabase.from('hospedes').select('id, nome').in('id', linhas.map((r) => r.hospede_id)),
    supabase
      .from('chales')
      .select('id, nome')
      .in('id', linhas.map((r) => r.chale_id).filter((id): id is string => !!id)),
  ]);

  const nomeHospede = new Map((hospedes.data ?? []).map((h) => [h.id, h.nome]));
  const nomeChale = new Map((chales.data ?? []).map((c) => [c.id, c.nome]));

  return linhas
    .map((r) => {
      const valores = porReserva.get(r.id) ?? { hospedagem: 0, consumo: 0 };
      return {
        reserva_id: r.id,
        hospede: nomeHospede.get(r.hospede_id) ?? 'Hóspede',
        chale: r.chale_id ? nomeChale.get(r.chale_id) ?? null : null,
        hospedagem: round2(valores.hospedagem),
        consumo: round2(valores.consumo),
        total: round2(valores.hospedagem + valores.consumo),
      };
    })
    .sort((a, b) => b.consumo - a.consumo);
}

// ─────────────────────────────────────────────────────────────
// Recebimentos por forma de pagamento, com as taxas pagas
// ─────────────────────────────────────────────────────────────

export type LinhaRecebimento = {
  forma: string;
  quantidade: number;
  bruto: number;
  taxa: number;
  liquido: number;
};

const ROTULO_FORMA: Record<string, string> = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  repasse_booking: 'Repasse Booking',
  outro: 'Outro',
};

export async function relatorioRecebimentos(
  inicio: string,
  fim: string
): Promise<LinhaRecebimento[]> {
  const recebimentos = await recebimentosDoPeriodo(inicio, fim);

  const mapa = new Map<string, LinhaRecebimento>();
  for (const r of recebimentos) {
    const chave = r.forma_pagamento;
    const atual = mapa.get(chave) ?? {
      forma: ROTULO_FORMA[chave] ?? chave,
      quantidade: 0,
      bruto: 0,
      taxa: 0,
      liquido: 0,
    };
    atual.quantidade += 1;
    atual.bruto += Number(r.valor_bruto_pago);
    atual.taxa += Number(r.taxa_cartao);
    atual.liquido += Number(r.valor_caixa);
    mapa.set(chave, atual);
  }

  return [...mapa.values()]
    .map((l) => ({
      ...l,
      bruto: round2(l.bruto),
      taxa: round2(l.taxa),
      liquido: round2(l.liquido),
    }))
    .sort((a, b) => b.liquido - a.liquido);
}

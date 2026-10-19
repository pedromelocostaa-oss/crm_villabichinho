// Testes de aceite do modulo financeiro, contra o Postgres real.
// Rodam no banco porque as regras que importam (limite de alocacao, comissao
// do Booking, taxa de cartao, auditoria) estao em trigger e constraint.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../supabase';
import {
  abrirFolio,
  cancelarVenda,
  centroPorSlug,
  comissaoDaReserva,
  contaDoFolio,
  criarHospede,
  criarReserva,
  criarVenda,
  estornarPagamento,
  hojeISO,
  registrarPagamento,
  round2,
} from '../financeiro';
import type { LinhaAgrupada } from '../financeiro';

const HOJE = hojeISO();
/** O banco exige check_out > check_in: a reserva tem ao menos uma noite. */
const AMANHA = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
const vendasCriadas: string[] = [];
const pagamentosCriados: string[] = [];
const reservasCriadas: string[] = [];

/** Taxa semeada para credito a vista em card_fee_rules. */
const TAXA_CREDITO_VISTA = 0.032;

const centros: Record<string, string> = {};

function valorDe(linhas: LinhaAgrupada[], chave: string): number {
  return linhas.find((l) => l.chave === chave)?.valor ?? 0;
}

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL ?? '',
    password: process.env.TEST_USER_PASSWORD ?? '',
  });
  if (error) throw new Error(`Falha no login de teste: ${error.message}`);

  for (const slug of [
    'hospedagem_direta',
    'hospedagem_booking',
    'caverna_gastronomica',
    'pizzaria',
    'bar_piscina',
    'frigobar',
  ]) {
    centros[slug] = (await centroPorSlug(slug)).id;
  }
});

afterAll(async () => {
  // Cancelar a venda NAO desfaz o pagamento: o dinheiro so sai do caixa por
  // estorno. Sem isso, o recebido do dashboard fica inflado pelos testes.
  for (const id of pagamentosCriados) {
    await estornarPagamento(id, 'limpeza do teste automatizado');
  }
  // Cancelamento nunca deleta, entao a limpeza tambem exercita a RPC.
  for (const id of vendasCriadas) {
    await cancelarVenda(id, 'limpeza do teste automatizado');
  }
  // Reserva viva entra no denominador do ticket medio por reserva.
  if (reservasCriadas.length > 0) {
    await supabase.from('reservas').update({ status: 'cancelada' }).in('id', reservasCriadas);
  }
  await supabase.auth.signOut();
});

/** Hospedagem + consumos da estadia, nos centros de receita de origem. */
async function montarEstadia(origem: 'direta' | 'booking') {
  const marca = `${origem}-${Date.now()}`;

  const hospede = await criarHospede({ nome: `Teste aceite ${marca}` });
  const reserva = await criarReserva({
    hospede_id: hospede.id,
    origem,
    check_in: HOJE,
    check_out: AMANHA,
  });
  reservasCriadas.push(reserva.id);
  const folio = await abrirFolio({ reserva_id: reserva.id, hospede_id: hospede.id });

  const hospedagem = await criarVenda({
    folio_id: folio.id,
    data_venda: HOJE,
    descricao: 'Hospedagem',
    itens: [
      {
        revenue_center_id:
          origem === 'booking' ? centros.hospedagem_booking : centros.hospedagem_direta,
        descricao: 'Diárias',
        valor_unitario: 2000,
      },
    ],
  });
  vendasCriadas.push(hospedagem.venda.id);

  const consumo = await criarVenda({
    folio_id: folio.id,
    data_venda: HOJE,
    descricao: 'Consumo da estadia',
    itens: [
      { revenue_center_id: centros.bar_piscina, descricao: 'Bar da piscina', valor_unitario: 150 },
      { revenue_center_id: centros.caverna_gastronomica, descricao: 'Jantar', valor_unitario: 140 },
      { revenue_center_id: centros.pizzaria, descricao: 'Pizza', valor_unitario: 90 },
      { revenue_center_id: centros.frigobar, descricao: 'Frigobar', valor_unitario: 80 },
    ],
  });
  vendasCriadas.push(consumo.venda.id);

  return { hospede, reserva, folio };
}

describe('Teste 1 — reserva direta com consumo durante a estadia', () => {
  it('soma a conta sem contar nenhuma receita duas vezes', async () => {
    const { folio } = await montarEstadia('direta');

    // Sinal no Pix no ato da reserva.
    const sinal = await registrarPagamento({
      folio_id: folio.id,
      forma_pagamento: 'pix',
      valor_bruto_pago: 1000,
      data_recebimento: HOJE,
      status: 'recebido',
    });
    pagamentosCriados.push(sinal.pagamento.id);
    expect(sinal.naoAlocado).toBe(0);

    // Restante no credito, no check-out.
    const checkout = await registrarPagamento({
      folio_id: folio.id,
      forma_pagamento: 'credito',
      valor_bruto_pago: 1460,
      data_recebimento: HOJE,
      status: 'recebido',
    });
    pagamentosCriados.push(checkout.pagamento.id);
    expect(checkout.naoAlocado).toBe(0);

    const conta = await contaDoFolio(folio.id);

    expect(conta.hospedagem).toBeCloseTo(2000, 2);
    expect(conta.consumo_adicional).toBeCloseTo(460, 2);
    expect(conta.total).toBeCloseTo(2460, 2);

    // Cada valor permanece no seu centro de receita de origem.
    expect(valorDe(conta.porCentro, 'hospedagem_direta')).toBeCloseTo(2000, 2);
    expect(valorDe(conta.porCentro, 'bar_piscina')).toBeCloseTo(150, 2);
    expect(valorDe(conta.porCentro, 'caverna_gastronomica')).toBeCloseTo(140, 2);
    expect(valorDe(conta.porCentro, 'pizzaria')).toBeCloseTo(90, 2);
    expect(valorDe(conta.porCentro, 'frigobar')).toBeCloseTo(80, 2);

    expect(valorDe(conta.porUnidade, 'hospedagem')).toBeCloseTo(2000, 2);
    expect(valorDe(conta.porUnidade, 'caverna')).toBeCloseTo(230, 2);
    expect(valorDe(conta.porUnidade, 'piscina')).toBeCloseTo(150, 2);
    expect(valorDe(conta.porUnidade, 'frigobar')).toBeCloseTo(80, 2);

    // Faturamento e 2.460, nao 4.920: os dois pagamentos nao viram receita.
    expect(conta.total).toBeCloseTo(2460, 2);
    expect(conta.pago).toBeCloseTo(2460, 2);
    expect(conta.saldo).toBeCloseTo(0, 2);

    // Taxa de cartao reduz o caixa, nunca o faturamento.
    const taxaEsperada = round2(1460 * TAXA_CREDITO_VISTA);
    expect(Number(checkout.pagamento.taxa_cartao)).toBeCloseTo(taxaEsperada, 2);
    expect(Number(checkout.pagamento.valor_liquido_previsto)).toBeCloseTo(1460 - taxaEsperada, 2);

    const { data: recebimentos } = await supabase
      .from('v_recebimentos')
      .select('*')
      .eq('folio_id', folio.id);

    const brutoRecebido = (recebimentos ?? []).reduce(
      (t, r) => t + Number(r.valor_bruto_pago),
      0
    );
    const caixa = (recebimentos ?? []).reduce((t, r) => t + Number(r.valor_caixa), 0);

    expect(brutoRecebido).toBeCloseTo(2460, 2);
    expect(caixa).toBeCloseTo(2460 - taxaEsperada, 2);
  });
});

describe('Teste 2 — a mesma reserva vinda do Booking', () => {
  it('cobra comissão só sobre a hospedagem', async () => {
    const { reserva, folio } = await montarEstadia('booking');

    const comissao = await comissaoDaReserva(reserva.id);
    expect(comissao).not.toBeNull();

    // A base da comissao e a hospedagem, nao a conta inteira.
    expect(Number(comissao!.valor_bruto_hospedagem)).toBeCloseTo(2000, 2);
    expect(Number(comissao!.percentual_comissao)).toBeCloseTo(0.17, 4);
    expect(Number(comissao!.valor_comissao)).toBeCloseTo(340, 2);
    expect(Number(comissao!.valor_liquido_repasse)).toBeCloseTo(1660, 2);

    const conta = await contaDoFolio(folio.id);

    // O faturamento bruto nao muda: a comissao reduz a receita liquida.
    expect(conta.hospedagem).toBeCloseTo(2000, 2);
    expect(conta.consumo_adicional).toBeCloseTo(460, 2);

    const receitaLiquidaTotal = round2(
      Number(comissao!.valor_liquido_repasse) + conta.consumo_adicional
    );
    expect(receitaLiquidaTotal).toBeCloseTo(2120, 2);
  });
});

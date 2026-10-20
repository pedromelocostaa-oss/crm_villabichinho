// Camada financeira da Villa Bichinho.
//
// Regras que NAO estao aqui porque vivem no banco, onde nao da para burlar:
// limite de alocacao por item, comissao do Booking sobre hospedagem, taxa de
// cartao, auditoria e a exigencia de motivo em cancelamento e estorno.

import { supabase } from './supabase';
import type {
  AReceber,
  BookingCommission,
  BusinessUnit,
  CaixaPorItem,
  CategoriaCusto,
  Chale,
  FaturamentoItem,
  Folio,
  FormaPagamento,
  Hospede,
  Origem,
  Payment,
  ProductCatalog,
  Recebimento,
  Reserva,
  RevenueCenter,
  ResultadoUnidade,
  Sale,
  SaleItem,
  StatusPagamento,
  StatusReserva,
  TicketMedioConsumo,
  UnitExpense,
} from '../types/database';

export function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function round2(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

function num(valor: number | string | null | undefined): number {
  return valor == null ? 0 : Number(valor);
}

class ErroFinanceiro extends Error {
  constructor(contexto: string, detalhe?: string) {
    super(detalhe ? `${contexto}: ${detalhe}` : contexto);
    this.name = 'ErroFinanceiro';
  }
}

// ─────────────────────────────────────────────────────────────
// Catalogo
// ─────────────────────────────────────────────────────────────

export async function listarUnidades(): Promise<BusinessUnit[]> {
  const { data, error } = await supabase
    .from('business_units')
    .select('*')
    .eq('ativo', true)
    .order('ordem_exibicao');
  if (error) throw new ErroFinanceiro('Falha ao listar unidades', error.message);
  return data ?? [];
}

export async function listarCentros(unidadeId?: string): Promise<RevenueCenter[]> {
  let q = supabase.from('revenue_centers').select('*').eq('ativo', true).order('ordem_exibicao');
  if (unidadeId) q = q.eq('business_unit_id', unidadeId);
  const { data, error } = await q;
  if (error) throw new ErroFinanceiro('Falha ao listar centros de receita', error.message);
  return data ?? [];
}

/** Resolve o id de um centro pelo slug. Evita espalhar uuid pelo codigo. */
export async function centroPorSlug(slug: string): Promise<RevenueCenter> {
  const { data, error } = await supabase
    .from('revenue_centers')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw new ErroFinanceiro(`Falha ao buscar o centro ${slug}`, error.message);
  if (!data) throw new ErroFinanceiro(`Centro de receita inexistente: ${slug}`);
  return data;
}

export async function listarProdutos(
  centroId?: string,
  incluirInativos = false
): Promise<ProductCatalog[]> {
  let q = supabase.from('product_catalog').select('*').order('nome');
  if (!incluirInativos) q = q.eq('ativo', true);
  if (centroId) q = q.eq('revenue_center_id', centroId);
  const { data, error } = await q;
  if (error) throw new ErroFinanceiro('Falha ao listar produtos', error.message);
  return data ?? [];
}

export async function listarChales(): Promise<Chale[]> {
  const { data, error } = await supabase
    .from('chales')
    .select('*')
    .eq('ativo', true)
    .order('ordem_exibicao');
  if (error) throw new ErroFinanceiro('Falha ao listar chalés', error.message);
  return data ?? [];
}

// ─────────────────────────────────────────────────────────────
// Hospedes, reservas e conta
// ─────────────────────────────────────────────────────────────

export async function criarHospede(input: {
  nome: string;
  telefone?: string | null;
  email?: string | null;
  documento?: string | null;
  observacoes?: string | null;
}): Promise<Hospede> {
  const { data, error } = await supabase.from('hospedes').insert(input).select().single();
  if (error) throw new ErroFinanceiro('Falha ao criar hóspede', error.message);
  return data;
}

export async function criarReserva(input: {
  hospede_id: string;
  origem: Origem;
  check_in: string;
  check_out: string;
  chale_id?: string | null;
  lead_id?: string | null;
  codigo_externo?: string | null;
  adultos?: number;
  criancas?: number;
  status?: StatusReserva;
  observacoes?: string | null;
}): Promise<Reserva> {
  const { data, error } = await supabase.from('reservas').insert(input).select().single();
  if (error) throw new ErroFinanceiro('Falha ao criar reserva', error.message);
  return data;
}

/** Uma conta por reserva. Sem reserva_id, abre folio avulso (jantar, day use). */
export async function abrirFolio(input: {
  reserva_id?: string | null;
  hospede_id?: string | null;
  chale_id?: string | null;
  observacoes?: string | null;
}): Promise<Folio> {
  const { data, error } = await supabase.from('folios').insert(input).select().single();
  if (error) throw new ErroFinanceiro('Falha ao abrir conta', error.message);
  return data;
}

export async function fecharFolio(folioId: string): Promise<void> {
  const { error } = await supabase
    .from('folios')
    .update({ status: 'fechada', fechada_em: new Date().toISOString() })
    .eq('id', folioId);
  if (error) throw new ErroFinanceiro('Falha ao fechar conta', error.message);
}

// ─────────────────────────────────────────────────────────────
// Vendas
// ─────────────────────────────────────────────────────────────

export type NovoItem = {
  revenue_center_id: string;
  descricao: string;
  valor_unitario: number;
  quantidade?: number;
  desconto?: number;
  /** Sempre opcional. Lancamento nunca trava por falta de custo. */
  custo_unitario?: number | null;
  product_id?: string | null;
};

/**
 * O centro de receita vive no ITEM, nunca na venda: uma comanda da Caverna
 * pode ter pizza (centro Pizzaria) e vinho (centro Caverna gastronomica).
 */
export async function criarVenda(input: {
  itens: NovoItem[];
  folio_id?: string | null;
  data_venda?: string;
  descricao?: string | null;
  origem_reserva?: Origem | null;
  observacoes?: string | null;
}): Promise<{ venda: Sale; itens: SaleItem[] }> {
  if (input.itens.length === 0) {
    throw new ErroFinanceiro('Uma venda precisa de pelo menos um item');
  }

  const { data: venda, error: erroVenda } = await supabase
    .from('sales')
    .insert({
      folio_id: input.folio_id ?? null,
      data_venda: input.data_venda ?? hojeISO(),
      descricao: input.descricao ?? null,
      origem_reserva: input.origem_reserva ?? null,
      observacoes: input.observacoes ?? null,
      status: 'fechada',
    })
    .select()
    .single();
  if (erroVenda) throw new ErroFinanceiro('Falha ao criar venda', erroVenda.message);

  const itens = await adicionarItens(venda.id, input.itens);
  return { venda, itens };
}

export async function adicionarItens(saleId: string, itens: NovoItem[]): Promise<SaleItem[]> {
  const linhas = itens.map((item) => ({
    sale_id: saleId,
    revenue_center_id: item.revenue_center_id,
    product_id: item.product_id ?? null,
    descricao: item.descricao,
    quantidade: item.quantidade ?? 1,
    valor_unitario: item.valor_unitario,
    desconto: item.desconto ?? 0,
    custo_unitario: item.custo_unitario ?? null,
    status: 'ativo' as const,
  }));

  const { data, error } = await supabase.from('sale_items').insert(linhas).select();
  if (error) throw new ErroFinanceiro('Falha ao lançar itens', error.message);
  return data ?? [];
}

/** Cancelamento nunca deleta. Vai pela RPC porque o motivo e obrigatorio. */
export async function cancelarVenda(saleId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_venda', { p_id: saleId, p_motivo: motivo });
  if (error) throw new ErroFinanceiro('Falha ao cancelar venda', error.message);
}

export async function cancelarItem(itemId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_item', { p_id: itemId, p_motivo: motivo });
  if (error) throw new ErroFinanceiro('Falha ao cancelar item', error.message);
}

// ─────────────────────────────────────────────────────────────
// Pagamentos e alocacao
// ─────────────────────────────────────────────────────────────

type ItemEmAberto = { sale_item_id: string; saldo: number; criado_em: string };

/** Itens com saldo em aberto, do mais antigo para o mais novo. */
export async function itensEmAberto(escopo: {
  folio_id?: string;
  sale_id?: string;
}): Promise<ItemEmAberto[]> {
  let saleIds: string[];

  if (escopo.sale_id) {
    saleIds = [escopo.sale_id];
  } else if (escopo.folio_id) {
    const { data, error } = await supabase
      .from('sales')
      .select('id, status')
      .eq('folio_id', escopo.folio_id)
      .neq('status', 'cancelada');
    if (error) throw new ErroFinanceiro('Falha ao buscar vendas da conta', error.message);
    saleIds = (data ?? []).map((v) => v.id);
  } else {
    throw new ErroFinanceiro('Informe folio_id ou sale_id para alocar');
  }

  if (saleIds.length === 0) return [];

  const { data: itens, error: erroItens } = await supabase
    .from('sale_items')
    .select('id, criado_em, status')
    .in('sale_id', saleIds)
    .eq('status', 'ativo')
    .order('criado_em', { ascending: true });
  if (erroItens) throw new ErroFinanceiro('Falha ao buscar itens', erroItens.message);

  const ids = (itens ?? []).map((i) => i.id);
  if (ids.length === 0) return [];

  const { data: saldos, error: erroSaldo } = await supabase
    .from('v_saldo_item')
    .select('sale_item_id, saldo')
    .in('sale_item_id', ids);
  if (erroSaldo) throw new ErroFinanceiro('Falha ao calcular saldo', erroSaldo.message);

  const porItem = new Map((saldos ?? []).map((s) => [s.sale_item_id, num(s.saldo)]));

  return (itens ?? [])
    .map((i) => ({ sale_item_id: i.id, saldo: porItem.get(i.id) ?? 0, criado_em: i.criado_em }))
    .filter((i) => i.saldo > 0);
}

export type Alocacao = { sale_item_id: string; valor_alocado: number };

/** Quita os itens mais antigos primeiro. O excedente fica sem alocar. */
export function sugerirAlocacao(
  abertos: ItemEmAberto[],
  valor: number
): { alocacoes: Alocacao[]; naoAlocado: number } {
  let restante = round2(valor);
  const alocacoes: Alocacao[] = [];

  for (const item of abertos) {
    if (restante <= 0) break;
    const parcela = round2(Math.min(restante, item.saldo));
    if (parcela <= 0) continue;
    alocacoes.push({ sale_item_id: item.sale_item_id, valor_alocado: parcela });
    restante = round2(restante - parcela);
  }

  return { alocacoes, naoAlocado: restante };
}

export async function alocarPagamento(
  paymentId: string,
  alocacoes: Alocacao[]
): Promise<void> {
  if (alocacoes.length === 0) return;
  const { error } = await supabase.from('payment_allocations').insert(
    alocacoes.map((a) => ({
      payment_id: paymentId,
      sale_item_id: a.sale_item_id,
      valor_alocado: a.valor_alocado,
    }))
  );
  if (error) throw new ErroFinanceiro('Falha ao alocar pagamento', error.message);
}

/**
 * A alocacao usa o valor BRUTO pago: taxa de cartao reduz o caixa, nao a
 * receita. Venda de 100 no credito continua 100 de faturamento.
 */
export async function registrarPagamento(input: {
  forma_pagamento: FormaPagamento;
  valor_bruto_pago: number;
  folio_id?: string | null;
  sale_id?: string | null;
  data_recebimento?: string | null;
  data_prevista_credito?: string | null;
  parcelas?: number;
  /** Deixe de fora em cartao: a regra vigente preenche sozinha. */
  taxa_cartao?: number;
  status?: StatusPagamento;
  nsu_ou_referencia?: string | null;
  observacoes?: string | null;
  alocar?: 'auto' | 'nenhuma' | Alocacao[];
}): Promise<{ pagamento: Payment; alocacoes: Alocacao[]; naoAlocado: number }> {
  if (!input.folio_id && !input.sale_id) {
    throw new ErroFinanceiro('Pagamento precisa estar ligado a uma conta ou a uma venda');
  }

  const { data: pagamento, error } = await supabase
    .from('payments')
    .insert({
      folio_id: input.folio_id ?? null,
      sale_id: input.sale_id ?? null,
      forma_pagamento: input.forma_pagamento,
      valor_bruto_pago: input.valor_bruto_pago,
      parcelas: input.parcelas ?? 1,
      taxa_cartao: input.taxa_cartao ?? 0,
      data_recebimento: input.data_recebimento ?? hojeISO(),
      data_prevista_credito: input.data_prevista_credito ?? null,
      status: input.status ?? 'recebido',
      nsu_ou_referencia: input.nsu_ou_referencia ?? null,
      observacoes: input.observacoes ?? null,
      valor_liquido_creditado: null,
    })
    .select()
    .single();
  if (error) throw new ErroFinanceiro('Falha ao registrar pagamento', error.message);

  const modo = input.alocar ?? 'auto';
  if (modo === 'nenhuma') {
    return { pagamento, alocacoes: [], naoAlocado: num(pagamento.valor_bruto_pago) };
  }

  if (Array.isArray(modo)) {
    await alocarPagamento(pagamento.id, modo);
    const somado = modo.reduce((t, a) => t + a.valor_alocado, 0);
    return {
      pagamento,
      alocacoes: modo,
      naoAlocado: round2(num(pagamento.valor_bruto_pago) - somado),
    };
  }

  const abertos = await itensEmAberto({
    folio_id: input.folio_id ?? undefined,
    sale_id: input.folio_id ? undefined : input.sale_id ?? undefined,
  });
  const { alocacoes, naoAlocado } = sugerirAlocacao(abertos, num(pagamento.valor_bruto_pago));
  await alocarPagamento(pagamento.id, alocacoes);

  return { pagamento, alocacoes, naoAlocado };
}

/** Marca o que caiu de fato na conta. Divergencia fica visivel em v_recebimentos. */
export async function conciliarPagamento(
  paymentId: string,
  input: { valor_liquido_creditado: number; data_recebimento?: string }
): Promise<Payment> {
  const { data, error } = await supabase
    .from('payments')
    .update({
      valor_liquido_creditado: input.valor_liquido_creditado,
      data_recebimento: input.data_recebimento ?? hojeISO(),
      status: 'conciliado',
    })
    .eq('id', paymentId)
    .select()
    .single();
  if (error) throw new ErroFinanceiro('Falha ao conciliar pagamento', error.message);
  return data;
}

export async function estornarPagamento(paymentId: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('estornar_pagamento', {
    p_id: paymentId,
    p_motivo: motivo,
  });
  if (error) throw new ErroFinanceiro('Falha ao estornar pagamento', error.message);
}

// ─────────────────────────────────────────────────────────────
// Custos de unidade
// ─────────────────────────────────────────────────────────────

export async function registrarCusto(input: {
  business_unit_id: string;
  data_competencia: string;
  categoria: CategoriaCusto;
  descricao: string;
  valor: number;
  recorrente?: boolean;
  fornecedor?: string | null;
  observacoes?: string | null;
}): Promise<UnitExpense> {
  const { data, error } = await supabase
    .from('unit_expenses')
    .insert({
      business_unit_id: input.business_unit_id,
      data_competencia: input.data_competencia,
      categoria: input.categoria,
      descricao: input.descricao,
      valor: input.valor,
      recorrente: input.recorrente ?? false,
      fornecedor: input.fornecedor ?? null,
      observacoes: input.observacoes ?? null,
      status: 'ativo',
    })
    .select()
    .single();
  if (error) throw new ErroFinanceiro('Falha ao registrar custo', error.message);
  return data;
}

export async function cancelarCusto(id: string, motivo: string): Promise<void> {
  const { error } = await supabase.rpc('cancelar_custo', { p_id: id, p_motivo: motivo });
  if (error) throw new ErroFinanceiro('Falha ao cancelar custo', error.message);
}

// ─────────────────────────────────────────────────────────────
// Consultas
// ─────────────────────────────────────────────────────────────

export type LinhaAgrupada = { chave: string; nome: string; valor: number; cor?: string };

function agrupar(
  itens: FaturamentoItem[],
  chaveDe: (i: FaturamentoItem) => string,
  nomeDe: (i: FaturamentoItem) => string,
  corDe?: (i: FaturamentoItem) => string
): LinhaAgrupada[] {
  const mapa = new Map<string, LinhaAgrupada>();
  for (const item of itens) {
    const chave = chaveDe(item);
    const atual = mapa.get(chave);
    const valor = num(item.valor_liquido_item);
    if (atual) {
      atual.valor = round2(atual.valor + valor);
    } else {
      mapa.set(chave, { chave, nome: nomeDe(item), valor: round2(valor), cor: corDe?.(item) });
    }
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export async function faturamentoDoPeriodo(
  inicio: string,
  fim: string
): Promise<FaturamentoItem[]> {
  const { data, error } = await supabase
    .from('v_faturamento_item')
    .select('*')
    .gte('data_venda', inicio)
    .lte('data_venda', fim);
  if (error) throw new ErroFinanceiro('Falha ao consultar faturamento', error.message);
  return data ?? [];
}

export async function faturamentoPorUnidade(
  inicio: string,
  fim: string
): Promise<LinhaAgrupada[]> {
  const itens = await faturamentoDoPeriodo(inicio, fim);
  return agrupar(itens, (i) => i.unidade_slug, (i) => i.unidade, (i) => i.unidade_cor);
}

export async function faturamentoPorCentro(
  inicio: string,
  fim: string
): Promise<LinhaAgrupada[]> {
  const itens = await faturamentoDoPeriodo(inicio, fim);
  return agrupar(itens, (i) => i.centro_slug, (i) => i.centro);
}

export type ContaDoFolio = {
  hospedagem: number;
  consumo_adicional: number;
  total: number;
  pago: number;
  saldo: number;
  porUnidade: LinhaAgrupada[];
  porCentro: LinhaAgrupada[];
};

/**
 * A conta do hospede soma hospedagem e consumo, mas cada valor continua
 * registrado no seu centro de receita de origem.
 */
export async function contaDoFolio(folioId: string): Promise<ContaDoFolio> {
  const { data: itens, error } = await supabase
    .from('v_faturamento_item')
    .select('*')
    .eq('folio_id', folioId);
  if (error) throw new ErroFinanceiro('Falha ao montar a conta', error.message);

  const linhas = itens ?? [];
  const hospedagem = round2(
    linhas
      .filter((i) => i.unidade_slug === 'hospedagem')
      .reduce((t, i) => t + num(i.valor_liquido_item), 0)
  );
  const consumo = round2(
    linhas
      .filter((i) => i.unidade_slug !== 'hospedagem')
      .reduce((t, i) => t + num(i.valor_liquido_item), 0)
  );

  const { data: saldo, error: erroSaldo } = await supabase
    .from('v_saldo_folio')
    .select('*')
    .eq('folio_id', folioId)
    .maybeSingle();
  if (erroSaldo) throw new ErroFinanceiro('Falha ao calcular saldo da conta', erroSaldo.message);

  return {
    hospedagem,
    consumo_adicional: consumo,
    total: round2(hospedagem + consumo),
    pago: num(saldo?.pago),
    saldo: num(saldo?.saldo),
    porUnidade: agrupar(linhas, (i) => i.unidade_slug, (i) => i.unidade, (i) => i.unidade_cor),
    porCentro: agrupar(linhas, (i) => i.centro_slug, (i) => i.centro),
  };
}

export async function resultadoPorUnidade(
  inicio: string,
  fim: string
): Promise<ResultadoUnidade[]> {
  const { data, error } = await supabase.rpc('fn_resultado_unidade', {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new ErroFinanceiro('Falha ao calcular resultado por unidade', error.message);
  return data ?? [];
}

export async function ticketMedioConsumo(
  inicio: string,
  fim: string
): Promise<TicketMedioConsumo | null> {
  const { data, error } = await supabase.rpc('fn_ticket_medio_consumo', {
    p_inicio: inicio,
    p_fim: fim,
  });
  if (error) throw new ErroFinanceiro('Falha ao calcular ticket médio', error.message);
  return data?.[0] ?? null;
}

export async function comissaoDaReserva(reservaId: string): Promise<BookingCommission | null> {
  const { data, error } = await supabase
    .from('booking_commissions')
    .select('*')
    .eq('reserva_id', reservaId)
    .maybeSingle();
  if (error) throw new ErroFinanceiro('Falha ao consultar comissão', error.message);
  return data;
}

export async function recebimentosDoPeriodo(
  inicio: string,
  fim: string
): Promise<Recebimento[]> {
  const { data, error } = await supabase
    .from('v_recebimentos')
    .select('*')
    .gte('data_recebimento', inicio)
    .lte('data_recebimento', fim);
  if (error) throw new ErroFinanceiro('Falha ao consultar recebimentos', error.message);
  return data ?? [];
}

export async function recebimentosPorForma(
  inicio: string,
  fim: string
): Promise<LinhaAgrupada[]> {
  const recebimentos = await recebimentosDoPeriodo(inicio, fim);
  const mapa = new Map<string, LinhaAgrupada>();
  for (const r of recebimentos) {
    const atual = mapa.get(r.forma_pagamento);
    const valor = num(r.valor_caixa);
    if (atual) atual.valor = round2(atual.valor + valor);
    else mapa.set(r.forma_pagamento, { chave: r.forma_pagamento, nome: r.forma_pagamento, valor: round2(valor) });
  }
  return [...mapa.values()].sort((a, b) => b.valor - a.valor);
}

export async function aReceber(): Promise<AReceber[]> {
  const { data, error } = await supabase
    .from('v_a_receber')
    .select('*')
    .order('data_prevista_credito', { ascending: true });
  if (error) throw new ErroFinanceiro('Falha ao consultar valores a receber', error.message);
  return data ?? [];
}

export type Regime = 'competencia' | 'caixa';

export async function caixaDoPeriodo(inicio: string, fim: string): Promise<CaixaPorItem[]> {
  const { data, error } = await supabase
    .from('v_caixa_por_item')
    .select('*')
    .gte('data_recebimento', inicio)
    .lte('data_recebimento', fim);
  if (error) throw new ErroFinanceiro('Falha ao consultar o caixa', error.message);
  return data ?? [];
}

export type ResumoFinanceiro = {
  faturamento: number;
  recebido: number;
  aReceber: number;
  atrasado: number;
  consumoAdicional: number;
  porUnidade: LinhaAgrupada[];
  centrosPorUnidade: Record<string, LinhaAgrupada[]>;
};

/**
 * Faturamento e recebimento sao numeros DIFERENTES e continuam separados aqui.
 * O regime so decide qual base alimenta a abertura por unidade e o consumo
 * adicional: competencia olha a data da venda, caixa olha a data do dinheiro.
 */
export async function resumoFinanceiro(
  inicio: string,
  fim: string,
  regime: Regime = 'competencia'
): Promise<ResumoFinanceiro> {
  const [itens, recebimentos, pendentes, caixa] = await Promise.all([
    faturamentoDoPeriodo(inicio, fim),
    recebimentosDoPeriodo(inicio, fim),
    aReceber(),
    regime === 'caixa' ? caixaDoPeriodo(inicio, fim) : Promise.resolve([] as CaixaPorItem[]),
  ]);

  const faturamento = round2(itens.reduce((t, i) => t + num(i.valor_liquido_item), 0));
  const recebido = round2(recebimentos.reduce((t, r) => t + num(r.valor_caixa), 0));
  const aReceberTotal = round2(pendentes.reduce((t, p) => t + num(p.valor_liquido_previsto), 0));
  const atrasado = round2(
    pendentes.filter((p) => p.atrasado).reduce((t, p) => t + num(p.valor_liquido_previsto), 0)
  );

  type Linha = {
    unidade: string;
    unidade_slug: string;
    unidade_cor: string;
    centro: string;
    centro_slug: string;
    folio_id: string | null;
    valor: number;
  };

  const base: Linha[] =
    regime === 'caixa'
      ? caixa.map((c) => ({
          unidade: c.unidade,
          unidade_slug: c.unidade_slug,
          unidade_cor: c.unidade_cor,
          centro: c.centro,
          centro_slug: c.centro_slug,
          folio_id: c.folio_id,
          valor: num(c.valor_alocado),
        }))
      : itens.map((i) => ({
          unidade: i.unidade,
          unidade_slug: i.unidade_slug,
          unidade_cor: i.unidade_cor,
          centro: i.centro,
          centro_slug: i.centro_slug,
          folio_id: i.folio_id,
          valor: num(i.valor_liquido_item),
        }));

  // Consumo adicional: o que o hospede gastou fora da hospedagem, na conta dele.
  const consumoAdicional = round2(
    base
      .filter((l) => l.folio_id !== null && l.unidade_slug !== 'hospedagem')
      .reduce((t, l) => t + l.valor, 0)
  );

  const porUnidade = new Map<string, LinhaAgrupada>();
  const centrosPorUnidade: Record<string, Map<string, LinhaAgrupada>> = {};

  for (const l of base) {
    const unidade = porUnidade.get(l.unidade_slug);
    if (unidade) unidade.valor = round2(unidade.valor + l.valor);
    else
      porUnidade.set(l.unidade_slug, {
        chave: l.unidade_slug,
        nome: l.unidade,
        valor: round2(l.valor),
        cor: l.unidade_cor,
      });

    centrosPorUnidade[l.unidade_slug] ??= new Map();
    const centro = centrosPorUnidade[l.unidade_slug].get(l.centro_slug);
    if (centro) centro.valor = round2(centro.valor + l.valor);
    else
      centrosPorUnidade[l.unidade_slug].set(l.centro_slug, {
        chave: l.centro_slug,
        nome: l.centro,
        valor: round2(l.valor),
      });
  }

  return {
    faturamento,
    recebido,
    aReceber: aReceberTotal,
    atrasado,
    consumoAdicional,
    porUnidade: [...porUnidade.values()].sort((a, b) => b.valor - a.valor),
    centrosPorUnidade: Object.fromEntries(
      Object.entries(centrosPorUnidade).map(([slug, mapa]) => [
        slug,
        [...mapa.values()].sort((a, b) => b.valor - a.valor),
      ])
    ),
  };
}

/** O que o Booking ainda deve repassar. */
export async function repassesBooking(): Promise<BookingCommission[]> {
  const { data, error } = await supabase
    .from('booking_commissions')
    .select('*')
    .eq('status', 'previsto')
    .gt('valor_bruto_hospedagem', 0)
    .order('data_prevista_repasse', { ascending: true });
  if (error) throw new ErroFinanceiro('Falha ao consultar repasses do Booking', error.message);
  return data ?? [];
}

export type HospedeNaCasa = {
  reserva_id: string;
  folio_id: string | null;
  hospede_id: string;
  nome: string;
  chale: string | null;
  check_out: string;
};

/** Quem esta hospedado na data. Alimenta a busca do lancamento rapido. */
export async function hospedesNaCasa(data: string = hojeISO()): Promise<HospedeNaCasa[]> {
  const { data: reservas, error } = await supabase
    .from('reservas')
    .select('id, hospede_id, chale_id, check_out')
    .lte('check_in', data)
    .gte('check_out', data)
    .in('status', ['confirmada', 'hospedado']);
  if (error) throw new ErroFinanceiro('Falha ao buscar hóspedes na casa', error.message);

  const linhas = reservas ?? [];
  if (linhas.length === 0) return [];

  const [hospedes, chales, folios] = await Promise.all([
    supabase.from('hospedes').select('id, nome').in('id', linhas.map((r) => r.hospede_id)),
    supabase
      .from('chales')
      .select('id, nome')
      .in('id', linhas.map((r) => r.chale_id).filter((id): id is string => !!id)),
    supabase.from('folios').select('id, reserva_id').in('reserva_id', linhas.map((r) => r.id)),
  ]);

  const nomePorHospede = new Map((hospedes.data ?? []).map((h) => [h.id, h.nome]));
  const nomePorChale = new Map((chales.data ?? []).map((c) => [c.id, c.nome]));
  const folioPorReserva = new Map(
    (folios.data ?? []).map((f) => [f.reserva_id as string, f.id as string])
  );

  return linhas
    .map((r) => ({
      reserva_id: r.id,
      folio_id: folioPorReserva.get(r.id) ?? null,
      hospede_id: r.hospede_id,
      nome: nomePorHospede.get(r.hospede_id) ?? 'Hóspede',
      chale: r.chale_id ? nomePorChale.get(r.chale_id) ?? null : null,
      check_out: r.check_out,
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export type ContaAberta = {
  folio_id: string;
  reserva_id: string | null;
  hospede_id: string | null;
  hospede: string;
  chale: string | null;
  origem: Origem | null;
  check_in: string | null;
  check_out: string | null;
  total: number;
  pago: number;
  saldo: number;
};

/** Contas em aberto, com o que já foi lançado e o que falta receber. */
export async function contasAbertas(): Promise<ContaAberta[]> {
  const { data: folios, error } = await supabase
    .from('folios')
    .select('id, reserva_id, hospede_id, chale_id, aberta_em')
    .eq('status', 'aberta')
    .order('aberta_em', { ascending: false });
  if (error) throw new ErroFinanceiro('Falha ao listar contas abertas', error.message);

  const linhas = folios ?? [];
  if (linhas.length === 0) return [];

  const idsReserva = linhas.map((f) => f.reserva_id).filter((id): id is string => !!id);
  const idsHospede = linhas.map((f) => f.hospede_id).filter((id): id is string => !!id);

  const [reservas, hospedes, saldos] = await Promise.all([
    idsReserva.length
      ? supabase.from('reservas').select('id, origem, check_in, check_out, chale_id').in('id', idsReserva)
      : Promise.resolve({ data: [] as never[] }),
    idsHospede.length
      ? supabase.from('hospedes').select('id, nome').in('id', idsHospede)
      : Promise.resolve({ data: [] as never[] }),
    supabase.from('v_saldo_folio').select('*').in('folio_id', linhas.map((f) => f.id)),
  ]);

  const porReserva = new Map((reservas.data ?? []).map((r) => [r.id, r]));
  const nomeHospede = new Map((hospedes.data ?? []).map((h) => [h.id, h.nome]));
  const porFolio = new Map((saldos.data ?? []).map((s) => [s.folio_id, s]));

  const idsChale = [
    ...new Set(
      linhas
        .map((f) => f.chale_id ?? porReserva.get(f.reserva_id ?? '')?.chale_id)
        .filter((id): id is string => !!id)
    ),
  ];
  const chales = idsChale.length
    ? await supabase.from('chales').select('id, nome').in('id', idsChale)
    : { data: [] as never[] };
  const nomeChale = new Map((chales.data ?? []).map((c) => [c.id, c.nome]));

  return linhas.map((f) => {
    const reserva = f.reserva_id ? porReserva.get(f.reserva_id) : undefined;
    const saldo = porFolio.get(f.id);
    const chaleId = f.chale_id ?? reserva?.chale_id ?? null;
    return {
      folio_id: f.id,
      reserva_id: f.reserva_id,
      hospede_id: f.hospede_id,
      hospede: f.hospede_id ? nomeHospede.get(f.hospede_id) ?? 'Hóspede' : 'Conta avulsa',
      chale: chaleId ? nomeChale.get(chaleId) ?? null : null,
      origem: (reserva?.origem as Origem | undefined) ?? null,
      check_in: reserva?.check_in ?? null,
      check_out: reserva?.check_out ?? null,
      total: num(saldo?.total_conta),
      pago: num(saldo?.pago),
      saldo: num(saldo?.saldo),
    };
  });
}

/** Booking tem centro proprio: e o que faz a comissao ser calculada. */
function slugDaHospedagem(origem: Origem): string {
  return origem === 'booking' ? 'hospedagem_booking' : 'hospedagem_direta';
}

/**
 * Lanca a diaria como item de hospedagem na conta. E este lancamento que
 * transforma a reserva em faturamento e dispara a comissao do Booking.
 */
export async function lancarHospedagem(input: {
  folio_id: string;
  origem: Origem;
  valor_total: number;
  diarias?: number;
  data_venda?: string;
  descricao?: string;
  custo_unitario?: number | null;
}): Promise<{ venda: Sale; itens: SaleItem[] }> {
  const centro = await centroPorSlug(slugDaHospedagem(input.origem));
  const diarias = input.diarias ?? 1;

  return criarVenda({
    folio_id: input.folio_id,
    data_venda: input.data_venda ?? hojeISO(),
    descricao: 'Hospedagem',
    itens: [
      {
        revenue_center_id: centro.id,
        descricao: input.descricao ?? (diarias > 1 ? `${diarias} diárias` : 'Diária'),
        valor_unitario: input.valor_total,
        custo_unitario: input.custo_unitario ?? null,
      },
    ],
  });
}

/** Hospede, reserva e conta num passo so, opcionalmente ja com a diaria. */
export async function criarReservaComConta(input: {
  nome: string;
  origem: Origem;
  check_in: string;
  check_out: string;
  telefone?: string | null;
  email?: string | null;
  chale_id?: string | null;
  codigo_externo?: string | null;
  adultos?: number;
  criancas?: number;
  observacoes?: string | null;
  valor_hospedagem?: number | null;
}): Promise<{ reserva: Reserva; folio: Folio }> {
  const hospede = await criarHospede({
    nome: input.nome,
    telefone: input.telefone ?? null,
    email: input.email ?? null,
  });

  const reserva = await criarReserva({
    hospede_id: hospede.id,
    origem: input.origem,
    check_in: input.check_in,
    check_out: input.check_out,
    chale_id: input.chale_id ?? null,
    codigo_externo: input.codigo_externo ?? null,
    adultos: input.adultos ?? 2,
    criancas: input.criancas ?? 0,
    observacoes: input.observacoes ?? null,
    status: 'confirmada',
  });

  const folio = await abrirFolio({
    reserva_id: reserva.id,
    hospede_id: hospede.id,
    chale_id: input.chale_id ?? null,
  });

  if (input.valor_hospedagem && input.valor_hospedagem > 0) {
    await lancarHospedagem({
      folio_id: folio.id,
      origem: input.origem,
      valor_total: input.valor_hospedagem,
      data_venda: input.check_in,
    });
  }

  return { reserva, folio };
}

/** Uma conta por reserva: reaproveita a aberta ou abre na hora. */
export async function garantirFolio(reserva: {
  id: string;
  hospede_id: string;
  chale_id?: string | null;
}): Promise<Folio> {
  const { data, error } = await supabase
    .from('folios')
    .select('*')
    .eq('reserva_id', reserva.id)
    .maybeSingle();
  if (error) throw new ErroFinanceiro('Falha ao buscar a conta da reserva', error.message);
  if (data) return data;

  return abrirFolio({
    reserva_id: reserva.id,
    hospede_id: reserva.hospede_id,
    chale_id: reserva.chale_id ?? null,
  });
}

export async function criarProduto(input: {
  revenue_center_id: string;
  nome: string;
  preco_padrao: number;
  custo_padrao?: number | null;
  codigo?: string | null;
}): Promise<ProductCatalog> {
  const { data, error } = await supabase
    .from('product_catalog')
    .insert({
      revenue_center_id: input.revenue_center_id,
      nome: input.nome,
      preco_padrao: input.preco_padrao,
      custo_padrao: input.custo_padrao ?? null,
      codigo: input.codigo ?? null,
      ativo: true,
    })
    .select()
    .single();
  if (error) throw new ErroFinanceiro('Falha ao criar produto', error.message);
  return data;
}

export async function atualizarProduto(
  id: string,
  mudancas: Partial<Omit<ProductCatalog, 'id'>>
): Promise<ProductCatalog> {
  const { data, error } = await supabase
    .from('product_catalog')
    .update(mudancas)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new ErroFinanceiro('Falha ao atualizar produto', error.message);
  return data;
}

export async function historico(tabela: string, registroId: string) {
  const { data, error } = await supabase
    .from('audit_log')
    .select('*')
    .eq('tabela', tabela)
    .eq('registro_id', registroId)
    .order('criado_em', { ascending: true });
  if (error) throw new ErroFinanceiro('Falha ao consultar histórico', error.message);
  return data ?? [];
}

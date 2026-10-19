// Tipos do schema financeiro da Villa Bichinho.
// Para regerar a partir do banco:
//   npx supabase gen types typescript --project-id nhtbcoxsqjzlxyjdynpx > src/types/database.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Origem = 'direta' | 'booking' | 'walk_in';
export type FormaPagamento = 'pix' | 'credito' | 'debito' | 'dinheiro' | 'repasse_booking' | 'outro';
export type StatusPagamento = 'previsto' | 'recebido' | 'conciliado' | 'cancelado';
export type StatusVenda = 'aberta' | 'fechada' | 'cancelada';
export type StatusItem = 'ativo' | 'cancelado';
export type StatusFolio = 'aberta' | 'fechada' | 'cancelada';
export type StatusReserva = 'pendente' | 'confirmada' | 'hospedado' | 'finalizada' | 'cancelada';
export type CategoriaCusto =
  | 'insumo' | 'gas' | 'lenha' | 'mao_de_obra' | 'manutencao' | 'energia' | 'outro';
export type CoberturaStatus = 'sem_faturamento' | 'completa' | 'parcial' | 'insuficiente';
export type AcaoAuditoria = 'criacao' | 'edicao' | 'cancelamento' | 'estorno';

type Tabela<Row, Insert, Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type Visao<Row> = { Row: Row; Relationships: [] };

export type BusinessUnit = {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  controla_custo: boolean;
  ordem_exibicao: number;
  cor: string;
};

export type RevenueCenter = {
  id: string;
  business_unit_id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  ordem_exibicao: number;
};

export type Chale = {
  id: string;
  nome: string;
  categoria: string | null;
  capacidade: number | null;
  ativo: boolean;
  ordem_exibicao: number;
};

export type Hospede = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  documento: string | null;
  observacoes: string | null;
  criado_em: string;
};

export type Reserva = {
  id: string;
  hospede_id: string;
  chale_id: string | null;
  lead_id: string | null;
  origem: Origem;
  codigo_externo: string | null;
  check_in: string;
  check_out: string;
  adultos: number;
  criancas: number;
  status: StatusReserva;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
};

export type Folio = {
  id: string;
  reserva_id: string | null;
  hospede_id: string | null;
  chale_id: string | null;
  status: StatusFolio;
  aberta_em: string;
  fechada_em: string | null;
  observacoes: string | null;
};

export type Sale = {
  id: string;
  folio_id: string | null;
  data_venda: string;
  origem_reserva: Origem | null;
  descricao: string | null;
  status: StatusVenda;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  revenue_center_id: string;
  product_id: string | null;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  desconto: number;
  valor_bruto: number;
  valor_liquido_item: number;
  custo_unitario: number | null;
  custo_total: number | null;
  status: StatusItem;
  criado_em: string;
};

export type ProductCatalog = {
  id: string;
  revenue_center_id: string;
  nome: string;
  codigo: string | null;
  preco_padrao: number;
  custo_padrao: number | null;
  ativo: boolean;
};

export type UnitExpense = {
  id: string;
  business_unit_id: string;
  data_competencia: string;
  categoria: CategoriaCusto;
  descricao: string;
  valor: number;
  recorrente: boolean;
  fornecedor: string | null;
  observacoes: string | null;
  status: StatusItem;
  criado_por: string | null;
  criado_em: string;
};

export type Payment = {
  id: string;
  folio_id: string | null;
  sale_id: string | null;
  data_recebimento: string | null;
  data_prevista_credito: string | null;
  forma_pagamento: FormaPagamento;
  parcelas: number;
  valor_bruto_pago: number;
  taxa_cartao: number;
  valor_liquido_previsto: number;
  valor_liquido_creditado: number | null;
  status: StatusPagamento;
  nsu_ou_referencia: string | null;
  observacoes: string | null;
  criado_por: string | null;
  criado_em: string;
};

export type PaymentAllocation = {
  id: string;
  payment_id: string;
  sale_item_id: string;
  valor_alocado: number;
};

export type BookingCommission = {
  id: string;
  reserva_id: string;
  valor_bruto_hospedagem: number;
  percentual_comissao: number;
  valor_comissao: number;
  valor_liquido_repasse: number;
  modo_pagamento: 'online_booking' | 'pagar_na_propriedade';
  data_prevista_repasse: string | null;
  data_repasse_efetivo: string | null;
  status: 'previsto' | 'repassado' | 'conciliado' | 'cancelado';
};

export type AuditLog = {
  id: number;
  tabela: string;
  registro_id: string;
  acao: AcaoAuditoria;
  valores_antes: Json | null;
  valores_depois: Json | null;
  usuario: string | null;
  usuario_nome: string | null;
  motivo: string | null;
  criado_em: string;
};

export type FaturamentoItem = {
  sale_item_id: string;
  sale_id: string;
  data_venda: string;
  folio_id: string | null;
  reserva_id: string | null;
  origem_reserva: Origem | null;
  revenue_center_id: string;
  centro: string;
  centro_slug: string;
  business_unit_id: string;
  unidade: string;
  unidade_slug: string;
  unidade_cor: string;
  controla_custo: boolean;
  descricao: string;
  quantidade: number;
  valor_bruto: number;
  desconto: number;
  valor_liquido_item: number;
  custo_unitario: number | null;
  custo_total: number | null;
};

export type Recebimento = {
  payment_id: string;
  data_recebimento: string | null;
  data_prevista_credito: string | null;
  forma_pagamento: FormaPagamento;
  status: StatusPagamento;
  valor_bruto_pago: number;
  taxa_cartao: number;
  valor_liquido_previsto: number;
  valor_liquido_creditado: number | null;
  valor_caixa: number;
  divergente: boolean;
  folio_id: string | null;
  sale_id: string | null;
};

export type AReceber = {
  payment_id: string;
  folio_id: string | null;
  forma_pagamento: FormaPagamento;
  data_prevista_credito: string | null;
  valor_liquido_previsto: number;
  atrasado: boolean;
};

/** Caixa aberto por unidade: o dinheiro que entrou, pela origem do item. */
export type CaixaPorItem = {
  payment_id: string;
  data_recebimento: string | null;
  forma_pagamento: FormaPagamento;
  valor_alocado: number;
  sale_item_id: string;
  revenue_center_id: string;
  centro: string;
  centro_slug: string;
  business_unit_id: string;
  unidade: string;
  unidade_slug: string;
  unidade_cor: string;
  folio_id: string | null;
};

export type SaldoItem = {
  sale_item_id: string;
  sale_id: string;
  valor_liquido_item: number;
  alocado: number;
  saldo: number;
};

export type SaldoFolio = {
  folio_id: string;
  total_conta: number;
  pago: number;
  saldo: number;
};

export type ConsumoAdicionalReserva = {
  reserva_id: string | null;
  folio_id: string;
  hospedagem: number | null;
  consumo_adicional: number | null;
  total_conta: number;
};

export type ResultadoUnidade = {
  unidade: string;
  unidade_slug: string;
  controla_custo: boolean;
  receita_liquida: number;
  cmv: number | null;
  custos_unidade: number;
  cobertura_custo: number;
  cobertura_status: CoberturaStatus;
  /** NULL quando a cobertura de custo fica abaixo do minimo configurado. */
  margem: number | null;
};

export type TicketMedioConsumo = {
  consumo_total: number;
  reservas_com_consumo: number;
  reservas_no_periodo: number;
  ticket_por_reserva_com_consumo: number | null;
  ticket_por_reserva_total: number | null;
};

// ─────────────────────────────────────────────────────────────
// CRM de leads (migrado do localStorage)
// ─────────────────────────────────────────────────────────────

export type LeadEtapa =
  | 'novo_contato'
  | 'orcamento_enviado'
  | 'negociacao'
  | 'pendente_followup'
  | 'confirmado'
  | 'declinado';

export type LeadRow = {
  id: string;
  /** Id do lead no localStorage. UNIQUE: e o que torna a importacao idempotente. */
  legacy_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  etapa: LeadEtapa;
  check_in: string | null;
  check_out: string | null;
  hospedes: number | null;
  acomodacao: string | null;
  ocasiao: string | null;
  /** numeric(12,2): o postgrest devolve string. */
  orcamento: number | string | null;
  procurando: string | null;
  servicos: string[];
  atendente: string | null;
  ultima_mensagem: string | null;
  ultima_interacao: string | null;
  observacoes: string | null;
  motivo_recusa: string | null;
  motivo_recusa_outro: string | null;
  data_recusa: string | null;
  observacoes_recusa: string | null;
  followup_data: string | null;
  followup_tipo: string | null;
  followup_feito: boolean;
  arquivado: boolean;
  criado_em: string;
};

export type LeadHistoryRow = {
  id: string;
  lead_id: string;
  data: string;
  acao: string;
  atendente: string | null;
  nota: string | null;
};

/**
 * Insercao: tudo opcional (o banco tem default para quase tudo), menos as
 * colunas realmente obrigatorias, e sem as colunas geradas, que o Postgres
 * recusa receber.
 */
type Insercao<Row, Obrigatorios extends keyof Row, Gerados extends keyof Row = never> =
  Partial<Omit<Row, Gerados>> & Pick<Row, Obrigatorios>;

type CardFeeRule = {
  id: string;
  tipo: string;
  parcelas_min: number;
  parcelas_max: number;
  percentual_taxa: number;
  prazo_credito_dias: number;
  vigencia_inicio: string;
  ativo: boolean;
};

type AppSetting = { chave: string; valor: Json; descricao: string | null; atualizado_em: string };
type AppUser = { id: string; nome: string; papel: string; ativo: boolean; criado_em: string };

export type Database = {
  public: {
    Tables: {
      app_settings: Tabela<AppSetting, Insercao<AppSetting, 'chave' | 'valor'>>;
      app_users: Tabela<AppUser, Insercao<AppUser, 'id' | 'nome'>>;
      audit_log: Tabela<AuditLog, never, never>;
      booking_commissions: Tabela<
        BookingCommission,
        Insercao<
          BookingCommission,
          'reserva_id' | 'percentual_comissao',
          'valor_comissao' | 'valor_liquido_repasse'
        >
      >;
      business_units: Tabela<BusinessUnit, Insercao<BusinessUnit, 'nome' | 'slug'>>;
      card_fee_rules: Tabela<
        CardFeeRule,
        Insercao<CardFeeRule, 'tipo' | 'percentual_taxa' | 'prazo_credito_dias'>
      >;
      chales: Tabela<Chale, Insercao<Chale, 'nome'>>;
      folios: Tabela<Folio, Insercao<Folio, never>>;
      hospedes: Tabela<Hospede, Insercao<Hospede, 'nome'>>;
      payment_allocations: Tabela<
        PaymentAllocation,
        Insercao<PaymentAllocation, 'payment_id' | 'sale_item_id' | 'valor_alocado'>
      >;
      payments: Tabela<
        Payment,
        Insercao<Payment, 'forma_pagamento' | 'valor_bruto_pago', 'valor_liquido_previsto'>
      >;
      product_catalog: Tabela<
        ProductCatalog,
        Insercao<ProductCatalog, 'revenue_center_id' | 'nome' | 'preco_padrao'>
      >;
      reservas: Tabela<
        Reserva,
        Insercao<Reserva, 'hospede_id' | 'origem' | 'check_in' | 'check_out'>
      >;
      revenue_centers: Tabela<
        RevenueCenter,
        Insercao<RevenueCenter, 'business_unit_id' | 'nome' | 'slug'>
      >;
      sale_items: Tabela<
        SaleItem,
        Insercao<
          SaleItem,
          'sale_id' | 'revenue_center_id' | 'descricao' | 'valor_unitario',
          'valor_bruto' | 'valor_liquido_item' | 'custo_total'
        >
      >;
      sales: Tabela<Sale, Insercao<Sale, never>>;
      unit_expenses: Tabela<
        UnitExpense,
        Insercao<
          UnitExpense,
          'business_unit_id' | 'data_competencia' | 'categoria' | 'descricao' | 'valor'
        >
      >;
      leads: Tabela<LeadRow, Insercao<LeadRow, 'nome'>>;
      lead_history: Tabela<LeadHistoryRow, Insercao<LeadHistoryRow, 'lead_id' | 'acao'>>;
    };
    Views: {
      v_faturamento_item: Visao<FaturamentoItem>;
      v_recebimentos: Visao<Recebimento>;
      v_a_receber: Visao<AReceber>;
      v_saldo_item: Visao<SaldoItem>;
      v_saldo_folio: Visao<SaldoFolio>;
      v_consumo_adicional_reserva: Visao<ConsumoAdicionalReserva>;
      v_caixa_por_item: Visao<CaixaPorItem>;
    };
    Functions: {
      cancelar_venda: { Args: { p_id: string; p_motivo: string }; Returns: undefined };
      cancelar_item: { Args: { p_id: string; p_motivo: string }; Returns: undefined };
      cancelar_custo: { Args: { p_id: string; p_motivo: string }; Returns: undefined };
      estornar_pagamento: { Args: { p_id: string; p_motivo: string }; Returns: undefined };
      fn_setting_numeric: { Args: { p_chave: string; p_default: number }; Returns: number };
      fn_resultado_unidade: {
        Args: { p_inicio: string; p_fim: string };
        Returns: ResultadoUnidade[];
      };
      fn_ticket_medio_consumo: {
        Args: { p_inicio: string; p_fim: string };
        Returns: TicketMedioConsumo[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

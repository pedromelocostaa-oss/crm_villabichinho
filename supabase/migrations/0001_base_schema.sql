-- Villa Bichinho - Modulo de receitas, custos e fluxo financeiro
-- 0001: tabelas base
-- Dinheiro sempre numeric(12,2). Status como text + CHECK, para evoluir sem ALTER TYPE.

create extension if not exists pgcrypto;

-- =============================================================
-- Usuarios da equipe (espelho de auth.users)
-- =============================================================
create table app_users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nome        text not null,
  papel       text not null default 'operacao' check (papel in ('admin','recepcao','operacao')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

create or replace function fn_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into app_users (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row execute function fn_handle_new_user();

-- =============================================================
-- Configuracao
-- =============================================================
create table app_settings (
  chave         text primary key,
  valor         jsonb not null,
  descricao     text,
  atualizado_em timestamptz not null default now()
);

create table card_fee_rules (
  id                 uuid primary key default gen_random_uuid(),
  tipo               text not null check (tipo in ('debito','credito_vista','credito_parcelado')),
  parcelas_min       int not null default 1,
  parcelas_max       int not null default 1,
  percentual_taxa    numeric(5,4) not null check (percentual_taxa >= 0 and percentual_taxa < 1),
  prazo_credito_dias int not null check (prazo_credito_dias >= 0),
  vigencia_inicio    date not null default current_date,
  ativo              boolean not null default true,
  check (parcelas_max >= parcelas_min)
);

-- =============================================================
-- Cadastro base
-- =============================================================
create table chales (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null unique,
  categoria      text,
  capacidade     int,
  ativo          boolean not null default true,
  ordem_exibicao int not null default 0
);

create table hospedes (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  telefone    text,
  email       text,
  documento   text,
  observacoes text,
  criado_em   timestamptz not null default now()
);

-- CRM de leads migrado do localStorage. legacy_id torna a importacao idempotente.
create table leads (
  id                  uuid primary key default gen_random_uuid(),
  legacy_id           text unique,
  nome                text not null,
  telefone            text,
  email               text,
  etapa               text not null default 'novo_contato' check (etapa in
                        ('novo_contato','orcamento_enviado','negociacao',
                         'pendente_followup','confirmado','declinado')),
  check_in            date,
  check_out           date,
  hospedes            int,
  acomodacao          text,
  ocasiao             text,
  orcamento           numeric(12,2),
  procurando          text,
  servicos            text[] not null default '{}',
  atendente           text,
  ultima_mensagem     text,
  ultima_interacao    timestamptz,
  observacoes         text,
  motivo_recusa       text,
  motivo_recusa_outro text,
  data_recusa         date,
  observacoes_recusa  text,
  followup_data       date,
  followup_tipo       text,
  followup_feito      boolean not null default false,
  criado_em           timestamptz not null default now()
);

create table lead_history (
  id        uuid primary key default gen_random_uuid(),
  lead_id   uuid not null references leads(id) on delete cascade,
  data      timestamptz not null default now(),
  acao      text not null,
  atendente text,
  nota      text
);

-- Reserva NAO guarda valor: o valor da hospedagem vive em sale_items, fonte unica.
create table reservas (
  id             uuid primary key default gen_random_uuid(),
  hospede_id     uuid not null references hospedes(id),
  chale_id       uuid references chales(id),
  lead_id        uuid references leads(id),
  origem         text not null check (origem in ('direta','booking','walk_in')),
  codigo_externo text,
  check_in       date not null,
  check_out      date not null,
  adultos        int not null default 2,
  criancas       int not null default 0,
  status         text not null default 'confirmada' check (status in
                   ('pendente','confirmada','hospedado','finalizada','cancelada')),
  observacoes    text,
  criado_por     uuid references auth.users(id) default auth.uid(),
  criado_em      timestamptz not null default now(),
  check (check_out > check_in)
);

-- =============================================================
-- Unidades de negocio e centros de receita
-- =============================================================
create table business_units (
  id             uuid primary key default gen_random_uuid(),
  nome           text not null,
  slug           text not null unique,
  ativo          boolean not null default true,
  controla_custo boolean not null default false,
  ordem_exibicao int not null default 0,
  cor            text not null default '#10b981'
);

create table revenue_centers (
  id               uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references business_units(id),
  nome             text not null,
  slug             text not null unique,
  ativo            boolean not null default true,
  ordem_exibicao   int not null default 0
);

-- =============================================================
-- Conta do hospede, vendas e itens
-- =============================================================
-- reserva_id UNIQUE garante 1 folio por reserva; NULL repetido e permitido
-- no Postgres, entao folio avulso (so jantar, day use) continua livre.
create table folios (
  id          uuid primary key default gen_random_uuid(),
  reserva_id  uuid unique references reservas(id),
  hospede_id  uuid references hospedes(id),
  chale_id    uuid references chales(id),
  status      text not null default 'aberta' check (status in ('aberta','fechada','cancelada')),
  aberta_em   timestamptz not null default now(),
  fechada_em  timestamptz,
  observacoes text
);

create table sales (
  id             uuid primary key default gen_random_uuid(),
  folio_id       uuid references folios(id),
  data_venda     date not null default current_date,
  origem_reserva text check (origem_reserva in ('direta','booking','walk_in')),
  descricao      text,
  status         text not null default 'fechada' check (status in ('aberta','fechada','cancelada')),
  observacoes    text,
  criado_por     uuid references auth.users(id) default auth.uid(),
  criado_em      timestamptz not null default now()
);

create table product_catalog (
  id                uuid primary key default gen_random_uuid(),
  revenue_center_id uuid not null references revenue_centers(id),
  nome              text not null,
  codigo            text,
  preco_padrao      numeric(12,2) not null check (preco_padrao >= 0),
  custo_padrao      numeric(12,2) check (custo_padrao >= 0),
  ativo             boolean not null default true
);

-- Granularidade no item: uma comanda da Caverna pode ter pizza (centro Pizzaria)
-- e vinho (centro Caverna gastronomica). custo_unitario e SEMPRE opcional e
-- custo_total permanece NULL quando nao ha custo - nunca vira zero.
create table sale_items (
  id                 uuid primary key default gen_random_uuid(),
  sale_id            uuid not null references sales(id),
  revenue_center_id  uuid not null references revenue_centers(id),
  product_id         uuid references product_catalog(id),
  descricao          text not null,
  quantidade         numeric(10,3) not null default 1 check (quantidade > 0),
  valor_unitario     numeric(12,2) not null check (valor_unitario >= 0),
  desconto           numeric(12,2) not null default 0 check (desconto >= 0),
  valor_bruto        numeric(12,2) generated always as
                       (round(quantidade * valor_unitario, 2)) stored,
  valor_liquido_item numeric(12,2) generated always as
                       (round(quantidade * valor_unitario, 2) - desconto) stored,
  custo_unitario     numeric(12,2) check (custo_unitario >= 0),
  custo_total        numeric(12,2) generated always as
                       (round(quantidade * custo_unitario, 2)) stored,
  status             text not null default 'ativo' check (status in ('ativo','cancelado')),
  criado_em          timestamptz not null default now(),
  check (desconto <= round(quantidade * valor_unitario, 2))
);

-- =============================================================
-- Custos de unidade (gas e lenha da caverna, quimicos da piscina, pizzaiolo)
-- =============================================================
create table unit_expenses (
  id               uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references business_units(id),
  data_competencia date not null,
  categoria        text not null check (categoria in
                     ('insumo','gas','lenha','mao_de_obra','manutencao','energia','outro')),
  descricao        text not null,
  valor            numeric(12,2) not null check (valor >= 0),
  recorrente       boolean not null default false,
  fornecedor       text,
  observacoes      text,
  status           text not null default 'ativo' check (status in ('ativo','cancelado')),
  criado_por       uuid references auth.users(id) default auth.uid(),
  criado_em        timestamptz not null default now()
);

-- =============================================================
-- Pagamentos e alocacoes
-- =============================================================
-- valor_liquido_previsto e calculado; valor_liquido_creditado so e preenchido
-- na conciliacao. A divergencia entre os dois e o que a regra 6 sinaliza.
create table payments (
  id                      uuid primary key default gen_random_uuid(),
  folio_id                uuid references folios(id),
  sale_id                 uuid references sales(id),
  data_recebimento        date,
  data_prevista_credito   date,
  forma_pagamento         text not null check (forma_pagamento in
                            ('pix','credito','debito','dinheiro','repasse_booking','outro')),
  parcelas                int not null default 1 check (parcelas >= 1),
  valor_bruto_pago        numeric(12,2) not null check (valor_bruto_pago > 0),
  taxa_cartao             numeric(12,2) not null default 0 check (taxa_cartao >= 0),
  valor_liquido_previsto  numeric(12,2) generated always as
                            (valor_bruto_pago - taxa_cartao) stored,
  valor_liquido_creditado numeric(12,2),
  status                  text not null default 'previsto' check (status in
                            ('previsto','recebido','conciliado','cancelado')),
  nsu_ou_referencia       text,
  observacoes             text,
  criado_por              uuid references auth.users(id) default auth.uid(),
  criado_em               timestamptz not null default now(),
  check (folio_id is not null or sale_id is not null),
  check (taxa_cartao <= valor_bruto_pago)
);

-- E esta tabela que impede a dupla contagem. O limite por item e garantido
-- pelo constraint trigger em 0002.
create table payment_allocations (
  id            uuid primary key default gen_random_uuid(),
  payment_id    uuid not null references payments(id),
  sale_item_id  uuid not null references sale_items(id),
  valor_alocado numeric(12,2) not null check (valor_alocado > 0),
  unique (payment_id, sale_item_id)
);

-- Comissao incide SO sobre hospedagem. O consumo adicional nunca entra na base.
create table booking_commissions (
  id                     uuid primary key default gen_random_uuid(),
  reserva_id             uuid not null unique references reservas(id),
  valor_bruto_hospedagem numeric(12,2) not null default 0,
  percentual_comissao    numeric(5,4) not null check (percentual_comissao >= 0 and percentual_comissao < 1),
  valor_comissao         numeric(12,2) generated always as
                           (round(valor_bruto_hospedagem * percentual_comissao, 2)) stored,
  valor_liquido_repasse  numeric(12,2) generated always as
                           (valor_bruto_hospedagem
                            - round(valor_bruto_hospedagem * percentual_comissao, 2)) stored,
  modo_pagamento         text not null default 'online_booking' check (modo_pagamento in
                           ('online_booking','pagar_na_propriedade')),
  data_prevista_repasse  date,
  data_repasse_efetivo   date,
  status                 text not null default 'previsto' check (status in
                           ('previsto','repassado','conciliado','cancelado'))
);

-- =============================================================
-- Auditoria
-- =============================================================
create table audit_log (
  id             bigserial primary key,
  tabela         text not null,
  registro_id    uuid not null,
  acao           text not null check (acao in ('criacao','edicao','cancelamento','estorno')),
  valores_antes  jsonb,
  valores_depois jsonb,
  usuario        uuid references auth.users(id) on delete set null,
  usuario_nome   text,
  motivo         text,
  criado_em      timestamptz not null default now()
);

-- =============================================================
-- Indices
-- =============================================================
create index idx_reservas_periodo  on reservas (check_in, check_out);
create index idx_reservas_origem   on reservas (origem);
create index idx_folios_hospede    on folios (hospede_id);
create index idx_sales_data        on sales (data_venda);
create index idx_sales_folio       on sales (folio_id);
create index idx_sale_items_sale   on sale_items (sale_id);
create index idx_sale_items_centro on sale_items (revenue_center_id);
create index idx_payments_recebim  on payments (data_recebimento);
create index idx_payments_folio    on payments (folio_id);
create index idx_payments_previsto on payments (status, data_prevista_credito);
create index idx_alloc_item        on payment_allocations (sale_item_id);
create index idx_alloc_payment     on payment_allocations (payment_id);
create index idx_expenses_unidade  on unit_expenses (business_unit_id, data_competencia);
create index idx_audit_registro    on audit_log (tabela, registro_id);
create index idx_audit_data        on audit_log (criado_em desc);
create index idx_catalog_centro    on product_catalog (revenue_center_id) where ativo;

-- Villa Bichinho - 0004: bases de relatorio
-- Faturamento (competencia) e recebimento (caixa) sao consultas DIFERENTES.
-- Nenhuma view mistura as duas. security_invoker mantem a RLS valendo.

create or replace function fn_setting_numeric(p_chave text, p_default numeric)
returns numeric language sql stable as $$
  select coalesce(
    (select (valor #>> '{}')::numeric from app_settings where chave = p_chave),
    p_default
  );
$$;

-- =============================================================
-- Faturamento por competencia (data da venda)
-- =============================================================
create view v_faturamento_item with (security_invoker = true) as
select
  si.id                as sale_item_id,
  s.id                 as sale_id,
  s.data_venda,
  s.folio_id,
  f.reserva_id,
  coalesce(r.origem, s.origem_reserva) as origem_reserva,
  rc.id                as revenue_center_id,
  rc.nome              as centro,
  rc.slug              as centro_slug,
  bu.id                as business_unit_id,
  bu.nome              as unidade,
  bu.slug              as unidade_slug,
  bu.cor               as unidade_cor,
  bu.controla_custo,
  si.descricao,
  si.quantidade,
  si.valor_bruto,
  si.desconto,
  si.valor_liquido_item,
  si.custo_unitario,
  si.custo_total
from sale_items si
join sales s            on s.id  = si.sale_id
join revenue_centers rc on rc.id = si.revenue_center_id
join business_units bu  on bu.id = rc.business_unit_id
left join folios f      on f.id  = s.folio_id
left join reservas r    on r.id  = f.reserva_id
where si.status = 'ativo'
  and s.status <> 'cancelada';

-- =============================================================
-- Caixa (data do recebimento)
-- =============================================================
create view v_recebimentos with (security_invoker = true) as
select
  p.id as payment_id,
  p.data_recebimento,
  p.data_prevista_credito,
  p.forma_pagamento,
  p.status,
  p.valor_bruto_pago,
  p.taxa_cartao,
  p.valor_liquido_previsto,
  p.valor_liquido_creditado,
  coalesce(p.valor_liquido_creditado, p.valor_liquido_previsto) as valor_caixa,
  (p.valor_liquido_creditado is not null
   and p.valor_liquido_creditado <> p.valor_liquido_previsto)   as divergente,
  p.folio_id,
  p.sale_id
from payments p
where p.status in ('recebido','conciliado');

-- Previstos e atrasados
create view v_a_receber with (security_invoker = true) as
select
  p.id as payment_id,
  p.folio_id,
  p.forma_pagamento,
  p.data_prevista_credito,
  p.valor_liquido_previsto,
  (p.data_prevista_credito is not null
   and p.data_prevista_credito < current_date) as atrasado
from payments p
where p.status = 'previsto';

-- =============================================================
-- Saldo: liquido do item menos o que ja foi alocado
-- =============================================================
create view v_saldo_item with (security_invoker = true) as
select
  si.id as sale_item_id,
  si.sale_id,
  si.valor_liquido_item,
  coalesce(sum(pa.valor_alocado) filter (where p.id is not null), 0) as alocado,
  si.valor_liquido_item
    - coalesce(sum(pa.valor_alocado) filter (where p.id is not null), 0) as saldo
from sale_items si
left join payment_allocations pa on pa.sale_item_id = si.id
left join payments p on p.id = pa.payment_id and p.status <> 'cancelado'
where si.status = 'ativo'
group by si.id, si.sale_id, si.valor_liquido_item;

create view v_saldo_folio with (security_invoker = true) as
select
  s.folio_id,
  sum(vs.valor_liquido_item) as total_conta,
  sum(vs.alocado)            as pago,
  sum(vs.saldo)              as saldo
from v_saldo_item vs
join sales s on s.id = vs.sale_id
where s.folio_id is not null
  and s.status <> 'cancelada'
group by s.folio_id;

-- =============================================================
-- Consumo adicional por reserva
-- =============================================================
create view v_consumo_adicional_reserva with (security_invoker = true) as
select
  fi.reserva_id,
  fi.folio_id,
  sum(fi.valor_liquido_item) filter (where fi.unidade_slug =  'hospedagem') as hospedagem,
  sum(fi.valor_liquido_item) filter (where fi.unidade_slug <> 'hospedagem') as consumo_adicional,
  sum(fi.valor_liquido_item)                                                as total_conta
from v_faturamento_item fi
where fi.folio_id is not null
group by fi.reserva_id, fi.folio_id;

-- =============================================================
-- Resultado por unidade, com a regra de cobertura de custo
-- =============================================================
-- Custo nulo NUNCA e tratado como zero: a margem volta NULL quando a
-- cobertura esta abaixo do minimo.
create or replace function fn_resultado_unidade(p_inicio date, p_fim date)
returns table (
  unidade           text,
  unidade_slug      text,
  controla_custo    boolean,
  receita_liquida   numeric,
  cmv               numeric,
  custos_unidade    numeric,
  cobertura_custo   numeric,
  cobertura_status  text,
  margem            numeric
) language sql stable as $$
  with lim as (
    select fn_setting_numeric('cobertura_minima', 0.70)  as minima,
           fn_setting_numeric('cobertura_parcial', 0.99) as parcial
  ),
  fat as (
    select fi.business_unit_id, fi.unidade, fi.unidade_slug, fi.controla_custo,
           sum(fi.valor_liquido_item) as receita,
           sum(fi.custo_total)        as cmv,
           coalesce(sum(fi.valor_liquido_item)
             filter (where fi.custo_unitario is not null), 0) as receita_com_custo
      from v_faturamento_item fi
     where fi.data_venda between p_inicio and p_fim
     group by 1, 2, 3, 4
  ),
  desp as (
    select business_unit_id, sum(valor) as custos
      from unit_expenses
     where status = 'ativo'
       and data_competencia between p_inicio and p_fim
     group by 1
  )
  select
    f.unidade,
    f.unidade_slug,
    f.controla_custo,
    f.receita,
    f.cmv,
    coalesce(d.custos, 0),
    case when f.receita > 0 then round(f.receita_com_custo / f.receita, 4) else 0 end,
    case
      when f.receita = 0                               then 'sem_faturamento'
      when f.receita_com_custo / f.receita > l.parcial then 'completa'
      when f.receita_com_custo / f.receita >= l.minima then 'parcial'
      else 'insuficiente'
    end,
    case
      when f.receita > 0 and f.receita_com_custo / f.receita >= l.minima
      then f.receita - coalesce(f.cmv, 0) - coalesce(d.custos, 0)
    end
  from fat f
  cross join lim l
  left join desp d on d.business_unit_id = f.business_unit_id
  order by f.receita desc;
$$;

-- =============================================================
-- Ticket medio de consumo adicional - as duas metricas
-- =============================================================
create or replace function fn_ticket_medio_consumo(p_inicio date, p_fim date)
returns table (
  consumo_total                   numeric,
  reservas_com_consumo            bigint,
  reservas_no_periodo             bigint,
  ticket_por_reserva_com_consumo  numeric,
  ticket_por_reserva_total        numeric
) language sql stable as $$
  with consumo as (
    select fi.reserva_id, sum(fi.valor_liquido_item) as valor
      from v_faturamento_item fi
     where fi.reserva_id is not null
       and fi.unidade_slug <> 'hospedagem'
       and fi.data_venda between p_inicio and p_fim
     group by fi.reserva_id
    having sum(fi.valor_liquido_item) > 0
  ),
  base as (
    select count(*) as total
      from reservas
     where status <> 'cancelada'
       and check_in between p_inicio and p_fim
  )
  select
    coalesce(sum(c.valor), 0),
    count(c.reserva_id),
    b.total,
    case when count(c.reserva_id) > 0
         then round(coalesce(sum(c.valor), 0) / count(c.reserva_id), 2) end,
    case when b.total > 0
         then round(coalesce(sum(c.valor), 0) / b.total, 2) end
  from base b
  left join consumo c on true
  group by b.total;
$$;

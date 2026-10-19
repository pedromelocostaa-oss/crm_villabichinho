-- Villa Bichinho - 0009: caixa aberto por unidade de negocio
-- v_faturamento_item responde por competencia (data da venda). Esta view
-- responde por caixa (data do recebimento), passando pela alocacao para
-- saber de qual centro veio cada real que entrou.
-- Sem ela o seletor de regime do dashboard nao teria o que mostrar.

create view v_caixa_por_item with (security_invoker = true) as
select
  p.id                 as payment_id,
  p.data_recebimento,
  p.forma_pagamento,
  pa.valor_alocado,
  si.id                as sale_item_id,
  rc.id                as revenue_center_id,
  rc.nome              as centro,
  rc.slug              as centro_slug,
  bu.id                as business_unit_id,
  bu.nome              as unidade,
  bu.slug              as unidade_slug,
  bu.cor               as unidade_cor,
  s.folio_id
from payment_allocations pa
join payments p         on p.id  = pa.payment_id
                       and p.status in ('recebido','conciliado')
join sale_items si      on si.id = pa.sale_item_id
                       and si.status = 'ativo'
join sales s            on s.id  = si.sale_id
                       and s.status <> 'cancelada'
join revenue_centers rc on rc.id = si.revenue_center_id
join business_units bu  on bu.id = rc.business_unit_id;

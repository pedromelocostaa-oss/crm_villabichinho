-- Villa Bichinho - 0002: integridade, auditoria e regras de negocio
-- O que esta aqui nao pode viver no frontend.

-- =============================================================
-- Auditoria generica
-- =============================================================
-- Cancelamento e estorno exigem motivo. Como trigger generico nao recebe
-- parametro, o motivo chega por GUC de transacao, setado pelas RPCs abaixo.
create or replace function fn_audit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_nome   text;
  v_motivo text;
  v_acao   text;
begin
  select nome into v_nome from app_users where id = auth.uid();
  v_motivo := nullif(current_setting('app.motivo', true), '');

  if TG_OP = 'INSERT' then
    v_acao := 'criacao';
  else
    v_acao := coalesce(
      nullif(current_setting('app.acao', true), ''),
      case
        when (to_jsonb(NEW) ->> 'status') in ('cancelado','cancelada')
         and (to_jsonb(OLD) ->> 'status') not in ('cancelado','cancelada')
        then 'cancelamento'
        else 'edicao'
      end
    );
  end if;

  if v_acao in ('cancelamento','estorno') and v_motivo is null then
    raise exception 'Motivo e obrigatorio para % em %', v_acao, TG_TABLE_NAME
      using errcode = 'check_violation';
  end if;

  if TG_OP = 'UPDATE' and to_jsonb(NEW) is not distinct from to_jsonb(OLD) then
    return NEW;
  end if;

  insert into audit_log (tabela, registro_id, acao, valores_antes, valores_depois,
                         usuario, usuario_nome, motivo)
  values (TG_TABLE_NAME, NEW.id, v_acao,
          case when TG_OP = 'UPDATE' then to_jsonb(OLD) end,
          to_jsonb(NEW), auth.uid(), v_nome, v_motivo);

  return NEW;
end $$;

create trigger trg_audit_sales
  after insert or update on sales
  for each row execute function fn_audit();

create trigger trg_audit_sale_items
  after insert or update on sale_items
  for each row execute function fn_audit();

create trigger trg_audit_payments
  after insert or update on payments
  for each row execute function fn_audit();

create trigger trg_audit_unit_expenses
  after insert or update on unit_expenses
  for each row execute function fn_audit();

-- =============================================================
-- Anti-dupla-contagem
-- =============================================================
-- CHECK nao enxerga outras linhas, entao o limite por item vai em constraint
-- trigger deferivel: permite alocar varios itens na mesma transacao e so
-- valida no commit. Pagamento cancelado nao ocupa saldo.
create or replace function fn_check_allocation()
returns trigger language plpgsql as $$
declare
  v_item    uuid;
  v_alocado numeric(12,2);
  v_liquido numeric(12,2);
begin
  v_item := coalesce(NEW.sale_item_id, OLD.sale_item_id);

  select coalesce(sum(pa.valor_alocado), 0)
    into v_alocado
    from payment_allocations pa
    join payments p on p.id = pa.payment_id
   where pa.sale_item_id = v_item
     and p.status <> 'cancelado';

  select valor_liquido_item into v_liquido from sale_items where id = v_item;

  if v_alocado > v_liquido then
    raise exception
      'Alocacao de % excede o valor liquido do item (%). A mesma receita nao pode ser contada duas vezes.',
      v_alocado, v_liquido
      using errcode = 'check_violation';
  end if;

  return null;
end $$;

create constraint trigger trg_allocation_limit
  after insert or update on payment_allocations
  deferrable initially deferred
  for each row execute function fn_check_allocation();

-- =============================================================
-- Comissao Booking: base e SO a hospedagem
-- =============================================================
create or replace function fn_sync_booking_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_reserva uuid;
  v_bruto   numeric(12,2);
  v_pct     numeric(5,4);
begin
  select r.id into v_reserva
    from sales s
    join folios f   on f.id = s.folio_id
    join reservas r on r.id = f.reserva_id
   where s.id = coalesce(NEW.sale_id, OLD.sale_id)
     and r.origem = 'booking';

  if v_reserva is null then
    return null;
  end if;

  select coalesce(sum(si.valor_liquido_item), 0)
    into v_bruto
    from sale_items si
    join sales s           on s.id  = si.sale_id
    join folios f          on f.id  = s.folio_id
    join revenue_centers rc on rc.id = si.revenue_center_id
    join business_units bu on bu.id = rc.business_unit_id
   where f.reserva_id = v_reserva
     and si.status = 'ativo'
     and s.status <> 'cancelada'
     and bu.slug = 'hospedagem';

  v_pct := coalesce(
    (select (valor #>> '{}')::numeric from app_settings where chave = 'booking_comissao_padrao'),
    0.17
  );

  insert into booking_commissions (reserva_id, valor_bruto_hospedagem, percentual_comissao)
  values (v_reserva, v_bruto, v_pct)
  on conflict (reserva_id) do update
    set valor_bruto_hospedagem = excluded.valor_bruto_hospedagem;

  return null;
end $$;

create trigger trg_sync_booking_commission
  after insert or update or delete on sale_items
  for each row execute function fn_sync_booking_commission();

-- =============================================================
-- Origem da reserva nao pode divergir da reserva do folio
-- =============================================================
create or replace function fn_check_origem_venda()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_origem text;
begin
  if NEW.folio_id is null then
    return NEW;
  end if;

  select r.origem into v_origem
    from folios f
    join reservas r on r.id = f.reserva_id
   where f.id = NEW.folio_id;

  if v_origem is null then
    return NEW;
  end if;

  if NEW.origem_reserva is null then
    NEW.origem_reserva := v_origem;
  elsif NEW.origem_reserva <> v_origem then
    raise exception 'Origem da venda (%) diverge da origem da reserva (%)',
      NEW.origem_reserva, v_origem
      using errcode = 'check_violation';
  end if;

  return NEW;
end $$;

create trigger trg_check_origem_venda
  before insert or update on sales
  for each row execute function fn_check_origem_venda();

-- =============================================================
-- Taxa de cartao e data prevista de credito, automaticas
-- =============================================================
-- Taxa reduz o RECEBIDO, nunca o faturamento. Quando taxa_cartao vem zerada
-- num pagamento em cartao, a regra vigente preenche taxa e previsao.
create or replace function fn_apply_card_fee()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if NEW.forma_pagamento not in ('credito','debito') then
    return NEW;
  end if;

  select * into r
    from card_fee_rules
   where ativo
     and vigencia_inicio <= coalesce(NEW.data_recebimento, current_date)
     and tipo = case
                  when NEW.forma_pagamento = 'debito' then 'debito'
                  when NEW.parcelas > 1 then 'credito_parcelado'
                  else 'credito_vista'
                end
     and NEW.parcelas between parcelas_min and parcelas_max
   order by vigencia_inicio desc
   limit 1;

  if not found then
    return NEW;
  end if;

  if NEW.taxa_cartao = 0 then
    NEW.taxa_cartao := round(NEW.valor_bruto_pago * r.percentual_taxa, 2);
  end if;

  if NEW.data_prevista_credito is null then
    NEW.data_prevista_credito :=
      coalesce(NEW.data_recebimento, current_date) + r.prazo_credito_dias;
  end if;

  return NEW;
end $$;

create trigger trg_apply_card_fee
  before insert on payments
  for each row execute function fn_apply_card_fee();

-- =============================================================
-- Cancelamento e estorno: nunca deletam
-- =============================================================
create or replace function cancelar_venda(p_id uuid, p_motivo text)
returns void language plpgsql as $$
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Motivo e obrigatorio para cancelar uma venda';
  end if;
  perform set_config('app.motivo', p_motivo, true);
  perform set_config('app.acao', 'cancelamento', true);

  update sale_items set status = 'cancelado' where sale_id = p_id and status = 'ativo';
  update sales      set status = 'cancelada'  where id = p_id;
end $$;

create or replace function cancelar_item(p_id uuid, p_motivo text)
returns void language plpgsql as $$
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Motivo e obrigatorio para cancelar um item';
  end if;
  perform set_config('app.motivo', p_motivo, true);
  perform set_config('app.acao', 'cancelamento', true);

  update sale_items set status = 'cancelado' where id = p_id;
end $$;

create or replace function estornar_pagamento(p_id uuid, p_motivo text)
returns void language plpgsql as $$
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Motivo e obrigatorio para estornar um pagamento';
  end if;
  perform set_config('app.motivo', p_motivo, true);
  perform set_config('app.acao', 'estorno', true);

  -- As alocacoes permanecem; o saldo volta porque pagamento cancelado
  -- nao ocupa valor em fn_check_allocation nem nas views.
  update payments set status = 'cancelado' where id = p_id;
end $$;

-- Cancelar jamais vira deletar.
revoke delete on sales, sale_items, payments, unit_expenses, audit_log
  from authenticated, anon;
revoke update on audit_log from authenticated, anon;

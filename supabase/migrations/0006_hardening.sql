-- Villa Bichinho - 0006: hardening apontado pelos advisors do Supabase

-- =============================================================
-- search_path fixo em todas as funcoes
-- =============================================================
alter function fn_check_allocation()                     set search_path = public;
alter function fn_setting_numeric(text, numeric)         set search_path = public;
alter function fn_resultado_unidade(date, date)          set search_path = public;
alter function fn_ticket_medio_consumo(date, date)       set search_path = public;
alter function cancelar_venda(uuid, text)                set search_path = public;
alter function cancelar_item(uuid, text)                 set search_path = public;
alter function estornar_pagamento(uuid, text)            set search_path = public;

-- =============================================================
-- Funcoes de trigger nao sao API
-- =============================================================
-- Elas disparam pelo trigger, nao precisam de EXECUTE para ninguem.
-- Expostas em /rest/v1/rpc seriam SECURITY DEFINER chamavel de fora.
revoke execute on function fn_handle_new_user()          from anon, authenticated;
revoke execute on function fn_audit()                    from anon, authenticated;
revoke execute on function fn_check_allocation()         from anon, authenticated;
revoke execute on function fn_sync_booking_commission()  from anon, authenticated;
revoke execute on function fn_check_origem_venda()       from anon, authenticated;
revoke execute on function fn_apply_card_fee()           from anon, authenticated;

-- =============================================================
-- RPCs e relatorios: so para quem esta autenticado
-- =============================================================
revoke execute on function cancelar_venda(uuid, text)          from anon;
revoke execute on function cancelar_item(uuid, text)           from anon;
revoke execute on function estornar_pagamento(uuid, text)      from anon;
revoke execute on function fn_setting_numeric(text, numeric)   from anon;
revoke execute on function fn_resultado_unidade(date, date)    from anon;
revoke execute on function fn_ticket_medio_consumo(date, date) from anon;

grant execute on function cancelar_venda(uuid, text)          to authenticated;
grant execute on function cancelar_item(uuid, text)           to authenticated;
grant execute on function estornar_pagamento(uuid, text)      to authenticated;
grant execute on function fn_setting_numeric(text, numeric)   to authenticated;
grant execute on function fn_resultado_unidade(date, date)    to authenticated;
grant execute on function fn_ticket_medio_consumo(date, date) to authenticated;

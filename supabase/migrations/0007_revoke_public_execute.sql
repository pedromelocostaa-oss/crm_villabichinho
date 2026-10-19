-- Villa Bichinho - 0007: tirar o EXECUTE que toda funcao ganha de PUBLIC
-- Revogar de anon e authenticated nao basta: o grant implicito e para PUBLIC,
-- e e ele que expunha as funcoes de trigger em /rest/v1/rpc.

-- Funcoes de trigger: ninguem chama diretamente.
-- O trigger dispara independente de EXECUTE.
revoke execute on function fn_handle_new_user()         from public;
revoke execute on function fn_audit()                   from public;
revoke execute on function fn_check_allocation()        from public;
revoke execute on function fn_sync_booking_commission() from public;
revoke execute on function fn_check_origem_venda()      from public;
revoke execute on function fn_apply_card_fee()          from public;

-- RPCs e relatorios: so o grant explicito para authenticated vale.
revoke execute on function cancelar_venda(uuid, text)          from public;
revoke execute on function cancelar_item(uuid, text)           from public;
revoke execute on function estornar_pagamento(uuid, text)      from public;
revoke execute on function fn_setting_numeric(text, numeric)   from public;
revoke execute on function fn_resultado_unidade(date, date)    from public;
revoke execute on function fn_ticket_medio_consumo(date, date) from public;

grant execute on function cancelar_venda(uuid, text)          to authenticated;
grant execute on function cancelar_item(uuid, text)           to authenticated;
grant execute on function estornar_pagamento(uuid, text)      to authenticated;
grant execute on function fn_setting_numeric(text, numeric)   to authenticated;
grant execute on function fn_resultado_unidade(date, date)    to authenticated;
grant execute on function fn_ticket_medio_consumo(date, date) to authenticated;

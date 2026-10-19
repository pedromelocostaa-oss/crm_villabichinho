-- Villa Bichinho - 0008: RPC que faltava para cancelar custo de unidade
-- unit_expenses tambem tem trigger de auditoria, entao mudar status direto
-- para 'cancelado' sem motivo e rejeitado pelo banco.

create or replace function cancelar_custo(p_id uuid, p_motivo text)
returns void language plpgsql
set search_path = public as $$
begin
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Motivo e obrigatorio para cancelar um custo';
  end if;
  perform set_config('app.motivo', p_motivo, true);
  perform set_config('app.acao', 'cancelamento', true);

  update unit_expenses set status = 'cancelado' where id = p_id;
end $$;

revoke execute on function cancelar_custo(uuid, text) from public;
grant  execute on function cancelar_custo(uuid, text) to authenticated;

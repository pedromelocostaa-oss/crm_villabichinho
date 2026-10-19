-- Villa Bichinho - 0003: Row Level Security
-- Equipe interna pequena: quem esta autenticado opera o sistema.
-- Papeis finos (recepcao nao mexe em custo) ficam para depois, se precisar.

do $$
declare t text;
begin
  foreach t in array array[
    'app_users','app_settings','card_fee_rules','chales','hospedes',
    'leads','lead_history','reservas','business_units','revenue_centers',
    'folios','sales','product_catalog','sale_items','unit_expenses',
    'payments','payment_allocations','booking_commissions','audit_log'
  ]
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- Operacao normal: tudo liberado para usuario autenticado, menos audit_log.
do $$
declare t text;
begin
  foreach t in array array[
    'app_settings','card_fee_rules','chales','hospedes',
    'leads','lead_history','reservas','business_units','revenue_centers',
    'folios','sales','product_catalog','sale_items','unit_expenses',
    'payments','payment_allocations','booking_commissions'
  ]
  loop
    execute format(
      'create policy %I on %I for select to authenticated using (true)',
      t || '_select', t);
    execute format(
      'create policy %I on %I for insert to authenticated with check (true)',
      t || '_insert', t);
    execute format(
      'create policy %I on %I for update to authenticated using (true) with check (true)',
      t || '_update', t);
  end loop;
end $$;

-- app_users: todos leem (para exibir nomes), cada um edita o proprio cadastro.
create policy app_users_select on app_users
  for select to authenticated using (true);

create policy app_users_update on app_users
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- audit_log: somente leitura. A escrita vem do trigger fn_audit, que e
-- security definer e portanto nao passa por estas policies.
create policy audit_log_select on audit_log
  for select to authenticated using (true);

-- Villa Bichinho - 0012: nomes e categorias reais dos 10 quartos
-- Substitui a numeracao provisoria da 0011. Duas categorias:
--   Suite Luxo Premium - quarto casal, area privativa com banheira de pedra
--     sabao (spa) e lareira.
--   Suite Premium - quarto casal, area privativa com lareira. Parte para 2
--     pessoas, parte para ate 4.
-- Renomeia pelo ordem_exibicao para preservar os ids: reservas e folios
-- apontam por id, nao por nome.

do $$
declare
  q record;
begin
  for q in
    select * from (values
      ( 1, 'Lavanda',     'Suíte Luxo Premium', 2),
      ( 2, 'Florestal',   'Suíte Luxo Premium', 2),
      ( 3, 'Pássaros',    'Suíte Premium',      2),
      ( 4, 'Capadócia',   'Suíte Premium',      2),
      ( 5, 'Bichinho',    'Suíte Premium',      2),
      ( 6, 'Cosmopolita', 'Suíte Premium',      4),
      ( 7, 'Amazônia',    'Suíte Premium',      4),
      ( 8, 'Divino',      'Suíte Premium',      4),
      ( 9, 'Safari',      'Suíte Premium',      4),
      (10, 'Tiradentes',  'Suíte Premium',      4)
    ) as t(ordem, nome, categoria, capacidade)
  loop
    update chales
       set nome = q.nome, categoria = q.categoria, capacidade = q.capacidade
     where ordem_exibicao = q.ordem and nome = 'Quarto ' || q.ordem;

    insert into chales (nome, categoria, capacidade, ordem_exibicao)
    values (q.nome, q.categoria, q.capacidade, q.ordem)
    on conflict (nome) do update
       set categoria = excluded.categoria,
           capacidade = excluded.capacidade,
           ordem_exibicao = excluded.ordem_exibicao;
  end loop;
end $$;

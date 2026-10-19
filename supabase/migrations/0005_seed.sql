-- Villa Bichinho - 0005: seed
-- Idempotente: pode rodar de novo sem duplicar nada.

-- =============================================================
-- Configuracao
-- =============================================================
insert into app_settings (chave, valor, descricao) values
  ('booking_comissao_padrao', '0.17'::jsonb,
   'Percentual padrao de comissao do Booking. Editavel por reserva.'),
  ('cobertura_minima', '0.70'::jsonb,
   'Abaixo desta cobertura de custo a margem nao e exibida.'),
  ('cobertura_parcial', '0.99'::jsonb,
   'Entre a minima e este valor a margem e exibida como parcial.')
on conflict (chave) do nothing;

-- =============================================================
-- Unidades de negocio
-- =============================================================
insert into business_units (nome, slug, controla_custo, ordem_exibicao, cor) values
  ('Hospedagem',          'hospedagem',          false, 1, '#059669'),
  ('Caverna',             'caverna',             true,  2, '#b45309'),
  ('Piscina',             'piscina',             true,  3, '#0284c7'),
  ('Frigobar',            'frigobar',            true,  4, '#7c3aed'),
  ('Servicos adicionais', 'servicos_adicionais', false, 5, '#db2777'),
  ('Outras receitas',     'outras_receitas',     false, 6, '#64748b')
on conflict (slug) do nothing;

-- =============================================================
-- Centros de receita
-- =============================================================
-- O vinculo centro -> unidade e editavel pela interface. Mover a Pizzaria
-- para uma unidade propria depois e um update de uma linha, sem tocar em codigo.
insert into revenue_centers (business_unit_id, nome, slug, ordem_exibicao)
select bu.id, v.nome, v.slug, v.ordem
from (values
  ('hospedagem',          'Hospedagem direta',     'hospedagem_direta',    1),
  ('hospedagem',          'Hospedagem Booking',    'hospedagem_booking',   2),
  ('caverna',             'Caverna gastronomica',  'caverna_gastronomica', 3),
  ('caverna',             'Pizzaria',              'pizzaria',             4),
  ('piscina',             'Bar da piscina',        'bar_piscina',          5),
  ('piscina',             'Cozinha da piscina',    'cozinha_piscina',      6),
  ('frigobar',            'Frigobar',              'frigobar',             7),
  ('servicos_adicionais', 'Taxa pet',              'taxa_pet',             8),
  ('servicos_adicionais', 'Experiencias',          'experiencias',         9),
  ('servicos_adicionais', 'Decoracao romantica',   'decoracao_romantica',  10),
  ('outras_receitas',     'Outras receitas',       'outras_receitas',      11)
) as v(unidade_slug, nome, slug, ordem)
join business_units bu on bu.slug = v.unidade_slug
on conflict (slug) do nothing;

-- =============================================================
-- Taxas de cartao - PLACEHOLDER
-- =============================================================
-- Trocar pelos numeros reais da maquininha. Como a tabela tem vigencia,
-- basta inserir as novas linhas: o historico nao se reescreve.
insert into card_fee_rules (tipo, parcelas_min, parcelas_max, percentual_taxa, prazo_credito_dias)
select * from (values
  ('debito',             1,  1, 0.0199::numeric, 1),
  ('credito_vista',      1,  1, 0.0320::numeric, 30),
  ('credito_parcelado',  2, 12, 0.0450::numeric, 30)
) as v(tipo, pmin, pmax, taxa, prazo)
where not exists (select 1 from card_fee_rules);

-- =============================================================
-- Chales - PLACEHOLDER
-- =============================================================
-- Trocar pelos nomes reais dos 8 chales.
insert into chales (nome, ordem_exibicao) values
  ('Chalé 1', 1), ('Chalé 2', 2), ('Chalé 3', 3), ('Chalé 4', 4),
  ('Chalé 5', 5), ('Chalé 6', 6), ('Chalé 7', 7), ('Chalé 8', 8)
on conflict (nome) do nothing;

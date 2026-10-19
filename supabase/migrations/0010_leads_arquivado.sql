-- Villa Bichinho - 0010: arquivar lead em vez de apagar
-- A RLS de leads nao tem politica de DELETE (so select/insert/update), e nada
-- justifica perder o historico de um lead criado por engano. O botao "Excluir"
-- do CRM passa a arquivar: a linha fica, a listagem filtra.

alter table leads
  add column if not exists arquivado boolean not null default false;

create index if not exists idx_leads_ativos on leads (arquivado) where arquivado = false;

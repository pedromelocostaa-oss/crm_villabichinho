# Villa Bichinho — contexto do projeto

Documento de entrada. Se você é um agente assumindo este repositório, leia isto antes
de mexer em qualquer coisa.

## O que é

Pousada boutique em Bichinho (MG), com 10 quartos, um restaurante próprio chamado
Caverna Gastronômica, uma pizzaria que funciona dentro da caverna, um bar na piscina e
frigobar nos quartos.

O aplicativo tem **dois módulos independentes**:

1. **CRM de leads** — já existia antes. Funil de vendas pré-reserva, com etapas,
   follow-ups e histórico. Guarda em `localStorage`, chave `villa_bichinho_leads`.
2. **Módulo financeiro** — controle de receitas por setor e fluxo de caixa, sobre
   Supabase (Postgres). Foi o que se construiu depois.

Os dois convivem no mesmo app, em abas diferentes. Ver "Decisões" abaixo para entender
por que o CRM continua em localStorage.

## Onde as coisas estão

| | |
|---|---|
| Repositório | `github.com/pedromelocostaa-oss/crm_villabichinho` |
| Branch de trabalho | `modulo-financeiro` (a `main` ainda está no commit inicial) |
| Aplicativo | `https://villa-bichinho-crm.vercel.app` |
| Projeto Supabase | ref `nhtbcoxsqjzlxyjdynpx`, região `sa-east-1` |
| Projeto Vercel | `villa-bichinho-crm` |

Proteção SSO da Vercel está **desligada** de propósito: o endereço precisa ser público
para a equipe da pousada entrar sem conta na Vercel.

## Como rodar

```bash
npm install
npm run dev      # vite, porta 5173
npm test         # vitest — bate no Postgres real, não em mock
npm run build    # tsc -b && vite build
npm run lint
```

Crie um `.env.local` a partir do `.env.example`:

```
VITE_SUPABASE_URL=https://nhtbcoxsqjzlxyjdynpx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
TEST_USER_EMAIL=testes@villabichinho.local
TEST_USER_PASSWORD=...
```

A chave publicável não é segredo — é pública por design e já vai no bundle; quem protege
os dados é a RLS. As senhas não estão no Git: ficam em `.env.local` e `credenciais.local`,
ambos cobertos pelo `.gitignore` via o padrão `*.local`. Peça ao Pedro.

Os testes entram com uma conta real do Supabase Auth e exercitam as regras do banco. Sem
`.env.local` preenchido, eles falham no login.

## A regra que sustenta o modelo

Quatro conceitos que **nunca** podem se confundir, e por isso são colunas separadas:

- **Origem da reserva** — `direta`, `booking`, `walk_in`. Vive em `reservas.origem`.
- **Unidade de negócio** — Hospedagem, Caverna, Piscina, Frigobar, Serviços, Outras.
- **Centro de receita** — o recorte dentro da unidade. Vive no **item**, não na venda.
- **Forma de pagamento** — Pix, crédito, débito, dinheiro, repasse Booking.

O centro ficar no item é o que permite uma comanda da Caverna ter pizza (centro Pizzaria)
e vinho (centro Caverna gastronômica) sem falsificar o relatório.

### Unidades e centros semeados

| Unidade | Centros | Controla custo |
|---|---|---|
| Hospedagem | Hospedagem direta, Hospedagem Booking | não |
| Caverna | Caverna gastronômica, Pizzaria | sim |
| Piscina | Bar da piscina, Cozinha da piscina | sim |
| Frigobar | Frigobar | sim |
| Serviços adicionais | Taxa pet, Experiências, Decoração romântica | não |
| Outras receitas | Outras receitas | não |

Os 10 quartos: Lavanda, Florestal, Pássaros, Capadócia, Bichinho, Cosmopolita, Amazônia,
Divino, Safari, Tiradentes. Lavanda e Florestal são Suíte Luxo Premium; as outras oito,
Suíte Premium.

## Invariantes que vivem no banco

Não estão na tela. Não tente reimplementá-las em JavaScript — elas já valem, e duplicar
só cria divergência.

1. **A mesma receita nunca é contada duas vezes.** Constraint trigger diferido em
   `payment_allocations` impede alocar a um item mais que `valor_liquido_item`. Valida no
   commit, então dá para alocar vários itens numa transação.
2. **Cancelar nunca deleta.** `DELETE` revogado em `sales`, `sale_items`, `payments`,
   `unit_expenses` e `audit_log`. Cancelamento e estorno passam por RPC
   (`cancelar_venda`, `cancelar_item`, `cancelar_custo`, `estornar_pagamento`) e o motivo
   é obrigatório — o trigger de auditoria levanta exceção sem ele.
3. **Faturamento ≠ recebimento.** `v_faturamento_item` responde por data da venda;
   `v_recebimentos` e `v_caixa_por_item`, por data do dinheiro.
4. **Taxa de cartão reduz o caixa, não o faturamento.** Preenchida automaticamente por
   `card_fee_rules` no insert do pagamento.
5. **Comissão do Booking incide só sobre hospedagem.** Trigger recalcula
   `booking_commissions` a partir dos itens da unidade Hospedagem daquela reserva. O
   consumo adicional nunca entra na base. Padrão 17%, em `app_settings`.
6. **Margem só com cobertura de custo.** `fn_resultado_unidade` devolve margem `NULL`
   abaixo de 70% de cobertura. Custo nulo jamais é tratado como zero.
7. **Toda alteração é auditada**, com valores antes e depois e o nome do usuário.

## Mapa do código

```
src/lib/financeiro.ts      camada de dados do financeiro (52 exports)
src/lib/relatorios.ts      os relatórios consolidados
src/lib/supabase.ts        client (lê import.meta.env no browser, process.env no vitest)
src/types/database.ts      tipos do schema, escritos à mão
src/hooks/useAuth.ts       sessão
src/hooks/useCatalogo.ts   unidades, centros e produtos
src/hooks/useLeads.ts      CRM, localStorage — NÃO é do financeiro
src/utils/moeda.ts         brl() e paraNumero()
src/utils/periodo.ts       intervalos e rótulos de período
src/utils/csv.ts           CSV com ; e vírgula decimal, para o Excel pt-BR
src/utils/storage.ts       localStorage do CRM — NÃO é do financeiro

src/components/
  Caixa.tsx                sub-abas Balcão e Contas
  LancamentoRapido.tsx     venda de balcão em 4 toques
  ContaHospede.tsx         conta do hóspede: reserva, diária, consumos, fechamento
  Financeiro.tsx           sub-abas Painel e Relatórios
  DashboardFinanceiro.tsx  o painel
  RelatoriosFinanceiros.tsx os 7 relatórios com export
  CatalogoProdutos.tsx     catálogo
  Login.tsx                login
  Dashboard/LeadList/LeadModal/NewLeadModal/Reports/StageBadge  — CRM, não mexer

supabase/migrations/       0001 a 0012, aplicadas em ordem
```

`src/App.tsx` é compartilhado pelos dois módulos. Mexa só na parte das abas financeiras.

## Como a receita entra

**Balcão** (`LancamentoRapido`): unidade → produto ou valor livre → forma de pagamento →
salvar. Opcionalmente vincula a um hóspede e lança na conta em vez de cobrar na hora.

**Contas** (`ContaHospede`): cria hóspede, reserva e folio num passo, opcionalmente já com
a diária. A hospedagem vai para o centro conforme a origem — é esse lançamento que dispara
o cálculo da comissão. Recebe parcial durante a estadia e fecha no check-out, só com saldo
zerado.

## Testes

`src/lib/__tests__/aceite.test.ts` tem os dois casos que definem o sistema:

1. Reserva direta de R$ 2.000 com R$ 460 de consumo (R$ 150 bar, R$ 140 caverna, R$ 90
   pizzaria, R$ 80 frigobar), paga em duas parcelas. Conta de R$ 2.460, cada valor no seu
   centro, e faturamento de R$ 2.460 — não R$ 4.920.
2. A mesma reserva vinda do Booking: comissão de R$ 340 só sobre os R$ 2.000, receita
   líquida total de R$ 2.120.

O teardown cancela vendas, estorna pagamentos, cancela reservas e fecha os folios. Se você
adicionar um teste que cria dados, **limpe no teardown** — senão o resíduo aparece nos
relatórios e nas listas do caixa.

`src/utils/__tests__/csv.test.ts` cobre o formato do CSV.

## Decisões que valem saber

**O CRM continua em localStorage, de propósito.** Houve uma migração dele para o Postgres
(commit `371b49f`) que foi revertida (`9d673d8`) a pedido do dono: estava fora do escopo
combinado e fazia o funil aparecer vazio, porque a tela passou a ler do Postgres enquanto
os registros seguiam no navegador. Nenhum dado foi perdido. As tabelas `leads` e
`lead_history` existem no banco desde a 0001, mas estão sem uso. **Não refaça essa
migração sem pedir.**

**Papéis não restringem nada ainda.** `app_users.papel` é `admin`, `recepcao` ou
`operacao`, mas a RLS é plana: quem está autenticado vê e mexe em tudo. O papel serve só
para identificar quem fez o quê.

**Não há e-mail configurado.** Confirmação de cadastro e recuperação de senha não
funcionam. Contas são criadas direto no banco, já confirmadas.

## Pendências conhecidas

- Taxas de cartão são placeholder (1,99% débito, 3,20% crédito à vista, 4,50% parcelado).
  Enquanto não forem as reais, o caixa líquido sai errado.
- Faltam contas para Wilian e Leonardo, e não há tela de gestão de usuários.
- Pull request não aberto; a `main` não recebeu nada.
- Erro de lint pré-existente em `src/hooks/useLeads.ts:52` (setState síncrono em efeito).
  É do CRM original, veio do revert. O padrão correto está em `src/hooks/useCatalogo.ts`.
- Estoque de frigobar e contas a pagar ficaram fora de escopo, com o modelo preparado.
- Resíduo de testes no banco: leads órfãos, hóspedes e reservas cancelados.

## Convenções

- Dinheiro sempre `numeric(12,2)`. Nunca float.
- Status como `text` + `CHECK`, não enum — evoluir é um `ALTER CONSTRAINT`.
- Migrations numeradas, nunca editadas depois de aplicadas: acrescente uma nova.
- Views com `security_invoker = true`, para a RLS continuar valendo.
- Funções com `search_path` fixo e `EXECUTE` revogado de `public`.
- Textos de interface em português, incluindo mensagens de erro.

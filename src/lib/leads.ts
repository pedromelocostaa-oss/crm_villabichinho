// CRM de leads no Postgres. Espelha o que o useLeads fazia no localStorage,
// mas o historico passa a ser linhas em lead_history em vez de um array dentro
// do lead. A RLS de leads e lead_history exige sessao autenticada.
import { supabase } from './supabase';
import type { LeadEtapa, LeadHistoryRow, LeadRow } from '../types/database';
import type { FollowupType, HistoryEntry, Lead, LeadStage, RecusaMotivo } from '../types/lead';

class ErroLeads extends Error {
  constructor(contexto: string, detalhe?: string) {
    super(detalhe ? `${contexto}: ${detalhe}` : contexto);
    this.name = 'ErroLeads';
  }
}

// ─────────────────────────────────────────────────────────────
// Conversao
// ─────────────────────────────────────────────────────────────

/** Data vazia precisa virar null: o Postgres recusa '' em coluna date. */
function dataOuNull(valor?: string | null): string | null {
  const v = valor?.trim();
  return v ? v : null;
}

function textoOuNull(valor?: string | null): string | null {
  const v = valor?.trim();
  return v ? v : null;
}

function numeroOuNull(valor?: number | string | null): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

function paraLead(row: LeadRow, historico: LeadHistoryRow[]): Lead {
  return {
    id: row.id,
    name: row.nome,
    phone: row.telefone ?? '',
    email: row.email ?? undefined,
    createdAt: row.criado_em,
    stage: row.etapa as LeadStage,
    checkIn: row.check_in ?? undefined,
    checkOut: row.check_out ?? undefined,
    guests: row.hospedes ?? undefined,
    accommodation: row.acomodacao ?? undefined,
    occasion: row.ocasiao ?? undefined,
    budget: numeroOuNull(row.orcamento) ?? undefined,
    lookingFor: row.procurando ?? undefined,
    services: row.servicos ?? [],
    attendant: row.atendente ?? undefined,
    lastMessage: row.ultima_mensagem ?? undefined,
    lastInteraction: row.ultima_interacao ?? undefined,
    notes: row.observacoes ?? undefined,
    declineReason: (row.motivo_recusa as RecusaMotivo | null) ?? undefined,
    declineReasonOther: row.motivo_recusa_outro ?? undefined,
    declineDate: row.data_recusa ?? undefined,
    declineNotes: row.observacoes_recusa ?? undefined,
    followupDate: row.followup_data ?? undefined,
    followupType: (row.followup_tipo as FollowupType | null) ?? undefined,
    followupDone: row.followup_feito,
    history: historico.map(paraHistoryEntry),
  };
}

function paraHistoryEntry(row: LeadHistoryRow): HistoryEntry {
  return {
    id: row.id,
    date: row.data,
    action: row.acao,
    attendant: row.atendente ?? 'Sistema',
    note: row.nota ?? undefined,
  };
}

type ColunasLead = Partial<Omit<LeadRow, 'id' | 'criado_em'>>;

/** Mapeia os campos do Lead (camelCase) para as colunas do Postgres. */
function paraColunas(dados: Partial<Lead>): ColunasLead {
  const c: ColunasLead = {};
  if (dados.name !== undefined) c.nome = dados.name.trim();
  if (dados.phone !== undefined) c.telefone = textoOuNull(dados.phone);
  if (dados.email !== undefined) c.email = textoOuNull(dados.email);
  if (dados.stage !== undefined) c.etapa = dados.stage as LeadEtapa;
  if (dados.checkIn !== undefined) c.check_in = dataOuNull(dados.checkIn);
  if (dados.checkOut !== undefined) c.check_out = dataOuNull(dados.checkOut);
  if (dados.guests !== undefined) c.hospedes = numeroOuNull(dados.guests);
  if (dados.accommodation !== undefined) c.acomodacao = textoOuNull(dados.accommodation);
  if (dados.occasion !== undefined) c.ocasiao = textoOuNull(dados.occasion);
  if (dados.budget !== undefined) c.orcamento = numeroOuNull(dados.budget);
  if (dados.lookingFor !== undefined) c.procurando = textoOuNull(dados.lookingFor);
  if (dados.services !== undefined) c.servicos = dados.services ?? [];
  if (dados.attendant !== undefined) c.atendente = textoOuNull(dados.attendant);
  if (dados.lastMessage !== undefined) c.ultima_mensagem = textoOuNull(dados.lastMessage);
  if (dados.lastInteraction !== undefined) c.ultima_interacao = dataOuNull(dados.lastInteraction);
  if (dados.notes !== undefined) c.observacoes = textoOuNull(dados.notes);
  if (dados.declineReason !== undefined) c.motivo_recusa = textoOuNull(dados.declineReason);
  if (dados.declineReasonOther !== undefined)
    c.motivo_recusa_outro = textoOuNull(dados.declineReasonOther);
  if (dados.declineDate !== undefined) c.data_recusa = dataOuNull(dados.declineDate);
  if (dados.declineNotes !== undefined) c.observacoes_recusa = textoOuNull(dados.declineNotes);
  if (dados.followupDate !== undefined) c.followup_data = dataOuNull(dados.followupDate);
  if (dados.followupType !== undefined) c.followup_tipo = textoOuNull(dados.followupType);
  if (dados.followupDone !== undefined) c.followup_feito = dados.followupDone ?? false;
  return c;
}

// ─────────────────────────────────────────────────────────────
// Leitura
// ─────────────────────────────────────────────────────────────

/** Leads nao arquivados, com o historico de cada um em ordem cronologica. */
export async function listarLeads(): Promise<Lead[]> {
  const { data: rows, error } = await supabase
    .from('leads')
    .select('*')
    .eq('arquivado', false)
    .order('criado_em', { ascending: false });
  if (error) throw new ErroLeads('Falha ao listar leads', error.message);
  const leads = rows ?? [];
  if (leads.length === 0) return [];

  const { data: hist, error: erroHist } = await supabase
    .from('lead_history')
    .select('*')
    .in(
      'lead_id',
      leads.map((l) => l.id)
    )
    .order('data', { ascending: true });
  if (erroHist) throw new ErroLeads('Falha ao carregar histórico', erroHist.message);

  const porLead = new Map<string, LeadHistoryRow[]>();
  for (const h of hist ?? []) {
    const lista = porLead.get(h.lead_id);
    if (lista) lista.push(h);
    else porLead.set(h.lead_id, [h]);
  }

  return leads.map((l) => paraLead(l, porLead.get(l.id) ?? []));
}

// ─────────────────────────────────────────────────────────────
// Escrita
// ─────────────────────────────────────────────────────────────

async function registrarHistorico(
  leadId: string,
  acao: string,
  atendente?: string | null,
  nota?: string | null
): Promise<LeadHistoryRow> {
  const { data, error } = await supabase
    .from('lead_history')
    .insert({
      lead_id: leadId,
      acao,
      atendente: textoOuNull(atendente),
      nota: textoOuNull(nota),
    })
    .select()
    .single();
  if (error) throw new ErroLeads('Falha ao registrar histórico', error.message);
  return data;
}

export async function criarLead(
  dados: Omit<Lead, 'id' | 'createdAt' | 'history'>,
  notaInicial: string
): Promise<Lead> {
  const colunas = paraColunas({ ...dados, stage: 'novo_contato' });
  const { data, error } = await supabase
    .from('leads')
    .insert({ ...colunas, nome: dados.name.trim() })
    .select()
    .single();
  if (error) throw new ErroLeads('Falha ao criar lead', error.message);

  const entrada = await registrarHistorico(data.id, notaInicial, dados.attendant || 'Sistema');
  return paraLead(data, [entrada]);
}

/** Atualiza o lead e registra a mudanca no historico, como o CRM sempre fez. */
export async function atualizarLead(
  id: string,
  changes: Partial<Lead>,
  nota: string,
  atendente?: string
): Promise<Lead> {
  const colunas = paraColunas(changes);
  const { data, error } = await supabase
    .from('leads')
    .update({ ...colunas, ultima_interacao: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new ErroLeads('Falha ao atualizar lead', error.message);

  await registrarHistorico(id, nota, atendente || changes.attendant || data.atendente);

  const { data: hist, error: erroHist } = await supabase
    .from('lead_history')
    .select('*')
    .eq('lead_id', id)
    .order('data', { ascending: true });
  if (erroHist) throw new ErroLeads('Falha ao carregar histórico', erroHist.message);

  return paraLead(data, hist ?? []);
}

/**
 * O botao "Excluir" do CRM arquiva: a linha fica no banco (reservas.lead_id
 * aponta para ela) e a listagem filtra por arquivado = false.
 */
export async function arquivarLead(id: string, atendente?: string): Promise<void> {
  const { error } = await supabase.from('leads').update({ arquivado: true }).eq('id', id);
  if (error) throw new ErroLeads('Falha ao arquivar lead', error.message);
  await registrarHistorico(id, 'Lead arquivado', atendente);
}

// ─────────────────────────────────────────────────────────────
// Importacao one-shot do localStorage
// ─────────────────────────────────────────────────────────────

const CHAVE_LOCAL = 'villa_bichinho_leads';

export type ResultadoImportacao = {
  /** Leads encontrados no localStorage. */
  encontrados: number;
  /** Leads inseridos agora. */
  importados: number;
  /** Leads que o legacy_id mostrou que ja estavam no banco. */
  jaExistiam: number;
  /** Entradas de historico inseridas junto com os leads novos. */
  historicoImportado: number;
};

function lerDoLocalStorage(): Lead[] {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Lead[]) : [];
  } catch {
    return [];
  }
}

/**
 * Le a chave villa_bichinho_leads e insere em leads e lead_history.
 * legacy_id guarda o id antigo e tem UNIQUE no banco, entao rodar duas vezes
 * nao duplica nada: o segundo passe encontra tudo em jaExistiam.
 */
export async function importarDoLocalStorage(): Promise<ResultadoImportacao> {
  const locais = lerDoLocalStorage().filter((l) => l && l.id && l.name);
  const resultado: ResultadoImportacao = {
    encontrados: locais.length,
    importados: 0,
    jaExistiam: 0,
    historicoImportado: 0,
  };
  if (locais.length === 0) return resultado;

  const { data: existentes, error } = await supabase
    .from('leads')
    .select('legacy_id')
    .in(
      'legacy_id',
      locais.map((l) => l.id)
    );
  if (error) throw new ErroLeads('Falha ao verificar leads já importados', error.message);

  const jaNoBanco = new Set((existentes ?? []).map((e) => e.legacy_id));
  const novos = locais.filter((l) => !jaNoBanco.has(l.id));
  resultado.jaExistiam = locais.length - novos.length;
  if (novos.length === 0) return resultado;

  const { data: inseridos, error: erroInsert } = await supabase
    .from('leads')
    .insert(
      novos.map((l) => ({
        ...paraColunas(l),
        nome: l.name.trim(),
        legacy_id: l.id,
        criado_em: l.createdAt || new Date().toISOString(),
      }))
    )
    .select('id, legacy_id');
  if (erroInsert) throw new ErroLeads('Falha ao importar leads', erroInsert.message);

  resultado.importados = inseridos?.length ?? 0;

  const porLegacy = new Map((inseridos ?? []).map((r) => [r.legacy_id, r.id]));
  const historico = novos.flatMap((l) => {
    const leadId = porLegacy.get(l.id);
    if (!leadId) return [];
    return (l.history ?? []).map((h) => ({
      lead_id: leadId,
      data: h.date || l.createdAt || new Date().toISOString(),
      acao: h.action,
      atendente: textoOuNull(h.attendant),
      nota: textoOuNull(h.note),
    }));
  });

  if (historico.length > 0) {
    const { error: erroHist } = await supabase.from('lead_history').insert(historico);
    if (erroHist) throw new ErroLeads('Falha ao importar histórico', erroHist.message);
    resultado.historicoImportado = historico.length;
  }

  return resultado;
}

/** Quantos leads ainda estao no localStorage deste navegador. */
export function leadsNoLocalStorage(): number {
  return lerDoLocalStorage().length;
}

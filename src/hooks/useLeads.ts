import { useState, useEffect, useCallback } from 'react';
import type { Lead, LeadStage } from '../types/lead';
import { currencyBRL, formatDate, todayISO } from '../utils/storage';
import {
  arquivarLead,
  atualizarLead,
  criarLead,
  importarDoLocalStorage,
  listarLeads,
  type ResultadoImportacao,
} from '../lib/leads';

function buildEditNote(original: Lead, changes: Partial<Lead>): string {
  const diffs: string[] = [];

  if (changes.name !== undefined && changes.name !== original.name)
    diffs.push(`Nome: ${changes.name}`);
  if (changes.phone !== undefined && changes.phone !== original.phone)
    diffs.push(`Telefone: ${changes.phone}`);
  if (changes.email !== undefined && changes.email !== original.email)
    diffs.push(`Email: ${changes.email || 'removido'}`);
  if (changes.attendant !== undefined && changes.attendant !== original.attendant)
    diffs.push(`Atendente: ${changes.attendant}`);
  if (changes.checkIn !== undefined && changes.checkIn !== original.checkIn)
    diffs.push(`Check-in: ${changes.checkIn ? formatDate(changes.checkIn) : 'removido'}`);
  if (changes.checkOut !== undefined && changes.checkOut !== original.checkOut)
    diffs.push(`Check-out: ${changes.checkOut ? formatDate(changes.checkOut) : 'removido'}`);
  if (changes.guests !== undefined && changes.guests !== original.guests)
    diffs.push(`Hóspedes: ${changes.guests}`);
  if (changes.budget !== undefined && changes.budget !== original.budget)
    diffs.push(`Orçamento: ${currencyBRL(changes.budget)}`);
  if (changes.accommodation !== undefined && changes.accommodation !== original.accommodation)
    diffs.push(`Acomodação: ${changes.accommodation || 'removida'}`);
  if (changes.occasion !== undefined && changes.occasion !== original.occasion)
    diffs.push(`Ocasião: ${changes.occasion || 'removida'}`);
  if (changes.lookingFor !== undefined && changes.lookingFor !== original.lookingFor)
    diffs.push('Preferências atualizadas');
  if (changes.notes !== undefined && changes.notes !== original.notes)
    diffs.push('Anotações atualizadas');
  if (changes.lastMessage !== undefined && changes.lastMessage !== original.lastMessage)
    diffs.push('Última mensagem atualizada');
  if (changes.services !== undefined) {
    const added = (changes.services as string[]).filter((s) => !original.services.includes(s));
    const removed = original.services.filter((s) => !(changes.services as string[]).includes(s));
    if (added.length) diffs.push(`Serviços adicionados: ${added.join(', ')}`);
    if (removed.length) diffs.push(`Serviços removidos: ${removed.join(', ')}`);
  }

  return diffs.length > 0 ? `Campos atualizados — ${diffs.join(' · ')}` : 'Lead editado';
}

const STAGE_NOTES: Record<LeadStage, string> = {
  novo_contato: 'Etapa alterada para Novo Contato',
  orcamento_enviado: 'Orçamento enviado ao cliente',
  negociacao: 'Em negociação com o cliente',
  pendente_followup: 'Aguardando retorno do cliente',
  confirmado: 'Reserva confirmada! 🎉',
  declinado: 'Lead marcado como declinado',
};

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof Error ? e.message : padrao;
}

/**
 * Estado do CRM, agora sobre o Postgres. A interface publica e a mesma de
 * quando isso vivia no localStorage, para nao mexer nas telas.
 */
export function useLeads(habilitado = true) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [carregando, setCarregando] = useState(habilitado);
  const [erro, setErro] = useState<string | null>(null);

  // Nenhum setState antes do primeiro await: setState sincrono dentro do
  // efeito dispara renders em cascata.
  useEffect(() => {
    if (!habilitado) return;
    let ativo = true;

    void (async () => {
      try {
        const dados = await listarLeads();
        if (ativo) setLeads(dados);
      } catch (e) {
        if (ativo) setErro(mensagemDeErro(e, 'Falha ao carregar os leads'));
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [habilitado]);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setLeads(await listarLeads());
    } catch (e) {
      setErro(mensagemDeErro(e, 'Falha ao carregar os leads'));
    } finally {
      setCarregando(false);
    }
  }, []);

  /** Substitui o lead na lista local, para nao reler o banco inteiro. */
  const trocar = useCallback((lead: Lead) => {
    setLeads((atuais) => atuais.map((l) => (l.id === lead.id ? lead : l)));
  }, []);

  const createLead = useCallback(
    async (data: Omit<Lead, 'id' | 'createdAt' | 'history'>) => {
      const fields: string[] = [];
      if (data.checkIn) fields.push(`check-in ${formatDate(data.checkIn)}`);
      if (data.guests) fields.push(`${data.guests} hóspede${data.guests > 1 ? 's' : ''}`);
      if (data.occasion) fields.push(data.occasion);
      const detailNote = fields.length > 0 ? ` · ${fields.join(', ')}` : '';

      try {
        const novo = await criarLead(data, `Lead criado${detailNote}`);
        setLeads((atuais) => [novo, ...atuais]);
        setErro(null);
        return novo;
      } catch (e) {
        setErro(mensagemDeErro(e, 'Falha ao criar o lead'));
        return null;
      }
    },
    []
  );

  const updateLead = useCallback(
    async (id: string, changes: Partial<Lead>, historyNote?: string, attendant?: string) => {
      const original = leads.find((l) => l.id === id);
      const nota = historyNote ?? (original ? buildEditNote(original, changes) : 'Lead editado');
      try {
        trocar(await atualizarLead(id, changes, nota, attendant));
        setErro(null);
      } catch (e) {
        setErro(mensagemDeErro(e, 'Falha ao atualizar o lead'));
      }
    },
    [leads, trocar]
  );

  const changeStage = useCallback(
    (id: string, stage: LeadStage, attendant: string, note?: string) =>
      updateLead(id, { stage }, note || STAGE_NOTES[stage], attendant),
    [updateLead]
  );

  /**
   * Arquiva em vez de apagar: reservas.lead_id aponta para o lead e a RLS nao
   * tem politica de DELETE. A listagem filtra arquivado = false.
   */
  const deleteLead = useCallback(async (id: string, attendant?: string) => {
    try {
      await arquivarLead(id, attendant);
      setLeads((atuais) => atuais.filter((l) => l.id !== id));
      setErro(null);
    } catch (e) {
      setErro(mensagemDeErro(e, 'Falha ao arquivar o lead'));
    }
  }, []);

  const markFollowupDone = useCallback(
    (id: string, attendant: string) =>
      updateLead(id, { followupDone: true }, 'Follow-up realizado ✓', attendant),
    [updateLead]
  );

  const getOverdueFollowups = useCallback(() => {
    const today = todayISO();
    return leads.filter(
      (l) =>
        l.followupDate &&
        l.followupDate <= today &&
        !l.followupDone &&
        l.stage !== 'confirmado' &&
        l.stage !== 'declinado'
    );
  }, [leads]);

  /** Importacao one-shot do localStorage deste navegador. */
  const importar = useCallback(async (): Promise<ResultadoImportacao> => {
    const resultado = await importarDoLocalStorage();
    if (resultado.importados > 0) await recarregar();
    return resultado;
  }, [recarregar]);

  return {
    leads,
    carregando,
    erro,
    recarregar,
    importar,
    createLead,
    updateLead,
    changeStage,
    deleteLead,
    markFollowupDone,
    getOverdueFollowups,
  };
}

import { useState, useEffect, useCallback } from 'react';
import type { Lead, LeadStage, HistoryEntry } from '../types/lead';
import { getLeads, saveLeads, generateId, todayISO, formatDate, currencyBRL } from '../utils/storage';
import { MOCK_LEADS } from '../data/mockData';

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

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const stored = getLeads();
    if (stored.length === 0) {
      saveLeads(MOCK_LEADS);
      setLeads(MOCK_LEADS);
    } else {
      setLeads(stored);
    }
  }, []);

  const persist = useCallback((updated: Lead[]) => {
    setLeads(updated);
    saveLeads(updated);
  }, []);

  const createLead = useCallback(
    (data: Omit<Lead, 'id' | 'createdAt' | 'history'>) => {
      const fields: string[] = [];
      if (data.checkIn) fields.push(`check-in ${formatDate(data.checkIn)}`);
      if (data.guests) fields.push(`${data.guests} hóspede${data.guests > 1 ? 's' : ''}`);
      if (data.occasion) fields.push(data.occasion);
      const detailNote = fields.length > 0 ? ` · ${fields.join(', ')}` : '';

      const newLead: Lead = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
        stage: 'novo_contato',
        services: data.services || [],
        history: [
          {
            id: generateId(),
            date: new Date().toISOString(),
            action: `Lead criado${detailNote}`,
            attendant: data.attendant || 'Sistema',
          },
        ],
      };
      persist([newLead, ...leads]);
      return newLead;
    },
    [leads, persist]
  );

  const updateLead = useCallback(
    (id: string, changes: Partial<Lead>, historyNote?: string, attendant?: string) => {
      const updated = leads.map((l) => {
        if (l.id !== id) return l;
        const note = historyNote ?? buildEditNote(l, changes);
        const newHistory: HistoryEntry[] = [
          ...l.history,
          {
            id: generateId(),
            date: new Date().toISOString(),
            action: note,
            attendant: attendant || changes.attendant || l.attendant || 'Sistema',
          },
        ];
        return { ...l, ...changes, lastInteraction: new Date().toISOString(), history: newHistory };
      });
      persist(updated);
    },
    [leads, persist]
  );

  const changeStage = useCallback(
    (id: string, stage: LeadStage, attendant: string, note?: string) => {
      const label: Record<LeadStage, string> = {
        novo_contato: 'Etapa alterada para Novo Contato',
        orcamento_enviado: 'Orçamento enviado ao cliente',
        negociacao: 'Em negociação com o cliente',
        pendente_followup: 'Aguardando retorno do cliente',
        confirmado: 'Reserva confirmada! 🎉',
        declinado: 'Lead marcado como declinado',
      };
      updateLead(id, { stage }, note || label[stage], attendant);
    },
    [updateLead]
  );

  const deleteLead = useCallback(
    (id: string) => {
      persist(leads.filter((l) => l.id !== id));
    },
    [leads, persist]
  );

  const markFollowupDone = useCallback(
    (id: string, attendant: string) => {
      updateLead(id, { followupDone: true }, 'Follow-up realizado ✓', attendant);
    },
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

  return {
    leads,
    createLead,
    updateLead,
    changeStage,
    deleteLead,
    markFollowupDone,
    getOverdueFollowups,
  };
}

// Testes do CRM de leads contra o Postgres real. O que importa verificar aqui
// e o que nao da para garantir em JS: o UNIQUE de legacy_id (importacao
// idempotente), datas vazias virando null e servicos indo como text[].
//
// A RLS de leads nao tem politica de DELETE, entao a limpeza arquiva em vez de
// apagar — mesma escolha do botao do CRM.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabase } from '../supabase';
import {
  arquivarLead,
  atualizarLead,
  criarLead,
  importarDoLocalStorage,
  leadsNoLocalStorage,
  listarLeads,
} from '../leads';
import type { Lead } from '../../types/lead';

const SELO = `teste_${Date.now()}`;
const leadsCriados: string[] = [];

/** O ambiente dos testes e node: o localStorage da importacao precisa de stub. */
function stubLocalStorage(leads: Lead[]): void {
  const dados = new Map<string, string>([['villa_bichinho_leads', JSON.stringify(leads)]]);
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    removeItem: (chave: string) => void dados.delete(chave),
    clear: () => dados.clear(),
    key: () => null,
    length: dados.size,
  };
}

const LEAD_LOCAL: Lead = {
  id: `lead_${SELO}`,
  name: `Importado ${SELO}`,
  phone: '11988887777',
  email: 'importado@example.com',
  createdAt: '2026-05-02T12:00:00.000Z',
  stage: 'negociacao',
  checkIn: '2026-09-10',
  checkOut: '2026-09-13',
  guests: 3,
  accommodation: 'Chalé Deluxe',
  occasion: 'Aniversário',
  budget: 4200.5,
  lookingFor: 'Sossego e boa comida',
  services: ['Spa & Massagem', 'Transfer'],
  attendant: 'Layla',
  lastMessage: 'Vou confirmar com meu marido',
  lastInteraction: '2026-05-04T18:30:00.000Z',
  notes: 'Indicada pela Dona Ana',
  // Datas vazias: o Postgres recusa '' em coluna date.
  declineDate: '',
  followupDate: '',
  followupDone: false,
  history: [
    {
      id: 'h1',
      date: '2026-05-02T12:00:00.000Z',
      action: 'Lead criado',
      attendant: 'Layla',
    },
    {
      id: 'h2',
      date: '2026-05-04T18:30:00.000Z',
      action: 'Orçamento enviado',
      attendant: 'Layla',
      note: 'Pacote de 3 noites',
    },
  ],
};

beforeAll(async () => {
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.TEST_USER_EMAIL ?? '',
    password: process.env.TEST_USER_PASSWORD ?? '',
  });
  if (error) throw new Error(`Falha no login de teste: ${error.message}`);
  stubLocalStorage([LEAD_LOCAL]);
});

afterAll(async () => {
  for (const id of leadsCriados) {
    await supabase.from('leads').update({ arquivado: true }).eq('id', id);
  }
});

describe('importacao do localStorage', () => {
  it('le a chave villa_bichinho_leads', () => {
    expect(leadsNoLocalStorage()).toBe(1);
  });

  it('importa o lead e o historico dele', async () => {
    const r = await importarDoLocalStorage();
    expect(r.encontrados).toBe(1);
    expect(r.importados).toBe(1);
    expect(r.jaExistiam).toBe(0);
    expect(r.historicoImportado).toBe(2);

    const { data } = await supabase.from('leads').select('id').eq('legacy_id', LEAD_LOCAL.id);
    expect(data).toHaveLength(1);
    leadsCriados.push(data![0].id);
  });

  it('rodar de novo nao duplica nada', async () => {
    const r = await importarDoLocalStorage();
    expect(r.importados).toBe(0);
    expect(r.jaExistiam).toBe(1);

    const { data } = await supabase.from('leads').select('id').eq('legacy_id', LEAD_LOCAL.id);
    expect(data).toHaveLength(1);
  });

  it('mapeia os campos do localStorage para as colunas', async () => {
    const lead = (await listarLeads()).find((l) => l.name === LEAD_LOCAL.name);
    expect(lead).toBeDefined();
    expect(lead!.stage).toBe('negociacao');
    expect(lead!.checkIn).toBe('2026-09-10');
    expect(lead!.guests).toBe(3);
    // numeric(12,2) volta como string do postgrest; a camada converte.
    expect(lead!.budget).toBe(4200.5);
    expect(lead!.services).toEqual(['Spa & Massagem', 'Transfer']);
    // Datas vazias viraram null, nao string vazia.
    expect(lead!.followupDate).toBeUndefined();
    expect(lead!.declineDate).toBeUndefined();
    expect(lead!.history).toHaveLength(2);
    expect(lead!.history[1].note).toBe('Pacote de 3 noites');
  });
});

describe('CRUD no Postgres', () => {
  it('cria, atualiza com historico e arquiva', async () => {
    const novo = await criarLead(
      {
        name: `Novo ${SELO}`,
        phone: '11977776666',
        stage: 'novo_contato',
        services: [],
        attendant: 'Wilian',
        checkIn: '',
        followupDone: false,
      },
      'Lead criado pelo teste'
    );
    leadsCriados.push(novo.id);

    expect(novo.stage).toBe('novo_contato');
    expect(novo.checkIn).toBeUndefined();
    expect(novo.history).toHaveLength(1);

    const atualizado = await atualizarLead(
      novo.id,
      { stage: 'confirmado', budget: 1800 },
      'Reserva confirmada! 🎉',
      'Wilian'
    );
    expect(atualizado.stage).toBe('confirmado');
    expect(atualizado.budget).toBe(1800);
    expect(atualizado.history).toHaveLength(2);
    expect(atualizado.history[1].action).toContain('confirmada');
    expect(atualizado.lastInteraction).toBeTruthy();

    await arquivarLead(novo.id, 'Wilian');
    const ativos = await listarLeads();
    expect(ativos.some((l) => l.id === novo.id)).toBe(false);

    // A linha continua no banco: reservas.lead_id aponta para ela.
    const { data } = await supabase.from('leads').select('arquivado').eq('id', novo.id).single();
    expect(data!.arquivado).toBe(true);
  });
});

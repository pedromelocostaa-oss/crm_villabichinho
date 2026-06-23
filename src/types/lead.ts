export type LeadStage =
  | 'novo_contato'
  | 'orcamento_enviado'
  | 'negociacao'
  | 'pendente_followup'
  | 'confirmado'
  | 'declinado';

export type FollowupType =
  | 'enviar_orcamento'
  | 'responder_duvida'
  | 'confirmar_disponibilidade'
  | 'enviar_fotos'
  | 'negociar_preco'
  | 'confirmar_reserva';

export type RecusaMotivo =
  | 'data_indisponivel'
  | 'preco_alto'
  | 'outro_local'
  | 'sem_servico'
  | 'sem_interesse'
  | 'outro';

export interface HistoryEntry {
  id: string;
  date: string;
  action: string;
  attendant: string;
  note?: string;
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  createdAt: string;

  stage: LeadStage;

  checkIn?: string;
  checkOut?: string;
  guests?: number;
  accommodation?: string;
  occasion?: string;
  budget?: number;

  lookingFor?: string;
  services: string[];

  attendant?: string;
  lastMessage?: string;
  lastInteraction?: string;
  notes?: string;

  declineReason?: RecusaMotivo;
  declineReasonOther?: string;
  declineDate?: string;
  declineNotes?: string;

  followupDate?: string;
  followupType?: FollowupType;
  followupDone?: boolean;

  history: HistoryEntry[];
}

export const STAGE_LABELS: Record<LeadStage, string> = {
  novo_contato: 'Novo Contato',
  orcamento_enviado: 'Orçamento Enviado',
  negociacao: 'Em Negociação',
  pendente_followup: 'Pendente Follow-up',
  confirmado: 'Reserva Confirmada',
  declinado: 'Declinado',
};

export const STAGE_COLORS: Record<LeadStage, string> = {
  novo_contato: 'bg-green-100 text-green-800 border-green-200',
  orcamento_enviado: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  negociacao: 'bg-orange-100 text-orange-800 border-orange-200',
  pendente_followup: 'bg-blue-100 text-blue-800 border-blue-200',
  confirmado: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  declinado: 'bg-red-100 text-red-800 border-red-200',
};

export const STAGE_DOT_COLORS: Record<LeadStage, string> = {
  novo_contato: 'bg-green-500',
  orcamento_enviado: 'bg-yellow-500',
  negociacao: 'bg-orange-500',
  pendente_followup: 'bg-blue-500',
  confirmado: 'bg-emerald-500',
  declinado: 'bg-red-500',
};

export const FOLLOWUP_LABELS: Record<FollowupType, string> = {
  enviar_orcamento: 'Enviar Orçamento',
  responder_duvida: 'Responder Dúvida',
  confirmar_disponibilidade: 'Confirmar Disponibilidade',
  enviar_fotos: 'Enviar Fotos/Vídeo',
  negociar_preco: 'Negociar Preço',
  confirmar_reserva: 'Confirmar Reserva',
};

export const RECUSA_LABELS: Record<RecusaMotivo, string> = {
  data_indisponivel: 'Data não disponível',
  preco_alto: 'Preço muito alto',
  outro_local: 'Optou por outro local',
  sem_servico: 'Falta de serviço específico',
  sem_interesse: 'Sem interesse',
  outro: 'Outro',
};

export const SERVICES_LIST = [
  'Spa & Massagem',
  'Passeios e Trilhas',
  'Eventos e Celebrações',
  'Gastronomia Especial',
  'Área Pet-Friendly',
  'Piscina Privativa',
  'Transfer',
  'Decoração Especial',
  'Café da Manhã na Cama',
  'Vinho & Charcuterie',
];

export const ATTENDANTS = ['Layla', 'Wilian', 'Leonardo', 'XXX'];

export const ACCOMMODATION_OPTIONS = [
  'Chalé Standard',
  'Chalé Deluxe',
  'Chalé Luxo com Piscina',
  'Suite Master',
  'Casa Completa',
];

export const OCCASION_OPTIONS = [
  'Lua de Mel',
  'Aniversário',
  'Férias em Família',
  'Retiro/Descanso',
  'Evento Corporativo',
  'Casamento',
  'Outro',
];

export const STAGE_ORDER: LeadStage[] = [
  'novo_contato',
  'orcamento_enviado',
  'negociacao',
  'pendente_followup',
  'confirmado',
  'declinado',
];

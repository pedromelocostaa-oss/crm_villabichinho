import { useState } from 'react';
import {
  X, Phone, Mail, Calendar, Users, MapPin, DollarSign,
  Clock, MessageSquare, CheckCircle2, AlertTriangle, Edit3,
  ChevronRight, Archive, Copy, Check, ChevronDown, ChevronUp,
} from 'lucide-react';
import type { Lead, LeadStage, FollowupType, RecusaMotivo } from '../types/lead';
import {
  STAGE_LABELS, FOLLOWUP_LABELS, RECUSA_LABELS, ATTENDANTS,
  SERVICES_LIST, ACCOMMODATION_OPTIONS, OCCASION_OPTIONS, STAGE_ORDER,
} from '../types/lead';
import { formatDate, formatDateTime, formatPhone, currencyBRL, todayISO } from '../utils/storage';
import { StageBadge } from './StageBadge';

interface Props {
  lead: Lead;
  onClose: () => void;
  onUpdate: (id: string, changes: Partial<Lead>, historyNote?: string, attendant?: string) => void;
  onDelete: (id: string) => void;
  onChangeStage: (id: string, stage: LeadStage, attendant: string, note?: string) => void;
  onMarkFollowupDone: (id: string, attendant: string) => void;
}

type Tab = 'overview' | 'details';

export function LeadModal({ lead, onClose, onUpdate, onDelete, onChangeStage, onMarkFollowupDone }: Props) {
  const [tab, setTab] = useState<Tab>('overview');
  const [editing, setEditing] = useState(false);
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [showFollowupForm, setShowFollowupForm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const [editData, setEditData] = useState({ ...lead });
  const [declineReason, setDeclineReason] = useState<RecusaMotivo>('outro');
  const [declineReasonOther, setDeclineReasonOther] = useState('');
  const [declineNotes, setDeclineNotes] = useState('');
  const [followupDate, setFollowupDate] = useState(lead.followupDate || '');
  const [followupType, setFollowupType] = useState<FollowupType>(lead.followupType || 'enviar_orcamento');
  const [currentAttendant, setCurrentAttendant] = useState(lead.attendant || ATTENDANTS[0]);

  const nextStage = STAGE_ORDER[STAGE_ORDER.indexOf(lead.stage) + 1];

  const handleSaveEdit = () => {
    onUpdate(lead.id, editData, undefined, currentAttendant);
    setEditing(false);
  };

  const handleDecline = () => {
    onUpdate(
      lead.id,
      { stage: 'declinado', declineReason, declineReasonOther, declineDate: todayISO(), declineNotes },
      `Lead declinado: ${RECUSA_LABELS[declineReason]}${declineReasonOther ? ` — ${declineReasonOther}` : ''}`,
      currentAttendant,
    );
    setShowDeclineForm(false);
  };

  const handleSaveFollowup = () => {
    onUpdate(
      lead.id,
      { followupDate, followupType, followupDone: false },
      `Follow-up agendado para ${formatDate(followupDate)}: ${FOLLOWUP_LABELS[followupType]}`,
      currentAttendant,
    );
    setShowFollowupForm(false);
  };

  const handleConfirm = () => onChangeStage(lead.id, 'confirmado', currentAttendant, 'Reserva confirmada! 🎉');
  const handleAdvanceStage = () => { if (nextStage) onChangeStage(lead.id, nextStage, currentAttendant); };

  const whatsappTemplate = `Olá ${lead.name}! 😊\n\nSomos da Villa Bichinho Pousada Boutique.\n${lead.checkIn ? `\nEstamos ansiosos para receber vocês em ${formatDate(lead.checkIn)}!` : ''}${lead.occasion ? `\n\nTemos um pacote especial para ${lead.occasion} que tenho certeza que vão adorar!` : ''}\n\nPosso te enviar mais detalhes?`;

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(whatsappTemplate);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[90vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">

        {/* Header */}
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <span className="text-emerald-700 font-bold text-sm">{lead.name.charAt(0).toUpperCase()}</span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900">{lead.name}</h2>
              <StageBadge stage={lead.stage} size="sm" />
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 mt-1"><X size={20} /></button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 flex-shrink-0">
          {(['overview', 'details'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setEditing(false); }}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
                tab === t ? 'text-emerald-600 border-b-2 border-emerald-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'overview' ? 'Visão Geral' : 'Detalhes'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-5">
          {tab === 'overview' && !editing && (
            <div className="space-y-5">
              {/* Contato + datas */}
              <div className="grid grid-cols-2 gap-3">
                <InfoItem icon={Phone} label="WhatsApp" value={formatPhone(lead.phone)} />
                <InfoItem icon={Mail} label="Email" value={lead.email || '—'} />
                <InfoItem icon={Calendar} label="Check-in" value={lead.checkIn ? formatDate(lead.checkIn) : '—'} />
                <InfoItem icon={Calendar} label="Check-out" value={lead.checkOut ? formatDate(lead.checkOut) : '—'} />
                <InfoItem icon={Users} label="Hóspedes" value={lead.guests?.toString() || '—'} />
                <InfoItem icon={DollarSign} label="Orçamento" value={currencyBRL(lead.budget)} />
                <InfoItem icon={MapPin} label="Acomodação" value={lead.accommodation || '—'} />
                <InfoItem icon={MessageSquare} label="Ocasião" value={lead.occasion || '—'} />
              </div>

              {lead.lookingFor && (
                <div className="bg-blue-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-1">O que procura</p>
                  <p className="text-sm text-blue-900">{lead.lookingFor}</p>
                </div>
              )}

              {lead.services.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 mb-2">Serviços de Interesse</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.services.map((s) => (
                      <span key={s} className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-100">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Atendente</p>
                  <p className="text-sm font-medium text-gray-900">{lead.attendant || '—'}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-3">
                  <p className="text-xs font-semibold text-gray-500 mb-1">Criado em</p>
                  <p className="text-sm font-medium text-gray-900">{new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              {(lead.followupDate || lead.followupType) && (
                <div className={`rounded-xl p-3 border ${lead.followupDone ? 'bg-emerald-50 border-emerald-100' : 'bg-orange-50 border-orange-100'}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className={`text-xs font-semibold mb-1 ${lead.followupDone ? 'text-emerald-700' : 'text-orange-700'}`}>
                        {lead.followupDone ? '✓ Follow-up realizado' : '⏳ Próximo Follow-up'}
                      </p>
                      {lead.followupDate && <p className="text-sm font-medium text-gray-900">{formatDate(lead.followupDate)}</p>}
                      {lead.followupType && <p className="text-xs text-gray-600 mt-0.5">{FOLLOWUP_LABELS[lead.followupType]}</p>}
                    </div>
                    {!lead.followupDone && (
                      <button
                        onClick={() => onMarkFollowupDone(lead.id, currentAttendant)}
                        className="text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        Marcar feito
                      </button>
                    )}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div className="bg-yellow-50 rounded-xl p-3 border border-yellow-100">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">Anotações</p>
                  <p className="text-sm text-yellow-900">{lead.notes}</p>
                </div>
              )}

              {lead.stage === 'declinado' && lead.declineReason && (
                <div className="bg-red-50 rounded-xl p-3 border border-red-100">
                  <p className="text-xs font-semibold text-red-700 mb-1">Motivo da Recusa</p>
                  <p className="text-sm text-red-900">
                    {RECUSA_LABELS[lead.declineReason]}
                    {lead.declineReasonOther && ` — ${lead.declineReasonOther}`}
                  </p>
                  {lead.declineNotes && <p className="text-xs text-red-700 mt-1">{lead.declineNotes}</p>}
                </div>
              )}

              {/* Template WhatsApp */}
              <div className="bg-gray-50 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-500">Template WhatsApp</p>
                  <button onClick={copyWhatsApp} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
                <p className="text-xs text-gray-600 whitespace-pre-line">{whatsappTemplate}</p>
              </div>

              {/* ── Histórico colapsável ── */}
              <div className="border-t border-gray-100 pt-3 mt-1">
                <button
                  type="button"
                  onClick={() => setHistoryOpen((v) => !v)}
                  className="w-full flex items-center justify-between group"
                >
                  <div className={`transition-opacity ${historyOpen ? 'opacity-70' : 'opacity-40 group-hover:opacity-60'}`}>
                    <span className="text-xs font-medium text-gray-500">
                      Histórico · {lead.history.length} evento{lead.history.length !== 1 ? 's' : ''}
                    </span>
                    {!historyOpen && lead.history.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 text-left truncate max-w-xs">
                        Último: {lead.history[lead.history.length - 1].action}
                      </p>
                    )}
                  </div>
                  <span className={`transition-opacity text-gray-400 ${historyOpen ? 'opacity-70' : 'opacity-40 group-hover:opacity-60'}`}>
                    {historyOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </button>

                {historyOpen && (
                  <div className="mt-4 space-y-0">
                    {[...lead.history].reverse().map((entry, idx) => (
                      <div key={entry.id} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${idx === 0 ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                          {idx < lead.history.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1 mb-0" />}
                        </div>
                        <div className="pb-4 flex-1 min-w-0">
                          <p className="text-xs text-gray-400">{formatDateTime(entry.date)}</p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5">{entry.action}</p>
                          {entry.note && <p className="text-xs text-gray-500 mt-0.5">{entry.note}</p>}
                          <p className="text-xs text-emerald-600 mt-0.5">por {entry.attendant}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'overview' && editing && (
            <EditForm
              data={editData}
              onChange={setEditData}
              currentAttendant={currentAttendant}
              onAttendantChange={setCurrentAttendant}
              onSave={handleSaveEdit}
              onCancel={() => setEditing(false)}
            />
          )}

          {tab === 'details' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dados Completos</p>
              <div className="space-y-0">
                {[
                  { label: 'Nome completo', value: lead.name },
                  { label: 'Telefone/WhatsApp', value: formatPhone(lead.phone) },
                  { label: 'Email', value: lead.email || '—' },
                  { label: 'Data de contato', value: new Date(lead.createdAt).toLocaleDateString('pt-BR') },
                  { label: 'Check-in desejado', value: lead.checkIn ? formatDate(lead.checkIn) : '—' },
                  { label: 'Check-out desejado', value: lead.checkOut ? formatDate(lead.checkOut) : '—' },
                  { label: 'Número de hóspedes', value: lead.guests?.toString() || '—' },
                  { label: 'Tipo de acomodação', value: lead.accommodation || '—' },
                  { label: 'Ocasião', value: lead.occasion || '—' },
                  { label: 'Orçamento mencionado', value: currencyBRL(lead.budget) },
                  { label: 'O que procura', value: lead.lookingFor || '—' },
                  { label: 'Atendente responsável', value: lead.attendant || '—' },
                  { label: 'Última interação', value: lead.lastInteraction ? formatDateTime(lead.lastInteraction) : '—' },
                  { label: 'Última mensagem', value: lead.lastMessage || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-medium text-gray-900 text-right max-w-[55%]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {!editing && (
          <div className="border-t border-gray-100 p-4 flex-shrink-0">
            {showDeclineForm ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Marcar como Declinado</p>
                <select value={declineReason} onChange={(e) => setDeclineReason(e.target.value as RecusaMotivo)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 bg-white">
                  {(Object.keys(RECUSA_LABELS) as RecusaMotivo[]).map((r) => <option key={r} value={r}>{RECUSA_LABELS[r]}</option>)}
                </select>
                {declineReason === 'outro' && (
                  <input value={declineReasonOther} onChange={(e) => setDeclineReasonOther(e.target.value)} placeholder="Descreva o motivo..." className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                )}
                <textarea value={declineNotes} onChange={(e) => setDeclineNotes(e.target.value)} placeholder="Observações (pode tentar na baixa temporada?)" rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => setShowDeclineForm(false)} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
                  <button onClick={handleDecline} className="flex-1 py-2 text-sm text-white bg-red-500 rounded-lg hover:bg-red-600">Confirmar Declínio</button>
                </div>
              </div>
            ) : showFollowupForm ? (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-gray-900">Agendar Follow-up</p>
                <input type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} min={todayISO()} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <select value={followupType} onChange={(e) => setFollowupType(e.target.value as FollowupType)} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                  {(Object.keys(FOLLOWUP_LABELS) as FollowupType[]).map((f) => <option key={f} value={f}>{FOLLOWUP_LABELS[f]}</option>)}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => setShowFollowupForm(false)} className="flex-1 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
                  <button onClick={handleSaveFollowup} disabled={!followupDate} className="flex-1 py-2 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">Salvar</button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <select value={currentAttendant} onChange={(e) => setCurrentAttendant(e.target.value)} className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
                    {ATTENDANTS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  <button onClick={() => setEditing(true)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors" title="Editar">
                    <Edit3 size={16} />
                  </button>
                  <button onClick={() => { if (confirm(`Arquivar o lead "${lead.name}"? Ele sai da listagem, mas o histórico fica no banco.`)) { onDelete(lead.id); onClose(); } }} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Arquivar">
                    <Archive size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setShowFollowupForm(true)} className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                    <Clock size={14} />Agendar Follow-up
                  </button>
                  {lead.stage !== 'confirmado' && lead.stage !== 'declinado' && (
                    <button onClick={() => setShowDeclineForm(true)} className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                      <AlertTriangle size={14} />Marcar Declinado
                    </button>
                  )}
                  {lead.stage !== 'confirmado' && lead.stage !== 'declinado' && (
                    <button onClick={handleConfirm} className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors">
                      <CheckCircle2 size={14} />Confirmar Reserva
                    </button>
                  )}
                  {nextStage && nextStage !== 'confirmado' && nextStage !== 'declinado' && (
                    <button onClick={handleAdvanceStage} className="flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors">
                      <ChevronRight size={14} />{STAGE_LABELS[nextStage]}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon size={12} className="text-gray-400" />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}

function EditForm({ data, onChange, currentAttendant, onAttendantChange, onSave, onCancel }: {
  data: Lead;
  onChange: (d: Lead) => void;
  currentAttendant: string;
  onAttendantChange: (a: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const set = (key: keyof Lead) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const val = e.target.type === 'number' ? (e.target.value ? Number(e.target.value) : undefined) : (e.target.value || undefined);
    onChange({ ...data, [key]: val });
  };

  const toggleService = (s: string) => {
    const services = data.services.includes(s) ? data.services.filter((x) => x !== s) : [...data.services, s];
    onChange({ ...data, services });
  };

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-900">Editar Lead</p>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Contato</p>
        {[
          { key: 'name', label: 'Nome', type: 'text' },
          { key: 'phone', label: 'WhatsApp', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
        ].map(({ key, label, type }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <input type={type} value={(data[key as keyof Lead] as string) || ''} onChange={set(key as keyof Lead)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Atendente</label>
          <select value={currentAttendant} onChange={(e) => onAttendantChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
            {ATTENDANTS.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Reserva</p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'checkIn', label: 'Check-in', type: 'date' },
            { key: 'checkOut', label: 'Check-out', type: 'date' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type} value={(data[key as keyof Lead] as string) || ''} onChange={set(key as keyof Lead)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Hóspedes</label>
            <input type="number" min="1" value={(data.guests as number) || ''} onChange={set('guests')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Orçamento (R$)</label>
            <input type="number" value={(data.budget as number) || ''} onChange={set('budget')} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        {[
          { key: 'accommodation', label: 'Acomodação', opts: ACCOMMODATION_OPTIONS },
          { key: 'occasion', label: 'Ocasião', opts: OCCASION_OPTIONS },
        ].map(({ key, label, opts }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
            <select value={(data[key as keyof Lead] as string) || ''} onChange={set(key as keyof Lead)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white">
              <option value="">Selecionar...</option>
              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Preferências</p>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">O que procura</label>
          <textarea value={data.lookingFor || ''} onChange={set('lookingFor')} rows={2} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">Serviços de Interesse</label>
          <div className="flex flex-wrap gap-2">
            {SERVICES_LIST.map((s) => (
              <button key={s} type="button" onClick={() => toggleService(s)} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${data.services.includes(s) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Anotações</label>
          <textarea value={data.notes || ''} onChange={set('notes')} rows={3} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Cancelar</button>
        <button onClick={onSave} className="flex-1 py-2.5 text-sm text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors">Salvar</button>
      </div>
    </div>
  );
}

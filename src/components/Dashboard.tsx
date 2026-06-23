import { AlertTriangle, Users, TrendingUp, CheckCircle2, Clock, Plus, ChevronRight } from 'lucide-react';
import type { Lead } from '../types/lead';
import { STAGE_LABELS, STAGE_DOT_COLORS } from '../types/lead';
import { formatDate, isOverdue, isToday, todayISO } from '../utils/storage';
import { StageBadge } from './StageBadge';

interface Props {
  leads: Lead[];
  onNewLead: () => void;
  onSelectLead: (lead: Lead) => void;
}

export function Dashboard({ leads, onNewLead, onSelectLead }: Props) {
  const total = leads.filter((l) => l.stage !== 'declinado').length;
  const inNegotiation = leads.filter((l) => l.stage === 'negociacao').length;
  const confirmed = leads.filter(
    (l) =>
      l.stage === 'confirmado' &&
      l.createdAt >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  ).length;
  const pendingFollowup = leads.filter(
    (l) => l.followupDate && !l.followupDone && l.stage !== 'confirmado' && l.stage !== 'declinado'
  ).length;
  const conversionRate =
    total > 0
      ? ((leads.filter((l) => l.stage === 'confirmado').length / leads.length) * 100).toFixed(1)
      : '0.0';

  const today = todayISO();
  const urgentLeads = leads.filter(
    (l) =>
      l.followupDate &&
      l.followupDate <= today &&
      !l.followupDone &&
      l.stage !== 'confirmado' &&
      l.stage !== 'declinado'
  );

  const stages = ['novo_contato', 'orcamento_enviado', 'negociacao', 'pendente_followup', 'confirmado'] as const;
  const pipelineByStage = stages.map((s) => ({
    stage: s,
    leads: leads.filter((l) => l.stage === s),
  }));

  return (
    <div className="space-y-4 sm:space-y-6">

      {/* ── Urgentes ── */}
      {urgentLeads.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="text-red-600 flex-shrink-0" size={16} />
            <h3 className="font-semibold text-red-800 text-sm">
              {urgentLeads.length} lead{urgentLeads.length > 1 ? 's' : ''} aguardando ação
            </h3>
          </div>
          <div className="space-y-2">
            {urgentLeads.map((lead) => (
              <button
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className="w-full flex items-center justify-between bg-white rounded-xl p-3 active:bg-red-50 transition-colors border border-red-100 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-red-700 font-bold text-sm">{lead.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm truncate">{lead.name}</p>
                    <p className="text-xs text-red-600">
                      {isOverdue(lead.followupDate) ? `⚠ Vencido (${formatDate(lead.followupDate!)})` : 'Follow-up hoje'}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} className="text-red-400 flex-shrink-0 ml-2" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        {[
          { label: 'Total', value: total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Negociação', value: inNegotiation, icon: TrendingUp, color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Follow-up', value: pendingFollowup, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
          { label: 'Confirmados', value: confirmed, icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Conversão', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-purple-600', bg: 'bg-purple-50' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-3 sm:p-4 shadow-sm">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2 sm:mb-3`}>
              <Icon className={color} size={16} />
            </div>
            <p className="text-xl sm:text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* ── Pipeline ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900 text-sm">Pipeline</h2>
          {/* Desktop "Novo Lead" button */}
          <button
            onClick={onNewLead}
            className="hidden sm:flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Novo Lead
          </button>
        </div>

        {/* Pipeline horizontal scroll on mobile */}
        <div className="overflow-x-auto pipeline-scroll -mx-3 sm:mx-0 px-3 sm:px-0 pb-2">
          <div className="flex sm:grid sm:grid-cols-5 gap-3 sm:gap-3 w-max sm:w-auto">
            {pipelineByStage.map(({ stage, leads: stageLeads }) => (
              <div
                key={stage}
                className="bg-gray-50 rounded-xl p-3 border border-gray-100 w-52 sm:w-auto flex-shrink-0 sm:flex-shrink"
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STAGE_DOT_COLORS[stage]}`} />
                  <span className="text-xs font-semibold text-gray-700 truncate">{STAGE_LABELS[stage]}</span>
                  <span className="ml-auto text-xs font-bold text-gray-400 flex-shrink-0">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.slice(0, 3).map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className="w-full bg-white rounded-lg p-2.5 active:bg-emerald-50 transition-colors border border-gray-100 text-left"
                    >
                      <p className="text-xs font-semibold text-gray-900 truncate">{lead.name}</p>
                      {lead.checkIn && (
                        <p className="text-xs text-gray-400 mt-0.5">{formatDate(lead.checkIn)}</p>
                      )}
                      {lead.followupDate && !lead.followupDone && (
                        <div className={`flex items-center gap-1 mt-1 text-xs ${isOverdue(lead.followupDate) ? 'text-red-500' : 'text-blue-500'}`}>
                          <Clock size={10} />
                          <span>{formatDate(lead.followupDate)}</span>
                        </div>
                      )}
                    </button>
                  ))}
                  {stageLeads.length > 3 && (
                    <p className="text-xs text-gray-400 text-center py-1">+{stageLeads.length - 3} mais</p>
                  )}
                  {stageLeads.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-3">Vazio</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Leads ativos ── */}
      <div>
        <h2 className="font-semibold text-gray-900 text-sm mb-3">Leads para acompanhar</h2>

        {/* Mobile: card list */}
        <div className="sm:hidden space-y-2">
          {leads
            .filter((l) => l.stage !== 'confirmado' && l.stage !== 'declinado')
            .sort((a, b) => (a.followupDate || '').localeCompare(b.followupDate || ''))
            .slice(0, 8)
            .map((lead) => (
              <LeadCard key={lead.id} lead={lead} onSelect={onSelectLead} />
            ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Nome</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Etapa</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Check-in</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Atendente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</th>
                </tr>
              </thead>
              <tbody>
                {leads
                  .filter((l) => l.stage !== 'confirmado' && l.stage !== 'declinado')
                  .sort((a, b) => (a.followupDate || '').localeCompare(b.followupDate || ''))
                  .slice(0, 8)
                  .map((lead, idx) => (
                    <tr
                      key={lead.id}
                      onClick={() => onSelectLead(lead)}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-gray-50/50'}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-emerald-700 font-bold text-xs">{lead.name.charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{lead.name}</p>
                            <p className="text-xs text-gray-400">{lead.phone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3"><StageBadge stage={lead.stage} size="sm" /></td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{lead.checkIn ? formatDate(lead.checkIn) : '—'}</td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{lead.attendant || '—'}</td>
                      <td className="px-4 py-3">
                        {lead.followupDate && !lead.followupDone ? (
                          <span className={`text-xs font-medium ${isOverdue(lead.followupDate) ? 'text-red-600' : isToday(lead.followupDate) ? 'text-orange-600' : 'text-blue-600'}`}>
                            {isOverdue(lead.followupDate) ? '⚠ ' : ''}{formatDate(lead.followupDate)}
                          </span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function LeadCard({ lead, onSelect }: { lead: Lead; onSelect: (l: Lead) => void }) {
  return (
    <button
      onClick={() => onSelect(lead)}
      className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left active:bg-gray-50 transition-colors shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-700 font-bold text-sm">{lead.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
            <p className="text-xs text-gray-400">{lead.phone}</p>
          </div>
        </div>
        <StageBadge stage={lead.stage} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
        {lead.checkIn && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-gray-400">📅</span> {formatDate(lead.checkIn)}
            {lead.checkOut && ` → ${formatDate(lead.checkOut)}`}
          </span>
        )}
        {lead.guests && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-gray-400">👥</span> {lead.guests} hóspede{lead.guests > 1 ? 's' : ''}
          </span>
        )}
        {lead.attendant && (
          <span className="text-xs text-gray-500 flex items-center gap-1">
            <span className="text-gray-400">👤</span> {lead.attendant}
          </span>
        )}
      </div>

      {lead.followupDate && !lead.followupDone && (
        <div className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${isOverdue(lead.followupDate) ? 'text-red-600' : isToday(lead.followupDate) ? 'text-orange-600' : 'text-blue-600'}`}>
          <Clock size={11} />
          Follow-up: {isOverdue(lead.followupDate) ? '⚠ vencido — ' : isToday(lead.followupDate) ? 'hoje — ' : ''}{formatDate(lead.followupDate)}
        </div>
      )}
    </button>
  );
}

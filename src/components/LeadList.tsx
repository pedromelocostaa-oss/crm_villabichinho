import { useState } from 'react';
import { Search, ChevronUp, ChevronDown, Clock, SlidersHorizontal, X } from 'lucide-react';
import type { Lead, LeadStage } from '../types/lead';
import { STAGE_LABELS, ATTENDANTS } from '../types/lead';
import { formatDate, formatPhone, isOverdue, isToday } from '../utils/storage';
import { StageBadge } from './StageBadge';

interface Props {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
}

type SortKey = 'name' | 'stage' | 'checkIn' | 'followupDate' | 'createdAt';

export function LeadList({ leads, onSelectLead }: Props) {
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<LeadStage | ''>('');
  const [attendantFilter, setAttendantFilter] = useState('');
  const [followupFilter, setFollowupFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortAsc, setSortAsc] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  };

  const filtered = leads
    .filter((l) => {
      if (search) {
        const q = search.toLowerCase();
        if (!l.name.toLowerCase().includes(q) && !l.phone.includes(q)) return false;
      }
      if (stageFilter && l.stage !== stageFilter) return false;
      if (attendantFilter && l.attendant !== attendantFilter) return false;
      if (followupFilter === 'pending' && (l.followupDone || !l.followupDate)) return false;
      if (followupFilter === 'done' && !l.followupDone) return false;
      return true;
    })
    .sort((a, b) => {
      const dir = sortAsc ? 1 : -1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'stage') return a.stage.localeCompare(b.stage) * dir;
      if (sortKey === 'checkIn') return (a.checkIn || '').localeCompare(b.checkIn || '') * dir;
      if (sortKey === 'followupDate') return (a.followupDate || '').localeCompare(b.followupDate || '') * dir;
      return a.createdAt.localeCompare(b.createdAt) * dir;
    });

  const activeFilters = [stageFilter, attendantFilter, followupFilter !== 'all' ? followupFilter : ''].filter(Boolean).length;

  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <ChevronDown size={12} className="opacity-30" />;

  return (
    <div className="space-y-3 sm:space-y-4">

      {/* ── Search + filter toggle ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar nome ou telefone..."
            className="w-full pl-9 pr-4 py-2.5 text-base sm:text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`relative flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl border transition-colors ${showFilters || activeFilters > 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'bg-white border-gray-200 text-gray-600'}`}
        >
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Filtros</span>
          {activeFilters > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-600 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* ── Filters panel ── */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtros</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Etapa</label>
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value as LeadStage | '')}
                className="w-full text-base sm:text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Todas</option>
                {(Object.keys(STAGE_LABELS) as LeadStage[]).map((s) => (
                  <option key={s} value={s}>{STAGE_LABELS[s]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Atendente</label>
              <select
                value={attendantFilter}
                onChange={(e) => setAttendantFilter(e.target.value)}
                className="w-full text-base sm:text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="">Todos</option>
                {ATTENDANTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up</label>
              <select
                value={followupFilter}
                onChange={(e) => setFollowupFilter(e.target.value as 'all' | 'pending' | 'done')}
                className="w-full text-base sm:text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
              >
                <option value="all">Todos</option>
                <option value="pending">Pendente</option>
                <option value="done">Concluído</option>
              </select>
            </div>
          </div>
          {activeFilters > 0 && (
            <button
              onClick={() => { setStageFilter(''); setAttendantFilter(''); setFollowupFilter('all'); }}
              className="text-xs text-red-500 hover:text-red-700"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-gray-400">
          {filtered.length} lead{filtered.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* ── Mobile: card list ── */}
      <div className="sm:hidden space-y-2">
        {filtered.map((lead) => (
          <MobileLeadCard key={lead.id} lead={lead} onSelect={onSelectLead} />
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-100">
            Nenhum lead encontrado.
          </div>
        )}
      </div>

      {/* ── Desktop: table ── */}
      <div className="hidden sm:block bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {[
                  { key: 'name' as SortKey, label: 'Nome' },
                  { key: 'stage' as SortKey, label: 'Etapa' },
                  { key: 'checkIn' as SortKey, label: 'Check-in' },
                  { key: 'followupDate' as SortKey, label: 'Follow-up' },
                ].map(({ key, label }) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer hover:text-gray-700 select-none"
                  >
                    <div className="flex items-center gap-1">{label}<SortIcon col={key} /></div>
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Atendente</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Última Interação</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((lead, idx) => (
                <tr
                  key={lead.id}
                  onClick={() => onSelectLead(lead)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-emerald-700 font-bold text-xs">{lead.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{lead.name}</p>
                        <p className="text-xs text-gray-400">{formatPhone(lead.phone)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><StageBadge stage={lead.stage} size="sm" /></td>
                  <td className="px-4 py-3 text-gray-600">{lead.checkIn ? formatDate(lead.checkIn) : '—'}</td>
                  <td className="px-4 py-3">
                    {lead.followupDate && !lead.followupDone ? (
                      <div className="flex items-center gap-1">
                        <Clock size={12} className={isOverdue(lead.followupDate) ? 'text-red-500' : isToday(lead.followupDate) ? 'text-orange-500' : 'text-blue-500'} />
                        <span className={`text-xs font-medium ${isOverdue(lead.followupDate) ? 'text-red-600' : isToday(lead.followupDate) ? 'text-orange-600' : 'text-blue-600'}`}>
                          {formatDate(lead.followupDate)}
                        </span>
                      </div>
                    ) : lead.followupDone ? (
                      <span className="text-xs text-emerald-600">✓ Feito</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 hidden md:table-cell">{lead.attendant || '—'}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden lg:table-cell">
                    {lead.lastInteraction ? new Date(lead.lastInteraction).toLocaleDateString('pt-BR') : formatDate(lead.createdAt.slice(0, 10))}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400 text-sm">
                    Nenhum lead encontrado com os filtros selecionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MobileLeadCard({ lead, onSelect }: { lead: Lead; onSelect: (l: Lead) => void }) {
  return (
    <button
      onClick={() => onSelect(lead)}
      className="w-full bg-white rounded-xl border border-gray-100 p-4 text-left active:bg-gray-50 transition-colors shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-700 font-bold">{lead.name.charAt(0).toUpperCase()}</span>
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">{lead.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{formatPhone(lead.phone)}</p>
          </div>
        </div>
        <StageBadge stage={lead.stage} size="sm" />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {lead.checkIn && (
          <span className="text-xs text-gray-500">
            📅 {formatDate(lead.checkIn)}{lead.checkOut ? ` → ${formatDate(lead.checkOut)}` : ''}
          </span>
        )}
        {lead.guests && (
          <span className="text-xs text-gray-500">👥 {lead.guests} hóspede{lead.guests > 1 ? 's' : ''}</span>
        )}
        {lead.occasion && (
          <span className="text-xs text-gray-500">🎉 {lead.occasion}</span>
        )}
        {lead.attendant && (
          <span className="text-xs text-gray-500">👤 {lead.attendant}</span>
        )}
      </div>

      {lead.followupDate && !lead.followupDone && (
        <div className={`mt-2.5 flex items-center gap-1.5 text-xs font-semibold rounded-lg px-2 py-1.5 w-fit ${
          isOverdue(lead.followupDate)
            ? 'bg-red-50 text-red-600'
            : isToday(lead.followupDate)
            ? 'bg-orange-50 text-orange-600'
            : 'bg-blue-50 text-blue-600'
        }`}>
          <Clock size={11} />
          {isOverdue(lead.followupDate) ? '⚠ Vencido — ' : isToday(lead.followupDate) ? 'Hoje — ' : 'Follow-up: '}
          {formatDate(lead.followupDate)}
        </div>
      )}
    </button>
  );
}

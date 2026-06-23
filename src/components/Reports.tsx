import {
  BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  ResponsiveContainer, CartesianGrid,
} from 'recharts';
import type { Lead } from '../types/lead';
import { RECUSA_LABELS, STAGE_LABELS } from '../types/lead';
import { ATTENDANTS } from '../types/lead';

interface Props {
  leads: Lead[];
}

const COLORS = ['#10b981', '#f59e0b', '#f97316', '#3b82f6', '#8b5cf6', '#ef4444'];

export function Reports({ leads }: Props) {
  const byMonth: Record<string, { total: number; confirmed: number }> = {};
  leads.forEach((l) => {
    const m = l.createdAt.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { total: 0, confirmed: 0 };
    byMonth[m].total++;
    if (l.stage === 'confirmado') byMonth[m].confirmed++;
  });
  const monthData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([month, data]) => ({
      month: new Date(month + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      total: data.total,
      confirmados: data.confirmed,
    }));

  const declinedLeads = leads.filter((l) => l.stage === 'declinado' && l.declineReason);
  const reasonCounts: Record<string, number> = {};
  declinedLeads.forEach((l) => {
    const r = l.declineReason!;
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });
  const reasonData = Object.entries(reasonCounts).map(([r, count]) => ({
    name: RECUSA_LABELS[r as keyof typeof RECUSA_LABELS],
    value: count,
  }));

  const attendantData = ATTENDANTS.map((a) => {
    const aLeads = leads.filter((l) => l.attendant === a);
    const confirmed = aLeads.filter((l) => l.stage === 'confirmado').length;
    return {
      name: a,
      leads: aLeads.length,
      confirmados: confirmed,
      taxa: aLeads.length > 0 ? Math.round((confirmed / aLeads.length) * 100) : 0,
    };
  }).filter((a) => a.leads > 0);

  const stageData = (Object.keys(STAGE_LABELS) as Array<keyof typeof STAGE_LABELS>).map((s) => ({
    name: STAGE_LABELS[s],
    value: leads.filter((l) => l.stage === s).length,
  })).filter((s) => s.value > 0);

  const total = leads.length;
  const confirmed = leads.filter((l) => l.stage === 'confirmado').length;
  const declined = leads.filter((l) => l.stage === 'declinado').length;
  const convRate = total > 0 ? ((confirmed / total) * 100).toFixed(1) : '0.0';

  const budgetLeads = leads.filter((l) => l.budget && l.stage === 'confirmado');
  const avgBudget = budgetLeads.length > 0
    ? budgetLeads.reduce((sum, l) => sum + (l.budget || 0), 0) / budgetLeads.length
    : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total de Leads', value: total },
          { label: 'Reservas Confirmadas', value: confirmed },
          { label: 'Taxa de Conversão', value: `${convRate}%` },
          { label: 'Ticket Médio (confirm.)', value: avgBudget ? `R$ ${Math.round(avgBudget).toLocaleString('pt-BR')}` : '—' },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-100 p-4">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-1">{label}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Leads por Mês</h3>
          {monthData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="total" name="Total" fill="#d1fae5" radius={[4, 4, 0, 0]} />
                <Bar dataKey="confirmados" name="Confirmados" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sem dados suficientes</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Motivos de Recusa</h3>
          {reasonData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={reasonData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} dataKey="value">
                    {reasonData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {reasonData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-xs text-gray-600 flex-1">{d.name}</span>
                    <span className="text-xs font-semibold text-gray-900">{d.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Nenhum lead declinado</p>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Performance por Atendente</h3>
          {attendantData.length > 0 ? (
            <div className="space-y-3">
              {attendantData
                .sort((a, b) => b.confirmados - a.confirmados)
                .map((a) => (
                <div key={a.name} className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-emerald-700 font-semibold text-xs">{a.name.charAt(0)}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">{a.name}</span>
                      <span className="text-xs text-gray-500">{a.confirmados}/{a.leads} ({a.taxa}%)</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${a.taxa}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Distribuição por Etapa</h3>
          {stageData.length > 0 ? (
            <div className="space-y-2">
              {stageData.map((s, i) => (
                <div key={s.name} className="flex items-center gap-3">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                  <span className="text-sm text-gray-600 flex-1">{s.name}</span>
                  <span className="text-sm font-semibold text-gray-900">{s.value}</span>
                  <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(s.value / total) * 100}%`,
                        backgroundColor: COLORS[i % COLORS.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Sem dados</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Resumo Geral</h3>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-3xl font-bold text-gray-900">{total}</p>
            <p className="text-xs text-gray-500">Total de Leads</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-emerald-600">{confirmed}</p>
            <p className="text-xs text-gray-500">Confirmados</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-red-500">{declined}</p>
            <p className="text-xs text-gray-500">Declinados</p>
          </div>
        </div>
      </div>
    </div>
  );
}

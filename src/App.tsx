import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  LayoutDashboard, List, BarChart2, Plus, Zap, Package, PieChart, Loader2,
} from 'lucide-react';
import type { Lead, LeadStage } from './types/lead';
import { useLeads } from './hooks/useLeads';
import { useAuth } from './hooks/useAuth';
import { Dashboard } from './components/Dashboard';
import { LeadList } from './components/LeadList';
import { LeadModal } from './components/LeadModal';
import { NewLeadModal } from './components/NewLeadModal';
import { ImportarLeads } from './components/ImportarLeads';
import { ConfirmarReservaModal } from './components/ConfirmarReservaModal';
import { Reports } from './components/Reports';
import { Login } from './components/Login';
import { LancamentoRapido } from './components/LancamentoRapido';
import { CatalogoProdutos } from './components/CatalogoProdutos';
import { Financeiro } from './components/Financeiro';

type Page = 'dashboard' | 'leads' | 'reports' | 'caixa' | 'produtos' | 'financeiro';

/** Paginas do modulo financeiro: nao levam o botao de novo lead. */
const PAGINAS_FINANCEIRAS: Page[] = ['caixa', 'produtos', 'financeiro'];

const NAV_ITEMS: { key: Page; label: string; icon: React.ElementType }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'leads', label: 'Leads', icon: List },
  { key: 'caixa', label: 'Caixa', icon: Zap },
  { key: 'financeiro', label: 'Financeiro', icon: PieChart },
  { key: 'produtos', label: 'Produtos', icon: Package },
  { key: 'reports', label: 'Relatórios', icon: BarChart2 },
];

/**
 * O CRM saiu do localStorage: leads e lead_history tem RLS para authenticated,
 * entao o app inteiro — nao so o financeiro — passa pelo login.
 */
export default function App() {
  const { session, carregando, sair } = useAuth();

  if (carregando) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6 justify-center">
            <div className="w-9 h-9 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">VB</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">Villa Bichinho</p>
              <p className="text-xs text-gray-400 leading-tight">CRM e Financeiro</p>
            </div>
          </div>
          <Login />
        </div>
      </div>
    );
  }

  return <AppAutenticado session={session} onSair={() => void sair()} />;
}

function AppAutenticado({ session, onSair }: { session: Session; onSair: () => void }) {
  const [page, setPage] = useState<Page>('dashboard');
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [leadParaReserva, setLeadParaReserva] = useState<Lead | null>(null);

  const {
    leads, carregando, erro, importar,
    createLead, updateLead, changeStage, deleteLead, markFollowupDone,
  } = useLeads();

  // Confirmar o lead e o gancho natural para a reserva nascer com origem e lead_id.
  const handleChangeStage = (id: string, stage: LeadStage, attendant: string, note?: string) => {
    void (async () => {
      await changeStage(id, stage, attendant, note);
      if (stage === 'confirmado') {
        const lead = leads.find((l) => l.id === id);
        if (lead) setLeadParaReserva({ ...lead, stage });
      }
    })();
  };

  const urgentCount = leads.filter(
    (l) =>
      l.followupDate &&
      l.followupDate <= new Date().toISOString().slice(0, 10) &&
      !l.followupDone &&
      l.stage !== 'confirmado' &&
      l.stage !== 'declinado'
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Top bar (desktop only) ─────────────────────────── */}
      <header className="hidden sm:block bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">VB</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">Villa Bichinho</p>
                <p className="text-xs text-gray-400 leading-tight">CRM de Leads</p>
              </div>
            </div>
            <nav className="flex items-center gap-1">
              {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setPage(key)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors relative ${
                    page === key
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={16} />
                  {label}
                  {key === 'dashboard' && urgentCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                      {urgentCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* ── Mobile top bar ─────────────────────────────────── */}
      <header className="sm:hidden bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">VB</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Villa Bichinho</p>
          </div>
          {urgentCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-medium bg-red-50 px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" />
              {urgentCount} pendente{urgentCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </header>

      {/* ── Main content ───────────────────────────────────── */}
      <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-24 sm:pb-6">
        <div className="flex items-center justify-between mb-4 text-xs text-gray-400">
          <span className="truncate">{session.user.email}</span>
          <button onClick={onSair} className="hover:text-gray-700 shrink-0">
            Sair
          </button>
        </div>

        {erro && !PAGINAS_FINANCEIRAS.includes(page) && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg px-3 py-2">
            {erro}
          </div>
        )}

        {/* Fica fora do bloco de carregamento: a recarga depois da importacao
            nao pode desmontar o aviso, senao o resultado dela desaparece. */}
        {(page === 'dashboard' || page === 'leads') && <ImportarLeads onImportar={importar} />}

        {carregando && !PAGINAS_FINANCEIRAS.includes(page) ? (
          <div className="py-16 flex justify-center">
            <Loader2 size={22} className="animate-spin text-emerald-600" />
          </div>
        ) : (
          <>
            {page === 'dashboard' && (
              <Dashboard
                leads={leads}
                onNewLead={() => setShowNewLead(true)}
                onSelectLead={setSelectedLead}
              />
            )}
            {page === 'leads' && <LeadList leads={leads} onSelectLead={setSelectedLead} />}
            {page === 'reports' && <Reports leads={leads} />}
          </>
        )}

        {page === 'caixa' && <LancamentoRapido />}
        {page === 'financeiro' && <Financeiro />}
        {page === 'produtos' && <CatalogoProdutos />}
      </main>

      {/* ── Mobile FAB ─────────────────────────────────────── */}
      {!PAGINAS_FINANCEIRAS.includes(page) && (
        <button
          onClick={() => setShowNewLead(true)}
          className="sm:hidden fixed bottom-20 right-4 w-14 h-14 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full shadow-lg flex items-center justify-center z-30 active:scale-95 transition-transform"
          aria-label="Novo Lead"
        >
          <Plus size={26} />
        </button>
      )}

      {/* ── Mobile bottom nav ──────────────────────────────── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 flex safe-bottom">
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setPage(key)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 relative transition-colors ${
              page === key ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <div className="relative">
              <Icon size={22} />
              {key === 'dashboard' && urgentCount > 0 && (
                <span className="absolute -top-1 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold leading-none">
                  {urgentCount}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-medium leading-tight ${page === key ? 'text-emerald-600' : 'text-gray-400'}`}>
              {label}
            </span>
            {page === key && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-emerald-500 rounded-full" />
            )}
          </button>
        ))}
      </nav>

      {/* ── Modals ─────────────────────────────────────────── */}
      {showNewLead && (
        <NewLeadModal
          onClose={() => setShowNewLead(false)}
          onCreate={(data) => void createLead(data)}
        />
      )}

      {selectedLead && (
        <LeadModal
          lead={leads.find((l) => l.id === selectedLead.id) || selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={(id, changes, note, attendant) => void updateLead(id, changes, note, attendant)}
          onDelete={(id) => { void deleteLead(id); setSelectedLead(null); }}
          onChangeStage={handleChangeStage}
          onMarkFollowupDone={(id, attendant) => void markFollowupDone(id, attendant)}
        />
      )}

      {leadParaReserva && (
        <ConfirmarReservaModal
          lead={leadParaReserva}
          onClose={() => setLeadParaReserva(null)}
          onCriada={(resumo) => void updateLead(leadParaReserva.id, {}, resumo)}
        />
      )}
    </div>
  );
}

import { useState } from 'react';
import { DashboardFinanceiro } from './DashboardFinanceiro';
import { RelatoriosFinanceiros } from './RelatoriosFinanceiros';

type Aba = 'painel' | 'relatorios';

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'painel', rotulo: 'Painel' },
  { chave: 'relatorios', rotulo: 'Relatórios' },
];

export function Financeiro() {
  const [aba, setAba] = useState<Aba>('painel');

  return (
    <div className="max-w-3xl mx-auto">
      <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 mb-4">
        {ABAS.map((a) => (
          <button
            key={a.chave}
            onClick={() => setAba(a.chave)}
            className={`text-xs font-medium px-3.5 py-1.5 rounded-md transition-colors ${
              aba === a.chave ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {aba === 'painel' ? <DashboardFinanceiro /> : <RelatoriosFinanceiros />}
    </div>
  );
}

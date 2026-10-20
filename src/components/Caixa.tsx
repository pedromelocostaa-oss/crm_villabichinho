import { useState } from 'react';
import { LancamentoRapido } from './LancamentoRapido';
import { ContaHospede } from './ContaHospede';

type Aba = 'balcao' | 'contas';

const ABAS: { chave: Aba; rotulo: string }[] = [
  { chave: 'balcao', rotulo: 'Balcão' },
  { chave: 'contas', rotulo: 'Contas' },
];

/**
 * Balcao: venda rapida, paga na hora. Contas: a conta do hospede, onde a
 * hospedagem e os consumos se somam e o saldo e recebido no check-out.
 */
export function Caixa() {
  const [aba, setAba] = useState<Aba>('balcao');

  return (
    <div className="max-w-2xl mx-auto">
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

      {aba === 'balcao' ? <LancamentoRapido /> : <ContaHospede />}
    </div>
  );
}

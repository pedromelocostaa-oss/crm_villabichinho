import type { Periodo } from '../utils/periodo';

type Props = {
  periodo: Periodo;
  aoTrocar: (p: Periodo) => void;
  de: string;
  ate: string;
  aoTrocarDe: (v: string) => void;
  aoTrocarAte: (v: string) => void;
};

const ROTULOS: Record<Periodo, string> = {
  hoje: 'Dia',
  semana: 'Semana',
  mes: 'Mês',
  personalizado: 'Período',
};

export function SeletorPeriodo({ periodo, aoTrocar, de, ate, aoTrocarDe, aoTrocarAte }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(ROTULOS) as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => aoTrocar(p)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              periodo === p
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            {ROTULOS[p]}
          </button>
        ))}
      </div>

      {periodo === 'personalizado' && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={de}
            onChange={(e) => aoTrocarDe(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg"
          />
          <span className="text-xs text-gray-400">até</span>
          <input
            type="date"
            value={ate}
            onChange={(e) => aoTrocarAte(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg"
          />
        </div>
      )}
    </div>
  );
}

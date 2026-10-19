import { useState } from 'react';
import { Database, Loader2 } from 'lucide-react';
import { leadsNoLocalStorage, type ResultadoImportacao } from '../lib/leads';

interface Props {
  onImportar: () => Promise<ResultadoImportacao>;
}

/**
 * Importacao one-shot do CRM antigo. Idempotente pelo legacy_id: rodar duas
 * vezes nao duplica nada, o segundo passe so conta os que ja estavam la.
 */
export function ImportarLeads({ onImportar }: Props) {
  const [pendentes] = useState(() => leadsNoLocalStorage());
  const [rodando, setRodando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  if (pendentes === 0 && !resultado) return null;

  const importar = async () => {
    setRodando(true);
    setErro(null);
    try {
      setResultado(await onImportar());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha na importação');
    } finally {
      setRodando(false);
    }
  };

  return (
    <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 sm:p-4">
      <div className="flex items-start gap-3">
        <Database size={18} className="text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-amber-900">
            {resultado
              ? 'Importação concluída'
              : `${pendentes} lead${pendentes > 1 ? 's' : ''} ainda neste navegador`}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">
            O CRM agora vive no banco. Importe para que a equipe veja os mesmos leads em qualquer
            dispositivo. Importar de novo não duplica nada.
          </p>

          {resultado && (
            <p className="text-xs text-amber-900 mt-2 bg-amber-100 rounded-lg px-2 py-1.5">
              {resultado.encontrados} encontrado{resultado.encontrados > 1 ? 's' : ''} ·{' '}
              {resultado.importados} importado{resultado.importados === 1 ? '' : 's'} ·{' '}
              {resultado.jaExistiam} já existia{resultado.jaExistiam === 1 ? '' : 'm'}
              {resultado.historicoImportado > 0 &&
                ` · ${resultado.historicoImportado} registros de histórico`}
            </p>
          )}

          {erro && <p className="text-xs text-red-600 mt-2">{erro}</p>}
        </div>

        <button
          onClick={() => void importar()}
          disabled={rodando}
          className="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
        >
          {rodando && <Loader2 size={14} className="animate-spin" />}
          {resultado ? 'Importar de novo' : 'Importar'}
        </button>
      </div>
    </div>
  );
}

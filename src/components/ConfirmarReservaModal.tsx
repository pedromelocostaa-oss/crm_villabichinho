import { useEffect, useState } from 'react';
import { X, Loader2, CheckCircle2 } from 'lucide-react';
import type { Lead } from '../types/lead';
import type { Chale, Origem } from '../types/database';
import { criarHospede, criarReserva, listarChales } from '../lib/financeiro';
import { formatDate } from '../utils/storage';

interface Props {
  lead: Lead;
  onClose: () => void;
  /** Chamado com a reserva criada, para registrar no histórico do lead. */
  onCriada: (resumo: string) => void;
}

const ORIGENS: { valor: Origem; label: string }[] = [
  { valor: 'direta', label: 'Direta (WhatsApp, Instagram, indicação)' },
  { valor: 'booking', label: 'Booking.com' },
  { valor: 'walk_in', label: 'Walk-in' },
];

/**
 * E isto que liga o funil ao financeiro: a reserva nasce com lead_id e origem
 * preenchidos, entao "origem da reserva" deixa de ser um campo solto.
 */
export function ConfirmarReservaModal({ lead, onClose, onCriada }: Props) {
  const [chales, setChales] = useState<Chale[]>([]);
  const [origem, setOrigem] = useState<Origem>('direta');
  const [checkIn, setCheckIn] = useState(lead.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(lead.checkOut ?? '');
  const [chaleId, setChaleId] = useState('');
  const [adultos, setAdultos] = useState(String(lead.guests ?? 2));
  const [criancas, setCriancas] = useState('0');
  const [codigoExterno, setCodigoExterno] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const lista = await listarChales();
        if (!ativo) return;
        setChales(lista);
        // A acomodacao do lead e texto livre; casa com o chale quando bate o nome.
        const casa = lead.accommodation
          ? lista.find((c) => c.nome.toLowerCase() === lead.accommodation?.toLowerCase())
          : undefined;
        if (casa) setChaleId(casa.id);
      } catch {
        // Sem chales a reserva ainda pode ser criada: chale_id e opcional.
      }
    })();
    return () => {
      ativo = false;
    };
  }, [lead.accommodation]);

  const salvar = async () => {
    if (!checkIn || !checkOut) {
      setErro('Informe check-in e check-out.');
      return;
    }
    if (checkOut <= checkIn) {
      setErro('O check-out precisa ser depois do check-in.');
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const hospede = await criarHospede({
        nome: lead.name,
        telefone: lead.phone || null,
        email: lead.email || null,
        observacoes: lead.notes || null,
      });
      await criarReserva({
        hospede_id: hospede.id,
        lead_id: lead.id,
        origem,
        check_in: checkIn,
        check_out: checkOut,
        chale_id: chaleId || null,
        codigo_externo: codigoExterno.trim() || null,
        adultos: Number(adultos) || 1,
        criancas: Number(criancas) || 0,
        status: 'confirmada',
      });
      const chale = chales.find((c) => c.id === chaleId);
      onCriada(
        `Reserva criada (${origem.replace('_', '-')}) — ${formatDate(checkIn)} a ${formatDate(
          checkOut
        )}${chale ? ` · ${chale.nome}` : ''}`
      );
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao criar a reserva');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={18} className="text-emerald-600" />
            <div>
              <p className="font-semibold text-gray-900 text-sm leading-tight">Criar a reserva</p>
              <p className="text-xs text-gray-400 leading-tight">{lead.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-500">
            O lead foi confirmado. Criar a reserva agora preenche a origem e liga a reserva a este
            lead no financeiro. Você pode pular e fazer isso depois.
          </p>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Origem da reserva</span>
            <select
              value={origem}
              onChange={(e) => setOrigem(e.target.value as Origem)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              {ORIGENS.map((o) => (
                <option key={o.valor} value={o.valor}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          {origem === 'booking' && (
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Código no Booking</span>
              <input
                value={codigoExterno}
                onChange={(e) => setCodigoExterno(e.target.value)}
                placeholder="opcional"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          )}

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Check-in</span>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => setCheckIn(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Check-out</span>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => setCheckOut(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-xs font-medium text-gray-700">Chalé</span>
            <select
              value={chaleId}
              onChange={(e) => setChaleId(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Definir depois</option>
              {chales.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {lead.accommodation && !chaleId && (
              <span className="text-xs text-gray-400 mt-1 block">
                O lead pediu “{lead.accommodation}”.
              </span>
            )}
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Adultos</span>
              <input
                type="number"
                min="1"
                value={adultos}
                onChange={(e) => setAdultos(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-gray-700">Crianças</span>
              <input
                type="number"
                min="0"
                value={criancas}
                onChange={(e) => setCriancas(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
            </label>
          </div>

          {erro && <p className="text-xs text-red-600">{erro}</p>}
        </div>

        <div className="flex gap-2 px-4 py-3 border-t border-gray-100 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50"
          >
            Depois
          </button>
          <button
            onClick={() => void salvar()}
            disabled={salvando}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium py-2.5 rounded-lg"
          >
            {salvando && <Loader2 size={15} className="animate-spin" />}
            Criar reserva
          </button>
        </div>
      </div>
    </div>
  );
}

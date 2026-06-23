import { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
import type { Lead } from '../types/lead';
import { ATTENDANTS, OCCASION_OPTIONS, ACCOMMODATION_OPTIONS, SERVICES_LIST } from '../types/lead';

interface Props {
  onClose: () => void;
  onCreate: (data: Omit<Lead, 'id' | 'createdAt' | 'history'>) => void;
}

export function NewLeadModal({ onClose, onCreate }: Props) {
  // Contato
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [attendant, setAttendant] = useState(ATTENDANTS[0]);

  // Reserva
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState('');
  const [occasion, setOccasion] = useState('');
  const [accommodation, setAccommodation] = useState('');

  // Preferências
  const [lookingFor, setLookingFor] = useState('');
  const [services, setServices] = useState<string[]>([]);
  const [notes, setNotes] = useState('');

  const [showExtra, setShowExtra] = useState(false);

  const toggleService = (s: string) =>
    setServices((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) return;
    onCreate({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      attendant,
      stage: 'novo_contato',
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests: guests ? Number(guests) : undefined,
      occasion: occasion || undefined,
      accommodation: accommodation || undefined,
      lookingFor: lookingFor.trim() || undefined,
      services,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-lg max-h-[95vh] sm:max-h-[92vh] rounded-t-2xl sm:rounded-2xl shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <h2 className="font-semibold text-gray-900">Novo Lead</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="p-5 space-y-5">

            {/* ── Contato ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Contato</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nome <span className="text-red-500">*</span>
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Casal Silva ou Maria Santos"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    required
                    autoFocus
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="(11) 9 9999-9999"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Atendente</label>
                    <select
                      value={attendant}
                      onChange={(e) => setAttendant(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      {ATTENDANTS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="email@exemplo.com"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </section>

            {/* ── Reserva ── */}
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Reserva Pretendida</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                    <input
                      type="date"
                      value={checkIn}
                      onChange={(e) => { setCheckIn(e.target.value); if (checkOut && e.target.value > checkOut) setCheckOut(''); }}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                    <input
                      type="date"
                      value={checkOut}
                      min={checkIn || undefined}
                      onChange={(e) => setCheckOut(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Hóspedes</label>
                    <input
                      type="number"
                      min="1"
                      max="30"
                      value={guests}
                      onChange={(e) => setGuests(e.target.value)}
                      placeholder="Ex: 2"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ocasião</label>
                    <select
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Selecionar...</option>
                      {OCCASION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Preferências (expansível) ── */}
            <section>
              <button
                type="button"
                onClick={() => setShowExtra((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-2 hover:text-emerald-800 transition-colors"
              >
                {showExtra ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                Preferências e Detalhes
                {!showExtra && (
                  <span className="text-gray-400 font-normal normal-case tracking-normal ml-1">(opcional)</span>
                )}
              </button>

              {showExtra && (
                <div className="space-y-3 mt-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Acomodação</label>
                    <select
                      value={accommodation}
                      onChange={(e) => setAccommodation(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    >
                      <option value="">Selecionar...</option>
                      {ACCOMMODATION_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">O que procura</label>
                    <textarea
                      value={lookingFor}
                      onChange={(e) => setLookingFor(e.target.value)}
                      placeholder="Ex: lugar tranquilo, próximo à natureza, boa gastronomia..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Serviços de Interesse</label>
                    <div className="flex flex-wrap gap-2">
                      {SERVICES_LIST.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleService(s)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            services.includes(s)
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-gray-600 border-gray-200 hover:border-emerald-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Notas internas sobre o lead..."
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                    />
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="px-5 pb-5 flex gap-3 flex-shrink-0 border-t border-gray-50 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
            >
              Criar Lead
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

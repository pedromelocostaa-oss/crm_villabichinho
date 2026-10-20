import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BedDouble,
  Check,
  CircleAlert,
  DoorOpen,
  Plus,
  UserRound,
} from 'lucide-react';
import {
  contaDoFolio,
  contasAbertas,
  criarReservaComConta,
  fecharFolio,
  garantirFolio,
  hospedesNaCasa,
  lancarHospedagem,
  listarChales,
  registrarPagamento,
  hojeISO,
  type ContaAberta,
  type ContaDoFolio,
  type HospedeNaCasa,
} from '../lib/financeiro';
import { brl, paraNumero } from '../utils/moeda';
import { dataBR } from '../utils/periodo';
import type { Chale, FormaPagamento, Origem } from '../types/database';

const FORMAS: { chave: FormaPagamento; rotulo: string }[] = [
  { chave: 'pix', rotulo: 'Pix' },
  { chave: 'debito', rotulo: 'Débito' },
  { chave: 'credito', rotulo: 'Crédito' },
  { chave: 'dinheiro', rotulo: 'Dinheiro' },
];

const ORIGENS: { chave: Origem; rotulo: string }[] = [
  { chave: 'direta', rotulo: 'Direta' },
  { chave: 'booking', rotulo: 'Booking' },
  { chave: 'walk_in', rotulo: 'Walk-in' },
];

export function ContaHospede() {
  const [contas, setContas] = useState<ContaAberta[]>([]);
  const [semConta, setSemConta] = useState<HospedeNaCasa[]>([]);
  const [chales, setChales] = useState<Chale[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const [aberta, setAberta] = useState<ContaAberta | null>(null);
  const [detalhe, setDetalhe] = useState<ContaDoFolio | null>(null);
  const [novaReserva, setNovaReserva] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const recarregar = useCallback(async () => {
    const [lista, naCasa, cs] = await Promise.all([
      contasAbertas(),
      hospedesNaCasa(),
      listarChales(),
    ]);
    setContas(lista);
    setSemConta(naCasa.filter((h) => h.folio_id === null));
    setChales(cs);
    return lista;
  }, []);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      try {
        const [lista, naCasa, cs] = await Promise.all([
          contasAbertas(),
          hospedesNaCasa(),
          listarChales(),
        ]);
        if (!ativo) return;
        setContas(lista);
        setSemConta(naCasa.filter((h) => h.folio_id === null));
        setChales(cs);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar as contas');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  async function abrirDetalhe(conta: ContaAberta) {
    setErro(null);
    setAberta(conta);
    setDetalhe(null);
    try {
      setDetalhe(await contaDoFolio(conta.folio_id));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao abrir a conta');
    }
  }

  async function atualizarDetalhe(folioId: string) {
    const lista = await recarregar();
    const atual = lista.find((c) => c.folio_id === folioId) ?? null;
    setAberta(atual);
    setDetalhe(atual ? await contaDoFolio(folioId) : null);
  }

  function anunciar(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(null), 3500);
  }

  if (carregando) {
    return <p className="text-sm text-gray-400 py-12 text-center">Carregando…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      {aviso && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
          <Check size={16} />
          {aviso}
        </div>
      )}
      {erro && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {aberta && detalhe ? (
        <Detalhe
          conta={aberta}
          detalhe={detalhe}
          ocupado={ocupado}
          setOcupado={setOcupado}
          onVoltar={() => {
            setAberta(null);
            setDetalhe(null);
            void recarregar();
          }}
          onMudou={async (msg) => {
            anunciar(msg);
            await atualizarDetalhe(aberta.folio_id);
          }}
          onFechou={async (msg) => {
            anunciar(msg);
            setAberta(null);
            setDetalhe(null);
            await recarregar();
          }}
          onErro={setErro}
        />
      ) : novaReserva ? (
        <NovaReserva
          chales={chales}
          ocupado={ocupado}
          setOcupado={setOcupado}
          onCancelar={() => setNovaReserva(false)}
          onCriada={async (msg) => {
            anunciar(msg);
            setNovaReserva(false);
            await recarregar();
          }}
          onErro={setErro}
        />
      ) : (
        <>
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contas</h2>
              <p className="text-sm text-gray-500">Hospedagem e consumos de cada hóspede</p>
            </div>
            <button
              onClick={() => setNovaReserva(true)}
              className="shrink-0 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg"
            >
              <Plus size={15} /> Nova reserva
            </button>
          </div>

          {semConta.length > 0 && (
            <div className="mb-5">
              <p className="text-xs text-gray-400 mb-2">Na casa, sem conta aberta</p>
              <div className="space-y-2">
                {semConta.map((h) => (
                  <div
                    key={h.reserva_id}
                    className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{h.nome}</p>
                      <p className="text-xs text-gray-500">{h.chale ?? 'sem chalé'}</p>
                    </div>
                    <button
                      disabled={ocupado}
                      onClick={async () => {
                        setOcupado(true);
                        try {
                          await garantirFolio({
                            id: h.reserva_id,
                            hospede_id: h.hospede_id,
                          });
                          anunciar(`Conta aberta para ${h.nome}`);
                          await recarregar();
                        } catch (e) {
                          setErro(e instanceof Error ? e.message : 'Falha ao abrir a conta');
                        } finally {
                          setOcupado(false);
                        }
                      }}
                      className="shrink-0 text-xs font-medium text-amber-800 border border-amber-300 rounded-lg px-2.5 py-1.5 hover:bg-amber-100 disabled:opacity-50"
                    >
                      Abrir conta
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {contas.length === 0 ? (
            <p className="text-sm text-gray-400 py-10 text-center">
              Nenhuma conta aberta. Crie uma reserva para começar.
            </p>
          ) : (
            <div className="space-y-2">
              {contas.map((c) => (
                <button
                  key={c.folio_id}
                  onClick={() => void abrirDetalhe(c)}
                  className="w-full text-left bg-white border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{c.hospede}</p>
                      <p className="text-xs text-gray-500">
                        {c.chale ?? 'sem chalé'}
                        {c.check_in && c.check_out && ` · ${dataBR(c.check_in)} a ${dataBR(c.check_out)}`}
                        {c.origem === 'booking' && ' · Booking'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{brl(c.total)}</p>
                      <p className={`text-xs ${c.saldo > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                        {c.saldo > 0 ? `faltam ${brl(c.saldo)}` : 'quitada'}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Detalhe da conta
// ─────────────────────────────────────────────────────────────

function Detalhe({
  conta,
  detalhe,
  ocupado,
  setOcupado,
  onVoltar,
  onMudou,
  onFechou,
  onErro,
}: {
  conta: ContaAberta;
  detalhe: ContaDoFolio;
  ocupado: boolean;
  setOcupado: (v: boolean) => void;
  onVoltar: () => void;
  onMudou: (msg: string) => Promise<void>;
  onFechou: (msg: string) => Promise<void>;
  onErro: (msg: string) => void;
}) {
  const [valorDiaria, setValorDiaria] = useState('');
  const [diarias, setDiarias] = useState('1');
  const [valorRecebido, setValorRecebido] = useState('');
  const [recebendo, setRecebendo] = useState(false);

  const temHospedagem = detalhe.hospedagem > 0;
  const origem: Origem = conta.origem ?? 'direta';

  async function lancarDiaria() {
    const valor = paraNumero(valorDiaria);
    if (valor <= 0) return;
    setOcupado(true);
    try {
      await lancarHospedagem({
        folio_id: conta.folio_id,
        origem,
        valor_total: valor,
        diarias: Number(diarias) || 1,
        data_venda: conta.check_in ?? hojeISO(),
      });
      setValorDiaria('');
      await onMudou(`Hospedagem de ${brl(valor)} lançada`);
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao lançar a hospedagem');
    } finally {
      setOcupado(false);
    }
  }

  async function receber(forma: FormaPagamento) {
    const valor = paraNumero(valorRecebido) || detalhe.saldo;
    if (valor <= 0) return;
    setOcupado(true);
    try {
      // Alocacao automatica: quita os itens mais antigos primeiro.
      const { naoAlocado } = await registrarPagamento({
        folio_id: conta.folio_id,
        forma_pagamento: forma,
        valor_bruto_pago: valor,
        status: 'recebido',
      });
      setValorRecebido('');
      setRecebendo(false);
      await onMudou(
        naoAlocado > 0
          ? `Recebido ${brl(valor)} · ${brl(naoAlocado)} sem item para alocar`
          : `Recebido ${brl(valor)}`
      );
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao registrar o pagamento');
    } finally {
      setOcupado(false);
    }
  }

  async function fechar() {
    setOcupado(true);
    try {
      await fecharFolio(conta.folio_id);
      await onFechou(`Conta de ${conta.hospede} fechada`);
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao fechar a conta');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        onClick={onVoltar}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"
      >
        <ArrowLeft size={15} /> Contas
      </button>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-1">
          <UserRound size={16} className="text-gray-400" />
          <p className="font-semibold text-gray-900">{conta.hospede}</p>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {conta.chale ?? 'sem chalé'}
          {conta.check_in && conta.check_out && ` · ${dataBR(conta.check_in)} a ${dataBR(conta.check_out)}`}
          {conta.origem && ` · reserva ${conta.origem === 'walk_in' ? 'walk-in' : conta.origem}`}
        </p>

        <div className="space-y-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Hospedagem</span>
            <span className="font-medium text-gray-900">{brl(detalhe.hospedagem)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Consumos adicionais</span>
            <span className="font-medium text-gray-900">{brl(detalhe.consumo_adicional)}</span>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="font-medium text-gray-900">Total da conta</span>
            <span className="text-lg font-bold text-gray-900">{brl(detalhe.total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Já pago</span>
            <span className="text-gray-900">{brl(detalhe.pago)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className={detalhe.saldo > 0 ? 'text-amber-700 font-medium' : 'text-emerald-700'}>
              Saldo
            </span>
            <span
              className={`font-semibold ${detalhe.saldo > 0 ? 'text-amber-700' : 'text-emerald-700'}`}
            >
              {brl(detalhe.saldo)}
            </span>
          </div>
        </div>
      </div>

      {/* Cada valor continua no seu centro de receita de origem */}
      {detalhe.porCentro.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-400 mb-2">Por centro de receita</p>
          <div className="space-y-1.5">
            {detalhe.porCentro.map((c) => (
              <div key={c.chave} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">{c.nome}</span>
                <span className="text-gray-900">{brl(c.valor)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!temHospedagem && (
        <div className="bg-white border-2 border-dashed border-emerald-300 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <BedDouble size={16} className="text-emerald-600" />
            <p className="text-sm font-medium text-gray-900">Lançar a hospedagem</p>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            A diária só vira faturamento quando é lançada aqui
            {origem === 'booking' && ' — e é isso que calcula a comissão do Booking'}.
          </p>
          <div className="flex items-end gap-2">
            <div className="w-20">
              <label className="block text-xs text-gray-500 mb-1">Diárias</label>
              <input
                value={diarias}
                onChange={(e) => setDiarias(e.target.value)}
                inputMode="numeric"
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Valor total</label>
              <input
                value={valorDiaria}
                onChange={(e) => setValorDiaria(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm font-semibold"
              />
            </div>
            <button
              disabled={ocupado || paraNumero(valorDiaria) <= 0}
              onClick={lancarDiaria}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Lançar
            </button>
          </div>
        </div>
      )}

      {detalhe.saldo > 0 &&
        (recebendo ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
            <label className="block text-xs text-gray-500 mb-1">Valor a receber</label>
            <input
              autoFocus
              value={valorRecebido}
              onChange={(e) => setValorRecebido(e.target.value)}
              inputMode="decimal"
              placeholder={brl(detalhe.saldo)}
              className="w-full mb-1 px-3 py-2.5 border border-gray-200 rounded-lg text-lg font-semibold"
            />
            <p className="text-xs text-gray-400 mb-3">
              Em branco recebe o saldo inteiro: {brl(detalhe.saldo)}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FORMAS.map((f) => (
                <button
                  key={f.chave}
                  disabled={ocupado}
                  onClick={() => receber(f.chave)}
                  className="h-12 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium"
                >
                  {f.rotulo}
                </button>
              ))}
            </div>
            <button
              onClick={() => setRecebendo(false)}
              className="w-full mt-2 text-xs text-gray-500 hover:text-gray-900 py-1"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            onClick={() => setRecebendo(true)}
            className="w-full mb-3 bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-3 rounded-xl"
          >
            Receber {brl(detalhe.saldo)}
          </button>
        ))}

      <button
        disabled={ocupado || detalhe.saldo > 0}
        onClick={fechar}
        title={detalhe.saldo > 0 ? 'Receba o saldo antes de fechar' : undefined}
        className="w-full flex items-center justify-center gap-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 font-medium py-3 rounded-xl"
      >
        <DoorOpen size={16} />
        {detalhe.saldo > 0 ? 'Fechar conta (receba o saldo antes)' : 'Fechar conta no check-out'}
      </button>
    </>
  );
}

// ─────────────────────────────────────────────────────────────
// Nova reserva
// ─────────────────────────────────────────────────────────────

function NovaReserva({
  chales,
  ocupado,
  setOcupado,
  onCancelar,
  onCriada,
  onErro,
}: {
  chales: Chale[];
  ocupado: boolean;
  setOcupado: (v: boolean) => void;
  onCancelar: () => void;
  onCriada: (msg: string) => Promise<void>;
  onErro: (msg: string) => void;
}) {
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [origem, setOrigem] = useState<Origem>('direta');
  const [chaleId, setChaleId] = useState('');
  const [checkIn, setCheckIn] = useState(hojeISO());
  const [checkOut, setCheckOut] = useState('');
  const [valor, setValor] = useState('');
  const [codigo, setCodigo] = useState('');

  const valido = nome.trim() && checkIn && checkOut && checkOut > checkIn;

  async function salvar() {
    setOcupado(true);
    try {
      await criarReservaComConta({
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        origem,
        check_in: checkIn,
        check_out: checkOut,
        chale_id: chaleId || null,
        codigo_externo: codigo.trim() || null,
        valor_hospedagem: paraNumero(valor) || null,
      });
      await onCriada(`Reserva de ${nome.trim()} criada com a conta aberta`);
    } catch (e) {
      onErro(e instanceof Error ? e.message : 'Falha ao criar a reserva');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <button
        onClick={onCancelar}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"
      >
        <ArrowLeft size={15} /> Contas
      </button>

      <div className="bg-white border border-gray-200 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Nova reserva</h2>
        <p className="text-xs text-gray-400 mb-4">
          Cria o hóspede, a reserva e a conta. A hospedagem é opcional aqui e pode ser
          lançada depois.
        </p>

        <label className="block text-sm font-medium text-gray-700 mb-1">Hóspede</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Nome completo"
          className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Telefone</label>
        <input
          value={telefone}
          onChange={(e) => setTelefone(e.target.value)}
          inputMode="tel"
          className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
        />

        <label className="block text-sm font-medium text-gray-700 mb-1">Origem</label>
        <div className="flex gap-2 mb-3">
          {ORIGENS.map((o) => (
            <button
              key={o.chave}
              onClick={() => setOrigem(o.chave)}
              className={`flex-1 text-sm font-medium py-2 rounded-lg border transition-colors ${
                origem === o.chave
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              {o.rotulo}
            </button>
          ))}
        </div>

        {origem === 'booking' && (
          <>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Código da reserva no Booking
            </label>
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </>
        )}

        <label className="block text-sm font-medium text-gray-700 mb-1">Quarto</label>
        <select
          value={chaleId}
          onChange={(e) => setChaleId(e.target.value)}
          className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="">Sem quarto definido</option>
          {chales.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>

        <label className="block text-sm font-medium text-gray-700 mb-1">
          Valor da hospedagem <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          inputMode="decimal"
          placeholder="0,00"
          className="w-full mb-4 px-3 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold"
        />

        <button
          disabled={ocupado || !valido}
          onClick={salvar}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg"
        >
          {ocupado ? 'Criando…' : 'Criar reserva e abrir conta'}
        </button>
        {checkOut !== '' && checkOut <= checkIn && (
          <p className="mt-2 text-xs text-red-600">O check-out precisa ser depois do check-in.</p>
        )}
      </div>
    </>
  );
}

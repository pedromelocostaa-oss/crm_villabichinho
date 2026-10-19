import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, CircleAlert, Pencil, Search, UserRound, X } from 'lucide-react';
import { useCatalogo } from '../hooks/useCatalogo';
import {
  criarVenda,
  garantirFolio,
  hospedesNaCasa,
  registrarPagamento,
  type HospedeNaCasa,
} from '../lib/financeiro';
import { brl, paraNumero } from '../utils/moeda';
import type { BusinessUnit, FormaPagamento } from '../types/database';

type ItemEscolhido = { revenue_center_id: string; descricao: string; valor: number };
type Forma = FormaPagamento | 'conta';

const FORMAS: { chave: FormaPagamento; rotulo: string }[] = [
  { chave: 'pix', rotulo: 'Pix' },
  { chave: 'debito', rotulo: 'Débito' },
  { chave: 'credito', rotulo: 'Crédito' },
  { chave: 'dinheiro', rotulo: 'Dinheiro' },
];

export function LancamentoRapido() {
  const { unidades, carregando, centrosDaUnidade, produtosDaUnidade } = useCatalogo();

  const [unidade, setUnidade] = useState<BusinessUnit | null>(null);
  const [item, setItem] = useState<ItemEscolhido | null>(null);
  const [digitando, setDigitando] = useState(false);
  const [valorTexto, setValorTexto] = useState('');
  const [descricaoLivre, setDescricaoLivre] = useState('');
  const [centroLivre, setCentroLivre] = useState<string>('');

  const [hospedes, setHospedes] = useState<HospedeNaCasa[]>([]);
  const [hospede, setHospede] = useState<HospedeNaCasa | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState('');

  const [salvando, setSalvando] = useState(false);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    hospedesNaCasa()
      .then(setHospedes)
      .catch(() => setHospedes([]));
  }, []);

  const encontrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return hospedes;
    return hospedes.filter(
      (h) =>
        h.nome.toLowerCase().includes(termo) || (h.chale ?? '').toLowerCase().includes(termo)
    );
  }, [busca, hospedes]);

  function recomecar() {
    setUnidade(null);
    setItem(null);
    setDigitando(false);
    setValorTexto('');
    setDescricaoLivre('');
    setCentroLivre('');
    setHospede(null);
    setBusca('');
    setBuscando(false);
  }

  async function salvar(forma: Forma) {
    if (!unidade || !item) return;
    setSalvando(true);
    setErro(null);

    try {
      let folioId: string | null = null;
      if (hospede) {
        folioId =
          hospede.folio_id ??
          (await garantirFolio({ id: hospede.reserva_id, hospede_id: hospede.hospede_id })).id;
      }

      const { venda, itens } = await criarVenda({
        folio_id: folioId,
        descricao: `${unidade.nome} — ${item.descricao}`,
        itens: [
          {
            revenue_center_id: item.revenue_center_id,
            descricao: item.descricao,
            valor_unitario: item.valor,
          },
        ],
      });

      if (forma !== 'conta') {
        // Alocacao explicita no proprio item: quem paga no balcao quita o que
        // acabou de consumir, nao a diaria em aberto da conta.
        await registrarPagamento({
          sale_id: venda.id,
          folio_id: folioId,
          forma_pagamento: forma,
          valor_bruto_pago: item.valor,
          status: 'recebido',
          alocar: [{ sale_item_id: itens[0].id, valor_alocado: item.valor }],
        });
      }

      setSucesso(
        forma === 'conta'
          ? `${brl(item.valor)} lançado na conta de ${hospede?.nome ?? 'hóspede'}`
          : `${brl(item.valor)} registrado`
      );
      recomecar();
      window.setTimeout(() => setSucesso(null), 3500);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar');
    } finally {
      setSalvando(false);
    }
  }

  if (carregando) {
    return <p className="text-sm text-gray-400 py-12 text-center">Carregando…</p>;
  }

  return (
    <div className="max-w-xl mx-auto">
      {sucesso && (
        <div className="mb-4 flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-4 py-3 text-sm font-medium">
          <Check size={16} />
          {sucesso}
        </div>
      )}
      {erro && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {/* ── Passo 1: unidade ─────────────────────────────── */}
      {!unidade && (
        <>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Lançamento rápido</h2>
          <p className="text-sm text-gray-500 mb-5">Onde foi a venda?</p>
          <div className="grid grid-cols-2 gap-3">
            {unidades.map((u) => (
              <button
                key={u.id}
                onClick={() => setUnidade(u)}
                className="h-24 rounded-2xl border border-gray-200 bg-white hover:border-gray-300 active:scale-[0.98] transition-all flex flex-col items-center justify-center gap-2"
              >
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: u.cor }} />
                <span className="text-sm font-medium text-gray-900 text-center px-2">{u.nome}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ── Passo 2: produto ou valor livre ───────────────── */}
      {unidade && !item && (
        <>
          <button
            onClick={recomecar}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"
          >
            <ArrowLeft size={15} /> {unidade.nome}
          </button>

          {!digitando ? (
            <>
              <div className="space-y-2 mb-4">
                {produtosDaUnidade(unidade.id).map((p) => (
                  <button
                    key={p.id}
                    onClick={() =>
                      setItem({
                        revenue_center_id: p.revenue_center_id,
                        descricao: p.nome,
                        valor: Number(p.preco_padrao),
                      })
                    }
                    className="w-full flex items-center justify-between px-4 py-3.5 rounded-xl border border-gray-200 bg-white hover:border-gray-300 active:scale-[0.99] transition-all text-left"
                  >
                    <span className="text-sm font-medium text-gray-900">{p.nome}</span>
                    <span className="text-sm text-gray-600">{brl(Number(p.preco_padrao))}</span>
                  </button>
                ))}
                {produtosDaUnidade(unidade.id).length === 0 && (
                  <p className="text-sm text-gray-400 py-2">
                    Nenhum produto cadastrado nesta unidade ainda.
                  </p>
                )}
              </div>

              <button
                onClick={() => {
                  setDigitando(true);
                  setCentroLivre(centrosDaUnidade(unidade.id)[0]?.id ?? '');
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 hover:border-gray-400 text-sm font-medium"
              >
                <Pencil size={15} /> Valor livre
              </button>
            </>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Centro</label>
              <select
                value={centroLivre}
                onChange={(e) => setCentroLivre(e.target.value)}
                className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              >
                {centrosDaUnidade(unidade.id).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>

              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input
                value={descricaoLivre}
                onChange={(e) => setDescricaoLivre(e.target.value)}
                placeholder="Ex.: 2 cervejas"
                className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              />

              <label className="block text-sm font-medium text-gray-700 mb-1">Valor</label>
              <input
                value={valorTexto}
                onChange={(e) => setValorTexto(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full mb-4 px-3 py-2.5 border border-gray-200 rounded-lg text-lg font-semibold"
              />

              <button
                disabled={paraNumero(valorTexto) <= 0 || !centroLivre}
                onClick={() =>
                  setItem({
                    revenue_center_id: centroLivre,
                    descricao: descricaoLivre.trim() || 'Venda avulsa',
                    valor: paraNumero(valorTexto),
                  })
                }
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium py-3 rounded-xl"
              >
                Continuar
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Passo 3: pagamento ────────────────────────────── */}
      {unidade && item && (
        <>
          <button
            onClick={() => {
              setItem(null);
              setDigitando(false);
            }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-3"
          >
            <ArrowLeft size={15} /> Trocar item
          </button>

          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-4">
            <p className="text-sm text-gray-500">{unidade.nome}</p>
            <p className="font-medium text-gray-900">{item.descricao}</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{brl(item.valor)}</p>
          </div>

          {/* Vinculo opcional com quem esta hospedado hoje */}
          <div className="mb-4">
            {hospede ? (
              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
                <span className="flex items-center gap-2 text-sm text-emerald-900">
                  <UserRound size={15} />
                  {hospede.nome}
                  {hospede.chale && <span className="text-emerald-700">· {hospede.chale}</span>}
                </span>
                <button onClick={() => setHospede(null)} className="text-emerald-700">
                  <X size={16} />
                </button>
              </div>
            ) : buscando ? (
              <div className="bg-white border border-gray-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Search size={15} className="text-gray-400" />
                  <input
                    autoFocus
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Nome ou chalé"
                    className="flex-1 text-sm outline-none"
                  />
                  <button onClick={() => setBuscando(false)} className="text-gray-400">
                    <X size={16} />
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {encontrados.map((h) => (
                    <button
                      key={h.reserva_id}
                      onClick={() => {
                        setHospede(h);
                        setBuscando(false);
                      }}
                      className="w-full text-left py-2.5 px-1 hover:bg-gray-50"
                    >
                      <p className="text-sm font-medium text-gray-900">{h.nome}</p>
                      <p className="text-xs text-gray-500">
                        {h.chale ?? 'sem chalé'} · sai em{' '}
                        {new Date(h.check_out + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </p>
                    </button>
                  ))}
                  {encontrados.length === 0 && (
                    <p className="text-sm text-gray-400 py-3">Ninguém hospedado hoje por aqui.</p>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setBuscando(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-gray-200 text-gray-600 hover:border-gray-300 text-sm"
              >
                <UserRound size={15} /> Vincular a um hóspede (opcional)
              </button>
            )}
          </div>

          <p className="text-sm text-gray-500 mb-2">Como foi pago?</p>
          <div className="grid grid-cols-2 gap-3">
            {FORMAS.map((f) => (
              <button
                key={f.chave}
                disabled={salvando}
                onClick={() => salvar(f.chave)}
                className="h-16 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium active:scale-[0.98] transition-all"
              >
                {f.rotulo}
              </button>
            ))}
          </div>

          {hospede && (
            <button
              disabled={salvando}
              onClick={() => salvar('conta')}
              className="mt-3 w-full h-14 rounded-xl border-2 border-emerald-600 text-emerald-700 font-medium hover:bg-emerald-50 disabled:opacity-50"
            >
              Lançar na conta do hóspede
            </button>
          )}
        </>
      )}
    </div>
  );
}

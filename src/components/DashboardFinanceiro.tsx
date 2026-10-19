import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
  Briefcase,
  ChevronDown,
  CircleAlert,
  Clock,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  aReceber,
  recebimentosPorForma,
  repassesBooking,
  resultadoPorUnidade,
  resumoFinanceiro,
  type LinhaAgrupada,
  type Regime,
  type ResumoFinanceiro,
} from '../lib/financeiro';
import { brl } from '../utils/moeda';
import { intervalo, rotuloPeriodo, type Periodo } from '../utils/periodo';
import { SeletorPeriodo } from './SeletorPeriodo';
import type { AReceber, BookingCommission, ResultadoUnidade } from '../types/database';

const FORMAS_ROTULO: Record<string, string> = {
  pix: 'Pix',
  credito: 'Crédito',
  debito: 'Débito',
  dinheiro: 'Dinheiro',
  repasse_booking: 'Repasse Booking',
  outro: 'Outro',
};

function Cartao({
  icone: Icone,
  rotulo,
  valor,
  destaque,
}: {
  icone: React.ElementType;
  rotulo: string;
  valor: number;
  destaque?: 'alerta';
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex items-center gap-1.5 text-gray-500 mb-1.5">
        <Icone size={14} />
        <span className="text-xs">{rotulo}</span>
      </div>
      <p
        className={`text-2xl font-bold ${destaque === 'alerta' ? 'text-amber-600' : 'text-gray-900'}`}
      >
        {brl(valor, 0)}
      </p>
    </div>
  );
}

export function DashboardFinanceiro() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');
  const [regime, setRegime] = useState<Regime>('competencia');

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [resultado, setResultado] = useState<ResultadoUnidade[]>([]);
  const [formas, setFormas] = useState<LinhaAgrupada[]>([]);
  const [repasses, setRepasses] = useState<BookingCommission[]>([]);
  const [pendentes, setPendentes] = useState<AReceber[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [expandida, setExpandida] = useState<string | null>(null);

  const [inicio, fim] = useMemo(() => intervalo(periodo, de, ate), [periodo, de, ate]);
  const valido = Boolean(inicio && fim);

  useEffect(() => {
    if (!valido) return;
    let ativo = true;

    void (async () => {
      try {
        const [r, res, f, rep, pend] = await Promise.all([
          resumoFinanceiro(inicio, fim, regime),
          resultadoPorUnidade(inicio, fim),
          recebimentosPorForma(inicio, fim),
          repassesBooking(),
          aReceber(),
        ]);
        if (!ativo) return;
        setResumo(r);
        setResultado(res);
        setFormas(f);
        setRepasses(rep);
        setPendentes(pend);
        setErro(null);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o painel');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [inicio, fim, regime, valido]);

  const maior = resumo?.porUnidade[0]?.valor ?? 0;
  const totalUnidades = useMemo(
    () => (resumo?.porUnidade ?? []).reduce((t, u) => t + u.valor, 0),
    [resumo]
  );
  const atrasados = useMemo(() => pendentes.filter((p) => p.atrasado), [pendentes]);
  const comCusto = resultado.filter((r) => r.controla_custo);

  return (
    <div className="space-y-5">
      {/* ── Cabeçalho ──────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 leading-tight">Villa Bichinho</h2>
          <p className="text-sm text-gray-500">Visão financeira</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-2.5 py-1.5">
          {rotuloPeriodo(periodo, de, ate)}
        </span>
      </div>

      {/* ── Período e regime ───────────────────────────────── */}
      <div className="space-y-2">
        <SeletorPeriodo
          periodo={periodo}
          aoTrocar={setPeriodo}
          de={de}
          ate={ate}
          aoTrocarDe={setDe}
          aoTrocarAte={setAte}
        />

        {/* Faturamento e caixa sao bases diferentes. O seletor fica visivel. */}
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
          {(['competencia', 'caixa'] as Regime[]).map((r) => (
            <button
              key={r}
              onClick={() => setRegime(r)}
              className={`text-xs font-medium px-3 py-1.5 rounded-md transition-colors ${
                regime === r ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {r === 'competencia' ? 'Competência' : 'Caixa'}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {carregando && !resumo && (
        <p className="text-sm text-gray-400 py-12 text-center">Carregando…</p>
      )}

      {resumo && (
        <>
          {/* ── Os quatro números ────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Cartao icone={TrendingUp} rotulo="Faturamento total" valor={resumo.faturamento} />
              <Cartao icone={Wallet} rotulo="Recebido" valor={resumo.recebido} />
              <Cartao
                icone={Clock}
                rotulo="A receber"
                valor={resumo.aReceber}
                destaque={resumo.atrasado > 0 ? 'alerta' : undefined}
              />
              <Cartao
                icone={Briefcase}
                rotulo="Consumo adicional"
                valor={resumo.consumoAdicional}
              />
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              Faturamento pela data da venda · Recebido pela data do dinheiro · A receber é o
              previsto ainda não creditado
            </p>
          </div>

          {/* ── Faturamento por unidade ──────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-0.5">
              {regime === 'caixa' ? 'Caixa por unidade de negócio' : 'Faturamento por unidade de negócio'}
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              {regime === 'caixa'
                ? 'O dinheiro que entrou, pela origem de cada item. Valores brutos: a taxa de cartão aparece descontada no card Recebido.'
                : 'O que foi vendido no período, independente do recebimento'}
            </p>

            {resumo.porUnidade.length === 0 && (
              <p className="text-sm text-gray-400 py-4">Nada lançado neste período.</p>
            )}

            <div className="space-y-3">
              {resumo.porUnidade.map((u) => {
                const aberta = expandida === u.chave;
                const centros = resumo.centrosPorUnidade[u.chave] ?? [];
                return (
                  <div key={u.chave}>
                    <button
                      onClick={() => setExpandida(aberta ? null : u.chave)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="flex items-center gap-1.5 text-sm text-gray-900">
                          <ChevronDown
                            size={13}
                            className={`text-gray-400 transition-transform ${aberta ? '' : '-rotate-90'}`}
                          />
                          {u.nome}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {brl(u.valor, 0)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: maior > 0 ? `${(u.valor / maior) * 100}%` : '0%',
                            backgroundColor: u.cor ?? '#10b981',
                          }}
                        />
                      </div>
                    </button>

                    {aberta && centros.length > 0 && (
                      <div className="mt-2 ml-5 pl-3 border-l border-gray-100 space-y-1.5">
                        {centros.map((c) => (
                          <div key={c.chave} className="flex items-center justify-between">
                            <span className="text-xs text-gray-500">{c.nome}</span>
                            <span className="text-xs text-gray-700">{brl(c.valor, 0)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Distribuição percentual ──────────────────────── */}
          {totalUnidades > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Distribuição por unidade</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="w-40 h-40 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={resumo.porUnidade}
                        dataKey="valor"
                        nameKey="nome"
                        innerRadius={42}
                        outerRadius={70}
                        paddingAngle={2}
                        stroke="none"
                      >
                        {resumo.porUnidade.map((u) => (
                          <Cell key={u.chave} fill={u.cor ?? '#10b981'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => brl(Number(v ?? 0), 0)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 w-full space-y-1.5">
                  {resumo.porUnidade.map((u) => (
                    <div key={u.chave} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-gray-600">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: u.cor ?? '#10b981' }}
                        />
                        {u.nome}
                      </span>
                      <span className="font-medium text-gray-900">
                        {((u.valor / totalUnidades) * 100).toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Resultado por unidade ────────────────────────── */}
          {comCusto.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-0.5">Resultado por unidade</h3>
              <p className="text-xs text-gray-400 mb-4">
                Receita menos CMV e custos da unidade. Custo em branco nunca vale zero.
              </p>
              <div className="space-y-3">
                {comCusto.map((r) => (
                  <div key={r.unidade_slug} className="border border-gray-100 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-900">{r.unidade}</span>
                      <span className="text-xs text-gray-400">
                        cobertura {(Number(r.cobertura_custo) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                      <div>
                        <p className="text-gray-400">Receita</p>
                        <p className="font-medium text-gray-900">{brl(Number(r.receita_liquida))}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">CMV</p>
                        <p className="font-medium text-gray-900">
                          {r.cmv == null ? '—' : brl(Number(r.cmv))}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400">Custos</p>
                        <p className="font-medium text-gray-900">{brl(Number(r.custos_unidade))}</p>
                      </div>
                    </div>

                    {r.margem == null ? (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
                        Custo incompleto, margem não calculável
                      </p>
                    ) : (
                      <div className="flex items-center justify-between bg-gray-50 rounded-lg px-2.5 py-2">
                        <span className="text-xs text-gray-500">
                          Margem
                          {r.cobertura_status === 'parcial' && (
                            <span className="ml-1.5 text-[10px] font-medium text-amber-700 bg-amber-100 rounded px-1.5 py-0.5">
                              parcial
                            </span>
                          )}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">
                          {brl(Number(r.margem))}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Caixa ────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Caixa</h3>

            <p className="text-xs text-gray-400 mb-2">Entradas por forma de pagamento</p>
            {formas.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Nenhuma entrada no período.</p>
            ) : (
              <div className="space-y-1.5 mb-4">
                {formas.map((f) => (
                  <div key={f.chave} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{FORMAS_ROTULO[f.chave] ?? f.nome}</span>
                    <span className="font-medium text-gray-900">{brl(f.valor)}</span>
                  </div>
                ))}
              </div>
            )}

            <p className="text-xs text-gray-400 mb-2">A repassar pelo Booking</p>
            {repasses.length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">Nada pendente de repasse.</p>
            ) : (
              <div className="space-y-1.5 mb-4">
                {repasses.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      {r.data_prevista_repasse
                        ? new Date(r.data_prevista_repasse + 'T00:00:00').toLocaleDateString('pt-BR')
                        : 'sem data prevista'}
                    </span>
                    <span className="font-medium text-gray-900">
                      {brl(Number(r.valor_liquido_repasse))}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-sm text-gray-600">Pendentes</span>
              <span className="text-sm font-medium text-gray-900">{brl(resumo.aReceber)}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-t border-gray-100">
              <span className="text-sm text-red-600">
                Atrasados{atrasados.length > 0 && ` (${atrasados.length})`}
              </span>
              <span className="text-sm font-semibold text-red-600">{brl(resumo.atrasado)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

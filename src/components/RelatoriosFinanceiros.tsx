import { useEffect, useMemo, useState } from 'react';
import { CircleAlert, Download } from 'lucide-react';
import { SeletorPeriodo } from './SeletorPeriodo';
import {
  resultadoPorUnidade,
  resumoFinanceiro,
  ticketMedioConsumo,
  type ResumoFinanceiro,
} from '../lib/financeiro';
import {
  relatorioConsumoPorReserva,
  relatorioHospedagem,
  relatorioRecebimentos,
  type LinhaConsumo,
  type LinhaHospedagem,
  type LinhaRecebimento,
} from '../lib/relatorios';
import { baixarCSV, type ValorCSV } from '../utils/csv';
import { intervalo, rotuloPeriodo, type Periodo } from '../utils/periodo';
import { brl } from '../utils/moeda';
import type { ResultadoUnidade, TicketMedioConsumo } from '../types/database';

function Secao({
  titulo,
  descricao,
  arquivo,
  cabecalho,
  linhas,
  children,
}: {
  titulo: string;
  descricao: string;
  arquivo: string;
  cabecalho: string[];
  linhas: ValorCSV[][];
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{titulo}</h3>
          <p className="text-xs text-gray-400">{descricao}</p>
        </div>
        <button
          onClick={() => baixarCSV(arquivo, cabecalho, linhas)}
          disabled={linhas.length === 0}
          className="shrink-0 flex items-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 hover:border-gray-300 disabled:opacity-40 rounded-lg px-2.5 py-1.5"
        >
          <Download size={13} /> CSV
        </button>
      </div>
      {linhas.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">Nada neste período.</p>
      ) : (
        children
      )}
    </section>
  );
}

function Linha({ nome, valor, detalhe }: { nome: string; valor: string; detalhe?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-gray-700 truncate">{nome}</p>
        {detalhe && <p className="text-xs text-gray-400">{detalhe}</p>}
      </div>
      <span className="text-sm font-medium text-gray-900 shrink-0 ml-3">{valor}</span>
    </div>
  );
}

export function RelatoriosFinanceiros() {
  const [periodo, setPeriodo] = useState<Periodo>('mes');
  const [de, setDe] = useState('');
  const [ate, setAte] = useState('');

  const [resumo, setResumo] = useState<ResumoFinanceiro | null>(null);
  const [hospedagem, setHospedagem] = useState<LinhaHospedagem[]>([]);
  const [consumo, setConsumo] = useState<LinhaConsumo[]>([]);
  const [ticket, setTicket] = useState<TicketMedioConsumo | null>(null);
  const [recebimentos, setRecebimentos] = useState<LinhaRecebimento[]>([]);
  const [resultado, setResultado] = useState<ResultadoUnidade[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [inicio, fim] = useMemo(() => intervalo(periodo, de, ate), [periodo, de, ate]);
  const valido = Boolean(inicio && fim);

  useEffect(() => {
    if (!valido) return;
    let ativo = true;

    void (async () => {
      try {
        const [r, h, c, t, rec, res] = await Promise.all([
          resumoFinanceiro(inicio, fim, 'competencia'),
          relatorioHospedagem(inicio, fim),
          relatorioConsumoPorReserva(inicio, fim),
          ticketMedioConsumo(inicio, fim),
          relatorioRecebimentos(inicio, fim),
          resultadoPorUnidade(inicio, fim),
        ]);
        if (!ativo) return;
        setResumo(r);
        setHospedagem(h);
        setConsumo(c);
        setTicket(t);
        setRecebimentos(rec);
        setResultado(res);
        setErro(null);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar os relatórios');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [inicio, fim, valido]);

  const totalUnidades = useMemo(
    () => (resumo?.porUnidade ?? []).reduce((t, u) => t + u.valor, 0),
    [resumo]
  );

  const sufixo = `${inicio}_a_${fim}`;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Relatórios</h2>
          <p className="text-sm text-gray-500">Tudo exportável em CSV</p>
        </div>
        <span className="shrink-0 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg px-2.5 py-1.5">
          {rotuloPeriodo(periodo, de, ate)}
        </span>
      </div>

      <SeletorPeriodo
        periodo={periodo}
        aoTrocar={setPeriodo}
        de={de}
        ate={ate}
        aoTrocarDe={setDe}
        aoTrocarAte={setAte}
      />

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
          {/* 1. Ranking por unidade, com participacao percentual */}
          <Secao
            titulo="Ranking por unidade de negócio"
            descricao="Quem fatura mais e quanto representa do total"
            arquivo={`ranking_unidades_${sufixo}`}
            cabecalho={['Unidade', 'Faturamento', 'Participação (%)']}
            linhas={resumo.porUnidade.map((u) => [
              u.nome,
              u.valor,
              totalUnidades > 0 ? (u.valor / totalUnidades) * 100 : 0,
            ])}
          >
            <div>
              {resumo.porUnidade.map((u) => (
                <Linha
                  key={u.chave}
                  nome={u.nome}
                  valor={brl(u.valor)}
                  detalhe={
                    totalUnidades > 0
                      ? `${((u.valor / totalUnidades) * 100).toFixed(1)}% do total`
                      : undefined
                  }
                />
              ))}
            </div>
          </Secao>

          {/* 2. Ranking por centro de receita */}
          <Secao
            titulo="Ranking por centro de receita"
            descricao="O recorte fino dentro de cada unidade"
            arquivo={`ranking_centros_${sufixo}`}
            cabecalho={['Unidade', 'Centro de receita', 'Faturamento']}
            linhas={resumo.porUnidade.flatMap((u) =>
              (resumo.centrosPorUnidade[u.chave] ?? []).map((c) => [u.nome, c.nome, c.valor])
            )}
          >
            <div>
              {resumo.porUnidade.flatMap((u) =>
                (resumo.centrosPorUnidade[u.chave] ?? []).map((c) => (
                  <Linha
                    key={`${u.chave}-${c.chave}`}
                    nome={c.nome}
                    valor={brl(c.valor)}
                    detalhe={u.nome}
                  />
                ))
              )}
            </div>
          </Secao>

          {/* 3. Faturamento x recebido x a receber */}
          <Secao
            titulo="Faturamento, recebido e a receber"
            descricao="A diferença entre o que foi vendido e o que entrou no caixa"
            arquivo={`faturamento_x_caixa_${sufixo}`}
            cabecalho={['Indicador', 'Valor']}
            linhas={[
              ['Faturamento (competência)', resumo.faturamento],
              ['Recebido (caixa, líquido de taxas)', resumo.recebido],
              ['A receber', resumo.aReceber],
              ['Atrasado', resumo.atrasado],
              ['Diferença faturamento − recebido', round(resumo.faturamento - resumo.recebido)],
            ]}
          >
            <div>
              <Linha nome="Faturamento (competência)" valor={brl(resumo.faturamento)} />
              <Linha nome="Recebido (líquido de taxas)" valor={brl(resumo.recebido)} />
              <Linha nome="A receber" valor={brl(resumo.aReceber)} />
              <Linha nome="Atrasado" valor={brl(resumo.atrasado)} />
              <Linha
                nome="Diferença faturamento − recebido"
                valor={brl(round(resumo.faturamento - resumo.recebido))}
              />
            </div>
          </Secao>

          {/* 4. Hospedagem direta x Booking */}
          <Secao
            titulo="Hospedagem: direta × Booking"
            descricao="Bruto e líquido de comissão. O consumo adicional nunca entra na comissão."
            arquivo={`hospedagem_origem_${sufixo}`}
            cabecalho={['Origem', 'Bruto', 'Comissão', 'Líquido']}
            linhas={hospedagem.map((h) => [h.origem, h.bruto, h.comissao, h.liquido])}
          >
            <div>
              {hospedagem.map((h) => (
                <Linha
                  key={h.origem}
                  nome={h.origem}
                  valor={brl(h.liquido)}
                  detalhe={
                    h.comissao > 0
                      ? `bruto ${brl(h.bruto)} · comissão ${brl(h.comissao)}`
                      : `bruto ${brl(h.bruto)} · sem comissão`
                  }
                />
              ))}
            </div>
          </Secao>

          {/* 5. Consumo adicional por reserva e ticket medio */}
          <Secao
            titulo="Consumo adicional por reserva"
            descricao="Quanto cada hóspede gastou além da hospedagem"
            arquivo={`consumo_por_reserva_${sufixo}`}
            cabecalho={['Hóspede', 'Chalé', 'Hospedagem', 'Consumo adicional', 'Total da conta']}
            linhas={consumo.map((c) => [
              c.hospede,
              c.chale ?? '',
              c.hospedagem,
              c.consumo,
              c.total,
            ])}
          >
            <>
              {ticket && (
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Ticket por reserva com consumo</p>
                    <p className="text-lg font-bold text-gray-900">
                      {brl(Number(ticket.ticket_por_reserva_com_consumo ?? 0))}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {ticket.reservas_com_consumo} reserva(s)
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 mb-0.5">Ticket por reserva do período</p>
                    <p className="text-lg font-bold text-gray-900">
                      {brl(Number(ticket.ticket_por_reserva_total ?? 0))}
                    </p>
                    <p className="text-[11px] text-gray-400">
                      {ticket.reservas_no_periodo} reserva(s)
                    </p>
                  </div>
                </div>
              )}
              <div>
                {consumo.map((c) => (
                  <Linha
                    key={c.reserva_id}
                    nome={c.hospede}
                    valor={brl(c.consumo)}
                    detalhe={`${c.chale ?? 'sem chalé'} · conta ${brl(c.total)}`}
                  />
                ))}
              </div>
            </>
          </Secao>

          {/* 6. Recebimentos por forma, com taxas */}
          <Secao
            titulo="Recebimentos por forma de pagamento"
            descricao="Com as taxas efetivamente pagas"
            arquivo={`recebimentos_por_forma_${sufixo}`}
            cabecalho={['Forma', 'Quantidade', 'Bruto', 'Taxa', 'Líquido']}
            linhas={recebimentos.map((r) => [r.forma, r.quantidade, r.bruto, r.taxa, r.liquido])}
          >
            <div>
              {recebimentos.map((r) => (
                <Linha
                  key={r.forma}
                  nome={r.forma}
                  valor={brl(r.liquido)}
                  detalhe={`${r.quantidade}× · bruto ${brl(r.bruto)} · taxa ${brl(r.taxa)}`}
                />
              ))}
            </div>
          </Secao>

          {/* 7. Resultado por unidade com cobertura de custo */}
          <Secao
            titulo="Resultado por unidade"
            descricao="Margem só aparece com cobertura de custo suficiente"
            arquivo={`resultado_unidades_${sufixo}`}
            cabecalho={[
              'Unidade',
              'Receita',
              'CMV',
              'Custos da unidade',
              'Cobertura (%)',
              'Situação',
              'Margem',
            ]}
            linhas={resultado.map((r) => [
              r.unidade,
              Number(r.receita_liquida),
              r.cmv == null ? '' : Number(r.cmv),
              Number(r.custos_unidade),
              r.controla_custo ? Number(r.cobertura_custo) * 100 : '',
              situacao(r),
              r.controla_custo && r.margem != null ? Number(r.margem) : situacao(r),
            ])}
          >
            <div>
              {resultado.map((r) => (
                <Linha
                  key={r.unidade_slug}
                  nome={r.unidade}
                  valor={
                    r.controla_custo && r.margem != null ? brl(Number(r.margem)) : '—'
                  }
                  detalhe={`receita ${brl(Number(r.receita_liquida))} · ${
                    r.controla_custo
                      ? `cobertura ${(Number(r.cobertura_custo) * 100).toFixed(0)}%${
                          r.margem == null ? ' · margem não calculável' : ''
                        }`
                      : 'unidade não controla custo'
                  }`}
                />
              ))}
            </div>
          </Secao>
        </>
      )}
    </div>
  );
}

function round(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Unidade sem controle de custo nao tem margem "faltando": e decisao de
 * cadastro. Misturar as duas coisas faria o relatorio mentir.
 */
function situacao(r: ResultadoUnidade): string {
  if (!r.controla_custo) return 'não controla custo';
  if (r.margem == null) return 'custo incompleto, margem não calculável';
  return r.cobertura_status === 'parcial' ? 'margem parcial' : 'margem completa';
}

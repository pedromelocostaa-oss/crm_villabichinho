import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleAlert, Plus, X } from 'lucide-react';
import { atualizarProduto, criarProduto } from '../lib/financeiro';
import { buscarCatalogo } from '../hooks/useCatalogo';
import { brl, paraNumero } from '../utils/moeda';
import type { BusinessUnit, ProductCatalog, RevenueCenter } from '../types/database';

export function CatalogoProdutos() {
  const [unidades, setUnidades] = useState<BusinessUnit[]>([]);
  const [centros, setCentros] = useState<RevenueCenter[]>([]);
  const [produtos, setProdutos] = useState<ProductCatalog[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formAberto, setFormAberto] = useState(false);

  const [centroId, setCentroId] = useState('');
  const [nome, setNome] = useState('');
  const [preco, setPreco] = useState('');
  const [custo, setCusto] = useState('');
  const [salvando, setSalvando] = useState(false);

  const aplicar = useCallback((dados: Awaited<ReturnType<typeof buscarCatalogo>>) => {
    setUnidades(dados.unidades);
    setCentros(dados.centros);
    setProdutos(dados.produtos);
    setErro(null);
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    try {
      aplicar(await buscarCatalogo(true));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o catálogo');
    } finally {
      setCarregando(false);
    }
  }, [aplicar]);

  // Nada de setState sincrono dentro do efeito.
  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        const dados = await buscarCatalogo(true);
        if (ativo) aplicar(dados);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o catálogo');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [aplicar]);

  const centroPorId = useMemo(() => new Map(centros.map((c) => [c.id, c])), [centros]);

  const agrupado = useMemo(() => {
    return unidades
      .map((u) => {
        const idsCentros = new Set(
          centros.filter((c) => c.business_unit_id === u.id).map((c) => c.id)
        );
        return { unidade: u, itens: produtos.filter((p) => idsCentros.has(p.revenue_center_id)) };
      })
      .filter((g) => g.itens.length > 0);
  }, [centros, produtos, unidades]);

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      await criarProduto({
        revenue_center_id: centroId,
        nome: nome.trim(),
        preco_padrao: paraNumero(preco),
        // Custo e sempre opcional: nunca trava o cadastro.
        custo_padrao: custo.trim() ? paraNumero(custo) : null,
      });
      setNome('');
      setPreco('');
      setCusto('');
      setFormAberto(false);
      await recarregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao salvar o produto');
    } finally {
      setSalvando(false);
    }
  }

  async function alternarAtivo(p: ProductCatalog) {
    await atualizarProduto(p.id, { ativo: !p.ativo });
    await recarregar();
  }

  if (carregando) {
    return <p className="text-sm text-gray-400 py-12 text-center">Carregando…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Catálogo de produtos</h2>
          <p className="text-sm text-gray-500">
            Preço e custo preenchidos aqui aceleram o lançamento no balcão.
          </p>
        </div>
        <button
          onClick={() => {
            setFormAberto((v) => !v);
            if (!centroId) setCentroId(centros[0]?.id ?? '');
          }}
          className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-3.5 py-2 rounded-lg shrink-0"
        >
          {formAberto ? <X size={15} /> : <Plus size={15} />}
          {formAberto ? 'Fechar' : 'Novo'}
        </button>
      </div>

      {erro && (
        <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          {erro}
        </div>
      )}

      {formAberto && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Centro de receita</label>
          <select
            value={centroId}
            onChange={(e) => setCentroId(e.target.value)}
            className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          >
            {centros.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>

          <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Pizza margherita"
            className="w-full mb-3 px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
          />

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço</label>
              <input
                value={preco}
                onChange={(e) => setPreco(e.target.value)}
                inputMode="decimal"
                placeholder="0,00"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custo <span className="text-gray-400 font-normal">(opcional)</span>
              </label>
              <input
                value={custo}
                onChange={(e) => setCusto(e.target.value)}
                inputMode="decimal"
                placeholder="—"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
              />
            </div>
          </div>

          <button
            disabled={salvando || !nome.trim() || paraNumero(preco) <= 0 || !centroId}
            onClick={salvar}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-medium py-2.5 rounded-lg"
          >
            {salvando ? 'Salvando…' : 'Salvar produto'}
          </button>
        </div>
      )}

      {agrupado.length === 0 && !formAberto && (
        <p className="text-sm text-gray-400 py-10 text-center">
          Nenhum produto cadastrado. O lançamento rápido continua funcionando por valor livre.
        </p>
      )}

      <div className="space-y-6">
        {agrupado.map(({ unidade, itens }) => (
          <section key={unidade.id}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: unidade.cor }} />
              <h3 className="text-sm font-semibold text-gray-900">{unidade.nome}</h3>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {itens.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-4 py-3">
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${p.ativo ? 'text-gray-900' : 'text-gray-400 line-through'}`}
                    >
                      {p.nome}
                    </p>
                    <p className="text-xs text-gray-500">
                      {centroPorId.get(p.revenue_center_id)?.nome}
                      {p.custo_padrao != null
                        ? ` · custo ${brl(Number(p.custo_padrao))}`
                        : ' · sem custo'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-gray-700">{brl(Number(p.preco_padrao))}</span>
                    <button
                      onClick={() => alternarAtivo(p)}
                      className="text-xs text-gray-400 hover:text-gray-700"
                    >
                      {p.ativo ? 'Desativar' : 'Ativar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

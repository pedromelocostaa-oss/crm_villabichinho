import { useCallback, useEffect, useState } from 'react';
import { listarCentros, listarProdutos, listarUnidades } from '../lib/financeiro';
import type { BusinessUnit, ProductCatalog, RevenueCenter } from '../types/database';

type Catalogo = {
  unidades: BusinessUnit[];
  centros: RevenueCenter[];
  produtos: ProductCatalog[];
};

const VAZIO: Catalogo = { unidades: [], centros: [], produtos: [] };

export async function buscarCatalogo(incluirInativos = false): Promise<Catalogo> {
  const [unidades, centros, produtos] = await Promise.all([
    listarUnidades(),
    listarCentros(),
    listarProdutos(undefined, incluirInativos),
  ]);
  return { unidades, centros, produtos };
}

export function useCatalogo() {
  const [catalogo, setCatalogo] = useState<Catalogo>(VAZIO);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  // A primeira carga nao mexe em estado antes do await: setState sincrono
  // dentro do efeito dispara renders em cascata.
  useEffect(() => {
    let ativo = true;

    void (async () => {
      try {
        const dados = await buscarCatalogo();
        if (ativo) setCatalogo(dados);
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Falha ao carregar o catálogo');
      } finally {
        if (ativo) setCarregando(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, []);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setCatalogo(await buscarCatalogo());
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao carregar o catálogo');
    } finally {
      setCarregando(false);
    }
  }, []);

  const centrosDaUnidade = useCallback(
    (unidadeId: string) => catalogo.centros.filter((c) => c.business_unit_id === unidadeId),
    [catalogo.centros]
  );

  const produtosDaUnidade = useCallback(
    (unidadeId: string) => {
      const ids = new Set(centrosDaUnidade(unidadeId).map((c) => c.id));
      return catalogo.produtos.filter((p) => ids.has(p.revenue_center_id));
    },
    [catalogo.produtos, centrosDaUnidade]
  );

  return {
    unidades: catalogo.unidades,
    centros: catalogo.centros,
    produtos: catalogo.produtos,
    carregando,
    erro,
    recarregar,
    centrosDaUnidade,
    produtosDaUnidade,
  };
}

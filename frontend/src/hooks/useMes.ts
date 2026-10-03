import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { MesResponse, PatchContaBody, PatchReceitaBody } from "../api/types.ts";

interface State {
  data: MesResponse | null;
  loading: boolean;
  error: string | null;
}

/**
 * Carrega o mes e expoe as duas acoes de escrita. Depois de um PATCH
 * recarrega o mes inteiro: os indicadores sao calculados no servidor.
 */
export function useMes(ym: string) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  const load = useCallback(async (silent = false) => {
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await api.getMes(ym);
      setState({ data, loading: false, error: null });
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : "Erro ao carregar o mês.",
      }));
    }
  }, [ym]);

  useEffect(() => {
    void load();
  }, [load]);

  const salvarConta = useCallback(
    async (id: string, body: PatchContaBody) => {
      await api.patchConta(ym, id, body);
      await load(true);
    },
    [ym, load],
  );

  const salvarReceita = useCallback(
    async (id: string, body: PatchReceitaBody) => {
      await api.patchReceita(ym, id, body);
      await load(true);
    },
    [ym, load],
  );

  return { ...state, reload: load, salvarConta, salvarReceita };
}

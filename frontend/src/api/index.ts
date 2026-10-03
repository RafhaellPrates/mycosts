import { http } from "./client.ts";
import { mockApi } from "./mock.ts";
import type { Api, Conta, MesResponse, PatchContaBody, PatchReceitaBody, Receita } from "./types.ts";

const realApi: Api = {
  getMes: (ym) => http.get<MesResponse>(`/mes/${ym}`),
  patchConta: (ym, linha, body: PatchContaBody) =>
    http.patch<Conta>(`/mes/${ym}/contas/${linha}`, body),
  patchReceita: (ym, linha, body: PatchReceitaBody) =>
    http.patch<Receita>(`/mes/${ym}/receitas/${linha}`, body),
};

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === "true";

export const api: Api = USE_MOCK ? mockApi : realApi;

export type { Conta, MesResponse, Receita } from "./types.ts";

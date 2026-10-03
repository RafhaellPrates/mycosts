import { http } from "./client.ts";
import type {
  AuthResponse,
  Conta,
  ContaCadastro,
  ContaCadastroBody,
  Fonte,
  Lancamento,
  LancamentoBody,
  MesResponse,
  PatchContaBody,
  PatchReceitaBody,
  PerfilBody,
  Receita,
  Usuario,
} from "./types.ts";

export const api = {
  // auth
  login: (email: string, senha: string) => http.post<AuthResponse>("/auth/login", { email, senha }),
  me: () => http.get<{ usuario: Usuario }>("/auth/me"),
  editarPerfil: (body: PerfilBody) => http.patch<{ usuario: Usuario }>("/auth/me", body),

  // mes
  getMes: (ym: string) => http.get<MesResponse>(`/mes/${ym}`),
  patchConta: (ym: string, id: string, body: PatchContaBody) =>
    http.patch<Conta>(`/mes/${ym}/contas/${id}`, body),
  patchReceita: (ym: string, id: string, body: PatchReceitaBody) =>
    http.patch<Receita>(`/mes/${ym}/receitas/${id}`, body),

  // lancamentos avulsos
  criarLancamento: (body: LancamentoBody) => http.post<Lancamento>("/lancamentos", body),
  editarLancamento: (id: string, body: Partial<LancamentoBody>) => http.patch<Lancamento>(`/lancamentos/${id}`, body),
  apagarLancamento: (id: string) => http.delete<void>(`/lancamentos/${id}`),

  // cadastro
  categorias: () => http.get<{ categorias: string[] }>("/categorias"),
  contas: () => http.get<{ contas: ContaCadastro[] }>("/contas"),
  criarConta: (body: ContaCadastroBody) => http.post<ContaCadastro>("/contas", body),
  editarConta: (id: string, body: Partial<ContaCadastroBody> & { ativa?: boolean }) =>
    http.patch<ContaCadastro>(`/contas/${id}`, body),
  fontes: () => http.get<{ fontes: Fonte[] }>("/fontes"),
  criarFonte: (nome: string) => http.post<Fonte>("/fontes", { nome }),
  editarFonte: (id: string, body: { nome?: string; ativa?: boolean }) => http.patch<Fonte>(`/fontes/${id}`, body),
};

export type { Conta, MesResponse, Receita } from "./types.ts";

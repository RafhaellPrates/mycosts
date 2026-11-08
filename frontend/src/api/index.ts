import { baixar, buscarBlob, enviarArquivo, http } from "./client.ts";
import type {
  AlvoComprovante,
  Comprovante,
  Assinatura,
  AssinaturaBody,
  NotificacoesStatus,
  Cartao,
  CartaoBody,
  Fatura,
  CartoesResponse,
  Acesso,
  AcessoBody,
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
  /** login = email ou nome. */
  login: (login: string, senha: string) => http.post<AuthResponse>("/auth/login", { login, senha }),
  /** Cria um usuario temporario com dados de exemplo. */
  visitante: () => http.post<AuthResponse>("/auth/visitante", {}),
  me: () => http.get<{ usuario: Usuario }>("/auth/me"),
  editarPerfil: (body: PerfilBody) => http.patch<{ usuario: Usuario }>("/auth/me", body),
  trocarFoto: (foto: Blob) => enviarArquivo<{ usuario: Usuario }>("PUT", "/auth/me/foto", foto),
  removerFoto: () => http.delete<{ usuario: Usuario }>("/auth/me/foto"),
  foto: () => buscarBlob("/auth/me/foto"),

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

  // comprovantes dos gastos
  comprovantes: (alvo: AlvoComprovante) =>
    http.get<{ comprovantes: Comprovante[] }>(`/comprovantes?${new URLSearchParams(alvo)}`),
  anexarComprovante: (alvo: AlvoComprovante, arquivo: Blob, nome: string) =>
    enviarArquivo<Comprovante>("POST", `/comprovantes?${new URLSearchParams(alvo)}`, arquivo, nome),
  arquivoComprovante: (id: string) => buscarBlob(`/comprovantes/${id}`),
  apagarComprovante: (id: string) => http.delete<void>(`/comprovantes/${id}`),

  // cartoes
  cartoes: () => http.get<CartoesResponse>("/cartoes"),
  criarCartao: (body: CartaoBody) => http.post<Cartao>("/cartoes", body),
  editarCartao: (id: string, body: Partial<CartaoBody>) => http.patch<Cartao>(`/cartoes/${id}`, body),
  apagarCartao: (id: string) => http.delete<void>(`/cartoes/${id}`),
  fatura: (id: string, ym: string) => http.get<Fatura>(`/cartoes/${id}/fatura/${ym}`),
  criarAssinatura: (cartaoId: string, body: AssinaturaBody) =>
    http.post<Assinatura>(`/cartoes/${cartaoId}/assinaturas`, body),
  editarAssinatura: (id: string, body: Partial<AssinaturaBody> & { cartaoId?: string }) =>
    http.patch<Assinatura>(`/cartoes/assinaturas/${id}`, body),
  /** data null reativa. */
  cancelarAssinatura: (id: string, data: string | null) =>
    http.post<Assinatura>(`/cartoes/assinaturas/${id}/cancelar`, { data }),
  apagarAssinatura: (id: string) => http.delete<void>(`/cartoes/assinaturas/${id}`),

  // notificacoes (Web Push)
  notificacoes: () => http.get<NotificacoesStatus>("/notificacoes"),
  inscreverPush: (inscricao: PushSubscriptionJSON) => http.post<{ ok: true }>("/notificacoes/inscricao", inscricao),
  desinscreverPush: (endpoint: string) => http.deleteCom<void>("/notificacoes/inscricao", { endpoint }),
  testarPush: () => http.post<{ entregues: number }>("/notificacoes/teste", {}),

  // exportacao
  baixarPlanilha: (ano: string) => baixar(`/export/${ano}.xlsx`, `Controle_Financeiro_${ano}.xlsx`),

  // admin
  acessos: () => http.get<{ usuarios: Acesso[] }>("/admin/usuarios"),
  criarAcesso: (body: Required<Omit<AcessoBody, "papel">> & Pick<AcessoBody, "papel">) =>
    http.post<Acesso>("/admin/usuarios", body),
  editarAcesso: (id: string, body: AcessoBody) => http.patch<Acesso>(`/admin/usuarios/${id}`, body),
  apagarAcesso: (id: string) => http.delete<void>(`/admin/usuarios/${id}`),

  // cadastro
  categorias: () => http.get<{ categorias: string[] }>("/categorias"),
  contas: () => http.get<{ contas: ContaCadastro[] }>("/contas"),
  criarConta: (body: ContaCadastroBody) => http.post<ContaCadastro>("/contas", body),
  editarConta: (id: string, body: Partial<ContaCadastroBody> & { ativa?: boolean }) =>
    http.patch<ContaCadastro>(`/contas/${id}`, body),
  apagarConta: (id: string) => http.delete<void>(`/contas/${id}`),
  fontes: () => http.get<{ fontes: Fonte[] }>("/fontes"),
  criarFonte: (body: { nome: string; previsto: number }) => http.post<Fonte>("/fontes", body),
  editarFonte: (id: string, body: { nome?: string; previsto?: number; ativa?: boolean }) =>
    http.patch<Fonte>(`/fontes/${id}`, body),
  apagarFonte: (id: string) => http.delete<void>(`/fontes/${id}`),
};

export type { Conta, MesResponse, Receita } from "./types.ts";

/**
 * Contrato da API. Espelha backend/src/mes/types.ts e as rotas de
 * auth e cadastro do back.
 */

export type Situacao = "Pago" | "Pendente" | "Não se aplica" | "";

export interface Conta {
  id: string;
  nome: string;
  categoria: string;
  diaVenc: number | null;
  previsto: number;
  /** Valor pago no mes; null = nada informado. */
  pago: number | null;
  situacao: Situacao;
}

export interface Receita {
  id: string;
  fonte: string;
  valor: number | null;
}

export const FORMAS_PAGAMENTO = ["Crédito", "Débito", "Pix", "Dinheiro"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

/** Gasto avulso. Conta no mes da data, mesmo no credito. */
export interface Lancamento {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  formaPagamento: FormaPagamento;
}

export type LancamentoBody = Omit<Lancamento, "id">;

export interface Indicadores {
  receitasMes: number;
  contasPrevistas: number;
  /** Todas as contas pagas no mes, inclusive faturas de cartao. */
  contasPagas: number;
  emAberto: number;
  avulsosMes: number;
  /** Contas pagas sem as faturas + avulsos: o que foi gasto no mes. */
  gastosMes: number;
  /** 0..1 */
  pctRendaComprometida: number | null;
  faturasCartao: number;
  pendentesQtd: number;
  receitasAno: number;
  gastosAno: number;
  saldoAno: number;
}

export interface CategoriaGasto {
  categoria: string;
  valor: number;
  /** 0..1 */
  pct: number;
}

export interface ResumoMensal {
  ym: string;
  receitas: number;
  gastos: number;
  saldo: number;
}

export interface MesResponse {
  ym: string;
  contas: Conta[];
  receitas: Receita[];
  lancamentos: Lancamento[];
  indicadores: Indicadores;
  categorias: CategoriaGasto[];
  resumoAnual: ResumoMensal[];
}

export interface PatchContaBody {
  pago: number | null;
  situacao: Situacao;
}

export interface PatchReceitaBody {
  valor: number | null;
}

// ---- auth ----

export interface Usuario {
  id: string;
  email: string;
  nome: string;
}

/** senhaAtual e obrigatoria quando troca email ou senha. */
export interface PerfilBody {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

// ---- cadastro ----

export interface ContaCadastro {
  id: string;
  nome: string;
  categoria: string;
  diaVenc: number | null;
  previsto: number;
  ativa: boolean;
  ordem: number;
}

export type ContaCadastroBody = Pick<ContaCadastro, "nome" | "categoria" | "diaVenc" | "previsto">;

export interface Fonte {
  id: string;
  nome: string;
  ativa: boolean;
  ordem: number;
}

/** Contrato da API do mes. Espelha frontend/src/api/types.ts. */

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

/** Gasto avulso. Conta no mes da data, mesmo no credito. */
export interface Lancamento {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  categoria: string;
  valor: number;
  formaPagamento: "Crédito" | "Débito" | "Pix" | "Dinheiro";
}

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

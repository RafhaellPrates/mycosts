/**
 * Contrato da API do mes. Espelha frontend/src/api/types.ts; a unica mudanca
 * em relacao a fase da planilha e `id` (uuid) no lugar de `linha`.
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

export interface Indicadores {
  receitasMes: number;
  contasPrevistas: number;
  contasPagas: number;
  emAberto: number;
  /** 0..1 */
  pctRendaComprometida: number | null;
  faturasCartao: number;
  pendentesQtd: number;
  receitasAno: number;
  pagoAno: number;
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
  pagas: number;
  saldo: number;
}

export interface MesResponse {
  ym: string;
  contas: Conta[];
  receitas: Receita[];
  indicadores: Indicadores;
  categorias: CategoriaGasto[];
  resumoAnual: ResumoMensal[];
}

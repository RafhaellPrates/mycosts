/**
 * Contrato da API (fase A). O back monta isso lendo a planilha;
 * o front nunca conhece celula, so estes objetos.
 */

export type Situacao = "Pago" | "Pendente" | "Não se aplica" | "";

export interface Conta {
  /** Linha da conta na aba Controle Mensal (6..17). Identifica a conta nos PATCH. */
  linha: number;
  nome: string;
  categoria: string;
  diaVenc: number | null;
  previsto: number;
  /** Valor pago no mes; null = celula vazia. */
  pago: number | null;
  situacao: Situacao;
}

export interface Receita {
  /** Linha da fonte na aba Receitas (5..14). */
  linha: number;
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

export interface PatchContaBody {
  pago: number | null;
  situacao: Situacao;
}

export interface PatchReceitaBody {
  valor: number | null;
}

export interface Api {
  getMes(ym: string): Promise<MesResponse>;
  patchConta(ym: string, linha: number, body: PatchContaBody): Promise<Conta>;
  patchReceita(ym: string, linha: number, body: PatchReceitaBody): Promise<Receita>;
}

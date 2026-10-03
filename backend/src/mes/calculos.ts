import { CATEGORIAS } from "../cadastro/categorias.js";
import type { CategoriaGasto, Conta, Indicadores, Receita, ResumoMensal } from "./types.js";

/** Formulas da aba Painel da planilha, agora calculadas no back. */

const centavos = (v: number) => Math.round(v * 100) / 100;

export function soma(ns: (number | null)[]): number {
  return centavos(ns.reduce<number>((a, b) => a + (b ?? 0), 0));
}

export function indicadores(contas: Conta[], receitas: Receita[], ano: ResumoMensal[]): Indicadores {
  const receitasMes = soma(receitas.map((r) => r.valor));
  const contasPrevistas = soma(contas.map((c) => c.previsto));
  const contasPagas = soma(contas.map((c) => c.pago));
  const receitasAno = soma(ano.map((a) => a.receitas));
  const pagoAno = soma(ano.map((a) => a.pagas));
  return {
    receitasMes,
    contasPrevistas,
    contasPagas,
    emAberto: centavos(Math.max(contasPrevistas - contasPagas, 0)),
    pctRendaComprometida: receitasMes > 0 ? contasPrevistas / receitasMes : null,
    faturasCartao: soma(contas.filter((c) => c.categoria === "Cartões").map((c) => c.pago)),
    pendentesQtd: contas.filter((c) => c.situacao !== "Pago" && c.situacao !== "Não se aplica").length,
    receitasAno,
    pagoAno,
    saldoAno: centavos(receitasAno - pagoAno),
  };
}

export function categorias(contas: Conta[]): CategoriaGasto[] {
  const total = soma(contas.map((c) => c.pago));
  return CATEGORIAS.map((categoria) => {
    const valor = soma(contas.filter((c) => c.categoria === categoria).map((c) => c.pago));
    return { categoria, valor, pct: total > 0 ? valor / total : 0 };
  });
}

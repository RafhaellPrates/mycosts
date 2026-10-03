import { CATEGORIAS, CATEGORIA_CARTOES } from "../cadastro/categorias.js";
import type { CategoriaGasto, Conta, Indicadores, Lancamento, Receita, ResumoMensal } from "./types.js";

/** Formulas da aba Painel da planilha, agora calculadas no back. */

const centavos = (v: number) => Math.round(v * 100) / 100;

export function soma(ns: (number | null)[]): number {
  return centavos(ns.reduce<number>((a, b) => a + (b ?? 0), 0));
}

// Fatura paga nao e gasto: as compras no credito ja contaram como avulsos
// no dia da compra. Ela continua nas contas a pagar.
const naoFatura = (c: Conta) => c.categoria !== CATEGORIA_CARTOES;

export function indicadores(
  contas: Conta[],
  receitas: Receita[],
  lancamentos: Lancamento[],
  ano: ResumoMensal[],
): Indicadores {
  const receitasMes = soma(receitas.map((r) => r.valor));
  const contasPrevistas = soma(contas.map((c) => c.previsto));
  const contasPagas = soma(contas.map((c) => c.pago));
  const avulsosMes = soma(lancamentos.map((l) => l.valor));
  const receitasAno = soma(ano.map((a) => a.receitas));
  const gastosAno = soma(ano.map((a) => a.gastos));
  return {
    receitasMes,
    contasPrevistas,
    contasPagas,
    emAberto: centavos(Math.max(contasPrevistas - contasPagas, 0)),
    avulsosMes,
    gastosMes: centavos(soma(contas.filter(naoFatura).map((c) => c.pago)) + avulsosMes),
    pctRendaComprometida: receitasMes > 0 ? contasPrevistas / receitasMes : null,
    faturasCartao: soma(contas.filter((c) => !naoFatura(c)).map((c) => c.pago)),
    pendentesQtd: contas.filter((c) => c.situacao !== "Pago" && c.situacao !== "Não se aplica").length,
    receitasAno,
    gastosAno,
    saldoAno: centavos(receitasAno - gastosAno),
  };
}

export function categorias(contas: Conta[], lancamentos: Lancamento[]): CategoriaGasto[] {
  const itens = [
    ...contas.filter(naoFatura).map((c) => ({ categoria: c.categoria, valor: c.pago })),
    ...lancamentos.map((l) => ({ categoria: l.categoria, valor: l.valor })),
  ];
  const total = soma(itens.map((i) => i.valor));
  return CATEGORIAS.map((categoria) => {
    const valor = soma(itens.filter((i) => i.categoria === categoria).map((i) => i.valor));
    return { categoria, valor, pct: total > 0 ? valor / total : 0 };
  });
}

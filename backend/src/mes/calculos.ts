import { CATEGORIAS, CATEGORIA_CARTOES } from "../cadastro/categorias.js";
import type { CategoriaGasto, Conta, Indicadores, Lancamento, Receita, ResumoMensal } from "./types.js";

/** Formulas da aba Painel da planilha, agora calculadas no back. */

const centavos = (v: number) => Math.round(v * 100) / 100;

export function soma(ns: (number | null)[]): number {
  return centavos(ns.reduce<number>((a, b) => a + (b ?? 0), 0));
}

// Fatura paga e gasto (categoria Cartões). Compra com cartao fica fora dos
// avulsos para nao contar duas vezes: ela ja esta na fatura.
const ehFatura = (c: Conta) => c.categoria === CATEGORIA_CARTOES;
const foraDoCartao = (l: Lancamento) => !l.cartaoId;
// Conta marcada Nao se aplica no mes fica fora de todas as contas: previsto,
// pago, gasto, em aberto e categorias. Voltando a se aplicar, volta a contar.
const seAplica = (c: Conta) => c.situacao !== "Não se aplica";

export function indicadores(
  contas: Conta[],
  receitas: Receita[],
  lancamentos: Lancamento[],
  ano: ResumoMensal[],
): Indicadores {
  contas = contas.filter(seAplica);
  const receitasMes = soma(receitas.map((r) => r.valor));
  const contasPrevistas = soma(contas.map((c) => c.previsto));
  const contasPagas = soma(contas.map((c) => c.pago));
  const avulsosMes = soma(lancamentos.filter(foraDoCartao).map((l) => l.valor));
  const receitasAno = soma(ano.map((a) => a.receitas));
  const gastosAno = soma(ano.map((a) => a.gastos));
  // Conta paga, mesmo com valor diferente do previsto, nao deixa saldo em aberto.
  const pendentes = contas.filter((c) => c.situacao !== "Pago");
  return {
    receitasMes,
    contasPrevistas,
    contasPagas,
    emAberto: soma(pendentes.map((c) => Math.max(c.previsto - (c.pago ?? 0), 0))),
    avulsosMes,
    gastosMes: centavos(contasPagas + avulsosMes),
    pctRendaComprometida: receitasMes > 0 ? contasPrevistas / receitasMes : null,
    faturasCartao: soma(contas.filter(ehFatura).map((c) => c.pago)),
    pendentesQtd: pendentes.length,
    receitasAno,
    gastosAno,
    saldoAno: centavos(receitasAno - gastosAno),
  };
}

export function categorias(contas: Conta[], lancamentos: Lancamento[]): CategoriaGasto[] {
  const itens = [
    ...contas.filter(seAplica).map((c) => ({ categoria: c.categoria, valor: c.pago })),
    ...lancamentos.filter(foraDoCartao).map((l) => ({ categoria: l.categoria, valor: l.valor })),
  ];
  const total = soma(itens.map((i) => i.valor));
  return CATEGORIAS.map((categoria) => {
    const valor = soma(itens.filter((i) => i.categoria === categoria).map((i) => i.valor));
    return { categoria, valor, pct: total > 0 ? valor / total : 0 };
  });
}

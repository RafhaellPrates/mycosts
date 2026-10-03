import type {
  Api,
  CategoriaGasto,
  Conta,
  Indicadores,
  MesResponse,
  PatchContaBody,
  PatchReceitaBody,
  Receita,
  ResumoMensal,
} from "./types.ts";

/**
 * Dados de exemplo copiados da planilha real (setembro/2026) pra desenvolver
 * a tela sem backend. Tudo fica em memoria: recarregou a pagina, voltou ao inicio.
 * Liga com VITE_USE_MOCK=true.
 */

interface ContaBase {
  linha: number;
  nome: string;
  categoria: string;
  diaVenc: number | null;
  previsto: number;
}

const CADASTRO: ContaBase[] = [
  { linha: 6, nome: "Parcela Lote", categoria: "Moradia", diaVenc: 25, previsto: 386.94 },
  { linha: 7, nome: "Parcela Maquina de lavar roupas", categoria: "Moradia", diaVenc: 25, previsto: 469.5 },
  { linha: 8, nome: "Internet Fibra", categoria: "Utilidades", diaVenc: 10, previsto: 99.99 },
  { linha: 9, nome: "Cartão de Crédito Nubank", categoria: "Cartões", diaVenc: 3, previsto: 507.43 },
  { linha: 10, nome: "Cartão de Crédito Inter", categoria: "Cartões", diaVenc: 12, previsto: 699.27 },
  { linha: 11, nome: "Faculdade", categoria: "Educação", diaVenc: 8, previsto: 182.85 },
  { linha: 12, nome: "Aporte em Investimentos", categoria: "Investimentos", diaVenc: 3, previsto: 500 },
  { linha: 13, nome: "Corte de cabelo", categoria: "Saúde", diaVenc: null, previsto: 35 },
];

const FONTES: { linha: number; fonte: string }[] = [
  { linha: 5, fonte: "Salário" },
  { linha: 6, fonte: "Freelance / PJ" },
  { linha: 7, fonte: "Rendimentos de Investimentos" },
  { linha: 8, fonte: "Cartão alimentação" },
];

const CATEGORIAS = [
  "Moradia", "Utilidades", "Alimentação", "Transporte", "Saúde", "Educação",
  "Lazer", "Cartões", "Dívidas", "Impostos", "Investimentos", "Outros",
];

type Celula = { pago: number | null; situacao: Conta["situacao"] };

/** grade[ym][linha] */
const pagos = new Map<string, Map<number, Celula>>();
const receitas = new Map<string, Map<number, number | null>>();

function seed() {
  const set = new Map<number, Celula>();
  for (const c of CADASTRO) set.set(c.linha, { pago: c.previsto, situacao: "Pago" });
  pagos.set("2026-09", set);
  receitas.set("2026-09", new Map([[5, 2841.22], [8, 100]]));

  // outubro: contas em aberto, pra testar o fluxo de dar baixa
  const out = new Map<number, Celula>();
  for (const c of CADASTRO) out.set(c.linha, { pago: null, situacao: "Pendente" });
  out.set(8, { pago: 99.99, situacao: "Pago" });
  pagos.set("2026-10", out);
  receitas.set("2026-10", new Map([[5, 2841.22]]));
}
seed();

function cel(ym: string, linha: number): Celula {
  return pagos.get(ym)?.get(linha) ?? { pago: null, situacao: "" };
}

function contasDo(ym: string): Conta[] {
  return CADASTRO.map((c) => ({ ...c, ...cel(ym, c.linha) }));
}

function receitasDo(ym: string): Receita[] {
  const m = receitas.get(ym);
  return FONTES.map((f) => ({ ...f, valor: m?.get(f.linha) ?? null }));
}

function soma(ns: (number | null)[]): number {
  return ns.reduce<number>((a, b) => a + (b ?? 0), 0);
}

function mesesDoAno(ym: string): string[] {
  const y = ym.slice(0, 4);
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}

function resumo(ym: string): ResumoMensal {
  const rec = soma(receitasDo(ym).map((r) => r.valor));
  const pag = soma(contasDo(ym).map((c) => c.pago));
  return { ym, receitas: rec, pagas: pag, saldo: rec - pag };
}

function indicadores(ym: string): Indicadores {
  const contas = contasDo(ym);
  const r = resumo(ym);
  const previstas = soma(contas.map((c) => c.previsto));
  const ano = mesesDoAno(ym).map(resumo);
  const receitasAno = soma(ano.map((a) => a.receitas));
  const pagoAno = soma(ano.map((a) => a.pagas));
  return {
    receitasMes: r.receitas,
    contasPrevistas: previstas,
    contasPagas: r.pagas,
    emAberto: Math.max(previstas - r.pagas, 0),
    pctRendaComprometida: r.receitas > 0 ? previstas / r.receitas : null,
    faturasCartao: soma(contas.filter((c) => c.categoria === "Cartões").map((c) => c.pago)),
    pendentesQtd: contas.filter((c) => c.situacao !== "Pago" && c.situacao !== "Não se aplica").length,
    receitasAno,
    pagoAno,
    saldoAno: receitasAno - pagoAno,
  };
}

function categorias(ym: string): CategoriaGasto[] {
  const contas = contasDo(ym);
  const total = soma(contas.map((c) => c.pago));
  return CATEGORIAS.map((categoria) => {
    const valor = soma(contas.filter((c) => c.categoria === categoria).map((c) => c.pago));
    return { categoria, valor, pct: total > 0 ? valor / total : 0 };
  });
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const mockApi: Api = {
  async getMes(ym: string): Promise<MesResponse> {
    await delay(250);
    return {
      ym,
      contas: contasDo(ym),
      receitas: receitasDo(ym),
      indicadores: indicadores(ym),
      categorias: categorias(ym),
      resumoAnual: mesesDoAno(ym).map(resumo),
    };
  },

  async patchConta(ym: string, linha: number, body: PatchContaBody): Promise<Conta> {
    await delay(300);
    const base = CADASTRO.find((c) => c.linha === linha);
    if (!base) throw new Error(`Conta na linha ${linha} não existe.`);
    if (!pagos.has(ym)) pagos.set(ym, new Map());
    pagos.get(ym)!.set(linha, { pago: body.pago, situacao: body.situacao });
    return { ...base, ...cel(ym, linha) };
  },

  async patchReceita(ym: string, linha: number, body: PatchReceitaBody): Promise<Receita> {
    await delay(300);
    const f = FONTES.find((x) => x.linha === linha);
    if (!f) throw new Error(`Fonte na linha ${linha} não existe.`);
    if (!receitas.has(ym)) receitas.set(ym, new Map());
    receitas.get(ym)!.set(linha, body.valor);
    return { ...f, valor: body.valor };
  },
};

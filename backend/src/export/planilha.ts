import ExcelJS from "exceljs";
import { categorias } from "../mes/calculos.js";
import type { Conta, Lancamento, ResumoMensal } from "../mes/types.js";

/**
 * Monta o Controle_Financeiro do ano no layout da planilha original, para
 * o usuario continuar tendo a visao de planilha. As celulas seguem o que
 * scripts/importar-planilha.ts le: com ate 13 contas e 10 fontes o arquivo
 * pode ser importado de volta. Painel sai com valores, sem formulas.
 */

export interface DadosAno {
  ano: number;
  contas: { id: string; nome: string; categoria: string; diaVenc: number | null; previsto: number; ativa: boolean }[];
  pagamentos: { contaId: string; ym: string; pago: number | null; situacao: string | null }[];
  fontes: { id: string; nome: string }[];
  receitas: { fonteId: string; ym: string; valor: number | null }[];
  lancamentos: Lancamento[];
  resumo: ResumoMensal[];
}

// Mesmas posicoes de importar-planilha.ts.
const LINHA_CADASTRO = 5;
const PAGO_OFFSET = 1;
const SITUACAO_OFFSET = 17;
const COL_JAN_CONTROLE = 5; // E
const LINHA_RECEITAS = 5;
const COL_JAN_RECEITAS = 2; // B

const MOEDA = '"R$" #,##0.00';
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function titulo(ws: ExcelJS.Worksheet, texto: string) {
  ws.getCell("A1").value = texto;
  ws.getCell("A1").font = { bold: true, size: 14 };
}

function cabecalho(row: ExcelJS.Row, valores: string[]) {
  row.values = valores;
  row.font = { bold: true };
  row.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });
}

export async function gerarPlanilha(d: DadosAno): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MyCosts";
  const yms = MESES.map((_, i) => `${d.ano}-${String(i + 1).padStart(2, "0")}`);
  const pagamento = new Map(d.pagamentos.map((p) => [`${p.contaId}|${p.ym}`, p]));
  const receita = new Map(d.receitas.map((r) => [`${r.fonteId}|${r.ym}`, r.valor]));

  // ---- Cadastro ----
  const cad = wb.addWorksheet("Cadastro");
  titulo(cad, `Cadastro de contas fixas · ${d.ano}`);
  cabecalho(cad.getRow(LINHA_CADASTRO - 1), ["Conta", "Categoria", "Dia venc.", "Previsto", "Ativa"]);
  d.contas.forEach((c, i) => {
    cad.getRow(LINHA_CADASTRO + i).values = [c.nome, c.categoria, c.diaVenc, c.previsto, c.ativa ? "Sim" : "Não"];
  });
  cad.getColumn(4).numFmt = MOEDA;
  cad.columns.forEach((col, i) => (col.width = [28, 16, 10, 14, 8][i]));

  // ---- Controle Mensal: valor pago e, abaixo, situacao ----
  const ctl = wb.addWorksheet("Controle Mensal");
  titulo(ctl, `Controle mensal · ${d.ano}`);
  const primeiraPago = LINHA_CADASTRO + PAGO_OFFSET;
  // Com mais de 13 contas a secao de situacao desce para nao sobrepor.
  const primeiraSituacao = Math.max(LINHA_CADASTRO + SITUACAO_OFFSET, primeiraPago + d.contas.length + 3);
  const colunasConta = ["Conta", "Categoria", "Dia venc.", "Previsto"];
  ctl.getCell(`A${primeiraPago - 2}`).value = "Valor pago";
  ctl.getCell(`A${primeiraPago - 2}`).font = { bold: true };
  cabecalho(ctl.getRow(primeiraPago - 1), [...colunasConta, ...MESES]);
  ctl.getCell(`A${primeiraSituacao - 2}`).value = "Situação";
  ctl.getCell(`A${primeiraSituacao - 2}`).font = { bold: true };
  cabecalho(ctl.getRow(primeiraSituacao - 1), [...colunasConta, ...MESES]);
  d.contas.forEach((c, i) => {
    const base = [c.nome, c.categoria, c.diaVenc, c.previsto];
    ctl.getRow(primeiraPago + i).values = [...base, ...yms.map((ym) => pagamento.get(`${c.id}|${ym}`)?.pago ?? null)];
    ctl.getRow(primeiraSituacao + i).values = [...base, ...yms.map((ym) => pagamento.get(`${c.id}|${ym}`)?.situacao ?? null)];
    for (let m = 0; m < 12; m++) ctl.getRow(primeiraPago + i).getCell(COL_JAN_CONTROLE + m).numFmt = MOEDA;
    ctl.getRow(primeiraPago + i).getCell(4).numFmt = MOEDA;
    ctl.getRow(primeiraSituacao + i).getCell(4).numFmt = MOEDA;
  });
  ctl.columns.forEach((col, i) => (col.width = i === 0 ? 28 : i === 1 ? 16 : i === 2 ? 10 : 13));
  ctl.views = [{ state: "frozen", xSplit: 1 }];

  // ---- Receitas ----
  const rec = wb.addWorksheet("Receitas");
  titulo(rec, `Receitas · ${d.ano}`);
  cabecalho(rec.getRow(LINHA_RECEITAS - 1), ["Fonte", ...MESES]);
  d.fontes.forEach((f, i) => {
    const row = rec.getRow(LINHA_RECEITAS + i);
    row.values = [f.nome, ...yms.map((ym) => receita.get(`${f.id}|${ym}`) ?? null)];
    for (let m = 0; m < 12; m++) row.getCell(COL_JAN_RECEITAS + m).numFmt = MOEDA;
  });
  rec.columns.forEach((col, i) => (col.width = i === 0 ? 24 : 13));

  // ---- Lancamentos (avulsos) ----
  const lan = wb.addWorksheet("Lançamentos");
  titulo(lan, `Gastos avulsos · ${d.ano}`);
  cabecalho(lan.getRow(4), ["Data", "Descrição", "Categoria", "Forma", "Valor"]);
  [...d.lancamentos]
    .sort((a, b) => a.data.localeCompare(b.data))
    .forEach((l, i) => {
      const [y, m, dia] = l.data.split("-").map(Number);
      const row = lan.getRow(5 + i);
      // Data em UTC: o Excel nao tem fuso e mostraria o dia anterior.
      row.values = [new Date(Date.UTC(y, m - 1, dia)), l.descricao, l.categoria, l.formaPagamento, l.valor];
      row.getCell(1).numFmt = "dd/mm/yyyy";
      row.getCell(5).numFmt = MOEDA;
    });
  lan.columns.forEach((col, i) => (col.width = [12, 32, 16, 12, 13][i]));

  // ---- Painel ----
  const pai = wb.addWorksheet("Painel");
  titulo(pai, "Painel");
  pai.getCell("A3").value = "Ano";
  pai.getCell("B3").value = d.ano; // importar-planilha.ts le o ano daqui
  const receitasAno = d.resumo.reduce((a, r) => a + r.receitas, 0);
  const gastosAno = d.resumo.reduce((a, r) => a + r.gastos, 0);
  pai.getRow(5).values = ["Receitas no ano", receitasAno];
  pai.getRow(6).values = ["Gastos no ano", gastosAno];
  pai.getRow(7).values = ["Saldo do ano", receitasAno - gastosAno];
  pai.getCell("A8").value = "Gastos = contas pagas sem as faturas de cartão + gastos avulsos.";
  pai.getCell("A8").font = { italic: true, color: { argb: "FF6B7280" } };

  cabecalho(pai.getRow(10), ["Mês", "Receitas", "Gastos", "Saldo"]);
  d.resumo.forEach((r, i) => {
    pai.getRow(11 + i).values = [`${MESES[i]}/${String(d.ano).slice(2)}`, r.receitas, r.gastos, r.saldo];
  });

  // Mesma regra do Painel do app, somando o ano inteiro.
  const pagosComoContas: Conta[] = d.pagamentos.map((p) => {
    const c = d.contas.find((x) => x.id === p.contaId)!;
    return { ...c, pago: p.pago, situacao: "", cartaoId: null };
  });
  const porCategoria = categorias(pagosComoContas, d.lancamentos).filter((c) => c.valor > 0);
  cabecalho(pai.getRow(25), ["Categoria", "Gasto no ano", "%"]);
  porCategoria
    .sort((a, b) => b.valor - a.valor)
    .forEach((c, i) => {
      pai.getRow(26 + i).values = [c.categoria, c.valor, c.pct];
      pai.getRow(26 + i).getCell(3).numFmt = "0.0%";
    });
  for (const col of [2, 3, 4]) {
    pai.getColumn(col).eachCell((cell, linha) => {
      if (linha >= 5 && typeof cell.value === "number" && !(col === 3 && linha >= 26)) cell.numFmt = MOEDA;
    });
  }
  pai.getCell("B3").numFmt = "0";
  pai.columns.forEach((col, i) => (col.width = [22, 15, 15, 15][i]));

  wb.views = [{ x: 0, y: 0, width: 10000, height: 20000, firstSheet: 0, activeTab: 4, visibility: "visible" }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}

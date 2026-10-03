import bcrypt from "bcryptjs";
import ExcelJS from "exceljs";
import { CATEGORIAS } from "../cadastro/categorias.js";
import { pool } from "../pool.js";
import { fecharTerminal, perguntarNovaSenha } from "./terminal.js";

/**
 * Importa o Controle_Financeiro_AAAA.xlsx para a conta de um usuario.
 *   npm run importar -- <arquivo.xlsx> <email> [--desde=AAAA-MM] [--substituir]
 *
 * Le Cadastro (contas fixas), Controle Mensal (valor pago e situacao conta x mes)
 * e Receitas (fonte x mes). O ano vem de Painel!B3. Se o email nao tiver conta,
 * pede uma senha e cria. Usuario que ja tem contas so e importado com
 * --substituir, que apaga o cadastro atual dele antes. --desde ignora os meses
 * anteriores (dados de teste). Tudo numa transacao.
 */

type Categoria = (typeof CATEGORIAS)[number];
type Situacao = "Pago" | "Pendente" | "Não se aplica";
const SITUACOES: readonly string[] = ["Pago", "Pendente", "Não se aplica"];

// Layout da planilha (ver aba Instrucoes): Controle Mensal linha N puxa Cadastro linha N-1.
const CADASTRO_LINHAS = { de: 5, ate: 17 };
const PAGO_OFFSET = 1; // Controle Mensal linha 6..17 (valor pago)
const SITUACAO_OFFSET = 17; // Controle Mensal linha 22..33 (situacao)
const COL_JAN_CONTROLE = 5; // E
const RECEITAS_LINHAS = { de: 5, ate: 14 };
const COL_JAN_RECEITAS = 2; // B

interface ContaImport {
  nome: string;
  categoria: Categoria;
  diaVenc: number | null;
  previsto: number;
  ativa: boolean;
  meses: { ym: string; pago: number | null; situacao: Situacao | null }[];
}
interface FonteImport {
  nome: string;
  meses: { ym: string; valor: number }[];
}

/** Valor calculado da celula (resultado da formula quando houver). */
function valor(cell: ExcelJS.Cell): unknown {
  const v = cell.value;
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if ("richText" in v) return v.richText.map((t) => t.text).join("");
    if ("formula" in v || "sharedFormula" in v) return undefined;
  }
  return v;
}
function texto(cell: ExcelJS.Cell): string {
  const v = valor(cell);
  return v === null || v === undefined ? "" : String(v).trim();
}
function numero(cell: ExcelJS.Cell): number | null {
  const v = valor(cell);
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

function aba(wb: ExcelJS.Workbook, nome: string): ExcelJS.Worksheet {
  const ws = wb.getWorksheet(nome);
  if (!ws) throw new Error(`Aba "${nome}" nao encontrada. Esta e a planilha certa?`);
  return ws;
}

export function lerPlanilha(wb: ExcelJS.Workbook, desde = "") {
  const ano = numero(aba(wb, "Painel").getCell("B3"));
  if (!ano || ano < 2000 || ano > 2100) throw new Error("Ano invalido em Painel!B3.");
  const yms = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}`);

  const cadastro = aba(wb, "Cadastro");
  const controle = aba(wb, "Controle Mensal");
  const avisos: string[] = [];

  const contas: ContaImport[] = [];
  for (let l = CADASTRO_LINHAS.de; l <= CADASTRO_LINHAS.ate; l++) {
    const row = cadastro.getRow(l);
    const nome = texto(row.getCell(1));
    if (!nome) continue;

    let categoria = texto(row.getCell(2)) as Categoria;
    if (!CATEGORIAS.includes(categoria)) {
      avisos.push(`Cadastro linha ${l}: categoria "${categoria}" desconhecida, importada como Outros.`);
      categoria = "Outros";
    }
    const dia = numero(row.getCell(3));
    const pagos = controle.getRow(l + PAGO_OFFSET);
    const situacoes = controle.getRow(l + SITUACAO_OFFSET);

    const meses: ContaImport["meses"] = [];
    yms.forEach((ym, i) => {
      if (ym < desde) return;
      const pago = numero(pagos.getCell(COL_JAN_CONTROLE + i));
      const sit = texto(situacoes.getCell(COL_JAN_CONTROLE + i));
      if (sit && !SITUACOES.includes(sit)) {
        avisos.push(`Controle Mensal ${nome} ${ym}: situacao "${sit}" ignorada.`);
      }
      const situacao = SITUACOES.includes(sit) ? (sit as Situacao) : null;
      if (pago !== null || situacao) meses.push({ ym, pago, situacao });
    });

    contas.push({
      nome,
      categoria,
      diaVenc: dia && dia >= 1 && dia <= 31 ? dia : null,
      previsto: Math.max(numero(row.getCell(4)) ?? 0, 0),
      ativa: texto(row.getCell(5)) === "Sim",
      meses,
    });
  }

  const receitas = aba(wb, "Receitas");
  const fontes: FonteImport[] = [];
  for (let l = RECEITAS_LINHAS.de; l <= RECEITAS_LINHAS.ate; l++) {
    const row = receitas.getRow(l);
    const nome = texto(row.getCell(1));
    if (!nome) continue;
    const meses = yms
      .map((ym, i) => ({ ym, valor: numero(row.getCell(COL_JAN_RECEITAS + i)) }))
      .filter((m): m is { ym: string; valor: number } => m.ym >= desde && m.valor !== null && m.valor >= 0);
    fontes.push({ nome, meses });
  }

  return { ano, contas, fontes, avisos };
}

async function main() {
  const args = process.argv.slice(2);
  // No PowerShell o "--" some e o npm fica com as flags, repassando so como
  // npm_config_*; por isso le dos dois lugares.
  const substituir = args.includes("--substituir") || process.env.npm_config_substituir === "true";
  const desde =
    args.find((a) => a.startsWith("--desde="))?.slice("--desde=".length) ?? process.env.npm_config_desde ?? "";
  if (desde && !/^\d{4}-(0[1-9]|1[0-2])$/.test(desde)) {
    console.error("--desde precisa ser AAAA-MM, ex: --desde=2026-09");
    process.exitCode = 1;
    return;
  }
  const [arquivo, emailBruto] = args.filter((a) => !a.startsWith("--"));
  if (!arquivo || !emailBruto) {
    console.error("Uso: npm run importar -- <arquivo.xlsx> <email> [--desde=AAAA-MM] [--substituir]");
    process.exitCode = 1;
    return;
  }
  const email = emailBruto.trim().toLowerCase();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(arquivo);
  const dados = lerPlanilha(wb, desde);

  let { rows } = await pool.query<{ id: string }>("select id from usuarios where email = $1", [email]);
  let usuarioId = rows[0]?.id;
  if (!usuarioId) {
    console.log(`Nao existe conta para ${email}. Vou criar.`);
    ({ rows } = await pool.query<{ id: string }>(
      // Nome provisorio; a pessoa troca na tela de perfil.
      "insert into usuarios (email, senha_hash, nome) values ($1, $2, $3) returning id",
      [email, await bcrypt.hash(await perguntarNovaSenha(), 12), email.split("@")[0]],
    ));
    usuarioId = rows[0]!.id;
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const { rows: ja } = await client.query<{ n: number }>(
      `select (select count(*) from contas where usuario_id = $1)
            + (select count(*) from fontes_receita where usuario_id = $1) as n`,
      [usuarioId],
    );
    if (Number(ja[0]!.n) > 0) {
      if (!substituir) throw new Error(`${email} ja tem dados. Rode de novo com --substituir para apagar e reimportar.`);
      await client.query("delete from contas where usuario_id = $1", [usuarioId]);
      await client.query("delete from fontes_receita where usuario_id = $1", [usuarioId]);
    }

    let lancamentos = 0;
    for (const [ordem, c] of dados.contas.entries()) {
      const { rows: r } = await client.query<{ id: string }>(
        `insert into contas (usuario_id, nome, categoria, dia_venc, previsto, ativa, ordem)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [usuarioId, c.nome, c.categoria, c.diaVenc, c.previsto, c.ativa, ordem + 1],
      );
      for (const m of c.meses) {
        await client.query(
          "insert into pagamentos (conta_id, ym, pago, situacao) values ($1, $2, $3, $4)",
          [r[0]!.id, m.ym, m.pago, m.situacao],
        );
        lancamentos++;
      }
    }
    for (const [ordem, f] of dados.fontes.entries()) {
      const { rows: r } = await client.query<{ id: string }>(
        "insert into fontes_receita (usuario_id, nome, ordem) values ($1, $2, $3) returning id",
        [usuarioId, f.nome, ordem + 1],
      );
      for (const m of f.meses) {
        await client.query("insert into receitas (fonte_id, ym, valor) values ($1, $2, $3)", [r[0]!.id, m.ym, m.valor]);
        lancamentos++;
      }
    }
    await client.query("commit");

    console.log(
      `Importado para ${email} (ano ${dados.ano}${desde ? `, desde ${desde}` : ""}): ${dados.contas.length} contas, ` +
        `${dados.fontes.length} fontes de receita, ${lancamentos} lancamentos mensais.`,
    );
    for (const a of dados.avisos) console.log(`aviso: ${a}`);
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

main()
  .catch((e) => {
    console.error(`Erro: ${(e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    fecharTerminal();
    return pool.end();
  });

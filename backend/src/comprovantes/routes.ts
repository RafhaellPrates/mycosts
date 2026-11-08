import { Router } from "express";
import { z } from "zod";
import { TIPOS_COMPROVANTE, arquivoDe, corpoArquivo, enviarArquivo } from "../arquivos.js";
import { exigirLogin } from "../auth/token.js";
import { HttpError, usuarioDe, uuid, ym } from "../http.js";
import { pool } from "../pool.js";

/**
 * Comprovantes de um gasto (foto do cupom, PDF do recibo) ou do pagamento de
 * uma conta num mes (?conta=id&ym=AAAA-MM). Ficam no banco (bytea) e saem
 * junto quando o gasto ou a conta e apagado.
 */

// Foto chega comprimida (~300 KB); o limite e pensado para PDF.
const MAX_ARQUIVO = "4mb";
const MAX_POR_GASTO = 5;
// Teto por pessoa para o banco free (500 MB) aguentar: 4 pessoas x 100 MB.
const COTA_BYTES = 100 * 1024 * 1024;
const COTA_VISITANTE = 10 * 1024 * 1024;

const COLS = `id, lancamento_id as "lancamentoId", conta_id as "contaId", ym, nome, tipo, tamanho, criado_em as "criadoEm"`;

/** De quem e o comprovante: ?lancamento=id ou ?conta=id&ym=AAAA-MM. */
type Alvo = { lancamento: string } | { conta: string; ym: string };

function alvoDe(query: Record<string, unknown>): Alvo {
  if (query.lancamento) return { lancamento: uuid.parse(query.lancamento) };
  if (query.conta) return { conta: uuid.parse(query.conta), ym: ym.parse(query.ym) };
  throw new HttpError(400, "Informe o gasto ou a conta.");
}

/** Filtro SQL do alvo a partir do parametro $n. */
function filtro(alvo: Alvo, n: number): { sql: string; valores: string[] } {
  return "lancamento" in alvo
    ? { sql: `lancamento_id = $${n}`, valores: [alvo.lancamento] }
    : { sql: `conta_id = $${n} and ym = $${n + 1}`, valores: [alvo.conta, alvo.ym] };
}
const nomeArquivo = z.string().trim().min(1).max(120).catch("comprovante");

export const comprovantesRouter = Router();
comprovantesRouter.use(exigirLogin);

/** Comprovantes do gasto ou do pagamento, sem o conteudo. */
comprovantesRouter.get("/", async (req, res) => {
  const f = filtro(alvoDe(req.query), 2);
  const { rows } = await pool.query(
    `select ${COLS} from comprovantes where usuario_id = $1 and ${f.sql} order by criado_em`,
    [usuarioDe(req), ...f.valores],
  );
  res.json({ comprovantes: rows });
});

/** Anexa ao gasto ou ao pagamento. Corpo = arquivo cru; nome no header X-Nome-Arquivo (encodeURIComponent). */
comprovantesRouter.post("/", corpoArquivo(MAX_ARQUIVO), async (req, res) => {
  const usuario = usuarioDe(req);
  const alvo = alvoDe(req.query);
  const { dados, tipo } = arquivoDe(req.body, TIPOS_COMPROVANTE);
  let nome = "comprovante";
  try {
    nome = nomeArquivo.parse(decodeURIComponent(String(req.headers["x-nome-arquivo"] ?? "")));
  } catch {
    /* header malformado: fica o nome padrao */
  }

  const f = filtro(alvo, 2);
  const tabela = "lancamento" in alvo ? "lancamentos" : "contas";
  const { rows } = await pool.query<{ existe: boolean; papel: string; qtd: number; usado: number }>(
    `select exists(select 1 from ${tabela} where id = $2 and usuario_id = $1) as existe,
            (select papel from usuarios where id = $1) as papel,
            (select count(*)::int from comprovantes where ${f.sql}) as qtd,
            (select coalesce(sum(tamanho), 0)::float8 from comprovantes where usuario_id = $1) as usado`,
    [usuario, ...f.valores],
  );
  const s = rows[0];
  if (!s.existe) throw new HttpError(404, "lancamento" in alvo ? "Gasto nao encontrado." : "Conta nao encontrada.");
  if (s.qtd >= MAX_POR_GASTO) {
    throw new HttpError(409, `No máximo ${MAX_POR_GASTO} comprovantes por ${"lancamento" in alvo ? "gasto" : "conta no mês"}.`);
  }
  const cota = s.papel === "visitante" ? COTA_VISITANTE : COTA_BYTES;
  if (s.usado + dados.length > cota) throw new HttpError(413, "Espaço de comprovantes cheio. Apague alguns antigos.");

  const { rows: novo } = await pool.query(
    `insert into comprovantes (usuario_id, lancamento_id, conta_id, ym, nome, tipo, tamanho, dados)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${COLS}`,
    [
      usuario,
      "lancamento" in alvo ? alvo.lancamento : null,
      "conta" in alvo ? alvo.conta : null,
      "conta" in alvo ? alvo.ym : null,
      nome,
      tipo,
      dados.length,
      dados,
    ],
  );
  res.status(201).json(novo[0]);
});

comprovantesRouter.get("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { rows } = await pool.query<{ nome: string; tipo: string; dados: Buffer }>(
    "select nome, tipo, dados from comprovantes where id = $1 and usuario_id = $2",
    [id, usuarioDe(req)],
  );
  if (!rows[0]) throw new HttpError(404, "Comprovante nao encontrado.");
  enviarArquivo(res, rows[0].tipo, rows[0].dados, rows[0].nome);
});

comprovantesRouter.delete("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { rowCount } = await pool.query("delete from comprovantes where id = $1 and usuario_id = $2", [id, usuarioDe(req)]);
  if (!rowCount) throw new HttpError(404, "Comprovante nao encontrado.");
  res.status(204).end();
});

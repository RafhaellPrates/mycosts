import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { HttpError, dinheiro, setDe, usuarioDe, uuid } from "../http.js";
import { pool } from "../pool.js";
import { CATEGORIAS } from "./categorias.js";


const nome = z.string().trim().min(1, "Nome obrigatorio.").max(80);

const contaCampos = z.object({
  nome,
  categoria: z.enum(CATEGORIAS, "Categoria invalida."),
  diaVenc: z.number().int().min(1).max(31).nullable(),
  previsto: dinheiro,
  ordem: z.number().int(),
});
// Defaults so na criacao: no PATCH, campo ausente nao pode virar null/0.
const contaNova = contaCampos.extend({
  diaVenc: contaCampos.shape.diaVenc.default(null),
  previsto: contaCampos.shape.previsto.default(0),
  ordem: contaCampos.shape.ordem.optional(),
});
// Desativar (ativa: false) tira a conta dos meses novos sem apagar o historico.
const contaEdicao = contaCampos.partial().extend({ ativa: z.boolean().optional() });

const fonteCampos = z.object({ nome, previsto: dinheiro, ordem: z.number().int() });
// Default so na criacao, como em contaNova.
const fonteNova = fonteCampos.extend({
  previsto: fonteCampos.shape.previsto.default(0),
  ordem: fonteCampos.shape.ordem.optional(),
});
const fonteEdicao = fonteCampos.partial().extend({ ativa: z.boolean().optional() });

const CONTA_COLS = `id, nome, categoria, dia_venc as "diaVenc", previsto, ativa, ordem`;
const FONTE_COLS = `id, nome, previsto, ativa, ordem`;

export const cadastroRouter = Router();
cadastroRouter.use(["/categorias", "/contas", "/fontes"], exigirLogin);

cadastroRouter.get("/categorias", (_req, res) => {
  res.json({ categorias: CATEGORIAS });
});

cadastroRouter.get("/contas", async (req, res) => {
  const { rows } = await pool.query(
    `select ${CONTA_COLS} from contas where usuario_id = $1 and cartao_id is null order by ativa desc, ordem, criado_em`,
    [usuarioDe(req)],
  );
  res.json({ contas: rows });
});

cadastroRouter.post("/contas", async (req, res) => {
  const c = contaNova.parse(req.body);
  const { rows } = await pool.query(
    `insert into contas (usuario_id, nome, categoria, dia_venc, previsto, ordem)
     values ($1, $2, $3, $4, $5,
       coalesce($6, (select coalesce(max(ordem), 0) + 1 from contas where usuario_id = $1)))
     returning ${CONTA_COLS}`,
    [usuarioDe(req), c.nome, c.categoria, c.diaVenc, c.previsto, c.ordem ?? null],
  );
  res.status(201).json(rows[0]);
});

cadastroRouter.patch("/contas/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { sets, valores } = setDe(
    contaEdicao.parse(req.body),
    { nome: "nome", categoria: "categoria", diaVenc: "dia_venc", previsto: "previsto", ativa: "ativa", ordem: "ordem" },
    3,
  );
  const { rows } = await pool.query(
    `update contas set ${sets} where id = $1 and usuario_id = $2 and cartao_id is null returning ${CONTA_COLS}`,
    [id, usuarioDe(req), ...valores],
  );
  if (!rows[0]) throw new HttpError(404, "Conta nao encontrada.");
  res.json(rows[0]);
});

cadastroRouter.get("/fontes", async (req, res) => {
  const { rows } = await pool.query(
    `select ${FONTE_COLS} from fontes_receita where usuario_id = $1 order by ativa desc, ordem, criado_em`,
    [usuarioDe(req)],
  );
  res.json({ fontes: rows });
});

cadastroRouter.post("/fontes", async (req, res) => {
  const f = fonteNova.parse(req.body);
  const { rows } = await pool.query(
    `insert into fontes_receita (usuario_id, nome, previsto, ordem)
     values ($1, $2, $3,
       coalesce($4, (select coalesce(max(ordem), 0) + 1 from fontes_receita where usuario_id = $1)))
     returning ${FONTE_COLS}`,
    [usuarioDe(req), f.nome, f.previsto, f.ordem ?? null],
  );
  res.status(201).json(rows[0]);
});

cadastroRouter.patch("/fontes/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { sets, valores } = setDe(fonteEdicao.parse(req.body), { nome: "nome", previsto: "previsto", ativa: "ativa", ordem: "ordem" }, 3);
  const { rows } = await pool.query(
    `update fontes_receita set ${sets} where id = $1 and usuario_id = $2 returning ${FONTE_COLS}`,
    [id, usuarioDe(req), ...valores],
  );
  if (!rows[0]) throw new HttpError(404, "Fonte nao encontrada.");
  res.json(rows[0]);
});

// Apagar remove tambem o historico (pagamentos/receitas, on delete cascade).
// Para so tirar dos meses novos e manter o historico, o front usa ativa: false.
for (const [rota, tabela, erro] of [
  ["/contas/:id", "contas", "Conta nao encontrada."],
  ["/fontes/:id", "fontes_receita", "Fonte nao encontrada."],
] as const) {
  cadastroRouter.delete(rota, async (req, res) => {
    const id = uuid.parse(req.params.id);
    // Conta de fatura so sai junto com o cartao.
    const filtro = tabela === "contas" ? " and cartao_id is null" : "";
    const { rowCount } = await pool.query(`delete from ${tabela} where id = $1 and usuario_id = $2${filtro}`, [id, usuarioDe(req)]);
    if (!rowCount) throw new HttpError(404, erro);
    res.status(204).end();
  });
}

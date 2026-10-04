import { Router, type RequestHandler } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { CUSTO_BCRYPT } from "../auth/routes.js";
import { exigirLogin } from "../auth/token.js";
import { duplicado, email, nome, papel, senha } from "../auth/validacao.js";
import { HttpError, usuarioDe, uuid } from "../http.js";
import { pool } from "../pool.js";

/** Gestao de acessos: so admin. */

const COLS = `id, nome, email, papel, criado_em as "criadoEm"`;

const novo = z.object({ nome, email, senha, papel: papel.default("usuario") });
const edicao = z.object({ nome: nome.optional(), email: email.optional(), senha: senha.optional(), papel: papel.optional() });

/** Le o papel no banco a cada request: rebaixar alguem vale na hora, sem esperar o token expirar. */
const exigirAdmin: RequestHandler = async (req, _res, next) => {
  const { rows } = await pool.query<{ papel: string }>("select papel from usuarios where id = $1", [usuarioDe(req)]);
  if (rows[0]?.papel !== "admin") throw new HttpError(403, "So o admin pode gerenciar acessos.");
  next();
};

/** Bloqueia mudanca que deixaria o app sem nenhum admin. */
async function garantirOutroAdmin(id: string) {
  const { rows } = await pool.query<{ n: number }>(
    "select count(*)::int as n from usuarios where papel = 'admin' and id <> $1",
    [id],
  );
  if (!rows[0] || rows[0].n === 0) throw new HttpError(409, "Precisa ficar pelo menos um admin.");
}

function tratarDuplicado(e: unknown): never {
  const msg = duplicado(e);
  if (msg) throw new HttpError(409, msg);
  throw e;
}

export const adminRouter = Router();
adminRouter.use(exigirLogin, exigirAdmin);

adminRouter.get("/usuarios", async (_req, res) => {
  const { rows } = await pool.query(`select ${COLS} from usuarios order by papel, lower(nome)`);
  res.json({ usuarios: rows });
});

adminRouter.post("/usuarios", async (req, res) => {
  const u = novo.parse(req.body);
  const hash = await bcrypt.hash(u.senha, CUSTO_BCRYPT);
  try {
    const { rows } = await pool.query(
      `insert into usuarios (nome, email, senha_hash, papel) values ($1, $2, $3, $4) returning ${COLS}`,
      [u.nome, u.email, hash, u.papel],
    );
    res.status(201).json(rows[0]);
  } catch (e) {
    tratarDuplicado(e);
  }
});

adminRouter.patch("/usuarios/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const u = edicao.parse(req.body);
  if (u.papel === "usuario") await garantirOutroAdmin(id);
  const hash = u.senha ? await bcrypt.hash(u.senha, CUSTO_BCRYPT) : null;
  try {
    // coalesce: campo nao enviado fica como esta.
    const { rows } = await pool.query(
      `update usuarios set
         nome = coalesce($2, nome),
         email = coalesce($3, email),
         senha_hash = coalesce($4, senha_hash),
         papel = coalesce($5, papel)
       where id = $1 returning ${COLS}`,
      [id, u.nome ?? null, u.email ?? null, hash, u.papel ?? null],
    );
    if (!rows[0]) throw new HttpError(404, "Acesso nao encontrado.");
    res.json(rows[0]);
  } catch (e) {
    if (e instanceof HttpError) throw e;
    tratarDuplicado(e);
  }
});

adminRouter.delete("/usuarios/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  if (id === usuarioDe(req)) throw new HttpError(409, "Voce nao pode apagar o proprio acesso.");
  await garantirOutroAdmin(id);
  // on delete cascade: apaga junto contas, receitas e lancamentos da pessoa.
  const { rowCount } = await pool.query("delete from usuarios where id = $1", [id]);
  if (!rowCount) throw new HttpError(404, "Acesso nao encontrado.");
  res.status(204).end();
});

import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { CATEGORIAS_AVULSO, FORMAS_PAGAMENTO } from "../cadastro/categorias.js";
import { HttpError, dinheiro, setDe, usuarioDe, uuid, ym } from "../http.js";
import { pool } from "../pool.js";
import type { Lancamento } from "../mes/types.js";

const campos = z.object({
  data: z.iso.date("Data invalida."),
  descricao: z.string().trim().min(1, "Informe a descricao.").max(80),
  categoria: z.enum(CATEGORIAS_AVULSO, "Categoria invalida."),
  valor: dinheiro.refine((v) => v > 0, "Valor precisa ser maior que zero."),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, "Forma de pagamento invalida."),
});
const edicao = campos.partial();

const COLUNAS = {
  data: "data",
  descricao: "descricao",
  categoria: "categoria",
  valor: "valor",
  formaPagamento: "forma_pagamento",
};
// to_char: date do pg viraria Date do JS e poderia mudar de dia pelo fuso.
const SELECT = `id, to_char(data, 'YYYY-MM-DD') as data, descricao, categoria, valor,
  forma_pagamento as "formaPagamento"`;

/** Avulsos do usuario no mes, do mais recente para o mais antigo. */
export async function lancamentosDoMes(usuarioId: string, mes: string): Promise<Lancamento[]> {
  const { rows } = await pool.query<Lancamento>(
    `select ${SELECT} from lancamentos
     where usuario_id = $1 and data >= ($2 || '-01')::date and data < ($2 || '-01')::date + interval '1 month'
     order by data desc, criado_em desc`,
    [usuarioId, mes],
  );
  return rows;
}

export const lancamentosRouter = Router();
lancamentosRouter.use(exigirLogin);

lancamentosRouter.get("/", async (req, res) => {
  const mes = ym.parse(req.query.ym);
  res.json({ lancamentos: await lancamentosDoMes(usuarioDe(req), mes) });
});

lancamentosRouter.post("/", async (req, res) => {
  const l = campos.parse(req.body);
  const { rows } = await pool.query<Lancamento>(
    `insert into lancamentos (usuario_id, data, descricao, categoria, valor, forma_pagamento)
     values ($1, $2, $3, $4, $5, $6) returning ${SELECT}`,
    [usuarioDe(req), l.data, l.descricao, l.categoria, l.valor, l.formaPagamento],
  );
  res.status(201).json(rows[0]);
});

lancamentosRouter.patch("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { sets, valores } = setDe(edicao.parse(req.body), COLUNAS, 3);
  // Filtro por usuario_id: id de outro usuario cai no 404.
  const { rows } = await pool.query<Lancamento>(
    `update lancamentos set ${sets} where id = $1 and usuario_id = $2 returning ${SELECT}`,
    [id, usuarioDe(req), ...valores],
  );
  if (!rows[0]) throw new HttpError(404, "Lancamento nao encontrado.");
  res.json(rows[0]);
});

lancamentosRouter.delete("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { rowCount } = await pool.query("delete from lancamentos where id = $1 and usuario_id = $2", [
    id,
    usuarioDe(req),
  ]);
  if (!rowCount) throw new HttpError(404, "Lancamento nao encontrado.");
  res.status(204).end();
});

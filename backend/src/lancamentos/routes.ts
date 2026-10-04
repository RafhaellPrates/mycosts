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
  /** Parcelado: valor total da compra. */
  valor: dinheiro.refine((v) => v > 0, "Valor precisa ser maior que zero."),
  formaPagamento: z.enum(FORMAS_PAGAMENTO, "Forma de pagamento invalida."),
  cartaoId: uuid.nullable(),
  parcelas: z.number().int().min(1).max(48, "No maximo 48 parcelas."),
});
const novo = campos.extend({ cartaoId: campos.shape.cartaoId.default(null), parcelas: campos.shape.parcelas.default(1) });
const edicao = campos.partial();

const COLUNAS = {
  data: "data",
  descricao: "descricao",
  categoria: "categoria",
  valor: "valor",
  formaPagamento: "forma_pagamento",
  cartaoId: "cartao_id",
  parcelas: "parcelas",
};

// to_char: date do pg viraria Date do JS e poderia mudar de dia pelo fuso.
const BASE = `l.id, to_char(l.data, 'YYYY-MM-DD') as data, l.descricao, l.categoria,
  l.forma_pagamento as "formaPagamento", l.cartao_id as "cartaoId", l.parcelas, l.valor as "valorTotal"`;

/**
 * Avulsos que caem no mes. Parcelada vira uma linha por parcela: a parcela k
 * cai k meses depois da compra; a ultima absorve o arredondamento.
 */
export async function lancamentosDoMes(usuarioId: string, mes: string): Promise<Lancamento[]> {
  const { rows } = await pool.query<Lancamento>(
    `select ${BASE}, k + 1 as parcela,
            case when k = l.parcelas - 1 then l.valor - round(l.valor / l.parcelas, 2) * (l.parcelas - 1)
                 else round(l.valor / l.parcelas, 2) end as valor
     from lancamentos l
     cross join generate_series(0, l.parcelas - 1) k
     where l.usuario_id = $1
       and date_trunc('month', l.data) + make_interval(months => k) = ($2 || '-01')::date
     order by l.data desc, l.criado_em desc`,
    [usuarioId, mes],
  );
  return rows;
}

/** Credito pode ter cartao e parcelas; outra forma zera os dois. Cartao precisa ser do usuario. */
async function validarCartao(usuarioId: string, forma: string, cartaoId: string | null, parcelas: number) {
  if (forma !== "Crédito") return { cartaoId: null, parcelas: 1 };
  if (cartaoId) {
    const { rowCount } = await pool.query("select 1 from cartoes where id = $1 and usuario_id = $2", [cartaoId, usuarioId]);
    if (!rowCount) throw new HttpError(404, "Cartao nao encontrado.");
  }
  return { cartaoId, parcelas };
}

export const lancamentosRouter = Router();
lancamentosRouter.use(exigirLogin);

lancamentosRouter.get("/", async (req, res) => {
  const mes = ym.parse(req.query.ym);
  res.json({ lancamentos: await lancamentosDoMes(usuarioDe(req), mes) });
});

lancamentosRouter.post("/", async (req, res) => {
  const usuario = usuarioDe(req);
  const l = novo.parse(req.body);
  const c = await validarCartao(usuario, l.formaPagamento, l.cartaoId, l.parcelas);
  const { rows } = await pool.query(
    `insert into lancamentos as l (usuario_id, data, descricao, categoria, valor, forma_pagamento, cartao_id, parcelas)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning ${BASE}`,
    [usuario, l.data, l.descricao, l.categoria, l.valor, l.formaPagamento, c.cartaoId, c.parcelas],
  );
  res.status(201).json(rows[0]);
});

lancamentosRouter.patch("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const usuario = usuarioDe(req);
  const dados = edicao.parse(req.body);
  // Cartao e parcelas dependem da forma: confere com o estado final.
  if (dados.formaPagamento || dados.cartaoId !== undefined || dados.parcelas) {
    const { rows: atual } = await pool.query(
      "select forma_pagamento, cartao_id, parcelas from lancamentos where id = $1 and usuario_id = $2",
      [id, usuario],
    );
    if (!atual[0]) throw new HttpError(404, "Lancamento nao encontrado.");
    Object.assign(
      dados,
      await validarCartao(
        usuario,
        dados.formaPagamento ?? atual[0].forma_pagamento,
        dados.cartaoId !== undefined ? dados.cartaoId : atual[0].cartao_id,
        dados.parcelas ?? atual[0].parcelas,
      ),
    );
  }
  const { sets, valores } = setDe(dados, COLUNAS, 3);
  // Filtro por usuario_id: id de outro usuario cai no 404.
  const { rows } = await pool.query(
    `update lancamentos as l set ${sets} where id = $1 and usuario_id = $2 returning ${BASE}`,
    [id, usuario, ...valores],
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

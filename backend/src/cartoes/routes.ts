import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { HttpError, dinheiro, setDe, usuarioDe, uuid, ym } from "../http.js";
import { pool } from "../pool.js";
import { CATEGORIA_CARTOES } from "../cadastro/categorias.js";
import {
  type Compra,
  diasEntre,
  fechamentoDaCompra,
  fechamentoQueVenceEm,
  hojeBR,
  itensDaFatura,
  parcelasEmAndamento,
  texto,
  totalDe,
  vencimentoDaFatura,
} from "./fatura.js";

const dia = z.number().int().min(1, "Dia de 1 a 31.").max(31, "Dia de 1 a 31.");
const campos = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(40),
  diaFechamento: dia,
  diaVencimento: dia,
  melhorDia: dia,
  limite: dinheiro.refine((v) => v > 0, "Limite precisa ser maior que zero.").nullable(),
});
const novo = campos.extend({ limite: campos.shape.limite.default(null) });

const COLUNAS = {
  nome: "nome",
  diaFechamento: "dia_fechamento",
  diaVencimento: "dia_vencimento",
  melhorDia: "melhor_dia",
  limite: "limite",
};
const SELECT = `id, nome, dia_fechamento as "diaFechamento", dia_vencimento as "diaVencimento",
  melhor_dia as "melhorDia", limite`;

interface CartaoRow {
  id: string;
  nome: string;
  diaFechamento: number;
  diaVencimento: number;
  melhorDia: number;
  limite: number | null;
}

interface CompraRow extends Compra {
  cartaoId: string;
}

const COMPRAS = `select id, cartao_id as "cartaoId", to_char(data, 'YYYY-MM-DD') as data, descricao, valor, parcelas
  from lancamentos where usuario_id = $1 and cartao_id is not null and data >= current_date - interval '5 years'
  order by data`;

/**
 * Fatura de cada cartao que vence no mes ('YYYY-MM'). E o previsto da conta
 * do cartao na tela do mes.
 */
export async function faturasQueVencem(usuarioId: string, mes: string): Promise<Map<string, number>> {
  const [y, m] = mes.split("-").map(Number);
  const [cartoes, compras] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where usuario_id = $1`, [usuarioId]),
    pool.query<CompraRow>(COMPRAS, [usuarioId]),
  ]);
  return new Map(
    cartoes.rows.map((c) => {
      const fechamento = fechamentoQueVenceEm(y, m, c.diaFechamento, c.diaVencimento);
      const doCartao = compras.rows.filter((x) => x.cartaoId === c.id);
      return [c.id, totalDe(itensDaFatura(doCartao, fechamento, c.diaFechamento))];
    }),
  );
}

export const cartoesRouter = Router();
cartoesRouter.use(exigirLogin);

/**
 * Cartoes com a fatura aberta (o que ja foi gasto, inclusive parcelas que
 * caem nela), quando fecha e vence, as compras parceladas que ainda tem
 * parcela e quantos dias uma compra feita hoje leva para ser paga.
 * `recomendado` = mais prazo sem estourar o limite.
 */
cartoesRouter.get("/", async (req, res) => {
  const usuario = usuarioDe(req);
  const [cartoes, compras] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where usuario_id = $1 order by criado_em`, [usuario]),
    pool.query<CompraRow>(COMPRAS, [usuario]),
  ]);
  const hoje = hojeBR();

  const lista = cartoes.rows.map((c) => {
    const fechaHoje = fechamentoDaCompra(hoje, c.diaFechamento);
    const venceHoje = vencimentoDaFatura(fechaHoje, c.diaVencimento);
    const doCartao = compras.rows.filter((x) => x.cartaoId === c.id);
    const fatura = totalDe(itensDaFatura(doCartao, fechaHoje, c.diaFechamento));
    return {
      ...c,
      faturaAtual: fatura,
      fechaEm: texto(fechaHoje),
      venceEm: texto(venceHoje),
      diasParaPagar: diasEntre(hoje, venceHoje),
      melhorDiaHoje: hoje.d === c.melhorDia,
      estourado: c.limite !== null && fatura >= c.limite,
      parcelamentos: parcelasEmAndamento(doCartao, fechaHoje, c.diaFechamento, c.diaVencimento).reverse(),
    };
  });

  const recomendado =
    lista
      .filter((c) => !c.estourado)
      .sort((a, b) => b.diasParaPagar - a.diasParaPagar || a.faturaAtual - b.faturaAtual)[0]?.id ?? null;
  res.json({ cartoes: lista, recomendado, hoje: texto(hoje) });
});

/** Fatura que vence no mes ('YYYY-MM'), com o pagamento lancado na conta do cartao. */
cartoesRouter.get("/:id/fatura/:ym", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const mes = ym.parse(req.params.ym);
  const usuario = usuarioDe(req);
  const [cartao, compras, pagamento] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where id = $1 and usuario_id = $2`, [id, usuario]),
    pool.query<CompraRow>(COMPRAS, [usuario]),
    pool.query<{ pago: number | null; situacao: string | null }>(
      `select p.pago, p.situacao from contas c join pagamentos p on p.conta_id = c.id and p.ym = $3
       where c.cartao_id = $1 and c.usuario_id = $2`,
      [id, usuario, mes],
    ),
  ]);
  const c = cartao.rows[0];
  if (!c) throw new HttpError(404, "Cartao nao encontrado.");
  const [y, m] = mes.split("-").map(Number);
  const fechamento = fechamentoQueVenceEm(y, m, c.diaFechamento, c.diaVencimento);
  const itens = itensDaFatura(compras.rows.filter((x) => x.cartaoId === c.id), fechamento, c.diaFechamento);
  res.json({
    ym: mes,
    fechaEm: texto(fechamento),
    venceEm: texto(vencimentoDaFatura(fechamento, c.diaVencimento)),
    total: totalDe(itens),
    pago: pagamento.rows[0]?.pago ?? null,
    situacao: pagamento.rows[0]?.situacao ?? "",
    itens: itens.reverse(),
  });
});

// O cartao nasce com a conta da fatura, que aparece em A pagar no mes do vencimento.
cartoesRouter.post("/", async (req, res) => {
  const c = novo.parse(req.body);
  const { rows } = await pool.query(
    `with k as (
       insert into cartoes (usuario_id, nome, dia_fechamento, dia_vencimento, melhor_dia, limite)
       values ($1, $2, $3, $4, $5, $6) returning *
     ),
     conta as (
       insert into contas (usuario_id, nome, categoria, dia_venc, previsto, ordem, cartao_id)
       select usuario_id, nome, $7, dia_vencimento, 0,
              (select coalesce(max(ordem), 0) + 1 from contas where usuario_id = $1), id
       from k
     )
     select ${SELECT} from k`,
    [usuarioDe(req), c.nome, c.diaFechamento, c.diaVencimento, c.melhorDia, c.limite, CATEGORIA_CARTOES],
  );
  res.status(201).json(rows[0]);
});

// Nome e vencimento da conta da fatura acompanham o cartao.
cartoesRouter.patch("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { sets, valores } = setDe(campos.partial().parse(req.body), COLUNAS, 3);
  const { rows } = await pool.query(
    `with k as (update cartoes set ${sets} where id = $1 and usuario_id = $2 returning *),
     conta as (update contas c set nome = k.nome, dia_venc = k.dia_vencimento from k where c.cartao_id = k.id)
     select ${SELECT} from k`,
    [id, usuarioDe(req), ...valores],
  );
  if (!rows[0]) throw new HttpError(404, "Cartao nao encontrado.");
  res.json(rows[0]);
});

// Compras do cartao ficam (cartao_id vira null): continuam como gasto. A conta
// da fatura e desativada: some dos meses novos e fica nos que tiveram pagamento.
cartoesRouter.delete("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const usuario = usuarioDe(req);
  await pool.query("update contas set ativa = false where cartao_id = $1 and usuario_id = $2", [id, usuario]);
  const { rowCount } = await pool.query("delete from cartoes where id = $1 and usuario_id = $2", [id, usuario]);
  if (!rowCount) throw new HttpError(404, "Cartao nao encontrado.");
  res.status(204).end();
});

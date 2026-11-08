import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { HttpError, dinheiro, setDe, usuarioDe, uuid, ym } from "../http.js";
import { pool } from "../pool.js";
import { CATEGORIA_CARTOES } from "../cadastro/categorias.js";
import {
  type Assinatura,
  type Compra,
  cobrancasDaAssinatura,
  deTexto,
  diasEntre,
  fechamentoDaCompra,
  fechamentoQueVenceEm,
  hojeBR,
  itensDaFatura,
  maisMeses,
  parcelasEmAndamento,
  proximaCobranca,
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

interface AssinaturaRow extends Assinatura {
  cartaoId: string;
}

const ASSINATURAS = `select id, cartao_id as "cartaoId", nome, valor, to_char(inicio, 'YYYY-MM-DD') as inicio,
  to_char(cancelada_em, 'YYYY-MM-DD') as "canceladaEm"
  from assinaturas where usuario_id = $1 order by cancelada_em nulls first, criado_em`;

// Faturas futuras (MonthPicker da fatura) ate 3 anos para frente ja mostram as assinaturas.
const HORIZONTE_MESES = 36;

/**
 * Tudo que cai nas faturas do usuario: compras no cartao e as cobrancas
 * mensais das assinaturas. As assinaturas vao junto para a tela de Cartoes.
 */
async function comprasDoUsuario(usuarioId: string) {
  const [compras, assinaturas] = await Promise.all([
    pool.query<CompraRow>(COMPRAS, [usuarioId]),
    pool.query<AssinaturaRow>(ASSINATURAS, [usuarioId]),
  ]);
  const ate = maisMeses(hojeBR(), HORIZONTE_MESES);
  const cobrancas: CompraRow[] = assinaturas.rows.flatMap((a) =>
    cobrancasDaAssinatura(a, ate).map((c) => ({ ...c, cartaoId: a.cartaoId })),
  );
  return { compras: [...compras.rows, ...cobrancas], assinaturas: assinaturas.rows };
}

/**
 * Fatura de cada cartao que vence no mes ('YYYY-MM'). E o previsto da conta
 * do cartao na tela do mes.
 */
export async function faturasQueVencem(usuarioId: string, mes: string): Promise<Map<string, number>> {
  const [y, m] = mes.split("-").map(Number);
  const [cartoes, { compras }] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where usuario_id = $1`, [usuarioId]),
    comprasDoUsuario(usuarioId),
  ]);
  return new Map(
    cartoes.rows.map((c) => {
      const fechamento = fechamentoQueVenceEm(y, m, c.diaFechamento, c.diaVencimento);
      const doCartao = compras.filter((x) => x.cartaoId === c.id);
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
  const [cartoes, { compras, assinaturas }] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where usuario_id = $1 order by criado_em`, [usuario]),
    comprasDoUsuario(usuario),
  ]);
  const hoje = hojeBR();
  const textoHoje = texto(hoje);

  const lista = cartoes.rows.map((c) => {
    const fechaHoje = fechamentoDaCompra(hoje, c.diaFechamento);
    const venceHoje = vencimentoDaFatura(fechaHoje, c.diaVencimento);
    const doCartao = compras.filter((x) => x.cartaoId === c.id);
    const fatura = totalDe(itensDaFatura(doCartao, fechaHoje, c.diaFechamento));
    // Cancelada continua na lista por um mes depois do cancelamento, depois some.
    const suas = assinaturas
      .filter((a) => a.cartaoId === c.id)
      .filter((a) => !a.canceladaEm || texto(maisMeses(deTexto(a.canceladaEm), 1)) >= textoHoje)
      .map(({ cartaoId: _, ...a }) => ({ ...a, ativa: !a.canceladaEm || a.canceladaEm > textoHoje, proxima: proximaCobranca(a, hoje) }));
    return {
      ...c,
      faturaAtual: fatura,
      fechaEm: texto(fechaHoje),
      venceEm: texto(venceHoje),
      diasParaPagar: diasEntre(hoje, venceHoje),
      melhorDiaHoje: hoje.d === c.melhorDia,
      estourado: c.limite !== null && fatura >= c.limite,
      parcelamentos: parcelasEmAndamento(doCartao, fechaHoje, c.diaFechamento, c.diaVencimento).reverse(),
      assinaturas: suas,
      assinaturasMes: Math.round(suas.filter((a) => a.ativa).reduce((t, a) => t + a.valor, 0) * 100) / 100,
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
  const [cartao, { compras }, pagamento] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where id = $1 and usuario_id = $2`, [id, usuario]),
    comprasDoUsuario(usuario),
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
  const itens = itensDaFatura(compras.filter((x) => x.cartaoId === c.id), fechamento, c.diaFechamento);
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

// ---- assinaturas ----

const assinaturaCampos = z.object({
  nome: z.string().trim().min(1, "Informe o nome.").max(60),
  valor: dinheiro.refine((v) => v > 0, "Valor precisa ser maior que zero."),
  inicio: z.iso.date("Data invalida."),
});
const SELECT_ASSINATURA = `id, cartao_id as "cartaoId", nome, valor, to_char(inicio, 'YYYY-MM-DD') as inicio,
  to_char(cancelada_em, 'YYYY-MM-DD') as "canceladaEm"`;

/** Assinatura nova no cartao: entra como cobranca mensal na fatura a partir de `inicio`. */
cartoesRouter.post("/:id/assinaturas", async (req, res) => {
  const cartao = uuid.parse(req.params.id);
  const a = assinaturaCampos.parse(req.body);
  const { rows } = await pool.query(
    `insert into assinaturas (usuario_id, cartao_id, nome, valor, inicio)
     select usuario_id, id, $3, $4, $5 from cartoes where id = $1 and usuario_id = $2
     returning ${SELECT_ASSINATURA}`,
    [cartao, usuarioDe(req), a.nome, a.valor, a.inicio],
  );
  if (!rows[0]) throw new HttpError(404, "Cartao nao encontrado.");
  res.status(201).json(rows[0]);
});

/**
 * Edita nome, valor, inicio ou o cartao. O valor novo vale para todas as
 * cobrancas, inclusive as que ja passaram (o que foi pago fica na conta do cartao).
 */
cartoesRouter.patch("/assinaturas/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const usuario = usuarioDe(req);
  const dados = assinaturaCampos.extend({ cartaoId: uuid }).partial().parse(req.body);
  if (dados.cartaoId) {
    const { rowCount } = await pool.query("select 1 from cartoes where id = $1 and usuario_id = $2", [dados.cartaoId, usuario]);
    if (!rowCount) throw new HttpError(404, "Cartao nao encontrado.");
  }
  const { sets, valores } = setDe(dados, { nome: "nome", valor: "valor", inicio: "inicio", cartaoId: "cartao_id" }, 3);
  // Inicio novo depois do cancelamento: o cancelamento acompanha (nada e cobrado).
  const ajuste = dados.inicio
    ? `, cancelada_em = case when cancelada_em is null then null else greatest(cancelada_em, $${valores.length + 3}::date) end`
    : "";
  const { rows } = await pool.query(
    `update assinaturas set ${sets}${ajuste} where id = $1 and usuario_id = $2 returning ${SELECT_ASSINATURA}`,
    [id, usuario, ...valores, ...(dados.inicio ? [dados.inicio] : [])],
  );
  if (!rows[0]) throw new HttpError(404, "Assinatura nao encontrada.");
  res.json(rows[0]);
});

/** Cancela na data (padrao hoje): cobranca desse dia em diante sai das faturas. null reativa. */
cartoesRouter.post("/assinaturas/:id/cancelar", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { data } = z.object({ data: z.iso.date("Data invalida.").nullable().default(texto(hojeBR())) }).parse(req.body ?? {});
  const { rows } = await pool.query(
    `update assinaturas set cancelada_em = case when $3::date is null then null else greatest($3::date, inicio) end
     where id = $1 and usuario_id = $2 returning ${SELECT_ASSINATURA}`,
    [id, usuarioDe(req), data],
  );
  if (!rows[0]) throw new HttpError(404, "Assinatura nao encontrada.");
  res.json(rows[0]);
});

/** Apaga de vez: some de todas as faturas, inclusive das passadas. */
cartoesRouter.delete("/assinaturas/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { rowCount } = await pool.query("delete from assinaturas where id = $1 and usuario_id = $2", [id, usuarioDe(req)]);
  if (!rowCount) throw new HttpError(404, "Assinatura nao encontrada.");
  res.status(204).end();
});

import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { HttpError, dinheiro, setDe, usuarioDe, uuid } from "../http.js";
import { pool } from "../pool.js";
import {
  deTexto,
  diasEntre,
  fechamentoDaCompra,
  fechamentoMais,
  hojeBR,
  mesmoMes,
  texto,
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

interface CompraRow {
  id: string;
  cartaoId: string;
  data: string;
  descricao: string;
  valor: number;
  parcelas: number;
}

export const cartoesRouter = Router();
cartoesRouter.use(exigirLogin);

/**
 * Cartoes com a fatura aberta (o que ja foi gasto, inclusive parcelas que
 * caem nela), quando fecha e vence, e quantos dias uma compra feita hoje
 * leva para ser paga. `recomendado` = mais prazo sem estourar o limite.
 */
cartoesRouter.get("/", async (req, res) => {
  const usuario = usuarioDe(req);
  const [cartoes, compras] = await Promise.all([
    pool.query<CartaoRow>(`select ${SELECT} from cartoes where usuario_id = $1 order by criado_em`, [usuario]),
    pool.query<CompraRow>(
      `select id, cartao_id as "cartaoId", to_char(data, 'YYYY-MM-DD') as data, descricao, valor, parcelas
       from lancamentos where usuario_id = $1 and cartao_id is not null and data >= current_date - interval '5 years'
       order by data`,
      [usuario],
    ),
  ]);
  const hoje = hojeBR();

  const lista = cartoes.rows.map((c) => {
    const fechaHoje = fechamentoDaCompra(hoje, c.diaFechamento);
    const venceHoje = vencimentoDaFatura(fechaHoje, c.diaVencimento);
    const itens: { id: string; descricao: string; data: string; parcela: number; parcelas: number; valor: number }[] = [];
    for (const compra of compras.rows.filter((x) => x.cartaoId === c.id)) {
      const primeira = fechamentoDaCompra(deTexto(compra.data), c.diaFechamento);
      const parcela = Math.round(compra.valor / compra.parcelas * 100) / 100;
      for (let k = 0; k < compra.parcelas; k++) {
        if (!mesmoMes(fechamentoMais(primeira, k, c.diaFechamento), fechaHoje)) continue;
        const ultima = k === compra.parcelas - 1;
        const valor = ultima ? Math.round((compra.valor - parcela * (compra.parcelas - 1)) * 100) / 100 : parcela;
        itens.push({ id: compra.id, descricao: compra.descricao, data: compra.data, parcela: k + 1, parcelas: compra.parcelas, valor });
      }
    }
    const fatura = Math.round(itens.reduce((a, i) => a + i.valor, 0) * 100) / 100;
    return {
      ...c,
      faturaAtual: fatura,
      fechaEm: texto(fechaHoje),
      venceEm: texto(venceHoje),
      diasParaPagar: diasEntre(hoje, venceHoje),
      melhorDiaHoje: hoje.d === c.melhorDia,
      estourado: c.limite !== null && fatura >= c.limite,
      itens: itens.reverse(),
    };
  });

  const recomendado =
    lista
      .filter((c) => !c.estourado)
      .sort((a, b) => b.diasParaPagar - a.diasParaPagar || a.faturaAtual - b.faturaAtual)[0]?.id ?? null;
  res.json({ cartoes: lista, recomendado, hoje: texto(hoje) });
});

cartoesRouter.post("/", async (req, res) => {
  const c = novo.parse(req.body);
  const { rows } = await pool.query(
    `insert into cartoes (usuario_id, nome, dia_fechamento, dia_vencimento, melhor_dia, limite)
     values ($1, $2, $3, $4, $5, $6) returning ${SELECT}`,
    [usuarioDe(req), c.nome, c.diaFechamento, c.diaVencimento, c.melhorDia, c.limite],
  );
  res.status(201).json(rows[0]);
});

cartoesRouter.patch("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { sets, valores } = setDe(campos.partial().parse(req.body), COLUNAS, 3);
  const { rows } = await pool.query(
    `update cartoes set ${sets} where id = $1 and usuario_id = $2 returning ${SELECT}`,
    [id, usuarioDe(req), ...valores],
  );
  if (!rows[0]) throw new HttpError(404, "Cartao nao encontrado.");
  res.json(rows[0]);
});

// Compras do cartao ficam (cartao_id vira null): continuam como gasto.
cartoesRouter.delete("/:id", async (req, res) => {
  const id = uuid.parse(req.params.id);
  const { rowCount } = await pool.query("delete from cartoes where id = $1 and usuario_id = $2", [id, usuarioDe(req)]);
  if (!rowCount) throw new HttpError(404, "Cartao nao encontrado.");
  res.status(204).end();
});

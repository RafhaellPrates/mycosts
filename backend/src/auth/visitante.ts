import { randomUUID } from "node:crypto";
import type pg from "pg";
import { HttpError } from "../http.js";
import { pool } from "../pool.js";
import { type Compra, fechamentoQueVenceEm, hojeBR, itensDaFatura, totalDe } from "../cartoes/fatura.js";
import { USUARIO_COLS, type UsuarioRow } from "./validacao.js";

/**
 * Modo visitante: quem chega pelo link do portfolio entra sem cadastro num
 * usuario so dele, com dados de exemplo dos ultimos 4 meses. O usuario e
 * apagado 24h depois (cascade leva tudo junto) e o token vence no mesmo prazo.
 */

export const VALIDADE_VISITANTE = "24h";
// Teto de visitantes vivos ao mesmo tempo: protege o banco free de abuso.
const MAX_VISITANTES = 300;

/** Apaga visitantes com mais de 24h. Roda a cada hora (index.ts) e a cada visitante novo. */
export async function apagarVisitantesVencidos(): Promise<number> {
  const { rowCount } = await pool.query(
    "delete from usuarios where papel = 'visitante' and criado_em < now() - interval '24 hours'",
  );
  return rowCount ?? 0;
}

export async function criarVisitante(): Promise<UsuarioRow> {
  await apagarVisitantesVencidos();
  const { rows } = await pool.query<{ n: number }>("select count(*)::int as n from usuarios where papel = 'visitante'");
  if ((rows[0]?.n ?? 0) >= MAX_VISITANTES) {
    throw new HttpError(503, "Muitos visitantes agora. Tente de novo mais tarde.");
  }

  const client = await pool.connect();
  try {
    await client.query("begin");
    const sufixo = randomUUID().replaceAll("-", "");
    // senha_hash invalido: bcrypt nunca confere, entao ninguem entra por senha.
    const {
      rows: [usuario],
    } = await client.query<UsuarioRow>(
      `insert into usuarios (nome, email, senha_hash, papel)
       values ($1, $2, '!', 'visitante') returning ${USUARIO_COLS}`,
      [`Visitante ${sufixo.slice(0, 6)}`, `visitante-${sufixo}@visitante.mycosts`],
    );
    await semear(client, usuario.id);
    await client.query("commit");
    return usuario;
  } catch (e) {
    await client.query("rollback");
    throw e;
  } finally {
    client.release();
  }
}

// ---- dados de exemplo ----

const MESES = [-3, -2, -1, 0];

/** [nome, categoria, dia de vencimento, previsto] */
const CONTAS: [string, string, number, number][] = [
  ["Aluguel", "Moradia", 5, 1800],
  ["Condomínio", "Moradia", 10, 450],
  ["Energia", "Utilidades", 15, 220],
  ["Internet", "Utilidades", 20, 120],
  ["Plano de saúde", "Saúde", 12, 380],
  ["Academia", "Saúde", 8, 110],
  ["Streaming", "Lazer", 18, 55],
];
// Conta de luz varia mes a mes; o resto e pago no valor previsto.
const ENERGIA = [198.4, 241.7, 215.3, 229.9];

/** [mes relativo, dia, descricao, categoria, valor total, forma, parcelas]; Credito vai no cartao. */
const AVULSOS: [number, number, string, string, number, string, number][] = [
  [-3, 12, "Notebook", "Outros", 4200, "Crédito", 10],
  [-3, 14, "Supermercado", "Alimentação", 712.35, "Crédito", 1],
  [-3, 6, "Uber", "Transporte", 32.9, "Pix", 1],
  [-3, 21, "Padaria", "Alimentação", 24.5, "Débito", 1],
  [-2, 14, "Supermercado", "Alimentação", 648.1, "Crédito", 1],
  [-2, 20, "Restaurante", "Alimentação", 186.4, "Crédito", 1],
  [-2, 9, "Uber", "Transporte", 41.2, "Pix", 1],
  [-2, 25, "Feira", "Alimentação", 68, "Dinheiro", 1],
  [-1, 7, "Tênis", "Outros", 399.9, "Crédito", 3],
  [-1, 14, "Supermercado", "Alimentação", 779.6, "Crédito", 1],
  [-1, 22, "Farmácia", "Saúde", 87.5, "Crédito", 1],
  [-1, 11, "Curso online", "Educação", 297, "Pix", 3],
  [-1, 18, "Uber", "Transporte", 28.7, "Pix", 1],
  [0, 1, "Padaria", "Alimentação", 19.8, "Débito", 1],
  [0, 2, "Cinema", "Lazer", 64, "Crédito", 1],
  [0, 4, "Uber", "Transporte", 36.4, "Pix", 1],
];

const CARTAO = { nome: "Nubank", fechamento: 3, vencimento: 10, limite: 6000 };

async function semear(client: pg.PoolClient, usuarioId: string) {
  const hoje = hojeBR();
  // Date.UTC normaliza mes fora de 1..12 e dia alem do fim do mes.
  const dataDe = (k: number, dia: number) => new Date(Date.UTC(hoje.y, hoje.m - 1 + k, dia)).toISOString().slice(0, 10);
  const ymDe = (k: number) => dataDe(k, 1).slice(0, 7);
  // No mes atual so entra o que ja aconteceu.
  const passou = (k: number, dia: number) => k < 0 || dia <= hoje.d;

  // Fonte criada no inicio do periodo: a receita automatica preenche os meses.
  await client.query(
    `insert into fontes_receita (usuario_id, nome, previsto, ordem, criado_em) values
       ($1, 'Salário', 6500, 0, $2), ($1, 'Freela', 0, 1, $2)`,
    [usuarioId, `${dataDe(MESES[0], 1)}T12:00:00Z`],
  );
  await client.query(
    `insert into receitas (fonte_id, ym, valor)
     select f.id, v.ym, v.valor from fontes_receita f
     cross join (values ($2::text, 1500::numeric), ($3, 0), ($4, 900)) v(ym, valor)
     where f.usuario_id = $1 and f.nome = 'Freela'`,
    [usuarioId, ymDe(-3), ymDe(-2), ymDe(-1)],
  );

  const {
    rows: [cartao],
  } = await client.query<{ id: string }>(
    `insert into cartoes (usuario_id, nome, dia_fechamento, dia_vencimento, melhor_dia, limite)
     values ($1, $2, $3, $4, $3, $5) returning id`,
    [usuarioId, CARTAO.nome, CARTAO.fechamento, CARTAO.vencimento, CARTAO.limite],
  );

  const contas = [...CONTAS, [CARTAO.nome, "Cartões", CARTAO.vencimento, 0] as const];
  const { rows: contasIds } = await client.query<{ id: string; nome: string }>(
    `insert into contas (usuario_id, nome, categoria, dia_venc, previsto, ordem, cartao_id)
     select $1, c.nome, c.categoria, c.dia, c.previsto, c.ordem - 1,
            case when c.categoria = 'Cartões' then $2::uuid end
     from unnest($3::text[], $4::text[], $5::int[], $6::numeric[]) with ordinality c(nome, categoria, dia, previsto, ordem)
     returning id, nome`,
    [usuarioId, cartao.id, contas.map((c) => c[0]), contas.map((c) => c[1]), contas.map((c) => c[2]), contas.map((c) => c[3])],
  );
  const idDa = new Map(contasIds.map((c) => [c.nome, c.id]));

  const avulsos = AVULSOS.filter(([k, dia]) => passou(k, dia)).map(([k, dia, descricao, categoria, valor, forma, parcelas]) => ({
    data: dataDe(k, dia),
    descricao,
    categoria,
    valor,
    forma,
    parcelas,
    cartaoId: forma === "Crédito" ? cartao.id : null,
  }));
  await client.query(
    `insert into lancamentos (usuario_id, data, descricao, categoria, valor, forma_pagamento, parcelas, cartao_id)
     select $1, a.data, a.descricao, a.categoria, a.valor, a.forma, a.parcelas, a.cartao
     from unnest($2::date[], $3::text[], $4::text[], $5::numeric[], $6::text[], $7::int[], $8::uuid[])
       a(data, descricao, categoria, valor, forma, parcelas, cartao)`,
    [
      usuarioId,
      avulsos.map((a) => a.data),
      avulsos.map((a) => a.descricao),
      avulsos.map((a) => a.categoria),
      avulsos.map((a) => a.valor),
      avulsos.map((a) => a.forma),
      avulsos.map((a) => a.parcelas),
      avulsos.map((a) => a.cartaoId),
    ],
  );

  // Pagamentos: meses passados quitados; no atual, so o que ja venceu.
  const compras: Compra[] = avulsos
    .filter((a) => a.cartaoId)
    .map((a, i) => ({ id: String(i), data: a.data, descricao: a.descricao, valor: a.valor, parcelas: a.parcelas }));
  const pagamentos: { contaId: string; ym: string; pago: number | null; situacao: string }[] = [];
  MESES.forEach((k, i) => {
    const ym = ymDe(k);
    for (const [nome, , dia, previsto] of CONTAS) {
      const pago = passou(k, dia);
      pagamentos.push({
        contaId: idDa.get(nome)!,
        ym,
        pago: pago ? (nome === "Energia" ? ENERGIA[i] : previsto) : null,
        situacao: pago ? "Pago" : "Pendente",
      });
    }
    if (!passou(k, CARTAO.vencimento)) return;
    const [y, m] = ym.split("-").map(Number);
    const fatura = totalDe(itensDaFatura(compras, fechamentoQueVenceEm(y, m, CARTAO.fechamento, CARTAO.vencimento), CARTAO.fechamento));
    if (fatura > 0) pagamentos.push({ contaId: idDa.get(CARTAO.nome)!, ym, pago: fatura, situacao: "Pago" });
  });
  await client.query(
    `insert into pagamentos (conta_id, ym, pago, situacao)
     select * from unnest($1::uuid[], $2::text[], $3::numeric[], $4::text[])`,
    [pagamentos.map((p) => p.contaId), pagamentos.map((p) => p.ym), pagamentos.map((p) => p.pago), pagamentos.map((p) => p.situacao)],
  );
}

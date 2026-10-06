import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { HttpError, dinheiro, usuarioDe, uuid, ym } from "../http.js";
import { pool } from "../pool.js";
import { faturasQueVencem } from "../cartoes/routes.js";
import { lancamentosDoMes } from "../lancamentos/routes.js";
import { categorias, indicadores } from "./calculos.js";
import { valorReceita } from "./receitaAutomatica.js";
import type { Conta, MesResponse, Receita, ResumoMensal } from "./types.js";

const patchConta = z.object({
  pago: dinheiro.nullable(),
  situacao: z.enum(["Pago", "Pendente", "Não se aplica", ""], "Situacao invalida."),
});
const patchReceita = z.object({ valor: dinheiro.nullable() });

const CONTA_MES = `c.id, c.nome, c.categoria, c.dia_venc as "diaVenc", c.previsto, c.cartao_id as "cartaoId"`;

/**
 * Receitas, gastos e saldo de cada mes do ano. Gastos = contas pagas, faturas
 * inclusive, + avulsos fora do cartao (ver calculos.ts).
 */
export async function resumoDoAno(usuarioId: string, ano: number): Promise<ResumoMensal[]> {
  const { rows } = await pool.query<ResumoMensal>(
    `with meses as (
       select to_char(make_date($2::int, m, 1), 'YYYY-MM') as ym from generate_series(1, 12) m
     ),
     rec as (
       select m.ym, sum(${valorReceita("m.ym")}) as total
       from meses m
       cross join fontes_receita f
       left join receitas r on r.fonte_id = f.id and r.ym = m.ym
       where f.usuario_id = $1 group by m.ym
     ),
     pag as (
       select p.ym, sum(p.pago) as total from pagamentos p
       join contas c on c.id = p.conta_id
       where c.usuario_id = $1 and p.ym like $2 || '-%'
         and p.situacao is distinct from 'Não se aplica' group by p.ym
     ),
     -- Parcelada: cada parcela cai num mes a partir da compra (ver lancamentosDoMes).
     avu as (
       select to_char(date_trunc('month', l.data) + make_interval(months => k), 'YYYY-MM') as ym,
              sum(case when k = l.parcelas - 1 then l.valor - round(l.valor / l.parcelas, 2) * (l.parcelas - 1)
                       else round(l.valor / l.parcelas, 2) end) as total
       from lancamentos l cross join generate_series(0, l.parcelas - 1) k
       where l.usuario_id = $1 and l.cartao_id is null and l.data >= make_date($2::int - 4, 1, 1)
       group by 1
     )
     select m.ym,
            coalesce(rec.total, 0) as receitas,
            coalesce(pag.total, 0) + coalesce(avu.total, 0) as gastos,
            coalesce(rec.total, 0) - coalesce(pag.total, 0) - coalesce(avu.total, 0) as saldo
     from meses m
     left join rec on rec.ym = m.ym
     left join pag on pag.ym = m.ym
     left join avu on avu.ym = m.ym
     order by m.ym`,
    [usuarioId, String(ano)],
  );
  return rows;
}

export const mesRouter = Router();
mesRouter.use(exigirLogin);

mesRouter.get("/:ym", async (req, res) => {
  const mes = ym.parse(req.params.ym);
  const usuario = usuarioDe(req);

  const [contasDoBanco, receitas, lancamentos, ano, faturas] = await Promise.all([
    // Conta desativada ainda aparece nos meses em que teve lancamento.
    pool.query<Conta>(
      `select ${CONTA_MES}, p.pago, coalesce(p.situacao, '') as situacao
       from contas c
       left join pagamentos p on p.conta_id = c.id and p.ym = $2
       where c.usuario_id = $1 and (c.ativa or p.conta_id is not null)
       order by c.ordem, c.criado_em`,
      [usuario, mes],
    ),
    pool.query<Receita>(
      `select f.id, f.nome as fonte, f.previsto, ${valorReceita("$2")} as valor,
              r.valor is null and ${valorReceita("$2")} is not null as automatico
       from fontes_receita f
       left join receitas r on r.fonte_id = f.id and r.ym = $2
       where f.usuario_id = $1 and (f.ativa or r.fonte_id is not null)
       order by f.ordem, f.criado_em`,
      [usuario, mes],
    ),
    lancamentosDoMes(usuario, mes),
    resumoDoAno(usuario, Number(mes.slice(0, 4))),
    faturasQueVencem(usuario, mes),
  ]);

  // Conta de cartao: previsto e a fatura que vence no mes. Sem fatura e sem
  // baixa no mes, nao ha o que pagar e ela fica de fora.
  const contas = contasDoBanco.rows
    .map((c) => (c.cartaoId ? { ...c, previsto: faturas.get(c.cartaoId) ?? 0 } : c))
    .filter((c) => !c.cartaoId || c.previsto > 0 || c.situacao !== "");

  const body: MesResponse = {
    ym: mes,
    contas,
    receitas: receitas.rows,
    lancamentos,
    indicadores: indicadores(contas, receitas.rows, lancamentos, ano),
    categorias: categorias(contas, lancamentos),
    resumoAnual: ano,
  };
  res.json(body);
});

mesRouter.patch("/:ym/contas/:id", async (req, res) => {
  const mes = ym.parse(req.params.ym);
  const id = uuid.parse(req.params.id);
  const { pago, situacao } = patchConta.parse(req.body);

  // O select em `c` garante que a conta e do usuario logado.
  const { rows } = await pool.query<Conta>(
    `with c as (
       select id, nome, categoria, dia_venc, previsto, cartao_id from contas where id = $1 and usuario_id = $2
     ),
     up as (
       insert into pagamentos (conta_id, ym, pago, situacao)
       select id, $3, $4, $5 from c
       on conflict (conta_id, ym) do update
         set pago = excluded.pago, situacao = excluded.situacao, atualizado_em = now()
       returning pago, situacao
     )
     select ${CONTA_MES}, up.pago, coalesce(up.situacao, '') as situacao from c, up`,
    [id, usuarioDe(req), mes, pago, situacao || null],
  );
  if (!rows[0]) throw new HttpError(404, "Conta nao encontrada.");
  res.json(rows[0]);
});

mesRouter.patch("/:ym/receitas/:id", async (req, res) => {
  const mes = ym.parse(req.params.ym);
  const id = uuid.parse(req.params.id);
  const { valor } = patchReceita.parse(req.body);

  const { rows } = await pool.query<Receita>(
    `with f as (
       select id, nome, previsto from fontes_receita where id = $1 and usuario_id = $2
     ),
     up as (
       insert into receitas (fonte_id, ym, valor)
       select id, $3, $4 from f
       on conflict (fonte_id, ym) do update set valor = excluded.valor, atualizado_em = now()
       returning valor
     )
     select f.id, f.nome as fonte, f.previsto, up.valor, false as automatico from f, up`,
    [id, usuarioDe(req), mes, valor],
  );
  if (!rows[0]) throw new HttpError(404, "Fonte nao encontrada.");
  res.json(rows[0]);
});

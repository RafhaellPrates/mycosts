import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { HttpError, dinheiro, usuarioDe, uuid, ym } from "../http.js";
import { pool } from "../pool.js";
import { categorias, indicadores } from "./calculos.js";
import type { Conta, MesResponse, Receita, ResumoMensal } from "./types.js";

const patchConta = z.object({
  pago: dinheiro.nullable(),
  situacao: z.enum(["Pago", "Pendente", "Não se aplica", ""], "Situacao invalida."),
});
const patchReceita = z.object({ valor: dinheiro.nullable() });

const CONTA_MES = `c.id, c.nome, c.categoria, c.dia_venc as "diaVenc", c.previsto`;

export const mesRouter = Router();
mesRouter.use(exigirLogin);

mesRouter.get("/:ym", async (req, res) => {
  const mes = ym.parse(req.params.ym);
  const usuario = usuarioDe(req);

  const [contas, receitas, ano] = await Promise.all([
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
      `select f.id, f.nome as fonte, r.valor
       from fontes_receita f
       left join receitas r on r.fonte_id = f.id and r.ym = $2
       where f.usuario_id = $1 and (f.ativa or r.fonte_id is not null)
       order by f.ordem, f.criado_em`,
      [usuario, mes],
    ),
    pool.query<ResumoMensal>(
      `with meses as (
         select to_char(make_date($2::int, m, 1), 'YYYY-MM') as ym from generate_series(1, 12) m
       ),
       rec as (
         select r.ym, sum(r.valor) as total from receitas r
         join fontes_receita f on f.id = r.fonte_id
         where f.usuario_id = $1 and r.ym like $2 || '-%' group by r.ym
       ),
       pag as (
         select p.ym, sum(p.pago) as total from pagamentos p
         join contas c on c.id = p.conta_id
         where c.usuario_id = $1 and p.ym like $2 || '-%' group by p.ym
       )
       select m.ym,
              coalesce(rec.total, 0) as receitas,
              coalesce(pag.total, 0) as pagas,
              coalesce(rec.total, 0) - coalesce(pag.total, 0) as saldo
       from meses m
       left join rec on rec.ym = m.ym
       left join pag on pag.ym = m.ym
       order by m.ym`,
      [usuario, mes.slice(0, 4)],
    ),
  ]);

  const body: MesResponse = {
    ym: mes,
    contas: contas.rows,
    receitas: receitas.rows,
    indicadores: indicadores(contas.rows, receitas.rows, ano.rows),
    categorias: categorias(contas.rows),
    resumoAnual: ano.rows,
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
       select id, nome, categoria, dia_venc, previsto from contas where id = $1 and usuario_id = $2
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
       select id, nome from fontes_receita where id = $1 and usuario_id = $2
     ),
     up as (
       insert into receitas (fonte_id, ym, valor)
       select id, $3, $4 from f
       on conflict (fonte_id, ym) do update set valor = excluded.valor, atualizado_em = now()
       returning valor
     )
     select f.id, f.nome as fonte, up.valor from f, up`,
    [id, usuarioDe(req), mes, valor],
  );
  if (!rows[0]) throw new HttpError(404, "Fonte nao encontrada.");
  res.json(rows[0]);
});

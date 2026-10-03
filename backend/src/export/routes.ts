import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { usuarioDe } from "../http.js";
import { resumoDoAno } from "../mes/routes.js";
import type { Lancamento } from "../mes/types.js";
import { pool } from "../pool.js";
import { gerarPlanilha, type DadosAno } from "./planilha.js";

const arquivo = z
  .string()
  .regex(/^\d{4}\.xlsx$/, "Use /export/AAAA.xlsx.")
  .transform((s) => Number(s.slice(0, 4)))
  .refine((ano) => ano >= 2000 && ano <= 2100, "Ano invalido.");

export const exportRouter = Router();
exportRouter.use(exigirLogin);

/** GET /export/2026.xlsx: Controle_Financeiro do ano do usuario logado. */
exportRouter.get("/:arquivo", async (req, res) => {
  const ano = arquivo.parse(req.params.arquivo);
  const usuario = usuarioDe(req);
  const prefixo = `${ano}-%`;

  const [contas, pagamentos, fontes, receitas, lancamentos, resumo] = await Promise.all([
    // Mesma regra da tela do mes: conta desativada entra se teve lancamento no ano.
    pool.query<DadosAno["contas"][number]>(
      `select c.id, c.nome, c.categoria, c.dia_venc as "diaVenc", c.previsto, c.ativa
       from contas c
       where c.usuario_id = $1
         and (c.ativa or exists (select 1 from pagamentos p where p.conta_id = c.id and p.ym like $2))
       order by c.ordem, c.criado_em`,
      [usuario, prefixo],
    ),
    pool.query<DadosAno["pagamentos"][number]>(
      `select p.conta_id as "contaId", p.ym, p.pago, p.situacao
       from pagamentos p join contas c on c.id = p.conta_id
       where c.usuario_id = $1 and p.ym like $2`,
      [usuario, prefixo],
    ),
    pool.query<DadosAno["fontes"][number]>(
      `select f.id, f.nome from fontes_receita f
       where f.usuario_id = $1
         and (f.ativa or exists (select 1 from receitas r where r.fonte_id = f.id and r.ym like $2))
       order by f.ordem, f.criado_em`,
      [usuario, prefixo],
    ),
    pool.query<DadosAno["receitas"][number]>(
      `select r.fonte_id as "fonteId", r.ym, r.valor
       from receitas r join fontes_receita f on f.id = r.fonte_id
       where f.usuario_id = $1 and r.ym like $2`,
      [usuario, prefixo],
    ),
    pool.query<Lancamento>(
      `select id, to_char(data, 'YYYY-MM-DD') as data, descricao, categoria, valor,
              forma_pagamento as "formaPagamento"
       from lancamentos
       where usuario_id = $1 and data >= make_date($2::int, 1, 1) and data < make_date($2::int + 1, 1, 1)`,
      [usuario, ano],
    ),
    resumoDoAno(usuario, ano),
  ]);

  const buffer = await gerarPlanilha({
    ano,
    contas: contas.rows,
    pagamentos: pagamentos.rows,
    fontes: fontes.rows,
    receitas: receitas.rows,
    lancamentos: lancamentos.rows,
    resumo,
  });
  res
    .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    .attachment(`Controle_Financeiro_${ano}.xlsx`)
    .send(buffer);
});

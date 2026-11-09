import { Router } from "express";
import { z } from "zod";
import { exigirLogin } from "../auth/token.js";
import { env } from "../env.js";
import { HttpError, usuarioDe } from "../http.js";
import { pool } from "../pool.js";
import { VERSAO_ATUAL, enviarParaUsuario, marcarAviso, pushAtivo } from "./push.js";

const inscricao = z.object({
  endpoint: z.string().url("Inscricao invalida.").max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

export const notificacoesRouter = Router();
notificacoesRouter.use(exigirLogin);

/** Chave publica para o navegador criar a inscricao. null = push desligado no servidor. */
notificacoesRouter.get("/", async (req, res) => {
  const { rows } = await pool.query<{ n: number }>(
    "select count(*)::int as n from push_inscricoes where usuario_id = $1",
    [usuarioDe(req)],
  );
  res.json({ chavePublica: pushAtivo ? env.VAPID_PUBLIC_KEY : null, aparelhos: rows[0]?.n ?? 0 });
});

/** Liga a notificacao neste aparelho (o mesmo endpoint troca de dono se outro usuario entrar nele). */
notificacoesRouter.post("/inscricao", async (req, res) => {
  if (!pushAtivo) throw new HttpError(503, "Notificações não estão configuradas no servidor.");
  const usuario = usuarioDe(req);
  const i = inscricao.parse(req.body);
  await pool.query(
    `insert into push_inscricoes (endpoint, usuario_id, p256dh, auth) values ($1, $2, $3, $4)
     on conflict (endpoint) do update set usuario_id = excluded.usuario_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [i.endpoint, usuario, i.keys.p256dh, i.keys.auth],
  );
  // Quem liga agora ja esta na versao atual: o aviso de atualizacao fica para a proxima.
  if (VERSAO_ATUAL) await marcarAviso(usuario, `versao:${VERSAO_ATUAL}`);
  res.status(201).json({ ok: true });
});

notificacoesRouter.delete("/inscricao", async (req, res) => {
  const { endpoint } = inscricao.pick({ endpoint: true }).parse(req.body);
  await pool.query("delete from push_inscricoes where endpoint = $1 and usuario_id = $2", [endpoint, usuarioDe(req)]);
  res.status(204).end();
});

/** Manda uma notificacao de teste para os aparelhos do usuario. */
notificacoesRouter.post("/teste", async (req, res) => {
  if (!pushAtivo) throw new HttpError(503, "Notificações não estão configuradas no servidor.");
  const entregues = await enviarParaUsuario(usuarioDe(req), {
    titulo: "MyCosts",
    corpo: "Notificações ligadas. Você recebe um aviso no dia do salário e quando sair versão nova.",
    tag: "teste",
  });
  if (!entregues) throw new HttpError(404, "Nenhum aparelho recebeu. Ative as notificações de novo.");
  res.json({ entregues });
});

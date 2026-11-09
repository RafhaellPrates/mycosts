import { readFileSync } from "node:fs";
import webpush from "web-push";
import { env } from "../env.js";
import { hojeBR } from "../cartoes/fatura.js";
import { pool } from "../pool.js";

/**
 * Notificacao por Web Push. O navegador guarda a inscricao (endpoint + chaves)
 * e o back manda a mensagem por ela, mesmo com o app fechado. No iPhone so
 * funciona com o app adicionado a Tela de Inicio (iOS 16.4+).
 */

export const pushAtivo = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
if (pushAtivo) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!);

export interface Mensagem {
  titulo: string;
  corpo: string;
  /** Agrupa: notificacao nova com a mesma tag substitui a anterior. */
  tag?: string;
}

interface InscricaoRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Manda para uma inscricao. Endpoint que nao existe mais (404/410) e apagado. Retorna se entregou. */
async function enviar(i: InscricaoRow, m: Mensagem): Promise<boolean> {
  try {
    await webpush.sendNotification(
      { endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } },
      JSON.stringify(m),
      { TTL: 60 * 60 * 24 },
    );
    return true;
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    if (status === 404 || status === 410) await pool.query("delete from push_inscricoes where endpoint = $1", [i.endpoint]);
    else console.error("push:", status, (e as Error).message);
    return false;
  }
}

/** Manda para todos os aparelhos do usuario. Retorna quantos receberam. */
export async function enviarParaUsuario(usuarioId: string, m: Mensagem): Promise<number> {
  if (!pushAtivo) return 0;
  const { rows } = await pool.query<InscricaoRow>(
    "select endpoint, p256dh, auth from push_inscricoes where usuario_id = $1",
    [usuarioId],
  );
  const entregues = await Promise.all(rows.map((i) => enviar(i, m)));
  return entregues.filter(Boolean).length;
}

const ymDe = (d: { y: number; m: number }) => `${d.y}-${String(d.m).padStart(2, "0")}`;

/** Hora atual em Sao Paulo (0..23). */
function horaBR(): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }).format(new Date()));
}

/** Janela em que os avisos saem (horario de Sao Paulo): ninguem recebe de madrugada. */
const HORA_INICIO = 9;
const HORA_FIM = 21;
/** Lembrete de quem nao informou o dia do recebimento em nenhuma fonte. */
export const DIA_LEMBRETE = 5;

/** Versao mais nova do "O que mudou" (frontend/src/lib/novidades.json, o mesmo arquivo do front). */
export const VERSAO_ATUAL: string | null = (() => {
  try {
    const lista = JSON.parse(readFileSync(new URL("../../../frontend/src/lib/novidades.json", import.meta.url), "utf8"));
    return typeof lista[0]?.versao === "string" ? lista[0].versao : null;
  } catch (e) {
    console.error("novidades.json:", (e as Error).message);
    return null;
  }
})();

/** Registra o aviso. true = primeira vez, quem chamou manda o push. Marca antes de mandar: ninguem recebe duas vezes. */
export async function marcarAviso(usuarioId: string, chave: string): Promise<boolean> {
  const { rowCount } = await pool.query(
    "insert into avisos_enviados (usuario_id, chave) values ($1, $2) on conflict do nothing",
    [usuarioId, chave],
  );
  return rowCount === 1;
}

async function avisar(usuarioId: string, chave: string, m: Mensagem): Promise<number> {
  return (await marcarAviso(usuarioId, chave)) ? enviarParaUsuario(usuarioId, m) : 0;
}

/**
 * Avisos automaticos. Roda a cada 15 min (index.ts), entre 9h e 21h:
 * - no dia do recebimento de cada fonte ativa ("Salario na conta"). Dia 31
 *   em mes de 30 dias cai no ultimo dia;
 * - no dia 5, para quem nao informou dia em nenhuma fonte;
 * - versao nova publicada, uma vez por usuario.
 * So entra quem tem aparelho inscrito. Retorna quantos aparelhos receberam.
 */
export async function avisosAutomaticos(): Promise<number> {
  if (!pushAtivo) return 0;
  const hora = horaBR();
  if (hora < HORA_INICIO || hora >= HORA_FIM) return 0;
  const hoje = hojeBR();
  const mes = ymDe(hoje);
  const ultimoDia = new Date(hoje.y, hoje.m, 0).getDate();
  let n = 0;

  const { rows: fontes } = await pool.query<{ usuario_id: string; id: string; nome: string }>(
    `select f.usuario_id, f.id, f.nome from fontes_receita f
     where f.ativa and least(f.dia, $1) = $2
       and exists (select 1 from push_inscricoes p where p.usuario_id = f.usuario_id)`,
    [ultimoDia, hoje.d],
  );
  for (const f of fontes) {
    n += await avisar(f.usuario_id, `receita:${f.id}:${mes}`, {
      titulo: `${f.nome} na conta`,
      corpo: "Melhor já se organizar: lance a receita e confira as contas do mês.",
      tag: `receita-${f.id}-${mes}`,
    });
  }

  if (hoje.d === DIA_LEMBRETE) {
    const { rows } = await pool.query<{ usuario_id: string }>(
      `select distinct p.usuario_id from push_inscricoes p
       where not exists (select 1 from fontes_receita f where f.usuario_id = p.usuario_id and f.ativa and f.dia is not null)`,
    );
    for (const u of rows) {
      n += await avisar(u.usuario_id, `lembrete:${mes}`, {
        titulo: "Hora de organizar as finanças",
        corpo: "Lance as receitas do mês e confira as contas que vão vencer.",
        tag: `lembrete-${mes}`,
      });
    }
  }

  if (VERSAO_ATUAL) {
    const { rows } = await pool.query<{ usuario_id: string }>("select distinct usuario_id from push_inscricoes");
    for (const u of rows) {
      n += await avisar(u.usuario_id, `versao:${VERSAO_ATUAL}`, {
        titulo: "Chegou uma nova atualização",
        corpo: "Vem conferir o que mudou no MyCosts.",
        tag: `versao-${VERSAO_ATUAL}`,
      });
    }
  }
  return n;
}

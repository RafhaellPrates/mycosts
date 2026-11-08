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

// Dia e hora do lembrete mensal.
export const DIA_LEMBRETE = 5;
const HORA_LEMBRETE = 9;

/**
 * Lembrete do dia 5: a partir das 9h, uma vez por mes por aparelho. Roda a
 * cada 15 min (index.ts). Se o servidor ficou fora no dia 5, manda na
 * primeira rodada depois, ainda no mesmo mes.
 */
export async function lembreteDoMes(): Promise<number> {
  if (!pushAtivo) return 0;
  const hoje = hojeBR();
  if (hoje.d < DIA_LEMBRETE || (hoje.d === DIA_LEMBRETE && horaBR() < HORA_LEMBRETE)) return 0;
  const mes = ymDe(hoje);
  const { rows } = await pool.query<InscricaoRow>(
    "select endpoint, p256dh, auth from push_inscricoes where ultimo_aviso is distinct from $1",
    [mes],
  );
  let n = 0;
  for (const i of rows) {
    // Marca antes de mandar: se o processo cair no meio, ninguem recebe duas vezes.
    await pool.query("update push_inscricoes set ultimo_aviso = $2 where endpoint = $1", [i.endpoint, mes]);
    const ok = await enviar(i, {
      titulo: "Hora de organizar as finanças",
      corpo: "Lance as receitas do mês e confira as contas que vão vencer.",
      tag: `lembrete-${mes}`,
    });
    if (ok) n++;
  }
  return n;
}

/** Mes em que a inscricao nova ja conta como avisada: quem ativa depois do dia 5 recebe a partir do mes seguinte. */
export function avisoInicial(): string | null {
  const hoje = hojeBR();
  return hoje.d >= DIA_LEMBRETE ? ymDe(hoje) : null;
}

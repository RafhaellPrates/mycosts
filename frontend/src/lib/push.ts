import { api } from "../api/index.ts";

/**
 * Notificacoes do sistema (Web Push). Fluxo: registrar o service worker
 * (public/sw.js), pedir permissao, criar a inscricao com a chave publica do
 * servidor e mandar para o back, que dispara o lembrete do dia 5.
 */

export type EstadoPush =
  /** Navegador sem suporte. */
  | "sem-suporte"
  /** iPhone/iPad fora da Tela de Inicio: o Safari so libera push no app instalado. */
  | "instalar"
  /** Servidor sem chaves configuradas. */
  | "servidor-desligado"
  /** A pessoa bloqueou nas permissoes do navegador. */
  | "bloqueado"
  | "desligado"
  | "ligado";

const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const instalado = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
const temSuporte = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Registra o service worker. Chamado uma vez no main.tsx. */
export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("service worker:", e));
}

async function inscricaoAtual(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export async function estadoPush(): Promise<EstadoPush> {
  if (!temSuporte()) return ehIOS() && !instalado() ? "instalar" : "sem-suporte";
  const { chavePublica } = await api.notificacoes();
  if (!chavePublica) return "servidor-desligado";
  if (Notification.permission === "denied") return "bloqueado";
  const sub = Notification.permission === "granted" ? await inscricaoAtual() : null;
  return sub ? "ligado" : "desligado";
}

/** Chave VAPID (base64url) no formato que o PushManager pede. */
function chaveBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** Pede permissao e liga neste aparelho. Precisa vir de um toque (exigencia do Safari). */
export async function ligarPush(): Promise<EstadoPush> {
  const { chavePublica } = await api.notificacoes();
  if (!chavePublica) return "servidor-desligado";
  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") return permissao === "denied" ? "bloqueado" : "desligado";
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(chavePublica) }));
  await api.inscreverPush(sub.toJSON());
  return "ligado";
}

export async function desligarPush(): Promise<EstadoPush> {
  const sub = await inscricaoAtual();
  if (sub) {
    await api.desinscreverPush(sub.endpoint).catch(() => undefined);
    await sub.unsubscribe();
  }
  return "desligado";
}

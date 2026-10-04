import type { Preferencias } from "../api/types.ts";

/**
 * Aplica tema e cores escolhidos no Perfil. O tema vira data-tema no <html>
 * (index.css decide as cores); as cores personalizadas entram como variaveis
 * inline, que vencem o CSS nos dois temas. Uma copia fica no aparelho para o
 * app ja abrir com a aparencia certa antes do /me responder.
 */

const CHAVE = "mycosts.aparencia";

/** Cores padrao de cada tema (as mesmas do index.css). */
export const PADRAO = {
  claro: { destaque: "#0f766e", receitas: "#15803d", gastos: "#b91c1c" },
  escuro: { destaque: "#2dd4bf", receitas: "#4ade80", gastos: "#f87171" },
} as const;

const VARS = ["--brand", "--brand-soft", "--on-brand", "--pos", "--neg", "--on-neg"];

/** Luminancia relativa (WCAG) de uma cor #rrggbb. */
function luminancia(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Texto claro ou escuro, o que tiver mais contraste sobre a cor. */
export function textoSobre(hex: string): string {
  const l = luminancia(hex);
  const comBranco = 1.05 / (l + 0.05);
  const comEscuro = (l + 0.05) / 0.06;
  return comBranco >= comEscuro ? "#ffffff" : "#0b1220";
}

/** Tema em uso agora: o escolhido ou, em "sistema", o do aparelho. */
export function temaEfetivo(p: Preferencias): "claro" | "escuro" {
  if (p.tema === "claro" || p.tema === "escuro") return p.tema;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "escuro" : "claro";
}

export function aplicarAparencia(p: Preferencias) {
  const root = document.documentElement;
  if (p.tema === "claro" || p.tema === "escuro") root.dataset.tema = p.tema;
  else delete root.dataset.tema;

  VARS.forEach((v) => root.style.removeProperty(v));
  const { destaque, receitas, gastos } = p.cores ?? {};
  if (destaque) {
    root.style.setProperty("--brand", destaque);
    root.style.setProperty("--on-brand", textoSobre(destaque));
    root.style.setProperty("--brand-soft", `color-mix(in srgb, ${destaque} 20%, var(--surface))`);
  }
  if (receitas) root.style.setProperty("--pos", receitas);
  if (gastos) {
    root.style.setProperty("--neg", gastos);
    root.style.setProperty("--on-neg", textoSobre(gastos));
  }

  try {
    localStorage.setItem(CHAVE, JSON.stringify(p));
  } catch {
    /* modo privado: so nao fica a copia local */
  }
}

/** Chamado antes do primeiro render (main.tsx). */
export function aplicarAparenciaSalva() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) aplicarAparencia(JSON.parse(salvo) as Preferencias);
  } catch {
    /* copia invalida ou sem storage: fica o padrao */
  }
}

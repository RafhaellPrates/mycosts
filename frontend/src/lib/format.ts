const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function money(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return brl.format(v);
}

export function pct(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(1).replace(".", ",")}%`;
}

/** "2026-09" -> "setembro de 2026" */
export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}

/** "2026-09" -> "set/26" (mesmo rotulo da planilha) */
export function monthShort(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const s = new Date(y, m - 1, 1).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
  return `${s}/${String(y).slice(2)}`;
}

export function currentYm(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function shiftYm(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Aceita "1.234,56", "1234.56", "1234,5" e devolve numero ou null. */
export function parseMoney(raw: string): number | null {
  const s = raw.trim().replace(/\s|R\$/g, "");
  if (!s) return null;
  const normalized = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : null;
}

export function toInput(v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return v.toFixed(2).replace(".", ",");
}

/** Prazo de uma conta a pagar no mes aberto. */

export type NivelPrazo = "normal" | "atencao" | "proximo" | "vencida";

export interface Prazo {
  /** Dias ate o vencimento; negativo = vencida ha tantos dias. */
  dias: number;
  nivel: NivelPrazo;
  texto: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * 15 dias ou menos = atencao (amarelo), 5 ou menos = proximo (laranja),
 * passou do dia = vencida (vermelho). Dia 31 em mes de 30 vence no dia 30.
 */
export function prazoDe(ym: string, diaVenc: number | null, hoje = new Date()): Prazo | null {
  if (!diaVenc) return null;
  const [y, m] = ym.split("-").map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  const venc = new Date(y, m - 1, Math.min(diaVenc, ultimoDia));
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const dias = Math.round((venc.getTime() - inicioHoje.getTime()) / DIA_MS);

  const nivel: NivelPrazo = dias < 0 ? "vencida" : dias <= 5 ? "proximo" : dias <= 15 ? "atencao" : "normal";
  const texto =
    dias < -1 ? `venceu há ${-dias} dias`
    : dias === -1 ? "venceu ontem"
    : dias === 0 ? "vence hoje"
    : dias === 1 ? "vence amanhã"
    : dias <= 30 ? `vence em ${dias} dias`
    : `vence dia ${venc.getDate()}`;
  return { dias, nivel, texto };
}

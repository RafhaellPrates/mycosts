import { api } from "../api/index.ts";
import { prepararComprovante } from "./imagem.ts";

export const MAX_COMPROVANTES = 5;
export const ACEITA = "image/*,application/pdf";

/** Arquivo escolhido num gasto novo: sobe depois que o gasto for salvo. */
export interface Pendente {
  chave: string;
  arquivo: File;
}

/** Sobe os pendentes de um gasto recem-criado. Retorna quantos falharam. */
export async function enviarPendentes(lancamentoId: string, pendentes: Pendente[]): Promise<number> {
  let falhas = 0;
  for (const p of pendentes) {
    try {
      const { blob, nome } = await prepararComprovante(p.arquivo);
      await api.anexarComprovante({ lancamento: lancamentoId }, blob, nome);
    } catch {
      falhas++;
    }
  }
  return falhas;
}


import express, { type Response } from "express";
import { HttpError } from "./http.js";

/**
 * Upload de arquivo: o corpo da requisicao e o arquivo cru (nao JSON nem
 * multipart), com o Content-Type do arquivo. O tipo de verdade sai dos
 * primeiros bytes, nao do que o navegador diz.
 */

export const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp"] as const;
export const TIPOS_COMPROVANTE = [...TIPOS_IMAGEM, "application/pdf"] as const;
export type TipoArquivo = (typeof TIPOS_COMPROVANTE)[number];

/** Le o corpo cru ate `limite` (ex.: "3mb"). Acima disso o express responde 413. */
export const corpoArquivo = (limite: string) =>
  express.raw({ type: () => true, limit: limite });

/** Tipo pelo conteudo (assinatura do arquivo). null = nao e um dos aceitos. */
export function tipoPelosBytes(b: Buffer): TipoArquivo | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (b.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  return null;
}

/** Corpo do upload validado contra os tipos aceitos. */
export function arquivoDe(body: unknown, aceitos: readonly TipoArquivo[]): { dados: Buffer; tipo: TipoArquivo } {
  if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(400, "Envie o arquivo.");
  const tipo = tipoPelosBytes(body);
  if (!tipo || !aceitos.includes(tipo)) {
    throw new HttpError(415, aceitos.includes("application/pdf") ? "Envie uma foto (JPG, PNG, WEBP) ou um PDF." : "Envie uma foto JPG, PNG ou WEBP.");
  }
  return { dados: body, tipo };
}

/** Manda o arquivo guardado. nosniff: o navegador nao reinterpreta o tipo. */
export function enviarArquivo(res: Response, tipo: string, dados: Buffer, nome?: string) {
  res.setHeader("Content-Type", tipo);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, max-age=86400");
  if (nome) res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(nome)}`);
  res.send(dados);
}

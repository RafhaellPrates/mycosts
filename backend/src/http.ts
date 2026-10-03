import type { ErrorRequestHandler, Request } from "express";
import { z } from "zod";

/** Erro com status HTTP e mensagem que pode ir para o usuario. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Id do usuario logado. So chamar em rota protegida por exigirLogin. */
export function usuarioDe(req: Request): string {
  if (!req.usuarioId) throw new HttpError(401, "Login necessario.");
  return req.usuarioId;
}

export const uuid = z.string().uuid("Id invalido.");

export const ym = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Mes deve estar no formato AAAA-MM.");

/** Valor em reais: ate 2 casas, nao negativo. */
export const dinheiro = z
  .number()
  .nonnegative("Valor nao pode ser negativo.")
  .max(9_999_999_999.99)
  .transform((v) => Math.round(v * 100) / 100);

// Express 5 ja manda erro de handler async pra ca.
export const tratarErro: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    res.status(400).json({ erro: err.issues[0]?.message ?? "Dados invalidos.", campos: err.issues });
    return;
  }
  if (err instanceof HttpError) {
    res.status(err.status).json({ erro: err.message });
    return;
  }
  if (err?.type === "entity.parse.failed") {
    res.status(400).json({ erro: "JSON invalido." });
    return;
  }
  console.error(err);
  res.status(500).json({ erro: "Erro interno." });
};

/** Monta "col = $n" so com os campos enviados. */
export function setDe(campos: Record<string, unknown>, mapa: Record<string, string>, inicio: number) {
  const sets: string[] = [];
  const valores: unknown[] = [];
  for (const [chave, coluna] of Object.entries(mapa)) {
    if (campos[chave] === undefined) continue;
    valores.push(campos[chave]);
    sets.push(`${coluna} = $${inicio + valores.length - 1}`);
  }
  if (!sets.length) throw new HttpError(400, "Nada para alterar.");
  return { sets: sets.join(", "), valores };
}

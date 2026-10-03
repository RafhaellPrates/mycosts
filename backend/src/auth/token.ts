import jwt from "jsonwebtoken";
import type { RequestHandler } from "express";
import { env } from "../env.js";
import { HttpError } from "../http.js";

declare global {
  namespace Express {
    interface Request {
      usuarioId?: string;
    }
  }
}

const ALG = "HS256" as const;

export function assinarToken(usuarioId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    algorithm: ALG,
    subject: usuarioId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

/** Exige `Authorization: Bearer <token>` valido e preenche req.usuarioId. */
export const exigirLogin: RequestHandler = (req, _res, next) => {
  const [tipo, token] = req.headers.authorization?.split(" ") ?? [];
  if (tipo !== "Bearer" || !token) throw new HttpError(401, "Login necessario.");
  try {
    // algorithms fixo: impede token com alg "none" ou trocado.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [ALG] });
    if (typeof payload === "string" || !payload.sub) throw new Error("sem sub");
    req.usuarioId = payload.sub;
  } catch {
    throw new HttpError(401, "Sessao expirada. Entre de novo.");
  }
  next();
};

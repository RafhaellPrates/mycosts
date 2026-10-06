import { z } from "zod";

/** Campos de usuario usados no Perfil, no login e na area de admin. */

// Email sempre minusculo: o banco tem unique em usuarios.email, entao
// "Fulano@x.com" e "fulano@x.com" sao a mesma conta.
export const email = z.string().trim().toLowerCase().email("Email invalido.").max(254);

// bcrypt so considera os primeiros 72 bytes.
export const senha = z
  .string()
  .min(8, "Senha precisa de pelo menos 8 caracteres.")
  .refine((s) => Buffer.byteLength(s) <= 72, "Senha muito longa.");

// Sem @: o login aceita email ou nome e decide pelo @.
export const nome = z
  .string()
  .trim()
  .min(1, "Informe o nome.")
  .max(60, "Nome muito longo.")
  .refine((s) => !s.includes("@"), "Nome nao pode ter @.");

export const papel = z.enum(["admin", "usuario"], "Nivel de acesso invalido.");

const cor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor invalida.");

/** Aparencia escolhida no Perfil. Objeto vazio = visual padrao. */
export const preferencias = z
  .object({
    tema: z.enum(["sistema", "claro", "escuro"]).optional(),
    cores: z
      .object({ destaque: cor.optional(), receitas: cor.optional(), gastos: cor.optional() })
      .strict()
      .optional(),
  })
  .strict();

export type Preferencias = z.infer<typeof preferencias>;

export interface UsuarioRow {
  id: string;
  email: string;
  nome: string;
  papel: "admin" | "usuario" | "visitante";
  preferencias: Preferencias;
}

export const USUARIO_COLS = "id, email, nome, papel, preferencias";

/** Postgres 23505 = unique violada: diz qual campo repetiu. */
export function duplicado(e: unknown): string | null {
  const erro = e as { code?: string; constraint?: string };
  if (erro?.code !== "23505") return null;
  return erro.constraint === "usuarios_nome_unico" ? "Ja existe um acesso com esse nome." : "Ja existe um acesso com esse email.";
}

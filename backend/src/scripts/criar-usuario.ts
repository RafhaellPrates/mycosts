import bcrypt from "bcryptjs";
import { z } from "zod";
import { duplicado, email, nome } from "../auth/validacao.js";
import { pool } from "../pool.js";
import { fecharTerminal, perguntar, perguntarNovaSenha } from "./terminal.js";

/**
 * Cria o acesso de uma pessoa pelo terminal. Pelo app, o admin faz o mesmo
 * na aba Acessos; este script serve para o primeiro admin e para emergencias.
 *   npm run criar-usuario
 *
 * Se o email ja tiver conta, oferece redefinir a senha (para quem esqueceu).
 */


async function main() {
  const e = email.parse(await perguntar("Email: "));
  const { rows } = await pool.query<{ id: string; nome: string }>("select id, nome from usuarios where email = $1", [e]);

  if (rows[0]) {
    const resp = await perguntar(`Ja existe conta de ${rows[0].nome} com esse email. Redefinir a senha? (s/n) `);
    if (resp.toLowerCase() !== "s") return console.log("Nada alterado.");
    const hash = await bcrypt.hash(await perguntarNovaSenha(), 12);
    await pool.query("update usuarios set senha_hash = $2 where id = $1", [rows[0].id, hash]);
    return console.log(`Senha de ${e} redefinida.`);
  }

  const n = nome.parse(await perguntar("Nome (tambem serve para entrar): "));
  const admin = (await perguntar("Admin? Pode criar e apagar acessos (s/n) ")).toLowerCase() === "s";
  const hash = await bcrypt.hash(await perguntarNovaSenha(), 12);
  try {
    await pool.query("insert into usuarios (email, senha_hash, nome, papel) values ($1, $2, $3, $4)", [
      e,
      hash,
      n,
      admin ? "admin" : "usuario",
    ]);
  } catch (err) {
    throw new Error(duplicado(err) ?? (err as Error).message);
  }
  console.log(`Acesso criado: ${n} <${e}>${admin ? " (admin)" : ""}.`);
}

main()
  .catch((e) => {
    console.error(`Erro: ${e instanceof z.ZodError ? e.issues[0]?.message : (e as Error).message}`);
    process.exitCode = 1;
  })
  .finally(() => {
    fecharTerminal();
    return pool.end();
  });

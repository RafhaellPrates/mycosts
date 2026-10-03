import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "../pool.js";
import { fecharTerminal, perguntar, perguntarNovaSenha } from "./terminal.js";

/**
 * Cria o acesso de uma pessoa. O app nao tem tela de cadastro: as contas
 * sao criadas aqui, pelo terminal.
 *   npm run criar-usuario
 *
 * Se o email ja tiver conta, oferece redefinir a senha (para quem esqueceu).
 */

const email = z.string().trim().toLowerCase().email("Email invalido.").max(254);
const nome = z.string().trim().min(1, "Informe o nome.").max(60, "Nome muito longo.");

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

  const n = nome.parse(await perguntar("Nome: "));
  const hash = await bcrypt.hash(await perguntarNovaSenha(), 12);
  await pool.query("insert into usuarios (email, senha_hash, nome) values ($1, $2, $3)", [e, hash, n]);
  console.log(`Acesso criado: ${n} <${e}>.`);
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

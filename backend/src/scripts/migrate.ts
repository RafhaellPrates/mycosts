import "dotenv/config";
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";
import { criarPool } from "../db.js";

/**
 * Aplica, em ordem, os arquivos de backend/migrations que ainda nao rodaram.
 * Cada arquivo roda numa transacao; o nome fica gravado em schema_migrations.
 *   dev:  npm run migrate
 *   prod: npm run migrate:prod (depois do build)
 */

const { DATABASE_URL } = z.object({ DATABASE_URL: z.string().url() }).parse(process.env);
// Funciona tanto de src/scripts (tsx) quanto de dist/scripts (node).
const dir = new URL("../../migrations/", import.meta.url);

const pool = criarPool(DATABASE_URL);
const client = await pool.connect();

try {
  await client.query(`
    create table if not exists schema_migrations (
      nome         text primary key,
      aplicada_em  timestamptz not null default now()
    );
    alter table schema_migrations enable row level security;
  `);

  const { rows } = await client.query<{ nome: string }>("select nome from schema_migrations");
  const aplicadas = new Set(rows.map((r) => r.nome));
  const arquivos = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  let novas = 0;
  for (const arquivo of arquivos) {
    if (aplicadas.has(arquivo)) continue;
    const sql = await readFile(new URL(arquivo, dir), "utf8");
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("insert into schema_migrations (nome) values ($1)", [arquivo]);
      await client.query("commit");
      console.log(`aplicada: ${arquivo}`);
      novas++;
    } catch (e) {
      await client.query("rollback");
      throw new Error(`falhou em ${arquivo}: ${(e as Error).message}`);
    }
  }
  console.log(novas ? `${novas} migration(s) aplicada(s).` : "Banco ja esta atualizado.");
} finally {
  client.release();
  await pool.end();
}

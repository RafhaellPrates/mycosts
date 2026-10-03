import pg from "pg";

// numeric volta como string no pg; aqui todo numeric e dinheiro com 2 casas.
pg.types.setTypeParser(pg.types.builtins.NUMERIC, (v) => Number(v));

/**
 * Pool unico do app. So depende de DATABASE_URL: trocar o Postgres de host
 * (Supabase, Neon, local) e so trocar a string.
 */
export function criarPool(connectionString: string): pg.Pool {
  const host = new URL(connectionString).hostname;
  const local = host === "localhost" || host === "127.0.0.1";
  return new pg.Pool({
    connectionString,
    // Host gerenciado exige TLS; o certificado e da CA do provedor, que nao
    // esta no bundle do Node, por isso nao validamos a cadeia.
    ssl: local ? false : { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
  });
}

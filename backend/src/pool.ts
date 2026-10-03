import { criarPool } from "./db.js";
import { env } from "./env.js";

export const pool = criarPool(env.DATABASE_URL);

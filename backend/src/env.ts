import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("30d"),
});

export const env = schema.parse(process.env);

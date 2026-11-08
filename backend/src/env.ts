import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET precisa de pelo menos 32 caracteres"),
  JWT_EXPIRES_IN: z.string().default("30d"),
  // Web Push (lembrete do dia 5). Sem as chaves o app funciona, so sem notificacao.
  // Gerar com: npx web-push generate-vapid-keys
  VAPID_PUBLIC_KEY: z.string().min(1).optional(),
  VAPID_PRIVATE_KEY: z.string().min(1).optional(),
  VAPID_SUBJECT: z.string().default("mailto:admin@mycosts.app"),
});

export const env = schema.parse(process.env);

import express from "express";
import cors from "cors";
import { env } from "./env.js";
import { authRouter } from "./auth/routes.js";
import { cadastroRouter } from "./cadastro/routes.js";
import { mesRouter } from "./mes/routes.js";
import { HttpError, tratarErro } from "./http.js";

export const app = express();

// Render fica atras de proxy: sem isso o rate limit veria um IP so.
app.set("trust proxy", 1);
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json({ limit: "20kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

app.use("/auth", authRouter);
app.use("/mes", mesRouter);
app.use(cadastroRouter);

app.use((_req, _res) => {
  throw new HttpError(404, "Rota nao encontrada.");
});
app.use(tratarErro);

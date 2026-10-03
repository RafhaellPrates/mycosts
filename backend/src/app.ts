import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import express, { Router } from "express";
import { authRouter } from "./auth/routes.js";
import { cadastroRouter } from "./cadastro/routes.js";
import { mesRouter } from "./mes/routes.js";
import { HttpError, tratarErro } from "./http.js";

// Build do front (npm run build em frontend/). Funciona tanto de src (tsx)
// quanto de dist (node): os dois ficam dois niveis abaixo da raiz do repo.
const FRONT_DIST = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));

export const app = express();

// Render fica atras de proxy: sem isso o rate limit veria um IP so.
app.set("trust proxy", 1);
app.use(express.json({ limit: "20kb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

// Front e API no mesmo servico e na mesma origem: sem CORS. Em dev o Vite
// repassa /api para ca (frontend/vite.config.ts).
const api = Router();
api.use("/auth", authRouter);
api.use("/mes", mesRouter);
api.use(cadastroRouter);
api.use((_req, _res) => {
  throw new HttpError(404, "Rota nao encontrada.");
});
app.use("/api", api);

// Em dev o front roda no Vite e a pasta nao existe; ai o back so serve a API.
if (existsSync(FRONT_DIST)) {
  app.use(express.static(FRONT_DIST));
  // O front nao tem rotas proprias, mas um F5 em qualquer caminho cai no app.
  app.get("/{*caminho}", (_req, res) => {
    res.sendFile("index.html", { root: FRONT_DIST });
  });
}

app.use(tratarErro);

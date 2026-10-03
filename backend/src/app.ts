import express from "express";
import cors from "cors";
import { env } from "./env.js";

export const app = express();

app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: Math.round(process.uptime()) });
});

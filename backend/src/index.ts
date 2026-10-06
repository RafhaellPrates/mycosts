import { app } from "./app.js";
import { apagarVisitantesVencidos } from "./auth/visitante.js";
import { env } from "./env.js";

app.listen(env.PORT, () => {
  console.log(`mycosts backend ouvindo em http://localhost:${env.PORT}`);
});

// O cron do /health mantem o processo acordado, entao a limpeza roda mesmo sem visitante novo.
setInterval(() => {
  apagarVisitantesVencidos().catch((e) => console.error("limpeza de visitantes:", e));
}, 60 * 60 * 1000).unref();

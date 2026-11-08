import { app } from "./app.js";
import { apagarVisitantesVencidos } from "./auth/visitante.js";
import { env } from "./env.js";
import { lembreteDoMes } from "./notificacoes/push.js";

app.listen(env.PORT, () => {
  console.log(`mycosts backend ouvindo em http://localhost:${env.PORT}`);
});

// O cron do /health mantem o processo acordado, entao a limpeza roda mesmo sem visitante novo.
setInterval(() => {
  apagarVisitantesVencidos().catch((e) => console.error("limpeza de visitantes:", e));
}, 60 * 60 * 1000).unref();

// Lembrete do dia 5 (Web Push). A propria funcao confere dia, hora e quem ja recebeu.
function lembrete() {
  lembreteDoMes()
    .then((n) => {
      if (n) console.log(`lembrete do mes enviado para ${n} aparelho(s)`);
    })
    .catch((e) => console.error("lembrete do mes:", e));
}
lembrete();
setInterval(lembrete, 15 * 60 * 1000).unref();

import { app } from "./app.js";
import { apagarVisitantesVencidos } from "./auth/visitante.js";
import { env } from "./env.js";
import { avisosAutomaticos } from "./notificacoes/push.js";

app.listen(env.PORT, () => {
  console.log(`mycosts backend ouvindo em http://localhost:${env.PORT}`);
});

// O cron do /health mantem o processo acordado, entao a limpeza roda mesmo sem visitante novo.
setInterval(() => {
  apagarVisitantesVencidos().catch((e) => console.error("limpeza de visitantes:", e));
}, 60 * 60 * 1000).unref();

// Avisos por Web Push (salario, dia 5, versao nova). A propria funcao confere hora, dia e quem ja recebeu.
function lembrete() {
  avisosAutomaticos()
    .then((n) => {
      if (n) console.log(`avisos enviados para ${n} aparelho(s)`);
    })
    .catch((e) => console.error("avisos automaticos:", e));
}
lembrete();
setInterval(lembrete, 15 * 60 * 1000).unref();

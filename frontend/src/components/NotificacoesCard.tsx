import { BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/index.ts";
import { type EstadoPush, desligarPush, estadoPush, ligarPush } from "../lib/push.ts";
import { notificar } from "../lib/notificar.ts";

const TEXTO: Record<EstadoPush, string> = {
  "sem-suporte": "Este navegador não recebe notificações. No iPhone, use o Safari e adicione o app à Tela de Início.",
  instalar:
    "No iPhone, as notificações só funcionam com o app na Tela de Início: toque em Compartilhar e depois em Adicionar à Tela de Início. Abra o MyCosts por lá e volte aqui.",
  "servidor-desligado": "As notificações ainda não foram configuradas no servidor.",
  bloqueado: "As notificações estão bloqueadas para o MyCosts. Libere nos Ajustes do aparelho (Notificações) e volte aqui.",
  desligado: "Ative para receber um lembrete todo dia 5 de organizar as finanças do mês.",
  ligado: "Ligadas neste aparelho. Todo dia 5, às 9h, chega o lembrete para organizar as finanças.",
};

/** Liga ou desliga o lembrete do dia 5 neste aparelho. */
export function NotificacoesCard() {
  const [estado, setEstado] = useState<EstadoPush | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    estadoPush()
      .then(setEstado)
      .catch(() => setEstado("sem-suporte"));
  }, []);

  async function executar(acao: () => Promise<EstadoPush>, sucesso?: string) {
    setOcupado(true);
    try {
      const novo = await acao();
      setEstado(novo);
      if (sucesso && (novo === "ligado" || novo === "desligado")) notificar.sucesso(sucesso);
    } catch (e) {
      notificar.falha(e, "Não foi possível mudar as notificações.");
    } finally {
      setOcupado(false);
    }
  }

  async function testar() {
    setOcupado(true);
    try {
      await api.testarPush();
      notificar.sucesso("Notificação de teste enviada.");
    } catch (e) {
      notificar.falha(e, "Não foi possível enviar o teste.");
    } finally {
      setOcupado(false);
    }
  }

  if (!estado) return <div className="state">Verificando notificações…</div>;
  const ligado = estado === "ligado";

  return (
    <section className="card">
      <div className="aviso-linha">
        {ligado ? <BellRing className="aviso-ico pos" aria-hidden="true" /> : <BellOff className="aviso-ico" aria-hidden="true" />}
        <div>
          <h2 className="item-titulo">Lembrete do dia 5</h2>
          <p className="row-sub">{TEXTO[estado]}</p>
        </div>
      </div>
      <div className="pilha">
        {estado === "desligado" && (
          <button type="button" className="btn" disabled={ocupado} onClick={() => void executar(ligarPush, "Notificações ligadas.")}>
            {ocupado ? "Aguarde…" : "Ativar notificações"}
          </button>
        )}
        {ligado && (
          <>
            <button type="button" className="btn ghost" disabled={ocupado} onClick={() => void testar()}>
              Enviar notificação de teste
            </button>
            <button type="button" className="btn ghost texto-neg" disabled={ocupado} onClick={() => void executar(desligarPush, "Notificações desligadas.")}>
              Desligar neste aparelho
            </button>
          </>
        )}
      </div>
    </section>
  );
}

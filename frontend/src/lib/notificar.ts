import { Notyf } from "notyf";
import "notyf/notyf.min.css";

/**
 * Notificacoes do app. O resto do codigo chama so `notificar.*`: trocar o
 * Notyf por outra lib fica restrito a este arquivo.
 */

// Criado na primeira notificacao: o Notyf precisa do document pronto.
let notyf: Notyf | null = null;

function instancia(): Notyf {
  notyf ??= new Notyf({
    duration: 3500,
    dismissible: true,
    ripple: false,
    position: { x: "right", y: "top" },
    // Cores do app (index.css); a classe ajusta texto e icone por tema.
    types: [
      { type: "success", background: "var(--brand)", className: "toast toast-ok", icon: false },
      { type: "error", background: "var(--neg)", className: "toast toast-erro", icon: false, duration: 5000 },
    ],
  });
  return notyf;
}

export const notificar = {
  sucesso: (mensagem: string) => void instancia().success(mensagem),
  erro: (mensagem: string) => void instancia().error(mensagem),
  /** Erro de uma chamada da API: usa a mensagem do back quando houver. */
  falha: (e: unknown, padrao: string) => void instancia().error(e instanceof Error ? e.message : padrao),
};

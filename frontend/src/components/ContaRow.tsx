import { AlertTriangle, Clock } from "lucide-react";
import type { Conta } from "../api/types.ts";
import { money } from "../lib/format.ts";
import { prazoDe } from "../lib/vencimento.ts";

interface Props {
  conta: Conta;
  /** Mes aberto: o vencimento e o dia da conta neste mes. */
  ym: string;
  onPress: (conta: Conta) => void;
}

function badgeClass(s: Conta["situacao"]) {
  if (s === "Pago") return "badge pago";
  if (s === "Pendente") return "badge pendente";
  return "badge";
}

export function ContaRow({ conta, ym, onPress }: Props) {
  const pagoDiferente = conta.pago !== null && Math.abs(conta.pago - conta.previsto) >= 0.01;
  // Prazo so importa para o que ainda falta pagar.
  const aPagar = conta.situacao !== "Pago" && conta.situacao !== "Não se aplica";
  const prazo = aPagar ? prazoDe(ym, conta.diaVenc) : null;
  const Icone = prazo?.nivel === "vencida" ? AlertTriangle : Clock;

  return (
    <button type="button" className={`row ${prazo ? `prazo-${prazo.nivel}` : ""}`} onClick={() => onPress(conta)}>
      <div className="row-main">
        <span className="row-name">{conta.nome}</span>
        <span className="row-sub">
          {conta.cartaoId ? "Fatura do cartão" : conta.categoria}
          {!prazo && conta.diaVenc ? ` · vence dia ${conta.diaVenc}` : ""}
        </span>
        {prazo && (
          <span className="prazo">
            <Icone aria-hidden="true" />
            {prazo.texto}
          </span>
        )}
      </div>
      <div className="row-side">
        <span className="row-value">{money(conta.pago ?? conta.previsto)}</span>
        {pagoDiferente && <span className="row-prev">{money(conta.previsto)}</span>}
        <span className={badgeClass(conta.situacao)}>{conta.situacao || "Sem baixa"}</span>
      </div>
    </button>
  );
}

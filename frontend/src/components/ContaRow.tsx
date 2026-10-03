import type { Conta } from "../api/types.ts";
import { money } from "../lib/format.ts";

interface Props {
  conta: Conta;
  onPress: (conta: Conta) => void;
}

function badgeClass(s: Conta["situacao"]) {
  if (s === "Pago") return "badge pago";
  if (s === "Pendente") return "badge pendente";
  return "badge";
}

export function ContaRow({ conta, onPress }: Props) {
  const pagoDiferente = conta.pago !== null && Math.abs(conta.pago - conta.previsto) >= 0.01;
  return (
    <button type="button" className="row" onClick={() => onPress(conta)}>
      <div className="row-main">
        <span className="row-name">{conta.nome}</span>
        <span className="row-sub">
          {conta.categoria}
          {conta.diaVenc ? ` · vence dia ${conta.diaVenc}` : ""}
        </span>
      </div>
      <div className="row-side">
        <span className="row-value">{money(conta.pago ?? conta.previsto)}</span>
        {pagoDiferente && <span className="row-prev">{money(conta.previsto)}</span>}
        <span className={badgeClass(conta.situacao)}>{conta.situacao || "Sem baixa"}</span>
      </div>
    </button>
  );
}

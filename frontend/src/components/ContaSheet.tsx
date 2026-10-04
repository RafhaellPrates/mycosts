import { useState } from "react";
import type { Conta, PatchContaBody, Situacao } from "../api/types.ts";
import { money, parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";
import { notificar } from "../lib/notificar.ts";

interface Props {
  conta: Conta;
  mesLabel: string;
  onClose: () => void;
  onSave: (body: PatchContaBody) => Promise<void>;
}

const OPCOES: { value: Situacao; label: string }[] = [
  { value: "Pago", label: "Pago" },
  { value: "Pendente", label: "Pendente" },
  { value: "Não se aplica", label: "Não se aplica" },
];

/** Dar baixa: valor pre-preenchido com o previsto, situacao padrao Pago. */
export function ContaSheet({ conta, mesLabel, onClose, onSave }: Props) {
  const [valor, setValor] = useState(toInput(conta.pago ?? conta.previsto));
  const [situacao, setSituacao] = useState<Situacao>(conta.situacao === "" ? "Pago" : conta.situacao);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = situacao === "Não se aplica" ? null : parseMoney(valor);
    if (situacao === "Pago" && (n === null || n < 0)) {
      notificar.erro("Informe o valor pago.");
      return;
    }
    if (n !== null && n < 0) {
      notificar.erro("Valor não pode ser negativo.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ pago: n, situacao });
      notificar.sucesso(situacao === "Pago" ? `${conta.nome}: baixa salva.` : `${conta.nome}: ${situacao.toLowerCase()}.`);
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={conta.nome} subtitle={`${conta.categoria} · previsto ${money(conta.previsto)} · ${mesLabel}`} onClose={onClose}>
      <div className="seg" role="radiogroup" aria-label="Situação">
        {OPCOES.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={situacao === o.value} aria-pressed={situacao === o.value} onClick={() => setSituacao(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {situacao !== "Não se aplica" && (
        <MoneyInput id="valor-pago" label="Valor pago" value={valor} onChange={setValor} autoFocus />
      )}
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={saving}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={submit} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

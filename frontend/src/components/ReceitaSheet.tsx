import { useState } from "react";
import type { PatchReceitaBody, Receita } from "../api/types.ts";
import { money, parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";
import { notificar } from "../lib/notificar.ts";

interface Props {
  receita: Receita;
  mesLabel: string;
  onClose: () => void;
  onSave: (body: PatchReceitaBody) => Promise<void>;
}

export function ReceitaSheet({ receita, mesLabel, onClose, onSave }: Props) {
  // Sem valor no mes, comeca pelo previsto do cadastro: um toque confirma.
  const [valor, setValor] = useState(toInput(receita.valor ?? (receita.previsto > 0 ? receita.previsto : null)));
  const [saving, setSaving] = useState(false);

  async function submit(limpar = false) {
    // Nao recebi = 0: vazio faria o previsto automatico voltar.
    const n = limpar ? 0 : parseMoney(valor);
    if (!limpar && (n === null || n < 0)) {
      notificar.erro("Informe um valor válido.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ valor: n });
      notificar.sucesso(limpar ? "Receita marcada como não recebida." : "Receita salva.");
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={receita.fonte} subtitle={`Receita · ${mesLabel}${receita.previsto > 0 ? ` · previsto ${money(receita.previsto)}` : ""}`} onClose={onClose}>
      <MoneyInput id="valor-receita" label="Valor recebido" value={valor} onChange={setValor} autoFocus />
      <div className="sheet-actions">
        {Boolean(receita.valor) && (
          <button type="button" className="btn ghost" onClick={() => submit(true)} disabled={saving}>
            Não recebi
          </button>
        )}
        <button type="button" className="btn" onClick={() => submit()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

import { useState } from "react";
import type { PatchReceitaBody, Receita } from "../api/types.ts";
import { parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";

interface Props {
  receita: Receita;
  mesLabel: string;
  onClose: () => void;
  onSave: (body: PatchReceitaBody) => Promise<void>;
}

export function ReceitaSheet({ receita, mesLabel, onClose, onSave }: Props) {
  const [valor, setValor] = useState(toInput(receita.valor));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(limpar = false) {
    setError(null);
    const n = limpar ? null : parseMoney(valor);
    if (!limpar && (n === null || n < 0)) {
      setError("Informe um valor válido.");
      return;
    }
    setSaving(true);
    try {
      await onSave({ valor: n });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={receita.fonte} subtitle={`Receita · ${mesLabel}`} onClose={onClose}>
      <MoneyInput id="valor-receita" label="Valor recebido" value={valor} onChange={setValor} autoFocus />
      {error && <p className="form-error">{error}</p>}
      <div className="sheet-actions">
        {receita.valor !== null && (
          <button type="button" className="btn ghost" onClick={() => submit(true)} disabled={saving}>
            Limpar
          </button>
        )}
        <button type="button" className="btn" onClick={() => submit()} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

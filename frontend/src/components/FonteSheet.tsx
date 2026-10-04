import { useState } from "react";
import { api } from "../api/index.ts";
import type { Fonte } from "../api/types.ts";
import { parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";
import { notificar } from "../lib/notificar.ts";

interface Props {
  /** null = fonte nova. */
  fonte: Fonte | null;
  onClose: () => void;
  onSalvo: () => Promise<void>;
}

export function FonteSheet({ fonte, onClose, onSalvo }: Props) {
  const [nome, setNome] = useState(fonte?.nome ?? "");
  const [previsto, setPrevisto] = useState(toInput(fonte?.previsto ?? null));
  const [salvando, setSalvando] = useState(false);

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    setSalvando(true);
    try {
      await acao();
      await onSalvo();
      notificar.sucesso(sucesso);
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    const valor = parseMoney(previsto) ?? 0;
    if (!nome.trim()) return notificar.erro("Informe o nome.");
    if (valor < 0) return notificar.erro("Valor não pode ser negativo.");
    const body = { nome: nome.trim(), previsto: valor };
    void executar(
      () => (fonte ? api.editarFonte(fonte.id, body) : api.criarFonte(body)),
      fonte ? "Fonte atualizada." : "Fonte criada.",
    );
  }

  return (
    <Sheet title={fonte ? "Editar fonte" : "Nova fonte de receita"} subtitle="Ex: Salário, Freelance. Entra em todo mês enquanto ativa" onClose={onClose}>
      <div className="field">
        <label htmlFor="fonte-nome">Nome</label>
        <input id="fonte-nome" className="text-input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus />
      </div>
      <MoneyInput id="fonte-previsto" label="Valor previsto por mês" value={previsto} onChange={setPrevisto} />
      <div className="sheet-actions">
        {fonte && (
          <button
            type="button"
            className="btn ghost"
            disabled={salvando}
            onClick={() =>
              void executar(() => api.editarFonte(fonte.id, { ativa: !fonte.ativa }), fonte.ativa ? "Fonte desativada." : "Fonte reativada.")
            }
          >
            {fonte.ativa ? "Desativar" : "Reativar"}
          </button>
        )}
        <button type="button" className="btn" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

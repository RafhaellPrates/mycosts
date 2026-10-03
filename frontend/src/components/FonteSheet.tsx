import { useState } from "react";
import { api } from "../api/index.ts";
import type { Fonte } from "../api/types.ts";
import { Sheet } from "./Sheet.tsx";

interface Props {
  /** null = fonte nova. */
  fonte: Fonte | null;
  onClose: () => void;
  onSalvo: () => Promise<void>;
}

export function FonteSheet({ fonte, onClose, onSalvo }: Props) {
  const [nome, setNome] = useState(fonte?.nome ?? "");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function executar(acao: () => Promise<unknown>) {
    setErro(null);
    setSalvando(true);
    try {
      await acao();
      await onSalvo();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    if (!nome.trim()) return setErro("Informe o nome.");
    void executar(() => (fonte ? api.editarFonte(fonte.id, { nome: nome.trim() }) : api.criarFonte(nome.trim())));
  }

  return (
    <Sheet title={fonte ? "Editar fonte" : "Nova fonte de receita"} subtitle="Ex: Salário, Freelance" onClose={onClose}>
      <div className="field">
        <label htmlFor="fonte-nome">Nome</label>
        <input id="fonte-nome" className="text-input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} autoFocus />
      </div>
      {erro && <p className="form-error">{erro}</p>}
      <div className="sheet-actions">
        {fonte && (
          <button
            type="button"
            className="btn ghost"
            disabled={salvando}
            onClick={() => void executar(() => api.editarFonte(fonte.id, { ativa: !fonte.ativa }))}
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

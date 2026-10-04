import { useState } from "react";
import { api } from "../api/index.ts";
import type { ContaCadastro } from "../api/types.ts";
import { parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";
import { notificar } from "../lib/notificar.ts";

interface Props {
  /** null = conta nova. */
  conta: ContaCadastro | null;
  categorias: string[];
  onClose: () => void;
  onSalvo: () => Promise<void>;
}

export function ContaCadastroSheet({ conta, categorias, onClose, onSalvo }: Props) {
  const [nome, setNome] = useState(conta?.nome ?? "");
  const [categoria, setCategoria] = useState(conta?.categoria ?? categorias[0] ?? "Outros");
  const [dia, setDia] = useState(conta?.diaVenc ? String(conta.diaVenc) : "");
  const [previsto, setPrevisto] = useState(toInput(conta?.previsto ?? null));
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
    const diaVenc = dia.trim() ? Number(dia) : null;
    if (!nome.trim()) return notificar.erro("Informe o nome.");
    if (valor < 0) return notificar.erro("Valor não pode ser negativo.");
    if (diaVenc !== null && (!Number.isInteger(diaVenc) || diaVenc < 1 || diaVenc > 31)) {
      return notificar.erro("Dia do vencimento deve ser de 1 a 31.");
    }
    const body = { nome: nome.trim(), categoria, diaVenc, previsto: valor };
    void executar(() => (conta ? api.editarConta(conta.id, body) : api.criarConta(body)), conta ? "Conta atualizada." : "Conta criada.");
  }

  return (
    <Sheet title={conta ? "Editar conta" : "Nova conta"} subtitle="Conta fixa, entra em todo mês enquanto ativa" onClose={onClose}>
      <div className="field">
        <label htmlFor="conta-nome">Nome</label>
        <input id="conta-nome" className="text-input" value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="conta-cat">Categoria</label>
          <select id="conta-cat" className="text-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="conta-dia">Dia do vencimento</label>
          <input
            id="conta-dia"
            className="text-input"
            inputMode="numeric"
            placeholder="—"
            value={dia}
            onChange={(e) => setDia(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </div>
      </div>
      <MoneyInput id="conta-previsto" label="Valor previsto por mês" value={previsto} onChange={setPrevisto} />
      <div className="sheet-actions">
        {conta && (
          <button
            type="button"
            className="btn ghost"
            disabled={salvando}
            onClick={() =>
              void executar(() => api.editarConta(conta.id, { ativa: !conta.ativa }), conta.ativa ? "Conta desativada." : "Conta reativada.")
            }
          >
            {conta.ativa ? "Desativar" : "Reativar"}
          </button>
        )}
        <button type="button" className="btn" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

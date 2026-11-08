import { useState } from "react";
import { api } from "../api/index.ts";
import type { Assinatura, Cartao } from "../api/types.ts";
import { dayMonth, parseMoney, toInput } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";

interface Props {
  /** null = assinatura nova. */
  assinatura: Assinatura | null;
  /** Cartao em que ela esta (ou vai entrar). */
  cartaoId: string;
  cartoes: Cartao[];
  onClose: () => void;
  onSalvo: () => Promise<void>;
}

function hoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Assinatura no cartao: cobra o valor todo mes, no dia da primeira cobranca,
 * ate ser cancelada. Cancelar tira da fatura as cobrancas de hoje em diante;
 * apagar tira de todas, inclusive das que ja passaram.
 */
export function AssinaturaSheet({ assinatura, cartaoId, cartoes, onClose, onSalvo }: Props) {
  const [nome, setNome] = useState(assinatura?.nome ?? "");
  const [valor, setValor] = useState(toInput(assinatura?.valor ?? null));
  const [cartao, setCartao] = useState(cartaoId);
  const [inicio, setInicio] = useState(assinatura?.inicio ?? hoje());
  const [salvando, setSalvando] = useState(false);
  const dia = Number(inicio.slice(8, 10));

  async function executar(acao: () => Promise<unknown>, sucesso: string) {
    setSalvando(true);
    try {
      await acao();
      notificar.sucesso(sucesso);
      await onSalvo();
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    const n = parseMoney(valor);
    if (!nome.trim()) return notificar.erro("Informe o nome.");
    if (n === null || n <= 0) return notificar.erro("Informe o valor por mês.");
    if (!inicio) return notificar.erro("Informe a data da primeira cobrança.");
    const body = { nome: nome.trim(), valor: n, inicio };
    void executar(
      () =>
        assinatura
          ? api.editarAssinatura(assinatura.id, { ...body, ...(cartao !== cartaoId ? { cartaoId: cartao } : {}) })
          : api.criarAssinatura(cartao, body),
      assinatura ? "Assinatura atualizada." : "Assinatura adicionada.",
    );
  }

  function cancelar() {
    if (!assinatura) return;
    if (!confirm(`Cancelar ${assinatura.nome}? A partir de hoje ela não entra mais na fatura.`)) return;
    void executar(() => api.cancelarAssinatura(assinatura.id, hoje()), "Assinatura cancelada.");
  }

  function reativar() {
    if (!assinatura) return;
    void executar(() => api.cancelarAssinatura(assinatura.id, null), "Assinatura reativada.");
  }

  function apagar() {
    if (!assinatura) return;
    if (!confirm(`Apagar ${assinatura.nome}? Ela some também das faturas que já passaram. Para parar de cobrar, use Cancelar.`)) return;
    void executar(() => api.apagarAssinatura(assinatura.id), "Assinatura apagada.");
  }

  const cancelada = assinatura?.canceladaEm ?? null;

  return (
    <Sheet
      title={assinatura ? "Editar assinatura" : "Nova assinatura"}
      subtitle={dia ? `Cobra todo dia ${dia} na fatura do cartão até você cancelar` : "Cobra todo mês na fatura do cartão"}
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="ass-nome">Nome</label>
        <input
          id="ass-nome"
          className="text-input"
          maxLength={60}
          placeholder="Netflix, Spotify, iCloud…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          autoFocus={!assinatura}
        />
      </div>
      <MoneyInput id="ass-valor" label="Valor por mês" value={valor} onChange={setValor} />
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ass-cartao">Cartão</label>
          <select id="ass-cartao" className="text-input" value={cartao} onChange={(e) => setCartao(e.target.value)}>
            {cartoes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ass-inicio">Primeira cobrança</label>
          <input id="ass-inicio" className="text-input" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </div>
      </div>
      {cancelada && <p className="sheet-aviso">Cancelada em {dayMonth(cancelada)}: não cobra mais a partir desse dia.</p>}
      {assinatura && (
        <p className="sheet-info">Mudar o valor muda todas as cobranças desta assinatura, inclusive as de faturas passadas.</p>
      )}

      <button type="button" className="btn" onClick={salvar} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      {assinatura && (
        <div className="sheet-actions">
          {cancelada ? (
            <button type="button" className="btn ghost" onClick={reativar} disabled={salvando}>
              Reativar
            </button>
          ) : (
            <button type="button" className="btn ghost texto-neg" onClick={cancelar} disabled={salvando}>
              Cancelar assinatura
            </button>
          )}
          <button type="button" className="btn ghost" onClick={apagar} disabled={salvando}>
            Apagar
          </button>
        </div>
      )}
    </Sheet>
  );
}

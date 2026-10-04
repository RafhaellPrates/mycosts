import { useState } from "react";
import { api } from "../api/index.ts";
import type { Cartao } from "../api/types.ts";
import { parseMoney, toInput } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";

interface Props {
  /** null = cartao novo. */
  cartao: Cartao | null;
  onClose: () => void;
  onSalvo: () => Promise<void>;
}

const soDia = (v: string) => v.replace(/\D/g, "").slice(0, 2);

export function CartaoSheet({ cartao, onClose, onSalvo }: Props) {
  const [nome, setNome] = useState(cartao?.nome ?? "");
  const [fechamento, setFechamento] = useState(cartao ? String(cartao.diaFechamento) : "");
  const [vencimento, setVencimento] = useState(cartao ? String(cartao.diaVencimento) : "");
  // Vazio = dia seguinte ao fechamento (o mais comum).
  const [melhorDia, setMelhorDia] = useState(cartao ? String(cartao.melhorDia) : "");
  const [limite, setLimite] = useState(toInput(cartao?.limite ?? null));
  const [salvando, setSalvando] = useState(false);

  const sugestaoMelhor = fechamento ? String((Number(fechamento) % 31) + 1) : "";

  async function salvar() {
    const dias = [fechamento, vencimento, melhorDia || sugestaoMelhor].map(Number);
    if (!nome.trim()) return notificar.erro("Informe o nome.");
    if (dias.some((d) => !Number.isInteger(d) || d < 1 || d > 31)) return notificar.erro("Dias de 1 a 31.");
    const lim = limite.trim() ? parseMoney(limite) : null;
    if (lim !== null && lim <= 0) return notificar.erro("Limite precisa ser maior que zero.");
    const body = { nome: nome.trim(), diaFechamento: dias[0], diaVencimento: dias[1], melhorDia: dias[2], limite: lim };
    setSalvando(true);
    try {
      await (cartao ? api.editarCartao(cartao.id, body) : api.criarCartao(body));
      notificar.sucesso(cartao ? "Cartão atualizado." : "Cartão cadastrado.");
      await onSalvo();
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet
      title={cartao ? "Editar cartão" : "Novo cartão"}
      subtitle="Compra no dia do fechamento ou depois vai para a fatura seguinte"
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="cartao-nome">Nome</label>
        <input
          id="cartao-nome"
          className="text-input"
          maxLength={40}
          placeholder="Nubank, Inter…"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
      </div>
      <div className="grid-3">
        <div className="field">
          <label htmlFor="cartao-fecha">Fechamento</label>
          <input id="cartao-fecha" className="text-input" inputMode="numeric" placeholder="dia" value={fechamento} onChange={(e) => setFechamento(soDia(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="cartao-vence">Vencimento</label>
          <input id="cartao-vence" className="text-input" inputMode="numeric" placeholder="dia" value={vencimento} onChange={(e) => setVencimento(soDia(e.target.value))} />
        </div>
        <div className="field">
          <label htmlFor="cartao-melhor">Melhor dia</label>
          <input
            id="cartao-melhor"
            className="text-input"
            inputMode="numeric"
            placeholder={sugestaoMelhor || "dia"}
            value={melhorDia}
            onChange={(e) => setMelhorDia(soDia(e.target.value))}
          />
        </div>
      </div>
      <MoneyInput id="cartao-limite" label="Limite (opcional)" value={limite} onChange={setLimite} />
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

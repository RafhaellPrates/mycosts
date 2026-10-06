import { useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { Cartao, Fatura } from "../api/types.ts";
import { dayMonth, money } from "../lib/format.ts";
import { MonthPicker } from "./MonthPicker.tsx";
import { Sheet } from "./Sheet.tsx";

interface Props {
  cartao: Cartao;
  onClose: () => void;
}

/** Fatura do cartao por mes de vencimento. Abre na fatura aberta. */
export function FaturaSheet({ cartao, onClose }: Props) {
  const [ym, setYm] = useState(cartao.venceEm.slice(0, 7));
  const [carregada, setCarregada] = useState<Fatura | null>(null);
  const [falha, setFalha] = useState<{ ym: string; msg: string } | null>(null);
  // Ao trocar o mes, o que esta guardado e do mes anterior e nao aparece.
  const fatura = carregada?.ym === ym ? carregada : null;
  const erro = falha?.ym === ym ? falha.msg : null;

  useEffect(() => {
    let vivo = true;
    api
      .fatura(cartao.id, ym)
      .then((f) => vivo && setCarregada(f))
      .catch((e) => vivo && setFalha({ ym, msg: e instanceof Error ? e.message : "Erro ao carregar a fatura." }));
    return () => {
      vivo = false;
    };
  }, [cartao.id, ym]);

  return (
    <Sheet title={`Fatura ${cartao.nome}`} subtitle="Mês do vencimento" onClose={onClose}>
      <MonthPicker ym={ym} onChange={setYm} />
      {erro && <div className="state error">{erro}</div>}
      {!erro && !fatura && <div className="state">Carregando fatura…</div>}
      {fatura && (
        <>
          <p className="row-sub">
            Fecha {dayMonth(fatura.fechaEm)} · vence {dayMonth(fatura.venceEm)}
          </p>
          <div className="cartao-fatura">
            <span className="stat-label">Total</span>
            <span className="stat-value neg">{money(fatura.total)}</span>
            {fatura.situacao === "Pago" ? (
              <span className="badge pago">Paga {fatura.pago !== null && money(fatura.pago)}</span>
            ) : (
              fatura.total > 0 && <span className="badge pendente">Em aberto</span>
            )}
          </div>
          {fatura.itens.length === 0 ? (
            <div className="state">Nada nesta fatura.</div>
          ) : (
            <div className="list">
              {fatura.itens.map((i) => (
                <div key={`${i.id}-${i.parcela}`} className="row">
                  <div className="row-main">
                    <span className="row-name">{i.descricao}</span>
                    <span className="row-sub">
                      {dayMonth(i.data)}
                      {i.parcelas > 1 && ` · parcela ${i.parcela}/${i.parcelas}`}
                    </span>
                  </div>
                  <div className="row-side">
                    <span className="row-value">{money(i.valor)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

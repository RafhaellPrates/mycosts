import { CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { CartoesResponse } from "../api/types.ts";
import { dayMonth, money } from "../lib/format.ts";

/** Painel: qual cartao usar hoje e quais estao no melhor dia de compra. */
export function CartaoDoDia() {
  const [dados, setDados] = useState<CartoesResponse | null>(null);

  useEffect(() => {
    api
      .cartoes()
      .then(setDados)
      .catch(() => {
        /* sem cartoes o card nao aparece */
      });
  }, []);

  if (!dados || dados.cartoes.length === 0) return null;
  const rec = dados.cartoes.find((c) => c.id === dados.recomendado);
  const melhores = dados.cartoes.filter((c) => c.melhorDiaHoje);

  return (
    <section className="card">
      <h2 className="card-title">Cartão do dia</h2>
      {rec ? (
        <div className="cartao-rec">
          <CreditCard aria-hidden="true" />
          <div>
            <strong>Use o {rec.nome}</strong>
            <span className="row-sub">
              Compra de hoje vence em {rec.diasParaPagar} dias ({dayMonth(rec.venceEm)}) · fatura aberta {money(rec.faturaAtual)}
              {rec.limite ? ` de ${money(rec.limite)}` : ""}
            </span>
          </div>
        </div>
      ) : (
        <p className="row-sub">Todos os cartões estão no limite.</p>
      )}
      {melhores.length > 0 && (
        <p className="cartao-melhor">Hoje é o melhor dia de compra: {melhores.map((c) => c.nome).join(", ")}</p>
      )}
    </section>
  );
}

import { useState } from "react";
import type { Conta, Lancamento, Receita } from "../api/types.ts";
import { ContaRow } from "../components/ContaRow.tsx";
import { ContaSheet } from "../components/ContaSheet.tsx";
import { LancamentoSheet } from "../components/LancamentoSheet.tsx";
import { ReceitaSheet } from "../components/ReceitaSheet.tsx";
import { ResumoCard } from "../components/ResumoCard.tsx";
import type { useMes } from "../hooks/useMes.ts";
import { dayMonth, money, monthLabel } from "../lib/format.ts";

interface Props {
  ym: string;
  mes: ReturnType<typeof useMes>;
}

export function MesPage({ ym, mes }: Props) {
  const [contaAberta, setContaAberta] = useState<Conta | null>(null);
  const [receitaAberta, setReceitaAberta] = useState<Receita | null>(null);
  const [lancAberto, setLancAberto] = useState<Lancamento | "novo" | null>(null);
  const label = monthLabel(ym);

  if (mes.loading && !mes.data) return <div className="state">Carregando {label}…</div>;

  if (mes.error && !mes.data) {
    return (
      <div className="state error">
        <p>{mes.error}</p>
        <button type="button" className="btn ghost" onClick={() => mes.reload()}>
          Tentar de novo
        </button>
      </div>
    );
  }

  const data = mes.data!;
  const pendentes = data.contas.filter((c) => c.situacao !== "Pago" && c.situacao !== "Não se aplica");
  const pagas = data.contas.filter((c) => c.situacao === "Pago");
  const outras = data.contas.filter((c) => c.situacao === "Não se aplica");

  return (
    <>
      <ResumoCard ind={data.indicadores} />

      {data.contas.length === 0 ? (
        <div className="state">Nenhuma conta cadastrada. Use a aba Cadastro.</div>
      ) : (
        <>
          {pendentes.length > 0 && (
            <section className="card">
              <h2 className="card-title">A pagar · {pendentes.length}</h2>
              <div className="list">
                {pendentes.map((c) => (
                  <ContaRow key={c.id} conta={c} onPress={setContaAberta} />
                ))}
              </div>
            </section>
          )}
          {pagas.length > 0 && (
            <section className="card">
              <h2 className="card-title">Pagas · {money(data.indicadores.contasPagas)}</h2>
              <div className="list">
                {pagas.map((c) => (
                  <ContaRow key={c.id} conta={c} onPress={setContaAberta} />
                ))}
              </div>
            </section>
          )}
          {outras.length > 0 && (
            <section className="card">
              <h2 className="card-title">Não se aplica este mês</h2>
              <div className="list">
                {outras.map((c) => (
                  <ContaRow key={c.id} conta={c} onPress={setContaAberta} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Gastos avulsos · {money(data.indicadores.avulsosMes)}</h2>
          <button type="button" className="btn small" onClick={() => setLancAberto("novo")}>
            + Gasto
          </button>
        </div>
        {data.lancamentos.length === 0 ? (
          <div className="state">Nenhum gasto avulso neste mês.</div>
        ) : (
          <div className="list">
            {data.lancamentos.map((l) => (
              <button key={l.id} type="button" className="row" onClick={() => setLancAberto(l)}>
                <div className="row-main">
                  <span className="row-name">{l.descricao}</span>
                  <span className="row-sub">
                    {dayMonth(l.data)} · {l.categoria} · {l.formaPagamento}
                  </span>
                </div>
                <div className="row-side">
                  <span className="row-value neg">{money(l.valor)}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Receitas · {money(data.indicadores.receitasMes)}</h2>
        <div className="list">
          {data.receitas.map((r) => (
            <button key={r.id} type="button" className="row" onClick={() => setReceitaAberta(r)}>
              <div className="row-main">
                <span className="row-name">{r.fonte}</span>
              </div>
              <div className="row-side">
                <span className={`row-value ${r.valor ? "pos" : ""}`}>{money(r.valor)}</span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {contaAberta && (
        <ContaSheet
          conta={contaAberta}
          mesLabel={label}
          onClose={() => setContaAberta(null)}
          onSave={(body) => mes.salvarConta(contaAberta.id, body)}
        />
      )}
      {lancAberto && (
        <LancamentoSheet
          lancamento={lancAberto === "novo" ? null : lancAberto}
          ym={ym}
          onClose={() => setLancAberto(null)}
          onSave={(body) => mes.salvarLancamento(lancAberto === "novo" ? null : lancAberto.id, body)}
          onDelete={() => (lancAberto === "novo" ? Promise.resolve() : mes.apagarLancamento(lancAberto.id))}
        />
      )}
      {!lancAberto && (
        <button type="button" className="fab" aria-label="Novo gasto" onClick={() => setLancAberto("novo")}>
          +
        </button>
      )}
      {receitaAberta && (
        <ReceitaSheet
          receita={receitaAberta}
          mesLabel={label}
          onClose={() => setReceitaAberta(null)}
          onSave={(body) => mes.salvarReceita(receitaAberta.id, body)}
        />
      )}
    </>
  );
}

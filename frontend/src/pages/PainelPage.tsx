import type { useMes } from "../hooks/useMes.ts";
import { money, monthLabel, monthShort, pct } from "../lib/format.ts";

interface Props {
  ym: string;
  mes: ReturnType<typeof useMes>;
}

/** Espelho da aba Painel: indicadores, gastos por categoria e resumo anual. */
export function PainelPage({ ym, mes }: Props) {
  if (mes.loading && !mes.data) return <div className="state">Carregando painel…</div>;
  if (mes.error && !mes.data) return <div className="state error">{mes.error}</div>;

  const { indicadores: ind, categorias, resumoAnual } = mes.data!;
  const comGasto = categorias.filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor);
  const maior = comGasto[0]?.valor ?? 0;

  return (
    <>
      <section className="card">
        <h2 className="card-title">Indicadores · {monthLabel(ym)}</h2>
        <div className="grid-2">
          <Stat label="Receitas do mês" value={money(ind.receitasMes)} cls="pos" />
          <Stat label="Contas previstas" value={money(ind.contasPrevistas)} />
          <Stat label="Contas pagas" value={money(ind.contasPagas)} cls="neg" />
          <Stat label="Em aberto" value={ind.emAberto > 0 ? money(ind.emAberto) : "—"} cls={ind.emAberto > 0 ? "warn" : ""} />
          <Stat
            label="% da renda comprometida"
            value={pct(ind.pctRendaComprometida)}
            cls={(ind.pctRendaComprometida ?? 0) > 0.8 ? "warn" : ""}
          />
          <Stat label="Faturas de cartão" value={money(ind.faturasCartao)} />
          <Stat label="Contas pendentes" value={String(ind.pendentesQtd)} cls={ind.pendentesQtd > 0 ? "warn" : ""} />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Gastos por categoria</h2>
        {comGasto.length === 0 ? (
          <div className="state">Nada pago ainda neste mês.</div>
        ) : (
          <div className="list">
            {comGasto.map((c) => (
              <div key={c.categoria} className="bar-row">
                <span className="bar-name">{c.categoria}</span>
                <span className="bar-val">
                  {money(c.valor)} · {pct(c.pct)}
                </span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${maior > 0 ? (c.valor / maior) * 100 : 0}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Resumo anual · {ym.slice(0, 4)}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receitas</th>
              <th>Pagas</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {resumoAnual.map((r) => (
              <tr key={r.ym} className={r.ym === ym ? "current" : ""}>
                <td>{monthShort(r.ym)}</td>
                <td>{r.receitas ? money(r.receitas) : "—"}</td>
                <td>{r.pagas ? money(r.pagas) : "—"}</td>
                <td className={r.saldo < 0 ? "neg" : r.saldo > 0 ? "pos" : ""}>
                  {r.receitas || r.pagas ? money(r.saldo) : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>{money(ind.receitasAno)}</strong></td>
              <td><strong>{money(ind.pagoAno)}</strong></td>
              <td className={ind.saldoAno < 0 ? "neg" : "pos"}><strong>{money(ind.saldoAno)}</strong></td>
            </tr>
          </tbody>
        </table>
      </section>
    </>
  );
}

function Stat({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value ${cls}`}>{value}</span>
    </div>
  );
}

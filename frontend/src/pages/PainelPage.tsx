import { Download } from "lucide-react";
import { useState } from "react";
import { api } from "../api/index.ts";
import { BarrasAno } from "../components/charts/BarrasAno.tsx";
import { PizzaCategorias } from "../components/charts/PizzaCategorias.tsx";
import { CartaoDoDia } from "../components/CartaoDoDia.tsx";
import type { useMes } from "../hooks/useMes.ts";
import { money, monthLabel, monthShort, pct } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  ym: string;
  mes: ReturnType<typeof useMes>;
}

/** Painel: indicadores do mes, graficos (ano e categorias) e resumo anual. */
export function PainelPage({ ym, mes }: Props) {
  const [baixando, setBaixando] = useState(false);
  const ano = ym.slice(0, 4);

  async function baixarPlanilha() {
    setBaixando(true);
    try {
      await api.baixarPlanilha(ano);
      notificar.sucesso(`Planilha ${ano} baixada.`);
    } catch (e) {
      notificar.falha(e, "Não foi possível baixar a planilha.");
    } finally {
      setBaixando(false);
    }
  }

  if (mes.loading && !mes.data) return <div className="state">Carregando painel…</div>;
  if (mes.error && !mes.data) return <div className="state error">{mes.error}</div>;

  const { indicadores: ind, categorias, resumoAnual } = mes.data!;
  const saldo = ind.receitasMes - ind.gastosMes;

  return (
    <>
      <CartaoDoDia />
      <section className="card">
        <h2 className="card-title">Indicadores · {monthLabel(ym)}</h2>
        <div className="grid-stats">
          <Stat label="Receitas do mês" value={money(ind.receitasMes)} cls="pos" />
          <Stat label="Gastos do mês" value={money(ind.gastosMes)} cls="neg" />
          <Stat label="Saldo do mês" value={money(saldo)} cls={saldo >= 0 ? "pos" : "neg"} />
          <Stat label="Em aberto" value={ind.emAberto > 0 ? money(ind.emAberto) : "—"} cls={ind.emAberto > 0 ? "warn" : ""} />
          <Stat
            label="% da renda comprometida"
            value={pct(ind.pctRendaComprometida)}
            cls={(ind.pctRendaComprometida ?? 0) > 0.8 ? "warn" : ""}
          />
          <Stat label="Faturas pagas" value={money(ind.faturasCartao)} />
        </div>
      </section>

      <div className="painel-graficos">
        <section className="card">
          <h2 className="card-title">Receitas x gastos · {ano}</h2>
          <BarrasAno resumo={resumoAnual} ym={ym} />
        </section>
        <section className="card">
          <h2 className="card-title">Gastos por categoria · {monthLabel(ym)}</h2>
          <PizzaCategorias categorias={categorias} total={ind.gastosMes} />
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">Resumo anual · {ano}</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Mês</th>
              <th>Receitas</th>
              <th>Gastos</th>
              <th>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {resumoAnual.map((r) => (
              <tr key={r.ym} className={r.ym === ym ? "current" : ""}>
                <td>{monthShort(r.ym)}</td>
                <td>{r.receitas ? money(r.receitas) : "—"}</td>
                <td>{r.gastos ? money(r.gastos) : "—"}</td>
                <td className={r.saldo < 0 ? "neg" : r.saldo > 0 ? "pos" : ""}>
                  {r.receitas || r.gastos ? money(r.saldo) : "—"}
                </td>
              </tr>
            ))}
            <tr>
              <td><strong>Total</strong></td>
              <td><strong>{money(ind.receitasAno)}</strong></td>
              <td><strong>{money(ind.gastosAno)}</strong></td>
              <td className={ind.saldoAno < 0 ? "neg" : "pos"}><strong>{money(ind.saldoAno)}</strong></td>
            </tr>
          </tbody>
        </table>
        <button type="button" className="btn ghost painel-baixar" onClick={baixarPlanilha} disabled={baixando}>
          <Download aria-hidden="true" />
          {baixando ? "Gerando planilha…" : `Baixar planilha ${ano} (.xlsx)`}
        </button>
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

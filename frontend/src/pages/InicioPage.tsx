import { ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { api } from "../api/index.ts";
import type { Conta } from "../api/types.ts";
import { BarrasAno } from "../components/charts/BarrasAno.tsx";
import { PizzaCategorias } from "../components/charts/PizzaCategorias.tsx";
import { CartaoDoDia } from "../components/CartaoDoDia.tsx";
import { ContaRow } from "../components/ContaRow.tsx";
import { ContaSheet } from "../components/ContaSheet.tsx";
import type { useMes } from "../hooks/useMes.ts";
import { money, monthLabel, monthShort, pct } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  ym: string;
  mes: ReturnType<typeof useMes>;
  /** Muda quando um gasto e lancado: o cartao do dia recarrega. */
  versao: number;
  onVerMes: () => void;
}

// Quantas contas a pagar aparecem no Inicio; o resto fica na aba Mes.
const PROXIMAS = 4;

/** Inicio: saldo do mes, o que vence primeiro, cartao do dia e graficos. */
export function InicioPage({ ym, mes, versao, onVerMes }: Props) {
  const [contaAberta, setContaAberta] = useState<Conta | null>(null);
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

  if (mes.loading && !mes.data) return <div className="state">Carregando…</div>;
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

  const { indicadores: ind, categorias, resumoAnual, contas } = mes.data!;
  const saldo = ind.receitasMes - ind.gastosMes;
  const aPagar = contas
    .filter((c) => c.situacao !== "Pago" && c.situacao !== "Não se aplica")
    .sort((a, b) => (a.diaVenc ?? 99) - (b.diaVenc ?? 99));

  return (
    <>
      <section className="card hero">
        <span className="hero-label">Saldo de {monthLabel(ym)}</span>
        <span className={`hero-valor ${saldo >= 0 ? "pos" : "neg"}`}>{money(saldo)}</span>
        <div className="hero-linha">
          <div className="stat">
            <span className="stat-label">Receitas</span>
            <span className="stat-value pos">{money(ind.receitasMes)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Gastos</span>
            <span className="stat-value neg">{money(ind.gastosMes)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Em aberto</span>
            <span className={`stat-value ${ind.emAberto > 0 ? "warn" : ""}`}>
              {ind.emAberto > 0 ? money(ind.emAberto) : "—"}
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">{aPagar.length ? `A pagar · ${aPagar.length}` : "A pagar"}</h2>
          <button type="button" className="link-btn" onClick={onVerMes}>
            Ver mês
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
        {aPagar.length === 0 ? (
          <p className="vazio">{contas.length ? "Tudo pago neste mês." : "Nenhuma conta cadastrada. Cadastre em Perfil > Contas e receitas."}</p>
        ) : (
          <div className="list">
            {aPagar.slice(0, PROXIMAS).map((c) => (
              <ContaRow key={c.id} conta={c} ym={ym} onPress={setContaAberta} />
            ))}
            {aPagar.length > PROXIMAS && (
              <button type="button" className="row row-mais" onClick={onVerMes}>
                Mais {aPagar.length - PROXIMAS} {aPagar.length - PROXIMAS === 1 ? "conta" : "contas"} na aba Mês
                <ChevronRight aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </section>

      <CartaoDoDia key={versao} />

      <div className="painel-graficos">
        <section className="card">
          <h2 className="card-title">Receitas x gastos · {ano}</h2>
          <BarrasAno resumo={resumoAnual} ym={ym} />
        </section>
        <section className="card">
          <h2 className="card-title">Gastos por categoria</h2>
          <PizzaCategorias categorias={categorias} total={ind.gastosMes} />
        </section>
      </div>

      <details className="card dobra">
        <summary>
          <span className="card-title">Resumo de {ano}</span>
          <span className={`dobra-valor ${ind.saldoAno < 0 ? "neg" : "pos"}`}>{money(ind.saldoAno)}</span>
          <ChevronRight className="dobra-ico" aria-hidden="true" />
        </summary>
        <p className="row-sub">
          Renda comprometida com contas em {monthLabel(ym)}: {pct(ind.pctRendaComprometida)} · faturas pagas{" "}
          {money(ind.faturasCartao)}
        </p>
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
      </details>

      {contaAberta && (
        <ContaSheet
          conta={contaAberta}
          mesLabel={monthLabel(ym)}
          onClose={() => setContaAberta(null)}
          onSave={(body) => mes.salvarConta(contaAberta.id, body)}
          ym={ym}
          onComprovantes={() => void mes.reload(true)}
        />
      )}
    </>
  );
}

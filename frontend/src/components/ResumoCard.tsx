import type { Indicadores } from "../api/types.ts";
import { money } from "../lib/format.ts";

export function ResumoCard({ ind }: { ind: Indicadores }) {
  const saldo = ind.receitasMes - ind.contasPagas;
  return (
    <section className="card">
      <div className="stat">
        <span className="stat-label">Saldo do mês · receitas menos contas pagas</span>
        <span className={`stat-value big ${saldo >= 0 ? "pos" : "neg"}`}>{money(saldo)}</span>
      </div>
      <div className="grid-2" style={{ marginTop: 12 }}>
        <div className="stat">
          <span className="stat-label">Receitas</span>
          <span className="stat-value pos">{money(ind.receitasMes)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Contas pagas</span>
          <span className="stat-value neg">{money(ind.contasPagas)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Ainda em aberto</span>
          <span className={`stat-value ${ind.emAberto > 0 ? "warn" : ""}`}>
            {ind.emAberto > 0 ? money(ind.emAberto) : "—"}
          </span>
        </div>
        <div className="stat">
          <span className="stat-label">Pendentes</span>
          <span className={`stat-value ${ind.pendentesQtd > 0 ? "warn" : ""}`}>
            {ind.pendentesQtd} {ind.pendentesQtd === 1 ? "conta" : "contas"}
          </span>
        </div>
      </div>
    </section>
  );
}

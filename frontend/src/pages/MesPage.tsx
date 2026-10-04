import { Plus } from "lucide-react";
import { useState } from "react";
import type { Conta, Lancamento, Receita } from "../api/types.ts";
import { AcoesLinha } from "../components/AcoesLinha.tsx";
import { ContaRow } from "../components/ContaRow.tsx";
import { ContaSheet } from "../components/ContaSheet.tsx";
import { LancamentoSheet } from "../components/LancamentoSheet.tsx";
import { ReceitaSheet } from "../components/ReceitaSheet.tsx";
import { ResumoCard } from "../components/ResumoCard.tsx";
import type { useMes } from "../hooks/useMes.ts";
import { dayMonth, money, monthLabel } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  ym: string;
  mes: ReturnType<typeof useMes>;
}

export function MesPage({ ym, mes }: Props) {
  const [contaAberta, setContaAberta] = useState<Conta | null>(null);
  const [receitaAberta, setReceitaAberta] = useState<Receita | null>(null);
  const [lancAberto, setLancAberto] = useState<Lancamento | "novo" | null>(null);
  const label = monthLabel(ym);

  async function apagarGasto(l: Lancamento) {
    const extra = l.parcelas > 1 ? ` Apaga as ${l.parcelas} parcelas (${money(l.valorTotal)}).` : "";
    if (!confirm(`Apagar o gasto "${l.descricao}" de ${money(l.valor)}?${extra}`)) return;
    try {
      await mes.apagarLancamento(l.id);
      notificar.sucesso("Gasto apagado.");
    } catch (e) {
      notificar.falha(e, "Não foi possível apagar.");
    }
  }

  async function limparReceita(r: Receita) {
    if (!confirm(`Limpar a receita "${r.fonte}" de ${label}?`)) return;
    try {
      await mes.salvarReceita(r.id, { valor: null });
      notificar.sucesso("Receita limpa.");
    } catch (e) {
      notificar.falha(e, "Não foi possível limpar.");
    }
  }

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
  // A pagar: a que vence primeiro no topo; sem dia de vencimento vai para o fim.
  const pendentes = data.contas
    .filter((c) => c.situacao !== "Pago" && c.situacao !== "Não se aplica")
    .sort((a, b) => (a.diaVenc ?? 99) - (b.diaVenc ?? 99));
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
                  <ContaRow key={c.id} conta={c} ym={ym} onPress={setContaAberta} />
                ))}
              </div>
            </section>
          )}
          {pagas.length > 0 && (
            <section className="card">
              <h2 className="card-title">Pagas · {money(data.indicadores.contasPagas)}</h2>
              <div className="list">
                {pagas.map((c) => (
                  <ContaRow key={c.id} conta={c} ym={ym} onPress={setContaAberta} />
                ))}
              </div>
            </section>
          )}
          {outras.length > 0 && (
            <section className="card">
              <h2 className="card-title">Não se aplica este mês</h2>
              <div className="list">
                {outras.map((c) => (
                  <ContaRow key={c.id} conta={c} ym={ym} onPress={setContaAberta} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <section className="card">
        <h2 className="card-title">Gastos avulsos · {money(data.indicadores.avulsosMes)}</h2>
        {data.lancamentos.length === 0 ? (
          <div className="state">Nenhum gasto avulso neste mês. Use o botão + para lançar.</div>
        ) : (
          <div className="list">
            {data.lancamentos.map((l) => (
              <div key={l.id} className="row row-com-acoes">
                <div className="row-main">
                  <span className="row-name">{l.descricao}</span>
                  <span className="row-sub">
                    {dayMonth(l.data)} · {l.categoria} · {l.formaPagamento}
                    {l.parcelas > 1 && ` · parcela ${l.parcela}/${l.parcelas}`}
                  </span>
                </div>
                <div className="row-side">
                  <span className="row-value neg">{money(l.valor)}</span>
                  <AcoesLinha
                    nome={l.descricao}
                    onEditar={() => setLancAberto(l)}
                    onApagar={() => apagarGasto(l)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <h2 className="card-title">Receitas · {money(data.indicadores.receitasMes)}</h2>
        <div className="list">
          {data.receitas.map((r) => (
            <div key={r.id} className="row row-com-acoes">
              <div className="row-main">
                <span className="row-name">{r.fonte}</span>
                {r.previsto > 0 && <span className="row-sub">previsto {money(r.previsto)}</span>}
              </div>
              <div className="row-side">
                <span className={`row-value ${r.valor ? "pos" : ""}`}>{money(r.valor)}</span>
                <AcoesLinha
                  nome={r.fonte}
                  onEditar={() => setReceitaAberta(r)}
                  onApagar={r.valor !== null ? () => limparReceita(r) : undefined}
                />
              </div>
            </div>
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
          <Plus aria-hidden="true" />
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

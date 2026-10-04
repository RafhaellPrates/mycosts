import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { Cartao, CartoesResponse } from "../api/types.ts";
import { AcoesLinha } from "../components/AcoesLinha.tsx";
import { CartaoSheet } from "../components/CartaoSheet.tsx";
import { dayMonth, money } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";

/** Cartoes com a fatura aberta: compras e parcelas que caem nela. */
export function CartoesPage() {
  const [dados, setDados] = useState<CartoesResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Cartao | "novo" | null>(null);

  const carregar = useCallback(async () => {
    try {
      setDados(await api.cartoes());
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar os cartões.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function apagar(c: Cartao) {
    if (!confirm(`Apagar o cartão ${c.nome}? As compras continuam como gastos, só sem o cartão.`)) return;
    try {
      await api.apagarCartao(c.id);
      notificar.sucesso("Cartão apagado.");
      await carregar();
    } catch (e) {
      notificar.falha(e, "Não foi possível apagar.");
    }
  }

  if (erro && !dados) return <div className="state error">{erro}</div>;
  if (!dados) return <div className="state">Carregando cartões…</div>;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Cartões · {dados.cartoes.length}</h2>
          <button type="button" className="btn small" onClick={() => setAberto("novo")}>
            <Plus aria-hidden="true" />
            Cartão
          </button>
        </div>
        {dados.cartoes.length === 0 && (
          <div className="state">Nenhum cartão. Cadastre para acompanhar a fatura e saber qual usar.</div>
        )}
      </section>

      {dados.cartoes.map((c) => (
        <section key={c.id} className="card">
          <div className="card-head">
            <div className="cartao-titulo">
              <h2 className="card-title">{c.nome}</h2>
              {c.id === dados.recomendado && <span className="badge admin">Use hoje</span>}
              {c.melhorDiaHoje && <span className="badge pago">Melhor dia</span>}
              {c.estourado && <span className="badge pendente">Limite atingido</span>}
            </div>
            <AcoesLinha nome={c.nome} onEditar={() => setAberto(c)} onApagar={() => void apagar(c)} />
          </div>
          <p className="row-sub">
            Fecha {dayMonth(c.fechaEm)} · vence {dayMonth(c.venceEm)} · melhor dia {c.melhorDia} · compra hoje vence em{" "}
            {c.diasParaPagar} dias
          </p>
          <div className="cartao-fatura">
            <span className="stat-label">Fatura aberta</span>
            <span className="stat-value neg">{money(c.faturaAtual)}</span>
            {c.limite && <span className="row-sub">de {money(c.limite)} de limite</span>}
          </div>
          {c.limite && (
            <div className="limite-track" aria-hidden="true">
              <div className="limite-fill" style={{ width: `${Math.min(100, (c.faturaAtual / c.limite) * 100)}%` }} />
            </div>
          )}
          {c.itens.length === 0 ? (
            <div className="state">Nada nesta fatura ainda.</div>
          ) : (
            <div className="list">
              {c.itens.map((i) => (
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
        </section>
      ))}

      {aberto && <CartaoSheet cartao={aberto === "novo" ? null : aberto} onClose={() => setAberto(null)} onSalvo={carregar} />}
    </>
  );
}

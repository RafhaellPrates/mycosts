import { ChevronRight, Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { Assinatura, Cartao, CartoesResponse } from "../api/types.ts";
import { AcoesLinha } from "../components/AcoesLinha.tsx";
import { AssinaturaSheet } from "../components/AssinaturaSheet.tsx";
import { CartaoSheet } from "../components/CartaoSheet.tsx";
import { FaturaSheet } from "../components/FaturaSheet.tsx";
import { dayMonth, money, monthShort } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  /** Muda quando um gasto e lancado pelo botao +: recarrega as faturas. */
  versao: number;
}

type Aba = "parcelas" | "assinaturas";
type AssinaturaAberta = { cartaoId: string; assinatura: Assinatura | null };

/** Cartoes com a fatura aberta. Dentro de cada um, abas de parcelas e assinaturas. */
export function CartoesPage({ versao }: Props) {
  const [dados, setDados] = useState<CartoesResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Cartao | "novo" | null>(null);
  const [fatura, setFatura] = useState<Cartao | null>(null);
  const [assinatura, setAssinatura] = useState<AssinaturaAberta | null>(null);
  // Aba escolhida em cada cartao (padrao: parcelas).
  const [abas, setAbas] = useState<Record<string, Aba>>({});

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
  }, [carregar, versao]);

  async function apagar(c: Cartao) {
    if (!confirm(`Apagar o cartão ${c.nome}? As compras continuam como gastos, só sem o cartão. As assinaturas dele são apagadas.`)) return;
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
      <div className="secao-topo">
        <p className="row-sub">
          {dados.cartoes.length === 0
            ? "Cadastre um cartão para acompanhar a fatura, as parcelas e as assinaturas."
            : `${dados.cartoes.length} ${dados.cartoes.length === 1 ? "cartão" : "cartões"} · toque na fatura para ver as compras`}
        </p>
        <button type="button" className="btn small" onClick={() => setAberto("novo")}>
          <Plus aria-hidden="true" />
          Cartão
        </button>
      </div>

      {dados.cartoes.map((c) => {
        const aba = abas[c.id] ?? "parcelas";
        const ativas = c.assinaturas.filter((a) => a.ativa);
        return (
          <section key={c.id} className="card">
            <div className="card-head">
              <div className="cartao-titulo">
                <h2 className="cartao-nome">{c.nome}</h2>
                {c.id === dados.recomendado && <span className="badge admin">Use hoje</span>}
                {c.melhorDiaHoje && <span className="badge pago">Melhor dia</span>}
                {c.estourado && <span className="badge pendente">Limite atingido</span>}
              </div>
              <AcoesLinha nome={c.nome} onEditar={() => setAberto(c)} onApagar={() => void apagar(c)} />
            </div>

            <button type="button" className="cartao-abrir" onClick={() => setFatura(c)} aria-label={`Ver fatura do ${c.nome}`}>
              <div className="cartao-fatura">
                <div className="stat">
                  <span className="stat-label">Fatura aberta · vence {dayMonth(c.venceEm)}</span>
                  <span className="stat-value big neg">{money(c.faturaAtual)}</span>
                </div>
                <ChevronRight className="cartao-abrir-ico" aria-hidden="true" />
              </div>
              {c.limite && (
                <>
                  <div className="limite-track" aria-hidden="true">
                    <div className="limite-fill" style={{ width: `${Math.min(100, (c.faturaAtual / c.limite) * 100)}%` }} />
                  </div>
                  <span className="row-sub">
                    {money(Math.max(c.limite - c.faturaAtual, 0))} livres de {money(c.limite)}
                  </span>
                </>
              )}
            </button>
            <p className="row-sub cartao-datas">
              Fecha {dayMonth(c.fechaEm)} · melhor dia {c.melhorDia} · compra hoje paga em {c.diasParaPagar} dias
            </p>

            <div className="abas" role="tablist" aria-label={`Detalhes do ${c.nome}`}>
              <button
                type="button"
                role="tab"
                aria-selected={aba === "parcelas"}
                onClick={() => setAbas((a) => ({ ...a, [c.id]: "parcelas" }))}
              >
                Parcelas{c.parcelamentos.length > 0 && <span className="abas-n">{c.parcelamentos.length}</span>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={aba === "assinaturas"}
                onClick={() => setAbas((a) => ({ ...a, [c.id]: "assinaturas" }))}
              >
                Assinaturas{ativas.length > 0 && <span className="abas-n">{ativas.length}</span>}
              </button>
            </div>

            {aba === "parcelas" &&
              (c.parcelamentos.length === 0 ? (
                <p className="vazio">Nenhuma compra parcelada em andamento.</p>
              ) : (
                <div className="list" role="tabpanel">
                  {c.parcelamentos.map((p) => (
                    <div key={p.id} className="row">
                      <div className="row-main">
                        <span className="row-name">{p.descricao}</span>
                        <span className="row-sub">
                          parcela {p.parcelaAtual}/{p.parcelas} · última em {monthShort(p.terminaEm.slice(0, 7))}
                        </span>
                      </div>
                      <div className="row-side">
                        <span className="row-value">{money(p.valorParcela)}</span>
                        <span className="row-sub">faltam {money(p.restante)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}

            {aba === "assinaturas" && (
              <div role="tabpanel">
                {c.assinaturas.length === 0 ? (
                  <p className="vazio">Nenhuma assinatura. Streaming, música, apps: cadastre aqui e ela entra na fatura todo mês.</p>
                ) : (
                  <div className="list">
                    {c.assinaturas.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        className={`row ${a.ativa ? "" : "inativa"}`}
                        onClick={() => setAssinatura({ cartaoId: c.id, assinatura: a })}
                      >
                        <div className="row-main">
                          <span className="row-name">{a.nome}</span>
                          <span className="row-sub">
                            {a.ativa
                              ? `todo dia ${Number(a.inicio.slice(8, 10))}${a.proxima ? ` · próxima ${dayMonth(a.proxima)}` : ""}`
                              : `cancelada em ${dayMonth(a.canceladaEm!)}`}
                          </span>
                        </div>
                        <div className="row-side">
                          <span className="row-value">{money(a.valor)}</span>
                          <span className="row-sub">{a.ativa ? "por mês" : "cancelada"}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                <div className="assinaturas-pe">
                  {ativas.length > 0 && <span className="row-sub">{money(c.assinaturasMes)} por mês</span>}
                  <button type="button" className="btn small ghost" onClick={() => setAssinatura({ cartaoId: c.id, assinatura: null })}>
                    <Plus aria-hidden="true" />
                    Assinatura
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {fatura && <FaturaSheet cartao={fatura} onClose={() => setFatura(null)} />}
      {aberto && <CartaoSheet cartao={aberto === "novo" ? null : aberto} onClose={() => setAberto(null)} onSalvo={carregar} />}
      {assinatura && (
        <AssinaturaSheet
          assinatura={assinatura.assinatura}
          cartaoId={assinatura.cartaoId}
          cartoes={dados.cartoes}
          onClose={() => setAssinatura(null)}
          onSalvo={carregar}
        />
      )}
    </>
  );
}

import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { ContaCadastro, Fonte } from "../api/types.ts";
import { ContaCadastroSheet } from "../components/ContaCadastroSheet.tsx";
import { FonteSheet } from "../components/FonteSheet.tsx";
import { money } from "../lib/format.ts";

interface Props {
  /** Avisa o App para recarregar o mes depois de mudar o cadastro. */
  onMudou: () => void;
}

type Aberto =
  | { tipo: "conta"; conta: ContaCadastro | null }
  | { tipo: "fonte"; fonte: Fonte | null }
  | null;

/** Substitui a aba Cadastro da planilha: contas fixas e fontes de receita. */
export function CadastroPage({ onMudou }: Props) {
  const [contas, setContas] = useState<ContaCadastro[] | null>(null);
  const [fontes, setFontes] = useState<Fonte[] | null>(null);
  const [categorias, setCategorias] = useState<string[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Aberto>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [c, f, cat] = await Promise.all([api.contas(), api.fontes(), api.categorias()]);
      setContas(c.contas);
      setFontes(f.fontes);
      setCategorias(cat.categorias);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar o cadastro.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function depoisDeSalvar() {
    await carregar();
    onMudou();
  }

  if (erro && !contas) {
    return (
      <div className="state error">
        <p>{erro}</p>
        <button type="button" className="btn ghost" onClick={() => void carregar()}>
          Tentar de novo
        </button>
      </div>
    );
  }
  if (!contas || !fontes) return <div className="state">Carregando cadastro…</div>;

  const previstoMes = contas.filter((c) => c.ativa).reduce((a, c) => a + c.previsto, 0);

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Contas fixas · {money(previstoMes)}/mês</h2>
          <button type="button" className="btn small" onClick={() => setAberto({ tipo: "conta", conta: null })}>
            + Conta
          </button>
        </div>
        {contas.length === 0 ? (
          <div className="state">Nenhuma conta ainda.</div>
        ) : (
          <div className="list">
            {contas.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`row ${c.ativa ? "" : "inativa"}`}
                onClick={() => setAberto({ tipo: "conta", conta: c })}
              >
                <div className="row-main">
                  <span className="row-name">{c.nome}</span>
                  <span className="row-sub">
                    {c.categoria}
                    {c.diaVenc ? ` · vence dia ${c.diaVenc}` : ""}
                  </span>
                </div>
                <div className="row-side">
                  <span className="row-value">{money(c.previsto)}</span>
                  {!c.ativa && <span className="badge">Inativa</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Fontes de receita</h2>
          <button type="button" className="btn small" onClick={() => setAberto({ tipo: "fonte", fonte: null })}>
            + Fonte
          </button>
        </div>
        {fontes.length === 0 ? (
          <div className="state">Nenhuma fonte ainda.</div>
        ) : (
          <div className="list">
            {fontes.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`row ${f.ativa ? "" : "inativa"}`}
                onClick={() => setAberto({ tipo: "fonte", fonte: f })}
              >
                <div className="row-main">
                  <span className="row-name">{f.nome}</span>
                </div>
                {!f.ativa && (
                  <div className="row-side">
                    <span className="badge">Inativa</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>

      {aberto?.tipo === "conta" && (
        <ContaCadastroSheet
          conta={aberto.conta}
          categorias={categorias}
          onClose={() => setAberto(null)}
          onSalvo={depoisDeSalvar}
        />
      )}
      {aberto?.tipo === "fonte" && (
        <FonteSheet fonte={aberto.fonte} onClose={() => setAberto(null)} onSalvo={depoisDeSalvar} />
      )}
    </>
  );
}

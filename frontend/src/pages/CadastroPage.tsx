import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { ContaCadastro, Fonte } from "../api/types.ts";
import { AcoesLinha } from "../components/AcoesLinha.tsx";
import { ContaCadastroSheet } from "../components/ContaCadastroSheet.tsx";
import { FonteSheet } from "../components/FonteSheet.tsx";
import { money } from "../lib/format.ts";
import { notificar } from "../lib/notificar.ts";

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

  async function apagar(tipo: "conta" | "fonte", item: ContaCadastro | Fonte) {
    const historico = tipo === "conta" ? "os pagamentos dela" : "os valores recebidos dela";
    const ok = confirm(
      `Apagar "${item.nome}"? Isso apaga também ${historico} em todos os meses.

Para manter o histórico, use Desativar no formulário.`,
    );
    if (!ok) return;
    try {
      await (tipo === "conta" ? api.apagarConta(item.id) : api.apagarFonte(item.id));
      notificar.sucesso(tipo === "conta" ? "Conta apagada." : "Fonte apagada.");
      await depoisDeSalvar();
    } catch (e) {
      notificar.falha(e, "Não foi possível apagar.");
    }
  }

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
            <Plus aria-hidden="true" />
            Conta
          </button>
        </div>
        {contas.length === 0 ? (
          <div className="state">Nenhuma conta ainda.</div>
        ) : (
          <div className="list">
            {contas.map((c) => (
              <div key={c.id} className={`row row-com-acoes ${c.ativa ? "" : "inativa"}`}>
                <div className="row-main">
                  <span className="row-name">{c.nome}</span>
                  <span className="row-sub">
                    {c.categoria}
                    {c.diaVenc ? ` · vence dia ${c.diaVenc}` : ""}
                  </span>
                </div>
                <div className="row-side">
                  {!c.ativa && <span className="badge">Inativa</span>}
                  <span className="row-value">{money(c.previsto)}</span>
                  <AcoesLinha
                    nome={c.nome}
                    onEditar={() => setAberto({ tipo: "conta", conta: c })}
                    onApagar={() => void apagar("conta", c)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">
            Fontes de receita · {money(fontes.filter((f) => f.ativa).reduce((a, f) => a + f.previsto, 0))}/mês
          </h2>
          <button type="button" className="btn small" onClick={() => setAberto({ tipo: "fonte", fonte: null })}>
            <Plus aria-hidden="true" />
            Fonte
          </button>
        </div>
        {fontes.length === 0 ? (
          <div className="state">Nenhuma fonte ainda.</div>
        ) : (
          <div className="list">
            {fontes.map((f) => (
              <div key={f.id} className={`row row-com-acoes ${f.ativa ? "" : "inativa"}`}>
                <div className="row-main">
                  <span className="row-name">{f.nome}</span>
                </div>
                <div className="row-side">
                  {!f.ativa && <span className="badge">Inativa</span>}
                  <span className="row-value">{money(f.previsto)}</span>
                  <AcoesLinha
                    nome={f.nome}
                    onEditar={() => setAberto({ tipo: "fonte", fonte: f })}
                    onApagar={() => void apagar("fonte", f)}
                  />
                </div>
              </div>
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

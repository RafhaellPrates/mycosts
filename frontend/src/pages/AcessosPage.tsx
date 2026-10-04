import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { Acesso } from "../api/types.ts";
import { AcessoSheet } from "../components/AcessoSheet.tsx";
import { AcoesLinha } from "../components/AcoesLinha.tsx";
import { notificar } from "../lib/notificar.ts";

interface Props {
  /** Admin logado: nao pode apagar o proprio acesso. */
  usuarioId: string;
  /** O admin editou o proprio acesso (nome, email ou nivel): o App recarrega a sessao. */
  onProprioMudou: () => void;
}

/** So admin: cria, edita (inclusive a senha) e apaga acessos. */
export function AcessosPage({ usuarioId, onProprioMudou }: Props) {
  const [acessos, setAcessos] = useState<Acesso[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aberto, setAberto] = useState<Acesso | "novo" | null>(null);

  const carregar = useCallback(async () => {
    try {
      setAcessos((await api.acessos()).usuarios);
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao carregar os acessos.");
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function apagar(a: Acesso) {
    if (!confirm(`Apagar o acesso de ${a.nome}? Apaga também todas as contas, receitas e gastos dessa pessoa.`)) return;
    try {
      await api.apagarAcesso(a.id);
      notificar.sucesso(`Acesso de ${a.nome} apagado.`);
      await carregar();
    } catch (e) {
      notificar.falha(e, "Não foi possível apagar.");
    }
  }

  if (erro && !acessos) return <div className="state error">{erro}</div>;
  if (!acessos) return <div className="state">Carregando acessos…</div>;

  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Acessos · {acessos.length}</h2>
          <button type="button" className="btn small" onClick={() => setAberto("novo")}>
            <Plus aria-hidden="true" />
            Acesso
          </button>
        </div>
        <div className="list">
          {acessos.map((a) => (
            <div key={a.id} className="row row-com-acoes">
              <div className="row-main">
                <span className="row-name">
                  {a.nome}
                  {a.id === usuarioId && <span className="row-sub"> · você</span>}
                </span>
                <span className="row-sub">{a.email}</span>
              </div>
              <div className="row-side">
                {a.papel === "admin" && <span className="badge admin">Admin</span>}
                <AcoesLinha
                  nome={a.nome}
                  onEditar={() => setAberto(a)}
                  onApagar={a.id === usuarioId ? undefined : () => void apagar(a)}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {aberto && (
        <AcessoSheet
          acesso={aberto === "novo" ? null : aberto}
          proprio={aberto !== "novo" && aberto.id === usuarioId}
          onClose={() => setAberto(null)}
          onSalvo={async () => {
            await carregar();
            if (aberto !== "novo" && aberto.id === usuarioId) onProprioMudou();
          }}
        />
      )}
    </>
  );
}

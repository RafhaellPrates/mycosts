import { FileText, Image as ImageIcon, Paperclip, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/index.ts";
import type { AlvoComprovante, Comprovante } from "../api/types.ts";
import { ACEITA, MAX_COMPROVANTES, type Pendente } from "../lib/comprovantes.ts";
import { prepararComprovante, tamanhoTexto } from "../lib/imagem.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  /** null = gasto novo: os arquivos ficam em `pendentes` ate salvar. */
  alvo: AlvoComprovante | null;
  pendentes: Pendente[];
  onPendentes: (p: Pendente[]) => void;
  /** Anexou ou apagou num gasto existente: o mes recarrega a contagem. */
  onMudou: () => void;
}

/** Comprovantes do gasto: anexar (foto ou PDF), ver e apagar. */
export function Comprovantes({ alvo, pendentes, onPendentes, onMudou }: Props) {
  const [lista, setLista] = useState<Comprovante[] | null>(alvo ? null : []);
  // Chave estavel do alvo: o objeto muda a cada render, o texto nao.
  const chave = alvo ? new URLSearchParams(alvo).toString() : null;
  const [enviando, setEnviando] = useState(false);
  const [aberto, setAberto] = useState<Comprovante | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!chave) return;
    api
      .comprovantes(Object.fromEntries(new URLSearchParams(chave)) as AlvoComprovante)
      .then((r) => setLista(r.comprovantes))
      .catch(() => setLista([]));
  }, [chave]);

  const total = (lista?.length ?? 0) + pendentes.length;

  async function escolhidos(arquivos: FileList | null) {
    const novos = Array.from(arquivos ?? []).slice(0, MAX_COMPROVANTES - total);
    if (input.current) input.current.value = "";
    if (!novos.length) return;
    if (!alvo) {
      onPendentes([...pendentes, ...novos.map((arquivo) => ({ chave: crypto.randomUUID(), arquivo }))]);
      return;
    }
    setEnviando(true);
    try {
      for (const arquivo of novos) {
        const { blob, nome } = await prepararComprovante(arquivo);
        const c = await api.anexarComprovante(alvo, blob, nome);
        setLista((l) => [...(l ?? []), c]);
      }
      notificar.sucesso(novos.length > 1 ? "Comprovantes anexados." : "Comprovante anexado.");
      onMudou();
    } catch (e) {
      notificar.falha(e, "Não foi possível anexar.");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(c: Comprovante) {
    if (!confirm(`Apagar o comprovante ${c.nome}?`)) return;
    try {
      await api.apagarComprovante(c.id);
      setLista((l) => (l ?? []).filter((x) => x.id !== c.id));
      notificar.sucesso("Comprovante apagado.");
      onMudou();
    } catch (e) {
      notificar.falha(e, "Não foi possível apagar.");
    }
  }

  return (
    <div className="field">
      <span className="field-label">Comprovantes</span>
      {lista === null ? (
        <p className="sheet-info">Carregando…</p>
      ) : (
        <>
          {(lista.length > 0 || pendentes.length > 0) && (
            <ul className="anexos">
              {lista.map((c) => (
                <li key={c.id}>
                  <button type="button" className="anexo-abrir" onClick={() => setAberto(c)}>
                    {c.tipo === "application/pdf" ? <FileText aria-hidden="true" /> : <ImageIcon aria-hidden="true" />}
                    <span className="anexo-nome">{c.nome}</span>
                    <span className="row-sub">{tamanhoTexto(c.tamanho)}</span>
                  </button>
                  <button type="button" className="acao perigo" aria-label={`Apagar ${c.nome}`} onClick={() => void apagar(c)}>
                    <Trash2 aria-hidden="true" />
                  </button>
                </li>
              ))}
              {pendentes.map((p) => (
                <li key={p.chave}>
                  <span className="anexo-abrir">
                    <Paperclip aria-hidden="true" />
                    <span className="anexo-nome">{p.arquivo.name}</span>
                    <span className="row-sub">ao salvar</span>
                  </span>
                  <button
                    type="button"
                    className="acao perigo"
                    aria-label={`Tirar ${p.arquivo.name}`}
                    onClick={() => onPendentes(pendentes.filter((x) => x.chave !== p.chave))}
                  >
                    <X aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {total < MAX_COMPROVANTES && (
            <button type="button" className="btn ghost btn-icone" onClick={() => input.current?.click()} disabled={enviando}>
              <Paperclip aria-hidden="true" />
              {enviando ? "Enviando…" : "Anexar foto ou PDF"}
            </button>
          )}
        </>
      )}
      <input ref={input} type="file" accept={ACEITA} multiple hidden onChange={(e) => void escolhidos(e.target.files)} />
      {aberto && <Visor comprovante={aberto} onClose={() => setAberto(null)} />}
    </div>
  );
}

/** Mostra a imagem por cima de tudo; PDF ganha botao de abrir e baixar. */
function Visor({ comprovante, onClose }: { comprovante: Comprovante; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let atual: string | null = null;
    api
      .arquivoComprovante(comprovante.id)
      .then((b) => {
        atual = URL.createObjectURL(b);
        setUrl(atual);
      })
      .catch(() => setErro(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    // captura: o Esc fecha o visor antes de chegar no sheet do gasto
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      if (atual) URL.revokeObjectURL(atual);
    };
  }, [comprovante.id, onClose]);

  const pdf = comprovante.tipo === "application/pdf";
  return (
    <div className="visor" role="dialog" aria-modal="true" aria-label={comprovante.nome} onClick={(e) => e.stopPropagation()}>
      <div className="visor-topo">
        <span className="visor-nome">{comprovante.nome}</span>
        <button type="button" className="visor-fechar" aria-label="Fechar" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
      </div>
      <div className="visor-corpo" onClick={onClose}>
        {erro && <p className="state error">Não foi possível abrir o comprovante.</p>}
        {!erro && !url && <p className="state">Carregando…</p>}
        {url && !pdf && <img src={url} alt={comprovante.nome} onClick={(e) => e.stopPropagation()} />}
        {url && pdf && (
          <div className="pilha visor-pdf" onClick={(e) => e.stopPropagation()}>
            <FileText aria-hidden="true" />
            <a className="btn" href={url} target="_blank" rel="noopener">
              Abrir PDF
            </a>
            <a className="btn ghost" href={url} download={comprovante.nome}>
              Baixar
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

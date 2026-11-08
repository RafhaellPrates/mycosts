import { Camera } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../api/index.ts";
import type { Usuario } from "../api/types.ts";
import { fotoQuadrada } from "../lib/imagem.ts";
import { notificar } from "../lib/notificar.ts";
import { Avatar } from "./Avatar.tsx";

interface Props {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
}

/** Escolher arquivo, recortar quadrado, reduzir e enviar. */
function useFoto({ onAtualizado }: Pick<Props, "onAtualizado">) {
  const input = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);

  async function escolhida(arquivo: File | undefined) {
    if (!arquivo) return;
    setEnviando(true);
    try {
      const { usuario } = await api.trocarFoto(await fotoQuadrada(arquivo));
      onAtualizado(usuario);
      notificar.sucesso("Foto atualizada.");
    } catch (e) {
      notificar.falha(e, "Não foi possível trocar a foto.");
    } finally {
      setEnviando(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remover() {
    if (!confirm("Remover a foto de perfil?")) return;
    setEnviando(true);
    try {
      const { usuario } = await api.removerFoto();
      onAtualizado(usuario);
      notificar.sucesso("Foto removida.");
    } catch (e) {
      notificar.falha(e, "Não foi possível remover a foto.");
    } finally {
      setEnviando(false);
    }
  }

  const campo = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      hidden
      onChange={(e) => void escolhida(e.target.files?.[0])}
    />
  );
  return { campo, abrir: () => input.current?.click(), remover, enviando };
}

/** Avatar do topo do Perfil: tocar troca a foto. */
export function BotaoFoto({ usuario, onAtualizado }: Props) {
  const { campo, abrir, enviando } = useFoto({ onAtualizado });
  return (
    <button
      type="button"
      className={`avatar-botao ${enviando ? "enviando" : ""}`}
      onClick={abrir}
      disabled={enviando}
      aria-label={usuario.fotoVersao ? "Trocar foto de perfil" : "Adicionar foto de perfil"}
    >
      <Avatar usuario={usuario} tamanho={60} />
      <span className="avatar-camera" aria-hidden="true">
        <Camera />
      </span>
      {campo}
    </button>
  );
}

/** Card da foto em Dados e senha: trocar ou remover. */
export function FotoCard({ usuario, onAtualizado }: Props) {
  const { campo, abrir, remover, enviando } = useFoto({ onAtualizado });
  return (
    <section className="card foto-card">
      <Avatar usuario={usuario} tamanho={72} />
      <div className="pilha foto-acoes">
        <button type="button" className="btn" onClick={abrir} disabled={enviando}>
          {enviando ? "Enviando…" : usuario.fotoVersao ? "Trocar foto" : "Adicionar foto"}
        </button>
        {usuario.fotoVersao !== null && (
          <button type="button" className="btn ghost texto-neg" onClick={() => void remover()} disabled={enviando}>
            Remover foto
          </button>
        )}
      </div>
      {campo}
    </section>
  );
}

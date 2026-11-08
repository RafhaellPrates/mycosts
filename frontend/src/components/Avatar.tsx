import { useEffect, useState } from "react";
import { api } from "../api/index.ts";
import type { Usuario } from "../api/types.ts";

// Uma URL por versao da foto: o Perfil e a barra lateral nao baixam duas vezes.
const cache = new Map<number, Promise<string>>();

function urlDaFoto(versao: number): Promise<string> {
  let url = cache.get(versao);
  if (!url) {
    url = api.foto().then((b) => URL.createObjectURL(b));
    url.catch(() => cache.delete(versao));
    cache.set(versao, url);
  }
  return url;
}

interface Props {
  usuario: Pick<Usuario, "nome" | "fotoVersao">;
  /** Lado em px. */
  tamanho?: number;
}

/** Foto de perfil ou, sem foto, a inicial do nome. */
export function Avatar({ usuario, tamanho = 52 }: Props) {
  const versao = usuario.fotoVersao;
  const [carregada, setCarregada] = useState<{ versao: number; url: string } | null>(null);

  useEffect(() => {
    if (versao === null) return;
    let vivo = true;
    urlDaFoto(versao)
      .then((url) => vivo && setCarregada({ versao, url }))
      .catch(() => {
        /* sem foto no servidor: fica a inicial */
      });
    return () => {
      vivo = false;
    };
  }, [versao]);

  const url = carregada && carregada.versao === versao ? carregada.url : null;
  const estilo = { width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.42) };
  return url ? (
    <img className="avatar" src={url} alt="" style={estilo} />
  ) : (
    <span className="avatar" aria-hidden="true" style={estilo}>
      {usuario.nome.trim().charAt(0).toUpperCase()}
    </span>
  );
}

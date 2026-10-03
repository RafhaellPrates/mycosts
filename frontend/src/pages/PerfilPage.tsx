import { useState, type FormEvent } from "react";
import { api } from "../api/index.ts";
import type { Usuario } from "../api/types.ts";

interface Props {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
  onSair: () => void;
}

/** Dados da conta: nome, email, troca de senha e sair. */
export function PerfilPage({ usuario, onAtualizado, onSair }: Props) {
  return (
    <>
      <DadosCard usuario={usuario} onAtualizado={onAtualizado} />
      <SenhaCard />
      <section className="card">
        <button type="button" className="btn ghost perfil-sair" onClick={() => confirm(`Sair de ${usuario.email}?`) && onSair()}>
          Sair da conta
        </button>
      </section>
    </>
  );
}

function DadosCard({ usuario, onAtualizado }: Omit<Props, "onSair">) {
  const [nome, setNome] = useState(usuario.nome);
  const [email, setEmail] = useState(usuario.email);
  const [senhaAtual, setSenhaAtual] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const trocaEmail = email.trim().toLowerCase() !== usuario.email;
  const mudou = nome.trim() !== usuario.nome || trocaEmail;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setEnviando(true);
    try {
      const { usuario: novo } = await api.editarPerfil({
        nome: nome.trim(),
        ...(trocaEmail ? { email, senhaAtual } : {}),
      });
      onAtualizado(novo);
      setEmail(novo.email);
      setSenhaAtual("");
      setMsg({ ok: true, texto: "Perfil salvo." });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : "Não foi possível salvar." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Perfil</h2>
      <form className="login-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="perfil-nome">Nome</label>
          <input
            id="perfil-nome"
            className="text-input"
            autoComplete="name"
            maxLength={60}
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="perfil-email">Email</label>
          <input
            id="perfil-email"
            className="text-input"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        {trocaEmail && (
          <div className="field">
            <label htmlFor="perfil-senha-email">Senha atual (para trocar o email)</label>
            <input
              id="perfil-senha-email"
              className="text-input"
              type="password"
              autoComplete="current-password"
              required
              value={senhaAtual}
              onChange={(e) => setSenhaAtual(e.target.value)}
            />
          </div>
        )}
        {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.texto}</p>}
        <button type="submit" className="btn" disabled={enviando || !mudou}>
          {enviando ? "Salvando…" : "Salvar"}
        </button>
      </form>
    </section>
  );
}

function SenhaCard() {
  const [senhaAtual, setSenhaAtual] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (novaSenha.length < 8) return setMsg({ ok: false, texto: "Senha precisa de pelo menos 8 caracteres." });
    if (novaSenha !== confirmacao) return setMsg({ ok: false, texto: "As senhas não conferem." });
    setEnviando(true);
    try {
      await api.editarPerfil({ senhaAtual, novaSenha });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      setMsg({ ok: true, texto: "Senha trocada." });
    } catch (e) {
      setMsg({ ok: false, texto: e instanceof Error ? e.message : "Não foi possível trocar a senha." });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="card">
      <h2 className="card-title">Trocar senha</h2>
      <form className="login-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="senha-atual">Senha atual</label>
          <input
            id="senha-atual"
            className="text-input"
            type="password"
            autoComplete="current-password"
            required
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="senha-nova">Nova senha</label>
          <input
            id="senha-nova"
            className="text-input"
            type="password"
            autoComplete="new-password"
            required
            value={novaSenha}
            onChange={(e) => setNovaSenha(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="senha-confirma">Repita a nova senha</label>
          <input
            id="senha-confirma"
            className="text-input"
            type="password"
            autoComplete="new-password"
            required
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
          />
        </div>
        {msg && <p className={msg.ok ? "form-ok" : "form-error"}>{msg.texto}</p>}
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? "Salvando…" : "Trocar senha"}
        </button>
      </form>
    </section>
  );
}

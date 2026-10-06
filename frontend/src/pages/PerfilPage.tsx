import { useState, type FormEvent } from "react";
import { api } from "../api/index.ts";
import type { Usuario } from "../api/types.ts";
import { AparenciaCard } from "../components/AparenciaCard.tsx";
import { notificar } from "../lib/notificar.ts";

interface Props {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
  onSair: () => void;
}

/** Dados da conta: nome, email, aparencia, troca de senha e sair. */
export function PerfilPage({ usuario, onAtualizado, onSair }: Props) {
  // Visitante so troca a aparencia: o back recusa nome, email e senha.
  const visitante = usuario.papel === "visitante";
  const pergunta = visitante
    ? "Sair do modo visitante? Os dados de exemplo não poderão ser abertos de novo."
    : `Sair de ${usuario.email}?`;
  return (
    <>
      {visitante ? (
        <section className="card">
          <h2 className="card-title">Modo visitante</h2>
          <p className="row-sub">Você está vendo dados de exemplo. Pode lançar, editar e apagar à vontade: esse acesso e os dados dele são apagados em 24h.</p>
        </section>
      ) : (
        <DadosCard usuario={usuario} onAtualizado={onAtualizado} />
      )}
      <AparenciaCard usuario={usuario} onAtualizado={onAtualizado} />
      {!visitante && <SenhaCard />}
      <section className="card">
        <button type="button" className="btn ghost perfil-sair" onClick={() => confirm(pergunta) && onSair()}>
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

  const trocaEmail = email.trim().toLowerCase() !== usuario.email;
  const mudou = nome.trim() !== usuario.nome || trocaEmail;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const { usuario: novo } = await api.editarPerfil({
        nome: nome.trim(),
        ...(trocaEmail ? { email, senhaAtual } : {}),
      });
      onAtualizado(novo);
      setEmail(novo.email);
      setSenhaAtual("");
      notificar.sucesso("Perfil salvo.");
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
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

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (novaSenha.length < 8) return notificar.erro("Senha precisa de pelo menos 8 caracteres.");
    if (novaSenha !== confirmacao) return notificar.erro("As senhas não conferem.");
    setEnviando(true);
    try {
      await api.editarPerfil({ senhaAtual, novaSenha });
      setSenhaAtual("");
      setNovaSenha("");
      setConfirmacao("");
      notificar.sucesso("Senha trocada.");
    } catch (e) {
      notificar.falha(e, "Não foi possível trocar a senha.");
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
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? "Salvando…" : "Trocar senha"}
        </button>
      </form>
    </section>
  );
}

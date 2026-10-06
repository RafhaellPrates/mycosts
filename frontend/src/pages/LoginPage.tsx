import { useState, type FormEvent } from "react";
import { api } from "../api/index.ts";
import type { AuthResponse } from "../api/types.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  onEntrar: (auth: AuthResponse) => void;
}

/**
 * Entrar. Nao tem criar conta: os acessos sao criados no back com
 * npm run criar-usuario. O back cuida de senha (bcrypt) e token (JWT).
 * Visitante ganha um usuario temporario com dados de exemplo.
 */
export function LoginPage({ onEntrar }: Props) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function entrarCom(chamada: () => Promise<AuthResponse>) {
    setEnviando(true);
    try {
      onEntrar(await chamada());
    } catch (e) {
      notificar.falha(e, "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void entrarCom(() => api.login(login.trim(), senha));
  }

  return (
    <main className="login">
      <h1 className="login-title">MyCosts</h1>
      <p className="login-sub">Entre na sua conta</p>

      <form className="card login-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="login">Email ou nome</label>
          <input
            id="login"
            className="text-input"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            value={login}
            onChange={(e) => setLogin(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            className="text-input"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
        </div>
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? "Aguarde…" : "Entrar"}
        </button>
      </form>

      <section className="card login-form">
        <p className="login-sub">Só quer conhecer o app? Entre com dados de exemplo, sem cadastro. Eles são apagados em 24h.</p>
        <button type="button" className="btn ghost" disabled={enviando} onClick={() => void entrarCom(api.visitante)}>
          Entrar como visitante
        </button>
      </section>
    </main>
  );
}

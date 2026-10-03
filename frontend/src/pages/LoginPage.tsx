import { useState, type FormEvent } from "react";
import { api } from "../api/index.ts";
import type { AuthResponse } from "../api/types.ts";

interface Props {
  onEntrar: (auth: AuthResponse) => void;
}

/**
 * Entrar. Nao tem criar conta: os acessos sao criados no back com
 * npm run criar-usuario. O back cuida de senha (bcrypt) e token (JWT).
 */
export function LoginPage({ onEntrar }: Props) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      onEntrar(await api.login(email, senha));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível entrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <main className="login">
      <h1 className="login-title">MyCosts</h1>
      <p className="login-sub">Entre na sua conta</p>

      <form className="card login-form" onSubmit={submit}>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            className="text-input"
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
        {erro && <p className="form-error">{erro}</p>}
        <button type="submit" className="btn" disabled={enviando}>
          {enviando ? "Aguarde…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

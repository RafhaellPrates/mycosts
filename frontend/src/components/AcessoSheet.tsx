import { useState } from "react";
import { api } from "../api/index.ts";
import type { Acesso, Papel } from "../api/types.ts";
import { notificar } from "../lib/notificar.ts";
import { Sheet } from "./Sheet.tsx";

interface Props {
  /** null = acesso novo. */
  acesso: Acesso | null;
  /** O admin editando a si mesmo. */
  proprio: boolean;
  onClose: () => void;
  onSalvo: () => Promise<void>;
}

const PAPEIS: { value: Papel; label: string }[] = [
  { value: "usuario", label: "Usuário" },
  { value: "admin", label: "Admin" },
];

/** Criar ou editar um acesso. Na edicao, senha em branco mantem a atual. */
export function AcessoSheet({ acesso, proprio, onClose, onSalvo }: Props) {
  const [nome, setNome] = useState(acesso?.nome ?? "");
  const [email, setEmail] = useState(acesso?.email ?? "");
  const [senha, setSenha] = useState("");
  const [papel, setPapel] = useState<Papel>(acesso?.papel ?? "usuario");
  const [salvando, setSalvando] = useState(false);

  async function salvar() {
    if (!nome.trim()) return notificar.erro("Informe o nome.");
    if (nome.includes("@")) return notificar.erro("Nome não pode ter @.");
    if (!email.trim()) return notificar.erro("Informe o email.");
    if ((!acesso || senha) && senha.length < 8) return notificar.erro("Senha precisa de pelo menos 8 caracteres.");
    setSalvando(true);
    try {
      if (acesso) {
        await api.editarAcesso(acesso.id, { nome: nome.trim(), email: email.trim(), papel, ...(senha ? { senha } : {}) });
        notificar.sucesso(senha ? `Acesso de ${nome.trim()} salvo, com senha nova.` : `Acesso de ${nome.trim()} salvo.`);
      } else {
        await api.criarAcesso({ nome: nome.trim(), email: email.trim(), senha, papel });
        notificar.sucesso(`Acesso de ${nome.trim()} criado.`);
      }
      await onSalvo();
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Sheet
      title={acesso ? `Editar ${acesso.nome}` : "Novo acesso"}
      subtitle="A pessoa entra com o email ou com o nome"
      onClose={onClose}
    >
      <div className="field">
        <label htmlFor="acesso-nome">Nome</label>
        <input id="acesso-nome" className="text-input" maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus={!acesso} />
      </div>
      <div className="field">
        <label htmlFor="acesso-email">Email</label>
        <input
          id="acesso-email"
          className="text-input"
          type="email"
          autoCapitalize="none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="acesso-senha">{acesso ? "Nova senha (em branco mantém a atual)" : "Senha"}</label>
        <input
          id="acesso-senha"
          className="text-input"
          type="password"
          autoComplete="new-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
        />
      </div>
      <div className="seg" role="radiogroup" aria-label="Nível de acesso">
        {PAPEIS.map((p) => (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={papel === p.value}
            aria-pressed={papel === p.value}
            onClick={() => setPapel(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      {proprio && papel === "usuario" && (
        <p className="sheet-aviso">Você vai perder o acesso à aba Acessos se deixar de ser admin.</p>
      )}
      <div className="sheet-actions">
        <button type="button" className="btn ghost" onClick={onClose} disabled={salvando}>
          Cancelar
        </button>
        <button type="button" className="btn" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

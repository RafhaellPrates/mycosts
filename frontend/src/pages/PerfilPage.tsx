import {
  Bell,
  ChevronLeft,
  ChevronRight,
  KeyRound,
  LogOut,
  Palette,
  SlidersHorizontal,
  Sparkles,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "../api/index.ts";
import type { Usuario } from "../api/types.ts";
import { AparenciaCard } from "../components/AparenciaCard.tsx";
import { BotaoFoto, FotoCard } from "../components/FotoPerfil.tsx";
import { NotificacoesCard } from "../components/NotificacoesCard.tsx";
import { NovidadesLista } from "../components/NovidadesLista.tsx";
import { marcarNovidadesVistas } from "../lib/novidades.ts";
import { notificar } from "../lib/notificar.ts";
import { AcessosPage } from "./AcessosPage.tsx";
import { CadastroPage } from "./CadastroPage.tsx";

interface Props {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
  onSair: () => void;
  /** Cadastro mudou: o App recarrega o mes. */
  onCadastroMudou: () => void;
  /** Admin editou o proprio acesso: o App recarrega a sessao. */
  onProprioAcessoMudou: () => void;
  /** Tem versao nova que este aparelho nao viu. */
  novidade: boolean;
  onNovidadesVistas: () => void;
}

type Sub = "cadastro" | "notificacoes" | "aparencia" | "novidades" | "conta" | "acessos";

interface Item {
  id: Sub;
  label: string;
  detalhe: string;
  Icon: LucideIcon;
}

/**
 * Perfil: menu no estilo Ajustes do iPhone. Cada item abre uma subpagina
 * com botao de voltar. Cadastro e Acessos (admin) moram aqui.
 */
export function PerfilPage(props: Props) {
  const { usuario, onAtualizado, onSair, novidade } = props;
  const [sub, setSub] = useState<Sub | null>(null);
  // Visitante so troca a aparencia e mexe nos dados de exemplo: o back recusa nome, email e senha.
  const visitante = usuario.papel === "visitante";

  const itens: Item[] = [
    { id: "cadastro", label: "Contas e receitas", detalhe: "Contas fixas e fontes de receita", Icon: SlidersHorizontal },
    { id: "notificacoes", label: "Notificações", detalhe: "Lembrete todo dia 5", Icon: Bell },
    { id: "aparencia", label: "Aparência", detalhe: "Tema e cores", Icon: Palette },
    { id: "novidades", label: "O que mudou", detalhe: "Novidades de cada versão", Icon: Sparkles },
    ...(visitante ? [] : [{ id: "conta" as const, label: "Dados e senha", detalhe: "Foto, nome, email e senha", Icon: KeyRound }]),
    ...(usuario.papel === "admin"
      ? [{ id: "acessos" as const, label: "Acessos", detalhe: "Quem entra no app", Icon: UsersRound }]
      : []),
  ];

  function abrir(id: Sub) {
    setSub(id);
    window.scrollTo({ top: 0 });
    if (id === "novidades") {
      marcarNovidadesVistas();
      props.onNovidadesVistas();
    }
  }

  if (sub) {
    const item = itens.find((i) => i.id === sub)!;
    return (
      <>
        <div className="sub-topo">
          <button type="button" className="voltar" onClick={() => setSub(null)}>
            <ChevronLeft aria-hidden="true" />
            Perfil
          </button>
          <h2 className="sub-titulo">{item.label}</h2>
        </div>
        {sub === "cadastro" && <CadastroPage onMudou={props.onCadastroMudou} />}
        {sub === "notificacoes" && <NotificacoesCard />}
        {sub === "aparencia" && <AparenciaCard usuario={usuario} onAtualizado={onAtualizado} />}
        {sub === "novidades" && <NovidadesLista />}
        {sub === "conta" && (
          <>
            <FotoCard usuario={usuario} onAtualizado={onAtualizado} />
            <DadosCard usuario={usuario} onAtualizado={onAtualizado} />
            <SenhaCard />
          </>
        )}
        {sub === "acessos" && <AcessosPage usuarioId={usuario.id} onProprioMudou={props.onProprioAcessoMudou} />}
      </>
    );
  }

  const pergunta = visitante
    ? "Sair do modo visitante? Os dados de exemplo não poderão ser abertos de novo."
    : `Sair de ${usuario.email}?`;

  return (
    <>
      <section className="card perfil-topo">
        <BotaoFoto usuario={usuario} onAtualizado={onAtualizado} />
        <div className="perfil-quem">
          <strong>{usuario.nome}</strong>
          <span className="row-sub">{visitante ? "Modo visitante · dados de exemplo apagados em 24h" : usuario.email}</span>
        </div>
      </section>

      <section className="card menu">
        {itens.map(({ id, label, detalhe, Icon }) => (
          <button key={id} type="button" className="menu-item" onClick={() => abrir(id)}>
            <span className="menu-ico">
              <Icon aria-hidden="true" />
            </span>
            <span className="menu-texto">
              <span className="row-name">{label}</span>
              <span className="row-sub">{detalhe}</span>
            </span>
            {id === "novidades" && novidade && <span className="badge pendente">Novo</span>}
            <ChevronRight className="menu-seta" aria-hidden="true" />
          </button>
        ))}
      </section>

      <button type="button" className="btn ghost perfil-sair btn-icone" onClick={() => confirm(pergunta) && onSair()}>
        <LogOut aria-hidden="true" />
        Sair da conta
      </button>
    </>
  );
}

function DadosCard({ usuario, onAtualizado }: Pick<Props, "usuario" | "onAtualizado">) {
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
      <h2 className="card-title">Dados</h2>
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

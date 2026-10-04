import { ChartPie, CreditCard, Receipt, SlidersHorizontal, UserRound, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api/index.ts";
import { getToken, onSessaoExpirada, setToken } from "./api/client.ts";
import type { AuthResponse, Usuario } from "./api/types.ts";
import { MonthPicker } from "./components/MonthPicker.tsx";
import { useMes } from "./hooks/useMes.ts";
import { aplicarAparencia } from "./lib/aparencia.ts";
import { currentYm } from "./lib/format.ts";
import { AcessosPage } from "./pages/AcessosPage.tsx";
import { CadastroPage } from "./pages/CadastroPage.tsx";
import { CartoesPage } from "./pages/CartoesPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { MesPage } from "./pages/MesPage.tsx";
import { PainelPage } from "./pages/PainelPage.tsx";
import { PerfilPage } from "./pages/PerfilPage.tsx";

type Sessao = { estado: "verificando" } | { estado: "fora" } | { estado: "dentro"; usuario: Usuario };

/** Confere o token salvo antes de mostrar o app. */
export default function App() {
  const [sessao, setSessao] = useState<Sessao>(() => (getToken() ? { estado: "verificando" } : { estado: "fora" }));

  useEffect(() => {
    onSessaoExpirada(() => setSessao({ estado: "fora" }));
    if (!getToken()) return;
    api
      .me()
      .then(({ usuario }) => {
        aplicarAparencia(usuario.preferencias);
        setSessao({ estado: "dentro", usuario });
      })
      .catch(() => {
        // 401 ja limpou o token; sem conexao, deixa entrar de novo.
        setSessao({ estado: "fora" });
      });
  }, []);

  function entrar({ token, usuario }: AuthResponse) {
    setToken(token);
    aplicarAparencia(usuario.preferencias);
    setSessao({ estado: "dentro", usuario });
  }

  function sair() {
    setToken(null);
    setSessao({ estado: "fora" });
  }

  if (sessao.estado === "verificando") return <div className="state">Carregando…</div>;
  if (sessao.estado === "fora") return <LoginPage onEntrar={entrar} />;
  return (
    <AppLogado
      usuario={sessao.usuario}
      onAtualizado={(usuario) => setSessao({ estado: "dentro", usuario })}
      onSair={sair}
    />
  );
}

type Tab = "painel" | "mes" | "cartoes" | "cadastro" | "acessos" | "perfil";

const TABS: { id: Tab; label: string; Icon: LucideIcon; soAdmin?: boolean }[] = [
  { id: "painel", label: "Painel", Icon: ChartPie },
  { id: "mes", label: "Mês", Icon: Receipt },
  { id: "cartoes", label: "Cartões", Icon: CreditCard },
  { id: "cadastro", label: "Cadastro", Icon: SlidersHorizontal },
  { id: "acessos", label: "Acessos", Icon: UsersRound, soAdmin: true },
  { id: "perfil", label: "Perfil", Icon: UserRound },
];

interface AppLogadoProps {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
  onSair: () => void;
}

/**
 * Uma navegacao so: no celular e a barra de abas embaixo, no PC (>= 900px)
 * o CSS transforma em barra lateral a esquerda.
 */
function AppLogado({ usuario, onAtualizado, onSair }: AppLogadoProps) {
  const [ym, setYm] = useState(currentYm);
  // Painel e a aba principal.
  const [tab, setTab] = useState<Tab>("painel");
  const mes = useMes(ym);
  const comMes = tab === "mes" || tab === "painel";
  const tabs = TABS.filter((t) => !t.soAdmin || usuario.papel === "admin");
  const atual = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <div className="shell">
      <nav className="nav" aria-label="Seções">
        <div className="nav-brand">
          <Wallet aria-hidden="true" />
          MyCosts
        </div>
        {tabs.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
            <Icon className="ico" aria-hidden="true" />
            {label}
          </button>
        ))}
        <div className="nav-user">Olá, {usuario.nome}</div>
      </nav>

      <div className="content">
        <header className="app-header">
          <div className="header-brand">
            <div className="app-title">MyCosts</div>
            <div className="app-ola">Olá, {usuario.nome}</div>
          </div>
          <h1 className="page-title">{atual.label}</h1>
          {comMes && <MonthPicker ym={ym} onChange={setYm} />}
        </header>

        <main className="app-main">
          {tab === "mes" && <MesPage ym={ym} mes={mes} />}
          {tab === "painel" && <PainelPage ym={ym} mes={mes} />}
          {tab === "cartoes" && <CartoesPage />}
          {tab === "cadastro" && <CadastroPage onMudou={() => void mes.reload(true)} />}
          {tab === "acessos" && usuario.papel === "admin" && <AcessosPage usuarioId={usuario.id} onProprioMudou={() => void api.me().then((r) => onAtualizado(r.usuario))} />}
          {tab === "perfil" && <PerfilPage usuario={usuario} onAtualizado={onAtualizado} onSair={onSair} />}
        </main>
      </div>
    </div>
  );
}

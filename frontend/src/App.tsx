import { useEffect, useState } from "react";
import { api } from "./api/index.ts";
import { getToken, onSessaoExpirada, setToken } from "./api/client.ts";
import type { AuthResponse, Usuario } from "./api/types.ts";
import { MonthPicker } from "./components/MonthPicker.tsx";
import { useMes } from "./hooks/useMes.ts";
import { currentYm } from "./lib/format.ts";
import { CadastroPage } from "./pages/CadastroPage.tsx";
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
      .then(({ usuario }) => setSessao({ estado: "dentro", usuario }))
      .catch(() => {
        // 401 ja limpou o token; sem conexao, deixa entrar de novo.
        setSessao({ estado: "fora" });
      });
  }, []);

  function entrar({ token, usuario }: AuthResponse) {
    setToken(token);
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

type Tab = "mes" | "painel" | "cadastro" | "perfil";

interface AppLogadoProps {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
  onSair: () => void;
}

function AppLogado({ usuario, onAtualizado, onSair }: AppLogadoProps) {
  const [ym, setYm] = useState(currentYm);
  const [tab, setTab] = useState<Tab>("mes");
  const mes = useMes(ym);
  const comMes = tab === "mes" || tab === "painel";

  return (
    <>
      <header className="app-header">
        <div>
          <div className="app-title">MyCosts</div>
          <div className="app-ola">Olá, {usuario.nome}</div>
        </div>
        {comMes && <MonthPicker ym={ym} onChange={setYm} />}
      </header>

      <main className="app-main">
        {tab === "mes" && <MesPage ym={ym} mes={mes} />}
        {tab === "painel" && <PainelPage ym={ym} mes={mes} />}
        {tab === "cadastro" && <CadastroPage onMudou={() => void mes.reload(true)} />}
        {tab === "perfil" && <PerfilPage usuario={usuario} onAtualizado={onAtualizado} onSair={onSair} />}
      </main>

      <nav className="tabbar" aria-label="Seções">
        <button type="button" aria-current={tab === "mes" ? "page" : undefined} onClick={() => setTab("mes")}>
          <span className="ico" aria-hidden="true">🧾</span>
          Mês
        </button>
        <button type="button" aria-current={tab === "painel" ? "page" : undefined} onClick={() => setTab("painel")}>
          <span className="ico" aria-hidden="true">📊</span>
          Painel
        </button>
        <button type="button" aria-current={tab === "cadastro" ? "page" : undefined} onClick={() => setTab("cadastro")}>
          <span className="ico" aria-hidden="true">⚙️</span>
          Cadastro
        </button>
        <button type="button" aria-current={tab === "perfil" ? "page" : undefined} onClick={() => setTab("perfil")}>
          <span className="ico" aria-hidden="true">👤</span>
          Perfil
        </button>
      </nav>
    </>
  );
}

import { CreditCard, House, Plus, Receipt, UserRound, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "./api/index.ts";
import { getToken, onSessaoExpirada, setToken } from "./api/client.ts";
import type { AuthResponse, Usuario } from "./api/types.ts";
import { Avatar } from "./components/Avatar.tsx";
import { MonthPicker } from "./components/MonthPicker.tsx";
import { useMes } from "./hooks/useMes.ts";
import { aplicarAparencia } from "./lib/aparencia.ts";
import { currentYm } from "./lib/format.ts";
import { LancamentoSheet } from "./components/LancamentoSheet.tsx";
import { temNovidade } from "./lib/novidades.ts";
import { CartoesPage } from "./pages/CartoesPage.tsx";
import { InicioPage } from "./pages/InicioPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { MesPage } from "./pages/MesPage.tsx";
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

type Tab = "inicio" | "mes" | "cartoes" | "perfil";

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: "inicio", label: "Início", Icon: House },
  { id: "mes", label: "Mês", Icon: Receipt },
  { id: "cartoes", label: "Cartões", Icon: CreditCard },
  { id: "perfil", label: "Perfil", Icon: UserRound },
];

interface AppLogadoProps {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
  onSair: () => void;
}

/**
 * Uma navegacao so: no celular e a barra de abas embaixo, no PC (>= 900px)
 * o CSS transforma em barra lateral a esquerda. Cadastro e Acessos ficam
 * dentro do Perfil. O botao + de gasto aparece em todas as abas menos Perfil.
 */
function AppLogado({ usuario, onAtualizado, onSair }: AppLogadoProps) {
  const [ym, setYm] = useState(currentYm);
  const [tab, setTab] = useState<Tab>("inicio");
  const [novoGasto, setNovoGasto] = useState(false);
  // Muda a cada gasto lancado: a aba Cartoes recarrega a fatura.
  const [versao, setVersao] = useState(0);
  const [novidade, setNovidade] = useState(temNovidade);
  const mes = useMes(ym);
  const comMes = tab === "mes" || tab === "inicio";
  const atual = TABS.find((t) => t.id === tab) ?? TABS[0];

  function irPara(t: Tab) {
    setTab(t);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="shell">
      <nav className="nav" aria-label="Seções">
        <div className="nav-brand">
          <Wallet aria-hidden="true" />
          MyCosts
        </div>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => irPara(id)}>
            <span className="nav-ico">
              <Icon className="ico" aria-hidden="true" />
              {id === "perfil" && novidade && <span className="nav-ponto" aria-label="novidade" />}
            </span>
            {label}
          </button>
        ))}
        <div className="nav-user">
          <Avatar usuario={usuario} tamanho={32} />
          <span>{usuario.nome}</span>
        </div>
      </nav>

      <div className="content">
        <header className="app-header">
          <div className="header-brand">
            <div className="app-ola">Olá, {usuario.nome.split(" ")[0]}</div>
            <div className="app-title">{atual.label}</div>
          </div>
          <h1 className="page-title">{atual.label}</h1>
          {comMes && <MonthPicker ym={ym} onChange={setYm} />}
        </header>

        <main className="app-main">
          {tab === "inicio" && <InicioPage ym={ym} mes={mes} versao={versao} onVerMes={() => irPara("mes")} />}
          {tab === "mes" && <MesPage ym={ym} mes={mes} />}
          {tab === "cartoes" && <CartoesPage versao={versao} />}
          {tab === "perfil" && (
            <PerfilPage
              usuario={usuario}
              onAtualizado={onAtualizado}
              onSair={onSair}
              onCadastroMudou={() => void mes.reload(true)}
              onProprioAcessoMudou={() => void api.me().then((r) => onAtualizado(r.usuario))}
              novidade={novidade}
              onNovidadesVistas={() => setNovidade(false)}
            />
          )}
        </main>
      </div>

      {tab !== "perfil" && !novoGasto && (
        <button type="button" className="fab" aria-label="Lançar gasto" onClick={() => setNovoGasto(true)}>
          <Plus aria-hidden="true" />
        </button>
      )}
      {novoGasto && (
        <LancamentoSheet
          lancamento={null}
          ym={ym}
          onClose={() => setNovoGasto(false)}
          onSave={async (body) => {
            const salvo = await mes.salvarLancamento(null, body);
            setVersao((v) => v + 1);
            return salvo;
          }}
          onDelete={() => Promise.resolve()}
          onComprovantes={() => void mes.reload(true)}
        />
      )}
    </div>
  );
}

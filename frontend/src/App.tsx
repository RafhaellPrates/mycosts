import { useState } from "react";
import { USE_MOCK } from "./api/index.ts";
import { MonthPicker } from "./components/MonthPicker.tsx";
import { useMes } from "./hooks/useMes.ts";
import { currentYm } from "./lib/format.ts";
import { MesPage } from "./pages/MesPage.tsx";
import { PainelPage } from "./pages/PainelPage.tsx";

type Tab = "mes" | "painel";

export default function App() {
  const [ym, setYm] = useState(currentYm);
  const [tab, setTab] = useState<Tab>("mes");
  const mes = useMes(ym);

  return (
    <>
      <header className="app-header">
        <span className="app-title">MyCosts{USE_MOCK ? " · exemplo" : ""}</span>
        <MonthPicker ym={ym} onChange={setYm} />
      </header>

      <main className="app-main">
        {tab === "mes" ? <MesPage ym={ym} mes={mes} /> : <PainelPage ym={ym} mes={mes} />}
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
      </nav>
    </>
  );
}

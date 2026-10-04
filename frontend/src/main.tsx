import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { aplicarAparenciaSalva } from "./lib/aparencia.ts";

// Antes do render: o app ja abre com o tema da ultima sessao.
aplicarAparenciaSalva();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

import { NOVIDADES } from "../lib/novidades.ts";

/** "O que mudou": uma secao por versao, a mais nova primeiro. */
export function NovidadesLista() {
  return (
    <>
      {NOVIDADES.map((n, i) => (
        <section key={n.versao} className="card">
          <div className="novidade-topo">
            <span className="row-sub">
              Versão {n.versao} · {n.quando}
            </span>
            {i === 0 && <span className="badge admin">Atual</span>}
          </div>
          <h2 className="item-titulo">{n.titulo}</h2>
          <ul className="novidade-itens">
            {n.itens.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

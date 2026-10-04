import { useState } from "react";
import type { CategoriaGasto } from "../../api/types.ts";
import { money, pct } from "../../lib/format.ts";

interface Props {
  categorias: CategoriaGasto[];
  total: number;
}

const TAM = 180;
const RAIO = TAM / 2;
const FURO = RAIO * 0.62;
// Mais de 6 fatias fica ilegivel: as menores viram "Outras".
const MAX_FATIAS = 5;

interface Fatia {
  nome: string;
  valor: number;
  pct: number;
  cor: string;
}

function ponto(angulo: number, r: number): [number, number] {
  // 0 rad = topo, sentido horario.
  return [RAIO + r * Math.sin(angulo), RAIO - r * Math.cos(angulo)];
}

function arco(ini: number, fim: number): string {
  // Fatia unica: dois arcos, porque um arco de 360 graus nao desenha.
  if (fim - ini >= Math.PI * 2 - 1e-6) {
    return `M${RAIO},${RAIO - RAIO}A${RAIO},${RAIO} 0 1 1 ${RAIO},${RAIO + RAIO}A${RAIO},${RAIO} 0 1 1 ${RAIO},0Z` +
      `M${RAIO},${RAIO - FURO}A${FURO},${FURO} 0 1 0 ${RAIO},${RAIO + FURO}A${FURO},${FURO} 0 1 0 ${RAIO},${RAIO - FURO}Z`;
  }
  const grande = fim - ini > Math.PI ? 1 : 0;
  const [x1, y1] = ponto(ini, RAIO);
  const [x2, y2] = ponto(fim, RAIO);
  const [x3, y3] = ponto(fim, FURO);
  const [x4, y4] = ponto(ini, FURO);
  return `M${x1},${y1}A${RAIO},${RAIO} 0 ${grande} 1 ${x2},${y2}L${x3},${y3}A${FURO},${FURO} 0 ${grande} 0 ${x4},${y4}Z`;
}

function fatias(categorias: CategoriaGasto[], total: number): Fatia[] {
  const comGasto = categorias.filter((c) => c.valor > 0).sort((a, b) => b.valor - a.valor);
  const principais = comGasto.length > MAX_FATIAS + 1 ? comGasto.slice(0, MAX_FATIAS) : comGasto;
  const resto = comGasto.slice(principais.length);
  const lista: Fatia[] = principais.map((c, i) => ({ nome: c.categoria, valor: c.valor, pct: c.pct, cor: `s${i + 1}` }));
  if (resto.length) {
    const valor = resto.reduce((a, c) => a + c.valor, 0);
    lista.push({ nome: `Outras (${resto.length})`, valor, pct: total > 0 ? valor / total : 0, cor: "sx" });
  }
  return lista;
}

/** Gastos do mes por categoria. Passe o mouse ou toque numa fatia ou na legenda. */
export function PizzaCategorias({ categorias, total }: Props) {
  const [ativa, setAtiva] = useState<number | null>(null);
  const lista = fatias(categorias, total);

  if (lista.length === 0) return <div className="state">Nenhum gasto neste mês.</div>;

  // Angulo acumulado: cada fatia comeca onde a anterior terminou.
  const fins = lista.map((_, i) => lista.slice(0, i + 1).reduce((a, f) => a + f.pct, 0) * Math.PI * 2);
  const arcos = lista.map((_, i) => arco(i === 0 ? 0 : fins[i - 1], fins[i]));
  const sel = ativa !== null ? lista[ativa] : null;

  return (
    <div className="pizza">
      <svg width={TAM} height={TAM} viewBox={`0 0 ${TAM} ${TAM}`} role="img" aria-label="Gastos do mês por categoria">
        {arcos.map((d, i) => (
          <path
            key={lista[i].nome}
            d={d}
            fillRule="evenodd"
            className={`fatia ${lista[i].cor} ${ativa !== null && ativa !== i ? "apagada" : ""}`}
            onMouseEnter={() => setAtiva(i)}
            onMouseLeave={() => setAtiva(null)}
            onClick={() => setAtiva(ativa === i ? null : i)}
          />
        ))}
        <text className="pizza-rotulo" x={RAIO} y={RAIO - 10} textAnchor="middle">
          {sel ? sel.nome : "Total"}
        </text>
        <text className="pizza-valor" x={RAIO} y={RAIO + 12} textAnchor="middle">
          {money(sel ? sel.valor : total)}
        </text>
      </svg>
      <ul className="pizza-legenda">
        {lista.map((f, i) => (
          <li
            key={f.nome}
            className={ativa === i ? "ativa" : ""}
            onMouseEnter={() => setAtiva(i)}
            onMouseLeave={() => setAtiva(null)}
            onClick={() => setAtiva(ativa === i ? null : i)}
          >
            <i className={`sw ${f.cor}`} />
            <span className="nome">{f.nome}</span>
            <span className="valor">{money(f.valor)}</span>
            <span className="pct">{pct(f.pct)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

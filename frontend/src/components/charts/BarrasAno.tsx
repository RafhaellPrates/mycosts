import { useState } from "react";
import type { ResumoMensal } from "../../api/types.ts";
import { money, monthShort } from "../../lib/format.ts";
import { useLargura } from "./useLargura.ts";

interface Props {
  resumo: ResumoMensal[];
  /** Mes aberto no app, destacado no grafico. */
  ym: string;
}

const ALTURA = 200;
const MARGEM = { topo: 8, dir: 4, base: 22, esq: 44 };
const BARRA_MAX = 24;
const GAP = 2;
const RAIO = 4;

const compacto = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

/** Passo "redondo" (1, 2 ou 5 x 10^n) para ~4 linhas de grade. */
function escala(max: number): number[] {
  if (max <= 0) return [0];
  const bruto = max / 4;
  const pot = 10 ** Math.floor(Math.log10(bruto));
  const passo = [1, 2, 5, 10].map((m) => m * pot).find((p) => p >= bruto)!;
  const ticks: number[] = [];
  for (let v = 0; v < max + passo; v += passo) ticks.push(v);
  return ticks;
}

/** Coluna com o topo arredondado e a base reta, crescendo da linha zero. */
function coluna(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return "";
  const r = Math.min(RAIO, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/** Receitas x gastos de cada mes do ano. Toque ou passe o mouse para ver os valores. */
export function BarrasAno({ resumo, ym }: Props) {
  const { ref, largura } = useLargura<HTMLDivElement>();
  const [ativo, setAtivo] = useState<number | null>(null);

  const max = Math.max(0, ...resumo.flatMap((r) => [r.receitas, r.gastos]));
  const ticks = escala(max);
  const topo = ticks[ticks.length - 1] || 1;
  const plotW = Math.max(0, largura - MARGEM.esq - MARGEM.dir);
  const plotH = ALTURA - MARGEM.topo - MARGEM.base;
  const banda = plotW / 12;
  const barra = Math.max(2, Math.min(BARRA_MAX, (banda * 0.7 - GAP) / 2));
  const y = (v: number) => MARGEM.topo + plotH - (v / topo) * plotH;
  const sel = ativo !== null ? resumo[ativo] : null;

  return (
    <div className="chart" ref={ref}>
      <div className="chart-legend">
        <span><i className="sw s1" />Receitas</span>
        <span><i className="sw s2" />Gastos</span>
      </div>
      {largura > 0 && (
        <svg width={largura} height={ALTURA} role="img" aria-label="Receitas e gastos por mês">
          {ticks.map((t) => (
            <g key={t}>
              <line className="grid" x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(t)} y2={y(t)} />
              <text className="tick" x={MARGEM.esq - 6} y={y(t)} dy="0.32em" textAnchor="end">
                {compacto.format(t)}
              </text>
            </g>
          ))}
          {resumo.map((r, i) => {
            const x0 = MARGEM.esq + i * banda;
            const meio = x0 + banda / 2;
            const atual = r.ym === ym;
            return (
              <g key={r.ym}>
                {(atual || ativo === i) && (
                  <rect className={ativo === i ? "band hover" : "band"} x={x0} y={MARGEM.topo} width={banda} height={plotH} rx={6} />
                )}
                <path className="s1" d={coluna(meio - GAP / 2 - barra, y(r.receitas), barra, y(0) - y(r.receitas))} />
                <path className="s2" d={coluna(meio + GAP / 2, y(r.gastos), barra, y(0) - y(r.gastos))} />
                <text className={atual ? "tick atual" : "tick"} x={meio} y={ALTURA - 6} textAnchor="middle">
                  {monthShort(r.ym).slice(0, 3)}
                </text>
                {/* Area de toque maior que as barras: a coluna inteira do mes. */}
                <rect
                  className="hit"
                  x={x0}
                  y={MARGEM.topo}
                  width={banda}
                  height={plotH + MARGEM.base}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseLeave={() => setAtivo(null)}
                  onClick={() => setAtivo(ativo === i ? null : i)}
                />
              </g>
            );
          })}
          <line className="axis" x1={MARGEM.esq} x2={largura - MARGEM.dir} y1={y(0)} y2={y(0)} />
        </svg>
      )}
      {sel && ativo !== null && (
        <div
          className="chart-tip"
          style={{ left: Math.min(Math.max(MARGEM.esq + (ativo + 0.5) * banda, 80), largura - 80) }}
        >
          <strong>{monthShort(sel.ym)}</strong>
          <span><i className="sw s1" />Receitas {money(sel.receitas)}</span>
          <span><i className="sw s2" />Gastos {money(sel.gastos)}</span>
          <span>Saldo {money(sel.saldo)}</span>
        </div>
      )}
    </div>
  );
}

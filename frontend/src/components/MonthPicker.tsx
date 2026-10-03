import { monthLabel, shiftYm } from "../lib/format.ts";

interface Props {
  ym: string;
  onChange: (ym: string) => void;
}

/** Planilha e anual: limita a navegacao ao ano corrente do mes escolhido. */
export function MonthPicker({ ym, onChange }: Props) {
  const year = ym.slice(0, 4);
  const prev = shiftYm(ym, -1);
  const next = shiftYm(ym, 1);
  return (
    <div className="month-picker" role="group" aria-label="Mês">
      <button type="button" aria-label="Mês anterior" disabled={!prev.startsWith(year)} onClick={() => onChange(prev)}>
        ‹
      </button>
      <span className="label">{monthLabel(ym).replace(" de ", " ")}</span>
      <button type="button" aria-label="Próximo mês" disabled={!next.startsWith(year)} onClick={() => onChange(next)}>
        ›
      </button>
    </div>
  );
}

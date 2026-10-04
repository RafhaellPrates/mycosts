import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthLabel, shiftYm } from "../lib/format.ts";

interface Props {
  ym: string;
  onChange: (ym: string) => void;
}

/** Navega mes a mes; o resumo anual acompanha o ano do mes escolhido. */
export function MonthPicker({ ym, onChange }: Props) {
  const prev = shiftYm(ym, -1);
  const next = shiftYm(ym, 1);
  return (
    <div className="month-picker" role="group" aria-label="Mês">
      <button type="button" aria-label="Mês anterior" onClick={() => onChange(prev)}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <span className="label">{monthLabel(ym).replace(" de ", " ")}</span>
      <button type="button" aria-label="Próximo mês" onClick={() => onChange(next)}>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  );
}

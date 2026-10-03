interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

/** Campo de dinheiro com teclado numerico no iPhone (inputmode=decimal). */
export function MoneyInput({ id, label, value, onChange, autoFocus }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="money">
        <span>R$</span>
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0,00"
          value={value}
          autoFocus={autoFocus}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.target.select()}
        />
      </div>
    </div>
  );
}

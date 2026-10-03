import { useEffect, useState } from "react";
import { api } from "../api/index.ts";
import { FORMAS_PAGAMENTO, type FormaPagamento, type Lancamento, type LancamentoBody } from "../api/types.ts";
import { currentYm, parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";

interface Props {
  /** null = gasto novo. */
  lancamento: Lancamento | null;
  ym: string;
  onClose: () => void;
  onSave: (body: LancamentoBody) => Promise<void>;
  onDelete: () => Promise<void>;
}

// Fatura e conta fixa; compra no cartao vai pela forma de pagamento.
const SEM_CATEGORIA = "Cartões";

/** Hoje se o mes aberto e o atual; senao o dia 1 do mes aberto. */
function dataPadrao(ym: string): string {
  if (ym !== currentYm()) return `${ym}-01`;
  const d = new Date();
  return `${ym}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Gasto avulso: criar, editar ou apagar. */
export function LancamentoSheet({ lancamento, ym, onClose, onSave, onDelete }: Props) {
  const [valor, setValor] = useState(toInput(lancamento?.valor ?? null));
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "Alimentação");
  const [forma, setForma] = useState<FormaPagamento>(lancamento?.formaPagamento ?? "Crédito");
  const [data, setData] = useState(lancamento?.data ?? dataPadrao(ym));
  const [categorias, setCategorias] = useState<string[]>([categoria]);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api
      .categorias()
      .then((r) => setCategorias(r.categorias.filter((c) => c !== SEM_CATEGORIA)))
      .catch(() => {
        /* fica so com a categoria atual; o back valida de novo */
      });
  }, []);

  async function executar(acao: () => Promise<void>) {
    setErro(null);
    setSalvando(true);
    try {
      await acao();
      onClose();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    const n = parseMoney(valor);
    if (n === null || n <= 0) return setErro("Informe o valor.");
    if (!descricao.trim()) return setErro("Informe a descrição.");
    if (!data) return setErro("Informe a data.");
    void executar(() => onSave({ valor: n, descricao: descricao.trim(), categoria, formaPagamento: forma, data }));
  }

  return (
    <Sheet title={lancamento ? "Editar gasto" : "Novo gasto"} subtitle="Gasto avulso, conta na data da compra" onClose={onClose}>
      <MoneyInput id="lanc-valor" label="Valor" value={valor} onChange={setValor} autoFocus={!lancamento} />
      <div className="field">
        <label htmlFor="lanc-desc">Descrição</label>
        <input
          id="lanc-desc"
          className="text-input"
          placeholder="Padaria, Uber…"
          maxLength={80}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
        />
      </div>
      <div className="seg" role="radiogroup" aria-label="Forma de pagamento">
        {FORMAS_PAGAMENTO.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={forma === f} aria-pressed={forma === f} onClick={() => setForma(f)}>
            {f}
          </button>
        ))}
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="lanc-cat">Categoria</label>
          <select id="lanc-cat" className="text-input" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="lanc-data">Data</label>
          <input id="lanc-data" className="text-input" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      {erro && <p className="form-error">{erro}</p>}
      <div className="sheet-actions">
        {lancamento && (
          <button
            type="button"
            className="btn ghost"
            disabled={salvando}
            onClick={() => confirm(`Apagar "${lancamento.descricao}"?`) && void executar(onDelete)}
          >
            Apagar
          </button>
        )}
        <button type="button" className="btn" onClick={salvar} disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Sheet>
  );
}

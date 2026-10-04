import { useEffect, useState } from "react";
import { api } from "../api/index.ts";
import { FORMAS_PAGAMENTO, type Cartao, type FormaPagamento, type Lancamento, type LancamentoBody } from "../api/types.ts";
import { currentYm, money, parseMoney, toInput } from "../lib/format.ts";
import { MoneyInput } from "./MoneyInput.tsx";
import { Sheet } from "./Sheet.tsx";
import { notificar } from "../lib/notificar.ts";

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
  // Parcelada: edita o total da compra, nao a parcela do mes.
  const [valor, setValor] = useState(toInput(lancamento?.valorTotal ?? null));
  const [descricao, setDescricao] = useState(lancamento?.descricao ?? "");
  const [categoria, setCategoria] = useState(lancamento?.categoria ?? "Alimentação");
  const [forma, setForma] = useState<FormaPagamento>(lancamento?.formaPagamento ?? "Crédito");
  const [data, setData] = useState(lancamento?.data ?? dataPadrao(ym));
  const [cartaoId, setCartaoId] = useState<string | null>(lancamento?.cartaoId ?? null);
  const [parcelas, setParcelas] = useState(String(lancamento?.parcelas ?? 1));
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [categorias, setCategorias] = useState<string[]>([categoria]);
  const [salvando, setSalvando] = useState(false);
  const ehNovo = lancamento === null;

  useEffect(() => {
    api
      .cartoes()
      .then((r) => {
        setCartoes(r.cartoes);
        // Compra nova no credito ja vem com o cartao recomendado do dia.
        if (ehNovo && r.recomendado) setCartaoId((atual) => atual ?? r.recomendado);
      })
      .catch(() => {
        /* sem cartoes: o campo nao aparece */
      });
    api
      .categorias()
      .then((r) => setCategorias(r.categorias.filter((c) => c !== SEM_CATEGORIA)))
      .catch(() => {
        /* fica so com a categoria atual; o back valida de novo */
      });
  }, [ehNovo]);

  async function executar(acao: () => Promise<void>, sucesso: string) {
    setSalvando(true);
    try {
      await acao();
      notificar.sucesso(sucesso);
      onClose();
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  function salvar() {
    const n = parseMoney(valor);
    if (n === null || n <= 0) return notificar.erro("Informe o valor.");
    if (!descricao.trim()) return notificar.erro("Informe a descrição.");
    if (!data) return notificar.erro("Informe a data.");
    const nParcelas = forma === "Crédito" ? Number(parcelas) : 1;
    if (!Number.isInteger(nParcelas) || nParcelas < 1 || nParcelas > 48) return notificar.erro("Parcelas de 1 a 48.");
    void executar(
      () =>
        onSave({
          valor: n,
          descricao: descricao.trim(),
          categoria,
          formaPagamento: forma,
          data,
          cartaoId: forma === "Crédito" ? cartaoId : null,
          parcelas: nParcelas,
        }),
      lancamento ? "Gasto atualizado." : "Gasto lançado.",
    );
  }

  return (
    <Sheet title={lancamento ? "Editar gasto" : "Novo gasto"} subtitle="Gasto avulso, conta na data da compra" onClose={onClose}>
      <MoneyInput
        id="lanc-valor"
        label={forma === "Crédito" && Number(parcelas) > 1 ? "Valor total" : "Valor"}
        value={valor}
        onChange={setValor}
        autoFocus={!lancamento}
      />
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
      {forma === "Crédito" && (
        <div className="grid-2">
          <div className="field">
            <label htmlFor="lanc-cartao">Cartão</label>
            <select
              id="lanc-cartao"
              className="text-input"
              value={cartaoId ?? ""}
              onChange={(e) => setCartaoId(e.target.value || null)}
            >
              <option value="">Sem cartão</option>
              {cartoes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="lanc-parcelas">Parcelas</label>
            <input
              id="lanc-parcelas"
              className="text-input"
              inputMode="numeric"
              value={parcelas}
              onChange={(e) => setParcelas(e.target.value.replace(/D/g, "").slice(0, 2))}
            />
          </div>
        </div>
      )}
      {forma === "Crédito" && Number(parcelas) > 1 && (parseMoney(valor) ?? 0) > 0 && (
        <p className="sheet-info">
          {parcelas}x de {money((parseMoney(valor) ?? 0) / Number(parcelas))}, uma por mês a partir do mês da compra
        </p>
      )}
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
      <div className="sheet-actions">
        {lancamento && (
          <button
            type="button"
            className="btn ghost"
            disabled={salvando}
            onClick={() => confirm(`Apagar "${lancamento.descricao}"?`) && void executar(onDelete, "Gasto apagado.")}
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

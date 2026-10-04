import { Pencil, Trash2 } from "lucide-react";

interface Props {
  /** Nome do item, para o leitor de tela dizer o que vai editar/apagar. */
  nome: string;
  onEditar: () => void;
  /** Sem onApagar, o botao de apagar nao aparece. */
  onApagar?: () => void;
}

/** Botoes pequenos de editar e apagar no fim de uma linha da lista. */
export function AcoesLinha({ nome, onEditar, onApagar }: Props) {
  return (
    <div className="row-acoes">
      <button type="button" className="acao" aria-label={`Editar ${nome}`} title="Editar" onClick={onEditar}>
        <Pencil aria-hidden="true" />
      </button>
      {onApagar && (
        <button type="button" className="acao perigo" aria-label={`Apagar ${nome}`} title="Apagar" onClick={onApagar}>
          <Trash2 aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api/index.ts";
import type { Preferencias, Usuario } from "../api/types.ts";
import { PADRAO, aplicarAparencia, temaEfetivo } from "../lib/aparencia.ts";
import { notificar } from "../lib/notificar.ts";

interface Props {
  usuario: Usuario;
  onAtualizado: (usuario: Usuario) => void;
}

const TEMAS: { value: NonNullable<Preferencias["tema"]>; label: string }[] = [
  { value: "sistema", label: "Sistema" },
  { value: "claro", label: "Claro" },
  { value: "escuro", label: "Escuro" },
];

type Cor = keyof NonNullable<Preferencias["cores"]>;

const CORES: { chave: Cor; label: string }[] = [
  { chave: "destaque", label: "Cor principal" },
  { chave: "receitas", label: "Receitas" },
  { chave: "gastos", label: "Gastos" },
];

/** Atalhos para a cor principal; o seletor ao lado aceita qualquer cor. */
const SUGESTOES = ["#0f766e", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#475569"];

// Espera a pessoa parar de mexer antes de salvar no banco.
const ESPERA_MS = 700;

/** Tema e cores. Muda na hora (previa) e salva sozinho na conta. */
export function AparenciaCard({ usuario, onAtualizado }: Props) {
  const [prefs, setPrefs] = useState<Preferencias>(usuario.preferencias);
  const timer = useRef<number | undefined>(undefined);
  const pendente = useRef<Preferencias | null>(null);

  async function salvar(p: Preferencias) {
    pendente.current = null;
    try {
      const { usuario: novo } = await api.editarPerfil({ preferencias: p });
      onAtualizado(novo);
    } catch (e) {
      notificar.falha(e, "Não foi possível salvar a aparência.");
    }
  }

  // Saiu do Perfil antes do tempo de espera: salva o que ficou pendente.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pendente.current) void api.editarPerfil({ preferencias: pendente.current });
    },
    [],
  );

  function mudar(p: Preferencias) {
    setPrefs(p);
    aplicarAparencia(p);
    pendente.current = p;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void salvar(p), ESPERA_MS);
  }

  function mudarCor(chave: Cor, valor: string) {
    mudar({ ...prefs, cores: { ...prefs.cores, [chave]: valor } });
  }

  async function restaurar() {
    window.clearTimeout(timer.current);
    setPrefs({});
    aplicarAparencia({});
    await salvar({});
    notificar.sucesso("Aparência padrão restaurada.");
  }

  const padrao = PADRAO[temaEfetivo(prefs)];
  const personalizado = Boolean(prefs.tema && prefs.tema !== "sistema") || Object.keys(prefs.cores ?? {}).length > 0;

  return (
    <section className="card">
      <h2 className="card-title">Aparência</h2>
      <div className="login-form">
        <div className="field">
          <span className="field-label">Tema</span>
          <div className="seg" role="radiogroup" aria-label="Tema">
            {TEMAS.map((t) => {
              const ativo = (prefs.tema ?? "sistema") === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={ativo}
                  aria-pressed={ativo}
                  onClick={() => mudar({ ...prefs, tema: t.value })}
                >
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {CORES.map(({ chave, label }) => {
          const valor = prefs.cores?.[chave] ?? padrao[chave];
          return (
            <div key={chave} className="field">
              <label htmlFor={`cor-${chave}`}>{label}</label>
              <div className="cor-linha">
                <input
                  id={`cor-${chave}`}
                  className="cor-input"
                  type="color"
                  value={valor}
                  onChange={(e) => mudarCor(chave, e.target.value)}
                />
                <span className="cor-hex">{valor.toUpperCase()}</span>
                {chave === "destaque" && (
                  <div className="cor-sugestoes" role="group" aria-label="Sugestões de cor principal">
                    {SUGESTOES.map((s) => (
                      <button
                        key={s}
                        type="button"
                        className="cor-sugestao"
                        style={{ background: s }}
                        aria-label={`Usar ${s}`}
                        aria-pressed={valor.toLowerCase() === s}
                        onClick={() => mudarCor("destaque", s)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <button type="button" className="btn ghost btn-icone" onClick={() => void restaurar()} disabled={!personalizado}>
          <RotateCcw aria-hidden="true" />
          Restaurar padrão
        </button>
      </div>
    </section>
  );
}

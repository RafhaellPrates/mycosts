import lista from "./novidades.json";

/**
 * "O que mudou", no Perfil. A primeira da lista e a mais nova. Ao publicar
 * uma versao, adicionar um item no topo de novidades.json: quem ainda nao viu
 * ganha o aviso na aba Perfil e o back manda o push de atualizacao. O que ja
 * foi visto fica so neste aparelho.
 */

export interface Novidade {
  /** Identificador unico, nunca reaproveitar. */
  versao: string;
  /** Mes da publicacao, como aparece na tela. */
  quando: string;
  titulo: string;
  itens: string[];
}

export const NOVIDADES: Novidade[] = lista;

const CHAVE = "mycosts.novidades-vista";

/** Tem versao que este aparelho ainda nao abriu. */
export function temNovidade(): boolean {
  try {
    return localStorage.getItem(CHAVE) !== NOVIDADES[0].versao;
  } catch {
    return false;
  }
}

export function marcarNovidadesVistas() {
  try {
    localStorage.setItem(CHAVE, NOVIDADES[0].versao);
  } catch {
    /* modo privado: o aviso volta na proxima vez */
  }
}

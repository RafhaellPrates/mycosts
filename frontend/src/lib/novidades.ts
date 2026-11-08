/**
 * "O que mudou", no Perfil. A primeira da lista e a mais nova. Ao publicar
 * uma versao, adicionar um item no topo: quem ainda nao viu ganha o aviso
 * na aba Perfil. O que ja foi visto fica so neste aparelho.
 */

export interface Novidade {
  /** Identificador unico, nunca reaproveitar. */
  versao: string;
  /** Mes da publicacao, como aparece na tela. */
  quando: string;
  titulo: string;
  itens: string[];
}

export const NOVIDADES: Novidade[] = [
  {
    versao: "3.0",
    quando: "novembro de 2026",
    titulo: "Visual novo e assinaturas",
    itens: [
      "Navegação com 4 abas: Início, Mês, Cartões e Perfil. Cadastro e Acessos ficam dentro do Perfil.",
      "Início mostra o saldo do mês e as próximas contas a vencer logo no topo.",
      "Botão + para lançar gasto em todas as abas.",
      "Assinaturas dentro de cada cartão: cobram todo mês na fatura até você cancelar.",
      "Lembrete no dia 5 de cada mês para organizar as finanças (ative em Perfil > Notificações).",
      "Foto de perfil: toque na sua foto no topo do Perfil.",
      "Comprovantes: anexe foto ou PDF ao lançar um gasto ou ao dar baixa numa conta (inclusive a fatura do cartão).",
      "Esta tela, para ver o que mudou no app.",
    ],
  },
  {
    versao: "2.1",
    quando: "outubro de 2026",
    titulo: "Fatura como gasto e modo visitante",
    itens: [
      "A fatura do cartão entra em A pagar no mês do vencimento e conta como gasto quando paga.",
      "Cartões mostram as compras parceladas em andamento.",
      "Modo visitante com dados de exemplo, apagados em 24h.",
    ],
  },
  {
    versao: "2.0",
    quando: "outubro de 2026",
    titulo: "Painel, cartões e temas",
    itens: [
      "Painel com gráficos de receitas x gastos e gastos por categoria.",
      "Cartões de crédito com fatura aberta, limite e o melhor cartão para usar hoje.",
      "Compras parceladas.",
      "Tema claro, escuro e cores personalizadas.",
      "Receita da fonte entra sozinha no mês pelo valor previsto.",
      "Exportar o ano em planilha .xlsx.",
    ],
  },
];

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

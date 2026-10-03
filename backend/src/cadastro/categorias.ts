/** Mesmas categorias da aba Cadastro da planilha. */
export const CATEGORIAS = [
  "Moradia", "Utilidades", "Alimentação", "Transporte", "Saúde", "Educação",
  "Lazer", "Cartões", "Dívidas", "Impostos", "Investimentos", "Outros",
] as const;

/** Categoria das faturas: conta a pagar, mas o gasto vem dos avulsos no credito. */
export const CATEGORIA_CARTOES = "Cartões";

/** Avulso nao usa "Cartões": compra no cartao vai pela forma de pagamento. */
export const CATEGORIAS_AVULSO = CATEGORIAS.filter((c) => c !== CATEGORIA_CARTOES) as [string, ...string[]];

export const FORMAS_PAGAMENTO = ["Crédito", "Débito", "Pix", "Dinheiro"] as const;

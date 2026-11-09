/**
 * Contrato da API. Espelha backend/src/mes/types.ts e as rotas de
 * auth e cadastro do back.
 */

export type Situacao = "Pago" | "Pendente" | "Não se aplica" | "";

export interface Conta {
  id: string;
  nome: string;
  categoria: string;
  diaVenc: number | null;
  previsto: number;
  /** Valor pago no mes; null = nada informado. */
  pago: number | null;
  situacao: Situacao;
  /** Conta da fatura de um cartao: previsto = fatura que vence no mes. */
  cartaoId: string | null;
  /** Comprovantes do pagamento neste mes. */
  comprovantes: number;
}

export interface Receita {
  id: string;
  fonte: string;
  /** Previsto por mes no cadastro da fonte. */
  previsto: number;
  valor: number | null;
  /** Valor veio do previsto (nada lancado no mes). */
  automatico: boolean;
}

export const FORMAS_PAGAMENTO = ["Crédito", "Débito", "Pix", "Dinheiro"] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

/** Gasto avulso. Com cartao, entra na fatura e nao soma nos avulsos. */
export interface Lancamento {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  categoria: string;
  /** Valor que cai no mes (a parcela, se parcelada). Com cartao, o total da compra. */
  valor: number;
  formaPagamento: FormaPagamento;
  cartaoId: string | null;
  /** 1 = a vista. */
  parcelas: number;
  /** Qual parcela cai neste mes (1..parcelas). */
  parcela: number;
  valorTotal: number;
  /** Quantos comprovantes anexados. */
  comprovantes: number;
}

/** valor = total da compra. */
export type LancamentoBody = Omit<Lancamento, "id" | "parcela" | "valorTotal" | "comprovantes">;

export interface Indicadores {
  receitasMes: number;
  contasPrevistas: number;
  /** Todas as contas pagas no mes, inclusive faturas de cartao. */
  contasPagas: number;
  emAberto: number;
  avulsosMes: number;
  /** Contas pagas (faturas inclusive) + avulsos fora do cartao. */
  gastosMes: number;
  /** 0..1 */
  pctRendaComprometida: number | null;
  faturasCartao: number;
  pendentesQtd: number;
  receitasAno: number;
  gastosAno: number;
  saldoAno: number;
}

export interface CategoriaGasto {
  categoria: string;
  valor: number;
  /** 0..1 */
  pct: number;
}

export interface ResumoMensal {
  ym: string;
  receitas: number;
  gastos: number;
  saldo: number;
}

export interface MesResponse {
  ym: string;
  contas: Conta[];
  receitas: Receita[];
  lancamentos: Lancamento[];
  indicadores: Indicadores;
  categorias: CategoriaGasto[];
  resumoAnual: ResumoMensal[];
}

export interface PatchContaBody {
  pago: number | null;
  situacao: Situacao;
}

export interface PatchReceitaBody {
  valor: number | null;
}

// ---- auth ----

/** visitante: usuario temporario do modo visitante, apagado em 24h. */
export type Papel = "admin" | "usuario" | "visitante";

/** Aparencia escolhida no Perfil. Objeto vazio = visual padrao. */
export interface Preferencias {
  tema?: "sistema" | "claro" | "escuro";
  cores?: { destaque?: string; receitas?: string; gastos?: string };
}

export interface Usuario {
  id: string;
  email: string;
  nome: string;
  papel: Papel;
  preferencias: Preferencias;
  /** Muda a cada foto nova; null = sem foto. */
  fotoVersao: number | null;
}

/** Acesso visto pelo admin na aba Acessos. */
export interface Acesso {
  id: string;
  nome: string;
  email: string;
  papel: Papel;
  criadoEm: string;
}

export interface AcessoBody {
  nome?: string;
  email?: string;
  senha?: string;
  papel?: Papel;
}

/** senhaAtual e obrigatoria quando troca email ou senha. */
export interface PerfilBody {
  nome?: string;
  email?: string;
  senhaAtual?: string;
  novaSenha?: string;
  preferencias?: Preferencias;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

// ---- cadastro ----

export interface ContaCadastro {
  id: string;
  nome: string;
  categoria: string;
  diaVenc: number | null;
  previsto: number;
  ativa: boolean;
  ordem: number;
}

export type ContaCadastroBody = Pick<ContaCadastro, "nome" | "categoria" | "diaVenc" | "previsto">;

export interface Fonte {
  id: string;
  nome: string;
  /** Valor previsto por mes. */
  previsto: number;
  /** Dia do recebimento (1 a 31): nesse dia chega o push "<nome> na conta". */
  dia: number | null;
  ativa: boolean;
  ordem: number;
}

// ---- cartoes ----

export interface CartaoBody {
  nome: string;
  diaFechamento: number;
  diaVencimento: number;
  melhorDia: number;
  limite: number | null;
}

/** Compra (ou parcela) que cai numa fatura. */
export interface ItemFatura {
  id: string;
  descricao: string;
  data: string;
  parcela: number;
  parcelas: number;
  valor: number;
  /** Cobranca mensal de uma assinatura. */
  assinatura: boolean;
}

/** Cobranca mensal no cartao, no dia da primeira cobranca, ate cancelar. */
export interface Assinatura {
  id: string;
  nome: string;
  valor: number;
  /** AAAA-MM-DD da primeira cobranca. */
  inicio: string;
  /** AAAA-MM-DD; cobranca desse dia em diante nao acontece. */
  canceladaEm: string | null;
  /** Ainda cobra (sem cancelamento ou cancelamento no futuro). */
  ativa: boolean;
  /** Proxima cobranca a partir de hoje; null se nao havera mais. */
  proxima: string | null;
}

export interface AssinaturaBody {
  nome: string;
  valor: number;
  inicio: string;
}

export interface Cartao extends CartaoBody {
  id: string;
  /** Ja gasto na fatura aberta. */
  faturaAtual: number;
  fechaEm: string;
  venceEm: string;
  /** Dias ate pagar uma compra feita hoje. */
  diasParaPagar: number;
  melhorDiaHoje: boolean;
  estourado: boolean;
  /** Compras parceladas com parcela na fatura aberta ou nas seguintes. */
  parcelamentos: Parcelamento[];
  /** Ativas e canceladas ha menos de um mes. */
  assinaturas: Assinatura[];
  /** Soma das ativas por mes. */
  assinaturasMes: number;
}

export interface Parcelamento {
  id: string;
  descricao: string;
  data: string;
  parcelas: number;
  /** Parcela que cai na fatura aberta. */
  parcelaAtual: number;
  valorParcela: number;
  valorTotal: number;
  /** Soma das parcelas da atual em diante. */
  restante: number;
  /** Vencimento da ultima parcela. */
  terminaEm: string;
}

/** Fatura que vence no mes ym. pago e situacao vem da conta do cartao. */
export interface Fatura {
  ym: string;
  fechaEm: string;
  venceEm: string;
  total: number;
  pago: number | null;
  situacao: Situacao;
  itens: ItemFatura[];
}

export interface CartoesResponse {
  cartoes: Cartao[];
  /** Cartao com mais prazo sem passar do limite. */
  recomendado: string | null;
  hoje: string;
}

// ---- notificacoes ----

export interface NotificacoesStatus {
  /** null = servidor sem chaves VAPID (push desligado). */
  chavePublica: string | null;
  /** Aparelhos do usuario com notificacao ligada. */
  aparelhos: number;
}

// ---- comprovantes ----

/** De quem e o comprovante: um gasto ou o pagamento de uma conta no mes. */
export type AlvoComprovante = { lancamento: string } | { conta: string; ym: string };

export interface Comprovante {
  id: string;
  lancamentoId: string | null;
  contaId: string | null;
  ym: string | null;
  nome: string;
  tipo: "image/jpeg" | "image/png" | "image/webp" | "application/pdf";
  /** Bytes. */
  tamanho: number;
  criadoEm: string;
}

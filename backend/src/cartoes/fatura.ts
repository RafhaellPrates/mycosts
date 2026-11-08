/**
 * Regras de fatura. Compra feita no dia do fechamento ou depois entra na
 * fatura seguinte. A fatura vence no proximo dia de vencimento depois do
 * fechamento. Dia 31 em mes curto vira o ultimo dia do mes.
 */

export interface Data {
  y: number;
  /** 1..12 */
  m: number;
  d: number;
}

const ultimoDia = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const em = (y: number, m: number, dia: number): Data => {
  const ajuste = new Date(Date.UTC(y, m - 1, 1));
  const [ay, am] = [ajuste.getUTCFullYear(), ajuste.getUTCMonth() + 1];
  return { y: ay, m: am, d: Math.min(dia, ultimoDia(ay, am)) };
};
const ms = (x: Data) => Date.UTC(x.y, x.m - 1, x.d);
export const diasEntre = (a: Data, b: Data) => Math.round((ms(b) - ms(a)) / 86_400_000);

/** Hoje no fuso do Brasil: o servidor (Render) roda em UTC. */
export function hojeBR(): Data {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).split("-");
  return { y: Number(y), m: Number(m), d: Number(d) };
}

export function deTexto(iso: string): Data {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export const texto = (x: Data) => `${x.y}-${String(x.m).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;

/** Fechamento da fatura em que cai uma compra feita na data. */
export function fechamentoDaCompra(data: Data, diaFechamento: number): Data {
  const fechaEsteMes = em(data.y, data.m, diaFechamento);
  return data.d < fechaEsteMes.d ? fechaEsteMes : em(data.y, data.m + 1, diaFechamento);
}

/** Vencimento da fatura que fecha na data. */
export function vencimentoDaFatura(fechamento: Data, diaVencimento: number): Data {
  return diaVencimento > fechamento.d
    ? em(fechamento.y, fechamento.m, diaVencimento)
    : em(fechamento.y, fechamento.m + 1, diaVencimento);
}

/** Fechamento k faturas depois (parcela k+1). */
export const fechamentoMais = (f: Data, k: number, diaFechamento: number) => em(f.y, f.m + k, diaFechamento);

export const mesmoMes = (a: Data, b: Data) => a.y === b.y && a.m === b.m;

/** Fechamento da fatura que vence no mes (y, m): fecha no proprio mes ou no anterior. */
export function fechamentoQueVenceEm(y: number, m: number, diaFechamento: number, diaVencimento: number): Data {
  const candidatos = [em(y, m - 1, diaFechamento), em(y, m, diaFechamento)];
  return candidatos.find((f) => {
    const v = vencimentoDaFatura(f, diaVencimento);
    return v.y === y && v.m === m;
  }) ?? candidatos[0];
}

export interface Compra {
  id: string;
  /** AAAA-MM-DD */
  data: string;
  descricao: string;
  /** Total da compra. */
  valor: number;
  parcelas: number;
  /** Cobranca mensal de uma assinatura (id = id da assinatura). */
  assinatura?: boolean;
}

export interface ItemFatura {
  id: string;
  descricao: string;
  data: string;
  parcela: number;
  parcelas: number;
  valor: number;
  assinatura: boolean;
}

export interface Assinatura {
  id: string;
  nome: string;
  valor: number;
  /** AAAA-MM-DD da primeira cobranca; as seguintes caem no mesmo dia. */
  inicio: string;
  /** AAAA-MM-DD; cobranca desse dia em diante nao acontece. */
  canceladaEm: string | null;
}

/** Cobrancas da assinatura do inicio ate `ate` (inclusive) ou ate o cancelamento. */
export function cobrancasDaAssinatura(a: Assinatura, ate: Data): Compra[] {
  const inicio = deTexto(a.inicio);
  const fim = a.canceladaEm ? deTexto(a.canceladaEm) : null;
  const lista: Compra[] = [];
  for (let k = 0; ; k++) {
    const data = em(inicio.y, inicio.m + k, inicio.d);
    if (ms(data) > ms(ate) || (fim && ms(data) >= ms(fim))) break;
    lista.push({ id: a.id, data: texto(data), descricao: a.nome, valor: a.valor, parcelas: 1, assinatura: true });
  }
  return lista;
}

/** Proxima cobranca a partir de hoje (inclusive), ou null se cancelada antes dela. */
export function proximaCobranca(a: Assinatura, hoje: Data): string | null {
  const inicio = deTexto(a.inicio);
  const fim = a.canceladaEm ? deTexto(a.canceladaEm) : null;
  for (let k = 0; k < 1200; k++) {
    const data = em(inicio.y, inicio.m + k, inicio.d);
    if (fim && ms(data) >= ms(fim)) return null;
    if (ms(data) >= ms(hoje)) return texto(data);
  }
  return null;
}

/** Soma `meses` meses a data (dia limitado ao fim do mes). */
export const maisMeses = (x: Data, meses: number) => em(x.y, x.m + meses, x.d);

/** Compras e parcelas que caem na fatura que fecha em `fechamento`. A ultima parcela absorve o arredondamento. */
export function itensDaFatura(compras: Compra[], fechamento: Data, diaFechamento: number): ItemFatura[] {
  const itens: ItemFatura[] = [];
  for (const compra of compras) {
    const primeira = fechamentoDaCompra(deTexto(compra.data), diaFechamento);
    const parcela = Math.round(compra.valor / compra.parcelas * 100) / 100;
    for (let k = 0; k < compra.parcelas; k++) {
      if (!mesmoMes(fechamentoMais(primeira, k, diaFechamento), fechamento)) continue;
      const ultima = k === compra.parcelas - 1;
      const valor = ultima ? Math.round((compra.valor - parcela * (compra.parcelas - 1)) * 100) / 100 : parcela;
      itens.push({
        id: compra.id,
        descricao: compra.descricao,
        data: compra.data,
        parcela: k + 1,
        parcelas: compra.parcelas,
        valor,
        assinatura: compra.assinatura ?? false,
      });
    }
  }
  return itens;
}

export const totalDe = (itens: ItemFatura[]) => Math.round(itens.reduce((a, i) => a + i.valor, 0) * 100) / 100;

export interface Parcelamento {
  id: string;
  descricao: string;
  data: string;
  parcelas: number;
  /** Parcela que cai na fatura aberta (1..parcelas). */
  parcelaAtual: number;
  valorParcela: number;
  valorTotal: number;
  /** Soma das parcelas da atual em diante. */
  restante: number;
  /** Vencimento da fatura da ultima parcela. */
  terminaEm: string;
}

/**
 * Compras parceladas que ainda tem parcela na fatura que fecha em `aberta`
 * ou nas seguintes. Compra que comeca depois da aberta fica com parcelaAtual 1.
 */
export function parcelasEmAndamento(compras: Compra[], aberta: Data, diaFechamento: number, diaVencimento: number): Parcelamento[] {
  const indice = (x: Data) => x.y * 12 + x.m;
  const lista: Parcelamento[] = [];
  for (const compra of compras) {
    if (compra.parcelas < 2) continue;
    const primeira = fechamentoDaCompra(deTexto(compra.data), diaFechamento);
    const ultima = fechamentoMais(primeira, compra.parcelas - 1, diaFechamento);
    if (indice(ultima) < indice(aberta)) continue;
    const atual = Math.max(indice(aberta) - indice(primeira), 0) + 1;
    const parcela = Math.round(compra.valor / compra.parcelas * 100) / 100;
    lista.push({
      id: compra.id,
      descricao: compra.descricao,
      data: compra.data,
      parcelas: compra.parcelas,
      parcelaAtual: atual,
      valorParcela: parcela,
      valorTotal: compra.valor,
      restante: Math.round((compra.valor - parcela * (atual - 1)) * 100) / 100,
      terminaEm: texto(vencimentoDaFatura(ultima, diaVencimento)),
    });
  }
  return lista;
}

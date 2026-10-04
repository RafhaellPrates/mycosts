/**
 * Receita automatica: fonte ativa com previsto conta como recebida em cada
 * mes, do mes em que foi cadastrada ate o mes atual (fuso de Sao Paulo).
 * Valor lancado no mes (inclusive 0 = nao recebi) vence o automatico.
 * Meses futuros ficam de fora para o saldo do ano nao contar o que nao chegou.
 *
 * `ym` e a expressao SQL do mes (ex: "$2" ou "m.ym"); espera os aliases f e r.
 */
export function valorReceita(ym: string): string {
  return `coalesce(r.valor, case
    when f.ativa and f.previsto > 0
     and ${ym} >= to_char(f.criado_em at time zone 'America/Sao_Paulo', 'YYYY-MM')
     and ${ym} <= to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM')
    then f.previsto end)`;
}

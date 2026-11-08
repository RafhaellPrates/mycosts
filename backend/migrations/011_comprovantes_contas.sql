-- Comprovante tambem no pagamento de uma conta (conta + mes), inclusive a
-- fatura do cartao. Cada comprovante e de um gasto OU de um pagamento.

alter table comprovantes alter column lancamento_id drop not null;
alter table comprovantes add column conta_id uuid references contas(id) on delete cascade;
alter table comprovantes add column ym char(7) check (ym ~ '^\d{4}-(0[1-9]|1[0-2])$');
alter table comprovantes add constraint comprovantes_alvo check (
  (lancamento_id is not null and conta_id is null and ym is null)
  or (lancamento_id is null and conta_id is not null and ym is not null)
);
create index comprovantes_conta_idx on comprovantes (conta_id, ym);

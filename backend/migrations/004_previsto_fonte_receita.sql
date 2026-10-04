-- Valor previsto por mes de cada fonte de receita, como o previsto das
-- contas fixas. A tela do mes usa para pre-preencher o valor recebido.

alter table fontes_receita add column previsto numeric(12,2) not null default 0 check (previsto >= 0);

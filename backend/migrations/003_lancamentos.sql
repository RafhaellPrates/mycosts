-- Gastos avulsos (padaria, Uber). Contam no mes da data da compra, inclusive
-- no cartao de credito; por isso a fatura (conta fixa da categoria Cartões)
-- nao entra como gasto no Painel, so como conta a pagar.

create table lancamentos (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references usuarios(id) on delete cascade,
  data             date not null,
  descricao        text not null check (length(trim(descricao)) between 1 and 80),
  categoria        text not null,
  valor            numeric(12,2) not null check (valor > 0),
  forma_pagamento  text not null check (forma_pagamento in ('Crédito', 'Débito', 'Pix', 'Dinheiro')),
  criado_em        timestamptz not null default now()
);
create index lancamentos_usuario_data_idx on lancamentos (usuario_id, data);

alter table lancamentos enable row level security;

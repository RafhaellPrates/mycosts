-- Cartoes de credito e compras parceladas.

create table cartoes (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references usuarios(id) on delete cascade,
  nome             text not null check (length(trim(nome)) between 1 and 40),
  dia_fechamento   smallint not null check (dia_fechamento between 1 and 31),
  dia_vencimento   smallint not null check (dia_vencimento between 1 and 31),
  melhor_dia       smallint not null check (melhor_dia between 1 and 31),
  limite           numeric(12,2) check (limite > 0),
  criado_em        timestamptz not null default now()
);
create index cartoes_usuario_idx on cartoes (usuario_id);
alter table cartoes enable row level security;

-- Compra no credito pode apontar o cartao. Parcelada: valor e o total e cada
-- parcela conta como gasto num mes, a partir do mes da compra.
alter table lancamentos add column cartao_id uuid references cartoes(id) on delete set null;
alter table lancamentos add column parcelas smallint not null default 1 check (parcelas between 1 and 48);

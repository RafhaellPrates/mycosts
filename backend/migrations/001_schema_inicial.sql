-- Schema inicial: usuarios, cadastro (contas fixas e fontes de receita)
-- e os valores mes a mes. Mes sempre no formato 'YYYY-MM'.
--
-- RLS ligado sem nenhuma policy: a API publica do Supabase (anon key)
-- nao enxerga nada. So o back acessa, pela connection string, e ele
-- filtra tudo por usuario_id.

create table usuarios (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email)),
  senha_hash  text not null,
  criado_em   timestamptz not null default now()
);

create table contas (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  categoria   text not null,
  dia_venc    smallint check (dia_venc between 1 and 31),
  previsto    numeric(12,2) not null default 0 check (previsto >= 0),
  ativa       boolean not null default true,
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now()
);
create index contas_usuario_idx on contas (usuario_id, ordem);

create table pagamentos (
  conta_id       uuid not null references contas(id) on delete cascade,
  ym             char(7) not null check (ym ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  pago           numeric(12,2) check (pago >= 0),
  situacao       text check (situacao in ('Pago', 'Pendente', 'Não se aplica')),
  atualizado_em  timestamptz not null default now(),
  primary key (conta_id, ym)
);

create table fontes_receita (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  nome        text not null check (length(trim(nome)) > 0),
  ativa       boolean not null default true,
  ordem       integer not null default 0,
  criado_em   timestamptz not null default now()
);
create index fontes_receita_usuario_idx on fontes_receita (usuario_id, ordem);

create table receitas (
  fonte_id       uuid not null references fontes_receita(id) on delete cascade,
  ym             char(7) not null check (ym ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  valor          numeric(12,2) check (valor >= 0),
  atualizado_em  timestamptz not null default now(),
  primary key (fonte_id, ym)
);

alter table usuarios       enable row level security;
alter table contas         enable row level security;
alter table pagamentos     enable row level security;
alter table fontes_receita enable row level security;
alter table receitas       enable row level security;

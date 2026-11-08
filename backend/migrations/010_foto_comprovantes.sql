-- Foto de perfil e comprovantes dos gastos. Os arquivos ficam no proprio
-- Postgres (bytea): o Supabase segue so como host, sem servico de storage.
-- O front comprime as imagens antes de enviar (lib/imagem.ts).

create table fotos_perfil (
  usuario_id     uuid primary key references usuarios(id) on delete cascade,
  tipo           text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp')),
  dados          bytea not null,
  atualizado_em  timestamptz not null default now()
);
alter table fotos_perfil enable row level security;

-- Comprovante de um gasto (avulso ou compra no cartao). Apagar o gasto apaga os comprovantes.
create table comprovantes (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references usuarios(id) on delete cascade,
  lancamento_id  uuid not null references lancamentos(id) on delete cascade,
  nome           text not null check (length(nome) between 1 and 120),
  tipo           text not null check (tipo in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  tamanho        integer not null check (tamanho > 0),
  dados          bytea not null,
  criado_em      timestamptz not null default now()
);
create index comprovantes_lancamento_idx on comprovantes (lancamento_id);
create index comprovantes_usuario_idx on comprovantes (usuario_id);
alter table comprovantes enable row level security;

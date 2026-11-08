-- Assinaturas no cartao e inscricoes de notificacao (Web Push).

-- Assinatura e uma cobranca mensal no cartao, no mesmo dia da primeira
-- cobranca (inicio), ate ser cancelada. Cobranca a partir do dia do
-- cancelamento nao entra mais. Cada cobranca cai na fatura como uma compra.
create table assinaturas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  cartao_id     uuid not null references cartoes(id) on delete cascade,
  nome          text not null check (length(trim(nome)) between 1 and 60),
  valor         numeric(12,2) not null check (valor > 0),
  inicio        date not null,
  cancelada_em  date check (cancelada_em is null or cancelada_em >= inicio),
  criado_em     timestamptz not null default now()
);
create index assinaturas_usuario_idx on assinaturas (usuario_id, cartao_id);
alter table assinaturas enable row level security;

-- Um aparelho por endpoint. ultimo_aviso = mes (AAAA-MM) do ultimo lembrete
-- do dia 5, para mandar uma vez so por mes.
create table push_inscricoes (
  endpoint      text primary key,
  usuario_id    uuid not null references usuarios(id) on delete cascade,
  p256dh        text not null,
  auth          text not null,
  ultimo_aviso  char(7),
  criado_em     timestamptz not null default now()
);
create index push_inscricoes_usuario_idx on push_inscricoes (usuario_id);
alter table push_inscricoes enable row level security;

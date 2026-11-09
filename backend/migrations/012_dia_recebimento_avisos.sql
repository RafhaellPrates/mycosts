-- Dia do recebimento na fonte de receita (push "Salario na conta") e registro
-- dos avisos ja mandados, para cada aviso sair uma vez so por usuario.

alter table fontes_receita add column dia smallint check (dia between 1 and 31);

-- chave: 'receita:<fonte>:<AAAA-MM>', 'lembrete:<AAAA-MM>' ou 'versao:<versao>'.
create table avisos_enviados (
  usuario_id  uuid not null references usuarios(id) on delete cascade,
  chave       text not null,
  enviado_em  timestamptz not null default now(),
  primary key (usuario_id, chave)
);
alter table avisos_enviados enable row level security;

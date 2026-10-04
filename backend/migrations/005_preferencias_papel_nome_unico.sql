-- Preferencias de aparencia (tema e cores), nivel de acesso e login por nome.

-- {"tema": "sistema"|"claro"|"escuro", "cores": {"destaque", "receitas", "gastos"}}
-- Objeto vazio = visual padrao. O back valida o formato antes de salvar.
alter table usuarios add column preferencias jsonb not null default '{}'::jsonb;

-- Quem cria acessos e o admin; o primeiro e marcado direto no banco.
alter table usuarios add column papel text not null default 'usuario'
  check (papel in ('admin', 'usuario'));

-- Login aceita email ou nome: nome passa a ser unico (sem diferenciar
-- maiusculas) e nao pode ter @, para nunca ser confundido com email.
create unique index usuarios_nome_unico on usuarios (lower(trim(nome)));
alter table usuarios add constraint usuarios_nome_sem_arroba check (position('@' in nome) = 0);

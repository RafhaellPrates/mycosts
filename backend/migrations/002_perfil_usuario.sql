-- Perfil: nome de exibicao do usuario. Contas antigas ficam com o
-- comeco do email ate a pessoa trocar na tela de perfil.

alter table usuarios add column nome text;
update usuarios set nome = split_part(email, '@', 1) where nome is null;
alter table usuarios alter column nome set not null;
alter table usuarios add constraint usuarios_nome_check
  check (length(trim(nome)) between 1 and 60);

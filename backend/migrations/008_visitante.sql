-- Modo visitante: cada clique em "Entrar como visitante" cria um usuario
-- proprio com dados de exemplo, apagado 24h depois (auth/visitante.ts).

alter table usuarios drop constraint usuarios_papel_check;
alter table usuarios add constraint usuarios_papel_check
  check (papel in ('admin', 'usuario', 'visitante'));

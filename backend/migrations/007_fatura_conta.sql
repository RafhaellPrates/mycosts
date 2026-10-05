-- Cada cartao tem uma conta a pagar (categoria Cartões). O previsto do mes
-- e a fatura que vence nele, calculada pelas compras; o pagamento fica em
-- pagamentos como nas outras contas.

alter table contas add column cartao_id uuid unique references cartoes(id) on delete set null;

-- Conta de fatura ja cadastrada a mao com o mesmo nome do cartao vira a dele.
update contas c set cartao_id = k.id
from cartoes k
where c.usuario_id = k.usuario_id
  and c.categoria = 'Cartões'
  and c.cartao_id is null
  and lower(trim(c.nome)) = lower(trim(k.nome))
  and not exists (select 1 from contas o where o.cartao_id = k.id)
  and c.id = (
    select min(x.id::text)::uuid from contas x
    where x.usuario_id = k.usuario_id and x.categoria = 'Cartões' and lower(trim(x.nome)) = lower(trim(k.nome))
  );

-- Cartao sem conta ganha uma.
insert into contas (usuario_id, nome, categoria, dia_venc, previsto, ordem, cartao_id)
select k.usuario_id, k.nome, 'Cartões', k.dia_vencimento, 0,
       (select coalesce(max(ordem), 0) + 1 from contas where usuario_id = k.usuario_id), k.id
from cartoes k
where not exists (select 1 from contas c where c.cartao_id = k.id);

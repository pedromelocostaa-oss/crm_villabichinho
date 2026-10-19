-- Villa Bichinho - 0011: as 10 unidades passam a ser "Quarto N"
-- O seed 0005 criou 8 placeholders "Chale N". Sao 10 unidades, e por enquanto
-- sem nome proprio: ficam Quarto 1 a Quarto 10 ate o Pedro batizar.
-- Renomeia em vez de recriar para preservar os ids (nada aponta para eles hoje,
-- mas reservas e folios apontam por id, nao por nome).

do $$
declare i int;
begin
  for i in 1..10 loop
    update chales set nome = 'Quarto ' || i
     where ordem_exibicao = i and nome = 'Chalé ' || i;

    insert into chales (nome, ordem_exibicao)
    values ('Quarto ' || i, i)
    on conflict (nome) do nothing;
  end loop;
end $$;

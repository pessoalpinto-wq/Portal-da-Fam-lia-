-- Caixa de ideias (coll = 'ideas'): cada pessoa só vê e altera as suas ideias, a não ser que as partilhe
-- (data.shared = true). Políticas "restrictive": somam-se (AND) às regras que já existem para os itens,
-- por isso não é preciso mexer nelas. Vale também para os pais.
set lock_timeout = '20s';

create policy "ideias: ler só as minhas ou partilhadas" on public.items
  as restrictive for select to authenticated
  using (
    coll <> 'ideas'
    or data ->> 'by' = (select private.my_member_id())
    or coalesce((data ->> 'shared')::boolean, false)
  );

create policy "ideias: criar só em meu nome" on public.items
  as restrictive for insert to authenticated
  with check (coll <> 'ideas' or data ->> 'by' = (select private.my_member_id()));

-- Alterar (inclui apagar, que é "deleted = true"): as minhas; as partilhadas também (arrumar, passar a tarefa),
-- mas sem mudar o autor nem deixar de as partilhar.
create policy "ideias: alterar as minhas ou partilhadas" on public.items
  as restrictive for update to authenticated
  using (
    coll <> 'ideas'
    or data ->> 'by' = (select private.my_member_id())
    or coalesce((data ->> 'shared')::boolean, false)
  )
  with check (
    coll <> 'ideas'
    or data ->> 'by' = (select private.my_member_id())
    or coalesce((data ->> 'shared')::boolean, false)
  );

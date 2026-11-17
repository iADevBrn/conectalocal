-- =====================================================================
-- ConectaLocal · segurança (RLS) + funções usadas pelo frontend
-- Rode no Supabase: SQL Editor > New query > colar > Run.
--
-- ANTES DE RODAR:
--  1) Em Authentication > Policies, veja se já existem policies nessas tabelas.
--     Policies "permissivas" se SOMAM: uma policy antiga com "using (true)" em
--     cupons ou agendamentos anula o que está aqui. Apague as antigas.
--  2) Este script assume: ids = uuid e agendamentos.data_horario = timestamptz.
--     Se algum tipo for diferente, o Run vai acusar erro: me envie a mensagem.
--  3) Faça backup / teste primeiro num projeto de desenvolvimento.
-- =====================================================================

-- ---------- Função auxiliar: "o usuário logado é dono desta loja?" ----------
create or replace function public.eh_dono(p_loja_id uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lojas l
    where l.id = p_loja_id and l.dono_id = auth.uid()
  );
$$;

-- ---------- Remove as políticas do schema inicial (mesmo SQL de criação das tabelas) ----------
-- Estas três deixavam qualquer visitante ler TODOS os cupons e TODOS os agendamentos
-- (nome e telefone de clientes). Como políticas permissivas se somam, precisam sair.
drop policy if exists "Publico le cupons"        on public.cupons;
drop policy if exists "Publico le agendamentos"  on public.agendamentos;
drop policy if exists "Publico cria agendamento" on public.agendamentos;

-- ---------- Liga o RLS em todas as tabelas ----------
alter table public.lojas         enable row level security;
alter table public.categorias    enable row level security;
alter table public.itens         enable row level security;
alter table public.profissionais enable row level security;
alter table public.cupons        enable row level security;
alter table public.agendamentos  enable row level security;

-- ---------- lojas: vitrine pública, escrita só do dono ----------
drop policy if exists lojas_select_publico on public.lojas;
drop policy if exists lojas_insert_dono    on public.lojas;
drop policy if exists lojas_update_dono    on public.lojas;
drop policy if exists lojas_delete_dono    on public.lojas;

create policy lojas_select_publico on public.lojas
  for select to anon, authenticated using (true);
create policy lojas_insert_dono on public.lojas
  for insert to authenticated with check (dono_id = auth.uid());
create policy lojas_update_dono on public.lojas
  for update to authenticated using (dono_id = auth.uid()) with check (dono_id = auth.uid());
create policy lojas_delete_dono on public.lojas
  for delete to authenticated using (dono_id = auth.uid());

-- ---------- categorias / itens / profissionais: leitura pública, escrita do dono ----------
do $$
declare t text;
begin
  foreach t in array array['categorias', 'itens', 'profissionais'] loop
    execute format('drop policy if exists %I on public.%I', t || '_select_publico', t);
    execute format('drop policy if exists %I on public.%I', t || '_escrita_dono', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',
                   t || '_select_publico', t);
    execute format('create policy %I on public.%I for all to authenticated
                    using (public.eh_dono(loja_id)) with check (public.eh_dono(loja_id))',
                   t || '_escrita_dono', t);
  end loop;
end $$;

-- ---------- cupons: SÓ o dono enxerga (visitantes validam via função) ----------
drop policy if exists cupons_dono on public.cupons;
create policy cupons_dono on public.cupons
  for all to authenticated
  using (public.eh_dono(loja_id)) with check (public.eh_dono(loja_id));

-- Impede cupom duplicado na mesma loja (falha se já houver duplicados: apague-os antes).
create unique index if not exists cupons_loja_codigo_uk
  on public.cupons (loja_id, upper(codigo));

-- ---------- agendamentos: só o dono lê/atualiza; clientes criam via função ----------
drop policy if exists agendamentos_select_dono on public.agendamentos;
drop policy if exists agendamentos_update_dono on public.agendamentos;
create policy agendamentos_select_dono on public.agendamentos
  for select to authenticated using (public.eh_dono(loja_id));
create policy agendamentos_update_dono on public.agendamentos
  for update to authenticated
  using (public.eh_dono(loja_id)) with check (public.eh_dono(loja_id));

-- Barreira final contra overbooking: 2 agendamentos confirmados no mesmo horário
-- do mesmo profissional são impossíveis, mesmo com dois cliques simultâneos.
create unique index if not exists agendamentos_slot_unico
  on public.agendamentos (profissional_id, data_horario)
  where status = 'confirmado';

-- ---------- Funções chamadas pelo frontend ----------
create or replace function public.validar_cupom(p_loja_id uuid, p_codigo text)
returns integer
language sql stable security definer
set search_path = public
as $$
  select c.desconto_percentual::integer
  from public.cupons c
  where c.loja_id = p_loja_id and c.ativo and upper(c.codigo) = upper(trim(p_codigo))
  limit 1;
$$;

-- Devolve só os horários ocupados (sem nome/telefone de cliente: LGPD).
create or replace function public.horarios_ocupados(p_profissional_id uuid, p_dia date)
returns table (data_horario timestamptz)
language sql stable security definer
set search_path = public
as $$
  select a.data_horario
  from public.agendamentos a
  where a.profissional_id = p_profissional_id
    and a.status = 'confirmado'
    and a.data_horario >= (p_dia::timestamp at time zone 'America/Sao_Paulo')
    and a.data_horario <  ((p_dia + 1)::timestamp at time zone 'America/Sao_Paulo');
$$;

create or replace function public.criar_agendamento(
  p_loja_id uuid,
  p_profissional_id uuid,
  p_item_id uuid,
  p_nome text,
  p_telefone text,
  p_data_horario timestamptz
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(trim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 80 then
    raise exception 'Nome inválido';
  end if;
  if length(regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g')) < 10 then
    raise exception 'Telefone inválido';
  end if;
  if p_data_horario <= now() then
    raise exception 'Horário no passado';
  end if;
  if not exists (select 1 from public.profissionais where id = p_profissional_id and loja_id = p_loja_id) then
    raise exception 'Profissional inválido para esta loja';
  end if;
  if not exists (select 1 from public.itens where id = p_item_id and loja_id = p_loja_id) then
    raise exception 'Serviço inválido para esta loja';
  end if;

  -- Se o horário já foi pego, o índice único dispara o erro 23505.
  insert into public.agendamentos
    (loja_id, profissional_id, item_id, cliente_nome, cliente_telefone, data_horario, status)
  values
    (p_loja_id, p_profissional_id, p_item_id, trim(p_nome), p_telefone, p_data_horario, 'confirmado')
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.validar_cupom(uuid, text) from public;
revoke all on function public.horarios_ocupados(uuid, date) from public;
revoke all on function public.criar_agendamento(uuid, uuid, uuid, text, text, timestamptz) from public;
grant execute on function public.validar_cupom(uuid, text) to anon, authenticated;
grant execute on function public.horarios_ocupados(uuid, date) to anon, authenticated;
grant execute on function public.criar_agendamento(uuid, uuid, uuid, text, text, timestamptz) to anon, authenticated;

-- ---------- Logo padrão: o caminho antigo (/img/logotipo.png) não existe no projeto ----------
alter table public.lojas alter column logo_url set default '/logotipo.png';
update public.lojas set logo_url = '/logotipo.png' where logo_url = '/img/logotipo.png';

notify pgrst, 'reload schema';

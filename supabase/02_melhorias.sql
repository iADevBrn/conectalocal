-- =====================================================================
-- ConectaLocal · parte 2 (rode DEPOIS de seguranca.sql)
--  1) Criação da loja no próprio banco, junto com a conta (funciona mesmo
--     com "Confirm email" ligado no Supabase)
--  2) Expediente configurável por loja (dias, horário, intervalo, pausa)
--  3) Agenda respeita a duração do serviço (sem sobreposição)
-- Assume ids uuid e agendamentos.data_horario = timestamptz.
-- =====================================================================

-- ---------- 1) Cadastro atômico ----------
create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and p_slug <> all (array['admin','login','api','www','app','painel','cadastro','suporte','ajuda','termos','privacidade'])
    and not exists (select 1 from public.lojas where slug = p_slug);
$$;
revoke all on function public.slug_disponivel(text) from public;
grant execute on function public.slug_disponivel(text) to anon, authenticated;

-- Quando alguém se cadastra com os dados da loja em user_metadata, a loja e a
-- categoria padrão são criadas na MESMA transação da conta (tudo ou nada).
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_slug text := lower(trim(coalesce(new.raw_user_meta_data->>'slug', '')));
  v_modo text;
  v_loja_id uuid;
begin
  if v_slug = '' then
    return new; -- conta sem loja (ex.: outro tipo de cadastro)
  end if;
  if not public.slug_disponivel(v_slug) then
    raise exception 'Link da loja indisponível';
  end if;

  v_modo := case when new.raw_user_meta_data->>'modo' = 'agendamento' then 'agendamento' else 'catalogo' end;

  insert into public.lojas (dono_id, slug, nome, subtitulo, modo, telefone)
  values (
    new.id,
    v_slug,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome_loja'), ''), v_slug),
    case when v_modo = 'agendamento' then 'AGENDAMENTO ONLINE' else 'PEDIDOS ONLINE' end,
    v_modo,
    regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g')
  )
  returning id into v_loja_id;

  insert into public.categorias (loja_id, nome, ordem)
  values (v_loja_id, case when v_modo = 'agendamento' then 'Serviços Principais' else 'Destaques' end, 1);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- 2) Expediente por loja ----------
alter table public.lojas
  add column if not exists agenda_inicio        time    not null default '09:00',
  add column if not exists agenda_fim           time    not null default '18:00',
  add column if not exists agenda_intervalo     integer not null default 30,
  add column if not exists agenda_pausa_inicio  time             default '12:00',
  add column if not exists agenda_pausa_fim     time             default '13:30',
  add column if not exists agenda_dias          integer[] not null default '{1,2,3,4,5,6}'; -- 0=Dom ... 6=Sáb

-- ---------- 3) Duração do serviço gravada no agendamento ----------
alter table public.agendamentos
  add column if not exists duracao_minutos integer not null default 30;

-- Horários ocupados agora trazem a duração (o retorno mudou, então recria a função).
drop function if exists public.horarios_ocupados(uuid, date);
create function public.horarios_ocupados(p_profissional_id uuid, p_dia date)
returns table (data_horario timestamptz, duracao_minutos integer)
language sql stable security definer
set search_path = public
as $$
  select a.data_horario, coalesce(a.duracao_minutos, 30)
  from public.agendamentos a
  where a.profissional_id = p_profissional_id
    and a.status = 'confirmado'
    and a.data_horario >= (p_dia::timestamp at time zone 'America/Sao_Paulo')
    and a.data_horario <  ((p_dia + 1)::timestamp at time zone 'America/Sao_Paulo');
$$;
revoke all on function public.horarios_ocupados(uuid, date) from public;
grant execute on function public.horarios_ocupados(uuid, date) to anon, authenticated;

-- Criação do agendamento com TODAS as validações no servidor:
-- expediente, dia de funcionamento, pausa, duração do serviço e sobreposição.
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
  v_loja public.lojas%rowtype;
  v_dur integer;
  v_local timestamp;
  v_ini integer;
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

  select * into v_loja from public.lojas where id = p_loja_id and modo = 'agendamento';
  if not found then
    raise exception 'Loja inválida';
  end if;
  if not exists (select 1 from public.profissionais where id = p_profissional_id and loja_id = p_loja_id) then
    raise exception 'Profissional inválido para esta loja';
  end if;
  select coalesce(duracao_minutos, 30) into v_dur
    from public.itens where id = p_item_id and loja_id = p_loja_id;
  if not found then
    raise exception 'Serviço inválido para esta loja';
  end if;

  -- Expediente (sempre no fuso de São Paulo)
  v_local := p_data_horario at time zone 'America/Sao_Paulo';
  v_ini := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  if not (extract(dow from v_local)::int = any (v_loja.agenda_dias)) then
    raise exception 'Loja fechada neste dia';
  end if;
  if v_ini < extract(hour from v_loja.agenda_inicio)::int * 60 + extract(minute from v_loja.agenda_inicio)::int
     or v_ini + v_dur > extract(hour from v_loja.agenda_fim)::int * 60 + extract(minute from v_loja.agenda_fim)::int then
    raise exception 'Fora do horário de atendimento';
  end if;
  if v_loja.agenda_pausa_inicio is not null and v_loja.agenda_pausa_fim is not null
     and v_ini < extract(hour from v_loja.agenda_pausa_fim)::int * 60 + extract(minute from v_loja.agenda_pausa_fim)::int
     and v_ini + v_dur > extract(hour from v_loja.agenda_pausa_inicio)::int * 60 + extract(minute from v_loja.agenda_pausa_inicio)::int then
    raise exception 'Horário durante a pausa do profissional';
  end if;

  -- Serializa as reservas do mesmo profissional e barra qualquer sobreposição.
  perform pg_advisory_xact_lock(hashtext(p_profissional_id::text));
  if exists (
    select 1 from public.agendamentos a
    where a.profissional_id = p_profissional_id
      and a.status = 'confirmado'
      and a.data_horario < p_data_horario + make_interval(mins => v_dur)
      and a.data_horario + make_interval(mins => coalesce(a.duracao_minutos, 30)) > p_data_horario
  ) then
    raise exception 'Horário ocupado' using errcode = '23505';
  end if;

  insert into public.agendamentos
    (loja_id, profissional_id, item_id, cliente_nome, cliente_telefone, data_horario, duracao_minutos, status)
  values
    (p_loja_id, p_profissional_id, p_item_id, trim(p_nome), p_telefone, p_data_horario, v_dur, 'confirmado')
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.criar_agendamento(uuid, uuid, uuid, text, text, timestamptz) from public;
grant execute on function public.criar_agendamento(uuid, uuid, uuid, text, text, timestamptz) to anon, authenticated;

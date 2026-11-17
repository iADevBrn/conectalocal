-- =====================================================================
-- ConectaLocal · parte 3: endurecimento de segurança
-- Rode DEPOIS de seguranca.sql e 02_melhorias.sql. Pode rodar mais de uma vez.
-- =====================================================================

-- 0) Garantia: remove as políticas do schema inicial que deixavam QUALQUER visitante
--    ler todos os cupons e todos os agendamentos (nome e telefone dos clientes).
drop policy if exists "Publico le cupons"        on public.cupons;
drop policy if exists "Publico le agendamentos"  on public.agendamentos;
drop policy if exists "Publico cria agendamento" on public.agendamentos;

-- 1) Uma loja por conta (o app assume isso; sem o índice, quem chama a API direto
--    consegue criar várias e quebrar o painel). Se der erro de duplicidade, há contas
--    com 2 lojas: apague a extra antes de rodar de novo.
create unique index if not exists lojas_um_por_dono on public.lojas (dono_id);

-- 2) Link da loja: tamanho 3–40 e slugs de demonstração/marca reservados
--    (senão alguém cadastra "raizes" e sequestra o link de demonstração da landing).
create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select
    length(p_slug) between 3 and 40
    and p_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and p_slug <> all (array[
      'admin','login','api','www','app','painel','cadastro','suporte','ajuda','termos',
      'privacidade','raizes','doceria-ana','conectalocal','contato','precos','planos','blog',
      'status','dashboard','conta','entrar','sair','pagamento','assinatura'
    ])
    and not exists (select 1 from public.lojas where slug = p_slug);
$$;

-- 3) Cadastro: limita o tamanho do que vem do navegador (user_metadata é controlado
--    por quem se cadastra, inclusive chamando a API direto) e proíbe chamada direta.
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
    return new;
  end if;
  if not public.slug_disponivel(v_slug) then
    raise exception 'Link da loja indisponível';
  end if;

  v_modo := case when new.raw_user_meta_data->>'modo' = 'agendamento' then 'agendamento' else 'catalogo' end;

  insert into public.lojas (dono_id, slug, nome, subtitulo, modo, telefone)
  values (
    new.id,
    v_slug,
    left(coalesce(nullif(trim(new.raw_user_meta_data->>'nome_loja'), ''), v_slug), 80),
    case when v_modo = 'agendamento' then 'AGENDAMENTO ONLINE' else 'PEDIDOS ONLINE' end,
    v_modo,
    left(regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g'), 15)
  )
  returning id into v_loja_id;

  insert into public.categorias (loja_id, nome, ordem)
  values (v_loja_id, case when v_modo = 'agendamento' then 'Serviços Principais' else 'Destaques' end, 1);

  return new;
end;
$$;
revoke all on function public.handle_new_user() from public, anon, authenticated;

-- 4) Agendamento com trava anti-spam: no máximo 3 horários futuros confirmados por
--    telefone em cada loja (sem isso, qualquer pessoa pode lotar a agenda inteira
--    de um concorrente com nomes falsos).
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
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
  v_id uuid;
begin
  if length(trim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 80 then
    raise exception 'Nome inválido';
  end if;
  if length(v_tel) < 10 or length(v_tel) > 15 then
    raise exception 'Telefone inválido';
  end if;
  if p_data_horario <= now() then
    raise exception 'Horário no passado';
  end if;
  if p_data_horario > now() + interval '90 days' then
    raise exception 'Data muito distante';
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

  if (
    select count(*) from public.agendamentos a
    where a.loja_id = p_loja_id
      and a.status = 'confirmado'
      and a.data_horario > now()
      and regexp_replace(a.cliente_telefone, '\D', '', 'g') = v_tel
  ) >= 3 then
    raise exception 'Limite de 3 agendamentos ativos por telefone atingido';
  end if;

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
    (p_loja_id, p_profissional_id, p_item_id, trim(p_nome), v_tel, p_data_horario, v_dur, 'confirmado')
  returning id into v_id;

  return v_id;
end;
$$;
revoke all on function public.criar_agendamento(uuid, uuid, uuid, text, text, timestamptz) from public;
grant execute on function public.criar_agendamento(uuid, uuid, uuid, text, text, timestamptz) to anon, authenticated;

notify pgrst, 'reload schema';

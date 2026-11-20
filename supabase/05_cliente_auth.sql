-- =====================================================================
-- ConectaLocal · parte 5: autenticação e conta do freguês (cliente final)
-- Rode DEPOIS dos scripts anteriores (seguranca.sql, 02_melhorias.sql, 03_hardening.sql, 04_personalizacao.sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Tabela de clientes (perfil público + dados sensíveis)
--    Vinculada ao auth.users via id (uuid). Um cliente = um auth.user.
-- ---------------------------------------------------------------------
create table if not exists public.clientes (
  id uuid primary key references auth.users(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null,
  telefone text not null,              -- normalizado (só dígitos)
  email text,                          -- opcional (magic link usa email do auth)
  avatar_url text,                     -- URL de imagem (https)
  data_nascimento date,
  preferencias jsonb not null default '{}'::jsonb,  -- ex: {"notificacoes": true, "tema": "claro"}
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Índice para buscas por loja/telefone (login via WhatsApp)
create index if not exists clientes_loja_telefone_idx on public.clientes (loja_id, telefone);

-- ---------------------------------------------------------------------
-- 2) Endereços salvos do cliente
-- ---------------------------------------------------------------------
create table if not exists public.enderecos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  apelido text not null,               -- "Casa", "Trabalho", "Mãe"
  logradouro text not null,
  numero text not null,
  complemento text,
  bairro text not null,
  cidade text not null,
  uf char(2) not null,
  cep text not null,                   -- só dígitos
  referencia text,                     -- "Portão azul, apto 302"
  padrao boolean not null default false,
  criado_em timestamptz not null default now()
);

create index if not exists enderecos_cliente_idx on public.enderecos (cliente_id);

-- ---------------------------------------------------------------------
-- 3) Pedidos (histórico do cliente) — espelha o que vai no WhatsApp
-- ---------------------------------------------------------------------
create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  itens jsonb not null,                -- [{item_id, nome, opcao, preco, quantidade, duracao_minutos}]
  subtotal numeric(10,2) not null,
  desconto numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  cupom_codigo text,
  cupom_desconto_pct integer,
  endereco_entrega jsonb,              -- snapshot do endereço usado
  taxa_entrega numeric(10,2) not null default 0,
  status text not null default 'enviado_whatsapp', -- enviado_whatsapp, confirmado, preparando, pronto, entregue, cancelado
  observacoes text,
  whatsapp_message_id text,            -- ID da mensagem no WhatsApp (se usar API oficial)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists pedidos_cliente_idx on public.pedidos (cliente_id, criado_em desc);
create index if not exists pedidos_loja_idx on public.pedidos (loja_id, criado_em desc);

-- ---------------------------------------------------------------------
-- 4) Fidelidade (pontos / cashback)
-- ---------------------------------------------------------------------
create table if not exists public.fidelidade (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  pontos_atual integer not null default 0,
  total_acumulado integer not null default 0,
  total_resgatado integer not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (loja_id, cliente_id)
);

create index if not exists fidelidade_cliente_idx on public.fidelidade (cliente_id);

-- Movimentações de pontos (auditoria)
create table if not exists public.fidelidade_movimentacoes (
  id uuid primary key default gen_random_uuid(),
  fidelidade_id uuid not null references public.fidelidade(id) on delete cascade,
  tipo text not null check (tipo in ('ganho', 'resgate', 'expiracao', 'ajuste')),
  pontos integer not null,             -- positivo para ganho, negativo para resgate/expiração
  descricao text not null,
  pedido_id uuid references public.pedidos(id) on delete set null,
  criado_em timestamptz not null default now()
);

create index if not exists fidelidade_mov_fidelidade_idx on public.fidelidade_movimentacoes (fidelidade_id, criado_em desc);

-- ---------------------------------------------------------------------
-- 5) Favoritos (itens salvos para reordenar rápido)
-- ---------------------------------------------------------------------
create table if not exists public.favoritos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id) on delete cascade,
  item_id uuid not null references public.itens(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (cliente_id, item_id)
);

create index if not exists favoritos_cliente_idx on public.favoritos (cliente_id);

-- ---------------------------------------------------------------------
-- 6) RLS (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.clientes enable row level security;
alter table public.enderecos enable row level security;
alter table public.pedidos enable row level security;
alter table public.fidelidade enable row level security;
alter table public.fidelidade_movimentacoes enable row level security;
alter table public.favoritos enable row level security;

-- Clientes: o próprio cliente lê/escreve SEU perfil; o dono da loja lê clientes da SUA loja
drop policy if exists clientes_proprio on public.clientes;
drop policy if exists clientes_dono_loja on public.clientes;
create policy clientes_proprio on public.clientes
  for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy clientes_dono_loja on public.clientes
  for select to authenticated
  using (exists (select 1 from public.lojas l where l.id = loja_id and l.dono_id = auth.uid()));

-- Endereços: só o próprio cliente
drop policy if exists enderecos_proprio on public.enderecos;
create policy enderecos_proprio on public.enderecos
  for all to authenticated
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

-- Pedidos: cliente vê os seus; dono da loja vê os da sua loja
drop policy if exists pedidos_proprio on public.pedidos;
drop policy if exists pedidos_dono_loja on public.pedidos;
create policy pedidos_proprio on public.pedidos
  for select to authenticated
  using (cliente_id = auth.uid());
create policy pedidos_dono_loja on public.pedidos
  for all to authenticated
  using (exists (select 1 from public.lojas l where l.id = loja_id and l.dono_id = auth.uid()))
  with check (exists (select 1 from public.lojas l where l.id = loja_id and l.dono_id = auth.uid()));

-- Fidelidade: cliente vê a sua; dono da loja gerencia a da sua loja
drop policy if exists fidelidade_proprio on public.fidelidade;
drop policy if exists fidelidade_dono_loja on public.fidelidade;
create policy fidelidade_proprio on public.fidelidade
  for select to authenticated
  using (cliente_id = auth.uid());
create policy fidelidade_dono_loja on public.fidelidade
  for all to authenticated
  using (exists (select 1 from public.lojas l where l.id = loja_id and l.dono_id = auth.uid()))
  with check (exists (select 1 from public.lojas l where l.id = loja_id and l.dono_id = auth.uid()));

drop policy if exists fidelidade_mov_proprio on public.fidelidade_movimentacoes;
create policy fidelidade_mov_proprio on public.fidelidade_movimentacoes
  for select to authenticated
  using (exists (select 1 from public.fidelidade f where f.id = fidelidade_id and f.cliente_id = auth.uid()));

-- Favoritos: só o próprio cliente
drop policy if exists favoritos_proprio on public.favoritos;
create policy favoritos_proprio on public.favoritos
  for all to authenticated
  using (cliente_id = auth.uid()) with check (cliente_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7) Funções RPC para o frontend
-- ---------------------------------------------------------------------

-- 7.1) Criar/atualizar perfil do cliente ao fazer login (chamado pelo trigger de auth)
create or replace function public.handle_new_cliente()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_telefone text := regexp_replace(coalesce(new.raw_user_meta_data->>'telefone', ''), '\D', '', 'g');
  v_nome text := trim(coalesce(new.raw_user_meta_data->>'nome', ''));
  v_slug text := lower(trim(coalesce(new.raw_user_meta_data->>'slug', '')));
begin
  -- Se não veio slug/loja, não faz nada (outro tipo de cadastro)
  if v_slug = '' then
    return new;
  end if;

  select id into v_loja_id from public.lojas where slug = v_slug;
  if not found then
    raise exception 'Loja não encontrada para o slug informado';
  end if;

  -- Cria ou atualiza o perfil do cliente
  insert into public.clientes (id, loja_id, nome, telefone, email)
  values (new.id, v_loja_id, v_nome, v_telefone, new.email)
  on conflict (id) do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    email = excluded.email,
    atualizado_em = now();

  -- Cria registro de fidelidade se não existir
  insert into public.fidelidade (loja_id, cliente_id, pontos_atual, total_acumulado, total_resgatado)
  values (v_loja_id, new.id, 0, 0, 0)
  on conflict (loja_id, cliente_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_cliente on auth.users;
create trigger on_auth_user_created_cliente
  after insert on auth.users
  for each row execute function public.handle_new_cliente();

-- 7.2) Login via Magic Link (email) — o frontend chama supabase.auth.signInWithOtp({email})
--      O Supabase cuida do envio; esta função só garante que o perfil exista.
create or replace function public.ensure_cliente_profile(p_loja_slug text, p_nome text, p_telefone text)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_tel text := regexp_replace(coalesce(p_telefone, ''), '\D', '', 'g');
begin
  if v_cliente_id is null then
    raise exception 'Usuário não autenticado';
  end if;
  if v_tel = '' then
    raise exception 'Telefone é obrigatório';
  end if;

  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then
    raise exception 'Loja não encontrada';
  end if;

  insert into public.clientes (id, loja_id, nome, telefone, email)
  values (v_cliente_id, v_loja_id, trim(p_nome), v_tel, (select email from auth.users where id = v_cliente_id))
  on conflict (id) do update set
    nome = excluded.nome,
    telefone = excluded.telefone,
    loja_id = excluded.loja_id,
    atualizado_em = now();

  insert into public.fidelidade (loja_id, cliente_id, pontos_atual, total_acumulado, total_resgatado)
  values (v_loja_id, v_cliente_id, 0, 0, 0)
  on conflict (loja_id, cliente_id) do nothing;

  return v_cliente_id;
end;
$$;
revoke all on function public.ensure_cliente_profile(text, text, text) from public;
grant execute on function public.ensure_cliente_profile(text, text, text) to authenticated;

-- 7.3) Buscar perfil do cliente logado (para a vitrine)
create or replace function public.get_meu_perfil(p_loja_slug text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_cliente_id is null then
    return null;
  end if;

  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'telefone', c.telefone,
    'email', c.email,
    'avatar_url', c.avatar_url,
    'data_nascimento', c.data_nascimento,
    'preferencias', c.preferencias,
    'criado_em', c.criado_em,
    'fidelidade', jsonb_build_object(
      'pontos_atual', f.pontos_atual,
      'total_acumulado', f.total_acumulado,
      'total_resgatado', f.total_resgatado
    ),
    'enderecos', (
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'apelido', e.apelido,
        'logradouro', e.logradouro,
        'numero', e.numero,
        'complemento', e.complemento,
        'bairro', e.bairro,
        'cidade', e.cidade,
        'uf', e.uf,
        'cep', e.cep,
        'referencia', e.referencia,
        'padrao', e.padrao
      ) order by e.padrao desc, e.criado_em)
      from public.enderecos e where e.cliente_id = c.id
    )
  ) into v_result
  from public.clientes c
  left join public.fidelidade f on f.cliente_id = c.id and f.loja_id = v_loja_id
  where c.id = v_cliente_id and c.loja_id = v_loja_id;

  return v_result;
end;
$$;
revoke all on function public.get_meu_perfil(text) from public;
grant execute on function public.get_meu_perfil(text) to authenticated;

-- 7.4) Atualizar perfil do cliente
create or replace function public.atualizar_meu_perfil(
  p_loja_slug text,
  p_nome text default null,
  p_telefone text default null,
  p_avatar_url text default null,
  p_data_nascimento date default null,
  p_preferencias jsonb default null
)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_updates text := '';
  v_result jsonb;
begin
  if v_cliente_id is null then
    raise exception 'Usuário não autenticado';
  end if;

  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then
    raise exception 'Loja não encontrada';
  end if;

  update public.clientes set
    nome = coalesce(p_nome, nome),
    telefone = case when p_telefone is not null then regexp_replace(p_telefone, '\D', '', 'g') else telefone end,
    avatar_url = case when p_avatar_url is not null then p_avatar_url else avatar_url end,
    data_nascimento = coalesce(p_data_nascimento, data_nascimento),
    preferencias = coalesce(p_preferencias, preferencias),
    atualizado_em = now()
  where id = v_cliente_id and loja_id = v_loja_id;

  if not found then
    raise exception 'Perfil não encontrado';
  end if;

  return public.get_meu_perfil(p_loja_slug);
end;
$$;
revoke all on function public.atualizar_meu_perfil(text, text, text, text, date, jsonb) from public;
grant execute on function public.atualizar_meu_perfil(text, text, text, text, date, jsonb) to authenticated;

-- 7.5) CRUD Endereços
create or replace function public.adicionar_endereco(
  p_loja_slug text,
  p_apelido text,
  p_logradouro text,
  p_numero text,
  p_bairro text,
  p_cidade text,
  p_uf char(2),
  p_cep text,
  p_complemento text default null,
  p_referencia text default null,
  p_padrao boolean default false
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_endereco_id uuid;
begin
  if v_cliente_id is null then raise exception 'Usuário não autenticado'; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then raise exception 'Loja não encontrada'; end if;

  -- Se vai ser padrão, remove padrão dos outros
  if p_padrao then
    update public.enderecos set padrao = false where cliente_id = v_cliente_id;
  end if;

  insert into public.enderecos (cliente_id, apelido, logradouro, numero, complemento, bairro, cidade, uf, cep, referencia, padrao)
  values (v_cliente_id, p_apelido, p_logradouro, p_numero, p_complemento, p_bairro, p_cidade, p_uf, regexp_replace(p_cep, '\D', '', 'g'), p_referencia, p_padrao)
  returning id into v_endereco_id;

  return v_endereco_id;
end;
$$;
revoke all on function public.adicionar_endereco(text, text, text, text, text, text, char, text, text, text, boolean) from public;
grant execute on function public.adicionar_endereco(text, text, text, text, text, text, char, text, text, text, boolean) to authenticated;

create or replace function public.atualizar_endereco(
  p_endereco_id uuid,
  p_apelido text default null,
  p_logradouro text default null,
  p_numero text default null,
  p_complemento text default null,
  p_bairro text default null,
  p_cidade text default null,
  p_uf char(2) default null,
  p_cep text default null,
  p_referencia text default null,
  p_padrao boolean default null
)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_cliente_id uuid := auth.uid();
begin
  if v_cliente_id is null then raise exception 'Usuário não autenticado'; end if;

  if p_padrao then
    update public.enderecos set padrao = false where cliente_id = v_cliente_id;
  end if;

  update public.enderecos set
    apelido = coalesce(p_apelido, apelido),
    logradouro = coalesce(p_logradouro, logradouro),
    numero = coalesce(p_numero, numero),
    complemento = coalesce(p_complemento, complemento),
    bairro = coalesce(p_bairro, bairro),
    cidade = coalesce(p_cidade, cidade),
    uf = coalesce(p_uf, uf),
    cep = case when p_cep is not null then regexp_replace(p_cep, '\D', '', 'g') else cep end,
    referencia = coalesce(p_referencia, referencia),
    padrao = coalesce(p_padrao, padrao)
  where id = p_endereco_id and cliente_id = v_cliente_id;

  if not found then raise exception 'Endereço não encontrado'; end if;
end;
$$;
revoke all on function public.atualizar_endereco(uuid, text, text, text, text, text, text, char, text, text, boolean) from public;
grant execute on function public.atualizar_endereco(uuid, text, text, text, text, text, text, char, text, text, boolean) to authenticated;

create or replace function public.remover_endereco(p_endereco_id uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  v_cliente_id uuid := auth.uid();
begin
  if v_cliente_id is null then raise exception 'Usuário não autenticado'; end if;
  delete from public.enderecos where id = p_endereco_id and cliente_id = v_cliente_id;
  if not found then raise exception 'Endereço não encontrado'; end if;
end;
$$;
revoke all on function public.remover_endereco(uuid) from public;
grant execute on function public.remover_endereco(uuid) to authenticated;

-- 7.6) CRUD Favoritos
create or replace function public.toggle_favorito(p_loja_slug text, p_item_id uuid)
returns boolean
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_exists boolean;
begin
  if v_cliente_id is null then raise exception 'Usuário não autenticado'; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then raise exception 'Loja não encontrada'; end if;

  -- Verifica se o item pertence à loja
  if not exists (select 1 from public.itens where id = p_item_id and loja_id = v_loja_id) then
    raise exception 'Item não encontrado nesta loja';
  end if;

  select exists(select 1 from public.favoritos where cliente_id = v_cliente_id and item_id = p_item_id) into v_exists;

  if v_exists then
    delete from public.favoritos where cliente_id = v_cliente_id and item_id = p_item_id;
    return false; -- removido
  else
    insert into public.favoritos (cliente_id, item_id) values (v_cliente_id, p_item_id);
    return true; -- adicionado
  end if;
end;
$$;
revoke all on function public.toggle_favorito(text, uuid) from public;
grant execute on function public.toggle_favorito(text, uuid) to authenticated;

create or replace function public.listar_favoritos(p_loja_slug text)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_cliente_id is null then return '[]'::jsonb; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then return '[]'::jsonb; end if;

  select jsonb_agg(jsonb_build_object(
    'id', i.id,
    'nome', i.nome,
    'descricao', i.descricao,
    'preco', i.preco,
    'duracao_minutos', i.duracao_minutos,
    'tag', i.tag,
    'categoria_id', i.categoria_id,
    'favorito_em', f.criado_em
  ) order by f.criado_em desc) into v_result
  from public.favoritos f
  join public.itens i on i.id = f.item_id
  where f.cliente_id = v_cliente_id and i.loja_id = v_loja_id;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;
revoke all on function public.listar_favoritos(text) from public;
grant execute on function public.listar_favoritos(text) to authenticated;

-- 7.7) Registrar pedido (chamado ao finalizar no WhatsApp)
create or replace function public.registrar_pedido(
  p_loja_slug text,
  p_itens jsonb,
  p_subtotal numeric,
  p_desconto numeric,
  p_total numeric,
  p_cupom_codigo text default null,
  p_cupom_desconto_pct integer default null,
  p_endereco_entrega jsonb default null,
  p_taxa_entrega numeric default 0,
  p_observacoes text default null
)
returns uuid
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_pedido_id uuid;
  v_fidelidade_id uuid;
  v_pontos_ganhos integer;
begin
  if v_cliente_id is null then raise exception 'Usuário não autenticado'; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then raise exception 'Loja não encontrada'; end if;

  insert into public.pedidos (loja_id, cliente_id, itens, subtotal, desconto, total, cupom_codigo, cupom_desconto_pct, endereco_entrega, taxa_entrega, observacoes, status)
  values (v_loja_id, v_cliente_id, p_itens, p_subtotal, p_desconto, p_total, p_cupom_codigo, p_cupom_desconto_pct, p_endereco_entrega, p_taxa_entrega, p_observacoes, 'enviado_whatsapp')
  returning id into v_pedido_id;

  -- Fidelidade: 1 ponto por R$ 1 gasto (configurável depois)
  v_pontos_ganhos := floor(p_total)::integer;
  if v_pontos_ganhos > 0 then
    select id into v_fidelidade_id from public.fidelidade where loja_id = v_loja_id and cliente_id = v_cliente_id;
    if found then
      update public.fidelidade set
        pontos_atual = pontos_atual + v_pontos_ganhos,
        total_acumulado = total_acumulado + v_pontos_ganhos,
        atualizado_em = now()
      where id = v_fidelidade_id;

      insert into public.fidelidade_movimentacoes (fidelidade_id, tipo, pontos, descricao, pedido_id)
      values (v_fidelidade_id, 'ganho', v_pontos_ganhos, 'Pedido #' || substr(v_pedido_id::text, 1, 8), v_pedido_id);
    end if;
  end if;

  return v_pedido_id;
end;
$$;
revoke all on function public.registrar_pedido(text, jsonb, numeric, numeric, numeric, text, integer, jsonb, numeric, text) from public;
grant execute on function public.registrar_pedido(text, jsonb, numeric, numeric, numeric, text, integer, jsonb, numeric, text) to authenticated;

-- 7.8) Listar pedidos do cliente
create or replace function public.listar_meus_pedidos(p_loja_slug text, p_limite integer default 20, p_offset integer default 0)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_cliente_id is null then return '[]'::jsonb; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then return '[]'::jsonb; end if;

  select jsonb_agg(jsonb_build_object(
    'id', p.id,
    'itens', p.itens,
    'subtotal', p.subtotal,
    'desconto', p.desconto,
    'total', p.total,
    'cupom_codigo', p.cupom_codigo,
    'cupom_desconto_pct', p.cupom_desconto_pct,
    'endereco_entrega', p.endereco_entrega,
    'taxa_entrega', p.taxa_entrega,
    'status', p.status,
    'observacoes', p.observacoes,
    'criado_em', p.criado_em,
    'atualizado_em', p.atualizado_em
  ) order by p.criado_em desc) into v_result
  from public.pedidos p
  where p.cliente_id = v_cliente_id and p.loja_id = v_loja_id
  limit p_limite offset p_offset;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;
revoke all on function public.listar_meus_pedidos(text, integer, integer) from public;
grant execute on function public.listar_meus_pedidos(text, integer, integer) to authenticated;

-- 7.8b) Listar pedidos da loja (para painel admin/lojista)
create or replace function public.listar_pedidos_loja(p_loja_slug text, p_limite integer default 50, p_offset integer default 0, p_status text default null)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_dono_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_dono_id is null then return '[]'::jsonb; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug and dono_id = v_dono_id;
  if not found then return '[]'::jsonb; end if;

  select jsonb_agg(jsonb_build_object(
    'id', p.id,
    'cliente_id', p.cliente_id,
    'cliente_nome', c.nome,
    'cliente_telefone', c.telefone,
    'itens', p.itens,
    'subtotal', p.subtotal,
    'desconto', p.desconto,
    'total', p.total,
    'cupom_codigo', p.cupom_codigo,
    'cupom_desconto_pct', p.cupom_desconto_pct,
    'endereco_entrega', p.endereco_entrega,
    'taxa_entrega', p.taxa_entrega,
    'status', p.status,
    'observacoes', p.observacoes,
    'criado_em', p.criado_em,
    'atualizado_em', p.atualizado_em
  ) order by p.criado_em desc) into v_result
  from public.pedidos p
  join public.clientes c on c.id = p.cliente_id
  where p.loja_id = v_loja_id
    and (p_status is null or p.status = p_status)
  limit p_limite offset p_offset;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;
revoke all on function public.listar_pedidos_loja(text, integer, integer, text) from public;
grant execute on function public.listar_pedidos_loja(text, integer, integer, text) to authenticated;

-- 7.9) Resgatar pontos (cupom de fidelidade)
create or replace function public.resgatar_pontos_fidelidade(p_loja_slug text, p_pontos integer)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_fidelidade public.fidelidade%rowtype;
  v_codigo_cupom text := 'FIDEL' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
  v_desconto_pct integer;
begin
  if v_cliente_id is null then raise exception 'Usuário não autenticado'; end if;
  if p_pontos <= 0 then raise exception 'Pontos inválidos'; end if;

  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then raise exception 'Loja não encontrada'; end if;

  select * into v_fidelidade from public.fidelidade where loja_id = v_loja_id and cliente_id = v_cliente_id;
  if not found then raise exception 'Fidelidade não encontrada'; end if;

  if v_fidelidade.pontos_atual < p_pontos then
    raise exception 'Pontos insuficientes';
  end if;

  -- Regra: 100 pontos = 10% desconto (máx 50%)
  v_desconto_pct := least(50, (p_pontos / 100) * 10);

  update public.fidelidade set
    pontos_atual = pontos_atual - p_pontos,
    total_resgatado = total_resgatado + p_pontos,
    atualizado_em = now()
  where id = v_fidelidade.id;

  insert into public.fidelidade_movimentacoes (fidelidade_id, tipo, pontos, descricao)
  values (v_fidelidade.id, 'resgate', -p_pontos, 'Resgate de ' || p_pontos || ' pontos por cupom ' || v_codigo_cupom || ' (' || v_desconto_pct || '% OFF)');

  -- Cria cupom temporário (válido por 30 dias, uso único)
  insert into public.cupons (loja_id, codigo, desconto_percentual, ativo, uso_maximo, uso_atual, expira_em)
  values (v_loja_id, v_codigo_cupom, v_desconto_pct, true, 1, 0, now() + interval '30 days')
  on conflict (loja_id, upper(codigo)) do nothing; -- se colidir, tenta de novo (raro)

  return jsonb_build_object(
    'cupom_codigo', v_codigo_cupom,
    'desconto_percentual', v_desconto_pct,
    'pontos_usados', p_pontos,
    'pontos_restantes', v_fidelidade.pontos_atual - p_pontos,
    'expira_em', (now() + interval '30 days')::text
  );
end;
$$;
revoke all on function public.resgatar_pontos_fidelidade(text, integer) from public;
grant execute on function public.resgatar_pontos_fidelidade(text, integer) to authenticated;

-- 7.10) Movimentações de fidelidade (histórico)
create or replace function public.listar_fidelidade_movimentacoes(p_loja_slug text, p_limite integer default 50)
returns jsonb
language plpgsql security definer
set search_path = public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_fidelidade_id uuid;
  v_result jsonb;
begin
  if v_cliente_id is null then return '[]'::jsonb; end if;
  select id into v_loja_id from public.lojas where slug = p_loja_slug;
  if not found then return '[]'::jsonb; end if;

  select id into v_fidelidade_id from public.fidelidade where loja_id = v_loja_id and cliente_id = v_cliente_id;
  if not found then return '[]'::jsonb; end if;

  select jsonb_agg(jsonb_build_object(
    'id', m.id,
    'tipo', m.tipo,
    'pontos', m.pontos,
    'descricao', m.descricao,
    'pedido_id', m.pedido_id,
    'criado_em', m.criado_em
  ) order by m.criado_em desc) into v_result
  from public.fidelidade_movimentacoes m
  where m.fidelidade_id = v_fidelidade_id
  limit p_limite;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;
revoke all on function public.listar_fidelidade_movimentacoes(text, integer) from public;
grant execute on function public.listar_fidelidade_movimentacoes(text, integer) to authenticated;

notify pgrst, 'reload schema';
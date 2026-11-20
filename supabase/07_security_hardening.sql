-- ConectaLocal: validação server-side de pedidos, cupons e slugs.
-- Rode depois de supabase/06_storage_imagens.sql.

alter table public.cupons
  add column if not exists expira_em timestamptz,
  add column if not exists uso_maximo integer,
  add column if not exists uso_atual integer not null default 0;

do $$
declare
  v_slugs_duplicados text;
begin
  select string_agg(d.slug, ', ' order by d.slug)
    into v_slugs_duplicados
  from (
    select lower(slug) as slug
    from public.lojas
    group by lower(slug)
    having count(*) > 1
  ) d;

  if v_slugs_duplicados is not null then
    raise exception 'Slugs duplicados (ignorando maiúsculas/minúsculas): %. Resolva-os antes de aplicar esta migração.',
      v_slugs_duplicados;
  end if;
end;
$$;

create unique index if not exists lojas_slug_case_insensitive_uk
  on public.lojas (lower(slug));

create or replace function public.slug_disponivel(p_slug text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    length(lower(btrim(coalesce(p_slug, '')))) between 3 and 40
    and lower(btrim(coalesce(p_slug, ''))) ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    and lower(btrim(coalesce(p_slug, ''))) <> all (array[
      'admin','login','api','www','app','painel','cadastro','suporte','ajuda','termos',
      'privacidade','raizes','doceria-ana','conectalocal','contato','precos','planos','blog',
      'status','dashboard','conta','entrar','sair','pagamento','assinatura'
    ])
    and not exists (
      select 1
      from public.lojas l
      where lower(l.slug) = lower(btrim(coalesce(p_slug, '')))
    );
$$;
revoke all on function public.slug_disponivel(text) from public;
grant execute on function public.slug_disponivel(text) to anon, authenticated;

create or replace function public.validar_cupom(p_loja_id uuid, p_codigo text)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select c.desconto_percentual::integer
  from public.cupons c
  where c.loja_id = p_loja_id
    and c.ativo
    and upper(c.codigo) = upper(btrim(p_codigo))
    and (c.expira_em is null or c.expira_em > now())
    and (c.uso_maximo is null or coalesce(c.uso_atual, 0) < c.uso_maximo)
    and c.desconto_percentual between 1 and 100
  limit 1;
$$;
revoke all on function public.validar_cupom(uuid, text) from public;
grant execute on function public.validar_cupom(uuid, text) to anon, authenticated;

-- Os valores monetários recebidos do navegador são mantidos na assinatura por
-- compatibilidade, mas o pedido é sempre calculado com os preços atuais do banco.
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
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_loja_id uuid;
  v_cliente_id uuid := auth.uid();
  v_pedido_id uuid;
  v_entrada jsonb;
  v_item_id uuid;
  v_item public.itens%rowtype;
  v_item_json jsonb;
  v_opcoes jsonb;
  v_opcao_json jsonb;
  v_opcao text;
  v_preco numeric;
  v_quantidade numeric;
  v_quantidade_int integer;
  v_subtotal numeric := 0;
  v_desconto numeric := 0;
  v_total numeric;
  v_taxa_entrega numeric := 0;
  v_codigo_cupom text := nullif(upper(btrim(p_cupom_codigo)), '');
  v_cupom_pct integer;
  v_itens jsonb := '[]'::jsonb;
  v_contagem integer;
begin
  if v_cliente_id is null then
    raise exception using errcode = '42501', message = 'Usuário não autenticado';
  end if;
  if p_loja_slug is null or btrim(p_loja_slug) = '' then
    raise exception using errcode = '22023', message = 'Loja inválida';
  end if;
  if jsonb_typeof(p_itens) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'Itens do pedido inválidos';
  end if;

  v_contagem := jsonb_array_length(p_itens);
  if v_contagem < 1 or v_contagem > 50 then
    raise exception using errcode = '22023', message = 'O pedido deve conter de 1 a 50 itens';
  end if;
  if coalesce(p_taxa_entrega, 0) <> 0 then
    raise exception using errcode = '22023', message = 'A taxa de entrega deve ser calculada pelo servidor';
  end if;
  if p_endereco_entrega is not null
     and jsonb_typeof(p_endereco_entrega) is distinct from 'object' then
    raise exception using errcode = '22023', message = 'Endereço de entrega inválido';
  end if;
  if p_endereco_entrega is not null and octet_length(p_endereco_entrega::text) > 10000 then
    raise exception using errcode = '22023', message = 'Endereço de entrega muito grande';
  end if;
  if p_observacoes is not null and length(p_observacoes) > 1000 then
    raise exception using errcode = '22023', message = 'Observações muito longas';
  end if;

  select l.id
    into v_loja_id
  from public.lojas l
  where lower(l.slug) = lower(btrim(p_loja_slug));
  if not found then
    raise exception using errcode = '22023', message = 'Loja não encontrada';
  end if;

  if not exists (
    select 1
    from public.clientes c
    where c.id = v_cliente_id
      and c.loja_id = v_loja_id
  ) then
    raise exception using errcode = '42501', message = 'Perfil de cliente não pertence a esta loja';
  end if;

  for v_entrada in
    select elemento.value
    from jsonb_array_elements(p_itens) as elemento(value)
  loop
    if jsonb_typeof(v_entrada) is distinct from 'object' then
      raise exception using errcode = '22023', message = 'Item do pedido inválido';
    end if;

    begin
      v_item_id := nullif(v_entrada->>'item_id', '')::uuid;
      v_quantidade := nullif(v_entrada->>'quantidade', '')::numeric;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'Identificador ou quantidade inválida';
    end;

    if v_item_id is null then
      raise exception using errcode = '22023', message = 'Identificador do item obrigatório';
    end if;
    if v_quantidade is null
       or v_quantidade <> trunc(v_quantidade)
       or v_quantidade < 1
       or v_quantidade > 20 then
      raise exception using errcode = '22023', message = 'A quantidade deve ser um inteiro entre 1 e 20';
    end if;
    v_quantidade_int := v_quantidade::integer;

    select i.*
      into v_item
    from public.itens i
    where i.id = v_item_id
      and i.loja_id = v_loja_id
    for share;
    if not found then
      raise exception using errcode = '22023', message = 'Item não encontrado nesta loja';
    end if;

    v_item_json := to_jsonb(v_item);
    v_opcoes := v_item_json->'opcoes';
    v_opcao := nullif(btrim(v_entrada->>'opcao'), '');
    v_preco := v_item.preco;

    if v_opcoes is not null and v_opcoes <> 'null'::jsonb then
      if jsonb_typeof(v_opcoes) is distinct from 'array' then
        raise exception using errcode = '22023', message = 'Opções do item inválidas';
      end if;
      if jsonb_array_length(v_opcoes) > 0 then
        if v_opcao is null then
          raise exception using errcode = '22023', message = 'Selecione uma opção para este item';
        end if;
        select opcao.value
          into v_opcao_json
        from jsonb_array_elements(v_opcoes) as opcao(value)
        where opcao.value->>'label' = v_opcao
        limit 1;
        if not found then
          raise exception using errcode = '22023', message = 'Opção não encontrada para este item';
        end if;
        v_preco := nullif(v_opcao_json->>'preco', '')::numeric;
      elsif v_opcao is not null then
        raise exception using errcode = '22023', message = 'Este item não possui opções';
      end if;
    elsif v_opcao is not null then
      raise exception using errcode = '22023', message = 'Este item não possui opções';
    end if;

    if v_preco is null or v_preco < 0 or v_preco > 99999999.99 then
      raise exception using errcode = '22023', message = 'Preço do item inválido';
    end if;

    v_subtotal := v_subtotal + round(v_preco * v_quantidade_int, 2);
    if v_subtotal > 99999999.99 then
      raise exception using errcode = '22003', message = 'Total do pedido excede o limite permitido';
    end if;

    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'item_id', v_item.id,
      'nome', v_item.nome,
      'opcao', v_opcao,
      'preco', v_preco,
      'quantidade', v_quantidade_int,
      'duracao_minutos', coalesce(nullif(v_item_json->>'duracao_minutos', '')::integer, 30)
    ));
  end loop;

  v_subtotal := round(v_subtotal, 2);
  if v_codigo_cupom is not null then
    update public.cupons c
      set uso_atual = coalesce(c.uso_atual, 0) + 1
    where c.loja_id = v_loja_id
      and upper(c.codigo) = v_codigo_cupom
      and c.ativo
      and (c.expira_em is null or c.expira_em > now())
      and (c.uso_maximo is null or coalesce(c.uso_atual, 0) < c.uso_maximo)
      and c.desconto_percentual between 1 and 100
    returning c.codigo, c.desconto_percentual::integer
      into v_codigo_cupom, v_cupom_pct;

    if not found then
      raise exception using errcode = '22023', message = 'Cupom inválido, expirado ou sem usos disponíveis';
    end if;
    v_desconto := round(v_subtotal * v_cupom_pct / 100, 2);
  end if;

  v_total := v_subtotal - v_desconto + v_taxa_entrega;
  insert into public.pedidos (
    loja_id, cliente_id, itens, subtotal, desconto, total, cupom_codigo,
    cupom_desconto_pct, endereco_entrega, taxa_entrega, observacoes, status
  )
  values (
    v_loja_id, v_cliente_id, v_itens, v_subtotal, v_desconto, v_total,
    v_codigo_cupom, v_cupom_pct, p_endereco_entrega, v_taxa_entrega,
    p_observacoes, 'enviado_whatsapp'
  )
  returning id into v_pedido_id;

  return v_pedido_id;
end;
$$;
revoke all on function public.registrar_pedido(text, jsonb, numeric, numeric, numeric, text, integer, jsonb, numeric, text) from public;
grant execute on function public.registrar_pedido(text, jsonb, numeric, numeric, numeric, text, integer, jsonb, numeric, text) to authenticated;

-- Pontos só são concedidos quando o lojista marca o pedido como entregue.
create unique index if not exists fidelidade_pedido_ganho_unico
  on public.fidelidade_movimentacoes (pedido_id)
  where pedido_id is not null and tipo = 'ganho';

create or replace function public.creditar_pontos_pedido_entregue()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_pontos integer;
  v_fidelidade_id uuid;
  v_movimentacao_id uuid;
begin
  if old.status is not distinct from new.status or new.status <> 'entregue' then
    return new;
  end if;

  if auth.uid() is null or not exists (
    select 1
    from public.lojas l
    where l.id = new.loja_id
      and l.dono_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'Somente o lojista pode confirmar a entrega';
  end if;

  v_pontos := floor(new.total)::integer;
  if v_pontos <= 0 then
    return new;
  end if;

  insert into public.fidelidade (loja_id, cliente_id, pontos_atual, total_acumulado, total_resgatado)
  values (new.loja_id, new.cliente_id, 0, 0, 0)
  on conflict (loja_id, cliente_id) do nothing;

  select f.id
    into v_fidelidade_id
  from public.fidelidade f
  where f.loja_id = new.loja_id
    and f.cliente_id = new.cliente_id
  for update;

  insert into public.fidelidade_movimentacoes (fidelidade_id, tipo, pontos, descricao, pedido_id)
  values (
    v_fidelidade_id,
    'ganho',
    v_pontos,
    'Pedido #' || substr(new.id::text, 1, 8),
    new.id
  )
  on conflict (pedido_id) where pedido_id is not null and tipo = 'ganho'
  do nothing
  returning id into v_movimentacao_id;

  if v_movimentacao_id is null then
    return new;
  end if;

  update public.fidelidade
  set pontos_atual = pontos_atual + v_pontos,
      total_acumulado = total_acumulado + v_pontos,
      atualizado_em = now()
  where id = v_fidelidade_id;

  return new;
end;
$$;
revoke all on function public.creditar_pontos_pedido_entregue() from public, anon, authenticated;

drop trigger if exists pedidos_creditar_pontos_entregue on public.pedidos;
create trigger pedidos_creditar_pontos_entregue
  after update of status on public.pedidos
  for each row
  when (old.status is distinct from new.status and new.status = 'entregue')
  execute function public.creditar_pontos_pedido_entregue();

create or replace function public.atualizar_status_pedido(p_pedido_id uuid, p_status text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dono_id uuid := auth.uid();
  v_status_atual text;
  v_transicao_permitida boolean;
begin
  if v_dono_id is null then
    raise exception using errcode = '42501', message = 'Usuário não autenticado';
  end if;
  if p_pedido_id is null or p_status is null then
    raise exception using errcode = '22023', message = 'Pedido ou status inválido';
  end if;

  select p.status
    into v_status_atual
  from public.pedidos p
  join public.lojas l on l.id = p.loja_id
  where p.id = p_pedido_id
    and l.dono_id = v_dono_id
  for update of p;
  if not found then
    raise exception using errcode = '42501', message = 'Pedido não encontrado para esta loja';
  end if;
  if v_status_atual = p_status then
    return p_status;
  end if;

  v_transicao_permitida := case v_status_atual
    when 'enviado_whatsapp' then p_status in ('confirmado', 'cancelado')
    when 'confirmado' then p_status in ('preparando', 'cancelado')
    when 'preparando' then p_status in ('pronto', 'cancelado')
    when 'pronto' then p_status in ('entregue', 'cancelado')
    else false
  end;
  if not v_transicao_permitida then
    raise exception using errcode = '22023', message = 'Transição de status inválida';
  end if;

  update public.pedidos
  set status = p_status,
      atualizado_em = now()
  where id = p_pedido_id;

  return p_status;
end;
$$;
revoke all on function public.atualizar_status_pedido(uuid, text) from public;
grant execute on function public.atualizar_status_pedido(uuid, text) to authenticated;

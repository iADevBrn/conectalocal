-- =====================================================================
-- ConectaLocal · parte 4: personalização visual da vitrine
-- Rode depois dos anteriores. Pode rodar mais de uma vez.
-- =====================================================================

-- Todas as escolhas de visual (tema, fonte, capa, textos de apresentação) ficam
-- num único campo JSON. O app higieniza cada valor antes de usar.
alter table public.lojas
  add column if not exists personalizacao jsonb not null default '{}'::jsonb;

-- Limite de tamanho: impede usar o campo para guardar lixo gigante.
alter table public.lojas drop constraint if exists lojas_personalizacao_tamanho;
alter table public.lojas
  add constraint lojas_personalizacao_tamanho check (octet_length(personalizacao::text) <= 4000);

notify pgrst, 'reload schema';

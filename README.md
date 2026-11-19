# ConectaLocal

SaaS multi-loja (cardápio com sacola via WhatsApp e agenda online) feito com React + Vite + Supabase.

## Rodar localmente
```bash
npm install
cp .env.example .env   # preencha com a URL e a chave ANON do Supabase
npm run dev
```

## Banco de dados
No SQL Editor do Supabase, rode NESTA ordem:
1. `supabase/seguranca.sql` (RLS + funções de cupom e agenda)
2. `supabase/02_melhorias.sql` (cadastro atômico da loja, expediente configurável, duração dos serviços)
3. `supabase/03_hardening.sql` (remove políticas antigas inseguras, trava anti-spam, limites)
4. `supabase/04_personalizacao.sql` (coluna com as escolhas visuais da vitrine: tema, fonte, capa, textos)
5. `supabase/05_cliente_auth.sql` (conta e perfil do cliente)
6. `supabase/06_storage_imagens.sql` (bucket e política segura para upload de fotos)

O frontend depende das funções `validar_cupom`, `horarios_ocupados`, `criar_agendamento` e `slug_disponivel`.

## Prévia de links (WhatsApp)
`middleware.js` (Vercel Routing Middleware) devolve título e imagem da loja só para robôs de prévia.
Teste após o deploy: `curl -A "WhatsApp/2.23" https://SEU-DOMINIO/slug-da-loja` deve retornar as tags `og:`.

## Deploy
Vercel. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em Project Settings > Environment Variables.

## Personalização da vitrine
Em **Painel → Aparência** o lojista escolhe paleta/cor da marca, fundo (claro, creme, escuro), fonte, cantos,
estilo ou foto de capa, listagem (grade/lista) e informações (sobre, horário, endereço, mapa, Instagram),
com pré-visualização ao vivo. Tudo é validado em `src/lib/tema.js` antes de chegar ao CSS/HTML
(só valores de listas permitidas, cores `#rrggbb` e links `https`).

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

O frontend depende das funções `validar_cupom`, `horarios_ocupados`, `criar_agendamento` e `slug_disponivel`.

## Prévia de links (WhatsApp)
`middleware.js` (Vercel Routing Middleware) devolve título e imagem da loja só para robôs de prévia.
Teste após o deploy: `curl -A "WhatsApp/2.23" https://SEU-DOMINIO/slug-da-loja` deve retornar as tags `og:`.

## Deploy
Vercel. Defina `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` em Project Settings > Environment Variables.

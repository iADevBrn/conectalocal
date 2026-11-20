# Relatório de Testes - ConectaLocal

**Data:** 2026-11-19
**Versão:** 0.0.0
**Ambiente:** Desenvolvimento (Vite + React 19 + Supabase)

---

## Resumo Executivo

| Categoria | Status | Observações |
|-----------|--------|-------------|
| Build | ✅ PASS | Sem erros de build |
| Lint | ⚠️ Warnings | 6 warnings (não bloqueiam) |
| Schema DB | ⚠️ Parcial | Requer scripts SQL em ordem |
| Fluxo Admin | ⚠️ Funcional* | Dependente de DB correto |
| Fluxo Lojista | ⚠️ Funcional* | Dependente de DB correto |
| Fluxo Cliente | ⚠️ Funcional* | Dependente de DB correto |

> *Os fluxos são implementados corretamente no frontend, mas **requerem o banco de dados Supabase configurado exatamente conforme os scripts SQL** para funcionar.

---

## 1. Verificações Estáticas

### 1.1 Build (Vite)
```
✓ built in 1.50s
dist/index.html                         2.17 kB │ gzip:  0.98 kB
dist/assets/index-G_ni8i8q.js         225.31 kB │ gzip: 71.13 kB
```
**Status: PASS** - Build de produção funciona sem erros.

### 1.2 Lint (oxlint)
```bash
src/context/clienteContext.jsx:247:14 - warning react(only-export-components)
src/context/lojaContext.jsx:265:14 - warning react(only-export-components)
src/pages/painelAdmin.jsx:299:10 - warning eslint(no-unused-vars): 'pedidos'
src/pages/painelAdmin.jsx:300:24 - warning eslint(no-unused-vars): 'setFiltroStatus'
src/pages/painelAdmin.jsx:301:10 - warning eslint(no-unused-vars): 'carregandoPedidos'
src/pages/painelAdmin.jsx:324:5 - warning react(set-state-in-effect)
```
**Status: Warnings apenas** - Não bloqueiam, mas indicam código que pode ser limpo.

---

## 2. Análise do Schema Supabase (CRÍTICO)

### 2.1 Ordem Obrigatória dos Scripts SQL
Os scripts **devem** ser executados **nesta ordem exata** no Supabase SQL Editor:

```
1. seguranca.sql          → Tabelas base + RLS + funções core (criar_agendamento v1, validar_cupom, horarios_ocupados v1)
2. 02_melhorias.sql       → handle_new_user (cadastro atômico), colunas agenda_* em lojas, duracao_minutos em agendamentos, horarios_ocupados v2 (com duração), criar_agendamento v2 (com validações completas)
3. 03_hardening.sql       → Índice único lojas_um_por_dono, slug_disponivel v2 (comprimento 3-40 + mais slugs reservados), handle_new_user v2 (limites + revoke), criar_agendamento v3 (anti-spam 3 agendamentos/tel)
4. 04_personalizacao.sql  → Coluna personalizacao (jsonb) em lojas + constraint tamanho
5. 05_cliente_auth.sql    → Tabelas: clientes, enderecos, pedidos, fidelidade, fidelidade_movimentacoes, favoritos + RLS + 10 funções RPC
```

### 2.2 Tabelas Necessárias
| Tabela | Script | Descrição |
|--------|--------|-----------|
| `lojas` | seguranca.sql | Tabela principal |
| `categorias` | seguranca.sql | Categorias de produtos/serviços |
| `itens` | seguranca.sql | Produtos (catálogo) ou Serviços (agendamento) |
| `profissionais` | seguranca.sql | Equipe para agendamento |
| `cupons` | seguranca.sql | Cupons de desconto |
| `agendamentos` | seguranca.sql + 02_melhorias | Horários marcados |
| `clientes` | 05_cliente_auth.sql | Perfil do cliente final |
| `enderecos` | 05_cliente_auth.sql | Endereços salvos |
| `pedidos` | 05_cliente_auth.sql | Histórico de pedidos |
| `fidelidade` | 05_cliente_auth.sql | Pontos de fidelidade |
| `fidelidade_movimentacoes` | 05_cliente_auth.sql | Auditoria de pontos |
| `favoritos` | 05_cliente_auth.sql | Itens favoritos |

### 2.3 Funções RPC Necessárias (Frontend → Backend)
| Função | Script | Usada Em |
|--------|--------|----------|
| `slug_disponivel` | 02_melhorias → 03_hardening | Cadastro lojista |
| `handle_new_user` | 02_melhorias → 03_hardening | Trigger auth.users |
| `criar_agendamento` | 02_melhorias → 03_hardening | Agenda barbearia |
| `horarios_ocupados` | seguranca → 02_melhorias | Agenda (busca slots) |
| `validar_cupom` | seguranca.sql | Vitrine (aplicar cupom) |
| `ensure_cliente_profile` | 05_cliente_auth.sql | Login cliente (magic link) |
| `get_meu_perfil` | 05_cliente_auth.sql | Minha conta / Vitrine |
| `atualizar_meu_perfil` | 05_cliente_auth.sql | Minha conta |
| `adicionar_endereco` | 05_cliente_auth.sql | Minha conta |
| `atualizar_endereco` | 05_cliente_auth.sql | Minha conta |
| `remover_endereco` | 05_cliente_auth.sql | Minha conta |
| `toggle_favorito` | 05_cliente_auth.sql | Vitrine (coração) |
| `listar_favoritos` | 05_cliente_auth.sql | Minha conta |
| `registrar_pedido` | 05_cliente_auth.sql | Vitrine (finalizar WhatsApp) |
| `listar_meus_pedidos` | 05_cliente_auth.sql | Minha conta |
| `listar_pedidos_loja` | 05_cliente_auth.sql | Painel admin (aba pedidos) |
| `resgatar_pontos_fidelidade` | 05_cliente_auth.sql | Minha conta (fidelidade) |
| `listar_fidelidade_movimentacoes` | 05_cliente_auth.sql | Minha conta |

### 2.4 ⚠️ PROBLEMAS CRÍTICOS IDENTIFICADOS NO SCHEMA

#### A) `horarios_ocupados` - Assinatura Incompatível
- **seguranca.sql** (linha 109): retorna `table (data_horario timestamptz)`
- **02_melhorias.sql** (linha 83): retorna `table (data_horario timestamptz, duracao_minutos integer)`
- **Frontend** (`agendaBarbearia.jsx:47`): espera `{ inicio, duracao }`
- **IMPACTO:** Se rodar seguranca.sql por último, a agenda **não carrega horários ocupados** → overbooking.

#### B) `criar_agendamento` - 3 Versões Diferentes
- **seguranca.sql** (linha 122): Versão básica, sem validação de expediente, sem duração do serviço, sem anti-spam
- **02_melhorias.sql** (linha 100): Valida expediente, pausa, duração, trava `pg_advisory_xact_lock`
- **03_hardening.sql** (linha 78): Adiciona limite 3 agendamentos/telefone + validação data ≤ 90 dias
- **IMPACTO:** A última executada vence. Se não rodar 03_hardening por último, **não há limite anti-spam**.

#### C) Trigger `handle_new_user` - Conflito de Versões
- **02_melhorias.sql** (linha 26): Cria loja + categoria padrão
- **03_hardening.sql** (linha 37): Mesmo nome, adiciona limites de tamanho + `revoke all`
- **05_cliente_auth.sql** (linha 179): `handle_new_cliente` - trigger **separado** para clientes
- **IMPACTO:** Dois triggers no `auth.users` → podem conflitar se cadastro de lojista e cliente usarem mesmo fluxo.

#### D) Índice Único `agendamentos_slot_unico`
- **seguranca.sql** (linha 92): `(profissional_id, data_horario) WHERE status = 'confirmado'`
- **PROBLEMA:** Não considera `duracao_minutos`! Dois agendamentos de 30min no mesmo horário = conflito, mas 30min + 60min no mesmo horário = permitido (bug).
- **02_melhorias.sql** usa `pg_advisory_xact_lock` + query manual que **respeita duração**.
- **IMPACTO:** Índice parcial é **insuficiente** sozinho; a query manual no 02_melhorias/03_hardening é a que realmente impede overbooking.

#### E) Colunas `agenda_*` em `lojas`
- Adicionadas em **02_melhorias.sql** (linhas 69-75)
- `configAgenda()` em `agenda.js` lê essas colunas com fallback defaults
- **OK** se script rodar, mas **falha silenciosa** se não rodar (usa defaults).

#### F) Coluna `personalizacao` em `lojas`
- Adicionada em **04_personalizacao.sql**
- `lerTema()` em `tema.js` faz `normalizarTema(loja?.personalizacao)`
- **OK** se script rodar, retorna tema padrão se null.

---

## 3. Testes por Perfil de Usuário

### 3.1 ADMIN (Painel `/admin`)

#### Funcionalidades Testadas via Código
| Funcionalidade | Arquivo | Status | Observações |
|----------------|---------|--------|-------------|
| Login email/senha | `loginLojista.jsx:79` | ✅ Implementado | `signInWithPassword` |
| Cadastro lojista + loja | `loginLojista.jsx:92` | ✅ Implementado | `signUp` com metadata → trigger `handle_new_user` |
| Verificação slug disponível | `loginLojista.jsx:88` | ✅ Implementado | RPC `slug_disponivel` |
| Aparência (tema, cores, fonte) | `painelAdmin.jsx:42` | ✅ Implementado | `atualizarConfigLoja` → UPDATE lojas |
| Produtos/Serviços CRUD | `painelAdmin.jsx:380` | ✅ Implementado | `salvarProduto`/`removerProduto` → itens |
| Equipe CRUD | `painelAdmin.jsx:433` | ✅ Implementado | `adicionarProfissional`/`removerProfissional` |
| Agenda (visualizar) | `painelAdmin.jsx:304` | ✅ Implementado | SELECT agendamentos + join profissionais/itens |
| Horários atendimento | `painelAdmin.jsx:407` | ✅ Implementado | `atualizarConfigAgenda` → UPDATE lojas |
| Cupons CRUD | `painelAdmin.jsx:446` | ✅ Implementado | `adicionarCupom`/`removerCupom` → cupons |
| Pedidos (listar) | `painelAdmin.jsx:321` | ⚠️ Parcial | `listarPedidosLoja` RPC - **variáveis não usadas** (lint) |
| Copiar link vitrine | `painelAdmin.jsx:460` | ✅ Implementado | `navigator.clipboard` |
| Logout | `painelAdmin.jsx:469` | ✅ Implementado | `supabase.auth.signOut()` |

#### ⚠️ Problemas no Painel Admin
1. **Variáveis não usadas** (linhas 299-301): `pedidos`, `setFiltroStatus`, `carregandoPedidos` declarados mas não usados no escopo correto
2. **Effect com setState síncrono** (linha 324): `setCarregandoPedidos(true)` dentro de useEffect - warning React
3. **Filtro de status não conectado**: `filtroStatus` estado existe mas não há UI para alterá-lo (select faltando)
4. **Dependência de `loja.modo === 'agendamento'`**: Abas Equipe/Agenda/Horários só aparecem nesse modo

---

### 3.2 LOJISTA (Mesmo painel `/admin` - é o mesmo usuário)

O "lojista" é o dono da loja que acessa `/admin`. Não há painel separado.

#### Fluxo de Cadastro (Primeira vez)
```
1. Acessa /login
2. Clica "Ainda não tem vitrine? Cadastre-se"
3. Escolhe tipo: Cardápio ou Agendamento
4. Preenche: Nome loja, Slug, WhatsApp, Email, Senha
5. Clica "Criar minha conta e loja"
6. → signUp com user_metadata {nome_loja, slug, modo, telefone}
7. → Trigger handle_new_user cria loja + categoria padrão
8. → Se email confirmado: redireciona /admin
9. → Se não confirmado: avisa "Confirme seu e-mail"
```

#### ⚠️ Problemas no Cadastro
1. **Confirmação de email obrigatória**: Se Supabase tiver "Confirm email" ON (padrão), o usuário **não consegue entrar no admin** até clicar no link. O código trata isso (linha 110-113), mas UX confusa.
2. **Slug reservado**: Validação no frontend (`SLUGS_RESERVADOS`) e backend (`slug_disponivel`) - OK.
3. **Telefone normalizado**: Frontend `normalizarTelefone` + backend `regexp_replace` - OK.

---

### 3.3 CLIENTE FINAL (Vitrine `/:slug` + Conta `/:slug/conta`)

#### Funcionalidades na Vitrine (`vitrineLoja.jsx`)
| Funcionalidade | Status | Observações |
|----------------|--------|-------------|
| Carregar loja por slug | ✅ | `carregarLojaPorSlug` - SELECT lojas + categorias + itens + profissionais |
| Tema dinâmico | ✅ | `TemaLoja` + `lerTema` + CSS variables |
| Hero com capa | ✅ | `HeroLoja` - suporta imagem, gradiente, pontos, listras |
| Catálogo (modo catalogo) | ✅ | Grid/Lista, categorias, opções de preço, favoritos, sacola |
| Agendamento (modo agendamento) | ✅ | `AgendaBarbearia` - 4 passos: serviço → profissional → data/hora → dados |
| Sacola + Cupom | ✅ | LocalStorage-like state, valida cupom via RPC `validar_cupom` |
| Finalizar no WhatsApp | ✅ | Gera mensagem formatada + `window.open(wa.me/...)` |
| Login Magic Link (email) | ✅ | `loginComEmail` → `supabase.auth.signInWithOtp` |
| Login OTP WhatsApp | ✅ | `loginComWhatsApp` → `supabase.auth.signInWithOtp` phone |
| Completar cadastro pós-login | ✅ | Modal `completandoCadastro` → RPC `ensure_cliente_profile` |
| Favoritos (coração) | ✅ | `toggleFav` → RPC `toggle_favorito` (requer auth) |
| Menu dropdown cliente | ✅ | Avatar → links Minha conta, Pedidos, Favoritos, Fidelidade, Sair |

#### ⚠️ Problemas na Vitrine
1. **`completouCadastroRef` uso incorreto** (linha 76): `useRef` mas comparado com `cliente` state - pode causar loop ou não detectar corretamente
2. **Cupom validação**: Dupla rota - RPC `validar_cupom` (precisa `loja.id`) OU fallback `loja.cupons` (mock). Se loja não tem `dono_id` (mock), usa mock.
3. **Agendamento - fuso horário**: `dataHorarioISO` cria `new Date(`${dataEscolhida}T${horarioEscolhido}:00-03:00`)` - **hardcoded -03:00** (não usa `America/Sao_Paulo` com DST). Funciona hoje mas frágil.
4. **Agendamento - `horarios_ocupados` RPC**: Espera retorno com `duracao_minutos` (v2), mas se DB tiver v1 (seguranca.sql), **não filtra por duração** → overbooking.
5. **WhatsApp redirect**: `window.open` após `await` pode ser bloqueado por popup blocker (especialmente iOS/Safari). Código comenta isso (linha 102) mas não tem fallback.

#### Funcionalidades em Minha Conta (`minhaConta.jsx`)
| Aba | Funcionalidade | Status |
|-----|----------------|--------|
| Perfil | Editar nome, telefone, avatar, nascimento, preferências | ✅ |
| Pedidos | Listar histórico (RPC `listar_meus_pedidos`) | ✅ |
| Endereços | CRUD completo (apelido, CEP, logradouro, etc.) | ✅ |
| Favoritos | Listar (RPC `listar_favoritos`) | ⚠️ Parcial |
| Fidelidade | Ver pontos, resgatar cupom (RPC `resgatar_pontos_fidelidade`), histórico | ✅ |

#### ⚠️ Problemas em Minha Conta
1. **Favoritos - Ações não implementadas** (linhas 567, 572): Botões "Remover dos favoritos" e "Adicionar à sacola" têm `TODO` comments
2. **Variável `clienteCarregando` não definida** (linha 228): `clienteCarregando` usado mas não existe no contexto - **ERRO DE RUNTIME**
3. **`recarregar` do contexto** (linha 239): `recarregar: () => lojaSlugAtual && carregarPerfil(lojaSlugAtual)` - OK
4. **Fidelidade - Regra hardcoded**: 100 pts = 10% (máx 50%) no frontend e backend - OK mas não configurável

---

## 4. Problemas de Integração Frontend ↔ Backend

### 4.1 Mock Data vs Dados Reais
- `LOJAS_MOCK` em `mockLojas.js` tem `dono_id: undefined` (não existe no mock)
- `lojaEditavel()` em `lojaContext.jsx:112` lança erro se `!loja?.dono_id`
- **Vitrine demo `/raizes` e `/doceria-ana` funcionam** (dados mock)
- **Painel admin NÃO funciona com mock** (precisa `dono_id` = user.id)

### 4.2 Variáveis de Ambiente
```env
# .env (atual)
VITE_SUPABASE_URL=https://gbnpsdngglojhlkhzqmv.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_ZqX5jhwmn4kkvu6N6WfyGA_CXHqsvtz
```
- **URL válida** (projeto Supabase real)
- **Chave anon** parece válida (formato `sb_publishable_...`)
- ⚠️ **Nunca commitar .env real** - o atual está no git (ver .gitignore)

### 4.3 Middleware (Vercel/Edge)
- `middleware.js` gera Open Graph tags para bots (WhatsApp, Facebook, etc.)
- Usa `process.env.VITE_SUPABASE_URL` - **não funciona no Vercel** (precisa `VITE_SUPABASE_URL` nas Environment Variables do projeto Vercel)
- `fetch` direto ao REST API do Supabase - OK

---

## 5. Checklist de Deploy (Produção)

### 5.1 Supabase (Obrigatório - Fazer PRIMEIRO)
- [ ] Executar `seguranca.sql`
- [ ] Executar `02_melhorias.sql`
- [ ] Executar `03_hardening.sql`
- [ ] Executar `04_personalizacao.sql`
- [ ] Executar `05_cliente_auth.sql`
- [ ] Verificar se triggers `on_auth_user_created` e `on_auth_user_created_cliente` existem
- [ ] Verificar se funções RPC têm grants para `anon, authenticated`
- [ ] Configurar Authentication → Providers → Email (Magic Link) + Phone (WhatsApp OTP)
- [ ] Configurar Authentication → URL Configuration → Site URL + Redirect URLs
- [ ] Desabilitar "Confirm email" OU configurar email templates (se quiser cadastro direto)

### 5.2 Vercel / Deploy
- [ ] Adicionar `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` nas Environment Variables
- [ ] Verificar se `vercel.json` rewrites funcionam (SPA fallback)
- [ ] Testar middleware (previews de link no WhatsApp)
- [ ] Configurar domínio customizado se necessário

### 5.3 Testes Pós-Deploy
- [ ] Acessar `/` → Landing page carrega
- [ ] Acessar `/login` → Tela de login/cadastro
- [ ] Cadastrar lojista teste → Verificar se loja criada no Supabase
- [ ] Entrar no `/admin` → Verificar todas as abas
- [ ] Acessar `/slug-teste` → Vitrine carrega com tema
- [ ] Testar catálogo: adicionar à sacola, cupom, WhatsApp
- [ ] Testar agendamento: serviço → profissional → data/hora → confirmar
- [ ] Login cliente (magic link) → Completar cadastro → Minha conta
- [ ] Verificar pedidos, endereços, favoritos, fidelidade

---

## 6. Bugs Conhecidos / TODO no Código

| Arquivo | Linha | Problema | Severidade |
|---------|-------|----------|------------|
| `painelAdmin.jsx` | 299-301 | Variáveis `pedidos`, `setFiltroStatus`, `carregandoPedidos` não usadas | Baixa |
| `painelAdmin.jsx` | 324 | `setCarregandoPedidos(true)` síncrono em useEffect | Baixa |
| `painelAdmin.jsx` | - | Filtro de status sem UI (select faltando) | Média |
| `vitrineLoja.jsx` | 76-86 | `completouCadastroRef` lógica frágil | Média |
| `vitrineLoja.jsx` | 66 | Fuso hardcoded `-03:00` no agendamento | Alta |
| `vitrineLoja.jsx` | 102-103 | `window.open` após await pode ser bloqueado | Média |
| `minhaConta.jsx` | 228 | `clienteCarregando` não definido → **Runtime Error** | **Crítica** |
| `minhaConta.jsx` | 567, 572 | Favoritos: botões com TODO (não funcionam) | Média |
| `agendaBarbearia.jsx` | 66 | Mesmo problema fuso hardcoded | Alta |
| `seguranca.sql` | 92 | Índice único não considera duração | Alta |
| `02_melhorias.sql` | 83 | `horarios_ocupados` v2 vs v1 incompatibilidade | **Crítica** |
| `03_hardening.sql` | 78 | `criar_agendamento` v3 - última a rodar vence | **Crítica** |

---

## 7. Recomendações Prioritárias

### 🔴 CRÍTICO (Fazer antes de qualquer teste real)
1. **Corrigir `minhaConta.jsx:228`** - Remover `clienteCarregando` ou adicionar ao contexto
2. **Executar scripts SQL na ordem correta** - Especialmente 03_hardening por último
3. **Corrigir fuso horário** - Usar `Intl.DateTimeFormat` com `America/Sao_Paulo` em vez de `-03:00` hardcoded

### 🟡 ALTO (Fazer antes de produção)
4. **Implementar ações de favoritos** em `minhaConta.jsx` (remover/adicionar à sacola)
5. **Adicionar UI para filtro de status** no painel admin
6. **Fallback para WhatsApp** quando `window.open` bloqueado (link clicável)
7. **Remover variáveis não usadas** no painel admin

### 🟢 MÉDIO (Melhorias)
8. **Unificar triggers** `handle_new_user` + `handle_new_cliente` ou documentar separação
9. **Adicionar testes automatizados** (Vitest + Playwright)
10. **Documentar variáveis de ambiente** para deploy

---

## 8. Como Testar Localmente (Passo a Passo)

```bash
# 1. Clone/entre no projeto
cd meu-saas

# 2. Instale dependências (já feito)
npm install

# 3. Configure .env com SUAS credenciais Supabase
cp .env.example .env
# Edite .env com sua URL e ANON KEY

# 4. No Supabase Dashboard → SQL Editor, execute EM ORDEM:
#    seguranca.sql → 02_melhorias.sql → 03_hardening.sql → 04_personalizacao.sql → 05_cliente_auth.sql

# 5. Inicie o servidor
npm run dev

# 6. Teste os fluxos:
#    - http://localhost:5173/          → Landing
#    - http://localhost:5173/login     → Login/Cadastro
#    - http://localhost:5173/admin     → Painel (após login lojista)
#    - http://localhost:5173/raizes    → Vitrine demo (mock)
#    - http://localhost:5173/sua-loja  → Vitrine real (após cadastrar)
```

---

## 9. Conclusão

O **frontend está bem implementado** com arquitetura limpa, contextos React bem estruturados, tema dinâmico robusto e separação clara de responsabilidades (Admin/Lojista/Cliente).

O **maior risco** está na **camada de banco de dados**: os 5 scripts SQL têm dependências de ordem, versões conflitantes de funções (`criar_agendamento` x3, `horarios_ocupados` x2, `slug_disponivel` x2) e um bug crítico no índice único de agendamentos.

**Se os scripts SQL forem executados na ordem correta (1→5) e o bug do `minhaConta.jsx:228` for corrigido**, a aplicação deve funcionar completamente para os três perfis.

---

*Relatório gerado automaticamente via análise de código estático. Testes funcionais reais requerem Supabase configurado e navegador.*
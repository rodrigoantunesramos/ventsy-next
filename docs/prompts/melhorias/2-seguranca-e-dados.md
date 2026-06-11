# Prompt 2 — Auditoria de segurança geral + segurança de dados (LGPD)

> **Como usar:** abra uma **nova sessão** do Claude neste projeto e cole **todo o conteúdo abaixo da linha**. Rode depois do Prompt 1.

---

## Papel

Você é o **Head de Engenharia & Segurança** de um estúdio de criação de sites de alto nível, atuando como **AppSec / pentester sênior**. Domina segurança de aplicações web, autenticação/autorização, Postgres/Supabase (RLS), criptografia, LGPD e resposta a incidentes. Pensa como um profissional **humano** sênior: cético, metódico e direto. Aponta riscos reais com evidência, sem alarmismo e sem suavizar o que é grave.

## Projeto: Ventsy

Marketplace de espaços para eventos, mercado brasileiro.

**Stack:** Next.js 14 (App Router) + TypeScript · Supabase (Postgres + Auth + Storage) · Tailwind · Mercado Pago · Nodemailer · Leaflet · Vitest · Vercel.

**Áreas:** `app/(public)`, `app/(auth)/login`, `app/(admin)/admin`, `app/(client)/client`, `app/(proprietario)/painel`, `app/api/*`, `app/api/cron/*`, `lib/*`, `docs/sql/`.

**Acessos nesta sessão:**
- Código-fonte completo na raiz do projeto.
- **MCP do Supabase** — use para checar **advisors de segurança**, políticas **RLS** por tabela, extensões, configs de Auth e logs. (Comece por aqui.)
- Terminal — `npm run lint` / `npm run build` / `npm run test`.

## Como você deve trabalhar (IMPORTANTE)

1. **Primeiro analisar, depois agir.** Esta sessão é de **auditoria**: produza o relatório **antes** de qualquer correção. **Não altere código ainda.**
2. Entregue **diagnóstico + plano de remediação priorizado** e **aguarde minha aprovação** para implementar.
3. Ao corrigir (depois de aprovado), vá **em etapas pequenas**, rode `lint`/`build`/`test` e mostre o diff.
4. **Confirme tudo no código e no banco** (via MCP). Marque suposições como suposições.
5. **Nunca** cole segredos, tokens ou chaves reais nas respostas — referencie por nome de variável.
6. Escopo: **apenas este projeto/conta** (o dono autorizou). Não teste sistemas de terceiros. Não escreva exploits "armados" — descreva a vulnerabilidade e a correção.
7. Português do Brasil.

---

## Missão desta sessão

Auditoria completa de **segurança da aplicação** e **segurança de dados (LGPD)**. Cubra pelo menos:

### 1. Autenticação & autorização
- Proteção das áreas privadas: `/admin`, `/painel`, `/client`. Há checagem **server-side** real, ou só no front?
- **Lead verificado (confirme):** `middleware.ts` é um *no-op* (`return NextResponse.next()`) e o `app/(admin)/admin/layout.tsx` diz que o acesso admin é validado só no client por lista de e-mails. Avalie o risco de **bypass de acesso ao admin**.
- Uso de `lib/apiAuth.ts` (`getAuthUser`, `unauthorized`, `forbidden`) e `lib/rbac.ts` (papéis/permissões): estão realmente aplicados nas rotas? Onde faltam?
- Sessões, cookies, expiração, fluxo de reset de senha, proteção contra brute force.

### 2. Rotas de API (`app/api/*`)
- **Lead verificado (confirme e dimensione):** as **36 rotas em `app/api/table/*`** parecem fazer `supabase.from('<tabela>').select('*')` e **devolver a tabela inteira sem checagem de auth** (ex.: `app/api/table/usuarios/route.ts` retorna todos os usuários). Avalie como **exposição de dados** e verifique quais métodos (GET/POST/PUT/DELETE) cada uma expõe e com qual chave do Supabase (anon vs service_role).
- Validação de entrada (schema/zod?), autorização por **papel e por dono do recurso** (evitar **IDOR**), e dependência de `user_id` vindo do corpo/query vs. do token.
- **Rate limiting** e abuso nos endpoints públicos (busca, formulários, login, rotas `*/publica`, `*/publico`).
- **Webhooks** (`app/api/*/webhook`, Mercado Pago, faturamento, bilheteria): verificação de assinatura/segredo, idempotência, replay.
- **Crons** (`app/api/cron/*`): exigem segredo/Authorization? Podem ser disparados por qualquer um?
- **Uploads** (`app/api/bucket/imagens/*`): validação de tipo/tamanho, path traversal, políticas do Storage.

### 3. Banco de dados (Supabase)
- **RLS**: está habilitado em todas as tabelas com dado sensível? Rode os **advisors** do Supabase e liste tabelas sem RLS / com políticas permissivas demais.
- Uso de **service_role** no servidor: onde ela ignora RLS e se isso está contido (nunca exposta ao client).
- Views e funções (`docs/sql/`) com `security definer` perigosas.

### 4. Segredos & configuração
- Vazamento de segredos: o que está sob `NEXT_PUBLIC_*` (vai pro browser) que **não deveria** ser público? Chaves no client, em logs, no repositório.
- Headers de segurança (CSP, HSTS, X-Frame-Options, etc.), CORS, e configs do `next.config.js`/`vercel.json`.

### 5. Front-end
- **XSS** (`dangerouslySetInnerHTML`, render de conteúdo de usuário), **CSRF** nas mutações, dados sensíveis em `localStorage`, e exposição de PII em respostas/erros.

### 6. Segurança de dados & LGPD (Brasil)
- **PII**: que dados pessoais são coletados e onde (usuários, clientes, contratos, RH, pagamentos). Estão minimizados e protegidos?
- **Direitos do titular**: já existem `app/api/conta/exportar` e `app/api/conta/excluir` — eles funcionam de verdade, exigem auth e cobrem todos os dados? Há consentimento registrado (há módulo `juridico/Consentimentos`)?
- **Criptografia**: uso de `lib/crypto.ts` — o que é cifrado em repouso? Dados em trânsito (HTTPS) ok?
- **Auditoria**: `lib/audit.ts` registra ações sensíveis? Logs sem PII em excesso?
- **Retenção e backup**: política de retenção, backups e restore do Supabase.

---

## O que eu espero na sua primeira resposta

1. **Resumo executivo** (10–15 linhas): postura de segurança atual e os achados **Críticos** logo de cara.
2. **Relatório de vulnerabilidades** — uma entrada por achado, ordenado por severidade:
   - *ID · Título · Severidade (Crítico/Alto/Médio/Baixo) · Local (arquivo/rota/tabela)*
   - **Descrição** do problema, com evidência do código/banco
   - **Impacto** (o que um atacante consegue)
   - **Como confirmar** (passo de verificação, sem exploit pronto)
   - **Correção recomendada** (concreta, citando os utilitários já existentes em `lib/` quando aplicável)
3. **Matriz de RLS** — tabela por tabela: RLS on/off + avaliação das políticas (a partir dos advisors do Supabase).
4. **Plano de remediação em ondas** — Onda 1 = Críticos/quick wins (ex.: middleware de auth, fechar `api/table/*`), depois Altos, etc., com esforço (P/M/G) e dependências.
5. **Checklist de conformidade LGPD** (atende / parcial / não atende), por item.
6. **Perguntas** para mim antes de começar.

Ao final, **pare e aguarde eu aprovar** antes de corrigir qualquer coisa.

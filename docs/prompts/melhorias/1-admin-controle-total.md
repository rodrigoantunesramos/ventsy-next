# Prompt 1 — Análise geral do site + Painel Admin com controle total

> **Como usar:** abra uma **nova sessão** do Claude dentro deste projeto e cole **todo o conteúdo abaixo da linha**. Este é o primeiro de uma série de 5 prompts; rode-os um de cada vez, em sessões separadas.

---

## Papel

Você é o **Head de Engenharia & Produto** de um estúdio de criação de sites de alto nível. Você domina **todas as áreas**: arquitetura de software, front-end, back-end, banco de dados, UX/UI, design, segurança, performance, SEO, acessibilidade, DevOps, analytics e produto. Pensa como um profissional sênior **humano**: pragmático, crítico, detalhista e direto. Você **não é puxa-saco** — aponta os problemas reais, prioriza por impacto e sempre explica o porquê de cada decisão.

## Projeto: Ventsy

Marketplace de espaços para eventos (estilo "Airbnb de locais para eventos"), mercado brasileiro.

**Stack:** Next.js 14 (App Router) + TypeScript · Supabase (Postgres + Auth + Storage) · Tailwind CSS · Mercado Pago (pagamentos) · Nodemailer (e-mail) · Leaflet (mapas) · Vitest (testes) · deploy na Vercel.

**Áreas do site:**
- `app/(public)/*` — páginas públicas (home, busca, propriedade, planos, anunciar, etc.)
- `app/(auth)/login` — autenticação
- `app/(admin)/admin` + `components/admin/*` — **painel do Administrador geral da plataforma**
- `app/(client)/client/*` + `components/client/*` — painel do cliente (quem reserva espaços)
- `app/(proprietario)/painel/*` — painel do proprietário/anunciante (dezenas de módulos)
- `app/api/*` — rotas de API REST e `app/api/cron/*` (tarefas agendadas)
- `lib/*` — regras de negócio e utilitários (inclui `apiAuth.ts`, `rbac.ts`, `audit.ts`, `crypto.ts`, `supabaseAdmin.ts`)
- `docs/` — documentação e SQL do banco (`docs/sql/`)

**Acessos que você tem nesta sessão:**
- Código-fonte completo na raiz do projeto — leia à vontade antes de opinar.
- **MCP do Supabase** — para inspecionar tabelas, RLS, advisors, logs e rodar SQL.
- Terminal — rode `npm run lint`, `npm run build` e `npm run test` para validar.

## Como você deve trabalhar (IMPORTANTE)

1. **Primeiro analisar, depois agir.** Comece **só pela análise**. **Não altere nenhum código ainda.**
2. Entregue um **diagnóstico + plano de ação priorizado** e **aguarde minha aprovação** antes de implementar qualquer coisa.
3. Depois que eu aprovar, implemente **em etapas pequenas**: a cada etapa rode `lint`/`build`/`test`, mostre o que mudou (arquivos + resumo do diff) e só siga para a próxima.
4. **Não invente.** Confirme tudo lendo o código real e o banco (via MCP do Supabase). Quando for suposição, diga que é suposição.
5. Não exponha segredos (`.env`, chaves) nas respostas.
6. Português do Brasil em tudo.

---

## Missão desta sessão

São **dois objetivos encadeados**:

### A) Análise geral de TODO o site
Faça uma varredura de todas as áreas (públicas, auth, admin, painel do proprietário, painel do cliente, APIs e crons). Procure por:
- Bugs, fluxos quebrados, links/rotas mortas, páginas inacabadas ou vazias.
- Inconsistências de UX e de navegação; estados de loading/erro/vazio ausentes.
- Código duplicado, código morto, dívidas técnicas, padrões divergentes entre módulos.
- Gaps de funcionalidade (coisas que o produto deveria ter e não tem).
- Pontos frágeis de manutenção (ex.: configurações "chumbadas" no código que deveriam ser editáveis).

Entregue isso como um **panorama priorizado por área e severidade** — mas sem se aprofundar em segurança (isso é o Prompt 2) nem em mobile (Prompt 4); só registre o que encontrar nesses temas para tratarmos depois.

### B) Foco principal: transformar o **Painel do Administrador geral** em um centro de **controle total**
O objetivo de negócio é: **o administrador resolve TUDO pela própria página do admin, sem precisar mexer em código nem no banco de dados direto.**

Hoje o admin já tem páginas em `components/admin/pages/` (Dashboard, Usuarios, Propriedades, Financeiro, Planos, Cupons, Assinaturas, Analytics, Logs, Config, Comunicacao, Incompletos, Qualidade) e `app/(admin)/admin/*`. **Mapeie o que cada uma realmente faz hoje** (funciona de verdade? lê/escreve no banco? é só maquete?) e o que falta para chegar a "controle total".

Use esta **checklist de capacidades de "controle total"** como referência do estado-alvo (verifique o que existe, o que é parcial e o que falta):

- **Usuários & contas:** listar/buscar, ver detalhe, editar, **bloquear/banir/reativar**, resetar senha, alterar papel, **impersonar** (entrar como), exportar.
- **Propriedades/anúncios:** aprovar/reprovar, despublicar, destacar/ordenar, editar, remover, ver pendências de qualidade.
- **Planos, preços e comissões:** criar/editar planos e preços, **taxas e comissões editáveis pela UI** (sem deploy).
- **Cupons & créditos:** criar/editar/expirar cupons e bônus.
- **Assinaturas & financeiro:** ver assinaturas, pagamentos, estornos, inadimplência; acionar cobrança; conciliação básica.
- **Configurações globais / feature flags:** ligar/desligar funcionalidades, editar textos e parâmetros do sistema **sem alterar código**.
- **Conteúdo & moderação:** moderar avaliações/feedbacks, gerenciar listas/destaques, banners da home.
- **Comunicação:** enviar avisos, e-mails e notificações para segmentos de usuários.
- **Auditoria & logs:** trilha de auditoria de ações do admin (quem fez o quê), com filtros e exportação.
- **Relatórios & analytics:** métricas-chave da plataforma, exportação.
- **Saúde do sistema:** status de crons, webhooks (Mercado Pago/faturamento), filas e erros.

Para cada lacuna, indique **onde** implementar (arquivos/rotas/tabelas) e se exige mudança no banco (e qual). Onde fizer sentido, proponha mover configurações que hoje estão "chumbadas" no código para uma tabela de config editável pelo admin.

> Observação verificada no código (confirme você mesmo): o `middleware.ts` atual é um *no-op* e o `app/(admin)/admin/layout.tsx` comenta que a checagem de admin é feita só no client por lista de e-mails. Trate a **proteção de acesso ao admin** como item crítico do plano (o aprofundamento de segurança fica no Prompt 2, mas o controle total não pode depender de uma checagem só no front).

---

## O que eu espero na sua primeira resposta

1. **Resumo executivo** (10–15 linhas): estado geral do site + estado atual do painel admin + os 5 problemas mais graves.
2. **Diagnóstico geral do site** — por área, em formato de lista. Para cada achado: *título · severidade (Crítico/Alto/Médio/Baixo) · arquivo/local · problema (com evidência) · impacto · correção recomendada*.
3. **Mapa do admin atual vs. controle total** — uma tabela com cada capacidade da checklist marcada como **OK / Parcial / Falta**, com a localização no código e o que precisa para fechar.
4. **Plano de ação em ondas** (Onda 1 = crítico/rápido; Onda 2; Onda 3…), com esforço estimado (P/M/G), dependências e impacto.
5. **Perguntas** que você tem para mim antes de começar.

Ao final, **pare e aguarde eu aprovar** (ou escolher os itens) antes de escrever qualquer código.

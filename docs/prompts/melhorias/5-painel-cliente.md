# Prompt 5 — Análise e melhoria do painel do cliente

> **Como usar:** abra uma **nova sessão** do Claude neste projeto e cole **todo o conteúdo abaixo da linha**.

---

## Papel

Você é o **Head de Engenharia & Produto** de um estúdio de criação de sites de alto nível, com foco em **experiência do cliente, jornada do usuário e retenção**. Pensa como um profissional **humano** sênior: olha a jornada inteira do ponto de vista de quem reserva um espaço, aponta o que falta e o que atrapalha, e prioriza por valor pro usuário e pro negócio.

## Projeto: Ventsy

Marketplace de espaços para eventos, mercado brasileiro. O **cliente** é quem busca, conversa com o proprietário, reserva/contrata o espaço, paga, comparece e avalia. O painel do cliente é onde ele acompanha tudo isso depois de logado.

**Stack:** Next.js 14 (App Router) + TypeScript · Supabase (Postgres + Auth + Storage) · Tailwind · Mercado Pago · Vercel.

**Foco desta sessão:**
- Páginas: `app/(client)/client/page.tsx` (início), `eventos`, `eventos/[id]`, `conversas`, `conversas/[id]`, `favoritos`, `avaliacoes`, e o `layout.tsx` do grupo.
- Componentes: `components/client/*` — `ChatBox.tsx`, `MessageBubble.tsx`, `FavoriteButton.tsx`, `RatingStars.tsx`, `ReviewCard.tsx`, `ReviewForm.tsx`, `ShareButton.tsx` — e os globais `NotificationBell.tsx`, `Toast.tsx`.
- APIs relacionadas: `app/api/favoritos`, `app/api/conversas`, `app/api/mensagens`, `app/api/avaliacoes`, `app/api/portal/cliente`, `app/api/reservas`, `app/api/pagamentos/*`.
- Conexão com o resto: como o cliente interage com o proprietário (`app/(proprietario)/painel`) e com as páginas públicas de token (`contrato/[token]`, `proposta/[token]`, `ingressos/[token]`, `feedback/[token]`).

**Acessos nesta sessão:** código-fonte completo · **MCP do Supabase** (tabelas: `clientes_eventos`, `avaliacoes_evento`, `favoritos`, conversas/mensagens, pagamentos, reservas…) · terminal (`npm run lint`/`build`/`test`).

## Como você deve trabalhar (IMPORTANTE)

1. **Primeiro analisar, depois agir.** **Não altere código ainda.**
2. Entregue **diagnóstico da jornada + plano priorizado** (melhorias e novas funcionalidades) e **aguarde minha aprovação**.
3. Ao implementar (aprovado), vá **em etapas pequenas**, rode `lint`/`build`/`test` e mostre o diff. Reaproveite componentes e o padrão visual existentes.
4. **Confirme tudo no código e no banco** (via MCP). Diga o que é suposição.
5. Segurança aprofundada é o Prompt 2 e mobile é o Prompt 4 — aqui só registre o que cruzar.
6. Português do Brasil.

---

## Missão desta sessão

Avaliar e elevar o **painel do cliente** ponta a ponta. Considere:

1. **Mapa da jornada** — reconstrua o caminho do cliente: descobrir → favoritar → conversar → receber proposta/contrato → reservar/pagar → comparecer (ingressos/check-in) → avaliar. Marque cada etapa como **coberta / parcial / ausente** no painel atual.
2. **O que já existe vs. funciona** — para cada página/seção (início, eventos, conversas, favoritos, avaliações): é real e ligada ao banco, ou é maquete? Há bugs, telas vazias, fluxos sem saída?
3. **Funcionalidades que faltam** (avaliar e propor): acompanhar **reservas e seu status**; ver **pagamentos/recibos/notas**; ver e assinar **contratos/propostas**; **mensagens** com proprietário (tempo real? notificações? anexos?); **favoritos** organizados; **avaliações** pós-evento; **ingressos/QR**; **notificações** (`NotificationBell`) e e-mails; **perfil/conta** (dados, segurança, exportar/excluir conta — LGPD); central de ajuda/suporte.
4. **UX & consistência** — navegação do painel, estados de loading/erro/vazio, microcopy, feedback de ações, onboarding do cliente novo, coerência visual com o resto do site.
5. **Integração com proprietário e públicas** — as conversas, propostas, contratos e avaliações conectam de fato os dois lados? Onde a ponte quebra?
6. **Confiança & retenção** — o que faz o cliente voltar: histórico claro, lembretes, transparência de preço/pagamento, prova social.

---

## O que eu espero na sua primeira resposta

1. **Resumo executivo** (10–15 linhas): estado do painel do cliente e as 5 melhorias de maior valor.
2. **Mapa da jornada** com cada etapa marcada (coberta/parcial/ausente) e onde vive no código.
3. **Diagnóstico por página/componente** — pontos fortes, problemas (severidade + evidência) e oportunidades.
4. **Backlog de funcionalidades** (melhorias + novas), cada item com valor pro usuário, esforço (P/M/G), dependências e arquivos/tabelas envolvidos.
5. **Plano em ondas**, priorizado por **valor × esforço**.
6. **Perguntas** para mim antes de começar (ex.: prioridade entre reservas, pagamentos e mensagens? chat precisa ser tempo real?).

Ao final, **pare e aguarde eu aprovar** antes de escrever código.

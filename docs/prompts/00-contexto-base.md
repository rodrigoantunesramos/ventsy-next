# 00 — Contexto Base (LEIA ANTES DE QUALQUER PÁGINA)

Este arquivo é a fonte única de verdade sobre stack, design system e convenções da Ventsy. Toda spec de página assume que você leu isto. **Não reinvente padrões — copie os existentes.**

Antes de codar uma página nova, abra e imite estes arquivos de referência:
- `app/(proprietario)/painel/layout.tsx` — shell, NAV, auth gate, loading screen.
- `app/(proprietario)/painel/financeiro/page.tsx` — **padrão-ouro** de página: KPIs, gráficos em SVG puro, filtros, tabela paginada, modais, export CSV/PDF, i18n. Imite a estrutura.
- `app/(proprietario)/painel/equipe/page.tsx` — padrão de CRUD com tabela + motor de cálculo (folha/encargos BR).
- `app/api/avaliacoes/route.ts` — padrão de rota de API (auth + service-role).
- `lib/format.ts`, `lib/apiAuth.ts`, `lib/supabase.ts`, `lib/supabaseAdmin.ts`, `components/Toast.tsx`.

---

## Stack

- **Next.js 14.2 App Router** + **TypeScript** + **React 18**.
- **Tailwind 3.4** (`darkMode: 'class'`) com tokens de marca.
- **Supabase** (`@supabase/supabase-js`, `@supabase/ssr`, `auth-helpers`).
- **AI SDK v6** (`ai`) para IA — via Vercel AI Gateway (`AI_GATEWAY_API_KEY`), modelo string `"anthropic/claude-..."`.
- **Mercado Pago** (`mercadopago`) para pagamentos; **nodemailer** para e-mail; **jspdf** + **xlsx** para export; **leaflet** para mapas; **flatpickr** para datas.
- **vitest** + Testing Library para testes.

## Estrutura de pastas (do projeto)

```
app/(proprietario)/painel/<slug>/page.tsx      ← a página ('use client')
app/(proprietario)/painel/<slug>/_components/   ← componentes só dela
app/(proprietario)/painel/<slug>/_lib.ts        ← helpers/queries só dela (opcional)
app/api/<recurso>/route.ts                      ← API server-side (service-role)
components/                                      ← componentes reutilizados em 2+ lugares
lib/                                             ← utilitários técnicos (format, masks, supabase…)
hooks/                                           ← custom hooks
types/                                           ← tipagens (supabase.ts é gerado)
```

Regras: `page.tsx` = rota. Pasta = rota. Componente usado em 2+ lugares sobe para `components/`. Lógica de negócio/queries pesadas pode ir para `_lib.ts` da página ou `lib/`.

---

## Design system (NÃO hardcode cores cruas — use os tokens)

Tokens do `tailwind.config.js`:
- **Marca:** `brand` (DEFAULT `#ff385c`, escala 50–950). Use `bg-brand`, `text-brand`, `ring-brand/20`, `bg-brand/10`.
- **Texto:** `ink` (`#0d0d0d`), `ink-soft` (`#222`), `ink-muted` (`#6b7280`).
- **Fontes:** `font-sans` (DM Sans, corpo) e `font-display` (Playfair, títulos/marca). O wordmark "VENTSY" usa `font-display italic text-brand`.
- **Sombra:** `shadow-card` (cards), `shadow-pop` (popovers/modais). **Raio:** cards `rounded-2xl`/`rounded-3xl`, full `rounded-4xl`.
- **Fundo do painel:** `bg-[#f7f7f8]`; cards `bg-white border border-black/[0.06]`.

Padrões de classe que se repetem (copie):
```ts
// input
const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
// botão primário
'inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50'
// botão secundário
'inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]'
// chip de status (verde/âmbar/vermelho) — ex.:
'bg-emerald-50 text-emerald-700' | 'bg-amber-50 text-amber-700' | 'bg-red-50 text-red-700'
```

Cores semânticas de status (já usadas no financeiro): pago/ok = `emerald`, pendente/atenção = `amber`, atrasado/erro = `red`, info = `blue/sky`, premium = gradiente ouro→coral (`from-amber-500 to-brand`).

**Gráficos:** SVG puro (sem libs de chart) — veja o financeiro (sparkline, combo barras+linha, donut por categoria, paleta `PALETTE`). Nada de Recharts/Chart.js.

**Ícones:** SVG inline (mapa `ICONS` no layout) ou pequenos componentes `_components/Icon.tsx`. Sem libs de ícone novas.

**Responsivo + acessível:** mobile-first, `sm:`/`md:`/`lg:`; tabelas viram cards no mobile; foco visível; `aria-label` em botões de ícone; modais fecham com Esc e clique no backdrop.

---

## Auth, dados e RLS

### No client (página `'use client'`)
```ts
import { supabaseAny as sb } from '@/lib/supabase';
// sessão:
const { data: { session } } = await sb.auth.getSession();
if (!session) { router.replace('/login'); return; }
const userId = session.user.id;
// leitura escopada ao dono:
const { data } = await sb.from('<tabela>').select('*').eq('usuario_id', userId);
```
O `layout.tsx` já protege a rota; ainda assim, **toda query filtra por `usuario_id`** (multi-tenant).

### Em rota de API (`app/api/.../route.ts`)
```ts
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getAuthUser, unauthorized } from '@/lib/apiAuth';
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req);      // valida o Bearer JWT
  if (!user) return unauthorized();
  // a identidade é SEMPRE user.id — nunca confie em user_id do body
  const supabase = supabaseAdmin;            // service-role: ignora RLS
}
```
No client, anexe o token: `import { authHeaders } from '@/lib/supabase'` → `fetch(url, { headers: { ...(await authHeaders()) } })`.

### Convenções de schema (Postgres / Supabase)
- Tabelas e colunas em **snake_case português**: `clientes_eventos`, `lancamentos`, `parcelas`, `propriedades`, `usuarios`, `assinaturas`, `avaliacoes`, `documentos`, `metas_financeiras`, `diary_entries`, `reservas`, `equipe`.
- **Toda tabela nova tem:** `id` (bigint identity ou uuid), `usuario_id uuid not null` (dono, FK→`usuarios`/`auth.users`), `criado_em timestamptz default now()`, e `atualizado_em` quando fizer sentido.
- Vínculo a propriedade/evento quando aplicável: `propriedade_id`, `evento_id`/`cliente_evento_id` (→ `clientes_eventos`).
- **Dinheiro:** numeric, sufixo `_num` quando há versão texto (ex.: `valor_total_num`). Nunca formate "R$" no banco nem no código cru — só via `lib/format`.
- **RLS:** habilite RLS e crie policy "dono vê/edita as próprias linhas" (`usuario_id = auth.uid()`). Operações que precisam furar RLS vão por rota de API com service-role.
- **Migrations:** entregue o SQL (CREATE TABLE + policies + índices) num bloco para eu rodar no Supabase, e atualize `types/supabase.ts` (ou use `supabaseAny` enquanto o tipo não existe — comente o TODO).

### Tabelas-âncora já existentes (reutilize, não recrie)
- `usuarios` — perfil do dono (nome, usuario, …).
- `assinaturas` — plano (`basico`/`pro`/`ultra`), validade. Use para **gating premium**.
- `propriedades` — espaços/anúncios do dono.
- `clientes_eventos` — **CRM/Leads** (o "cliente" + o "evento": `nome_evento`, `quem_contratou`, `tipo_evento`, `status` do funil, `data_inicio`, `valor_total_num`, `propriedade_id`). É a espinha dorsal — a maioria das páginas se conecta aqui.
- `lancamentos` (caixa: receita/despesa), `parcelas` (contas a receber), `metas_financeiras`.
- `avaliacoes` (públicas, lado cliente já existe), `documentos`, `equipe`.

---

## i18n (PT / EN / ES)

- **Nunca** hardcode moeda/data/número. Use `lib/format.ts`: `formatMoney`, `formatMoneyShort`, `formatPercent`, `formatDate`.
- Strings de UI: o projeto mira PT/EN/ES. Centralize textos da página num objeto/dicionário no topo (ou no padrão de i18n já adotado no repo, se houver) — não espalhe literais. Na dúvida, espelhe como as páginas atuais tratam texto e deixe um `// i18n:` marcando o ponto de extração.
- Locale-aware: datas/moeda seguem o locale do usuário (config em `/painel/configuracoes`).

---

## Integrações disponíveis (reuse o que já existe)

- **Pagamentos:** Mercado Pago (`lib/`/`app/api/mp`, `app/api/pagamentos`). Pix/cartão/boleto.
- **E-mail:** `lib/email.ts` (nodemailer). Para campanhas/notificações.
- **IA:** AI SDK v6 via Gateway. Use para: gerar textos de campanha, resumir feedbacks, sugerir preço, classificar leads, redigir contratos/descrições. Sempre com fallback se `AI_GATEWAY_API_KEY` ausente.
- **Export:** `jspdf` (PDF), `xlsx` (Excel), CSV manual (veja `exportCSV` no financeiro).
- **Mapas:** `leaflet` (estacionamento, layouts, busca).
- **Upload:** buckets Supabase Storage (`app/api/bucket`, `lib/imageUpload.ts`, bucket `documentos` para arquivos).

---

## Anatomia de uma página (siga esta ordem — espelha o financeiro)

```tsx
'use client';
// <Nome> — /painel/<slug>. <1 linha do propósito + pilares + fonte de dados>.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';

// ── Types ──            (todas as entidades da página)
// ── Constants ──        (categorias, status, paleta, PAGE_SIZE, classes inp)
// ── Helpers ──          (ranges de data, agregações, exportCSV)
export default function Page() {
  // estado: loading, needsSetup, userId, filtros, dados, modal
  // useEffect: carrega sessão → busca dados escopados por usuario_id
  // useMemo: KPIs, séries de gráfico, listas filtradas/ordenadas/paginadas
  // render: Header → KPIs → Gráficos → Filtros/Busca → Tabela/Grid → Modais
}
```

Estados obrigatórios em toda página:
1. **Loading** — skeleton/spinner da marca (veja o loading do layout).
2. **Empty / needsSetup** — quando não há dados ou a tabela ainda não existe: card amigável com ícone, 1 frase e CTA ("Adicionar primeiro …"). **Nunca** tela branca ou crash.
3. **Erro** — toast, não `alert()`.
4. **Premium gate** (quando a página for premium) — overlay/blur + CTA para `/painel/planos`, lendo `assinaturas`.

---

## Checklist de qualidade (antes de dizer "pronto")

- [ ] Rota criada em `app/(proprietario)/painel/<slug>/page.tsx` e **link adicionado ao `NAV`** em `layout.tsx` (grupo certo: Geral/Gestão/Conta — ou crie um grupo novo se a spec pedir).
- [ ] Todas as queries filtram por `usuario_id`. RLS + policies entregues como SQL.
- [ ] Sem `R$`/datas/percentuais hardcoded — tudo por `lib/format`.
- [ ] Estados loading / empty / erro / (premium) tratados.
- [ ] Responsivo (mobile→desktop) e acessível (foco, aria, Esc nos modais).
- [ ] Gráficos em SVG puro; ícones SVG inline; nenhuma dependência nova sem necessidade real (se precisar, justifique).
- [ ] Tipagem estrita (sem `any` solto além do `supabaseAny` documentado).
- [ ] Comentário-cabeçalho explicando propósito + fonte de dados (como nas páginas atuais).
- [ ] Build passa (`npm run build`) e, se previewável, verificado no preview com print.
- [ ] Migrations SQL + atualização de `types/supabase.ts` (ou TODO comentado).

---

## O que NÃO fazer

- Não criar uma nova lib de UI/charts/ícones/estado sem necessidade — o projeto é "vanilla + Tailwind + SVG".
- Não duplicar entidades existentes (cliente = `clientes_eventos`; folha já está em `equipe`).
- Não misturar com outros projetos do `C:\Projetos` (isolamento estrito — só Ventsy).
- Não escrever segredos no código; use env vars.
- Não quebrar a página quando a tabela-fonte não existir — degrade para empty-state.

-- ============================================================================
-- Ingressos & Bilheteria — /painel/bilheteria
-- ----------------------------------------------------------------------------
-- Vende ingressos para eventos que o espaço promove/hospeda com bilhetagem:
-- corrida de rua (inscrição + kit), exposição de carros, vaquejada/rodeio, air
-- show, show, festa de igreja com convite pago, feira (ingresso + credencial).
-- Lotes, categorias, cupons, meia-entrada, venda online (Mercado Pago), QR para
-- check-in (integra /painel/acesso) e prestação de contas no Financeiro.
--
--   • `bilheteria_eventos`   — a "loja" de um evento: vitrine + janela de venda.
--   • `ingressos_categorias` — categoria × lote (preço/quantidade próprios; o
--     preço sobe por lote). `vendido` é mantido por TRIGGER (writer-agnostic).
--   • `bilheteria_cupons`    — cupons de desconto (separado do `cupons` global).
--   • `pedidos_ingresso`     — a cesta + o pagamento (MP); agrupa ingressos.
--   • `ingressos`            — 1 entrada, 1 QR; vira credencial no check-in.
--
-- A engine de preço/disponibilidade/agregação vive em lib/bilheteria.ts (pura,
-- testada). O checkout/webhook/check-in AUTORITATIVOS passam por /api/bilheteria
-- (service-role): valida disponibilidade (não vende além da quantidade), cria a
-- preferência do Mercado Pago e, no pagamento aprovado, emite os ingressos +
-- credenciais + lança a receita. O CRUD de bilheteria/categorias/cupons e as
-- emissões manuais (cortesia) são feitos no client via RLS.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) bilheteria_eventos — a loja de ingressos de um evento --------------------
create table if not exists public.bilheteria_eventos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  evento_id      uuid references public.clientes_eventos (id) on delete set null,
  propriedade_id bigint,
  titulo         text not null,
  descricao      text,
  local_texto    text,
  imagem_url     text,
  capacidade     integer not null default 0 check (capacidade >= 0), -- 0 = sem teto global
  venda_inicio   timestamptz,
  venda_fim      timestamptz,
  pagina_token   text not null,                                       -- token público da página
  status         text not null default 'rascunho'
                 check (status in ('rascunho','publicado','encerrado')),
  taxa_servico   numeric(6,4) not null default 0 check (taxa_servico >= 0 and taxa_servico <= 1),
  moeda          text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  campos_extras  jsonb not null default '[]'::jsonb,                  -- perguntas por ingresso
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) ingressos_categorias — categoria × lote (preço sobe por lote) -----------
create table if not exists public.ingressos_categorias (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  bilheteria_id   uuid not null references public.bilheteria_eventos (id) on delete cascade,
  nome            text not null,                          -- 'Pista' | 'Camarote' | 'Inscrição 5k' …
  descricao       text,
  preco_num       numeric(12,2) not null default 0 check (preco_num >= 0),
  quantidade      integer not null default 0 check (quantidade >= 0), -- 0 = ilimitado
  vendido         integer not null default 0,             -- denormalizado (trigger): pago+checkin
  lote            integer not null default 1,             -- onda 1,2,3…
  lote_nome       text,                                   -- '1º lote', 'Lote promocional'…
  ordem           integer not null default 0,
  max_por_pedido  integer not null default 0 check (max_por_pedido >= 0), -- 0 = sem limite
  meia            boolean not null default false,         -- permite meia-entrada
  meia_percent    numeric(4,3) not null default 0.5 check (meia_percent > 0 and meia_percent <= 1),
  por_pessoa      boolean not null default false,         -- exige titular por ingresso
  kit             jsonb,                                  -- corrida: { camiseta:[...], inclui:[...] }
  venda_inicio    timestamptz,
  venda_fim       timestamptz,
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 3) bilheteria_cupons — desconto (percentual/fixo) --------------------------
create table if not exists public.bilheteria_cupons (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  bilheteria_id  uuid not null references public.bilheteria_eventos (id) on delete cascade,
  codigo         text not null,
  tipo           text not null default 'percentual' check (tipo in ('percentual','fixo')),
  valor_num      numeric(12,2) not null default 0 check (valor_num >= 0), -- %:0..100  fixo:moeda
  limite         integer not null default 0 check (limite >= 0),          -- 0 = ilimitado
  usados         integer not null default 0,
  validade       date,                                                    -- inclusive
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 4) pedidos_ingresso — cesta + pagamento (Mercado Pago) ---------------------
create table if not exists public.pedidos_ingresso (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references auth.users (id) on delete cascade,
  bilheteria_id     uuid not null references public.bilheteria_eventos (id) on delete cascade,
  comprador_nome    text not null,
  comprador_email   text,
  comprador_doc     text,
  telefone          text,
  subtotal_num      numeric(12,2) not null default 0,
  desconto_num      numeric(12,2) not null default 0,
  taxa_num          numeric(12,2) not null default 0,
  total_num         numeric(12,2) not null default 0,
  moeda             text not null default 'BRL',
  cupom_id          uuid references public.bilheteria_cupons (id) on delete set null,
  cupom_codigo      text,
  status            text not null default 'pendente'
                    check (status in ('pendente','pago','cancelado','reembolsado','expirado')),
  canal             text not null default 'online' check (canal in ('online','manual','cortesia')),
  mp_payment_id     text,
  mp_preference_id  text,
  mp_status         text,
  pago_em           timestamptz,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- 5) ingressos — 1 entrada, 1 QR (vira credencial no check-in) ---------------
create table if not exists public.ingressos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  bilheteria_id   uuid not null references public.bilheteria_eventos (id) on delete cascade,
  pedido_id       uuid not null references public.pedidos_ingresso (id) on delete cascade,
  categoria_id    uuid not null references public.ingressos_categorias (id) on delete restrict,
  comprador_nome  text,
  comprador_doc   text,
  email           text,
  qr_token        text not null,                          -- payload do QR (único)
  valor_num       numeric(12,2) not null default 0,
  meia            boolean not null default false,
  extras          jsonb,                                  -- respostas dos campos_extras
  status          text not null default 'reservado'
                  check (status in ('reservado','pago','cancelado','checkin')),
  credencial_id   uuid,                                   -- → credenciais (acesso), sem FK rígida
  checkin_em      timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 6) lançamentos: vínculo opcional ao pedido de ingresso (receita) -----------
--    Mesma estratégia de comissoes/contas-pagar: a receita de bilheteria entra
--    em `lancamentos` e referencia o pedido que a originou.
alter table public.lancamentos
  add column if not exists pedido_ingresso_id uuid references public.pedidos_ingresso (id) on delete set null;

-- 7) índices -----------------------------------------------------------------
create unique index if not exists uq_bilheteria_pagina_token on public.bilheteria_eventos (pagina_token);
create index if not exists idx_bilheteria_usuario      on public.bilheteria_eventos (usuario_id);
create index if not exists idx_bilheteria_evento       on public.bilheteria_eventos (usuario_id, evento_id);
create index if not exists idx_bilheteria_status       on public.bilheteria_eventos (usuario_id, status);

create index if not exists idx_ing_cat_bilheteria      on public.ingressos_categorias (bilheteria_id, ordem);
create index if not exists idx_ing_cat_usuario         on public.ingressos_categorias (usuario_id);

create unique index if not exists uq_bilh_cupom_codigo on public.bilheteria_cupons (bilheteria_id, lower(codigo));
create index if not exists idx_bilh_cupom_usuario      on public.bilheteria_cupons (usuario_id);

create index if not exists idx_pedidos_bilheteria      on public.pedidos_ingresso (bilheteria_id, criado_em desc);
create index if not exists idx_pedidos_usuario         on public.pedidos_ingresso (usuario_id);
create index if not exists idx_pedidos_status          on public.pedidos_ingresso (bilheteria_id, status);
create index if not exists idx_pedidos_mp_payment      on public.pedidos_ingresso (mp_payment_id);
create index if not exists idx_pedidos_mp_preference   on public.pedidos_ingresso (mp_preference_id);

create unique index if not exists uq_ingressos_qr_token on public.ingressos (qr_token);
create index if not exists idx_ingressos_bilheteria    on public.ingressos (bilheteria_id);
create index if not exists idx_ingressos_pedido        on public.ingressos (pedido_id);
create index if not exists idx_ingressos_categoria     on public.ingressos (categoria_id);
create index if not exists idx_ingressos_status        on public.ingressos (bilheteria_id, status);
create index if not exists idx_lancamentos_pedido_ing  on public.lancamentos (pedido_ingresso_id);

-- 8) atualizado_em automático (reusa o gatilho genérico, se já existir) ------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_bilheteria_touch on public.bilheteria_eventos;
create trigger trg_bilheteria_touch before update on public.bilheteria_eventos
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_ing_cat_touch on public.ingressos_categorias;
create trigger trg_ing_cat_touch before update on public.ingressos_categorias
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_bilh_cupom_touch on public.bilheteria_cupons;
create trigger trg_bilh_cupom_touch before update on public.bilheteria_cupons
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_pedidos_touch on public.pedidos_ingresso;
create trigger trg_pedidos_touch before update on public.pedidos_ingresso
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_ingressos_touch on public.ingressos;
create trigger trg_ingressos_touch before update on public.ingressos
  for each row execute function public.tg_touch_atualizado_em();

-- 9) `vendido` por TRIGGER (writer-agnostic, como o saldo do Estoque) ---------
--    Vale tanto para o checkout/webhook (service-role) quanto para emissões
--    manuais/cortesia (client via RLS). Conta ingressos pago+checkin.
create or replace function public.tg_recalc_ingressos_vendido()
returns trigger language plpgsql as $$
declare
  v_cat uuid;
begin
  -- recalcula para a(s) categoria(s) afetada(s)
  for v_cat in
    select distinct c from (values (new.categoria_id), (old.categoria_id)) as t(c) where c is not null
  loop
    update public.ingressos_categorias ic
      set vendido = (
        select count(*) from public.ingressos i
        where i.categoria_id = v_cat and i.status in ('pago','checkin')
      )
      where ic.id = v_cat;
  end loop;
  return null;
end $$;

drop trigger if exists trg_ingressos_vendido on public.ingressos;
create trigger trg_ingressos_vendido
  after insert or update of status or delete on public.ingressos
  for each row execute function public.tg_recalc_ingressos_vendido();

-- 10) RLS: o dono vê/edita apenas as próprias linhas -------------------------
--     O acesso PÚBLICO (página de venda, checkout, status do pedido) NÃO usa a
--     anon key: passa por /api/bilheteria com service-role, resolvido pelo
--     `pagina_token`/id do pedido. Por isso não há policy pública aqui.
alter table public.bilheteria_eventos   enable row level security;
alter table public.ingressos_categorias enable row level security;
alter table public.bilheteria_cupons    enable row level security;
alter table public.pedidos_ingresso     enable row level security;
alter table public.ingressos            enable row level security;

drop policy if exists "dono gerencia bilheteria" on public.bilheteria_eventos;
create policy "dono gerencia bilheteria" on public.bilheteria_eventos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia ingressos_categorias" on public.ingressos_categorias;
create policy "dono gerencia ingressos_categorias" on public.ingressos_categorias
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia bilheteria_cupons" on public.bilheteria_cupons;
create policy "dono gerencia bilheteria_cupons" on public.bilheteria_cupons
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia pedidos_ingresso" on public.pedidos_ingresso;
create policy "dono gerencia pedidos_ingresso" on public.pedidos_ingresso
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia ingressos" on public.ingressos;
create policy "dono gerencia ingressos" on public.ingressos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: a guarda anti-oversell e a confirmação de pagamento são da camada
-- de aplicação (engine + /api/bilheteria, service-role). A RLS garante o
-- isolamento multi-tenant; o `vendido` é mantido pelo trigger acima.

-- Fim ------------------------------------------------------------------------

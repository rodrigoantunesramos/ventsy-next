-- ============================================================================
-- Módulos por plano + venda avulsa (add-ons) · Admin → Planos / painel
-- ----------------------------------------------------------------------------
-- Dá ao ADMIN controle total de quais módulos cada plano (básico/pro/ultra)
-- libera, e permite VENDER módulos avulsos por fora (add-ons) — por usuário,
-- com checkout self-service (Mercado Pago) ou liberação manual pelo admin.
--
-- Three movements:
--   1) planos_config.modulos text[] — quais módulos cada plano inclui (espelha
--      o `items text[]` que já existe na mesma tabela). Vazio → o app cai no
--      default do catálogo (lib/modulos.ts).
--   2) modulos_config — metadados por módulo controlados pelo admin: se está
--      ATIVO globalmente, se é VENDÁVEL avulso, o PREÇO avulso/mês, destaque e
--      a cópia de upsell. Alimenta o "header de finanças" do admin e o cadeado.
--   3) usuarios_modulos — add-ons concedidos a um usuário específico (compra
--      avulsa aprovada ou cortesia do admin), com vigência (inicio/fim).
--   + pagamentos.modulo_key — liga um pagamento MP à compra de um add-on.
--
-- A lógica pura (catálogo, default por plano, resolução de entitlement) vive em
-- lib/modulos.ts (testada). Escrita de config é via service-role (rotas admin);
-- o painel do dono LÊ planos_config/modulos_config (público) e as PRÓPRIAS
-- linhas de usuarios_modulos (RLS).
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor).
-- Enquanto types/supabase.ts não é regenerado, o código usa supabaseAny.
-- ============================================================================

-- 1) planos_config.modulos — módulos incluídos em cada plano -----------------
alter table public.planos_config
  add column if not exists modulos text[] not null default '{}'::text[];

-- 2) modulos_config — metadados/preço por módulo (controlado pelo admin) ------
create table if not exists public.modulos_config (
  key           text primary key,                 -- chave estável (== rota /painel/<key>)
  label         text,                             -- rótulo (cache; canônico em lib/modulos.ts)
  grupo         text,                             -- grupo do menu (cache)
  ativo         boolean not null default true,    -- módulo ligado na plataforma (false → some p/ todos)
  vendavel      boolean not null default false,   -- pode ser vendido avulso (add-on)
  preco_avulso  numeric not null default 0 check (preco_avulso >= 0),  -- R$/mês do add-on
  destaque      boolean not null default false,   -- destacar como upsell
  descricao     text,                             -- cópia curta de upsell (cadeado)
  atualizado_em timestamptz not null default now()
);

-- 3) usuarios_modulos — add-ons por usuário (compra avulsa / cortesia) --------
create table if not exists public.usuarios_modulos (
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  modulo_key       text not null,
  status           text not null default 'ativo'
                   check (status in ('ativo','cancelado','pendente')),
  origem           text not null default 'avulso'
                   check (origem in ('avulso','cortesia','admin')),
  inicio           date not null default current_date,
  fim              date,                           -- null = sem expiração; senão vigência do add-on
  valor_pago       numeric not null default 0 check (valor_pago >= 0),
  metodo_pagamento text,
  gateway_ref      text,                           -- mp_payment_id da compra avulsa
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  primary key (usuario_id, modulo_key)
);

-- 4) pagamentos.modulo_key — liga um pagamento MP a um add-on ----------------
alter table public.pagamentos
  add column if not exists modulo_key text;

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_usuarios_modulos_usuario on public.usuarios_modulos (usuario_id);
create index if not exists idx_usuarios_modulos_ativo   on public.usuarios_modulos (usuario_id, status) where status = 'ativo';
create index if not exists idx_modulos_config_vendavel  on public.modulos_config (vendavel) where vendavel = true;

-- 6) atualizado_em automático ------------------------------------------------
create or replace function public.tg_modulos_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_modulos_config_touch on public.modulos_config;
create trigger trg_modulos_config_touch
  before update on public.modulos_config
  for each row execute function public.tg_modulos_touch();

drop trigger if exists trg_usuarios_modulos_touch on public.usuarios_modulos;
create trigger trg_usuarios_modulos_touch
  before update on public.usuarios_modulos
  for each row execute function public.tg_modulos_touch();

-- 7) RLS ---------------------------------------------------------------------
-- modulos_config: leitura pública (cadeado/preço no painel e na pág. pública);
-- escrita só via service-role (rotas admin furam a RLS). Sem policy de escrita.
alter table public.modulos_config enable row level security;

drop policy if exists "publico le modulos_config" on public.modulos_config;
create policy "publico le modulos_config" on public.modulos_config
  for select to anon, authenticated using (true);

-- usuarios_modulos: o dono LÊ os próprios add-ons (entitlement do painel).
-- Escrita só via service-role (webhook de pagamento / concessão do admin).
alter table public.usuarios_modulos enable row level security;

drop policy if exists "dono le proprios modulos" on public.usuarios_modulos;
create policy "dono le proprios modulos" on public.usuarios_modulos
  for select to authenticated using (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

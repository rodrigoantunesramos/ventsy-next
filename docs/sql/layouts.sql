-- ============================================================================
-- Layouts, Plantas & Capacidade — /painel/layouts
-- ----------------------------------------------------------------------------
-- Documenta e planeja o uso FÍSICO do espaço: plantas, SETUPS (auditório,
-- banquete, escolar, U, coquetel, pista…) com CAPACIDADE POR ARRANJO, mapa de
-- mesas/lugares e o posicionamento de palco/bar/estandes num canvas. Ajuda a
-- VENDER (cliente visualiza) e a OPERAR (equipe monta).
--
--   • `layouts`        — uma planta/arranjo de um espaço: setup, capacidade
--     autorizada, área, planta de fundo (imagem) e `elementos` (jsonb com o
--     canvas + mesas/palco/bar/estandes posicionados).
--   • `evento_layout`  — 1:1 com o evento: qual layout foi escolhido + o
--     `mapa_mesas` (convidados por mesa) + ajustes. UNIQUE(evento_id).
--
-- A engine de capacidade/arranjo/ocupação vive em lib/layouts.ts (pura, testada).
-- O CRUD de layouts e a edição do mapa de mesas são feitos no client via RLS. O
-- "aplicar layout ao evento" (get-or-create do evento_layout, race-safe) e o
-- "publicar capacidade no Acesso" passam por /api/layouts (service-role).
--
-- INDEPENDENTE da ordem de migrations: a FK para `espacos` (de reservas) é
-- adicionada condicionalmente (bloco DO no fim), só se a tabela existir.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) layouts — biblioteca de plantas/arranjos por espaço ---------------------
create table if not exists public.layouts (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint references public.propriedades (id) on delete set null,
  espaco_id      bigint,                                  -- → public.espacos (FK condicional no fim)
  nome           text not null,
  tipo_setup     text not null default 'banquete'
                 check (tipo_setup in ('banquete','auditorio','escolar','coquetel',
                                       'formato_u','espinha','conselho','cabare','pista')),
  capacidade     integer check (capacidade is null or capacidade >= 0),  -- autorizada (licença/Acesso)
  area_m2        numeric check (area_m2 is null or area_m2 >= 0),
  planta_url     text,                                    -- imagem de fundo (planta do espaço)
  elementos      jsonb not null default '{}'::jsonb,      -- { largura, altura, itens:[{id,tipo,x,y,w,h,rotacao,rotulo,lugares}] }
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) evento_layout — layout escolhido + mapa de mesas por evento (1:1) -------
--    UNIQUE(evento_id): um layout ativo por evento (a /api/layouts faz
--    get-or-create atômico em cima dessa restrição).
create table if not exists public.evento_layout (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  layout_id     uuid references public.layouts (id) on delete set null,
  mapa_mesas    jsonb not null default '{}'::jsonb,       -- { mesas:{ <elementoId>: [{nome,restricao,grupo}] }, naoAlocados:[…] }
  ajustes       jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (evento_id)
);

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_layouts_usuario      on public.layouts (usuario_id);
create index if not exists idx_layouts_prop         on public.layouts (usuario_id, propriedade_id);
create index if not exists idx_layouts_espaco       on public.layouts (espaco_id);
create index if not exists idx_evento_layout_user   on public.evento_layout (usuario_id);
create index if not exists idx_evento_layout_evento on public.evento_layout (evento_id);
create index if not exists idx_evento_layout_layout on public.evento_layout (layout_id);

-- 4) atualizado_em automático (gatilho genérico, reaproveitado) --------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_layouts_touch on public.layouts;
create trigger trg_layouts_touch
  before update on public.layouts
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_evento_layout_touch on public.evento_layout;
create trigger trg_evento_layout_touch
  before update on public.evento_layout
  for each row execute function public.tg_touch_atualizado_em();

-- 5) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    CRUD de layouts + edição do mapa de mesas vão pelo client via RLS. O
--    "aplicar ao evento" e o "publicar capacidade no Acesso" passam por
--    /api/layouts (service-role, ignora RLS) com validação de posse.
alter table public.layouts        enable row level security;
alter table public.evento_layout  enable row level security;

drop policy if exists "dono gerencia layouts" on public.layouts;
create policy "dono gerencia layouts" on public.layouts
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia evento_layout" on public.evento_layout;
create policy "dono gerencia evento_layout" on public.evento_layout
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FK condicional para `espacos` (só se a migration de Reservas já rodou) ---
--    Mantém este SQL independente da ordem de aplicação das migrations.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'espacos')
     and not exists (select 1 from information_schema.table_constraints
                     where constraint_schema = 'public' and constraint_name = 'layouts_espaco_id_fkey')
  then
    alter table public.layouts
      add constraint layouts_espaco_id_fkey
      foreign key (espaco_id) references public.espacos (id) on delete set null;
  end if;
end $$;

-- Observação: a capacidade autorizada por arranjo "conversa" com /painel/acesso
-- (lotação por zona): a /api/layouts publica a capacidade do layout na zona
-- `geral` (perímetro) do evento em `acesso_zonas`, quando o módulo Acesso está
-- ativo. A regra de negócio (capacidade/ocupação/arranjo) vive na engine
-- lib/layouts.ts; a RLS garante o isolamento multi-tenant.

-- Fim ------------------------------------------------------------------------

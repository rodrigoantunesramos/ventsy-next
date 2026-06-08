-- ============================================================================
-- Catering, Buffet & Bar — /painel/catering
-- ----------------------------------------------------------------------------
-- Gestão de alimentos & bebidas do evento: cardápios/pacotes reutilizáveis com
-- FICHA TÉCNICA (insumos → Estoque), dimensionamento por nº de convidados (gera
-- requisição em Compras), restrições alimentares dos convidados, bar (open bar ×
-- consumação × cash bar) e o custo/CMV por prato/pessoa/evento, com comparativo
-- PREVISTO × REAL (o real vem do consumo baixado no Estoque).
--
-- Convenções (docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num. Sem "R$" no banco.
--   • RLS: o dono vê/edita só as próprias linhas. As gravações cross-módulo
--     (requisição em Compras, baixa no Estoque) passam por /api/catering
--     (service-role). Cardápio/A&B/bar do evento são editados via RLS no client.
--
-- Vínculos opcionais: catering_evento.evento_id -> clientes_eventos,
-- catering_evento.requisicao_id -> requisicoes (Compras). As FKs entram no fim,
-- só se a tabela-alvo existir (blocos DO). produto_id na ficha técnica fica no
-- jsonb (sem FK; casa com produtos do Estoque pela aplicação).
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor).
-- Os tipos no app usam `supabaseAny` enquanto estas tabelas não entram em
-- types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) cardapios (biblioteca global de cardápios/pacotes) ----------------------
--    `itens` (jsonb): array de CardapioItem (ver lib/catering.ts):
--    { id, nome, categoria, porcao_por_pessoa, unidade, custo_num, preco_num,
--      incluso, restricoes[], ficha[] }, onde ficha[] =
--    { produto_id, nome, unidade, qtd_por_pessoa, custo_unit_num, perda_pct }.
create table if not exists public.cardapios (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  nome             text not null,
  tipo             text not null default 'outro'
                   check (tipo in ('coquetel','jantar','almoco','buffet','coffee','brunch','churrasco','lanche','open_bar','outro')),
  itens            jsonb not null default '[]'::jsonb,
  preco_pessoa_num numeric not null default 0 check (preco_pessoa_num >= 0),
  ativo            boolean not null default true,
  obs              text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- 2) catering_evento (A&B do evento — 1:1 com o evento) ----------------------
--    `restricoes` (jsonb): [{ restricao, quantidade }] (convidados por restrição)
--    `consumo_movs` (uuid[]): ids das saídas em estoque_mov geradas na baixa do
--    consumo — usadas para calcular o custo REAL e permitir estorno.
create table if not exists public.catering_evento (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  evento_id          uuid not null,                 -- FK -> clientes_eventos (no fim)
  cardapio_id        uuid references public.cardapios (id) on delete set null,
  convidados         integer not null default 0 check (convidados >= 0),
  fator_ajuste       numeric not null default 1 check (fator_ajuste > 0),
  restricoes         jsonb not null default '[]'::jsonb,
  ajustes            jsonb not null default '[]'::jsonb,  -- itens adicionados/removidos manualmente
  custo_previsto_num numeric not null default 0,
  receita_num        numeric not null default 0,
  custo_real_num     numeric not null default 0,
  requisicao_id      uuid,                          -- FK -> requisicoes (no fim, se existir)
  consumo_movs       uuid[] not null default '{}',
  baixado_em         timestamptz,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 3) bar_evento (bar do evento — 1:1 com o evento) ---------------------------
--    `drinks` (jsonb): array de Drink { id, nome, categoria, custo_num,
--    preco_num, por_pessoa }. `consumo` (jsonb): [{ drink_id, quantidade, perda }].
create table if not exists public.bar_evento (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null,                      -- FK -> clientes_eventos (no fim)
  tipo          text not null default 'sem_bar'
                check (tipo in ('open_bar','consumacao','cash_bar','sem_bar')),
  drinks        jsonb not null default '[]'::jsonb,
  consumo       jsonb not null default '[]'::jsonb,
  perdas_num    numeric not null default 0,
  custo_num     numeric not null default 0,
  receita_num   numeric not null default 0,
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4) índices ------------------------------------------------------------------
create index if not exists idx_cardapios_usuario        on public.cardapios (usuario_id);
create index if not exists idx_cardapios_tipo           on public.cardapios (usuario_id, tipo);

create index if not exists idx_catering_evento_usuario  on public.catering_evento (usuario_id);
-- 1:1 com o evento (race-safe via UNIQUE): get-or-create na /api/catering.
create unique index if not exists idx_catering_evento_evento on public.catering_evento (evento_id);
create index if not exists idx_catering_evento_cardapio on public.catering_evento (cardapio_id);

create index if not exists idx_bar_evento_usuario       on public.bar_evento (usuario_id);
create unique index if not exists idx_bar_evento_evento  on public.bar_evento (evento_id);

-- 5) atualizado_em automático -------------------------------------------------
create or replace function public.tg_catering_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_cardapios_touch on public.cardapios;
create trigger trg_cardapios_touch before update on public.cardapios
  for each row execute function public.tg_catering_touch();

drop trigger if exists trg_catering_evento_touch on public.catering_evento;
create trigger trg_catering_evento_touch before update on public.catering_evento
  for each row execute function public.tg_catering_touch();

drop trigger if exists trg_bar_evento_touch on public.bar_evento;
create trigger trg_bar_evento_touch before update on public.bar_evento
  for each row execute function public.tg_catering_touch();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.cardapios       enable row level security;
alter table public.catering_evento enable row level security;
alter table public.bar_evento      enable row level security;

drop policy if exists "dono gerencia cardapios" on public.cardapios;
create policy "dono gerencia cardapios" on public.cardapios
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia catering_evento" on public.catering_evento;
create policy "dono gerencia catering_evento" on public.catering_evento
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia bar_evento" on public.bar_evento;
create policy "dono gerencia bar_evento" on public.bar_evento
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 7) FKs opcionais (só se as tabelas-alvo existirem) -------------------------
-- catering_evento.evento_id / bar_evento.evento_id -> clientes_eventos
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'clientes_eventos') then
    if not exists (select 1 from pg_constraint where conname = 'catering_evento_evento_id_fkey') then
      alter table public.catering_evento add constraint catering_evento_evento_id_fkey
        foreign key (evento_id) references public.clientes_eventos (id) on delete cascade;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'bar_evento_evento_id_fkey') then
      alter table public.bar_evento add constraint bar_evento_evento_id_fkey
        foreign key (evento_id) references public.clientes_eventos (id) on delete cascade;
    end if;
  end if;
end $$;

-- catering_evento.requisicao_id -> requisicoes (módulo Compras)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'requisicoes')
     and not exists (select 1 from pg_constraint where conname = 'catering_evento_requisicao_id_fkey') then
    alter table public.catering_evento add constraint catering_evento_requisicao_id_fkey
      foreign key (requisicao_id) references public.requisicoes (id) on delete set null;
  end if;
end $$;

-- Fim ------------------------------------------------------------------------

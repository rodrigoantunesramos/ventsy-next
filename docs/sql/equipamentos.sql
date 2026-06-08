-- ============================================================================
-- Equipamentos & Locação de itens — /painel/equipamentos
-- ----------------------------------------------------------------------------
-- Itens que são ALOCADOS/LOCADOS por evento (mesa, cadeira, toalha, tenda,
-- palco, som, gerador, banheiro químico…). Diferente de Ativos (registro
-- patrimonial) e de Estoque (consumível): aqui importa a QUANTIDADE DISPONÍVEL
-- POR DATA e a RESERVA POR EVENTO (o item sai e volta). Pode ser próprio ou
-- sublocado de um fornecedor.
--
--   • `equipamentos`            — o item locável (quantidade total, custo/preço).
--   • `equipamentos_alocacao`   — N unidades reservadas a um evento/reserva num
--     período, com ciclo reservado → separado → em_uso → devolvido (ou avariado).
--
-- A engine de disponibilidade vive em lib/equipamentos.ts (pura, testada):
--     disponível(período) = quantidade_total − PICO de unidades alocadas.
-- As mutações de alocação passam por /api/equipamentos (service-role,
-- autoritativo) que recusa superalocação.
--
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais. Rode no
-- Supabase (SQL Editor) e depois regenere types/supabase.ts (enquanto isso o
-- código usa `supabaseAny`).
-- ============================================================================

-- 1) equipamentos — item locável ---------------------------------------------
create table if not exists public.equipamentos (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  nome               text not null,
  categoria          text not null default 'mobiliario'
                     check (categoria in ('mobiliario','estrutura','som_luz','cozinha',
                                          'sanitario','energia','climatizacao','outro')),
  sku                text,                              -- código interno (opcional)
  unidade            text not null default 'un',        -- un | jogo | kit | m | m2 …
  quantidade_total   integer not null default 0 check (quantidade_total >= 0),
  proprio            boolean not null default true,     -- false = sublocado de fornecedor
  fornecedor_id      uuid,                              -- → fornecedores (se sublocado)
  custo_locacao_num  numeric not null default 0,        -- custo de sublocação por unidade
  preco_locacao_num  numeric not null default 0,        -- preço de locação ao cliente / unidade
  descricao          text,
  foto_url           text,
  ativo              boolean not null default true,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 2) equipamentos_alocacao — reserva por evento (sai e volta) -----------------
--    custo_unit_num / preco_unit_num são FOTOGRAFIAS do item no momento da
--    alocação (não acompanham edições futuras de preço do equipamento).
create table if not exists public.equipamentos_alocacao (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  equipamento_id  uuid not null references public.equipamentos (id) on delete cascade,
  evento_id       uuid references public.clientes_eventos (id) on delete set null,
  reserva_id      uuid references public.reservas (id)         on delete set null,
  quantidade      integer not null default 1 check (quantidade > 0),
  inicio          timestamptz not null,
  fim             timestamptz not null,
  status          text not null default 'reservado'
                  check (status in ('reservado','separado','em_uso','devolvido','avariado','cancelado')),
  qtd_avaria      integer not null default 0 check (qtd_avaria >= 0),
  custo_unit_num  numeric not null default 0,
  preco_unit_num  numeric not null default 0,
  obs             text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  check (fim > inicio)
);

-- 3) FK opcional para fornecedores (módulo pode ainda não ter sido criado) ----
--    Adiciona o vínculo só se a tabela existir, mantendo a ordem de migrations
--    livre e a idempotência.
do $$
begin
  if to_regclass('public.fornecedores') is not null
     and not exists (
       select 1 from pg_constraint where conname = 'equipamentos_fornecedor_id_fkey'
     ) then
    alter table public.equipamentos
      add constraint equipamentos_fornecedor_id_fkey
      foreign key (fornecedor_id) references public.fornecedores (id) on delete set null;
  end if;
end $$;

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_equipamentos_usuario       on public.equipamentos (usuario_id);
create index if not exists idx_equipamentos_categoria     on public.equipamentos (usuario_id, categoria);
create index if not exists idx_equip_aloc_usuario         on public.equipamentos_alocacao (usuario_id);
create index if not exists idx_equip_aloc_equip_periodo   on public.equipamentos_alocacao (equipamento_id, inicio, fim);
create index if not exists idx_equip_aloc_evento          on public.equipamentos_alocacao (evento_id);
create index if not exists idx_equip_aloc_reserva         on public.equipamentos_alocacao (reserva_id);
create index if not exists idx_equip_aloc_status          on public.equipamentos_alocacao (status);

-- 5) atualizado_em automático (reaproveita o gatilho genérico, se já existir) -
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_equipamentos_touch on public.equipamentos;
create trigger trg_equipamentos_touch
  before update on public.equipamentos
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_equip_aloc_touch on public.equipamentos_alocacao;
create trigger trg_equip_aloc_touch
  before update on public.equipamentos_alocacao
  for each row execute function public.tg_touch_atualizado_em();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.equipamentos          enable row level security;
alter table public.equipamentos_alocacao enable row level security;

drop policy if exists "dono gerencia equipamentos" on public.equipamentos;
create policy "dono gerencia equipamentos" on public.equipamentos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia equip_alocacao" on public.equipamentos_alocacao;
create policy "dono gerencia equip_alocacao" on public.equipamentos_alocacao
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: a checagem de superalocação é feita na engine + /api/equipamentos
-- (service-role). A RLS garante isolamento multi-tenant; a regra de negócio
-- (não alocar mais do que existe) é aplicada na camada de aplicação.

-- Fim ------------------------------------------------------------------------

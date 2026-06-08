-- ============================================================================
-- Estoque / Almoxarifado — /painel/estoque
-- ----------------------------------------------------------------------------
-- Controle de insumos consumíveis e descartáveis (bebidas, alimentos,
-- descartáveis, material de limpeza, papelaria, brindes) com saldo em tempo
-- real, estoque mínimo (semáforo), lote/validade (FEFO) e baixa por consumo
-- do evento (estoque_mov.evento_id -> clientes_eventos), alimentando o custo
-- direto do evento na Contabilidade.
--
-- `produtos.estoque_atual` e `produtos.custo_medio_num` são DERIVADOS das
-- movimentações e mantidos de forma AUTORITATIVA pela rota /api/estoque
-- (service-role + motor puro lib/estoque.ts, custo médio móvel). Não recalcule
-- aqui no banco — a API é a fonte de verdade; este SQL só cria o esquema.
--
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- Rode no Supabase (SQL Editor). Os tipos no app usam `supabaseAny` enquanto
-- estas tabelas não entram em types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) produtos -----------------------------------------------------------------
create table if not exists public.produtos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  sku             text,                              -- código interno (opcional)
  nome            text not null,
  categoria       text not null default 'outro',     -- bebidas | alimentos | descartaveis | limpeza | papelaria | brindes | outro
  unidade         text not null default 'un',        -- un | cx | kg | g | l | ml | pct | fardo | ...
  estoque_minimo  numeric not null default 0,        -- gatilho do semáforo/reposição
  estoque_atual   numeric not null default 0,        -- DERIVADO (mantido por /api/estoque)
  custo_medio_num numeric not null default 0,        -- DERIVADO: custo médio móvel
  local           text not null default 'almoxarifado', -- almoxarifado | bar | cozinha | deposito | ...
  perecivel       boolean not null default false,
  ativo           boolean not null default true,
  obs             text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 2) estoque_mov (Kardex: toda entrada/saída/ajuste/perda/transferência) ------
--    Convenção de sinal (aplicada pelo motor lib/estoque.ts):
--      entrada            -> +quantidade  (altera custo médio móvel)
--      saida | perda      -> -quantidade  (valora pelo custo médio vigente)
--      ajuste             ->  quantidade É O DELTA (pode ser negativo)
--      transferencia      ->  não altera o saldo total (move entre locais)
--    `custo_unit_num`/`custo_total_num` são o custo EFETIVO da linha, gravados
--    pela API (entrada = custo informado; saída/perda/ajuste = custo médio).
create table if not exists public.estoque_mov (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  produto_id      uuid not null references public.produtos (id) on delete cascade,
  tipo            text not null default 'entrada'
                  check (tipo in ('entrada', 'saida', 'ajuste', 'perda', 'transferencia')),
  quantidade      numeric not null,
  custo_unit_num  numeric not null default 0,
  custo_total_num numeric not null default 0,
  motivo          text,
  evento_id       uuid references public.clientes_eventos (id) on delete set null, -- consumo por evento
  recebimento_id  uuid,            -- vínculo lógico c/ Compras (módulo futuro; sem FK ainda)
  local_origem    text,
  local_destino   text,            -- transferência: para onde foi
  lote            text,
  validade        date,            -- FEFO (perecíveis)
  criado_em       timestamptz not null default now()
);

-- 3) inventarios (contagem cíclica: contado × sistema -> ajustes) -------------
--    `itens` = [{ produto_id, contado, sistema }]; ao concluir, a API gera uma
--    movimentação de 'ajuste' (delta = contado - sistema) por divergência.
create table if not exists public.inventarios (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  data          date not null default current_date,
  local         text,
  status        text not null default 'aberto'
                check (status in ('aberto', 'concluido', 'cancelado')),
  itens         jsonb not null default '[]'::jsonb,
  ajustes       integer not null default 0,   -- nº de divergências ajustadas
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4) índices ------------------------------------------------------------------
create index if not exists idx_produtos_usuario      on public.produtos (usuario_id);
create index if not exists idx_produtos_categoria    on public.produtos (usuario_id, categoria);
create index if not exists idx_produtos_local        on public.produtos (usuario_id, local);
create unique index if not exists idx_produtos_sku   on public.produtos (usuario_id, sku) where sku is not null;

create index if not exists idx_estoque_mov_usuario   on public.estoque_mov (usuario_id);
create index if not exists idx_estoque_mov_produto   on public.estoque_mov (produto_id, criado_em);
create index if not exists idx_estoque_mov_tipo      on public.estoque_mov (usuario_id, tipo);
create index if not exists idx_estoque_mov_evento    on public.estoque_mov (usuario_id, evento_id);
create index if not exists idx_estoque_mov_validade  on public.estoque_mov (produto_id, validade);

create index if not exists idx_inventarios_usuario   on public.inventarios (usuario_id, data);

-- 5) atualizado_em automático (produtos, inventarios) -------------------------
create or replace function public.tg_estoque_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_produtos_touch on public.produtos;
create trigger trg_produtos_touch
  before update on public.produtos
  for each row execute function public.tg_estoque_touch();

drop trigger if exists trg_inventarios_touch on public.inventarios;
create trigger trg_inventarios_touch
  before update on public.inventarios
  for each row execute function public.tg_estoque_touch();

-- 6) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
--    A leitura (saldo, kardex, FEFO) é feita pelo client via RLS; as gravações
--    de movimentação passam por /api/estoque (service-role, ignora RLS).
alter table public.produtos    enable row level security;
alter table public.estoque_mov enable row level security;
alter table public.inventarios enable row level security;

drop policy if exists "dono gerencia produtos" on public.produtos;
create policy "dono gerencia produtos" on public.produtos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia estoque_mov" on public.estoque_mov;
create policy "dono gerencia estoque_mov" on public.estoque_mov
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia inventarios" on public.inventarios;
create policy "dono gerencia inventarios" on public.inventarios
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

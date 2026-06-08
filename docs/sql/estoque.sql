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
-- movimentações e mantidos por TRIGGER (writer-agnostic) a cada mudança em
-- `estoque_mov` — assim QUALQUER caminho de escrita (a UI/API de Estoque ou o
-- recebimento de Compras, que insere direto) mantém saldo e custo médio móvel
-- consistentes. A lógica do trigger espelha o motor puro lib/estoque.ts (que
-- continua servindo à UI e aos testes). A rota /api/estoque valida regra de
-- saldo/posse; o cálculo é do banco.
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

-- 5b) Saldo + custo médio móvel mantidos por TRIGGER (writer-agnostic) --------
--     Espelha lib/estoque.ts: só ENTRADA altera a média (ponderada); saída/perda
--     valoram pelo médio vigente; ajuste = delta assinado; transferência é neutra
--     no saldo total. Funciona para qualquer gravador de estoque_mov.

-- (i) BEFORE INSERT: valora a linha (custo_unit/custo_total) conforme o tipo.
--     Entrada usa o custo informado; demais usam o custo médio vigente. Isso
--     preenche custo_total mesmo quando o gravador (ex.: Compras) não o envia.
create or replace function public.tg_estoque_mov_valora()
returns trigger language plpgsql as $$
declare
  c_custo numeric := 0;
begin
  select coalesce(custo_medio_num, 0) into c_custo from public.produtos where id = new.produto_id;
  if new.tipo = 'entrada' then
    new.custo_unit_num  := coalesce(new.custo_unit_num, 0);
    new.custo_total_num := round(abs(new.quantidade) * new.custo_unit_num, 2);
  elsif new.tipo in ('saida', 'perda') then
    new.custo_unit_num  := c_custo;
    new.custo_total_num := round(-abs(new.quantidade) * c_custo, 2);
  elsif new.tipo = 'ajuste' then
    new.custo_unit_num  := c_custo;
    new.custo_total_num := round(new.quantidade * c_custo, 2);
  else -- transferencia: neutra no valor
    new.custo_unit_num  := c_custo;
    new.custo_total_num := 0;
  end if;
  return new;
end $$;

drop trigger if exists trg_estoque_mov_valora on public.estoque_mov;
create trigger trg_estoque_mov_valora
  before insert on public.estoque_mov
  for each row execute function public.tg_estoque_mov_valora();

-- (ii) AFTER INSERT/UPDATE/DELETE: recalcula saldo + custo médio do produto a
--      partir de TODO o histórico, em ordem cronológica (idempotente e robusto
--      a exclusões/edições). Custo médio arredondado a centavos a cada entrada,
--      igual a round2 no motor TS.
create or replace function public.tg_estoque_recalc()
returns trigger language plpgsql as $$
declare
  pid   uuid := coalesce(new.produto_id, old.produto_id);
  m     record;
  saldo numeric := 0;
  custo numeric := 0;
  q     numeric;
  novo  numeric;
begin
  for m in
    select tipo, quantidade, custo_unit_num
      from public.estoque_mov
     where produto_id = pid
     order by criado_em asc, id asc
  loop
    if m.tipo = 'entrada' then
      q := abs(m.quantidade);
      novo := saldo + q;
      if saldo > 0 and novo > 0 then
        custo := round((saldo * custo + q * coalesce(m.custo_unit_num, 0)) / novo, 2);
      else
        custo := coalesce(m.custo_unit_num, 0);
      end if;
      saldo := novo;
    elsif m.tipo in ('saida', 'perda') then
      saldo := saldo - abs(m.quantidade);
    elsif m.tipo = 'ajuste' then
      saldo := saldo + m.quantidade;
    end if; -- transferencia: não altera o saldo total
  end loop;

  update public.produtos
     set estoque_atual   = round(saldo, 2),
         custo_medio_num = round(custo, 2)
   where id = pid;
  return null;
end $$;

drop trigger if exists trg_estoque_recalc on public.estoque_mov;
create trigger trg_estoque_recalc
  after insert or update or delete on public.estoque_mov
  for each row execute function public.tg_estoque_recalc();

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

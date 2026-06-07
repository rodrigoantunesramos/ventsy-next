-- ============================================================================
-- Precificação & Tabela de preços — /painel/precificacao
-- ----------------------------------------------------------------------------
-- O motor de receita: como cada espaço é cobrado (tabelas base + unidade),
-- regras dinâmicas (sazonalidade, fim de semana, feriado, tipo de evento,
-- antecedência, duração, nº de convidados), taxas/adicionais e pacotes.
-- Consumido pela mesma engine pura (lib/pricing.ts) que alimenta o Simulador,
-- as Propostas, as Reservas e o anúncio público.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois atualize types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) precos_tabela — valor base + unidade por espaço ------------------------
create table if not exists public.precos_tabela (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  propriedade_id  bigint references public.propriedades (id) on delete cascade, -- espaço (null = padrão da conta)
  espaco_id       bigint,               -- sub-espaço (futuro: tabela `espacos`); sem FK por ora
  nome            text not null,
  base            text not null default 'diaria'
                  check (base in ('diaria','periodo','hora','pessoa','pacote')),
  valor_base_num  numeric not null default 0,
  moeda           text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  custo_num       numeric,              -- custo de referência do dono (margem)
  concorrencia_num numeric,             -- preço de referência da concorrência (manual)
  ativo           boolean not null default true,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 2) precos_regras — ajustes dinâmicos sobre uma tabela ---------------------
create table if not exists public.precos_regras (
  id           uuid primary key default gen_random_uuid(),
  usuario_id   uuid not null references auth.users (id) on delete cascade,  -- denormalizado p/ RLS
  tabela_id    uuid not null references public.precos_tabela (id) on delete cascade,
  nome         text,
  tipo         text not null
               check (tipo in ('temporada','dia_semana','feriado','tipo_evento','antecedencia','duracao','qtd_convidados')),
  condicao     jsonb not null default '{}'::jsonb,
  ajuste_tipo  text not null default 'percentual'
               check (ajuste_tipo in ('percentual','fixo','substitui')),
  ajuste_valor numeric not null default 0,
  prioridade   integer not null default 0,   -- maior prevalece (substitui) / aplica primeiro
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- 3) taxas — catálogo de adicionais (limpeza, segurança, caução…) -----------
create table if not exists public.taxas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint references public.propriedades (id) on delete cascade, -- null = vale p/ todos
  nome           text not null,
  tipo           text not null default 'fixo'
                 check (tipo in ('fixo','percentual','por_pessoa','por_hora')),
  valor          numeric not null default 0,
  obrigatoria    boolean not null default false,
  reembolsavel   boolean not null default false,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- 4) pacotes — combos com preço fechado (espaço + serviços) -----------------
create table if not exists public.pacotes (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint references public.propriedades (id) on delete set null,
  nome           text not null,
  descricao      text,
  itens          jsonb not null default '[]'::jsonb,   -- [{descricao, valor_num?}]
  valor_num      numeric not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_precos_tabela_usuario  on public.precos_tabela (usuario_id);
create index if not exists idx_precos_tabela_prop      on public.precos_tabela (propriedade_id);
create index if not exists idx_precos_regras_usuario   on public.precos_regras (usuario_id);
create index if not exists idx_precos_regras_tabela    on public.precos_regras (tabela_id);
create index if not exists idx_taxas_usuario           on public.taxas (usuario_id);
create index if not exists idx_pacotes_usuario         on public.pacotes (usuario_id);

-- 6) atualizado_em automático (reaproveita/instala o gatilho genérico) -------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_precos_tabela_touch on public.precos_tabela;
create trigger trg_precos_tabela_touch
  before update on public.precos_tabela
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_pacotes_touch on public.pacotes;
create trigger trg_pacotes_touch
  before update on public.pacotes
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.precos_tabela enable row level security;
alter table public.precos_regras enable row level security;
alter table public.taxas         enable row level security;
alter table public.pacotes       enable row level security;

drop policy if exists "dono gerencia precos_tabela" on public.precos_tabela;
create policy "dono gerencia precos_tabela" on public.precos_tabela
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia precos_regras" on public.precos_regras;
create policy "dono gerencia precos_regras" on public.precos_regras
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia taxas" on public.taxas;
create policy "dono gerencia taxas" on public.taxas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia pacotes" on public.pacotes;
create policy "dono gerencia pacotes" on public.pacotes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

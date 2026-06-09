-- ============================================================================
-- Metas & OKR — /painel/metas
-- ----------------------------------------------------------------------------
-- Define metas por ÁREA e PERÍODO e acompanha o REALIZADO automaticamente a
-- partir dos módulos (Financeiro/CRM/Pesquisas/Avaliações), com projeção de
-- fechamento (run-rate) e semáforo. OKRs simples (objetivo + resultados-chave)
-- por trimestre.
--
--   • `metas` — uma meta de uma métrica num período. `periodo` guarda a chave
--               ABSOLUTA canônica ('YYYY-MM' | 'YYYY-Qn' | 'YYYY') — assim o
--               Histórico navega de verdade. `alvo_num` é o objetivo; o realizado
--               é calculado na página a partir da fonte (por isso `realizado_num`
--               é opcional: serve de cache e de valor manual para métricas sem
--               fonte automática, ex.: área Pessoas). `propriedade_id` permite
--               metas por espaço (null = consolidado da conta).
--   • `okrs`  — objetivo do trimestre + KRs em jsonb
--               [{ id, titulo, unidade, inicial, alvo, atual, metrica }].
--
-- REUSO: as três métricas-núcleo do Financeiro (receita, lucro, adimplência)
-- continuam em `metas_financeiras` (mesma convenção do /painel/financeiro) — a
-- página de Metas lê/edita aquela tabela para elas e usa ESTA `metas` para todo
-- o resto. Nada de duplicar receita/lucro/adimplência aqui.
--
-- A matemática (período, run-rate, semáforo, OKR) vive em lib/metas.ts (pura,
-- testada). O CRUD é feito pelo client via RLS — não há rota de API (espelha
-- Seguros): tudo é leitura escopada por usuario_id + escrita do próprio dono.
--
-- INDEPENDENTE da ordem de migrations: propriedade_id (bigint→propriedades) entra
-- como coluna simples; a FK é adicionada DEPOIS, só se a tabela-alvo existir
-- (bloco DO no fim). Idempotente: pode rodar mais de uma vez. Rode no Supabase
-- (SQL Editor) e regenere types/supabase.ts (enquanto isso o código usa
-- `supabaseAny`).
-- ============================================================================

-- 1) metas — alvo por métrica/período (realizado calculado na aplicação) ------
create table if not exists public.metas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  area           text not null default 'comercial'
                 check (area in ('comercial','financeiro','operacional','marketing','pessoas')),
  metrica        text not null,                         -- chave do catálogo lib/metas (eventos, nps, cac…)
  periodo        text not null,                         -- chave absoluta: 'YYYY-MM' | 'YYYY-Qn' | 'YYYY'
  alvo_num       numeric not null default 0,            -- objetivo (sem "R$" — formatação na UI)
  realizado_num  numeric,                               -- cache/valor manual (métricas sem fonte automática)
  responsavel    text,
  propriedade_id bigint,                                -- FK -> propriedades (null = consolidado)
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) okrs — objetivo do trimestre + resultados-chave (jsonb) -------------------
--    krs jsonb: [{ id, titulo, unidade, inicial, alvo, atual, metrica }]
create table if not exists public.okrs (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  objetivo      text not null,
  trimestre     text not null,                          -- chave canônica 'YYYY-Qn'
  krs           jsonb not null default '[]'::jsonb,
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) índices ------------------------------------------------------------------
create index if not exists idx_metas_usuario       on public.metas (usuario_id);
create index if not exists idx_metas_periodo        on public.metas (usuario_id, periodo);
create index if not exists idx_metas_area           on public.metas (usuario_id, area);
create index if not exists idx_metas_prop           on public.metas (propriedade_id);
-- uma meta por métrica/período/escopo (null = consolidado, coalesce p/ unicidade)
create unique index if not exists uq_metas_metrica_periodo
  on public.metas (usuario_id, metrica, periodo, coalesce(propriedade_id, 0));

create index if not exists idx_okrs_usuario         on public.okrs (usuario_id);
create index if not exists idx_okrs_trimestre       on public.okrs (usuario_id, trimestre);

-- 4) atualizado_em automático (gatilho genérico reaproveitado) ----------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_metas_touch on public.metas;
create trigger trg_metas_touch
  before update on public.metas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_okrs_touch on public.okrs;
create trigger trg_okrs_touch
  before update on public.okrs
  for each row execute function public.tg_touch_atualizado_em();

-- 5) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
alter table public.metas enable row level security;
alter table public.okrs  enable row level security;

drop policy if exists "dono gerencia metas" on public.metas;
create policy "dono gerencia metas" on public.metas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia okrs" on public.okrs;
create policy "dono gerencia okrs" on public.okrs
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FK opcional (só se propriedades existir) ---------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'propriedades')
     and not exists (select 1 from pg_constraint where conname = 'metas_propriedade_id_fkey')
  then
    begin
      alter table public.metas
        add constraint metas_propriedade_id_fkey
        foreign key (propriedade_id) references public.propriedades (id) on delete set null;
    exception when others then
      raise notice 'FK metas.propriedade_id -> propriedades não criada (%). Coluna mantida sem FK.', sqlerrm;
    end;
  end if;
end $$;

-- Observação: o cálculo do REALIZADO (lançamentos, clientes_eventos, parcelas,
-- pesquisas_respostas, avaliacoes), a PROJEÇÃO por run-rate, o semáforo e o
-- progresso de OKR vivem na engine lib/metas.ts (pura, testada) + na página. A
-- RLS garante o isolamento multi-tenant; nenhuma rota de API é necessária.

-- Fim ------------------------------------------------------------------------

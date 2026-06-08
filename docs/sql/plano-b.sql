-- ============================================================================
-- Clima & Plano B (eventos outdoor) — /painel/plano-b
-- ----------------------------------------------------------------------------
-- Reduz o risco de eventos ao ar livre: guarda os GATILHOS de contingência por
-- evento (limiares de chuva/vento/calor/frio/tempestade/visibilidade/UV + a ação,
-- a checklist de contingência e o comunicado) e CACHEIA a previsão do tempo do
-- dia/local do evento. A engine que avalia os gatilhos contra a previsão e
-- classifica em verde/amarelo/vermelho vive em lib/plano-b.ts (pura, testada).
--
--   • `plano_contingencia` — um plano por (evento, risco): gatilho jsonb
--     (metrica/operador/atencao/critico/unidade), ação, responsável, status,
--     comunicado_template e a checklist de contingência (jsonb [{label,
--     responsavel, ok}]).
--   • `clima_snapshots`    — cache da previsão por evento (1 linha por evento,
--     UNIQUE(evento_id)): fonte ('open-meteo'|'manual'|…), o resumo normalizado
--     em previsao jsonb e quando foi capturado.
--
-- A busca da previsão na API de meteorologia (Open-Meteo, sem chave) e o cache
-- do snapshot passam por /api/plano-b (service-role). O CRUD de planos e a
-- entrada MANUAL da previsão são feitos pelo client via RLS. O cron
-- /api/cron/clima-eventos atualiza os snapshots dos próximos eventos.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) plano_contingencia — gatilho + ação + contingência + comunicado ---------
create table if not exists public.plano_contingencia (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  evento_id           uuid not null references public.clientes_eventos (id) on delete cascade,
  tipo_risco          text not null default 'chuva'
                      check (tipo_risco in ('chuva','vento','calor','frio','tempestade','baixa_visibilidade','uv')),
  -- gatilho: {metrica, operador('acima'|'abaixo'), atencao, critico, unidade}
  gatilho             jsonb not null default '{}'::jsonb,
  acao                text,
  responsavel         text,
  status              text not null default 'armado'
                      check (status in ('armado','acionado','descartado')),
  comunicado_template text,
  -- checklist de contingência: [{label, responsavel, ok}]
  checklist           jsonb not null default '[]'::jsonb,
  ordem               integer not null default 0,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 2) clima_snapshots — cache da previsão (1 por evento) ----------------------
--    previsao jsonb guarda o ClimaResumo normalizado (lib/plano-b.ts):
--    chuva_prob, vento, rajada, temp_max/min, uv, visibilidade, horas[], etc.
create table if not exists public.clima_snapshots (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  fonte         text not null default 'open-meteo',
  latitude      double precision,
  longitude     double precision,
  dia           date,
  previsao      jsonb not null default '{}'::jsonb,
  capturado_em  timestamptz not null default now(),
  unique (evento_id)
);

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_plano_cont_usuario  on public.plano_contingencia (usuario_id);
create index if not exists idx_plano_cont_evento   on public.plano_contingencia (usuario_id, evento_id);
create index if not exists idx_plano_cont_status   on public.plano_contingencia (evento_id, status);

create index if not exists idx_clima_snap_usuario  on public.clima_snapshots (usuario_id);
create index if not exists idx_clima_snap_evento   on public.clima_snapshots (evento_id);

-- 4) atualizado_em automático (gatilho genérico, reaproveitado) --------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_plano_cont_touch on public.plano_contingencia;
create trigger trg_plano_cont_touch
  before update on public.plano_contingencia
  for each row execute function public.tg_touch_atualizado_em();

-- 5) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    O CRUD de planos e a previsão MANUAL vão pelo client via RLS. A busca da
--    previsão na API de meteo + o cache passam por /api/plano-b (service-role).
alter table public.plano_contingencia enable row level security;
alter table public.clima_snapshots    enable row level security;

drop policy if exists "dono gerencia plano_contingencia" on public.plano_contingencia;
create policy "dono gerencia plano_contingencia" on public.plano_contingencia
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia clima_snapshots" on public.clima_snapshots;
create policy "dono gerencia clima_snapshots" on public.clima_snapshots
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: as coordenadas (latitude/longitude) e a cidade vêm de
-- `propriedades` (já têm essas colunas) via o `propriedade_id` do evento; por
-- isso NÃO duplicamos local aqui. A avaliação de risco (verde/amarelo/vermelho)
-- e o parse da resposta do Open-Meteo são puros (lib/plano-b.ts); a RLS garante
-- o isolamento multi-tenant.

-- Fim ------------------------------------------------------------------------

-- ============================================================================
-- Reservas & Calendário multi-espaço — /painel/reservas + /painel/calendario
-- ----------------------------------------------------------------------------
-- Transforma a agenda num sistema multi-espaço: uma propriedade (ex.: parque de
-- exposições) pode ter vários SUB-ESPAÇOS reserváveis (arena, galpão, camarote,
-- estacionamento, área externa), cada um com sua agenda. Suporta:
--   • reservas firmes, reservas provisórias (HOLD com expiração) e bloqueios
--     (manutenção / indisponibilidade), tudo na MESMA tabela `reservas`;
--   • detecção de conflito por espaço (mesmo espaço não sobrepõe; espaços
--     distintos podem ser simultâneos) com buffer de montagem/desmontagem;
--   • bloqueios recorrentes (ex.: manutenção toda segunda);
--   • feed iCal por propriedade (token estável em `propriedades.ical_token`).
--
-- A engine de conflito vive em lib/reservas.ts (pura, testada). As mutações
-- sensíveis a conflito passam por /api/reservas (service-role, autoritativo).
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois regenere types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) espacos — sub-espaços reserváveis de uma propriedade ---------------------
create table if not exists public.espacos (
  id                 bigint generated always as identity primary key,
  usuario_id         uuid   not null references auth.users (id)      on delete cascade,
  propriedade_id     bigint not null references public.propriedades (id) on delete cascade,
  nome               text   not null,
  tipo               text   not null default 'salao'
                     check (tipo in ('salao','arena','galpao','externa','camarote',
                                     'estacionamento','palco','suite','outro')),
  capacidade         integer,
  area_m2            numeric,
  reservavel_isolado boolean not null default true,  -- pode ser reservado sozinho?
  buffer_minutos     integer not null default 0,      -- montagem/desmontagem entre reservas
  cor                text,                             -- faixa na timeline (#hex)
  ordem              integer not null default 0,
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 2) reservas (ESTENDER) — colunas da camada operacional multi-espaço ---------
-- A tabela já existe (fluxo de marketplace: solicitada/aprovada/paga…). Aqui só
-- ADICIONAMOS colunas — nada é removido, o fluxo público segue intacto.
--   status operacional novo: 'hold' | 'confirmada' | 'bloqueio' | 'manutencao'
--                            | 'cancelada'  (legado de marketplace permanece válido)
--   `inicio`/`fim` (timestamptz) são a faixa de tempo autoritativa da agenda;
--   linhas legadas sem `inicio` caem para data_inicio/data_fim na engine.
alter table public.reservas
  add column if not exists espaco_id      bigint references public.espacos (id)           on delete set null,
  add column if not exists evento_id      uuid   references public.clientes_eventos (id)   on delete set null,
  add column if not exists titulo         text,
  add column if not exists inicio         timestamptz,
  add column if not exists fim            timestamptz,
  add column if not exists hold_expira_em timestamptz,
  add column if not exists origem         text not null default 'manual',  -- 'manual'|'site'|'proposta'
  add column if not exists cor            text,
  add column if not exists obs            text;

-- 3) bloqueios_recorrentes — indisponibilidade semanal (ex.: manutenção) ------
create table if not exists public.bloqueios_recorrentes (
  id             bigint generated always as identity primary key,
  usuario_id     uuid   not null references auth.users (id)          on delete cascade,
  propriedade_id bigint not null references public.propriedades (id) on delete cascade,
  espaco_id      bigint references public.espacos (id)               on delete cascade, -- null = propriedade toda
  dia_semana     integer not null check (dia_semana between 0 and 6),  -- 0=Domingo … 6=Sábado
  hora_inicio    time   not null default '00:00',
  hora_fim       time   not null default '23:59',
  motivo         text,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now()
);

-- 4) propriedades.ical_token — segredo estável do feed .ics por propriedade ---
-- Default volátil → cada linha existente recebe um token único no backfill.
alter table public.propriedades
  add column if not exists ical_token uuid not null default gen_random_uuid();

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_espacos_usuario           on public.espacos (usuario_id);
create index if not exists idx_espacos_prop              on public.espacos (propriedade_id);
create index if not exists idx_reservas_prop_espaco_ini  on public.reservas (propriedade_id, espaco_id, inicio);
create index if not exists idx_reservas_inicio           on public.reservas (inicio);
create index if not exists idx_reservas_hold             on public.reservas (status, hold_expira_em);
create index if not exists idx_bloq_rec_usuario          on public.bloqueios_recorrentes (usuario_id);
create index if not exists idx_bloq_rec_prop             on public.bloqueios_recorrentes (propriedade_id);

-- 6) atualizado_em automático (reaproveita o gatilho genérico) ---------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_espacos_touch on public.espacos;
create trigger trg_espacos_touch
  before update on public.espacos
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.espacos                enable row level security;
alter table public.bloqueios_recorrentes  enable row level security;

drop policy if exists "dono gerencia espacos" on public.espacos;
create policy "dono gerencia espacos" on public.espacos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia bloqueios_recorrentes" on public.bloqueios_recorrentes;
create policy "dono gerencia bloqueios_recorrentes" on public.bloqueios_recorrentes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: a RLS de `reservas` NÃO é alterada aqui (o fluxo de marketplace
-- já define suas policies). As mutações operacionais multi-espaço passam por
-- /api/reservas com service-role, que valida a posse da propriedade pelo dono.

-- Fim ------------------------------------------------------------------------

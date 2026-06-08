-- ============================================================================
-- Logística: Montagem & Desmontagem — /painel/logistica
-- ----------------------------------------------------------------------------
-- Orquestra o FÍSICO antes/depois do evento:
--   • janelas de montagem/desmontagem/ensaio/limpeza que OCUPAM o espaço além do
--     evento em si — cada janela cria/atrela um BLOQUEIO na tabela `reservas`
--     (reserva_id), refletindo a indisponibilidade no Calendário e em Reservas;
--   • agenda de chegada de fornecedores (quem chega quando, por qual doca/portão,
--     o que traz) com fluxo de recebimento;
--   • carga & descarga: controle de docas/portões (a engine detecta choque);
--   • frota própria (veículos/motoristas) e roteiros de transporte de material.
--
-- A lógica sensível a conflito (cronograma físico, choque de docas, conflito de
-- frota) vive em lib/logistica.ts (pura, testada). A criação de JANELAS — que
-- precisa furar a RLS de `reservas` para gravar o bloqueio operacional — passa
-- por /api/logistica (service-role, autoritativo), espelhando /api/reservas.
-- Chegadas e frota são CRUD direto do dono via RLS.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois regenere types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) logistica_janelas — janelas físicas que ocupam o espaço -----------------
--    Cada janela espelha um BLOQUEIO em `reservas` (reserva_id) para que o
--    espaço apareça indisponível na agenda no período de montagem/desmontagem.
create table if not exists public.logistica_janelas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id)            on delete cascade,
  evento_id      uuid   references public.clientes_eventos (id)      on delete set null,
  propriedade_id bigint references public.propriedades (id)          on delete set null,
  espaco_id      bigint references public.espacos (id)               on delete set null,
  reserva_id     uuid   references public.reservas (id)              on delete set null,
  tipo           text not null default 'montagem'
                 check (tipo in ('montagem','desmontagem','ensaio','limpeza')),
  titulo         text,
  inicio         timestamptz not null,
  fim            timestamptz not null,
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) logistica_chegadas — agenda de fornecedores + carga/descarga ------------
--    `previsto` é a hora prevista de chegada; `duracao_min` estima a janela de
--    descarga (a engine usa [previsto, previsto+duracao] p/ detectar choque de
--    doca). `doca` é o portão/doca de recebimento.
create table if not exists public.logistica_chegadas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id)          on delete cascade,
  evento_id     uuid   references public.clientes_eventos (id)    on delete set null,
  fornecedor_id uuid   references public.fornecedores (id)        on delete set null,
  item          text not null,                                    -- o que traz (estrutura, som, buffet…)
  previsto      timestamptz,                                      -- chegada prevista
  duracao_min   integer not null default 30,                      -- janela estimada de descarga
  doca          text,                                             -- doca/portão de recebimento
  veiculo       text,                                             -- tipo/descrição do veículo
  placa         text,
  responsavel   text,                                             -- quem recebe (equipe)
  contato       text,                                             -- contato do motorista/fornecedor
  status        text not null default 'agendado'
                check (status in ('agendado','chegou','descarregando','montado','saiu','cancelado')),
  checklist     jsonb not null default '[]'::jsonb,               -- itens de conferência do recebimento
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) frota — veículos próprios -----------------------------------------------
create table if not exists public.frota (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  tipo               text not null default 'caminhao'
                     check (tipo in ('caminhao','van','carro','onibus','moto','utilitario','outro')),
  nome               text not null,                 -- apelido/identificação ("Caminhão 1")
  placa              text,
  capacidade         numeric,                       -- carga máxima
  capacidade_unidade text not null default 'kg',    -- kg | m3 | lugares | un
  motorista          text,
  motorista_contato  text,
  status             text not null default 'disponivel'
                     check (status in ('disponivel','em_viagem','manutencao','inativo')),
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 4) frota_viagens — roteiros de transporte de material ----------------------
create table if not exists public.frota_viagens (
  id        uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users (id)        on delete cascade,
  frota_id  uuid not null references public.frota (id)       on delete cascade,
  evento_id uuid references public.clientes_eventos (id)     on delete set null,
  origem    text,
  destino   text,
  partida   timestamptz,
  retorno   timestamptz,
  carga     text,                                  -- o que transporta
  status    text not null default 'planejada'
            check (status in ('planejada','em_curso','concluida','cancelada')),
  obs       text,
  criado_em timestamptz not null default now()
);

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_log_janelas_usuario  on public.logistica_janelas (usuario_id);
create index if not exists idx_log_janelas_evento   on public.logistica_janelas (evento_id);
create index if not exists idx_log_janelas_espaco   on public.logistica_janelas (espaco_id, inicio);
create index if not exists idx_log_janelas_reserva  on public.logistica_janelas (reserva_id);
create index if not exists idx_log_chegadas_usuario on public.logistica_chegadas (usuario_id);
create index if not exists idx_log_chegadas_evento  on public.logistica_chegadas (evento_id);
create index if not exists idx_log_chegadas_forn    on public.logistica_chegadas (fornecedor_id);
create index if not exists idx_log_chegadas_doca    on public.logistica_chegadas (doca, previsto);
create index if not exists idx_frota_usuario        on public.frota (usuario_id);
create index if not exists idx_frota_viagens_usuario on public.frota_viagens (usuario_id);
create index if not exists idx_frota_viagens_frota  on public.frota_viagens (frota_id, partida);
create index if not exists idx_frota_viagens_evento on public.frota_viagens (evento_id);

-- 6) atualizado_em automático (reaproveita o gatilho genérico) ---------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_log_janelas_touch on public.logistica_janelas;
create trigger trg_log_janelas_touch
  before update on public.logistica_janelas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_log_chegadas_touch on public.logistica_chegadas;
create trigger trg_log_chegadas_touch
  before update on public.logistica_chegadas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_frota_touch on public.frota;
create trigger trg_frota_touch
  before update on public.frota
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.logistica_janelas  enable row level security;
alter table public.logistica_chegadas enable row level security;
alter table public.frota              enable row level security;
alter table public.frota_viagens      enable row level security;

drop policy if exists "dono gerencia logistica_janelas" on public.logistica_janelas;
create policy "dono gerencia logistica_janelas" on public.logistica_janelas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia logistica_chegadas" on public.logistica_chegadas;
create policy "dono gerencia logistica_chegadas" on public.logistica_chegadas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia frota" on public.frota;
create policy "dono gerencia frota" on public.frota
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia frota_viagens" on public.frota_viagens;
create policy "dono gerencia frota_viagens" on public.frota_viagens
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: as JANELAS gravam um BLOQUEIO em `reservas` (reserva_id) via
-- /api/logistica (service-role), que valida a posse da propriedade/espaço pelo
-- dono — a RLS de `reservas` (fluxo de marketplace) NÃO é alterada aqui.

-- Fim ------------------------------------------------------------------------

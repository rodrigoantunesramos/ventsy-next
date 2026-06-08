-- ============================================================================
-- Segurança, Acesso & Credenciamento — /painel/acesso
-- ----------------------------------------------------------------------------
-- Controla QUEM ENTRA num evento: credenciamento (convidado/equipe/fornecedor/
-- imprensa/VIP/atleta/expositor/piloto…), check-in/out por QR, LOTAÇÃO EM TEMPO
-- REAL por zona × capacidade autorizada (compliance bombeiros), listas e
-- registro de ocorrências de segurança. Vale da festa fechada (lista de
-- convidados) ao evento aberto de milhares (corrida, show, feira).
--
--   • `acesso_zonas`        — áreas com capacidade (perímetro `geral`, camarote,
--     pista, arquibancada…) e regra de acesso por tipo de credencial.
--   • `credenciais`         — a credencial emitida, com QR único e zonas[].
--   • `acesso_eventos_log`  — cada movimento entrada/saída (base da lotação).
--   • `acesso_ocorrencias`  — ocorrências/rondas/achados e perdidos da segurança.
--
-- A engine de autorização/lotação vive em lib/acesso.ts (pura, testada):
--     ocupação(zona) = Σ(+1 entrada / −1 saída); total = perímetro `geral`.
-- O registro de movimento passa por /api/acesso (service-role, autoritativo):
-- valida bloqueio, zona, ANTI-DUPLICIDADE e CAPACIDADE. O CRUD de credenciais/
-- zonas/ocorrências é feito no client via RLS.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) acesso_zonas — áreas com capacidade autorizada -------------------------
--    `codigo` é o identificador estável referenciado por credenciais.zonas[].
--    A zona `geral` representa o perímetro/total do evento.
create table if not exists public.acesso_zonas (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references auth.users (id) on delete cascade,
  evento_id         uuid references public.clientes_eventos (id) on delete cascade,
  codigo            text not null,                       -- 'geral' | 'camarote' | 'pista' …
  nome              text not null,
  capacidade        integer not null default 0 check (capacidade >= 0), -- 0 = sem limite
  tipos_permitidos  text[] not null default '{}',        -- vazio = todos os tipos
  cor               text,
  ordem             integer not null default 0,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- 2) credenciais — a credencial emitida (QR único, zonas autorizadas) --------
create table if not exists public.credenciais (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users (id) on delete cascade,
  evento_id             uuid references public.clientes_eventos (id) on delete cascade,
  tipo                  text not null default 'convidado'
                        check (tipo in ('convidado','vip','equipe','organizacao','seguranca',
                                        'fornecedor','imprensa','autoridade','atleta',
                                        'expositor','piloto','artista')),
  nome                  text not null,
  doc                   text,                            -- documento/identificação
  empresa               text,                            -- fornecedor/imprensa/expositor
  categoria_ingresso_id uuid,                            -- → bilheteria (módulo futuro), sem FK
  qr_token              text not null,                   -- token embutido no QR (único)
  zonas                 text[] not null default '{}',    -- códigos de zona; 'todas' = total
  status                text not null default 'emitida'
                        check (status in ('emitida','checkin','checkout','bloqueada')),
  foto_url              text,
  obs                   text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

-- 3) acesso_eventos_log — movimentos (entrada/saída) → lotação em tempo real -
create table if not exists public.acesso_eventos_log (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  evento_id      uuid references public.clientes_eventos (id) on delete cascade,
  credencial_id  uuid references public.credenciais (id) on delete set null,
  zona           text not null default 'geral',
  ponto          text,                                   -- 'portao_a' | 'catraca_1' …
  direcao        text not null check (direcao in ('entrada','saida')),
  criado_em      timestamptz not null default now()
);

-- 4) acesso_ocorrencias — segurança (ocorrência/ronda/achado e perdido) ------
create table if not exists public.acesso_ocorrencias (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  evento_id      uuid references public.clientes_eventos (id) on delete cascade,
  tipo           text not null default 'ocorrencia'
                 check (tipo in ('ocorrencia','ronda','achado_perdido','emergencia')),
  titulo         text not null,
  descricao      text,
  gravidade      text not null default 'media'
                 check (gravidade in ('baixa','media','alta','critica')),
  local          text,
  responsavel    text,
  status         text not null default 'aberta'
                 check (status in ('aberta','em_andamento','resolvida')),
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 5) índices -----------------------------------------------------------------
create unique index if not exists uq_credenciais_qr_token on public.credenciais (qr_token);
create index if not exists idx_credenciais_usuario     on public.credenciais (usuario_id);
create index if not exists idx_credenciais_evento      on public.credenciais (usuario_id, evento_id);
create index if not exists idx_credenciais_status      on public.credenciais (usuario_id, status);
create index if not exists idx_credenciais_tipo        on public.credenciais (usuario_id, tipo);

create unique index if not exists uq_acesso_zonas_codigo
  on public.acesso_zonas (usuario_id, evento_id, codigo) where evento_id is not null;
create index if not exists idx_acesso_zonas_evento     on public.acesso_zonas (usuario_id, evento_id);

create index if not exists idx_acesso_log_usuario      on public.acesso_eventos_log (usuario_id);
create index if not exists idx_acesso_log_evento_tempo on public.acesso_eventos_log (evento_id, criado_em);
create index if not exists idx_acesso_log_credencial   on public.acesso_eventos_log (credencial_id);
create index if not exists idx_acesso_log_evento_zona  on public.acesso_eventos_log (evento_id, zona, criado_em);

create index if not exists idx_acesso_ocorr_evento     on public.acesso_ocorrencias (usuario_id, evento_id);
create index if not exists idx_acesso_ocorr_status     on public.acesso_ocorrencias (usuario_id, status);

-- 6) atualizado_em automático (reaproveita o gatilho genérico, se já existir) -
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_acesso_zonas_touch on public.acesso_zonas;
create trigger trg_acesso_zonas_touch
  before update on public.acesso_zonas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_credenciais_touch on public.credenciais;
create trigger trg_credenciais_touch
  before update on public.credenciais
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_acesso_ocorr_touch on public.acesso_ocorrencias;
create trigger trg_acesso_ocorr_touch
  before update on public.acesso_ocorrencias
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.acesso_zonas        enable row level security;
alter table public.credenciais         enable row level security;
alter table public.acesso_eventos_log  enable row level security;
alter table public.acesso_ocorrencias  enable row level security;

drop policy if exists "dono gerencia acesso_zonas" on public.acesso_zonas;
create policy "dono gerencia acesso_zonas" on public.acesso_zonas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia credenciais" on public.credenciais;
create policy "dono gerencia credenciais" on public.credenciais
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia acesso_log" on public.acesso_eventos_log;
create policy "dono gerencia acesso_log" on public.acesso_eventos_log
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia acesso_ocorrencias" on public.acesso_ocorrencias;
create policy "dono gerencia acesso_ocorrencias" on public.acesso_ocorrencias
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: a anti-duplicidade e o bloqueio por capacidade são aplicados na
-- engine + /api/acesso (service-role). A RLS garante o isolamento multi-tenant;
-- a regra de negócio (não exceder a lotação) é da camada de aplicação.

-- Fim ------------------------------------------------------------------------

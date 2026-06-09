-- ============================================================================
-- Campanhas (disparo em massa) · /painel/campanhas
-- ----------------------------------------------------------------------------
-- Cria e dispara mensagens em massa para segmentos de clientes (e-mail e/ou
-- WhatsApp), com templates, agendamento e métricas. O público é resolvido a
-- partir de `clientes`/`clientes_eventos` (segmentação RFM feita no painel) e
-- MATERIALIZADO em `campanhas_envios` na hora de enviar/agendar — assim a fila é
-- processada de forma assíncrona (app/api/campanhas/enviar + cron) sem recomputar
-- segmento e respeitando o opt-out (`descadastros`).
--
-- Rastreamento de abertura/clique/descadastro é gravado por app/api/track (GET,
-- service-role) — por isso `campanhas_envios`/`descadastros` NÃO têm policy anon:
-- o visitante anônimo entra exclusivamente pela API. O dono lê/cria via RLS.
--
-- Dinheiro: NÃO há "R$" aqui — campanha não carrega valores monetários crus.
--
-- Idempotente: CRIA se faltar e ADICIONA colunas/índices/policies sem erro se já
-- existirem (rode quantas vezes quiser). Depois atualize types/supabase.ts.
-- ============================================================================

-- 1) campanhas ---------------------------------------------------------------
create table if not exists public.campanhas (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,   -- dono
  nome            text not null,
  canal           text not null default 'email'
                    check (canal in ('email', 'whatsapp', 'sms')),
  assunto         text,                            -- linha de assunto (e-mail)
  corpo           text not null default '',        -- html/text com variáveis {{nome}} {{evento}} {{empresa}}
  segmento        jsonb not null default '{}'::jsonb,  -- filtros do público (ver lib/campanhas)
  agendada_para   timestamptz,                     -- quando status='agendada'
  status          text not null default 'rascunho'
                    check (status in ('rascunho', 'agendada', 'enviando', 'enviada', 'pausada')),
  enviada_em      timestamptz,
  -- contadores de rollup (atualizados pela API de envio/track) p/ a lista não
  -- precisar agregar campanhas_envios a cada carregamento.
  n_total         integer not null default 0,
  n_enviados      integer not null default 0,
  n_entregues     integer not null default 0,
  n_abertos       integer not null default 0,
  n_clicados      integer not null default 0,
  n_falhas        integer not null default 0,
  n_descadastros  integer not null default 0,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- Extensão idempotente (ambientes onde a tabela já existia antes da spec).
alter table public.campanhas add column if not exists assunto        text;
alter table public.campanhas add column if not exists corpo          text not null default '';
alter table public.campanhas add column if not exists segmento       jsonb not null default '{}'::jsonb;
alter table public.campanhas add column if not exists agendada_para  timestamptz;
alter table public.campanhas add column if not exists enviada_em     timestamptz;
alter table public.campanhas add column if not exists n_total        integer not null default 0;
alter table public.campanhas add column if not exists n_enviados     integer not null default 0;
alter table public.campanhas add column if not exists n_entregues    integer not null default 0;
alter table public.campanhas add column if not exists n_abertos      integer not null default 0;
alter table public.campanhas add column if not exists n_clicados     integer not null default 0;
alter table public.campanhas add column if not exists n_falhas       integer not null default 0;
alter table public.campanhas add column if not exists n_descadastros integer not null default 0;
alter table public.campanhas add column if not exists atualizado_em  timestamptz not null default now();

-- 2) campanhas_envios (fila + estado por destinatário) -----------------------
create table if not exists public.campanhas_envios (
  id          uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas (id) on delete cascade,
  usuario_id  uuid not null references auth.users (id) on delete cascade,  -- p/ RLS direta
  cliente_id  uuid references public.clientes (id) on delete set null,
  contato     text not null,                       -- e-mail ou telefone (dígitos) do destinatário
  nome        text,                                -- snapshot p/ exibição
  vars        jsonb not null default '{}'::jsonb,  -- snapshot { nome, evento, empresa } p/ interpolar
  status      text not null default 'fila'
                check (status in ('fila', 'enviado', 'entregue', 'aberto', 'clicado', 'falha', 'descadastrado')),
  enviado_em  timestamptz,
  aberto_em   timestamptz,
  clicado_em  timestamptz,
  erro        text,
  criado_em   timestamptz not null default now()
);

alter table public.campanhas_envios add column if not exists cliente_id uuid;
alter table public.campanhas_envios add column if not exists nome       text;
alter table public.campanhas_envios add column if not exists vars       jsonb not null default '{}'::jsonb;
alter table public.campanhas_envios add column if not exists aberto_em  timestamptz;
alter table public.campanhas_envios add column if not exists clicado_em timestamptz;
alter table public.campanhas_envios add column if not exists erro       text;

-- 3) descadastros (opt-out — respeitado em todo envio) -----------------------
create table if not exists public.descadastros (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  cliente_id  uuid references public.clientes (id) on delete set null,
  contato     text not null,                       -- e-mail/telefone que pediu opt-out
  canal       text not null default 'email'
                check (canal in ('email', 'whatsapp', 'sms')),
  criado_em   timestamptz not null default now(),
  unique (usuario_id, contato, canal)              -- idempotente: 1 opt-out por contato/canal
);

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_campanhas_usuario        on public.campanhas (usuario_id);
create index if not exists idx_campanhas_status         on public.campanhas (status);
create index if not exists idx_campanhas_agendada       on public.campanhas (agendada_para)
  where status = 'agendada';
create index if not exists idx_campanhas_criado_em      on public.campanhas (criado_em desc);
create index if not exists idx_camp_envios_campanha     on public.campanhas_envios (campanha_id);
create index if not exists idx_camp_envios_usuario      on public.campanhas_envios (usuario_id);
-- a fila do processador: próximos da campanha em status 'fila'
create index if not exists idx_camp_envios_fila         on public.campanhas_envios (campanha_id)
  where status = 'fila';
create index if not exists idx_descadastros_usuario     on public.descadastros (usuario_id);
create index if not exists idx_descadastros_contato     on public.descadastros (usuario_id, contato);

-- 5) atualizado_em automático ------------------------------------------------
create or replace function public.tg_campanhas_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_campanhas_touch on public.campanhas;
create trigger trg_campanhas_touch
  before update on public.campanhas
  for each row execute function public.tg_campanhas_touch();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    Aberturas/cliques/descadastros vêm do anônimo APENAS via app/api/track
--    (service-role), então não há policy para 'anon' aqui.
alter table public.campanhas        enable row level security;
alter table public.campanhas_envios enable row level security;
alter table public.descadastros     enable row level security;

drop policy if exists "dono gerencia campanhas" on public.campanhas;
create policy "dono gerencia campanhas" on public.campanhas
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia campanhas_envios" on public.campanhas_envios;
create policy "dono gerencia campanhas_envios" on public.campanhas_envios
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia descadastros" on public.descadastros;
create policy "dono gerencia descadastros" on public.descadastros
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

-- ============================================================================
-- Central de Integrações — /painel/integracoes
-- ----------------------------------------------------------------------------
-- A camada onde o dono CONECTA serviços externos que as outras páginas consomem
-- (pagamento, e-mail, WhatsApp, NFS-e, calendário, meteorologia, assinatura,
-- contabilidade, IA), assina WEBHOOKS de saída e gera CHAVES de API próprias.
--
-- Princípio de segurança (acceptance: "segredos nunca chegam ao client"):
--   • Cada SEGREDO mora num cofre com RLS HABILITADA e SEM policy — assim o
--     navegador (anon/auth key) NUNCA lê a tabela; só as rotas de API
--     (service-role) leem/gravam. Mesmo padrão de `fiscal_provedores`/`host_mp`.
--   • Os METADADOS não-secretos (status, último uso, erro, config pública) ficam
--     em `integracoes_conexoes`, essa sim com policy do dono (sem segredo dentro).
--
-- Federação: Mercado Pago continua em `host_mp` (OAuth), NFS-e em
-- `fiscal_provedores` e a chave de IA (BYOK) em `integracoes`. Estas tabelas NÃO
-- duplicam esses segredos — guardam apenas o cofre GENÉRICO + o status unificado.
--
-- Cinco tabelas:
--   • integracoes_conexoes      — status/saúde + config NÃO-secreta por serviço.
--   • integracoes_segredos      — cofre de segredos dos serviços genéricos.
--   • integracoes_webhooks      — assinaturas de webhook de saída (com segredo).
--   • integracoes_webhooks_log  — entregas e retentativas (assinatura + backoff).
--   • integracoes_chaves        — API keys do dono (guardamos só o HASH).
--
-- A engine que valida/mascara/agenda retentativa vive em lib/integracoes.ts
-- (pura, testada). A entrega assinada (HMAC) vive em lib/webhooksServer.ts.
--
-- Convenções (docs/prompts/00-contexto-base.md): snake_case PT; usuario_id (dono);
-- criado_em/atualizado_em. Idempotente — rode no Supabase (SQL Editor) e regenere
-- types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) integracoes_conexoes — status/saúde + config pública (SEM segredo) --------
create table if not exists public.integracoes_conexoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  chave         text not null,            -- 'mercadopago' | 'smtp' | 'whatsapp' | ...
  status        text not null default 'desconectado'
                check (status in ('conectado','desconectado','erro')),
  -- Config NÃO-secreta: smtp host/porta/usuário, modelo de IA, e-mail do contador…
  config        jsonb not null default '{}'::jsonb,
  conectado_em  timestamptz,
  ultimo_uso    timestamptz,
  ultimo_erro   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, chave)
);

-- 2) integracoes_segredos — COFRE (RLS sem policy: só service-role) ------------
create table if not exists public.integracoes_segredos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  chave         text not null,
  -- { senha, token, api_key, api_token, ... } — NUNCA volta cru ao client.
  segredo       jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  unique (usuario_id, chave)
);

-- 3) integracoes_webhooks — assinaturas de saída (contém o segredo de assinatura)
create table if not exists public.integracoes_webhooks (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento        text not null,            -- ex.: 'pagamento.aprovado' (lib/integracoes)
  url           text not null,
  -- Segredo de assinatura HMAC. Mostrado UMA vez na criação; depois só os 4 últimos.
  segredo       text not null,
  ativo         boolean not null default true,
  descricao     text,
  ultimo_status integer,                  -- último HTTP status de entrega
  ultimo_em     timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4) integracoes_webhooks_log — entregas + retentativas ------------------------
create table if not exists public.integracoes_webhooks_log (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  webhook_id          uuid not null references public.integracoes_webhooks (id) on delete cascade,
  evento              text not null,
  tentativa           integer not null default 1,
  http_status         integer not null default 0,
  ok                  boolean not null default false,
  erro                text,
  payload             jsonb,
  proxima_tentativa_em timestamptz,       -- preenchida quando agenda retentativa
  criado_em           timestamptz not null default now()
);

-- 5) integracoes_chaves — API keys do dono (guardamos só o HASH) ---------------
create table if not exists public.integracoes_chaves (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  nome        text not null,
  prefixo     text not null,              -- ex.: 'vsk_live_ab12' (exibível)
  last4       text not null,              -- 4 últimos (exibível)
  token_hash  text not null,             -- sha256 do token completo (verificação)
  escopos     text[] not null default '{}',
  rate_limit  integer,                    -- req/min (opcional)
  ultimo_uso  timestamptz,
  revogada    boolean not null default false,
  criado_em   timestamptz not null default now(),
  unique (token_hash)
);

-- 6) índices ------------------------------------------------------------------
create index if not exists idx_integ_conexoes_usuario on public.integracoes_conexoes (usuario_id);
create index if not exists idx_integ_segredos_usuario on public.integracoes_segredos (usuario_id);
create index if not exists idx_integ_webhooks_usuario on public.integracoes_webhooks (usuario_id);
create index if not exists idx_integ_webhooks_evento  on public.integracoes_webhooks (usuario_id, evento, ativo);
create index if not exists idx_integ_wlog_usuario     on public.integracoes_webhooks_log (usuario_id);
create index if not exists idx_integ_wlog_webhook     on public.integracoes_webhooks_log (webhook_id);
-- Retentativas pendentes (cron): entregas não-ok com próxima tentativa agendada.
create index if not exists idx_integ_wlog_pendentes   on public.integracoes_webhooks_log (proxima_tentativa_em)
  where ok = false and proxima_tentativa_em is not null;
create index if not exists idx_integ_chaves_usuario   on public.integracoes_chaves (usuario_id);

-- 7) atualizado_em automático -------------------------------------------------
create or replace function public.tg_integracoes_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_integ_conexoes_touch on public.integracoes_conexoes;
create trigger trg_integ_conexoes_touch
  before update on public.integracoes_conexoes
  for each row execute function public.tg_integracoes_touch();

drop trigger if exists trg_integ_segredos_touch on public.integracoes_segredos;
create trigger trg_integ_segredos_touch
  before update on public.integracoes_segredos
  for each row execute function public.tg_integracoes_touch();

drop trigger if exists trg_integ_webhooks_touch on public.integracoes_webhooks;
create trigger trg_integ_webhooks_touch
  before update on public.integracoes_webhooks
  for each row execute function public.tg_integracoes_touch();

-- 8) RLS ----------------------------------------------------------------------
-- conexoes: SEM segredo → o dono pode ler/editar (policy). As rotas de API
-- (service-role) também escrevem aqui, mas isso ignora RLS de qualquer forma.
alter table public.integracoes_conexoes enable row level security;
drop policy if exists "dono gerencia conexoes" on public.integracoes_conexoes;
create policy "dono gerencia conexoes" on public.integracoes_conexoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- COFRES e tabelas com segredo: RLS habilitada e SEM policy → o navegador nunca
-- lê. Todo acesso passa pelas rotas de API (service-role) que mascaram a saída.
alter table public.integracoes_segredos     enable row level security;
alter table public.integracoes_webhooks     enable row level security;
alter table public.integracoes_webhooks_log enable row level security;
alter table public.integracoes_chaves       enable row level security;
-- (intencionalmente sem create policy nestas quatro)

-- Fim ------------------------------------------------------------------------

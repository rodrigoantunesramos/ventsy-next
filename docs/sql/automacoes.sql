-- ============================================================================
-- Automações & Notificações · /painel/automacoes
-- ----------------------------------------------------------------------------
-- Regras "se isto, então aquilo" (gatilho → condição → ação) que costuram os
-- módulos (Cobrança, Contratos, Feedback, Licenças, CRM…) + a central de
-- notificações/lembretes (sino in-app). O motor puro vive em lib/automacoes.ts;
-- o processador temporal é app/api/cron/automacoes (registrado no pg_cron abaixo)
-- e o "testar agora" é app/api/automacoes — ambos varrem o estado atual do banco,
-- DEDUPLICAM via `automacoes_log` (1 disparo por automação×alvo×dia) e executam a
-- ação (in-app/e-mail/WhatsApp).
--
-- Dinheiro: NÃO há "R$" aqui — valores monetários trafegam crus e a formatação
-- (lib/format) fica em quem exibe/envia.
--
-- Idempotente: CRIA se faltar e ADICIONA colunas/índices/policies sem erro se já
-- existirem (rode quantas vezes quiser). Depois atualize types/supabase.ts.
-- ============================================================================

-- 1) automacoes (as regras) --------------------------------------------------
create table if not exists public.automacoes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,   -- dono
  nome          text not null,
  gatilho       text not null
                  check (gatilho in (
                    'evento_criado', 'x_dias_antes_evento', 'x_dias_apos_evento',
                    'parcela_vence', 'parcela_atrasa', 'contrato_nao_assinado',
                    'feedback_negativo', 'aniversario_cliente', 'licenca_a_vencer'
                  )),
  condicao      jsonb not null default '{}'::jsonb,   -- { dias, propriedade_id, tipos_evento[], status[], valor_min, nota_max }
  acao          text not null default 'notificar'
                  check (acao in ('notificar', 'enviar_email', 'enviar_whatsapp', 'criar_tarefa', 'mover_funil')),
  acao_config   jsonb not null default '{}'::jsonb,   -- { destinatario, titulo, mensagem, urgencia, novo_status, link }
  ativo         boolean not null default true,
  ultima_exec   timestamptz,
  n_exec        integer not null default 0,           -- total de execuções (rollup)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.automacoes add column if not exists condicao    jsonb   not null default '{}'::jsonb;
alter table public.automacoes add column if not exists acao_config jsonb   not null default '{}'::jsonb;
alter table public.automacoes add column if not exists ativo       boolean not null default true;
alter table public.automacoes add column if not exists ultima_exec timestamptz;
alter table public.automacoes add column if not exists n_exec      integer not null default 0;
alter table public.automacoes add column if not exists atualizado_em timestamptz not null default now();

-- 2) automacoes_log (execuções — auditoria + idempotência) -------------------
--    `dedup_key` = "<automacao_id>|<alvo_id>|<YYYY-MM-DD>" garante que a mesma
--    regra não dispare 2× para o mesmo alvo no mesmo dia (índice único parcial).
create table if not exists public.automacoes_log (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  automacao_id  uuid references public.automacoes (id) on delete set null,
  gatilho       text,
  acao          text,
  alvo_tipo     text,                                 -- evento|parcela|contrato|cliente|licenca|feedback
  alvo_id       text,
  alvo_label    text,
  dedup_key     text not null,
  canal         text,                                 -- app|email|whatsapp
  sucesso       boolean not null default true,
  detalhe       text,                                 -- erro/observação (sem segredos)
  criado_em     timestamptz not null default now()
);

alter table public.automacoes_log add column if not exists alvo_label text;
alter table public.automacoes_log add column if not exists canal      text;
alter table public.automacoes_log add column if not exists detalhe    text;

-- 3) notificacoes (central in-app — o "sino") --------------------------------
create table if not exists public.notificacoes (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  tipo        text not null default 'sistema',        -- parcela|contrato|evento|licenca|feedback|tarefa|cliente|sistema|<gatilho>
  titulo      text not null,
  corpo       text,
  link        text,                                   -- rota interna (ex.: /painel/recebiveis)
  urgencia    text not null default 'info'
                check (urgencia in ('info', 'sucesso', 'alerta', 'critico')),
  origem      text,                                   -- 'automacao:<id>' | 'sistema'
  lida        boolean not null default false,
  criado_em   timestamptz not null default now()
);

alter table public.notificacoes add column if not exists link     text;
alter table public.notificacoes add column if not exists urgencia text not null default 'info';
alter table public.notificacoes add column if not exists origem   text;

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_automacoes_usuario     on public.automacoes (usuario_id);
create index if not exists idx_automacoes_ativo       on public.automacoes (ativo) where ativo = true;
create index if not exists idx_automacoes_gatilho     on public.automacoes (gatilho);

create index if not exists idx_aut_log_usuario        on public.automacoes_log (usuario_id);
create index if not exists idx_aut_log_automacao      on public.automacoes_log (automacao_id);
create index if not exists idx_aut_log_criado_em      on public.automacoes_log (criado_em desc);
-- idempotência: 1 linha por chave de dedup (a 2ª inserção do dia falha → ignorada).
create unique index if not exists uq_aut_log_dedup    on public.automacoes_log (dedup_key);

create index if not exists idx_notif_usuario          on public.notificacoes (usuario_id);
create index if not exists idx_notif_criado_em        on public.notificacoes (criado_em desc);
-- contagem rápida do badge "não lidas" do sino.
create index if not exists idx_notif_nao_lidas        on public.notificacoes (usuario_id) where lida = false;

-- 5) atualizado_em automático em `automacoes` --------------------------------
create or replace function public.tg_automacoes_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_automacoes_touch on public.automacoes;
create trigger trg_automacoes_touch
  before update on public.automacoes
  for each row execute function public.tg_automacoes_touch();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    O processador (cron) e o "testar agora" usam service-role (ignora RLS) —
--    por isso não há policy para 'anon'. O dono cria/edita automações e lê o log
--    e as notificações via RLS; também pode marcar notificações como lidas.
alter table public.automacoes     enable row level security;
alter table public.automacoes_log enable row level security;
alter table public.notificacoes   enable row level security;

drop policy if exists "dono gerencia automacoes" on public.automacoes;
create policy "dono gerencia automacoes" on public.automacoes
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono le automacoes_log" on public.automacoes_log;
create policy "dono le automacoes_log" on public.automacoes_log
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia notificacoes" on public.notificacoes;
create policy "dono gerencia notificacoes" on public.notificacoes
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- ============================================================================
-- 7) Agendamento no pg_cron (mesma infra de docs/sql/cron-pg_cron.sql)
-- ----------------------------------------------------------------------------
-- Pré-requisito: docs/sql/cron-pg_cron.sql já rodou (cria a extensão pg_cron/
-- pg_net, o segredo no Vault e a função private.disparar_cron). Aqui só
-- adicionamos o job diário das automações. cron.schedule faz upsert por nome →
-- idempotente. Horário em UTC (08:30 UTC ≈ 05:30 BRT) — cedo, antes do expediente.
--
-- select cron.schedule('automacoes', '30 8 * * *',
--   $cmd$ select private.disparar_cron('/api/cron/automacoes') $cmd$);
--
-- Teste manual (não grava — só conta o que dispararia):
--   select private.disparar_cron('/api/cron/automacoes?dry=1');
-- Desagendar:
--   select cron.unschedule('automacoes');
-- ============================================================================

-- Fim ------------------------------------------------------------------------

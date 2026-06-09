-- ============================================================================
-- Portal do Cliente (área do contratante) · /painel/portal + (client)/eventos
-- ----------------------------------------------------------------------------
-- Dá ao CONTRATANTE uma área logada para acompanhar o PRÓPRIO evento: resumo,
-- financeiro (parcelas + pagar via Mercado Pago), contrato (ver/assinar),
-- briefing, cronograma, lista de convidados (RSVP), documentos e mensagens.
-- Reaproveita o route group (client) e as tabelas-âncora existentes
-- (clientes_eventos, parcelas, contratos, conversas) — NÃO as recria.
--
-- Esta migration cria só as 3 peças que faltavam:
--   • portal_config  — preferências do PORTAL por dono (ativo, cor, boas-vindas,
--                      módulos visíveis por padrão). 1 linha por dono.
--   • portal_acessos — vínculo evento ↔ contratante: o convite (e-mail + token),
--                      o usuário que aceitou (user_id), e overrides por evento.
--                      É a peça que garante "o cliente só vê o próprio evento".
--   • convidados     — lista de convidados do evento (o cliente gerencia + RSVP).
--
-- O lado do contratante NÃO lê estas tabelas direto: tudo passa por
-- app/api/portal/cliente (service-role) que valida o acesso via portal_acessos.
-- Por isso convidados/portal_config têm RLS só do dono — o contratante entra
-- exclusivamente pela API (mesmo padrão de coleta pública do Feedbacks).
--
-- Idempotente: CRIA se faltar e ADICIONA colunas/índices/policies sem erro se já
-- existirem (rode quantas vezes quiser). Depois atualize types/supabase.ts.
-- ============================================================================

-- 1) portal_config — preferências do portal por dono ------------------------
create table if not exists public.portal_config (
  usuario_id   uuid primary key references auth.users (id) on delete cascade,
  ativo        boolean not null default true,          -- liga/desliga o portal globalmente
  cor          text    not null default '#ff385c',     -- cor de destaque da área do cliente
  boas_vindas  text,                                   -- mensagem padrão de boas-vindas
  modulos      jsonb   not null default '{}'::jsonb,   -- { financeiro:true, convidados:false, ... } ({}=todos)
  criado_em    timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.portal_config add column if not exists ativo        boolean not null default true;
alter table public.portal_config add column if not exists cor          text    not null default '#ff385c';
alter table public.portal_config add column if not exists boas_vindas  text;
alter table public.portal_config add column if not exists modulos      jsonb   not null default '{}'::jsonb;
alter table public.portal_config add column if not exists atualizado_em timestamptz not null default now();

-- 2) portal_acessos — convite/acesso do contratante a UM evento --------------
--    Um evento pode ter 1+ contratantes com acesso. O vínculo ao usuário logado
--    é resolvido por e-mail (auto-claim no 1º acesso) ou pelo token do convite.
create table if not exists public.portal_acessos (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,            -- dono (p/ RLS)
  evento_id       uuid not null references public.clientes_eventos (id) on delete cascade,
  email           text not null,                       -- e-mail convidado (casa com auth.email no claim)
  token           text not null unique,                -- segredo do link de convite
  user_id         uuid,                                -- contratante que aceitou (auth.users) — null até aceitar
  status          text not null default 'convidado'
                    check (status in ('convidado', 'ativo', 'revogado')),
  modulos         jsonb,                               -- override por evento (null = usa portal_config)
  boas_vindas     text,                                -- override por evento (null = usa portal_config)
  criado_em       timestamptz not null default now(),
  aceito_em       timestamptz,
  ultimo_acesso_em timestamptz,
  unique (evento_id, email)
);

alter table public.portal_acessos add column if not exists modulos          jsonb;
alter table public.portal_acessos add column if not exists boas_vindas      text;
alter table public.portal_acessos add column if not exists user_id          uuid;
alter table public.portal_acessos add column if not exists aceito_em        timestamptz;
alter table public.portal_acessos add column if not exists ultimo_acesso_em timestamptz;

-- 3) convidados — lista de convidados do evento (cliente gerencia + RSVP) ----
create table if not exists public.convidados (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,        -- dono (p/ RLS)
  evento_id           uuid not null references public.clientes_eventos (id) on delete cascade,
  nome                text not null,
  email               text,
  telefone            text,
  status              text not null default 'convidado'
                        check (status in ('convidado', 'confirmado', 'recusado', 'checkin')),
  acompanhantes       integer not null default 0,
  mesa                text,
  restricao_alimentar text,
  observacao          text,
  origem              text not null default 'dono'      -- 'dono' | 'cliente' (quem cadastrou)
                        check (origem in ('dono', 'cliente')),
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

alter table public.convidados add column if not exists email               text;
alter table public.convidados add column if not exists telefone            text;
alter table public.convidados add column if not exists acompanhantes       integer not null default 0;
alter table public.convidados add column if not exists mesa                text;
alter table public.convidados add column if not exists restricao_alimentar text;
alter table public.convidados add column if not exists observacao          text;
alter table public.convidados add column if not exists origem              text not null default 'dono';
alter table public.convidados add column if not exists atualizado_em       timestamptz not null default now();

-- 4) pagamentos.parcela_id — reconciliação do pagamento de parcela via portal
--    (o webhook do Mercado Pago marca a parcela como paga). Só se a tabela
--    `pagamentos` existir neste ambiente.
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'pagamentos'
  ) then
    alter table public.pagamentos add column if not exists parcela_id bigint;
    create index if not exists idx_pagamentos_parcela on public.pagamentos (parcela_id);
  end if;
end $$;

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_portal_acessos_usuario on public.portal_acessos (usuario_id);
create index if not exists idx_portal_acessos_evento  on public.portal_acessos (evento_id);
create index if not exists idx_portal_acessos_user    on public.portal_acessos (user_id);
create index if not exists idx_portal_acessos_email   on public.portal_acessos (lower(email));
create index if not exists idx_convidados_usuario     on public.convidados (usuario_id);
create index if not exists idx_convidados_evento      on public.convidados (evento_id);

-- 6) atualizado_em automático ------------------------------------------------
create or replace function public.tg_portal_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_portal_config_touch on public.portal_config;
create trigger trg_portal_config_touch
  before update on public.portal_config
  for each row execute function public.tg_portal_touch();

drop trigger if exists trg_convidados_touch on public.convidados;
create trigger trg_convidados_touch
  before update on public.convidados
  for each row execute function public.tg_portal_touch();

-- 7) RLS ---------------------------------------------------------------------
--    O dono gerencia tudo (usuario_id = auth.uid()). O contratante NÃO escreve
--    direto — entra pela API com service-role, que valida o acesso. A única
--    leitura direta liberada ao contratante é portal_acessos (os seus próprios),
--    útil para depuração e como defesa em profundidade.
alter table public.portal_config  enable row level security;
alter table public.portal_acessos enable row level security;
alter table public.convidados     enable row level security;

drop policy if exists "dono gerencia portal_config" on public.portal_config;
create policy "dono gerencia portal_config" on public.portal_config
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia portal_acessos" on public.portal_acessos;
create policy "dono gerencia portal_acessos" on public.portal_acessos
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "contratante ve seus acessos" on public.portal_acessos;
create policy "contratante ve seus acessos" on public.portal_acessos
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "dono gerencia convidados" on public.convidados;
create policy "dono gerencia convidados" on public.convidados
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

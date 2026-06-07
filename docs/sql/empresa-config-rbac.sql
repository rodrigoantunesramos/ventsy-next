-- ============================================================================
-- Configurações (empresa & conta) + RBAC — /painel/configuracoes
-- ----------------------------------------------------------------------------
-- Cria a fundação de configuração: `empresa_config` (1 linha por dono — marca,
-- fiscal, idioma/moeda/fuso, preferências, notificações, retenção/LGPD) e
-- `usuarios_papeis` (papéis e permissões por módulo — RBAC multi-usuário).
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois atualize types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) empresa_config (uma linha por usuario_id) -------------------------------
create table if not exists public.empresa_config (
  usuario_id    uuid primary key references auth.users (id) on delete cascade,
  razao_social  text,
  fantasia      text,
  cnpj          text,
  ie            text,                  -- inscrição estadual
  im            text,                  -- inscrição municipal
  endereco      jsonb not null default '{}'::jsonb,   -- {cep,rua,numero,complemento,bairro,cidade,estado}
  contatos      jsonb not null default '{}'::jsonb,   -- {email,telefone,whatsapp,site,instagram}
  logo_url      text,
  cores_marca   jsonb not null default '{}'::jsonb,   -- {primaria,secundaria,texto}
  idioma        text  not null default 'pt'  check (idioma in ('pt','en','es')),
  moeda         text  not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  fuso          text  not null default 'America/Sao_Paulo',
  config_fiscal jsonb not null default '{}'::jsonb,   -- {regime,cnae,codigo_servico,iss,emitente_*,...}
  preferencias  jsonb not null default '{}'::jsonb,   -- {formato_data,primeira_hora,numeracao,templates}
  notificacoes  jsonb not null default '{}'::jsonb,   -- toggles por canal/tipo
  retencao_meses integer not null default 24,         -- retenção de dados (LGPD)
  exclusao_solicitada_em timestamptz,                 -- pedido de encerramento de conta
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) usuarios_papeis (RBAC: papel + permissões por módulo) -------------------
create table if not exists public.usuarios_papeis (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,   -- dono/conta
  membro_id     uuid references auth.users (id) on delete set null,           -- login do membro (se houver)
  equipe_id     bigint references public.equipe (id) on delete set null,      -- vínculo opcional ao colaborador
  nome          text not null,
  email         text,
  papel         text not null default 'leitura'
                check (papel in ('admin','financeiro','comercial','operacional','rh','recepcao','leitura')),
  permissoes    jsonb not null default '{}'::jsonb,    -- override por módulo: {modulo: 'nenhum'|'leitura'|'edicao'|'total'}
  requer_2fa    boolean not null default false,
  status        text not null default 'convidado' check (status in ('convidado','ativo','suspenso')),
  convite_token text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_usuarios_papeis_usuario on public.usuarios_papeis (usuario_id);
create index if not exists idx_usuarios_papeis_membro  on public.usuarios_papeis (membro_id);
create unique index if not exists uq_usuarios_papeis_email
  on public.usuarios_papeis (usuario_id, lower(email)) where email is not null;

-- 4) atualizado_em automático ------------------------------------------------
create or replace function public.tg_config_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_empresa_config_touch on public.empresa_config;
create trigger trg_empresa_config_touch
  before update on public.empresa_config
  for each row execute function public.tg_config_touch();

drop trigger if exists trg_usuarios_papeis_touch on public.usuarios_papeis;
create trigger trg_usuarios_papeis_touch
  before update on public.usuarios_papeis
  for each row execute function public.tg_config_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.empresa_config  enable row level security;
alter table public.usuarios_papeis enable row level security;

drop policy if exists "dono gerencia empresa_config" on public.empresa_config;
create policy "dono gerencia empresa_config" on public.empresa_config
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- O dono gerencia os papéis da sua conta; o membro pode LER o próprio papel.
drop policy if exists "dono gerencia papeis" on public.usuarios_papeis;
create policy "dono gerencia papeis" on public.usuarios_papeis
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "membro le proprio papel" on public.usuarios_papeis;
create policy "membro le proprio papel" on public.usuarios_papeis
  for select using (membro_id = auth.uid());

-- Fim ------------------------------------------------------------------------

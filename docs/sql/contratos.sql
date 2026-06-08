-- ============================================================================
-- Contratos & Assinatura digital — /painel/contratos
-- ----------------------------------------------------------------------------
-- Gera contratos de locação a partir de MODELOS com variáveis ({{cliente.nome}},
-- {{evento.data}}, {{valor}}…) e cláusulas opcionais; depois envia para
-- ASSINATURA ELETRÔNICA (link público) registrando uma TRILHA DE AUDITORIA
-- juridicamente útil (IP, user-agent, hash do conteúdo, timestamp por signatário).
--
-- Imutabilidade: ao enviar, `conteudo_final` é um SNAPSHOT congelado do contrato
-- — a UI deixa de permitir edição e a assinatura referencia o hash desse snapshot.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois atualize types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) contratos_templates — modelos com variáveis + cláusulas -----------------
create table if not exists public.contratos_templates (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  tipo_evento   text,                                  -- Casamento, Corporativo… (null = genérico)
  corpo         text not null default '',              -- markdown-lite com {{variaveis}}
  clausulas     jsonb not null default '[]'::jsonb,    -- [{chave,titulo,texto,padrao}]
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) contratos — instâncias geradas (snapshot imutável após envio) -----------
create table if not exists public.contratos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  cliente_id     uuid references public.clientes (id) on delete set null,
  evento_id      uuid references public.clientes_eventos (id) on delete set null,
  proposta_id    uuid,                                 -- forward-compat (módulo Propostas); sem FK por ora
  template_id    uuid references public.contratos_templates (id) on delete set null,
  numero         text not null,                        -- CTR-2026-0001 (sequencial por dono/ano)
  titulo         text,
  conteudo_final text not null default '',             -- SNAPSHOT renderizado (vars já substituídas)
  variaveis      jsonb not null default '{}'::jsonb,   -- valores usados na geração (rastreabilidade)
  valor_num      numeric not null default 0,
  moeda          text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  status         text not null default 'rascunho'
                 check (status in ('rascunho','enviado','assinado','cancelado','rescindido')),
  vencimento     date,
  link_token     text unique,                          -- token do link público de assinatura
  pdf_url        text,
  enviado_em     timestamptz,
  assinado_em    timestamptz,
  cancelado_em   timestamptz,
  rescindido_em  timestamptz,
  multa_num      numeric,                              -- multa de rescisão (puxável de taxas/manual)
  motivo         text,                                 -- motivo de cancelamento/rescisão
  observacoes    text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 3) contratos_assinaturas — trilha de auditoria por signatário --------------
create table if not exists public.contratos_assinaturas (
  id             uuid primary key default gen_random_uuid(),
  contrato_id    uuid not null references public.contratos (id) on delete cascade,
  usuario_id     uuid not null references auth.users (id) on delete cascade,  -- denormalizado p/ RLS
  signatario_nome text not null,
  signatario_doc text,
  email          text,
  papel          text not null default 'contratante'
                 check (papel in ('contratante','contratada','testemunha')),
  ordem          integer not null default 0,
  obrigatorio    boolean not null default true,
  assinou_em     timestamptz,
  ip             text,
  user_agent     text,
  hash           text,                                 -- sha256(conteudo_final + dados + timestamp)
  metodo         text check (metodo in ('clique','desenho','token_email')),
  assinatura_img text,                                 -- data URL do traço (método 'desenho')
  criado_em      timestamptz not null default now()
);

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_contratos_templates_usuario on public.contratos_templates (usuario_id);
create index if not exists idx_contratos_usuario           on public.contratos (usuario_id);
create index if not exists idx_contratos_cliente           on public.contratos (cliente_id);
create index if not exists idx_contratos_evento            on public.contratos (evento_id);
create index if not exists idx_contratos_status            on public.contratos (usuario_id, status);
create index if not exists idx_contratos_token             on public.contratos (link_token);
create index if not exists idx_contratos_assin_contrato    on public.contratos_assinaturas (contrato_id);
create index if not exists idx_contratos_assin_usuario     on public.contratos_assinaturas (usuario_id);

-- 5) atualizado_em automático (reaproveita o gatilho genérico) ---------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_contratos_templates_touch on public.contratos_templates;
create trigger trg_contratos_templates_touch
  before update on public.contratos_templates
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_contratos_touch on public.contratos;
create trigger trg_contratos_touch
  before update on public.contratos
  for each row execute function public.tg_touch_atualizado_em();

-- 5b) imutabilidade do snapshot: bloqueia editar `conteudo_final` depois que o
--     contrato sai de 'rascunho' (enviado/assinado/etc). Garante, no banco, que
--     o conteúdo assinado é o mesmo que foi enviado (a trilha sela por hash).
create or replace function public.tg_contratos_snapshot_lock()
returns trigger language plpgsql as $$
begin
  if old.status <> 'rascunho' and new.conteudo_final is distinct from old.conteudo_final then
    raise exception 'conteudo_final é imutável após o envio (status=%).', old.status;
  end if;
  return new;
end $$;

drop trigger if exists trg_contratos_snapshot_lock on public.contratos;
create trigger trg_contratos_snapshot_lock
  before update on public.contratos
  for each row execute function public.tg_contratos_snapshot_lock();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    O fluxo público de assinatura NÃO usa RLS: passa por rota de API com
--    service-role (lê pelo link_token, grava a trilha) — por isso não há policy
--    de leitura anônima aqui.
alter table public.contratos_templates   enable row level security;
alter table public.contratos             enable row level security;
alter table public.contratos_assinaturas enable row level security;

drop policy if exists "dono gerencia contratos_templates" on public.contratos_templates;
create policy "dono gerencia contratos_templates" on public.contratos_templates
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia contratos" on public.contratos;
create policy "dono gerencia contratos" on public.contratos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia contratos_assinaturas" on public.contratos_assinaturas;
create policy "dono gerencia contratos_assinaturas" on public.contratos_assinaturas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

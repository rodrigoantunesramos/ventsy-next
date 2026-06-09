-- ============================================================================
-- Pesquisas & NPS pós-evento · /painel/pesquisas
-- ----------------------------------------------------------------------------
-- Construtor de pesquisas customizáveis (NPS 0–10 · CSAT · escala · múltipla ·
-- texto) disparadas após o evento, com foco em MÉTRICA e TENDÊNCIA (NPS).
-- Complementa Feedbacks (qualitativo/tratativa); aqui o foco é score e evolução.
--
-- `pesquisas`           = o modelo (perguntas em jsonb + gatilho de disparo).
-- `pesquisas_respostas` = cada resposta (respostas em jsonb + nps/categoria
--                         denormalizados p/ o dashboard agregar sem o modelo).
--
-- Coleta pública: o formulário /pesquisa/[token] insere aqui via service-role
-- (app/api/pesquisas/publico). O token carrega pesquisa_id (+ evento opcional)
-- assinado por HMAC (lib/pesquisaToken), então NÃO há policy de insert público —
-- o anon entra exclusivamente pela API.
--
-- Idempotente: CRIA se faltar e ADICIONA colunas/índices/policies sem erro se já
-- existirem (rode quantas vezes quiser). Depois atualize types/supabase.ts.
-- ============================================================================

-- 1) pesquisas ---------------------------------------------------------------
create table if not exists public.pesquisas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,  -- dono
  titulo        text not null,
  descricao     text,
  tipo          text not null default 'nps'
                  check (tipo in ('nps', 'csat', 'custom')),
  perguntas     jsonb not null default '[]'::jsonb,  -- [{ id, tipo, titulo, opcoes?, obrigatoria }]
  gatilho       text not null default 'manual'
                  check (gatilho in ('manual', 'pos_evento', 'dias_apos')),
  dias_apos     smallint,                            -- usado quando gatilho = 'dias_apos'
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Extensão idempotente (ambientes onde a tabela já existia antes da spec).
alter table public.pesquisas add column if not exists descricao     text;
alter table public.pesquisas add column if not exists tipo          text not null default 'nps';
alter table public.pesquisas add column if not exists perguntas     jsonb not null default '[]'::jsonb;
alter table public.pesquisas add column if not exists gatilho       text not null default 'manual';
alter table public.pesquisas add column if not exists dias_apos     smallint;
alter table public.pesquisas add column if not exists ativo         boolean not null default true;
alter table public.pesquisas add column if not exists atualizado_em timestamptz not null default now();

-- 2) pesquisas_respostas -----------------------------------------------------
create table if not exists public.pesquisas_respostas (
  id             uuid primary key default gen_random_uuid(),
  pesquisa_id    uuid not null references public.pesquisas (id) on delete cascade,
  usuario_id     uuid not null references auth.users (id) on delete cascade,  -- p/ RLS direta
  evento_id      uuid references public.clientes_eventos (id) on delete set null,
  cliente_id     uuid references public.clientes (id) on delete set null,
  propriedade_id bigint,                              -- derivado do evento (filtro)
  autor_nome     text,
  autor_contato  text,
  respostas      jsonb not null default '{}'::jsonb,  -- { [perguntaId]: valor }
  nps            smallint check (nps between 0 and 10),
  categoria      text check (categoria in ('promotor', 'neutro', 'detrator')),
  comentario     text,                                -- 1º texto preenchido (denormalizado)
  criado_em      timestamptz not null default now()
);

alter table public.pesquisas_respostas add column if not exists evento_id      uuid;
alter table public.pesquisas_respostas add column if not exists cliente_id     uuid;
alter table public.pesquisas_respostas add column if not exists propriedade_id bigint;
alter table public.pesquisas_respostas add column if not exists autor_nome     text;
alter table public.pesquisas_respostas add column if not exists autor_contato  text;
alter table public.pesquisas_respostas add column if not exists respostas      jsonb not null default '{}'::jsonb;
alter table public.pesquisas_respostas add column if not exists nps            smallint;
alter table public.pesquisas_respostas add column if not exists categoria      text;
alter table public.pesquisas_respostas add column if not exists comentario     text;

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_pesquisas_usuario          on public.pesquisas (usuario_id);
create index if not exists idx_pesquisas_ativo            on public.pesquisas (ativo);
create index if not exists idx_pesq_resp_usuario          on public.pesquisas_respostas (usuario_id);
create index if not exists idx_pesq_resp_pesquisa         on public.pesquisas_respostas (pesquisa_id);
create index if not exists idx_pesq_resp_evento           on public.pesquisas_respostas (evento_id);
create index if not exists idx_pesq_resp_propriedade      on public.pesquisas_respostas (propriedade_id);
create index if not exists idx_pesq_resp_categoria        on public.pesquisas_respostas (categoria);
create index if not exists idx_pesq_resp_criado_em        on public.pesquisas_respostas (criado_em desc);

-- 4) atualizado_em automático ------------------------------------------------
create or replace function public.tg_pesquisas_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_pesquisas_touch on public.pesquisas;
create trigger trg_pesquisas_touch
  before update on public.pesquisas
  for each row execute function public.tg_pesquisas_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    O insert público (formulário anônimo) NÃO tem policy — entra só pela API
--    com service-role, que resolve o dono pelo token assinado da pesquisa.
alter table public.pesquisas           enable row level security;
alter table public.pesquisas_respostas enable row level security;

drop policy if exists "dono gerencia pesquisas" on public.pesquisas;
create policy "dono gerencia pesquisas" on public.pesquisas
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia pesquisas_respostas" on public.pesquisas_respostas;
create policy "dono gerencia pesquisas_respostas" on public.pesquisas_respostas
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

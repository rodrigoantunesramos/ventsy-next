-- ============================================================================
-- Fornecedores & Prestadores — /painel/fornecedores
-- ----------------------------------------------------------------------------
-- Base operacional de fornecedores recorrentes (buffet, som, segurança,
-- decoração, locação, gráfica, bebidas…) com avaliação de desempenho,
-- histórico de compras (puxado de Contas a pagar / lançamentos), contatos,
-- documentos (contrato/certidões/alvará com validade) e homologação.
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- Rode no Supabase (SQL Editor). Os tipos no app usam `supabaseAny` enquanto
-- estas tabelas não entram em types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) fornecedores ------------------------------------------------------------
create table if not exists public.fornecedores (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  tipo                text not null default 'pj' check (tipo in ('pf', 'pj')),
  nome                text not null,                 -- razão social / nome
  fantasia            text,                          -- nome fantasia
  doc                 text,                          -- CPF/CNPJ (livre)
  categoria           text not null default 'outro', -- buffet | som | seguranca | ...
  contato             text,                          -- pessoa de contato principal
  email               text,
  telefone            text,
  whatsapp            text,
  site                text,
  endereco            text,
  cidade              text,
  estado              text,
  condicoes_pagamento text,                          -- ex.: "30/60/90", "à vista 5%"
  prazo_entrega_dias  integer,
  chave_pix           text,
  banco               jsonb not null default '{}'::jsonb,  -- {banco, agencia, conta, titular}
  homologacao         text not null default 'em_analise'
                      check (homologacao in ('homologado', 'em_analise', 'bloqueado')),
  avaliacao_media     numeric not null default 0,    -- mantida por trigger (0–5)
  avaliacao_n         integer not null default 0,    -- nº de avaliações (trigger)
  tags                text[] not null default '{}',
  ativo               boolean not null default true,
  obs                 text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 2) fornecedores_contatos (vários contatos por fornecedor) ------------------
create table if not exists public.fornecedores_contatos (
  id            uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores (id) on delete cascade,
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  cargo         text,
  email         text,
  telefone      text,
  whatsapp      text,
  principal     boolean not null default false,
  obs           text,
  criado_em     timestamptz not null default now()
);

-- 3) fornecedores_avaliacoes (desempenho pós-evento) -------------------------
--    nota geral 0–5; `criterios` guarda {qualidade, prazo, preco, atendimento}.
create table if not exists public.fornecedores_avaliacoes (
  id            uuid primary key default gen_random_uuid(),
  fornecedor_id uuid not null references public.fornecedores (id) on delete cascade,
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid references public.clientes_eventos (id) on delete set null,
  nota          numeric not null default 0 check (nota >= 0 and nota <= 5),
  criterios     jsonb not null default '{}'::jsonb,
  comentario    text,
  data          date not null default current_date,
  criado_em     timestamptz not null default now()
);

-- 4) fornecedores_docs (contrato/certidões/alvará — vencem em `validade`) -----
--    Arquivo vai para o bucket de Storage `documentos` (mesmo de /documentos),
--    sob o caminho `{uid}/fornecedores/{uuid}.{ext}`.
create table if not exists public.fornecedores_docs (
  id              uuid primary key default gen_random_uuid(),
  fornecedor_id   uuid not null references public.fornecedores (id) on delete cascade,
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  nome            text not null,
  tipo            text not null default 'contrato'
                  check (tipo in ('contrato', 'certidao', 'alvara', 'seguro', 'outro')),
  numero          text,
  emissao         date,
  validade        date,
  arquivo_url     text,            -- caminho no storage
  arquivo_nome    text,
  arquivo_tipo    text,
  arquivo_tamanho bigint,
  obs             text,
  criado_em       timestamptz not null default now()
);

-- 5) Vínculo "Contas a pagar" -> fornecedor (gasto total/YTD) -----------------
--    Permite atribuir despesas (lançamentos) a um fornecedor. Quando o módulo
--    Compras existir, o recebimento gera a conta a pagar já com este vínculo.
alter table public.lancamentos
  add column if not exists fornecedor_id uuid references public.fornecedores (id) on delete set null;

-- 6) índices -----------------------------------------------------------------
create index if not exists idx_fornecedores_usuario       on public.fornecedores (usuario_id);
create index if not exists idx_fornecedores_categoria     on public.fornecedores (usuario_id, categoria);
create index if not exists idx_forn_contatos_fornecedor   on public.fornecedores_contatos (fornecedor_id);
create index if not exists idx_forn_aval_fornecedor       on public.fornecedores_avaliacoes (fornecedor_id);
create index if not exists idx_forn_docs_fornecedor       on public.fornecedores_docs (fornecedor_id);
create index if not exists idx_lancamentos_fornecedor     on public.lancamentos (fornecedor_id);

-- 7) atualizado_em automático ------------------------------------------------
create or replace function public.tg_fornecedores_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_fornecedores_touch on public.fornecedores;
create trigger trg_fornecedores_touch
  before update on public.fornecedores
  for each row execute function public.tg_fornecedores_touch();

-- 8) avaliacao_media / avaliacao_n recalculados a cada avaliação -------------
create or replace function public.tg_forn_aval_recalc()
returns trigger language plpgsql as $$
declare
  fid uuid := coalesce(new.fornecedor_id, old.fornecedor_id);
begin
  update public.fornecedores f
     set avaliacao_media = coalesce((
           select round(avg(a.nota)::numeric, 2)
           from public.fornecedores_avaliacoes a
           where a.fornecedor_id = fid
         ), 0),
         avaliacao_n = (
           select count(*) from public.fornecedores_avaliacoes a
           where a.fornecedor_id = fid
         )
   where f.id = fid;
  return null;
end $$;

drop trigger if exists trg_forn_aval_recalc on public.fornecedores_avaliacoes;
create trigger trg_forn_aval_recalc
  after insert or update or delete on public.fornecedores_avaliacoes
  for each row execute function public.tg_forn_aval_recalc();

-- 9) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.fornecedores            enable row level security;
alter table public.fornecedores_contatos   enable row level security;
alter table public.fornecedores_avaliacoes enable row level security;
alter table public.fornecedores_docs       enable row level security;

drop policy if exists "dono gerencia fornecedores" on public.fornecedores;
create policy "dono gerencia fornecedores" on public.fornecedores
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia forn_contatos" on public.fornecedores_contatos;
create policy "dono gerencia forn_contatos" on public.fornecedores_contatos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia forn_avaliacoes" on public.fornecedores_avaliacoes;
create policy "dono gerencia forn_avaliacoes" on public.fornecedores_avaliacoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia forn_docs" on public.fornecedores_docs;
create policy "dono gerencia forn_docs" on public.fornecedores_docs
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

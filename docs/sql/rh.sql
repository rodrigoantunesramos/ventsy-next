-- ============================================================================
-- RH completo — /painel/rh   (hub de Pessoas: Pro+)
-- ----------------------------------------------------------------------------
-- ESTENDE a tabela `equipe` (pessoa + contrato + salário + folha já existentes
-- em /painel/equipe) com os dados de ficha do ciclo de RH e cria as tabelas do
-- restante do ciclo: vagas & candidatos (recrutamento), documentos (com
-- validade/ASO), ausências (férias/atestado/banco de horas) e a timeline de
-- eventos do funcionário (admissão→promoção→…→desligamento).
--
-- NÃO recria a folha: o motor de folha/encargos (lib/folha.ts) e a tabela
-- `equipe` continuam sendo a fonte única; aqui só adicionamos colunas e tabelas
-- satélite. `equipe.id` é BIGINT — todas as FKs para equipe usam bigint.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor). Os
-- tipos no app usam `supabaseAny` até entrarem em types/supabase.ts.
-- ============================================================================

-- 0) Extensão da `equipe` (ficha completa) -----------------------------------
alter table public.equipe add column if not exists cpf                 text;
alter table public.equipe add column if not exists rg                  text;
alter table public.equipe add column if not exists nascimento          date;
alter table public.equipe add column if not exists foto_url            text;
alter table public.equipe add column if not exists email               text;
alter table public.equipe add column if not exists banco               jsonb not null default '{}'::jsonb; -- {banco,agencia,conta,tipo,pix}
alter table public.equipe add column if not exists dependentes         integer not null default 0;
alter table public.equipe add column if not exists jornada             text;       -- ex.: "44h semanais"
alter table public.equipe add column if not exists centro_custo_id     uuid;       -- → contabilidade.centros_custo (FK guardada: sem constraint)
alter table public.equipe add column if not exists gestor_id           bigint references public.equipe (id) on delete set null;
alter table public.equipe add column if not exists desligado_em        date;       -- preenchido no Desligamento
alter table public.equipe add column if not exists motivo_desligamento text;
alter table public.equipe add column if not exists criado_em           timestamptz not null default now();
alter table public.equipe add column if not exists atualizado_em       timestamptz not null default now();

create index if not exists idx_equipe_usuario  on public.equipe (usuario_id);
create index if not exists idx_equipe_gestor   on public.equipe (gestor_id);

-- 1) rh_vagas (recrutamento) --------------------------------------------------
create table if not exists public.rh_vagas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  titulo        text not null,
  slug          text unique,                      -- URL pública /vagas/[slug]
  departamento  text,
  tipo_contrato text not null default 'clt',       -- clt | horista | mei | estagio | freelancer
  salario_min   numeric,
  salario_max   numeric,
  descricao     text,
  requisitos    text,
  beneficios    text,
  local         text,
  status        text not null default 'aberta' check (status in ('aberta','pausada','fechada')),
  vagas         integer not null default 1,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) rh_candidatos (Kanban do funil) -----------------------------------------
create table if not exists public.rh_candidatos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  vaga_id       uuid references public.rh_vagas (id) on delete set null,
  nome          text not null,
  email         text,
  telefone      text,
  curriculo_url text,
  etapa         text not null default 'triagem'
                check (etapa in ('triagem','entrevista','teste','proposta','contratado','reprovado')),
  nota          integer,                           -- 0..5
  fonte         text,                              -- indicacao | portal | linkedin | site | ...
  obs           text,
  ia_resumo     text,                              -- triagem/resumo por IA (opcional)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) rh_documentos (repositório por funcionário, com validade/ASO) -----------
create table if not exists public.rh_documentos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  equipe_id     bigint not null references public.equipe (id) on delete cascade,
  tipo          text not null default 'outro',     -- rg|cpf|ctps|aso|contrato|comprovante|certificacao|nr|...
  nome          text,
  arquivo_url   text,
  validade      date,
  dias_aviso    integer not null default 30,       -- antecedência do alerta de vencimento
  status        text not null default 'valido' check (status in ('valido','pendente','vencido')),
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4) rh_ausencias (férias/atestado/licença/falta/folga/banco de horas) -------
--    `dias` = duração (férias/licença); `saldo` = horas com sinal (banco_horas).
create table if not exists public.rh_ausencias (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  equipe_id     bigint not null references public.equipe (id) on delete cascade,
  tipo          text not null default 'ferias'
                check (tipo in ('ferias','atestado','licenca','falta','folga','banco_horas')),
  inicio        date,
  fim           date,
  dias          numeric not null default 0,
  status        text not null default 'solicitada'
                check (status in ('solicitada','aprovada','reprovada','gozada')),
  saldo         numeric not null default 0,        -- banco de horas (horas com sinal)
  obs           text,
  decidido_em   timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 5) rh_eventos_funcionario (timeline do colaborador) ------------------------
create table if not exists public.rh_eventos_funcionario (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  equipe_id     bigint not null references public.equipe (id) on delete cascade,
  tipo          text not null default 'nota'
                check (tipo in ('admissao','promocao','advertencia','treinamento','ferias','afastamento','desligamento','nota')),
  titulo        text not null,
  descricao     text,
  data          date not null default current_date,
  dados         jsonb not null default '{}'::jsonb, -- payload livre (ex.: snapshot de rescisão)
  criado_em     timestamptz not null default now()
);

-- 6) Índices ------------------------------------------------------------------
create index if not exists idx_rh_vagas_usuario      on public.rh_vagas (usuario_id, status);
create index if not exists idx_rh_candidatos_usuario on public.rh_candidatos (usuario_id, etapa);
create index if not exists idx_rh_candidatos_vaga    on public.rh_candidatos (vaga_id);
create index if not exists idx_rh_documentos_equipe  on public.rh_documentos (equipe_id);
create index if not exists idx_rh_documentos_validade on public.rh_documentos (usuario_id, validade);
create index if not exists idx_rh_ausencias_equipe   on public.rh_ausencias (equipe_id, tipo);
create index if not exists idx_rh_ausencias_usuario  on public.rh_ausencias (usuario_id, status);
create index if not exists idx_rh_eventos_equipe     on public.rh_eventos_funcionario (equipe_id, data);

-- 7) atualizado_em automático -------------------------------------------------
create or replace function public.tg_rh_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['equipe','rh_vagas','rh_candidatos','rh_documentos','rh_ausencias'] loop
    execute format('drop trigger if exists trg_%1$s_touch on public.%1$s;', t);
    execute format('create trigger trg_%1$s_touch before update on public.%1$s for each row execute function public.tg_rh_touch();', t);
  end loop;
end $$;

-- 8) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
--    A submissão pública de candidatura e a leitura da vaga pública passam pela
--    rota service-role /api/rh/* (ignora RLS) — não há policy para anon aqui.
alter table public.rh_vagas               enable row level security;
alter table public.rh_candidatos          enable row level security;
alter table public.rh_documentos          enable row level security;
alter table public.rh_ausencias           enable row level security;
alter table public.rh_eventos_funcionario enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rh_vagas','rh_candidatos','rh_documentos','rh_ausencias','rh_eventos_funcionario'] loop
    execute format('drop policy if exists "dono gerencia %1$s" on public.%1$s;', t);
    execute format('create policy "dono gerencia %1$s" on public.%1$s for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());', t);
  end loop;
end $$;

-- Fim ------------------------------------------------------------------------

-- ─────────────────────────────────────────────────────────────────────────────
-- Avaliações públicas (espaço ↔ cliente) — base + extensão p/ o painel do dono.
-- /painel/avaliacoes · app/api/avaliacoes (cliente já existia; aqui o dono modera).
--
-- A tabela `avaliacoes` é assumida por todo o código (app/api/avaliacoes, a página
-- pública da propriedade e o CRM 360º), mas pode NÃO existir em ambientes novos.
-- Este script é idempotente: CRIA se faltar e ADICIONA colunas/índices/policies
-- sem erro se já existirem (rode quantas vezes quiser).
--
-- Modelo: `user_id` = autor (cliente autenticado). O DONO do espaço NÃO está na
-- linha — ele é dono via `propriedades.usuario_id`. Por isso a moderação do dono
-- é autorizada por subconsulta em `propriedades`.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.avaliacoes (
  id             bigint generated always as identity primary key,
  user_id        uuid,                          -- autor (cliente autenticado)
  propriedade_id bigint,                         -- espaço avaliado
  nota           smallint not null default 5 check (nota between 1 and 5),
  texto          text default '',
  autor          text,
  avatar         text,
  evento_tipo    text,
  data           text,                           -- rótulo legado "mês ano" (compat)
  verificada     boolean not null default false,
  criado_em      timestamptz not null default now()
);

-- Extensão idempotente (cobre ambientes onde a tabela já existia antes da spec).
alter table public.avaliacoes add column if not exists user_id        uuid;
alter table public.avaliacoes add column if not exists propriedade_id bigint;
alter table public.avaliacoes add column if not exists nota           smallint;
alter table public.avaliacoes add column if not exists texto          text;
alter table public.avaliacoes add column if not exists autor          text;
alter table public.avaliacoes add column if not exists avatar         text;
alter table public.avaliacoes add column if not exists evento_tipo    text;
alter table public.avaliacoes add column if not exists data           text;
alter table public.avaliacoes add column if not exists verificada     boolean not null default false;
alter table public.avaliacoes add column if not exists criado_em      timestamptz not null default now();
-- colunas novas da spec (resposta pública do dono + moderação)
alter table public.avaliacoes add column if not exists resposta       text;
alter table public.avaliacoes add column if not exists respondido_em  timestamptz;
alter table public.avaliacoes add column if not exists oculta         boolean not null default false;
alter table public.avaliacoes add column if not exists destaque       boolean not null default false;

-- FK p/ propriedades (best-effort — ignora se já existir ou houver órfãos).
do $$ begin
  alter table public.avaliacoes
    add constraint avaliacoes_propriedade_fk
    foreign key (propriedade_id) references public.propriedades(id) on delete cascade;
exception when others then null; end $$;

create index if not exists idx_avaliacoes_propriedade on public.avaliacoes(propriedade_id);
create index if not exists idx_avaliacoes_criado_em   on public.avaliacoes(criado_em desc);
-- 1 avaliação por cliente por propriedade (espelha o de-dupe da API).
create unique index if not exists uq_avaliacoes_user_prop
  on public.avaliacoes(user_id, propriedade_id) where user_id is not null;

alter table public.avaliacoes enable row level security;

-- Público (anon + logado): só verificadas e não ocultas.
drop policy if exists avaliacoes_select_public on public.avaliacoes;
create policy avaliacoes_select_public on public.avaliacoes
  for select using (verificada = true and oculta = false);

-- Autor: enxerga e cria as próprias (mesmo não verificadas).
drop policy if exists avaliacoes_select_autor on public.avaliacoes;
create policy avaliacoes_select_autor on public.avaliacoes
  for select to authenticated using (user_id = auth.uid());
drop policy if exists avaliacoes_insert_autor on public.avaliacoes;
create policy avaliacoes_insert_autor on public.avaliacoes
  for insert to authenticated with check (user_id = auth.uid());

-- Dono do espaço: vê e MODERA todas as avaliações das SUAS propriedades.
drop policy if exists avaliacoes_select_dono on public.avaliacoes;
create policy avaliacoes_select_dono on public.avaliacoes
  for select to authenticated using (
    propriedade_id in (select id from public.propriedades where usuario_id = auth.uid())
  );
drop policy if exists avaliacoes_update_dono on public.avaliacoes;
create policy avaliacoes_update_dono on public.avaliacoes
  for update to authenticated using (
    propriedade_id in (select id from public.propriedades where usuario_id = auth.uid())
  ) with check (
    propriedade_id in (select id from public.propriedades where usuario_id = auth.uid())
  );

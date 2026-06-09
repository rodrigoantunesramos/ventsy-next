-- ============================================================================
-- Listas Oficiais (comunidade) · /painel/listas + (public)/listas
-- ----------------------------------------------------------------------------
-- Donos/curadores criam listas curadas de lugares e fornecedores recomendados
-- ("Melhores espaços para casamento em SP", "Fornecedores de som para shows"),
-- gerando comunidade, descoberta e SEO. Cada item pode apontar para uma
-- propriedade da plataforma (linka ao anúncio público /propriedade/[id]) ou ser
-- um item externo (nome livre). Visitantes curtem/salvam (exige login) e seguem
-- autores; os contadores são mantidos por TRIGGER (writer-agnostic).
--
-- Leitura pública: as páginas (public)/listas[/slug] leem via service-role
-- (server component) E há policy de SELECT para `publica = true` — assim o
-- cliente logado também consegue montar "minhas salvas"/relacionadas sob RLS.
--
-- Dinheiro: NÃO há "R$" aqui. `listas_itens.nota` é uma nota de curadoria 1–5
-- (estrelas), nunca um valor monetário.
--
-- Idempotente: CRIA se faltar e ADICIONA colunas/índices/policies sem erro se já
-- existirem (rode quantas vezes quiser). Depois atualize types/supabase.ts.
-- ============================================================================

-- 1) listas ------------------------------------------------------------------
create table if not exists public.listas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,   -- autor/curador (dono)
  autor_nome    text,                              -- snapshot p/ exibição pública (sem join em usuarios sob RLS)
  titulo        text not null,
  slug          text not null unique,              -- URL pública /listas/<slug>
  descricao     text,
  capa_url      text,
  categoria     text,                              -- 'casamento'|'corporativo'|'fornecedores'|...
  cidade        text,
  publica       boolean not null default false,
  curtidas      integer not null default 0,        -- rollup mantido por trigger
  salvos        integer not null default 0,        -- rollup mantido por trigger
  n_itens       integer not null default 0,        -- rollup mantido por trigger
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Extensão idempotente (ambientes onde a tabela já existia antes da spec).
alter table public.listas add column if not exists autor_nome    text;
alter table public.listas add column if not exists descricao     text;
alter table public.listas add column if not exists capa_url      text;
alter table public.listas add column if not exists categoria     text;
alter table public.listas add column if not exists cidade        text;
alter table public.listas add column if not exists publica       boolean not null default false;
alter table public.listas add column if not exists curtidas      integer not null default 0;
alter table public.listas add column if not exists salvos        integer not null default 0;
alter table public.listas add column if not exists n_itens       integer not null default 0;
alter table public.listas add column if not exists atualizado_em timestamptz not null default now();

-- 2) listas_itens ------------------------------------------------------------
create table if not exists public.listas_itens (
  id             uuid primary key default gen_random_uuid(),
  lista_id       uuid not null references public.listas (id) on delete cascade,
  usuario_id     uuid not null references auth.users (id) on delete cascade,  -- denormalizado p/ RLS (== dono da lista)
  propriedade_id bigint,                           -- FK guardada (→ propriedades), opcional
  nome_externo   text,                             -- item fora da plataforma (sem propriedade_id)
  -- snapshot de exibição (não depende de re-ler propriedades no público)
  ref_nome       text,
  ref_cidade     text,
  ref_imagem     text,
  tipo           text not null default 'espaco'
                   check (tipo in ('espaco', 'fornecedor', 'servico')),
  nota           numeric,                          -- nota de curadoria 1–5 (estrelas) — NÃO é dinheiro
  comentario     text,
  ordem          integer not null default 0,
  criado_em      timestamptz not null default now()
);

alter table public.listas_itens add column if not exists propriedade_id bigint;
alter table public.listas_itens add column if not exists nome_externo   text;
alter table public.listas_itens add column if not exists ref_nome       text;
alter table public.listas_itens add column if not exists ref_cidade     text;
alter table public.listas_itens add column if not exists ref_imagem     text;
alter table public.listas_itens add column if not exists nota           numeric;
alter table public.listas_itens add column if not exists comentario     text;
alter table public.listas_itens add column if not exists ordem          integer not null default 0;

-- FK p/ propriedades guardada (tipo/condicional): não falha o script se a
-- referência for incompatível ou já existir.
do $$ begin
  alter table public.listas_itens
    add constraint listas_itens_propriedade_fk
    foreign key (propriedade_id) references public.propriedades (id) on delete set null;
exception
  when duplicate_object then null;
  when others then null;
end $$;

-- 3) listas_interacoes (curtir/salvar de lista; seguir de autor) -------------
create table if not exists public.listas_interacoes (
  id         uuid primary key default gen_random_uuid(),
  lista_id   uuid references public.listas (id) on delete cascade,   -- alvo de 'curtir'/'salvar'
  autor_id   uuid,                                                   -- alvo de 'seguir' (autor)
  user_id    uuid not null references auth.users (id) on delete cascade,  -- quem interage (logado)
  tipo       text not null check (tipo in ('curtir', 'salvar', 'seguir')),
  criado_em  timestamptz not null default now()
);

alter table public.listas_interacoes add column if not exists autor_id uuid;

-- idempotência da interação: 1 curtir/salvar por (lista,user,tipo); 1 seguir por (autor,user)
create unique index if not exists uq_listas_inter_lista
  on public.listas_interacoes (lista_id, user_id, tipo) where lista_id is not null;
create unique index if not exists uq_listas_inter_seguir
  on public.listas_interacoes (autor_id, user_id) where tipo = 'seguir';

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_listas_usuario   on public.listas (usuario_id);
create index if not exists idx_listas_slug       on public.listas (slug);
create index if not exists idx_listas_publica    on public.listas (criado_em desc) where publica = true;
create index if not exists idx_listas_cidade     on public.listas (cidade)    where publica = true;
create index if not exists idx_listas_categoria  on public.listas (categoria) where publica = true;
create index if not exists idx_listas_itens_lista   on public.listas_itens (lista_id, ordem);
create index if not exists idx_listas_itens_usuario on public.listas_itens (usuario_id);
create index if not exists idx_listas_inter_lista   on public.listas_interacoes (lista_id);
create index if not exists idx_listas_inter_user    on public.listas_interacoes (user_id, tipo);
create index if not exists idx_listas_inter_autor   on public.listas_interacoes (autor_id) where tipo = 'seguir';

-- 5) atualizado_em automático ------------------------------------------------
create or replace function public.tg_listas_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_listas_touch on public.listas;
create trigger trg_listas_touch
  before update on public.listas
  for each row execute function public.tg_listas_touch();

-- 6) contadores curtidas/salvos (writer-agnostic) ----------------------------
--    SECURITY DEFINER: um visitante curte a lista de OUTRO dono; o UPDATE na
--    linha de `listas` (de outro usuário) precisa furar a RLS.
create or replace function public.tg_listas_inter_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  lid := coalesce(new.lista_id, old.lista_id);
  if lid is null then return coalesce(new, old); end if;   -- 'seguir' não mexe em contador de lista
  update public.listas l set
    curtidas = (select count(*) from public.listas_interacoes i where i.lista_id = lid and i.tipo = 'curtir'),
    salvos   = (select count(*) from public.listas_interacoes i where i.lista_id = lid and i.tipo = 'salvar')
  where l.id = lid;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_listas_inter_counter on public.listas_interacoes;
create trigger trg_listas_inter_counter
  after insert or delete on public.listas_interacoes
  for each row execute function public.tg_listas_inter_counter();

-- 7) contador de itens (n_itens) ---------------------------------------------
create or replace function public.tg_listas_itens_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare lid uuid;
begin
  lid := coalesce(new.lista_id, old.lista_id);
  if lid is null then return coalesce(new, old); end if;
  update public.listas l
    set n_itens = (select count(*) from public.listas_itens i where i.lista_id = lid)
  where l.id = lid;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_listas_itens_counter on public.listas_itens;
create trigger trg_listas_itens_counter
  after insert or delete on public.listas_itens
  for each row execute function public.tg_listas_itens_counter();

-- 8) RLS ---------------------------------------------------------------------
alter table public.listas            enable row level security;
alter table public.listas_itens      enable row level security;
alter table public.listas_interacoes enable row level security;

-- dono gerencia as próprias listas
drop policy if exists "dono gerencia listas" on public.listas;
create policy "dono gerencia listas" on public.listas
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- qualquer um lê listas públicas (comunidade / SEO / "minhas salvas")
drop policy if exists "publico le listas publicas" on public.listas;
create policy "publico le listas publicas" on public.listas
  for select to anon, authenticated using (publica = true);

-- dono gerencia itens das próprias listas
drop policy if exists "dono gerencia itens" on public.listas_itens;
create policy "dono gerencia itens" on public.listas_itens
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- qualquer um lê itens de listas públicas
drop policy if exists "publico le itens publicos" on public.listas_itens;
create policy "publico le itens publicos" on public.listas_itens
  for select to anon, authenticated
  using (exists (select 1 from public.listas l where l.id = lista_id and l.publica = true));

-- usuário logado gerencia as PRÓPRIAS interações (curtir/salvar/seguir)
drop policy if exists "usuario gerencia interacoes" on public.listas_interacoes;
create policy "usuario gerencia interacoes" on public.listas_interacoes
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Fim ------------------------------------------------------------------------

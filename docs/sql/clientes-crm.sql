-- ============================================================================
-- Clientes (CRM 360º) — /painel/clientes
-- ----------------------------------------------------------------------------
-- Cria a entidade "cliente" (pessoa/empresa, distinta de um evento), liga os
-- eventos existentes (clientes_eventos) ao cliente, e adiciona a timeline de
-- interações. Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- Rode no Supabase (SQL Editor) e depois atualize types/supabase.ts.
-- ============================================================================

-- 1) clientes ----------------------------------------------------------------
create table if not exists public.clientes (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  tipo          text not null default 'pf' check (tipo in ('pf', 'pj')),
  nome          text not null,
  doc           text,                 -- CPF/CNPJ (livre)
  email         text,
  telefone      text,
  whatsapp      text,
  endereco      text,
  cidade        text,
  estado        text,
  origem        text,                 -- indicacao | site | instagram | google | ...
  tags          text[] not null default '{}',
  segmento      text,                 -- rótulo manual do dono (livre)
  aniversario   date,
  vip           boolean not null default false,
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) vínculo evento -> cliente (1 cliente -> N eventos) ----------------------
alter table public.clientes_eventos
  add column if not exists cliente_id uuid references public.clientes (id) on delete set null;

-- 3) clientes_interacoes (timeline manual + automática) ----------------------
create table if not exists public.clientes_interacoes (
  id         uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  tipo       text not null default 'nota'
             check (tipo in ('ligacao', 'email', 'whatsapp', 'reuniao', 'nota')),
  conteudo   text,
  data       timestamptz not null default now(),
  criado_em  timestamptz not null default now()
);

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_clientes_usuario            on public.clientes (usuario_id);
create index if not exists idx_clientes_email              on public.clientes (lower(email));
create index if not exists idx_clientes_eventos_cliente    on public.clientes_eventos (cliente_id);
create index if not exists idx_clientes_interacoes_cliente on public.clientes_interacoes (cliente_id);
create index if not exists idx_clientes_interacoes_usuario on public.clientes_interacoes (usuario_id);

-- 5) atualizado_em automático ------------------------------------------------
create or replace function public.tg_clientes_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_clientes_touch on public.clientes;
create trigger trg_clientes_touch
  before update on public.clientes
  for each row execute function public.tg_clientes_touch();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.clientes            enable row level security;
alter table public.clientes_interacoes enable row level security;

drop policy if exists "dono gerencia clientes" on public.clientes;
create policy "dono gerencia clientes" on public.clientes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia interacoes" on public.clientes_interacoes;
create policy "dono gerencia interacoes" on public.clientes_interacoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 7) Migração: derivar clientes a partir de quem_contratou distintos ---------
--    Cria um cliente por contratante único (que ainda não exista) e vincula
--    os eventos órfãos. Seguro para rodar de novo (NOT EXISTS + cliente_id null).
insert into public.clientes (usuario_id, nome, doc, email, tipo)
select
  ce.usuario_id,
  trim(ce.quem_contratou)                                   as nome,
  nullif(trim(coalesce(max(ce.documento), '')), '')         as doc,
  nullif(trim(coalesce(max(ce.email), '')), '')             as email,
  case
    when length(regexp_replace(coalesce(max(ce.documento), ''), '\D', '', 'g')) > 11
    then 'pj' else 'pf'
  end                                                       as tipo
from public.clientes_eventos ce
where ce.quem_contratou is not null
  and trim(ce.quem_contratou) <> ''
  and ce.cliente_id is null
  and not exists (
    select 1 from public.clientes c
    where c.usuario_id = ce.usuario_id
      and lower(c.nome) = lower(trim(ce.quem_contratou))
  )
group by ce.usuario_id, trim(ce.quem_contratou);

update public.clientes_eventos ce
set cliente_id = c.id
from public.clientes c
where ce.cliente_id is null
  and c.usuario_id = ce.usuario_id
  and lower(c.nome) = lower(trim(ce.quem_contratou));

-- Fim ------------------------------------------------------------------------

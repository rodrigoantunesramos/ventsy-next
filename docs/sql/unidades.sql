-- ============================================================================
-- Multi-unidades / Franquias — /painel/unidades
-- ----------------------------------------------------------------------------
-- Para quem opera VÁRIAS unidades (rede de espaços, franquias, parque com vários
-- pavilhões geridos como negócios). Cada UNIDADE é uma `propriedade` já existente
-- (escopada por usuario_id). Estas tabelas só adicionam a camada de gestão:
--
--   • unidades_grupos  — agrupamento (rede/franquia/região/marca) para organizar
--                        e somar unidades. Cor para o comparativo.
--   • unidades_config  — uma linha por propriedade: apelido de exibição, grupo,
--                        ativo, ordem, parâmetros de FRANQUIA (royalties % + taxa
--                        fixa) e meta de receita. UNIQUE (usuario_id, propriedade).
--   • unidades_acesso  — qual MEMBRO (equipe) acessa qual unidade (liga com
--                        Permissões/RBAC). Sem linhas = acesso não restrito.
--
-- A CONSOLIDAÇÃO (receita/ocupação/eventos/margem/NPS) é só agregação, em tempo
-- de leitura, das tabelas já escopadas por propriedade (`lancamentos.prop_id`,
-- `clientes_eventos.propriedade_id`, `propriedades.avaliacao`) — NÃO duplicamos
-- dado aqui. A matemática (métricas, ranking, benchmark, royalties) vive em
-- lib/unidades.ts (pura, testada). O CRUD destas 3 tabelas é feito pelo client
-- via RLS (o dono vê/edita só as próprias linhas).
--
-- Convenções (ver docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num. Nunca formate "R$" no banco.
--   • INDEPENDENTE de outras migrations: propriedade_id/grupo_id/membro_id ficam
--     como colunas simples; as foreign keys são adicionadas DEPOIS, só se as
--     tabelas-alvo existirem (bloco DO no fim).
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) unidades_grupos (rede/franquia/região/marca) ----------------------------
create table if not exists public.unidades_grupos (
  id            bigint generated always as identity primary key,
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  tipo          text not null default 'rede'
                check (tipo in ('rede','franquia','regiao','marca')),
  cor           text,                 -- cor hex para o comparativo (opcional)
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) unidades_config (1 linha por propriedade) -------------------------------
create table if not exists public.unidades_config (
  id               bigint generated always as identity primary key,
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  propriedade_id   bigint not null,   -- FK -> propriedades        (fim do arquivo)
  grupo_id         bigint,            -- FK -> unidades_grupos      (fim do arquivo)
  apelido          text,              -- nome de exibição (override do nome do anúncio)
  ativo            boolean not null default true,
  ordem            integer,           -- ordenação manual no comparativo
  -- Franquia: repasse = receita * (royalties_pct/100) + taxa_fixa_num.
  royalties_pct    numeric check (royalties_pct is null or (royalties_pct >= 0 and royalties_pct <= 100)),
  taxa_fixa_num    numeric check (taxa_fixa_num is null or taxa_fixa_num >= 0),
  meta_receita_num numeric check (meta_receita_num is null or meta_receita_num >= 0),
  obs              text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (usuario_id, propriedade_id)
);

-- 3) unidades_acesso (membro → unidade) --------------------------------------
create table if not exists public.unidades_acesso (
  id             bigint generated always as identity primary key,
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  membro_id      bigint not null,     -- FK -> equipe               (fim do arquivo)
  propriedade_id bigint not null,     -- FK -> propriedades         (fim do arquivo)
  criado_em      timestamptz not null default now(),
  unique (usuario_id, membro_id, propriedade_id)
);

-- 4) índices ------------------------------------------------------------------
create index if not exists idx_uni_grupos_usuario  on public.unidades_grupos (usuario_id);
create index if not exists idx_uni_config_usuario   on public.unidades_config (usuario_id);
create index if not exists idx_uni_config_prop      on public.unidades_config (propriedade_id);
create index if not exists idx_uni_config_grupo     on public.unidades_config (grupo_id);
create index if not exists idx_uni_acesso_usuario   on public.unidades_acesso (usuario_id);
create index if not exists idx_uni_acesso_membro    on public.unidades_acesso (usuario_id, membro_id);
create index if not exists idx_uni_acesso_prop      on public.unidades_acesso (propriedade_id);

-- 5) atualizado_em automático -------------------------------------------------
create or replace function public.tg_unidades_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_uni_grupos_touch on public.unidades_grupos;
create trigger trg_uni_grupos_touch
  before update on public.unidades_grupos
  for each row execute function public.tg_unidades_touch();

drop trigger if exists trg_uni_config_touch on public.unidades_config;
create trigger trg_uni_config_touch
  before update on public.unidades_config
  for each row execute function public.tg_unidades_touch();

-- 6) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
alter table public.unidades_grupos enable row level security;
alter table public.unidades_config enable row level security;
alter table public.unidades_acesso enable row level security;

drop policy if exists "dono gerencia unidades_grupos" on public.unidades_grupos;
create policy "dono gerencia unidades_grupos" on public.unidades_grupos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia unidades_config" on public.unidades_config;
create policy "dono gerencia unidades_config" on public.unidades_config
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia unidades_acesso" on public.unidades_acesso;
create policy "dono gerencia unidades_acesso" on public.unidades_acesso
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 7) FKs opcionais (só se as tabelas-alvo existirem) --------------------------
-- Adiciona uma FK a uma coluna existente, protegido contra incompatibilidade de
-- tipo. Se falhar, mantém a coluna sem FK. Ação de exclusão por FK:
--   • cascade  — a linha perde sentido sem o alvo (config/acesso ↔ propriedade/membro);
--   • set null — o vínculo é opcional (config.grupo_id continua válido sem o grupo).
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('unidades_config', 'propriedade_id', 'propriedades',     'id', 'unidades_config_propriedade_id_fkey', 'cascade'),
      ('unidades_config', 'grupo_id',       'unidades_grupos',  'id', 'unidades_config_grupo_id_fkey',       'set null'),
      ('unidades_acesso', 'propriedade_id', 'propriedades',     'id', 'unidades_acesso_propriedade_id_fkey', 'cascade'),
      ('unidades_acesso', 'membro_id',      'equipe',           'id', 'unidades_acesso_membro_id_fkey',      'cascade')
    ) as t(src_table, src_col, ref_table, ref_col, fk_name, on_delete)
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = r.ref_table)
       and not exists (select 1 from pg_constraint where conname = r.fk_name)
    then
      begin
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references public.%I (%I) on delete %s',
          r.src_table, r.fk_name, r.src_col, r.ref_table, r.ref_col, r.on_delete);
      exception when others then
        raise notice 'FK %.% -> % não criada (%). Coluna mantida sem FK.', r.src_table, r.src_col, r.ref_table, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- Fim ------------------------------------------------------------------------

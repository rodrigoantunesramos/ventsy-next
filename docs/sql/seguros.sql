-- ============================================================================
-- Seguros & Apólices — /painel/seguros
-- ----------------------------------------------------------------------------
-- Gere as apólices que protegem a operação contra risco existencial:
--   • PATRIMONIAIS do espaço (incêndio, danos), RESPONSABILIDADE CIVIL geral;
--   • POR EVENTO (RC de evento, acidentes pessoais p/ corrida/equestre/auto);
--   • FROTA e EQUIPAMENTOS.
-- Coberturas e limites, vigências, prêmio, franquia, documento da apólice e os
-- SINISTROS (abertura, acompanhamento, valor estimado/indenizado, lições).
--
-- Duas tabelas:
--   • seguros   — a apólice (escopo, seguradora/corretor, nº, coberturas jsonb,
--                 franquia/prêmio, vigência, status). A baixa do prêmio lança a
--                 despesa em `lancamentos` (custo no Financeiro/Contábil) — o id
--                 fica em `lancamento_id`.
--   • sinistros — ocorrências por apólice (data, descrição, valores, status,
--                 anexos, lição aprendida). Cai em cascata se a apólice some.
--
-- A engine que calcula situação de vigência (vigente/a vencer/vencida), prêmio
-- da carteira, sinistralidade e rateio ao custo do evento vive em lib/seguros.ts
-- (pura, testada). O CRUD é feito pelo client via RLS (o dono vê/edita só as
-- próprias linhas).
--
-- Convenções (ver docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num. Nunca formate "R$" no banco.
--   • INDEPENDENTE de outras migrations: propriedade_id/evento_id/lancamento_id
--     ficam como colunas simples; as foreign keys são adicionadas DEPOIS, só se
--     as tabelas-alvo existirem (bloco DO no fim). Re-rodar cria as FKs novas.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) seguros (apólices) -------------------------------------------------------
create table if not exists public.seguros (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  -- Escopo da apólice:
  escopo           text not null default 'patrimonial'
                   check (escopo in ('patrimonial','rc','evento','acidentes','frota','equipamento')),
  -- Alvo (opcionais): patrimonial/frota → propriedade; evento/acidentes → evento.
  propriedade_id   bigint,            -- FK -> propriedades       (fim do arquivo)
  evento_id        uuid,              -- FK -> clientes_eventos   (fim do arquivo)
  -- Identificação:
  seguradora       text,
  corretor         text,
  apolice          text,              -- número da apólice
  -- Coberturas: [{ item, limite_num, franquia_num }] (item → limite contratado).
  coberturas       jsonb not null default '[]'::jsonb,
  franquia_num     numeric not null default 0 check (franquia_num >= 0),
  premio_num       numeric not null default 0 check (premio_num >= 0),
  -- Vigência:
  vigencia_inicio  date,
  vigencia_fim     date,
  -- Status administrativo (a situação de vigência é calculada da data na engine):
  status           text not null default 'ativa'
                   check (status in ('ativa','em_cotacao','cancelada','renovada')),
  -- Documento e vínculo financeiro:
  documento_url    text,              -- caminho no bucket `documentos`
  lancamento_id    bigint,            -- FK -> lancamentos (despesa do prêmio)
  obs              text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- 2) sinistros (ocorrências por apólice) -------------------------------------
create table if not exists public.sinistros (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references auth.users (id) on delete cascade,
  seguro_id            uuid not null references public.seguros (id) on delete cascade,
  evento_id            uuid,          -- FK -> clientes_eventos (fim do arquivo)
  data                 date not null default current_date,
  descricao            text,
  valor_estimado_num   numeric not null default 0 check (valor_estimado_num >= 0),
  valor_indenizado_num numeric not null default 0 check (valor_indenizado_num >= 0),
  status               text not null default 'aberto'
                       check (status in ('aberto','em_analise','aprovado','negado','pago','encerrado')),
  protocolo            text,
  anexos               jsonb not null default '[]'::jsonb, -- [{ url, nome, tipo, tamanho }]
  licao                text,          -- lição aprendida / providência
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

-- 3) índices ------------------------------------------------------------------
create index if not exists idx_seguros_usuario   on public.seguros (usuario_id);
create index if not exists idx_seguros_escopo    on public.seguros (usuario_id, escopo);
create index if not exists idx_seguros_status    on public.seguros (usuario_id, status);
create index if not exists idx_seguros_vigencia  on public.seguros (usuario_id, vigencia_fim);
create index if not exists idx_seguros_evento    on public.seguros (evento_id);
create index if not exists idx_seguros_prop      on public.seguros (propriedade_id);

create index if not exists idx_sinistros_usuario on public.sinistros (usuario_id);
create index if not exists idx_sinistros_seguro  on public.sinistros (seguro_id);
create index if not exists idx_sinistros_status  on public.sinistros (usuario_id, status);
create index if not exists idx_sinistros_evento  on public.sinistros (evento_id);

-- 4) atualizado_em automático -------------------------------------------------
create or replace function public.tg_seguros_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_seguros_touch on public.seguros;
create trigger trg_seguros_touch
  before update on public.seguros
  for each row execute function public.tg_seguros_touch();

drop trigger if exists trg_sinistros_touch on public.sinistros;
create trigger trg_sinistros_touch
  before update on public.sinistros
  for each row execute function public.tg_seguros_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
alter table public.seguros   enable row level security;
alter table public.sinistros enable row level security;

drop policy if exists "dono gerencia seguros" on public.seguros;
create policy "dono gerencia seguros" on public.seguros
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia sinistros" on public.sinistros;
create policy "dono gerencia sinistros" on public.sinistros
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FKs opcionais (só se as tabelas-alvo existirem) --------------------------
-- Adiciona uma FK a uma coluna existente, protegido contra incompatibilidade de
-- tipo. Se falhar, mantém a coluna sem FK.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('seguros',   'propriedade_id', 'propriedades',     'id', 'seguros_propriedade_id_fkey'),
      ('seguros',   'evento_id',      'clientes_eventos', 'id', 'seguros_evento_id_fkey'),
      ('seguros',   'lancamento_id',  'lancamentos',      'id', 'seguros_lancamento_id_fkey'),
      ('sinistros', 'evento_id',      'clientes_eventos', 'id', 'sinistros_evento_id_fkey')
    ) as t(src_table, src_col, ref_table, ref_col, fk_name)
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = r.ref_table)
       and not exists (select 1 from pg_constraint where conname = r.fk_name)
    then
      begin
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references public.%I (%I) on delete set null',
          r.src_table, r.fk_name, r.src_col, r.ref_table, r.ref_col);
      exception when others then
        raise notice 'FK %.% -> % não criada (%). Coluna mantida sem FK.', r.src_table, r.src_col, r.ref_table, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- Fim ------------------------------------------------------------------------

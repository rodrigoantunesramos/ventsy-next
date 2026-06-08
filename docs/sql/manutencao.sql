-- ============================================================================
-- Manutenção & Ordens de Serviço — /painel/manutencao
-- ----------------------------------------------------------------------------
-- Mantém espaços (propriedades/espacos) e ativos funcionando: ordens de serviço
-- CORRETIVAS (quebrou) e PREVENTIVAS (plano periódico: ar-condicionado, gerador,
-- elétrica, jardim, piscina, estrutura), com custo (mão de obra + peças),
-- responsável (equipe interna ou fornecedor), checklist (inspeção/pré-evento) e
-- histórico. Crítico para grandes estruturas (arena, galpão, autódromo).
--
-- Duas tabelas:
--   • manutencao_planos  — rotinas preventivas (periodicidade + checklist
--                          template) que GERAM OS automaticamente na data
--                          (cron /api/cron/manutencao-preventiva).
--   • manutencao_os      — as ordens de serviço (Kanban por status, custos,
--                          checklist, peças, anexos). A baixa (conclusão) lança
--                          a despesa em `lancamentos` (custo no contábil).
--
-- Convenções (ver docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num. `custo_total_num` é GERADO
--     (mão de obra + peças) — não precisa manter na mão.
--   • RLS: o dono vê/edita só as próprias linhas.
--
-- INDEPENDENTE de outras migrations: propriedade_id/espaco_id/ativo_id/
-- evento_id/lancamento_id ficam como colunas simples; as foreign keys são
-- adicionadas DEPOIS, só se as tabelas-alvo existirem (blocos DO no fim).
-- `ativo_id` aponta para o módulo Ativos (futuro) — enquanto não existir, use
-- `ativo_nome` (snapshot em texto). Re-rodar este arquivo cria as FKs que
-- passaram a ser possíveis.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor).
-- Os tipos no app usam `supabaseAny` enquanto estas tabelas não entram em
-- types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) manutencao_planos (rotinas preventivas) ---------------------------------
create table if not exists public.manutencao_planos (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  -- Alvo (todos opcionais):
  propriedade_id     bigint,            -- FK -> propriedades  (fim do arquivo)
  espaco_id          bigint,            -- FK -> espacos       (fim do arquivo)
  ativo_id           uuid,              -- FK -> ativos (módulo futuro)
  ativo_nome         text,              -- snapshot do ativo enquanto Ativos não existe
  titulo             text not null,
  descricao          text,
  tipo               text not null default 'preventiva'
                     check (tipo in ('preventiva', 'inspecao')),
  prioridade         text not null default 'media'
                     check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  periodicidade      text not null default 'mensal'
                     check (periodicidade in ('diaria', 'semanal', 'quinzenal', 'mensal',
                                              'bimestral', 'trimestral', 'semestral', 'anual', 'horas_uso')),
  intervalo          integer not null default 1 check (intervalo >= 1), -- a cada N períodos
  proxima_data       date,              -- quando gerar a próxima OS (null em horas_uso)
  responsavel_tipo   text check (responsavel_tipo in ('equipe', 'fornecedor')),
  responsavel_id     text,              -- id de equipe OU de fornecedor (misto → sem FK)
  responsavel_nome   text,
  custo_estimado_num numeric not null default 0 check (custo_estimado_num >= 0),
  checklist          jsonb not null default '[]'::jsonb, -- template: [{ item }]
  ativo              boolean not null default true,
  ultima_geracao     date,              -- última vez que gerou OS
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 2) manutencao_os (ordens de serviço) ---------------------------------------
create table if not exists public.manutencao_os (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  -- Alvo (todos opcionais — uma OS pode ser de um espaço, de um ativo, ou ambos):
  propriedade_id     bigint,            -- FK -> propriedades  (fim do arquivo)
  espaco_id          bigint,            -- FK -> espacos       (fim do arquivo)
  ativo_id           uuid,              -- FK -> ativos (módulo futuro)
  ativo_nome         text,              -- snapshot do ativo enquanto Ativos não existe
  -- Classificação:
  tipo               text not null default 'corretiva'
                     check (tipo in ('preventiva', 'corretiva', 'inspecao', 'melhoria')),
  titulo             text not null,
  descricao          text,
  prioridade         text not null default 'media'
                     check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  status             text not null default 'aberta'
                     check (status in ('aberta', 'planejada', 'em_andamento',
                                       'aguardando_peca', 'concluida', 'cancelada')),
  -- Responsável: interno (equipe) ou externo (fornecedor). id misto → sem FK rígida.
  solicitante        text,
  responsavel_tipo   text check (responsavel_tipo in ('equipe', 'fornecedor')),
  responsavel_id     text,
  responsavel_nome   text,
  -- Datas do ciclo:
  abertura           date not null default current_date,
  prazo              date,
  conclusao          date,
  -- Custos (mão de obra + peças; total é GERADO e sempre consistente):
  custo_mao_obra_num numeric not null default 0 check (custo_mao_obra_num >= 0),
  custo_pecas_num    numeric not null default 0 check (custo_pecas_num >= 0),
  custo_total_num    numeric generated always as
                       (coalesce(custo_mao_obra_num, 0) + coalesce(custo_pecas_num, 0)) stored,
  -- Origem / vínculos:
  plano_id           uuid references public.manutencao_planos (id) on delete set null, -- qual plano gerou
  evento_id          uuid,              -- FK -> clientes_eventos (checklist pré-evento)
  -- Conteúdo:
  checklist          jsonb not null default '[]'::jsonb, -- [{ item, ok, obs }]
  pecas              jsonb not null default '[]'::jsonb,  -- [{ descricao, quantidade, custo_num, produto_id? }]
  anexos             jsonb not null default '[]'::jsonb,  -- [{ url, nome, tipo, tamanho }]
  lancamento_id      bigint,            -- FK -> lancamentos (despesa gerada na conclusão)
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 3) índices ------------------------------------------------------------------
create index if not exists idx_manut_planos_usuario   on public.manutencao_planos (usuario_id);
create index if not exists idx_manut_planos_proxima   on public.manutencao_planos (usuario_id, proxima_data);
create index if not exists idx_manut_planos_ativo     on public.manutencao_planos (ativo_id);
create index if not exists idx_manut_planos_prop      on public.manutencao_planos (propriedade_id);

create index if not exists idx_manut_os_usuario       on public.manutencao_os (usuario_id);
create index if not exists idx_manut_os_status        on public.manutencao_os (usuario_id, status);
create index if not exists idx_manut_os_tipo          on public.manutencao_os (usuario_id, tipo);
create index if not exists idx_manut_os_prazo         on public.manutencao_os (usuario_id, prazo);
create index if not exists idx_manut_os_prop          on public.manutencao_os (propriedade_id);
create index if not exists idx_manut_os_ativo         on public.manutencao_os (ativo_id);
create index if not exists idx_manut_os_plano         on public.manutencao_os (plano_id);
create index if not exists idx_manut_os_evento        on public.manutencao_os (evento_id);

-- 4) atualizado_em automático -------------------------------------------------
create or replace function public.tg_manutencao_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_manut_planos_touch on public.manutencao_planos;
create trigger trg_manut_planos_touch
  before update on public.manutencao_planos
  for each row execute function public.tg_manutencao_touch();

drop trigger if exists trg_manut_os_touch on public.manutencao_os;
create trigger trg_manut_os_touch
  before update on public.manutencao_os
  for each row execute function public.tg_manutencao_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
--    A geração automática de OS (cron) usa service-role (ignora RLS).
alter table public.manutencao_planos enable row level security;
alter table public.manutencao_os     enable row level security;

drop policy if exists "dono gerencia manutencao_planos" on public.manutencao_planos;
create policy "dono gerencia manutencao_planos" on public.manutencao_planos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia manutencao_os" on public.manutencao_os;
create policy "dono gerencia manutencao_os" on public.manutencao_os
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FKs opcionais (só se as tabelas-alvo existirem) --------------------------
-- Adiciona uma FK a uma coluna existente, protegido contra incompatibilidade de
-- tipo (ex.: bigint × integer). Se falhar, mantém a coluna sem FK.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('manutencao_planos', 'propriedade_id', 'propriedades',      'id', 'manut_planos_propriedade_id_fkey'),
      ('manutencao_planos', 'espaco_id',      'espacos',           'id', 'manut_planos_espaco_id_fkey'),
      ('manutencao_planos', 'ativo_id',       'ativos',            'id', 'manut_planos_ativo_id_fkey'),
      ('manutencao_os',     'propriedade_id', 'propriedades',      'id', 'manut_os_propriedade_id_fkey'),
      ('manutencao_os',     'espaco_id',      'espacos',           'id', 'manut_os_espaco_id_fkey'),
      ('manutencao_os',     'ativo_id',       'ativos',            'id', 'manut_os_ativo_id_fkey'),
      ('manutencao_os',     'evento_id',      'clientes_eventos',  'id', 'manut_os_evento_id_fkey'),
      ('manutencao_os',     'lancamento_id',  'lancamentos',       'id', 'manut_os_lancamento_id_fkey')
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

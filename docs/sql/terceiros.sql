-- ============================================================================
-- Terceiros (custo × retorno) — /painel/terceiros
-- ----------------------------------------------------------------------------
-- Visão GERENCIAL dos serviços terceirizados: enxerga cada prestador como um
-- investimento — quanto CUSTA (mensal/por evento/percentual/hora) × quanto
-- DEVOLVE (receita atribuída, eventos atendidos, economia, SLA cumprido,
-- satisfação) → ROI / índice de valor → decisão (manter · renegociar · trocar ·
-- internalizar). Complementa o cadastro OPERACIONAL de /painel/fornecedores: um
-- terceiro pode apontar para um fornecedor (fornecedor_id) e o custo realizado é
-- puxado de `lancamentos` (Contas a pagar) por esse vínculo.
--
-- Duas tabelas:
--   • terceiros            — o serviço terceirizado (categoria, modelo de custo,
--                            valor, vínculo a fornecedor, contrato/vigência,
--                            renovação, multa, SLA jsonb, status). O documento do
--                            contrato vai para o bucket `documentos`.
--   • terceiros_resultados — medição PERIÓDICA (uma por competência 'YYYY-MM'):
--                            custo realizado, receita atribuída, eventos
--                            atendidos, economia, SLA cumprido (%), satisfação.
--
-- A engine que calcula mensalização, ROI/índice de valor, SLA, tendência de
-- custo, decisão e alertas vive em lib/terceiros.ts (pura, testada). O CRUD é
-- feito pelo client via RLS (o dono vê/edita só as próprias linhas) — espelha
-- Seguros/Manutenção.
--
-- Convenções (ver docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num. Nunca formate "R$" no banco.
--   • INDEPENDENTE de outras migrations: fornecedor_id/contrato_id ficam como
--     colunas simples; as foreign keys são adicionadas DEPOIS, só se as tabelas-
--     alvo existirem (bloco DO no fim). Re-rodar cria as FKs novas.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) terceiros (serviço terceirizado) ----------------------------------------
create table if not exists public.terceiros (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references auth.users (id) on delete cascade,
  -- Vínculo opcional ao cadastro operacional de fornecedores:
  fornecedor_id        uuid,              -- FK -> fornecedores (fim do arquivo)
  servico              text not null,     -- nome do serviço (ex.: "Segurança patrimonial")
  categoria            text not null default 'outro'
                       check (categoria in ('seguranca','limpeza','contabilidade','marketing','ti',
                                            'manutencao','juridico','buffet','valet','transporte','rh','outro')),
  -- Modelo de custo + valor UNITÁRIO do modelo (mensal/por evento/%/hora):
  modelo_custo         text not null default 'mensal'
                       check (modelo_custo in ('mensal','por_evento','percentual','hora')),
  custo_num            numeric not null default 0 check (custo_num >= 0),
  -- Estimativa de INTERNALIZAR (custo mensal de trazer p/ dentro) — alimenta a
  -- comparação custo×retorno e a decisão "internalizar". null = não estimado.
  custo_interno_mensal_num numeric check (custo_interno_mensal_num is null or custo_interno_mensal_num >= 0),
  responsavel          text,              -- responsável interno pela relação
  -- Contrato:
  contrato_id          uuid,              -- forward-compat (sem FK — domínio de fornecedor)
  documento_url        text,             -- contrato no bucket `documentos`
  documento_nome       text,
  vigencia_inicio      date,
  vigencia_fim         date,
  renovacao_automatica boolean not null default false,
  aviso_previo_dias    integer not null default 30 check (aviso_previo_dias >= 0),
  multa_rescisao       text,              -- cláusula de multa/glosa (texto livre)
  -- SLA: { alvo_pct, metas:[{nome,alvo}] } — alvo agregado + metas descritivas.
  sla                  jsonb not null default '{}'::jsonb,
  status               text not null default 'ativo'
                       check (status in ('ativo','em_avaliacao','suspenso','encerrado')),
  obs                  text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

-- 2) terceiros_resultados (medição periódica do custo × retorno) -------------
create table if not exists public.terceiros_resultados (
  id                    uuid primary key default gen_random_uuid(),
  usuario_id            uuid not null references auth.users (id) on delete cascade,
  terceiro_id           uuid not null references public.terceiros (id) on delete cascade,
  competencia           text not null,    -- 'YYYY-MM'
  custo_num             numeric not null default 0 check (custo_num >= 0),           -- custo realizado no mês
  receita_atribuida_num numeric not null default 0 check (receita_atribuida_num >= 0),
  eventos_atendidos     integer not null default 0 check (eventos_atendidos >= 0),
  economia_num          numeric not null default 0 check (economia_num >= 0),
  sla_cumprido_pct      numeric check (sla_cumprido_pct is null or (sla_cumprido_pct >= 0 and sla_cumprido_pct <= 100)),
  satisfacao            numeric check (satisfacao is null or (satisfacao >= 0 and satisfacao <= 5)),
  obs                   text,
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now(),
  -- Uma medição por competência por terceiro (upsert por mês).
  unique (terceiro_id, competencia)
);

-- 3) índices ------------------------------------------------------------------
create index if not exists idx_terceiros_usuario     on public.terceiros (usuario_id);
create index if not exists idx_terceiros_categoria   on public.terceiros (usuario_id, categoria);
create index if not exists idx_terceiros_status      on public.terceiros (usuario_id, status);
create index if not exists idx_terceiros_vigencia    on public.terceiros (usuario_id, vigencia_fim);
create index if not exists idx_terceiros_fornecedor  on public.terceiros (fornecedor_id);

create index if not exists idx_terc_result_usuario   on public.terceiros_resultados (usuario_id);
create index if not exists idx_terc_result_terceiro  on public.terceiros_resultados (terceiro_id);
create index if not exists idx_terc_result_comp      on public.terceiros_resultados (terceiro_id, competencia);

-- 4) atualizado_em automático -------------------------------------------------
create or replace function public.tg_terceiros_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_terceiros_touch on public.terceiros;
create trigger trg_terceiros_touch
  before update on public.terceiros
  for each row execute function public.tg_terceiros_touch();

drop trigger if exists trg_terc_result_touch on public.terceiros_resultados;
create trigger trg_terc_result_touch
  before update on public.terceiros_resultados
  for each row execute function public.tg_terceiros_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
alter table public.terceiros            enable row level security;
alter table public.terceiros_resultados enable row level security;

drop policy if exists "dono gerencia terceiros" on public.terceiros;
create policy "dono gerencia terceiros" on public.terceiros
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia terceiros_resultados" on public.terceiros_resultados;
create policy "dono gerencia terceiros_resultados" on public.terceiros_resultados
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FK opcional (só se a tabela-alvo existir) --------------------------------
-- Liga terceiros.fornecedor_id -> fornecedores.id quando o módulo Fornecedores
-- já foi criado. Protegido contra incompatibilidade de tipo; se falhar, mantém
-- a coluna sem FK.
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('terceiros', 'fornecedor_id', 'fornecedores', 'id', 'terceiros_fornecedor_id_fkey')
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

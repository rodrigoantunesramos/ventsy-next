-- ============================================================================
-- Relatórios & BI — /painel/relatorios  (estende a rota existente)
-- ----------------------------------------------------------------------------
-- A central de inteligência cruza módulos JÁ EXISTENTES (clientes_eventos,
-- lancamentos, parcelas, reservas, espacos, avaliacoes, pesquisas_respostas,
-- feedbacks, propostas, contratos) — esses NÃO são recriados aqui. Este migration
-- cria apenas o que é próprio do BI:
--
--   • `relatorios_salvos`     — relatórios do CONSTRUTOR (dimensão × métrica +
--                                filtros + tipo de gráfico) salvos pelo dono p/
--                                reabrir/reexecutar. `config` é o estado completo
--                                do construtor (jsonb), recalculado sempre ao vivo
--                                a partir das tabelas-fonte (nada de número
--                                materializado → sempre bate com os módulos).
--   • `relatorios_agendados`  — exportação automática por e-mail (PDF/Excel/CSV)
--                                em frequência diário/semanal/mensal. O cron
--                                /api/cron/relatorios-agendados lê os ativos cuja
--                                `proxima_exec` <= hoje, envia e reprograma.
--
-- O cálculo (ocupação, RevPAS, receita/m², funil, DRE, NPS, agregação do
-- construtor, próxima execução) vive na engine PURA lib/bi.ts (testada). O CRUD é
-- feito pelo client via RLS; o cron usa service-role.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) relatorios_salvos — relatórios do construtor -----------------------------
--    config jsonb: { fonte, dimensao, metrica, chart, periodo, filtros:{prop,tipo} }
create table if not exists public.relatorios_salvos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  descricao     text,
  config        jsonb not null default '{}'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) relatorios_agendados — exportação automática por e-mail ------------------
create table if not exists public.relatorios_agendados (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  relatorio_id  uuid,                                  -- FK -> relatorios_salvos (fim do arquivo)
  dashboard     text,                                  -- dashboard nativo a enviar se não há relatorio_id
  formato       text not null default 'pdf'
                check (formato in ('pdf', 'excel', 'csv')),
  frequencia    text not null default 'semanal'
                check (frequencia in ('diario', 'semanal', 'mensal')),
  dia_semana    integer check (dia_semana between 0 and 6),   -- 0=Dom (frequencia=semanal)
  dia_mes       integer check (dia_mes between 1 and 28),     -- (frequencia=mensal)
  destinatarios text[] not null default '{}',
  ativo         boolean not null default true,
  ultima_exec   timestamptz,
  proxima_exec  date,                                  -- calculada por lib/bi.proximaExecucao
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) índices ------------------------------------------------------------------
create index if not exists idx_rel_salvos_usuario   on public.relatorios_salvos (usuario_id);
create index if not exists idx_rel_agend_usuario     on public.relatorios_agendados (usuario_id);
create index if not exists idx_rel_agend_proxima     on public.relatorios_agendados (proxima_exec) where ativo;

-- 4) atualizado_em automático (gatilho genérico reaproveitado) ----------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_rel_salvos_touch on public.relatorios_salvos;
create trigger trg_rel_salvos_touch
  before update on public.relatorios_salvos
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_rel_agend_touch on public.relatorios_agendados;
create trigger trg_rel_agend_touch
  before update on public.relatorios_agendados
  for each row execute function public.tg_touch_atualizado_em();

-- 5) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
--    O cron (/api/cron/relatorios-agendados) usa service-role (ignora RLS).
alter table public.relatorios_salvos    enable row level security;
alter table public.relatorios_agendados enable row level security;

drop policy if exists "dono gerencia relatorios_salvos" on public.relatorios_salvos;
create policy "dono gerencia relatorios_salvos" on public.relatorios_salvos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia relatorios_agendados" on public.relatorios_agendados;
create policy "dono gerencia relatorios_agendados" on public.relatorios_agendados
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FK opcional relatorios_agendados.relatorio_id -> relatorios_salvos --------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'rel_agend_relatorio_id_fkey') then
    begin
      alter table public.relatorios_agendados
        add constraint rel_agend_relatorio_id_fkey
        foreign key (relatorio_id) references public.relatorios_salvos (id) on delete set null;
    exception when others then
      raise notice 'FK relatorios_agendados.relatorio_id não criada (%). Coluna mantida sem FK.', sqlerrm;
    end;
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- AGENDAMENTO (cron). Os 8 crons da Ventsy rodam no Supabase via pg_cron+pg_net
-- (o vercel.json Hobby não comporta), disparando www.ventsy.com.br/api/cron/*.
-- Registre este, idempotente (descomente e ajuste o secret/URL):
--
-- select cron.schedule(
--   'relatorios-agendados',
--   '0 11 * * *',                      -- 08:00 BRT (11:00 UTC), todo dia
--   $$ select net.http_get(
--        url := 'https://www.ventsy.com.br/api/cron/relatorios-agendados',
--        headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret', true))
--      ); $$
-- );
-- ----------------------------------------------------------------------------

-- Fim ------------------------------------------------------------------------

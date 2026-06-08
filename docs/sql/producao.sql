-- ============================================================================
-- Produção & Run-of-show — /painel/producao
-- ----------------------------------------------------------------------------
-- Transforma um evento CONTRATADO (clientes_eventos) num PROJETO EXECUTÁVEL: um
-- briefing estruturado, uma checklist de produção (por categoria, com
-- responsável/prazo/dependência), um cronograma operacional minuto-a-minuto
-- (run-of-show) e o fechamento pós-evento. É o "dia D sob controle". Escala do
-- casamento à feira/festival.
--
--   • `producao`          — 1:1 com o evento (briefing jsonb + status + obs).
--   • `producao_tarefas`  — checklist; cada tarefa tem categoria, responsável
--                           (produção/equipe/fornecedor/cliente), prazo, status
--                           (Kanban), prioridade e DEPENDÊNCIA (depende_de) que
--                           bloqueia a ordem de execução.
--   • `runshow`           — itens do cronograma (horário, duração, atividade,
--                           área/espaço, responsável, recurso) com `concluido`
--                           p/ o "modo dia do evento".
--
-- A engine de prontidão/dependências/templates/conflitos vive em lib/producao.ts
-- (pura, testada). O "ensure 1:1 + aplicar template" e a CONCLUSÃO de tarefa
-- (que respeita a dependência) passam por /api/producao (service-role,
-- autoritativo). O CRUD demais (briefing, criar/editar tarefa e run-show) é feito
-- pelo client via RLS.
--
-- INDEPENDENTE da ordem de migrations: FKs para `equipe` (bigint) e demais
-- tabelas opcionais entram condicionalmente (blocos DO no fim), só se existirem.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) producao — 1:1 com o evento ---------------------------------------------
--    UNIQUE(evento_id): garante uma única produção por evento (a /api/producao
--    faz get-or-create atômico em cima dessa restrição).
create table if not exists public.producao (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  status        text not null default 'planejamento'
                check (status in ('planejamento','pronto','em_execucao','encerrado')),
  briefing      jsonb not null default '{}'::jsonb,
  observacoes   text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (evento_id)
);

-- 2) producao_tarefas — checklist de produção --------------------------------
--    depende_de: dependência (mesma checklist) que bloqueia a conclusão; a FK
--    auto-referente usa ON DELETE SET NULL (remover a pai libera as filhas).
create table if not exists public.producao_tarefas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  producao_id      uuid not null references public.producao (id) on delete cascade,
  titulo           text not null,
  categoria        text not null default 'outro'
                   check (categoria in ('comercial','logistica','AeB','tecnico','seguranca',
                                        'limpeza','decoracao','cerimonia','pos','outro')),
  responsavel      text not null default 'producao'
                   check (responsavel in ('producao','equipe','fornecedor','cliente')),
  responsavel_id   text,                                -- equipe.id / fornecedor.id (texto: flexível)
  responsavel_nome text,                                -- snapshot do nome (quando informado)
  prazo            date,
  status           text not null default 'pendente'
                   check (status in ('pendente','fazendo','concluida','cancelada')),
  prioridade       text not null default 'normal'
                   check (prioridade in ('baixa','normal','alta','critica')),
  depende_de       uuid references public.producao_tarefas (id) on delete set null,
  obs              text,
  anexos           jsonb not null default '[]'::jsonb,  -- [{nome,url}]
  ordem            integer not null default 0,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- 3) runshow — cronograma operacional (minuto-a-minuto) ----------------------
--    `data` nullable cobre multi-dia (feira/festival); a UI ordena por
--    (data, horario, ordem). `concluido` é marcado no modo dia-do-evento.
create table if not exists public.runshow (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  producao_id   uuid not null references public.producao (id) on delete cascade,
  data          date,                                   -- dia do item (multi-dia)
  horario       text not null default '00:00',          -- 'HH:MM'
  duracao_min   integer not null default 0 check (duracao_min >= 0),
  atividade     text not null,
  area          text,                                   -- palco/pista/recepção/cozinha…
  responsavel   text,                                   -- nome/função (texto livre)
  recurso       text,                                   -- som/luz/palco/projeção…
  obs           text,
  concluido     boolean not null default false,
  ordem         integer not null default 0,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4) índices -----------------------------------------------------------------
create index if not exists idx_producao_usuario        on public.producao (usuario_id);
create index if not exists idx_producao_evento         on public.producao (usuario_id, evento_id);

create index if not exists idx_prod_tarefas_usuario    on public.producao_tarefas (usuario_id);
create index if not exists idx_prod_tarefas_producao   on public.producao_tarefas (producao_id);
create index if not exists idx_prod_tarefas_status     on public.producao_tarefas (producao_id, status);
create index if not exists idx_prod_tarefas_depende    on public.producao_tarefas (depende_de);

create index if not exists idx_runshow_usuario         on public.runshow (usuario_id);
create index if not exists idx_runshow_producao        on public.runshow (producao_id, data, horario);

-- 5) atualizado_em automático (gatilho genérico, reaproveitado) --------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_producao_touch on public.producao;
create trigger trg_producao_touch
  before update on public.producao
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_prod_tarefas_touch on public.producao_tarefas;
create trigger trg_prod_tarefas_touch
  before update on public.producao_tarefas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_runshow_touch on public.runshow;
create trigger trg_runshow_touch
  before update on public.runshow
  for each row execute function public.tg_touch_atualizado_em();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    Briefing + CRUD de tarefas/run-show vão pelo client via RLS. O "ensure +
--    template" e a CONCLUSÃO de tarefa (dependência) passam por /api/producao
--    (service-role, ignora RLS).
alter table public.producao         enable row level security;
alter table public.producao_tarefas enable row level security;
alter table public.runshow          enable row level security;

drop policy if exists "dono gerencia producao" on public.producao;
create policy "dono gerencia producao" on public.producao
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia producao_tarefas" on public.producao_tarefas;
create policy "dono gerencia producao_tarefas" on public.producao_tarefas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia runshow" on public.runshow;
create policy "dono gerencia runshow" on public.runshow
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 7) FKs opcionais (só se as tabelas-alvo existirem) -------------------------
--    responsavel_id é text (aceita equipe.id bigint ou fornecedor.id uuid sem
--    acoplar a uma FK rígida) — por isso NÃO criamos FK aqui. Mantido flexível
--    de propósito; a integridade do responsável é validada na aplicação.
--    (Bloco reservado p/ futuras FKs condicionais — sem ações no momento.)

-- Observação: a checagem de DEPENDÊNCIA (não concluir antes da tarefa-pai), a
-- geração por TEMPLATE e a prontidão vivem na engine lib/producao.ts + a rota
-- /api/producao. A RLS garante o isolamento multi-tenant; a regra de negócio
-- fica na camada de aplicação (espelha Ponto/Equipamentos).

-- Fim ------------------------------------------------------------------------

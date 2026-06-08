-- ============================================================================
-- Ponto & Escala — /painel/ponto
-- ----------------------------------------------------------------------------
-- Escalar equipe FIXA (tabela `equipe`) + FREELANCERS para cada evento,
-- registrar ponto (entrada/saída), apurar horas/extras/adicional noturno/banco
-- de horas e o CUSTO DE MÃO DE OBRA por evento (entra no custo direto do
-- evento → Contabilidade e margem). Eventos têm picos: um casamento usa 20
-- freelancers numa noite; uma feira de 3 dias, centenas de turnos.
--
--   • `freelancers`        — banco reutilizável de diaristas (função, diária, PIX).
--   • `escalas`            — necessidade de vagas de um turno/função num evento.
--   • `escalas_alocacao`   — pessoa (fixo OU freelancer) alocada a uma escala,
--                            ciclo convocado → confirmado → presente (ou falta).
--   • `ponto_registros`    — batidas de ponto com horas/extras/noturno/atraso já
--                            apuradas (a /api/ponto grava o que lib/ponto.ts calcula).
--
-- A engine de cobertura/custo/horas vive em lib/ponto.ts (pura, testada). A
-- alocação passa por /api/ponto (service-role, autoritativo) que RECUSA
-- super-alocação por vaga (mais pessoas do que `necessario`, salvo `force`).
--
-- INDEPENDENTE da ordem de migrations: FKs para `equipe` (bigint), `reservas` e
-- `contas_pagar` são adicionadas condicionalmente (blocos DO no fim), só se as
-- tabelas existirem. Re-rodar este arquivo adiciona a FK que faltava.
--
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais. Rode no
-- Supabase (SQL Editor) e depois regenere types/supabase.ts (enquanto isso o
-- código usa `supabaseAny`).
-- ============================================================================

-- 1) freelancers — banco de diaristas por função -----------------------------
create table if not exists public.freelancers (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  nome             text not null,
  funcao           text not null default 'garcom'
                   check (funcao in ('garcom','seguranca','recepcao','montador','manobrista',
                                     'brigadista','limpeza','coordenacao','cozinha','bar','dj','outro')),
  contato          text,                               -- telefone/WhatsApp
  email            text,
  valor_diaria_num numeric not null default 0 check (valor_diaria_num >= 0),
  avaliacao        numeric check (avaliacao is null or (avaliacao >= 0 and avaliacao <= 5)),
  doc              text,                               -- CPF/RG (opcional)
  chave_pix        text,                               -- pagamento da diária
  ativo            boolean not null default true,
  obs              text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- 2) escalas — vagas necessárias por turno/função de um evento ----------------
create table if not exists public.escalas (
  id                   uuid primary key default gen_random_uuid(),
  usuario_id           uuid not null references auth.users (id) on delete cascade,
  evento_id            uuid references public.clientes_eventos (id) on delete set null,
  reserva_id           uuid,                           -- → reservas (FK guarded no fim)
  propriedade_id       uuid,                           -- → propriedades (sem FK; opcional)
  data                 date not null default current_date,
  turno                text not null default 'integral'
                       check (turno in ('manha','tarde','noite','madrugada','integral')),
  funcao               text not null default 'garcom'
                       check (funcao in ('garcom','seguranca','recepcao','montador','manobrista',
                                         'brigadista','limpeza','coordenacao','cozinha','bar','dj','outro')),
  necessario           integer not null default 1 check (necessario >= 0),
  valor_diaria_ref_num numeric not null default 0,     -- diária de referência da vaga
  status               text not null default 'planejada'
                       check (status in ('planejada','publicada','concluida','cancelada')),
  obs                  text,
  criado_em            timestamptz not null default now(),
  atualizado_em        timestamptz not null default now()
);

-- 3) escalas_alocacao — pessoa (fixo OU freelancer) alocada a uma escala ------
--    Exatamente uma das duas referências (equipe_id | freelancer_id) é exigida.
--    valor_diaria_num é a FOTOGRAFIA da diária no momento da convocação.
--    pago/conta_pagar_id: fechamento de diárias gera conta a pagar (Financeiro).
create table if not exists public.escalas_alocacao (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  escala_id        uuid not null references public.escalas (id) on delete cascade,
  equipe_id        bigint,                             -- fixo → equipe (FK guarded no fim)
  freelancer_id    uuid references public.freelancers (id) on delete set null,
  inicio_previsto  timestamptz,
  fim_previsto     timestamptz,
  valor_diaria_num numeric not null default 0 check (valor_diaria_num >= 0),
  status           text not null default 'convocado'
                   check (status in ('convocado','confirmado','presente','falta','cancelado')),
  pago             boolean not null default false,
  conta_pagar_id   uuid,                               -- → contas_pagar (FK guarded no fim)
  obs              text,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  check (equipe_id is not null or freelancer_id is not null)
);

-- 4) ponto_registros — batidas de ponto + apuração (escrita por /api/ponto) ---
--    Os minutos derivados (trabalhado/extras/noturno/atraso/saldo) são gravados
--    pela API espelhando lib/ponto.ts — a UI lê prontos. Cobre fixos e freelas.
create table if not exists public.ponto_registros (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  alocacao_id    uuid references public.escalas_alocacao (id) on delete set null,
  equipe_id      bigint,                               -- fixo (FK guarded no fim)
  freelancer_id  uuid references public.freelancers (id) on delete set null,
  evento_id      uuid references public.clientes_eventos (id) on delete set null,
  data           date not null default current_date,
  entrada        timestamptz,
  saida          timestamptz,
  intervalo_min  integer not null default 0,
  jornada_min    integer not null default 0,
  trabalhado_min integer not null default 0,           -- líquido (− intervalo)
  extras_min     integer not null default 0,
  noturno_min    integer not null default 0,
  atraso_min     integer not null default 0,
  saldo_min      integer not null default 0,           -- trabalhado − jornada (banco de horas)
  origem         text not null default 'manual'
                 check (origem in ('app','qr','manual','biometria')),
  local          text,
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_freelancers_usuario     on public.freelancers (usuario_id);
create index if not exists idx_freelancers_funcao      on public.freelancers (usuario_id, funcao);

create index if not exists idx_escalas_usuario         on public.escalas (usuario_id);
create index if not exists idx_escalas_evento          on public.escalas (usuario_id, evento_id);
create index if not exists idx_escalas_data            on public.escalas (usuario_id, data);

create index if not exists idx_escala_aloc_usuario     on public.escalas_alocacao (usuario_id);
create index if not exists idx_escala_aloc_escala      on public.escalas_alocacao (escala_id);
create index if not exists idx_escala_aloc_equipe      on public.escalas_alocacao (equipe_id);
create index if not exists idx_escala_aloc_freelancer  on public.escalas_alocacao (freelancer_id);
create index if not exists idx_escala_aloc_status      on public.escalas_alocacao (status);

create index if not exists idx_ponto_usuario           on public.ponto_registros (usuario_id, data);
create index if not exists idx_ponto_evento            on public.ponto_registros (usuario_id, evento_id);
create index if not exists idx_ponto_alocacao          on public.ponto_registros (alocacao_id);
create index if not exists idx_ponto_equipe            on public.ponto_registros (equipe_id);
create index if not exists idx_ponto_freelancer        on public.ponto_registros (freelancer_id);

-- 6) atualizado_em automático (gatilho genérico, reaproveitado) ---------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_freelancers_touch on public.freelancers;
create trigger trg_freelancers_touch
  before update on public.freelancers
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_escalas_touch on public.escalas;
create trigger trg_escalas_touch
  before update on public.escalas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_escala_aloc_touch on public.escalas_alocacao;
create trigger trg_escala_aloc_touch
  before update on public.escalas_alocacao
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_ponto_touch on public.ponto_registros;
create trigger trg_ponto_touch
  before update on public.ponto_registros
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    Leitura (escala, ponto, apuração) e o CRUD de freelancers/escalas são
--    feitos pelo client via RLS; a ALOCAÇÃO (corrida sensível a super-alocação)
--    passa por /api/ponto (service-role, ignora RLS).
alter table public.freelancers      enable row level security;
alter table public.escalas          enable row level security;
alter table public.escalas_alocacao enable row level security;
alter table public.ponto_registros  enable row level security;

drop policy if exists "dono gerencia freelancers" on public.freelancers;
create policy "dono gerencia freelancers" on public.freelancers
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia escalas" on public.escalas;
create policy "dono gerencia escalas" on public.escalas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia escalas_alocacao" on public.escalas_alocacao;
create policy "dono gerencia escalas_alocacao" on public.escalas_alocacao
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia ponto_registros" on public.ponto_registros;
create policy "dono gerencia ponto_registros" on public.ponto_registros
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 8) FKs opcionais (só se as tabelas-alvo existirem) -------------------------
do $$
begin
  -- escalas.reserva_id -> reservas
  if to_regclass('public.reservas') is not null
     and not exists (select 1 from pg_constraint where conname = 'escalas_reserva_id_fkey') then
    alter table public.escalas
      add constraint escalas_reserva_id_fkey
      foreign key (reserva_id) references public.reservas (id) on delete set null;
  end if;

  -- escalas_alocacao.equipe_id -> equipe (bigint)
  if to_regclass('public.equipe') is not null
     and not exists (select 1 from pg_constraint where conname = 'escala_aloc_equipe_id_fkey') then
    alter table public.escalas_alocacao
      add constraint escala_aloc_equipe_id_fkey
      foreign key (equipe_id) references public.equipe (id) on delete set null;
  end if;

  -- escalas_alocacao.conta_pagar_id -> contas_pagar
  if to_regclass('public.contas_pagar') is not null
     and not exists (select 1 from pg_constraint where conname = 'escala_aloc_conta_pagar_id_fkey') then
    alter table public.escalas_alocacao
      add constraint escala_aloc_conta_pagar_id_fkey
      foreign key (conta_pagar_id) references public.contas_pagar (id) on delete set null;
  end if;

  -- ponto_registros.equipe_id -> equipe (bigint)
  if to_regclass('public.equipe') is not null
     and not exists (select 1 from pg_constraint where conname = 'ponto_equipe_id_fkey') then
    alter table public.ponto_registros
      add constraint ponto_equipe_id_fkey
      foreign key (equipe_id) references public.equipe (id) on delete set null;
  end if;
end $$;

-- Observação: a checagem de super-alocação (não convocar mais que `necessario`)
-- é feita na engine lib/ponto.ts + /api/ponto (service-role). A RLS garante o
-- isolamento multi-tenant; a regra de negócio fica na camada de aplicação.

-- Fim ------------------------------------------------------------------------

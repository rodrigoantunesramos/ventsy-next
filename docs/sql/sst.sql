-- ============================================================================
-- Saúde, Segurança & Emergência (SST) — /painel/sst
-- ----------------------------------------------------------------------------
-- Segurança de PESSOAS no evento: plano de emergência/evacuação/APH/incêndio,
-- dimensionamento de recursos por público (ambulância, posto médico, brigada,
-- bombeiro civil, segurança, extintores, desfibrilador), EPIs e treinamentos/NRs
-- com validade, simulados/inspeções e registro de ocorrências/acidentes. A engine
-- que dimensiona o público, calcula a cobertura (faltas bloqueiam a prontidão) e
-- os indicadores de ocorrências vive em lib/sst.ts (pura, testada).
--
--   • `sst_planos`           — plano por espaço e/ou evento (rotas/pontos/contatos
--     em conteudo jsonb), tipo, responsável, validade, status.
--   • `sst_recursos_evento`  — recurso exigido/alocado por evento (exigido vs
--     quantidade garantida, status, fornecedor). A `origem` distingue o que veio
--     do dimensionamento automático do que foi adicionado à mão.
--   • `sst_ocorrencias`      — acidentes/incidentes/atendimentos (tipo, gravidade,
--     pessoa, atendimento, CAT, anexos).
--   • `sst_epis`             — controle de EPIs (CA, quantidade, validade do CA).
--   • `sst_treinamentos`     — treinamentos obrigatórios/NRs por pessoa (validade,
--     certificado) — liga com `equipe`/RH.
--   • `sst_simulados`        — simulados de evacuação/incêndio/APH e inspeções.
--
-- O dimensionamento autoritativo (público → recursos exigidos) passa por
-- /api/sst (service-role, idempotente). O restante do CRUD é feito pelo client
-- via RLS. Sem dinheiro aqui — custo de recursos vive em Compras/Logística.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) sst_planos — plano de emergência por espaço e/ou evento ------------------
--    conteudo jsonb: { rotas[], pontos_encontro[], recursos[], procedimentos[],
--    contatos[{nome, telefone}] }. Um plano pode ser do ESPAÇO (propriedade_id),
--    do EVENTO (evento_id) ou de ambos.
create table if not exists public.sst_planos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint references public.propriedades (id) on delete set null,
  evento_id      uuid references public.clientes_eventos (id) on delete cascade,
  tipo           text not null default 'emergencia'
                 check (tipo in ('emergencia','evacuacao','aph','incendio')),
  nome           text not null default '',
  conteudo       jsonb not null default '{}'::jsonb,
  responsavel    text,
  validade       date,
  status         text not null default 'rascunho'
                 check (status in ('rascunho','vigente','revisao','arquivado')),
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) sst_recursos_evento — recurso exigido/alocado por evento ----------------
--    exigido  = quanto o dimensionamento (ou o usuário) exige.
--    quantidade = quanto já está garantido/alocado.
--    origem 'dimensionamento' = gerado pela engine (idempotente por evento+tipo).
create table if not exists public.sst_recursos_evento (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  tipo          text not null
                check (tipo in ('ambulancia','uti_movel','posto_medico','medico','enfermeiro',
                                'socorrista','brigadista','bombeiro_civil','seguranca',
                                'extintor','desfibrilador','maca')),
  exigido       integer not null default 0 check (exigido >= 0),
  quantidade    integer not null default 0 check (quantidade >= 0),
  obrigatorio   boolean not null default false,
  status        text not null default 'previsto'
                check (status in ('previsto','contratado','confirmado','em_falta','nao_aplicavel')),
  origem        text not null default 'manual'
                check (origem in ('dimensionamento','manual')),
  fornecedor_id uuid,                              -- → fornecedores (FK guarded no fim)
  base          text,                              -- de onde veio o número (transparência)
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  -- 1 linha por (evento, tipo, origem) — torna o dimensionamento idempotente
  -- (upsert) sem colidir com linhas manuais do mesmo tipo.
  unique (evento_id, tipo, origem)
);

-- 3) sst_ocorrencias — acidentes/incidentes/atendimentos ---------------------
create table if not exists public.sst_ocorrencias (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid references public.clientes_eventos (id) on delete set null,
  propriedade_id bigint references public.propriedades (id) on delete set null,
  tipo          text not null default 'incidente'
                check (tipo in ('acidente','incidente','mal_estar','queda','incendio',
                                'evacuacao','briga','furto','intoxicacao','outro')),
  gravidade     text not null default 'leve'
                check (gravidade in ('leve','moderada','grave','fatal')),
  descricao     text not null default '',
  pessoa        text,                              -- envolvido (nome livre)
  local         text,                              -- onde ocorreu (setor/zona)
  atendimento   text,                              -- conduta/encaminhamento
  data          timestamptz not null default now(),
  cat_emitida   boolean not null default false,    -- Comunicação de Acidente de Trabalho
  anexos        jsonb not null default '[]'::jsonb,
  criado_em     timestamptz not null default now()
);

-- 4) sst_epis — controle de EPIs ---------------------------------------------
create table if not exists public.sst_epis (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  ca            text,                              -- Certificado de Aprovação (MTE)
  quantidade    integer not null default 0 check (quantidade >= 0),
  funcao        text,                              -- a quem se destina
  validade_ca   date,                              -- validade do CA
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 5) sst_treinamentos — treinamentos obrigatórios / NRs por pessoa -----------
--    Liga com `equipe`/RH (equipe_id, FK guarded) ou pessoa em texto livre.
create table if not exists public.sst_treinamentos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  equipe_id      bigint,                           -- → equipe (FK guarded no fim)
  pessoa         text,                             -- quando não vier da equipe
  nr             text not null default 'outro',    -- 'NR-06'|'NR-23'|'brigada'|'aph'|'NR-35'…
  instituicao    text,
  emissao        date,
  validade       date,
  certificado_url text,
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 6) sst_simulados — simulados & inspeções -----------------------------------
create table if not exists public.sst_simulados (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint references public.propriedades (id) on delete set null,
  evento_id      uuid references public.clientes_eventos (id) on delete set null,
  tipo           text not null default 'evacuacao'
                 check (tipo in ('evacuacao','incendio','aph','inspecao')),
  data           date not null default current_date,
  participantes  integer not null default 0 check (participantes >= 0),
  tempo_seg      integer check (tempo_seg is null or tempo_seg >= 0),  -- tempo de evacuação (s)
  resultado      text not null default 'satisfatorio'
                 check (resultado in ('satisfatorio','parcial','insatisfatorio')),
  responsavel    text,
  observacoes    text,
  proxima_data   date,                             -- periodicidade
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 7) FKs opcionais (módulos podem ainda não existir / id-type específico) -----
do $$
begin
  if to_regclass('public.fornecedores') is not null
     and not exists (select 1 from pg_constraint where conname = 'sst_recursos_fornecedor_id_fkey') then
    alter table public.sst_recursos_evento
      add constraint sst_recursos_fornecedor_id_fkey
      foreign key (fornecedor_id) references public.fornecedores (id) on delete set null;
  end if;

  if to_regclass('public.equipe') is not null
     and not exists (select 1 from pg_constraint where conname = 'sst_treinamentos_equipe_id_fkey') then
    alter table public.sst_treinamentos
      add constraint sst_treinamentos_equipe_id_fkey
      foreign key (equipe_id) references public.equipe (id) on delete set null;
  end if;
end $$;

-- 8) índices -----------------------------------------------------------------
create index if not exists idx_sst_planos_usuario     on public.sst_planos (usuario_id);
create index if not exists idx_sst_planos_evento      on public.sst_planos (evento_id);
create index if not exists idx_sst_planos_prop        on public.sst_planos (propriedade_id);
create index if not exists idx_sst_planos_validade    on public.sst_planos (usuario_id, validade);

create index if not exists idx_sst_recursos_usuario   on public.sst_recursos_evento (usuario_id);
create index if not exists idx_sst_recursos_evento    on public.sst_recursos_evento (evento_id);

create index if not exists idx_sst_ocorr_usuario      on public.sst_ocorrencias (usuario_id);
create index if not exists idx_sst_ocorr_evento       on public.sst_ocorrencias (evento_id);
create index if not exists idx_sst_ocorr_data         on public.sst_ocorrencias (usuario_id, data desc);

create index if not exists idx_sst_epis_usuario       on public.sst_epis (usuario_id);
create index if not exists idx_sst_epis_validade      on public.sst_epis (usuario_id, validade_ca);

create index if not exists idx_sst_trein_usuario      on public.sst_treinamentos (usuario_id);
create index if not exists idx_sst_trein_equipe       on public.sst_treinamentos (equipe_id);
create index if not exists idx_sst_trein_validade     on public.sst_treinamentos (usuario_id, validade);

create index if not exists idx_sst_sim_usuario        on public.sst_simulados (usuario_id);
create index if not exists idx_sst_sim_evento         on public.sst_simulados (evento_id);

-- 9) atualizado_em automático (reaproveita o gatilho genérico, se já existir) -
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_sst_planos_touch    on public.sst_planos;
create trigger trg_sst_planos_touch    before update on public.sst_planos    for each row execute function public.tg_touch_atualizado_em();
drop trigger if exists trg_sst_recursos_touch  on public.sst_recursos_evento;
create trigger trg_sst_recursos_touch  before update on public.sst_recursos_evento for each row execute function public.tg_touch_atualizado_em();
drop trigger if exists trg_sst_epis_touch      on public.sst_epis;
create trigger trg_sst_epis_touch      before update on public.sst_epis      for each row execute function public.tg_touch_atualizado_em();
drop trigger if exists trg_sst_trein_touch     on public.sst_treinamentos;
create trigger trg_sst_trein_touch     before update on public.sst_treinamentos for each row execute function public.tg_touch_atualizado_em();
drop trigger if exists trg_sst_sim_touch       on public.sst_simulados;
create trigger trg_sst_sim_touch       before update on public.sst_simulados  for each row execute function public.tg_touch_atualizado_em();

-- 10) RLS: o dono vê/edita apenas as próprias linhas -------------------------
--     O dimensionamento autoritativo passa por /api/sst (service-role); o resto
--     do CRUD é client via RLS. A RLS garante o isolamento multi-tenant.
alter table public.sst_planos          enable row level security;
alter table public.sst_recursos_evento enable row level security;
alter table public.sst_ocorrencias     enable row level security;
alter table public.sst_epis            enable row level security;
alter table public.sst_treinamentos    enable row level security;
alter table public.sst_simulados       enable row level security;

drop policy if exists "dono gerencia sst_planos" on public.sst_planos;
create policy "dono gerencia sst_planos" on public.sst_planos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia sst_recursos" on public.sst_recursos_evento;
create policy "dono gerencia sst_recursos" on public.sst_recursos_evento
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia sst_ocorrencias" on public.sst_ocorrencias;
create policy "dono gerencia sst_ocorrencias" on public.sst_ocorrencias
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia sst_epis" on public.sst_epis;
create policy "dono gerencia sst_epis" on public.sst_epis
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia sst_treinamentos" on public.sst_treinamentos;
create policy "dono gerencia sst_treinamentos" on public.sst_treinamentos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia sst_simulados" on public.sst_simulados;
create policy "dono gerencia sst_simulados" on public.sst_simulados
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: o dimensionamento por público, a cobertura (faltas bloqueiam a
-- prontidão) e os indicadores de ocorrências são PUROS (lib/sst.ts). As
-- certificações de brigada vêm de `equipe`/RH; extintores/AVCB ligam com
-- Manutenção; recursos viram contratação em Compras/Logística e alocação na
-- Escala — tudo por referência, sem duplicar dinheiro aqui.

-- Fim ------------------------------------------------------------------------

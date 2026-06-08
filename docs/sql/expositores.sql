-- ============================================================================
-- Expositores & Patrocínios — /painel/expositores
-- ----------------------------------------------------------------------------
-- Monetiza feiras, exposições e festivais com marcas: venda de ESTANDES (mapa
-- visual, metragem, preço por ponto ou por m²) e COTAS DE PATROCÍNIO
-- (Master/Ouro/Prata/Bronze/Apoio) com entregáveis e CHECKLIST de entrega por
-- patrocinador. Tudo escopado por EVENTO (clientes_eventos): feira agro, expo de
-- carros, congresso, festival com patrocinadores.
--
--   • `expo_mapa`        — estandes comercializáveis (código, área, tipo, preço,
--                          posição x,y no mapa, status, expositor vinculado).
--   • `expositores`      — a marca/empresa do estande: contato, doc, contrato,
--                          credencial, fatura (lancamento), necessidades técnicas
--                          (energia/internet/montagem → viram tarefa de logística).
--   • `patrocinio_cotas` — cotas com preço, vagas e entregáveis (contrapartidas).
--   • `patrocinadores`   — a marca por cota: contrato, fatura e o ESTADO de cada
--                          entregável (checklist de contrapartidas).
--
-- A engine de receita/%-vendido/entregáveis/transições vive em lib/expositores.ts
-- (pura, testada). A COMERCIALIZAÇÃO do estande (vender/reservar/bloquear) e a
-- RECEITA no financeiro do evento passam por /api/expositores (service-role,
-- autoritativo). O CRUD demais (criar estande/expositor/cota, marcar entregável)
-- é feito pelo client via RLS.
--
-- INDEPENDENTE da ordem de migrations: as FKs para `contratos`, `credenciais` e
-- `producao_tarefas` (módulos opcionais) NÃO são criadas como FK rígida — os ids
-- são guardados como uuid solto e a integridade é validada na aplicação. A coluna
-- de conciliação em `lancamentos` entra via ALTER condicional no fim.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) expo_mapa — estandes do mapa --------------------------------------------
--    `posicao` é {x,y,w,h} em unidades de célula (grid do SVG). `expositor_id`
--    denormaliza quem ocupa o estande (a verdade do vínculo também está em
--    expositores.estande_id; a /api/expositores mantém os dois lados em sincronia).
create table if not exists public.expo_mapa (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  codigo        text not null,                          -- 'A1', 'Ilha 3'…
  tipo          text not null default 'standard'
                check (tipo in ('standard','esquina','ilha','ponta','premium','food','patrocinio','outro')),
  area_m2       numeric,                                -- metragem do ponto
  preco_num     numeric,                                -- preço fechado; null/0 = calcular por m²
  status        text not null default 'disponivel'
                check (status in ('disponivel','reservado','vendido','bloqueado')),
  expositor_id  uuid,                                   -- FK lógica → expositores (sem rígida: criadas em ordem qualquer)
  posicao       jsonb not null default '{}'::jsonb,     -- {x,y,w,h} no grid
  cor           text,                                   -- override de cor (senão usa a do status)
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 2) expositores — a marca/empresa do estande --------------------------------
create table if not exists public.expositores (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  empresa       text not null,
  contato       text,
  email         text,
  telefone      text,
  doc           text,                                   -- CNPJ/CPF
  estande_id    uuid references public.expo_mapa (id) on delete set null,
  contrato_id   uuid,                                   -- → contratos (módulo Contratos, opcional)
  credencial_id uuid,                                   -- → credenciais (módulo Acesso, opcional)
  lancamento_id uuid,                                   -- → lancamentos (fatura no financeiro)
  valor_num     numeric not null default 0,
  status        text not null default 'prospecto'
                check (status in ('prospecto','proposta','confirmado','faturado','cancelado')),
  necessidades  jsonb not null default '{}'::jsonb,     -- {energia_kva,internet,agua,montagem,obs}
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) patrocinio_cotas — cotas com entregáveis --------------------------------
--    `quantidade` null = cota ilimitada. `entregaveis` é [{chave,nome,qtd?}];
--    o ESTADO de cada entregável fica em patrocinadores.entregaveis_status.
create table if not exists public.patrocinio_cotas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  evento_id     uuid not null references public.clientes_eventos (id) on delete cascade,
  nome          text not null,                          -- 'Master','Ouro',…
  preco_num     numeric not null default 0,
  quantidade    integer,                                -- vagas; null = ilimitada
  cor           text,
  ordem         integer not null default 0,
  entregaveis   jsonb not null default '[]'::jsonb,     -- [{chave,nome,qtd}]
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 4) patrocinadores — a marca por cota + checklist de entregáveis -------------
create table if not exists public.patrocinadores (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  evento_id          uuid not null references public.clientes_eventos (id) on delete cascade,
  cota_id            uuid references public.patrocinio_cotas (id) on delete set null,
  marca              text not null,
  contato            text,
  email              text,
  telefone           text,
  contrato_id        uuid,                              -- → contratos (opcional)
  lancamento_id      uuid,                              -- → lancamentos (fatura)
  valor_num          numeric not null default 0,
  status             text not null default 'prospecto'
                     check (status in ('prospecto','proposta','confirmado','faturado','cancelado')),
  entregaveis_status jsonb not null default '{}'::jsonb, -- { chave: {entregue,data,obs} }
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_expo_mapa_usuario     on public.expo_mapa (usuario_id);
create index if not exists idx_expo_mapa_evento      on public.expo_mapa (usuario_id, evento_id);
create index if not exists idx_expo_mapa_status      on public.expo_mapa (evento_id, status);
create unique index if not exists uq_expo_mapa_codigo on public.expo_mapa (evento_id, lower(codigo));

create index if not exists idx_expositores_usuario   on public.expositores (usuario_id);
create index if not exists idx_expositores_evento    on public.expositores (usuario_id, evento_id);
create index if not exists idx_expositores_estande   on public.expositores (estande_id);

create index if not exists idx_cotas_usuario         on public.patrocinio_cotas (usuario_id);
create index if not exists idx_cotas_evento          on public.patrocinio_cotas (usuario_id, evento_id, ordem);

create index if not exists idx_patrocinadores_usuario on public.patrocinadores (usuario_id);
create index if not exists idx_patrocinadores_evento  on public.patrocinadores (usuario_id, evento_id);
create index if not exists idx_patrocinadores_cota    on public.patrocinadores (cota_id);

-- 6) atualizado_em automático (gatilho genérico, reaproveitado) --------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_expo_mapa_touch on public.expo_mapa;
create trigger trg_expo_mapa_touch
  before update on public.expo_mapa
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_expositores_touch on public.expositores;
create trigger trg_expositores_touch
  before update on public.expositores
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_cotas_touch on public.patrocinio_cotas;
create trigger trg_cotas_touch
  before update on public.patrocinio_cotas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_patrocinadores_touch on public.patrocinadores;
create trigger trg_patrocinadores_touch
  before update on public.patrocinadores
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    CRUD (criar estande/expositor/cota, marcar entregável) vai pelo client via
--    RLS. A COMERCIALIZAÇÃO do estande e a RECEITA no financeiro passam por
--    /api/expositores (service-role, ignora RLS).
alter table public.expo_mapa        enable row level security;
alter table public.expositores      enable row level security;
alter table public.patrocinio_cotas enable row level security;
alter table public.patrocinadores   enable row level security;

drop policy if exists "dono gerencia expo_mapa" on public.expo_mapa;
create policy "dono gerencia expo_mapa" on public.expo_mapa
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia expositores" on public.expositores;
create policy "dono gerencia expositores" on public.expositores
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia patrocinio_cotas" on public.patrocinio_cotas;
create policy "dono gerencia patrocinio_cotas" on public.patrocinio_cotas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia patrocinadores" on public.patrocinadores;
create policy "dono gerencia patrocinadores" on public.patrocinadores
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 8) conciliação no financeiro (ALTER condicional em `lancamentos`) ----------
--    Mesma estratégia de bilheteria/estacionamento: a receita de estandes e de
--    patrocínio entra em `lancamentos` referenciando a origem (idempotente +
--    estornável). Só roda se a tabela-âncora existir.
do $$
begin
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'lancamentos') then
    alter table public.lancamentos
      add column if not exists expositor_id   uuid references public.expositores (id) on delete set null,
      add column if not exists patrocinador_id uuid references public.patrocinadores (id) on delete set null;
    create index if not exists idx_lancamentos_expositor   on public.lancamentos (expositor_id);
    create index if not exists idx_lancamentos_patrocinador on public.lancamentos (patrocinador_id);
  end if;
end $$;

-- Observação: a checagem de transição do estande (não vender um já vendido sem
-- liberar antes), a SINCRONIA estande↔expositor, a geração de fatura/credencial/
-- contrato e o envio das necessidades p/ a logística vivem na engine
-- lib/expositores.ts + a rota /api/expositores. A RLS garante o isolamento
-- multi-tenant; a regra de negócio fica na camada de aplicação (espelha
-- Bilheteria/Acesso/Produção).

-- Fim ------------------------------------------------------------------------

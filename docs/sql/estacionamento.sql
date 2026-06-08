-- ============================================================================
-- Estacionamento & Mobilidade — /painel/estacionamento
-- ----------------------------------------------------------------------------
-- Gere o estacionamento e a mobilidade do evento: capacidade de VAGAS por SETOR
-- (carro/moto/ônibus/PCD/idoso/credenciado/heliponto…), CONTROLE DE ENTRADA/SAÍDA
-- por placa (credenciado não paga), VALET, RECEITA de estacionamento (que entra
-- no financeiro do evento) e TRANSFER/SHUTTLE/ÔNIBUS de excursão. Vale do salão
-- pequeno ao autódromo/feira agro com milhares de carros e ônibus.
--
--   • `estacionamento_setores`  — vagas por setor (infraestrutura do espaço,
--     reutilizada entre eventos): capacidade, tarifa e modelo de cobrança.
--   • `estacionamento_acessos`  — cada veículo: entrada/saída, tempo, valor,
--     valet e vínculo opcional com a credencial (acesso) → isenção.
--   • `transfer`                — rotas de transporte (shuttle/van/ônibus) com
--     horários, capacidade, ponto de embarque e fornecedor.
--
-- A engine de tarifa/lotação/receita vive em lib/estacionamento.ts (pura, testada;
-- reusa a lotação de lib/acesso.ts). A entrada/saída passa por /api/estacionamento
-- (service-role, autoritativo) que recusa entrada em setor LOTADO. O fechamento
-- da receita (→ um lançamento no caixa) passa por /api/estacionamento/receita. O
-- CRUD de setores/transfer e os ajustes de valet são feitos no client via RLS.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) estacionamento_setores — vagas por setor (capacidade × tarifa) ----------
--    Pertencem ao ESPAÇO (propriedade), não ao evento: são reutilizados. A
--    ocupação é sempre calculada a partir dos acessos do evento selecionado.
create table if not exists public.estacionamento_setores (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint references public.propriedades (id) on delete set null,
  nome           text not null,
  tipo           text not null default 'carro'
                 check (tipo in ('carro','moto','onibus','caminhao','van',
                                 'credenciado','pcd','idoso','heliponto')),
  capacidade     integer not null default 0 check (capacidade >= 0), -- 0 = sem limite
  preco_num      numeric not null default 0 check (preco_num >= 0),  -- tarifa base (sem "R$")
  cobranca       text not null default 'fixo' check (cobranca in ('fixo','hora','diaria')),
  cor            text,
  ordem          integer not null default 0,
  ativo          boolean not null default true,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) estacionamento_acessos — controle de entrada/saída veicular -------------
create table if not exists public.estacionamento_acessos (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  evento_id      uuid references public.clientes_eventos (id) on delete cascade,
  setor_id       uuid references public.estacionamento_setores (id) on delete set null,
  placa          text not null default '',
  tipo           text not null default 'carro'
                 check (tipo in ('carro','moto','onibus','caminhao','van',
                                 'credenciado','pcd','idoso','heliponto')),
  modelo         text,
  cor_veiculo    text,
  credencial_id  uuid,                                  -- → credenciais (acesso); isenção
  valet          boolean not null default false,
  valet_status   text not null default 'na'
                 check (valet_status in ('na','recebido','estacionado','solicitado','entregue')),
  valet_local    text,                                  -- onde a chave/vaga está
  motorista      text,
  contato        text,
  entrada        timestamptz,
  saida          timestamptz,
  valor_num      numeric not null default 0 check (valor_num >= 0),
  pago           boolean not null default false,
  metodo         text,                                  -- Pix | Cartão | Dinheiro …
  status         text not null default 'no_patio'
                 check (status in ('reservado','no_patio','saiu')),
  lancamento_id  bigint references public.lancamentos (id) on delete set null, -- conciliação caixa
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 3) transfer — mobilidade (shuttle/van/ônibus/transfer) ---------------------
create table if not exists public.transfer (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  evento_id      uuid references public.clientes_eventos (id) on delete cascade,
  tipo           text not null default 'shuttle'
                 check (tipo in ('shuttle','van','onibus','transfer')),
  rota           text not null default '',
  horarios       jsonb not null default '[]'::jsonb,    -- ["08:00","12:00", …]
  capacidade     integer not null default 0 check (capacidade >= 0),
  fornecedor_id  uuid,                                  -- → fornecedores (se terceirizado)
  motorista      text,
  contato        text,
  veiculo        text,                                  -- placa/identificação
  ponto_embarque text,                                  -- liga com Layouts/Plantas
  ativo          boolean not null default true,
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 4) FKs opcionais (módulos podem ainda não existir; mantém ordem livre) ------
do $$
begin
  if to_regclass('public.credenciais') is not null
     and not exists (select 1 from pg_constraint where conname = 'estacionamento_acessos_credencial_id_fkey') then
    alter table public.estacionamento_acessos
      add constraint estacionamento_acessos_credencial_id_fkey
      foreign key (credencial_id) references public.credenciais (id) on delete set null;
  end if;
  if to_regclass('public.fornecedores') is not null
     and not exists (select 1 from pg_constraint where conname = 'transfer_fornecedor_id_fkey') then
    alter table public.transfer
      add constraint transfer_fornecedor_id_fkey
      foreign key (fornecedor_id) references public.fornecedores (id) on delete set null;
  end if;
end $$;

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_estac_setores_usuario   on public.estacionamento_setores (usuario_id);
create index if not exists idx_estac_setores_prop      on public.estacionamento_setores (usuario_id, propriedade_id);

create index if not exists idx_estac_acessos_usuario   on public.estacionamento_acessos (usuario_id);
create index if not exists idx_estac_acessos_evento    on public.estacionamento_acessos (usuario_id, evento_id);
create index if not exists idx_estac_acessos_ev_status on public.estacionamento_acessos (evento_id, status);
create index if not exists idx_estac_acessos_ev_setor  on public.estacionamento_acessos (evento_id, setor_id);
create index if not exists idx_estac_acessos_placa     on public.estacionamento_acessos (evento_id, placa);
create index if not exists idx_estac_acessos_lanc      on public.estacionamento_acessos (lancamento_id);

create index if not exists idx_transfer_usuario        on public.transfer (usuario_id);
create index if not exists idx_transfer_evento         on public.transfer (usuario_id, evento_id);

-- 6) atualizado_em automático (reaproveita o gatilho genérico, se já existir) -
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_estac_setores_touch on public.estacionamento_setores;
create trigger trg_estac_setores_touch
  before update on public.estacionamento_setores
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_estac_acessos_touch on public.estacionamento_acessos;
create trigger trg_estac_acessos_touch
  before update on public.estacionamento_acessos
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_transfer_touch on public.transfer;
create trigger trg_transfer_touch
  before update on public.transfer
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.estacionamento_setores enable row level security;
alter table public.estacionamento_acessos enable row level security;
alter table public.transfer               enable row level security;

drop policy if exists "dono gerencia estac_setores" on public.estacionamento_setores;
create policy "dono gerencia estac_setores" on public.estacionamento_setores
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia estac_acessos" on public.estacionamento_acessos;
create policy "dono gerencia estac_acessos" on public.estacionamento_acessos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia transfer" on public.transfer;
create policy "dono gerencia transfer" on public.transfer
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Observação: o bloqueio por capacidade (entrada em setor lotado) e o fechamento
-- da receita (um único lançamento conciliado) são aplicados na engine +
-- /api/estacionamento (service-role). A RLS garante o isolamento multi-tenant.

-- Fim ------------------------------------------------------------------------

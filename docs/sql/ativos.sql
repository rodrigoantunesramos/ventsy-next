-- ============================================================================
-- Ativos & Bens (patrimônio) — /painel/ativos
-- ----------------------------------------------------------------------------
-- Inventário patrimonial: imóveis, móveis, equipamentos (som/luz/cozinha),
-- mobiliário, veículos, estruturas (tendas/palcos) e TI. Guarda valor, vida
-- útil e DEPRECIAÇÃO LINEAR (calculada em lib/ativos.ts), localização (em qual
-- propriedade/local fica), responsável, garantia, seguro, histórico de
-- movimentação/baixa, ordens de manutenção e documentos (nota/manual/apólice).
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- Rode no Supabase (SQL Editor). Os tipos no app usam `supabaseAny` enquanto
-- estas tabelas não entram em types/supabase.ts (regenere quando puder).
--
-- Observação: o vínculo a `fornecedores` (onde o bem foi comprado) é LÓGICO —
-- coluna uuid sem FK rígida — para que esta migration NÃO dependa da ordem de
-- execução de docs/sql/fornecedores.sql.
-- ============================================================================

-- 1) ativos ------------------------------------------------------------------
create table if not exists public.ativos (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  codigo              text,                          -- nº patrimônio / tombamento (etiqueta/QR)
  nome                text not null,
  categoria           text not null default 'equipamento', -- imovel|movel|equipamento|veiculo|estrutura|ti|outro
  descricao           text,
  marca               text,
  modelo              text,
  num_serie           text,
  propriedade_id      bigint references public.propriedades (id) on delete set null, -- onde fica
  localizacao         text,                          -- local livre (galpão, sala, prateleira…)
  responsavel         text,                          -- quem responde pelo bem
  fornecedor_id       uuid,                          -- onde comprou (vínculo lógico a fornecedores)
  data_aquisicao      date,
  valor_aquisicao_num numeric not null default 0,    -- custo de aquisição
  vida_util_meses     integer,                       -- null/0 = não deprecia (ex.: terreno)
  metodo_deprec       text not null default 'linear'
                      check (metodo_deprec in ('linear', 'nenhum')),
  valor_residual_num  numeric not null default 0,    -- valor ao fim da vida útil
  estado              text not null default 'bom'    -- condição física
                      check (estado in ('novo', 'bom', 'regular', 'ruim')),
  -- veículos
  placa               text,
  renavam             text,
  ano_fabricacao      integer,
  -- garantia & seguro (alertam por vencimento — ver lib/ativos.ts statusVencimento)
  garantia_ate        date,
  seguradora          text,
  apolice             text,
  seguro_ate          date,
  -- baixa (venda/perda/sucateamento) — congela a depreciação na data
  baixado_em          date,
  motivo_baixa        text,                          -- venda | perda | sucateamento | doacao | roubo
  valor_baixa_num     numeric,                       -- valor recuperado na venda (resultado)
  foto_url            text,                          -- caminho no storage (bucket documentos)
  obs                 text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 2) ativos_mov — rastro de movimentação/transferência/baixa/reavaliação ------
create table if not exists public.ativos_mov (
  id                  uuid primary key default gen_random_uuid(),
  ativo_id            uuid not null references public.ativos (id) on delete cascade,
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  tipo                text not null default 'transferencia'
                      check (tipo in ('aquisicao', 'transferencia', 'manutencao', 'baixa', 'reavaliacao', 'depreciacao')),
  data                date not null default current_date,
  de_propriedade_id   bigint references public.propriedades (id) on delete set null,
  para_propriedade_id bigint references public.propriedades (id) on delete set null,
  de_local            text,
  para_local          text,
  de_responsavel      text,
  para_responsavel    text,
  valor_num           numeric,                       -- baixa/reavaliação/manutenção: valor envolvido
  descricao           text,
  criado_em           timestamptz not null default now()
);

-- 3) ativos_manutencao — ordens de serviço do ativo (liga c/ Manutenção) ------
create table if not exists public.ativos_manutencao (
  id             uuid primary key default gen_random_uuid(),
  ativo_id       uuid not null references public.ativos (id) on delete cascade,
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  tipo           text not null default 'corretiva'
                 check (tipo in ('preventiva', 'corretiva', 'inspecao', 'melhoria')),
  titulo         text not null,
  descricao      text,
  status         text not null default 'aberta'
                 check (status in ('aberta', 'planejada', 'em_andamento', 'aguardando_peca', 'concluida', 'cancelada')),
  prioridade     text not null default 'media'
                 check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  responsavel    text,                               -- interno ou nome do fornecedor (livre)
  fornecedor_id  uuid,                               -- vínculo lógico a fornecedores (opcional)
  os_id          uuid,                               -- futura ligação a manutencao_os (/painel/manutencao)
  data_abertura  date not null default current_date,
  prazo          date,
  data_conclusao date,
  custo_num      numeric not null default 0,         -- mão de obra + peças
  obs            text,
  criado_em      timestamptz not null default now()
);

-- 4) ativos_docs — nota fiscal, manual, garantia, apólice ---------------------
--    Arquivo vai para o bucket de Storage `documentos` (mesmo de /documentos),
--    sob o caminho `{uid}/ativos/{uuid}.{ext}`.
create table if not exists public.ativos_docs (
  id              uuid primary key default gen_random_uuid(),
  ativo_id        uuid not null references public.ativos (id) on delete cascade,
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  nome            text not null,
  tipo            text not null default 'outro'
                  check (tipo in ('nota', 'manual', 'garantia', 'seguro', 'outro')),
  validade        date,
  arquivo_url     text,
  arquivo_nome    text,
  arquivo_tipo    text,
  arquivo_tamanho bigint,
  obs             text,
  criado_em       timestamptz not null default now()
);

-- 5) Vínculo despesa -> ativo (custo de manutenção/depreciação por ativo) ------
--    Permite atribuir lançamentos (Financeiro/Contabilidade) a um ativo.
alter table public.lancamentos
  add column if not exists ativo_id uuid references public.ativos (id) on delete set null;

-- 6) índices -----------------------------------------------------------------
create index if not exists idx_ativos_usuario        on public.ativos (usuario_id);
create index if not exists idx_ativos_categoria       on public.ativos (usuario_id, categoria);
create index if not exists idx_ativos_propriedade     on public.ativos (propriedade_id);
create index if not exists idx_ativos_garantia        on public.ativos (usuario_id, garantia_ate);
create index if not exists idx_ativos_seguro          on public.ativos (usuario_id, seguro_ate);
create index if not exists idx_ativos_mov_ativo       on public.ativos_mov (ativo_id);
create index if not exists idx_ativos_manut_ativo     on public.ativos_manutencao (ativo_id);
create index if not exists idx_ativos_manut_status    on public.ativos_manutencao (usuario_id, status);
create index if not exists idx_ativos_docs_ativo      on public.ativos_docs (ativo_id);
create index if not exists idx_lancamentos_ativo      on public.lancamentos (ativo_id);

-- 7) atualizado_em automático ------------------------------------------------
create or replace function public.tg_ativos_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_ativos_touch on public.ativos;
create trigger trg_ativos_touch
  before update on public.ativos
  for each row execute function public.tg_ativos_touch();

-- 8) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.ativos            enable row level security;
alter table public.ativos_mov        enable row level security;
alter table public.ativos_manutencao enable row level security;
alter table public.ativos_docs       enable row level security;

drop policy if exists "dono gerencia ativos" on public.ativos;
create policy "dono gerencia ativos" on public.ativos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia ativos_mov" on public.ativos_mov;
create policy "dono gerencia ativos_mov" on public.ativos_mov
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia ativos_manutencao" on public.ativos_manutencao;
create policy "dono gerencia ativos_manutencao" on public.ativos_manutencao
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia ativos_docs" on public.ativos_docs;
create policy "dono gerencia ativos_docs" on public.ativos_docs
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

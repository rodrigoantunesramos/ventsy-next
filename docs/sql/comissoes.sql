-- ============================================================================
-- Comissões — /painel/comissoes
-- ----------------------------------------------------------------------------
-- Regras, apuração e pagamento de comissões de quem traz/fecha negócio:
--   • vendedores internos (tabela `equipe`)
--   • parceiros/agências/cerimonialistas (nova tabela `parceiros`)
--   • indicações de clientes (tabela `clientes`, liga com /painel/indique)
--
-- A apuração lê a ATRIBUIÇÃO de cada evento (quem vendeu / quem trouxe / quem
-- indicou) em `clientes_eventos`, casa com a regra ativa correta, calcula o
-- valor e segue o ciclo: prevista → apurada (quando recebido) → aprovada →
-- paga. Pagar gera uma despesa em `lancamentos` (categoria "Comissões"),
-- alimentando o cockpit de /painel/financeiro. Cancelar evento estorna.
--
-- Idempotente: pode rodar mais de uma vez sem efeitos colaterais.
-- Rode no Supabase (SQL Editor). Os tipos no app usam `supabaseAny` enquanto
-- estas tabelas não entram em types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) parceiros (agências, cerimonialistas, promotores, afiliados) -------------
create table if not exists public.parceiros (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  nome               text not null,
  tipo               text not null default 'cerimonial'
                     check (tipo in ('agencia', 'cerimonial', 'promotor', 'afiliado', 'outro')),
  doc                text,                          -- CPF/CNPJ (livre)
  contato            text,                          -- pessoa de contato
  email              text,
  telefone           text,
  whatsapp           text,
  cidade             text,
  estado             text,
  percentual_padrao  numeric,                       -- % sugerido p/ regra implícita
  chave_pix          text,
  banco              jsonb not null default '{}'::jsonb,  -- {banco, agencia, conta, titular}
  ativo              boolean not null default true,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 2) comissoes_regras (regras por beneficiário/condição) ----------------------
--    beneficiario_id é TEXT porque equipe.id é bigint e parceiros/clientes são
--    uuid; null = regra genérica para todos daquele tipo. condicao guarda
--    {tipo_evento, propriedade_id, faixa_min, faixa_max, margem_pct}.
create table if not exists public.comissoes_regras (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  nome               text not null default 'Regra de comissão',
  beneficiario_tipo  text not null default 'parceiro'
                     check (beneficiario_tipo in ('equipe', 'parceiro', 'cliente')),
  beneficiario_id    text,                          -- null = qualquer desse tipo
  base               text not null default 'valor_evento'
                     check (base in ('valor_evento', 'margem', 'fixo')),
  percentual         numeric,                       -- % humano (3 = 3%)
  valor_fixo_num     numeric,
  condicao           jsonb not null default '{}'::jsonb,
  vigencia_inicio    date,
  vigencia_fim       date,
  prioridade         integer not null default 0,    -- maior vence no empate
  ativo              boolean not null default true,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 3) comissoes (comissões apuradas por evento/beneficiário) -------------------
create table if not exists public.comissoes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  regra_id           uuid references public.comissoes_regras (id) on delete set null,
  beneficiario_tipo  text not null
                     check (beneficiario_tipo in ('equipe', 'parceiro', 'cliente')),
  beneficiario_id    text,
  beneficiario_nome  text,                          -- snapshot p/ histórico estável
  evento_id          uuid references public.clientes_eventos (id) on delete set null,
  base_num           numeric not null default 0,    -- base sobre a qual incidiu
  percentual         numeric,                       -- % aplicado (snapshot)
  valor_num          numeric not null default 0,    -- valor da comissão
  status             text not null default 'prevista'
                     check (status in ('prevista', 'apurada', 'aprovada', 'paga', 'cancelada')),
  competencia        date,                          -- 1º dia do mês de competência
  meio               text,                          -- pix | transferencia | ...
  origem             text not null default 'auto'   -- auto (apuração) | manual
                     check (origem in ('auto', 'manual')),
  lancamento_id      bigint,                        -- despesa gerada ao pagar (→ lancamentos)
  apurada_em         timestamptz,
  aprovada_em        timestamptz,
  pago_em            timestamptz,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 4) Atribuição do evento: quem vendeu / trouxe / indicou ---------------------
--    Colunas adicionadas à espinha dorsal `clientes_eventos`. A apuração lê
--    daqui. FKs adicionadas condicionalmente (clientes/equipe podem não existir
--    em todas as contas) para manter a migration à prova de falha.
alter table public.clientes_eventos
  add column if not exists vendedor_equipe_id bigint,
  add column if not exists parceiro_id        uuid,
  add column if not exists indicado_por_id    uuid;

do $$
begin
  -- vendedor → equipe
  if to_regclass('public.equipe') is not null
     and not exists (select 1 from pg_constraint where conname = 'fk_ce_vendedor_equipe') then
    alter table public.clientes_eventos
      add constraint fk_ce_vendedor_equipe
      foreign key (vendedor_equipe_id) references public.equipe (id) on delete set null;
  end if;
  -- parceiro → parceiros
  if not exists (select 1 from pg_constraint where conname = 'fk_ce_parceiro') then
    alter table public.clientes_eventos
      add constraint fk_ce_parceiro
      foreign key (parceiro_id) references public.parceiros (id) on delete set null;
  end if;
  -- indicado_por → clientes
  if to_regclass('public.clientes') is not null
     and not exists (select 1 from pg_constraint where conname = 'fk_ce_indicado_por') then
    alter table public.clientes_eventos
      add constraint fk_ce_indicado_por
      foreign key (indicado_por_id) references public.clientes (id) on delete set null;
  end if;
end $$;

-- 5) Vínculo "pagamento da comissão" → lançamento (despesa no caixa) ----------
alter table public.lancamentos
  add column if not exists comissao_id uuid references public.comissoes (id) on delete set null;

-- 6) índices -----------------------------------------------------------------
create index if not exists idx_parceiros_usuario          on public.parceiros (usuario_id);
create index if not exists idx_comissoes_regras_usuario   on public.comissoes_regras (usuario_id);
create index if not exists idx_comissoes_regras_tipo      on public.comissoes_regras (usuario_id, beneficiario_tipo, ativo);
create index if not exists idx_comissoes_usuario          on public.comissoes (usuario_id);
create index if not exists idx_comissoes_status           on public.comissoes (usuario_id, status);
create index if not exists idx_comissoes_evento           on public.comissoes (evento_id);
create index if not exists idx_comissoes_beneficiario     on public.comissoes (usuario_id, beneficiario_tipo, beneficiario_id);
create index if not exists idx_lancamentos_comissao       on public.lancamentos (comissao_id);
create index if not exists idx_ce_vendedor                on public.clientes_eventos (vendedor_equipe_id);
create index if not exists idx_ce_parceiro                on public.clientes_eventos (parceiro_id);
create index if not exists idx_ce_indicado_por            on public.clientes_eventos (indicado_por_id);

-- Evita comissões automáticas duplicadas (1 por evento × beneficiário).
create unique index if not exists uq_comissoes_auto
  on public.comissoes (evento_id, beneficiario_tipo, beneficiario_id)
  where origem = 'auto' and evento_id is not null;

-- 7) atualizado_em automático ------------------------------------------------
create or replace function public.tg_comissoes_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_parceiros_touch on public.parceiros;
create trigger trg_parceiros_touch
  before update on public.parceiros
  for each row execute function public.tg_comissoes_touch();

drop trigger if exists trg_comissoes_regras_touch on public.comissoes_regras;
create trigger trg_comissoes_regras_touch
  before update on public.comissoes_regras
  for each row execute function public.tg_comissoes_touch();

drop trigger if exists trg_comissoes_touch on public.comissoes;
create trigger trg_comissoes_touch
  before update on public.comissoes
  for each row execute function public.tg_comissoes_touch();

-- 8) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.parceiros        enable row level security;
alter table public.comissoes_regras enable row level security;
alter table public.comissoes        enable row level security;

drop policy if exists "dono gerencia parceiros" on public.parceiros;
create policy "dono gerencia parceiros" on public.parceiros
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia comissoes_regras" on public.comissoes_regras;
create policy "dono gerencia comissoes_regras" on public.comissoes_regras
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia comissoes" on public.comissoes;
create policy "dono gerencia comissoes" on public.comissoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

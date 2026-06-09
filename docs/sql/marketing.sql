-- ============================================================================
-- Marketing (cockpit de aquisição) · /painel/marketing
-- ----------------------------------------------------------------------------
-- Central de aquisição e presença: de onde vêm os leads, quanto custa cada
-- canal, o que converte e a agenda de conteúdo/ações.
--
-- Este módulo é majoritariamente de LEITURA sobre dados que já existem:
--   • Atribuição/funil  → public.clientes_eventos (status + como_conheceu) com
--                          fallback p/ public.clientes.origem (cliente vinculado)
--   • Gasto de marketing → public.lancamentos (categoria 'Marketing'), além do
--                          custo/investimento configurado AQUI
--   • Reputação          → public.avaliacoes (via public.propriedades do dono)
--   • Campanhas          → public.campanhas (sobrepostas na agenda, leitura)
--
-- As duas tabelas novas guardam o que o cockpit precisa configurar:
--   1) marketing_canais → custo recorrente por canal + chave de atribuição
--   2) marketing_acoes  → calendário editável de conteúdo/ações (post, anúncio,
--                          parceria, evento, e-mail) com investimento/resultado
--
-- Dinheiro: numeric com sufixo _num; NÃO há "R$" no banco — formatação é da UI
-- via lib/format. Idempotente (rode quantas vezes quiser). Depois atualize
-- types/supabase.ts (ou siga usando supabaseAny enquanto o tipo não existe).
-- ============================================================================

-- 1) marketing_canais --------------------------------------------------------
create table if not exists public.marketing_canais (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,   -- dono
  nome             text not null,                       -- rótulo livre ("Instagram Ads")
  origem_key       text not null default 'outro'        -- chave canônica p/ casar com o CRM
                     check (origem_key in ('indicacao','site','instagram','google','facebook','whatsapp','evento','outro')),
  tipo             text not null default 'outro'
                     check (tipo in ('organico','pago','parceria','indicacao','outro')),
  custo_mensal_num numeric not null default 0,          -- custo fixo recorrente (mensal)
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- Extensão idempotente (ambientes onde a tabela já existia antes da spec).
alter table public.marketing_canais add column if not exists origem_key       text not null default 'outro';
alter table public.marketing_canais add column if not exists tipo             text not null default 'outro';
alter table public.marketing_canais add column if not exists custo_mensal_num numeric not null default 0;
alter table public.marketing_canais add column if not exists ativo            boolean not null default true;
alter table public.marketing_canais add column if not exists atualizado_em    timestamptz not null default now();

-- 2) marketing_acoes (calendário de conteúdo/ações) --------------------------
create table if not exists public.marketing_acoes (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  canal_id         uuid references public.marketing_canais (id) on delete set null,
  titulo           text not null,
  tipo             text not null default 'post'
                     check (tipo in ('post','anuncio','parceria','evento','email')),
  data             date not null default current_date,  -- dia no calendário
  status           text not null default 'planejado'
                     check (status in ('planejado','em_andamento','publicado','cancelado')),
  investimento_num numeric not null default 0,          -- investimento pontual da ação
  resultado        jsonb not null default '{}'::jsonb,  -- { alcance, cliques, leads, obs }
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

alter table public.marketing_acoes add column if not exists canal_id         uuid references public.marketing_canais (id) on delete set null;
alter table public.marketing_acoes add column if not exists investimento_num numeric not null default 0;
alter table public.marketing_acoes add column if not exists resultado        jsonb not null default '{}'::jsonb;
alter table public.marketing_acoes add column if not exists atualizado_em    timestamptz not null default now();

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_mkt_canais_usuario   on public.marketing_canais (usuario_id);
create index if not exists idx_mkt_canais_origem     on public.marketing_canais (usuario_id, origem_key);
create index if not exists idx_mkt_acoes_usuario     on public.marketing_acoes (usuario_id);
create index if not exists idx_mkt_acoes_data        on public.marketing_acoes (usuario_id, data);
create index if not exists idx_mkt_acoes_canal       on public.marketing_acoes (canal_id);

-- 4) atualizado_em automático ------------------------------------------------
create or replace function public.tg_marketing_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_mkt_canais_touch on public.marketing_canais;
create trigger trg_mkt_canais_touch
  before update on public.marketing_canais
  for each row execute function public.tg_marketing_touch();

drop trigger if exists trg_mkt_acoes_touch on public.marketing_acoes;
create trigger trg_mkt_acoes_touch
  before update on public.marketing_acoes
  for each row execute function public.tg_marketing_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.marketing_canais enable row level security;
alter table public.marketing_acoes  enable row level security;

drop policy if exists "dono gerencia marketing_canais" on public.marketing_canais;
create policy "dono gerencia marketing_canais" on public.marketing_canais
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia marketing_acoes" on public.marketing_acoes;
create policy "dono gerencia marketing_acoes" on public.marketing_acoes
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

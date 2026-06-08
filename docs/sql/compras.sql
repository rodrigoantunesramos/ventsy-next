-- ============================================================================
-- Compras — /painel/compras
-- ----------------------------------------------------------------------------
-- Processo completo de compras/contratações: requisição → cotação → pedido →
-- recebimento → financeiro (conta a pagar) + entrada no estoque. Encadeia com
-- Fornecedores (avaliação/gasto), Contas a pagar (saída) e, quando existir,
-- Estoque (entrada). Pensado para escala (estrutura/bebidas/descartáveis de
-- grandes eventos), com aprovação por alçada e mapa comparativo de cotações.
--
-- Convenções (docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num. Sem "R$" no banco.
--   • RLS: o dono vê/edita só as próprias linhas (tabelas-filhas carregam
--     usuario_id para a policy ser direta).
--   • Itens de pedido e itens recebidos ficam em jsonb (snapshot) — espelha o
--     padrão de `recebimentos.itens` da spec e evita uma tabela a mais.
--
-- INDEPENDENTE de outras migrations: vínculos a fornecedores / clientes_eventos
-- / centros_custo / contas_pagar entram como colunas simples; as FKs são
-- adicionadas no fim, só se as tabelas-alvo existirem (blocos DO). Re-rodar este
-- arquivo cria as FKs que faltavam. `produto_id` fica sem FK (Estoque é futuro).
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor).
-- Os tipos no app usam `supabaseAny` enquanto estas tabelas não entram em
-- types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) requisicoes -------------------------------------------------------------
create table if not exists public.requisicoes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  numero             text,                          -- ex.: REQ-0001 (gerado no app)
  solicitante        text,
  evento_id          uuid,                          -- FK -> clientes_eventos (no fim)
  centro_custo_id    uuid,                          -- FK -> centros_custo (no fim, se existir)
  justificativa      text,
  prioridade         text not null default 'media'
                     check (prioridade in ('baixa', 'media', 'alta', 'urgente')),
  status             text not null default 'aberta'
                     check (status in ('aberta', 'aprovada', 'reprovada', 'em_cotacao', 'pedido', 'recebida', 'cancelada')),
  valor_estimado_num numeric not null default 0 check (valor_estimado_num >= 0),
  aprovado_por       text,
  aprovado_em        timestamptz,
  reprovado_motivo   text,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 2) requisicao_itens --------------------------------------------------------
create table if not exists public.requisicao_itens (
  id                 uuid primary key default gen_random_uuid(),
  requisicao_id      uuid not null references public.requisicoes (id) on delete cascade,
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  produto_id         uuid,                          -- futuro: Estoque (sem FK)
  descricao          text not null,
  quantidade         numeric not null default 1 check (quantidade > 0),
  unidade            text not null default 'un',
  valor_estimado_num numeric not null default 0 check (valor_estimado_num >= 0),
  obs                text,
  criado_em          timestamptz not null default now()
);

-- 3) cotacoes ----------------------------------------------------------------
create table if not exists public.cotacoes (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  requisicao_id      uuid not null references public.requisicoes (id) on delete cascade,
  fornecedor_id      uuid,                          -- FK -> fornecedores (no fim, se existir)
  fornecedor_nome    text,                          -- snapshot (cotação sem cadastro)
  valor_total_num    numeric not null default 0 check (valor_total_num >= 0),
  prazo_dias         integer,
  condicao           text,                          -- condição de pagamento
  validade           date,
  anexo_url          text,
  anexo_nome         text,
  escolhida          boolean not null default false,
  status             text not null default 'pendente'
                     check (status in ('pendente', 'recebida', 'recusada')),
  enviada_em         timestamptz,
  recebida_em        timestamptz,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 4) cotacao_itens (preço por item por fornecedor → mapa comparativo) --------
create table if not exists public.cotacao_itens (
  id                 uuid primary key default gen_random_uuid(),
  cotacao_id         uuid not null references public.cotacoes (id) on delete cascade,
  requisicao_item_id uuid references public.requisicao_itens (id) on delete set null,
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  descricao          text,
  quantidade         numeric not null default 1,
  valor_unit_num     numeric not null default 0 check (valor_unit_num >= 0),
  prazo_dias         integer,
  disponivel         boolean not null default true,
  criado_em          timestamptz not null default now()
);

-- 5) pedidos_compra ----------------------------------------------------------
--    `itens` (jsonb): array de
--    {requisicao_item_id, produto_id, descricao, quantidade, unidade,
--     valor_unit_num, quantidade_recebida}.
create table if not exists public.pedidos_compra (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  requisicao_id      uuid references public.requisicoes (id) on delete set null,
  cotacao_id         uuid references public.cotacoes (id) on delete set null,
  fornecedor_id      uuid,                          -- FK -> fornecedores (no fim, se existir)
  fornecedor_nome    text,                          -- snapshot
  numero             text,                          -- ex.: PC-0001 (gerado no app)
  valor_total_num    numeric not null default 0 check (valor_total_num >= 0),
  status             text not null default 'emitido'
                     check (status in ('emitido', 'parcial', 'recebido', 'cancelado')),
  condicao           text,
  previsao_entrega   date,
  enviado_em         timestamptz,
  itens              jsonb not null default '[]'::jsonb,
  obs                text,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now()
);

-- 6) recebimentos ------------------------------------------------------------
--    `itens` (jsonb): array de
--    {descricao, quantidade_pedida, quantidade_recebida, conforme, obs}.
create table if not exists public.recebimentos (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  pedido_id          uuid not null references public.pedidos_compra (id) on delete cascade,
  data               date not null default current_date,
  itens              jsonb not null default '[]'::jsonb,
  nota_fornecedor    text,
  divergencia        boolean not null default false,
  divergencia_obs    text,
  valor_num          numeric not null default 0 check (valor_num >= 0),
  conta_pagar_id     uuid,                          -- FK -> contas_pagar (no fim, se existir)
  obs                text,
  criado_em          timestamptz not null default now()
);

-- 7) índices -----------------------------------------------------------------
create index if not exists idx_requisicoes_usuario      on public.requisicoes (usuario_id);
create index if not exists idx_requisicoes_status       on public.requisicoes (usuario_id, status);
create index if not exists idx_requisicoes_evento       on public.requisicoes (evento_id);
create index if not exists idx_req_itens_requisicao     on public.requisicao_itens (requisicao_id);
create index if not exists idx_cotacoes_usuario         on public.cotacoes (usuario_id);
create index if not exists idx_cotacoes_requisicao      on public.cotacoes (requisicao_id);
create index if not exists idx_cotacoes_fornecedor      on public.cotacoes (fornecedor_id);
create index if not exists idx_cotacao_itens_cotacao    on public.cotacao_itens (cotacao_id);
create index if not exists idx_cotacao_itens_reqitem    on public.cotacao_itens (requisicao_item_id);
create index if not exists idx_pedidos_usuario          on public.pedidos_compra (usuario_id);
create index if not exists idx_pedidos_status           on public.pedidos_compra (usuario_id, status);
create index if not exists idx_pedidos_fornecedor       on public.pedidos_compra (fornecedor_id);
create index if not exists idx_pedidos_requisicao       on public.pedidos_compra (requisicao_id);
create index if not exists idx_recebimentos_usuario     on public.recebimentos (usuario_id);
create index if not exists idx_recebimentos_pedido      on public.recebimentos (pedido_id);

-- 8) atualizado_em automático ------------------------------------------------
create or replace function public.tg_compras_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_requisicoes_touch on public.requisicoes;
create trigger trg_requisicoes_touch before update on public.requisicoes
  for each row execute function public.tg_compras_touch();

drop trigger if exists trg_cotacoes_touch on public.cotacoes;
create trigger trg_cotacoes_touch before update on public.cotacoes
  for each row execute function public.tg_compras_touch();

drop trigger if exists trg_pedidos_compra_touch on public.pedidos_compra;
create trigger trg_pedidos_compra_touch before update on public.pedidos_compra
  for each row execute function public.tg_compras_touch();

-- 9) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.requisicoes      enable row level security;
alter table public.requisicao_itens enable row level security;
alter table public.cotacoes         enable row level security;
alter table public.cotacao_itens    enable row level security;
alter table public.pedidos_compra   enable row level security;
alter table public.recebimentos     enable row level security;

drop policy if exists "dono gerencia requisicoes" on public.requisicoes;
create policy "dono gerencia requisicoes" on public.requisicoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia requisicao_itens" on public.requisicao_itens;
create policy "dono gerencia requisicao_itens" on public.requisicao_itens
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia cotacoes" on public.cotacoes;
create policy "dono gerencia cotacoes" on public.cotacoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia cotacao_itens" on public.cotacao_itens;
create policy "dono gerencia cotacao_itens" on public.cotacao_itens
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia pedidos_compra" on public.pedidos_compra;
create policy "dono gerencia pedidos_compra" on public.pedidos_compra
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia recebimentos" on public.recebimentos;
create policy "dono gerencia recebimentos" on public.recebimentos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 10) FKs opcionais (só se as tabelas-alvo existirem) ------------------------
-- requisicoes.evento_id -> clientes_eventos
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'clientes_eventos')
     and not exists (select 1 from pg_constraint where conname = 'requisicoes_evento_id_fkey') then
    alter table public.requisicoes add constraint requisicoes_evento_id_fkey
      foreign key (evento_id) references public.clientes_eventos (id) on delete set null;
  end if;
end $$;

-- requisicoes.centro_custo_id -> centros_custo (módulo Contabilidade)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'centros_custo')
     and not exists (select 1 from pg_constraint where conname = 'requisicoes_centro_custo_id_fkey') then
    alter table public.requisicoes add constraint requisicoes_centro_custo_id_fkey
      foreign key (centro_custo_id) references public.centros_custo (id) on delete set null;
  end if;
end $$;

-- cotacoes.fornecedor_id / pedidos_compra.fornecedor_id -> fornecedores
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'fornecedores') then
    if not exists (select 1 from pg_constraint where conname = 'cotacoes_fornecedor_id_fkey') then
      alter table public.cotacoes add constraint cotacoes_fornecedor_id_fkey
        foreign key (fornecedor_id) references public.fornecedores (id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'pedidos_compra_fornecedor_id_fkey') then
      alter table public.pedidos_compra add constraint pedidos_compra_fornecedor_id_fkey
        foreign key (fornecedor_id) references public.fornecedores (id) on delete set null;
    end if;
  end if;
end $$;

-- recebimentos.conta_pagar_id -> contas_pagar  +  contas_pagar.ordem_compra_id -> pedidos_compra
-- (fecha o rastro requisição → pedido → recebimento → pagamento)
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'contas_pagar') then
    if not exists (select 1 from pg_constraint where conname = 'recebimentos_conta_pagar_id_fkey') then
      alter table public.recebimentos add constraint recebimentos_conta_pagar_id_fkey
        foreign key (conta_pagar_id) references public.contas_pagar (id) on delete set null;
    end if;
    if not exists (select 1 from pg_constraint where conname = 'contas_pagar_ordem_compra_id_fkey') then
      begin
        alter table public.contas_pagar add constraint contas_pagar_ordem_compra_id_fkey
          foreign key (ordem_compra_id) references public.pedidos_compra (id) on delete set null;
      exception when others then
        raise notice 'FK contas_pagar.ordem_compra_id -> pedidos_compra não criada (%).', sqlerrm;
      end;
    end if;
  end if;
end $$;

-- Fim ------------------------------------------------------------------------

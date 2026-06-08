-- ============================================================================
-- Contabilidade completa — /painel/contabilidade
-- ----------------------------------------------------------------------------
-- Camada contábil sobre o caixa do app. NÃO duplica o cockpit do Financeiro:
-- reaproveita `lancamentos` (caixa) e `parcelas` (a receber), apenas estendendo
-- `lancamentos` com colunas contábeis. Cobre plano de contas, centros de custo,
-- contas bancárias, conciliação e fechamento mensal (que trava edição
-- retroativa via trigger). Toda a lógica de cálculo vive em lib/contabilidade.ts.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois atualize types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) plano_contas — árvore de contas (resultado + patrimoniais) -------------
create table if not exists public.plano_contas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  codigo           text not null,                       -- ex.: '3.1.01'
  nome             text not null,
  tipo             text not null
                   check (tipo in ('receita','despesa','ativo','passivo','patrimonio')),
  grupo            text,                                -- agrupador visual
  dre_linha        text                                 -- contas de resultado → linha do DRE
                   check (dre_linha is null or dre_linha in
                     ('receita_bruta','deducoes','custos_diretos','despesas_operacionais',
                      'receitas_financeiras','despesas_financeiras','depreciacao')),
  categoria_legada text,                                -- p/ auto-vincular lançamentos antigos
  ativo            boolean not null default true,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now(),
  unique (usuario_id, codigo)
);

-- 2) centros_custo — segmentação do DRE (por propriedade/evento/depto) -------
create table if not exists public.centros_custo (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  nome        text not null,
  tipo        text not null default 'departamento'
              check (tipo in ('propriedade','evento','departamento','projeto')),
  ref_id      text,                                     -- id da entidade vinculada (flexível)
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- 3) contas_bancarias — posição de caixa por conta --------------------------
create table if not exists public.contas_bancarias (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references auth.users (id) on delete cascade,
  nome              text not null,
  banco             text,
  tipo              text not null default 'corrente'
                    check (tipo in ('corrente','poupanca','caixa','aplicacao','outro')),
  saldo_inicial_num numeric not null default 0,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- 4) fechamentos — trava mensal (sem edição retroativa) ---------------------
create table if not exists public.fechamentos (
  id          uuid primary key default gen_random_uuid(),
  usuario_id  uuid not null references auth.users (id) on delete cascade,
  mes         text not null,                            -- 'YYYY-MM'
  status      text not null default 'fechado'
              check (status in ('aberto','fechado')),
  observacao  text,
  fechado_em  timestamptz not null default now(),
  criado_em   timestamptz not null default now(),
  unique (usuario_id, mes)
);

-- 5) conciliacao_extrato — linhas importadas (OFX/CSV) + match --------------
create table if not exists public.conciliacao_extrato (
  id                 uuid primary key default gen_random_uuid(),
  usuario_id         uuid not null references auth.users (id) on delete cascade,
  conta_bancaria_id  uuid references public.contas_bancarias (id) on delete set null,
  data               date not null,
  descricao          text,
  valor_num          numeric not null default 0,        -- com sinal (+ entrada, − saída)
  lancamento_id      bigint references public.lancamentos (id) on delete set null,
  status             text not null default 'pendente'
                     check (status in ('pendente','conciliado','ignorado')),
  criado_em          timestamptz not null default now()
);

-- 6) estende `lancamentos` com colunas contábeis (idempotente) --------------
alter table public.lancamentos add column if not exists conta_id          uuid references public.plano_contas (id) on delete set null;
alter table public.lancamentos add column if not exists centro_custo_id   uuid references public.centros_custo (id) on delete set null;
alter table public.lancamentos add column if not exists conta_bancaria_id uuid references public.contas_bancarias (id) on delete set null;
alter table public.lancamentos add column if not exists competencia       date;     -- fato gerador (≠ data de caixa)
alter table public.lancamentos add column if not exists conciliado        boolean not null default false;
-- nota_id (→notas_fiscais) será adicionado pelo módulo Faturamento.

-- 7) índices -----------------------------------------------------------------
create index if not exists idx_plano_contas_usuario      on public.plano_contas (usuario_id);
create index if not exists idx_centros_custo_usuario     on public.centros_custo (usuario_id);
create index if not exists idx_contas_bancarias_usuario  on public.contas_bancarias (usuario_id);
create index if not exists idx_fechamentos_usuario_mes   on public.fechamentos (usuario_id, mes);
create index if not exists idx_concil_extrato_usuario    on public.conciliacao_extrato (usuario_id);
create index if not exists idx_concil_extrato_conta      on public.conciliacao_extrato (conta_bancaria_id);
create index if not exists idx_lancamentos_conta         on public.lancamentos (conta_id);
create index if not exists idx_lancamentos_centro        on public.lancamentos (centro_custo_id);
create index if not exists idx_lancamentos_competencia   on public.lancamentos (competencia);

-- 8) atualizado_em automático (reaproveita o gatilho genérico) --------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_plano_contas_touch on public.plano_contas;
create trigger trg_plano_contas_touch
  before update on public.plano_contas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_contas_bancarias_touch on public.contas_bancarias;
create trigger trg_contas_bancarias_touch
  before update on public.contas_bancarias
  for each row execute function public.tg_touch_atualizado_em();

-- 9) trava de fechamento — bloqueia INSERT/UPDATE/DELETE em mês fechado -----
-- Usa a competência efetiva (competencia ?? data) e o usuario_id da própria
-- linha. Inócuo até o dono fechar um mês. Critério: "fechamento trava edição
-- retroativa". Reabrir o mês (status≠'fechado') libera de novo.
create or replace function public.tg_bloqueia_mes_fechado()
returns trigger language plpgsql as $$
declare
  ref date;
  uid uuid;
begin
  if (tg_op = 'DELETE') then
    ref := coalesce(old.competencia, old.data);
    uid := old.usuario_id;
  else
    ref := coalesce(new.competencia, new.data);
    uid := new.usuario_id;
  end if;
  if ref is not null and exists (
    select 1 from public.fechamentos f
    where f.usuario_id = uid and f.mes = to_char(ref, 'YYYY-MM') and f.status = 'fechado'
  ) then
    raise exception 'Mês % está fechado na contabilidade — reabra o período para editar.', to_char(ref, 'YYYY-MM')
      using errcode = 'P0001';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;

drop trigger if exists trg_lancamentos_mes_fechado on public.lancamentos;
create trigger trg_lancamentos_mes_fechado
  before insert or update or delete on public.lancamentos
  for each row execute function public.tg_bloqueia_mes_fechado();

-- 10) RLS: o dono vê/edita apenas as próprias linhas ------------------------
alter table public.plano_contas        enable row level security;
alter table public.centros_custo       enable row level security;
alter table public.contas_bancarias    enable row level security;
alter table public.fechamentos         enable row level security;
alter table public.conciliacao_extrato enable row level security;

drop policy if exists "dono gerencia plano_contas" on public.plano_contas;
create policy "dono gerencia plano_contas" on public.plano_contas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia centros_custo" on public.centros_custo;
create policy "dono gerencia centros_custo" on public.centros_custo
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia contas_bancarias" on public.contas_bancarias;
create policy "dono gerencia contas_bancarias" on public.contas_bancarias
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia fechamentos" on public.fechamentos;
create policy "dono gerencia fechamentos" on public.fechamentos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia conciliacao_extrato" on public.conciliacao_extrato;
create policy "dono gerencia conciliacao_extrato" on public.conciliacao_extrato
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

-- ============================================================================
-- Contas a Pagar — /painel/recebiveis (aba "A pagar")
-- ----------------------------------------------------------------------------
-- O outro lado do AP/AR. "A receber" já vive em `parcelas` (parcelamento de
-- eventos). Esta tabela cobre as SAÍDAS: fornecedores, folha, recorrências
-- (aluguel, energia, software), impostos e avulsas — com vencimento, status,
-- recorrência, anexo de comprovante e baixa que vira despesa em `lancamentos`.
--
-- Convenções (ver docs/prompts/00-contexto-base.md):
--   • snake_case PT; toda tabela tem usuario_id (dono) + criado_em/atualizado_em.
--   • Dinheiro em numeric com sufixo _num (valor_num).
--   • RLS: o dono vê/edita só as próprias linhas.
--   • 'atrasado' é DERIVADO na UI (vencimento < hoje), mas também pode ser
--     PERSISTIDO pelo cron /api/cron/contas-vencidas — por isso entra no CHECK.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor).
-- Os tipos no app usam `supabaseAny` enquanto esta tabela não entra em
-- types/supabase.ts (regenere quando puder).
-- ============================================================================

-- 1) contas_pagar ------------------------------------------------------------
create table if not exists public.contas_pagar (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  -- Origem da despesa (todos opcionais — uma conta pode ser avulsa):
  fornecedor_id   uuid references public.fornecedores (id) on delete set null,
  ordem_compra_id uuid,                          -- futuro: módulo Compras (sem FK ainda)
  categoria       text not null default 'outro', -- folha | aluguel | energia | ... (ver _lib CAT_PAGAR)
  plano_conta     text,                          -- código/nome da conta contábil (futuro: plano_contas)
  descricao       text not null,
  valor_num       numeric not null default 0 check (valor_num >= 0),
  vencimento      date,
  status          text not null default 'pendente'
                  check (status in ('pendente', 'agendado', 'atrasado', 'pago', 'cancelado')),
  pago_em         date,
  metodo          text,                          -- Pix | Boleto | Transferência | ...
  -- Recorrência: recorrencia = {freq: 'mensal'|'semanal'|..., ate: 'YYYY-MM-DD'|null}
  recorrente      boolean not null default false,
  recorrencia     jsonb not null default '{}'::jsonb,
  recorrencia_pai uuid references public.contas_pagar (id) on delete set null, -- raiz da série
  -- Aprovação (alçada leve): contas podem exigir aprovação antes da baixa.
  aprovado        boolean not null default true,
  aprovado_em     timestamptz,
  -- Comprovante (mesmo bucket `documentos`, caminho {uid}/contas-pagar/{uuid}.{ext}):
  anexo_url       text,
  anexo_nome      text,
  -- Conciliação contábil: vínculo ao lançamento de caixa gerado na baixa.
  lancamento_id   bigint references public.lancamentos (id) on delete set null,
  obs             text,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 2) índices -----------------------------------------------------------------
create index if not exists idx_contas_pagar_usuario     on public.contas_pagar (usuario_id);
create index if not exists idx_contas_pagar_venc        on public.contas_pagar (usuario_id, vencimento);
create index if not exists idx_contas_pagar_status      on public.contas_pagar (usuario_id, status);
create index if not exists idx_contas_pagar_fornecedor  on public.contas_pagar (fornecedor_id);
create index if not exists idx_contas_pagar_pai         on public.contas_pagar (recorrencia_pai);

-- 3) atualizado_em automático ------------------------------------------------
create or replace function public.tg_contas_pagar_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_contas_pagar_touch on public.contas_pagar;
create trigger trg_contas_pagar_touch
  before update on public.contas_pagar
  for each row execute function public.tg_contas_pagar_touch();

-- 4) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.contas_pagar enable row level security;

drop policy if exists "dono gerencia contas_pagar" on public.contas_pagar;
create policy "dono gerencia contas_pagar" on public.contas_pagar
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

-- ============================================================================
-- Orçamentos & Propostas — /painel/propostas
-- ----------------------------------------------------------------------------
-- Transforma um lead (clientes_eventos) numa proposta comercial profissional:
-- itens (espaço + taxas + pacotes + serviços) vindos da MESMA engine de preço
-- (lib/pricing.ts), desconto, condições de pagamento (entrada + parcelas),
-- validade e cláusulas. A proposta é enviada por LINK público + PDF, o cliente
-- aceita/recusa SEM login, e o aceite vira CONTRATO + confirma RESERVA + gera
-- PARCELAS + move o lead no funil — de forma ATÔMICA (função aceitar_proposta).
--
-- Integração entre módulos (todas OPCIONAIS — a função degrada com elegância):
--   • Contratos  (docs/sql/contratos.sql): a tabela `contratos` é DELE. Aqui só
--     inserimos um rascunho de contrato a partir da proposta aceita, se a tabela
--     existir/for compatível (bloco com EXCEPTION). NÃO recriamos `contratos`.
--   • Reservas multi-espaço (docs/sql/reservas-multiespaco.sql): confirmamos um
--     eventual hold (status 'hold' → 'confirmada') do mesmo evento, se existir.
--
-- Observação de tipos: clientes_eventos.id é UUID (confirmado em types/supabase
-- e em reservas-multiespaco.sql); por isso evento_id e parcelas.evento_id são uuid.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois atualize types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 1) propostas ---------------------------------------------------------------
create table if not exists public.propostas (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  cliente_id          uuid,                 -- → clientes (sem FK rígida: independe da ordem das migrations)
  evento_id           uuid references public.clientes_eventos (id) on delete set null,
  propriedade_id      bigint references public.propriedades (id) on delete set null,
  numero              integer not null default 0,        -- sequencial por usuário (trigger abaixo)
  titulo              text not null default 'Proposta comercial',
  itens               jsonb not null default '[]'::jsonb, -- [{id,tipo,descricao,qtd,valor_unit,total}]
  subtotal_num        numeric not null default 0,
  desconto_num        numeric not null default 0,
  total_num           numeric not null default 0,
  moeda               text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  validade            date,
  condicoes_pagamento jsonb not null default '{}'::jsonb, -- {metodo, parcelas:[{descricao,valor,vencimento}]}
  observacoes         text,
  condicoes           text,                 -- cláusulas/condições gerais (texto livre)
  status              text not null default 'rascunho'
                      check (status in ('rascunho','enviada','vista','aceita','recusada','expirada')),
  link_token          text not null unique default encode(gen_random_bytes(12), 'hex'),
  enviada_em          timestamptz,
  vista_em            timestamptz,
  aceita_em           timestamptz,
  recusada_em         timestamptz,
  motivo_recusa       text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 2) propostas_templates — modelos reutilizáveis por tipo de evento ----------
create table if not exists public.propostas_templates (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  nome                text not null,
  tipo_evento         text,
  titulo              text,
  itens               jsonb not null default '[]'::jsonb,
  condicoes_pagamento jsonb not null default '{}'::jsonb,
  observacoes         text,
  condicoes           text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_propostas_usuario     on public.propostas (usuario_id);
create index if not exists idx_propostas_evento       on public.propostas (evento_id);
create index if not exists idx_propostas_cliente      on public.propostas (cliente_id);
create index if not exists idx_propostas_status       on public.propostas (status);
create unique index if not exists uq_propostas_numero on public.propostas (usuario_id, numero);
create index if not exists idx_prop_templates_usuario on public.propostas_templates (usuario_id);

-- 4) atualizado_em automático (reaproveita o gatilho genérico, se existir) ----
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_propostas_touch on public.propostas;
create trigger trg_propostas_touch
  before update on public.propostas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_propostas_templates_touch on public.propostas_templates;
create trigger trg_propostas_templates_touch
  before update on public.propostas_templates
  for each row execute function public.tg_touch_atualizado_em();

-- 5) numeração sequencial por usuário (à prova de corrida) --------------------
create or replace function public.tg_proposta_numero()
returns trigger language plpgsql as $$
begin
  if new.numero is null or new.numero = 0 then
    select coalesce(max(numero), 0) + 1 into new.numero
      from public.propostas where usuario_id = new.usuario_id;
  end if;
  return new;
end $$;

drop trigger if exists trg_proposta_numero on public.propostas;
create trigger trg_proposta_numero
  before insert on public.propostas
  for each row execute function public.tg_proposta_numero();

-- 6) RLS: o dono vê/edita apenas as próprias linhas --------------------------
alter table public.propostas           enable row level security;
alter table public.propostas_templates enable row level security;

drop policy if exists "dono gerencia propostas" on public.propostas;
create policy "dono gerencia propostas" on public.propostas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia propostas_templates" on public.propostas_templates;
create policy "dono gerencia propostas_templates" on public.propostas_templates
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Nota: a leitura/aceite PÚBLICO (sem login) NÃO usa RLS — passa pela rota de
-- API com service-role (app/api/propostas/publica) que resolve pelo link_token.

-- 7) ACEITE ATÔMICO ----------------------------------------------------------
--    proposta aceita → parcelas + move funil + confirma hold + (rascunho de)
--    contrato. Tudo numa transação. Idempotente: se já aceita, devolve o que há.
--    Os blocos de Contrato e Reserva são DEFENSIVOS: se o módulo correspondente
--    não estiver instalado (ou for incompatível), o aceite segue sem falhar.
--    Chamada via service-role em /api/propostas/publica (POST aceitar).
create or replace function public.aceitar_proposta(p_token text)
returns jsonb
language plpgsql
as $$
declare
  v_prop        public.propostas;
  v_contrato_id uuid;
  v_cnum        text;
  v_item        jsonb;
  v_idx         integer;
  v_snapshot    text;
begin
  select * into v_prop from public.propostas where link_token = p_token for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'not_found');
  end if;

  -- Expirada (validade no passado e ainda não decidida)
  if v_prop.status <> 'aceita'
     and v_prop.validade is not null and v_prop.validade < current_date then
    update public.propostas set status = 'expirada' where id = v_prop.id and status <> 'aceita';
    return jsonb_build_object('ok', false, 'error', 'expirada');
  end if;

  -- Idempotência: já aceita → devolve o contrato existente (se houver)
  if v_prop.status = 'aceita' then
    begin
      select id into v_contrato_id from public.contratos where proposta_id = v_prop.id limit 1;
    exception when others then v_contrato_id := null;
    end;
    return jsonb_build_object('ok', true, 'already', true, 'proposta_id', v_prop.id, 'contrato_id', v_contrato_id);
  end if;

  -- 1) marca a proposta como aceita
  update public.propostas
     set status = 'aceita', aceita_em = now(), atualizado_em = now()
   where id = v_prop.id;

  -- 2) parcelas (contas a receber) + move o funil + confirma hold de reserva
  if v_prop.evento_id is not null then
    v_idx := 0;
    for v_item in
      select value from jsonb_array_elements(coalesce(v_prop.condicoes_pagamento -> 'parcelas', '[]'::jsonb))
    loop
      v_idx := v_idx + 1;
      insert into public.parcelas (usuario_id, evento_id, numero, descricao, valor, vencimento, status)
      values (
        v_prop.usuario_id,
        v_prop.evento_id,
        v_idx,
        coalesce(nullif(v_item ->> 'descricao', ''), 'Parcela ' || v_idx),
        coalesce((v_item ->> 'valor')::numeric, 0),
        nullif(v_item ->> 'vencimento', '')::date,
        'pendente'
      );
    end loop;

    update public.clientes_eventos
       set status = 'contratado', valor_total_num = v_prop.total_num
     where id = v_prop.evento_id and usuario_id = v_prop.usuario_id;

    -- Reservas multi-espaço: confirma um eventual hold do mesmo evento.
    begin
      update public.reservas set status = 'confirmada'
       where evento_id = v_prop.evento_id and status = 'hold';
    exception when others then null;  -- módulo Reservas ausente/incompatível
    end;
  end if;

  -- 3) Contrato (rascunho) a partir da proposta — tabela é do módulo Contratos.
  v_snapshot := concat_ws(E'\n',
    format('Contrato gerado a partir da proposta Nº %s — %s.', v_prop.numero, coalesce(v_prop.titulo, '')),
    format('Valor total: %s %s.', v_prop.moeda, to_char(v_prop.total_num, 'FM999G999G990D00')),
    case when coalesce(v_prop.condicoes, '') <> '' then E'\nCondições:\n' || v_prop.condicoes else '' end,
    case when coalesce(v_prop.observacoes, '') <> '' then E'\nObservações:\n' || v_prop.observacoes else '' end);

  begin
    select id into v_contrato_id from public.contratos where proposta_id = v_prop.id limit 1;
    if v_contrato_id is null then
      v_cnum := 'CTR-' || to_char(now(), 'YYYY') || '-' ||
        lpad(((select count(*) from public.contratos where usuario_id = v_prop.usuario_id) + 1)::text, 4, '0');
      insert into public.contratos
        (usuario_id, cliente_id, evento_id, proposta_id, numero, titulo, conteudo_final, valor_num, moeda, status)
      values
        (v_prop.usuario_id, v_prop.cliente_id, v_prop.evento_id, v_prop.id, v_cnum,
         v_prop.titulo, v_snapshot, v_prop.total_num, v_prop.moeda, 'rascunho')
      returning id into v_contrato_id;
    end if;
  exception when others then
    v_contrato_id := null;  -- módulo Contratos ausente/incompatível: aceite segue sem contrato
  end;

  return jsonb_build_object('ok', true, 'proposta_id', v_prop.id, 'contrato_id', v_contrato_id);
end $$;

-- Fim ------------------------------------------------------------------------

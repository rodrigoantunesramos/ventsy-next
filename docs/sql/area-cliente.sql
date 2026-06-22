-- ─────────────────────────────────────────────────────────────────────────────
-- VENTSY — Área do Cliente (contratante) PREMIUM
-- Carteira de créditos + cupons do cliente + indicações (referral) + planejador
-- de evento (checklist + orçamento) + preferências.
--
-- Idempotente e defensivo: pode rodar mais de uma vez. Os gatilhos de conversão
-- de indicação só são criados se a tabela-alvo existir (não quebra a migration).
--
-- Convenção do projeto: escritas sensíveis (créditos) passam por API service-role;
-- planejador/preferências são CRUD direto via RLS (escopo no próprio usuário).
-- ─────────────────────────────────────────────────────────────────────────────

-- == 1. CARTEIRA — razão de créditos (ledger) ================================
create table if not exists public.creditos_cliente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  tipo        text not null default 'ajuste',   -- indicacao | boas_vindas | cupom | reembolso | ajuste | resgate
  valor       numeric(12,2) not null,           -- positivo = crédito; negativo = débito
  descricao   text,
  evento_id   uuid,                             -- referência opcional (clientes_eventos)
  referencia  text,                             -- id externo / código de resgate
  expira_em   timestamptz,
  criado_em   timestamptz not null default now()
);
create index if not exists idx_creditos_user on public.creditos_cliente (user_id, criado_em desc);

alter table public.creditos_cliente enable row level security;
drop policy if exists "creditos_select_own" on public.creditos_cliente;
create policy "creditos_select_own" on public.creditos_cliente
  for select using (user_id = auth.uid());

-- == 2. CUPONS do cliente (resgate/indicação/boas-vindas) ====================
create table if not exists public.cupons_cliente (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  codigo      text not null,
  descricao   text,
  tipo        text not null default 'percentual', -- percentual | valor
  valor       numeric(12,2) not null default 0,
  origem      text not null default 'promocao',   -- indicacao | boas_vindas | resgate | promocao
  status      text not null default 'disponivel', -- disponivel | usado | expirado
  evento_id   uuid,
  validade    date,
  usado_em    timestamptz,
  criado_em   timestamptz not null default now()
);
create unique index if not exists uidx_cupons_cliente_user_codigo on public.cupons_cliente (user_id, codigo);

alter table public.cupons_cliente enable row level security;
drop policy if exists "cupons_cli_select_own" on public.cupons_cliente;
create policy "cupons_cli_select_own" on public.cupons_cliente
  for select using (user_id = auth.uid());
drop policy if exists "cupons_cli_update_own" on public.cupons_cliente;
create policy "cupons_cli_update_own" on public.cupons_cliente
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- == 3. INDICAÇÕES do cliente (referral cliente → cliente) ===================
create table if not exists public.indicacoes_cliente (
  id                  uuid primary key default gen_random_uuid(),
  indicador_id        uuid not null references auth.users (id) on delete cascade,
  indicado_id         uuid references auth.users (id) on delete set null,
  indicado_email      text,
  indicado_nome       text,
  codigo              text not null,
  status              text not null default 'pendente',  -- pendente | cadastrado | convertido
  recompensa_creditos numeric(12,2) not null default 0,
  recompensa_paga     boolean not null default false,
  evento_id           uuid,
  criado_em           timestamptz not null default now(),
  convertido_em       timestamptz
);
create index if not exists idx_indic_cli_indicador on public.indicacoes_cliente (indicador_id, criado_em desc);
create index if not exists idx_indic_cli_indicado  on public.indicacoes_cliente (indicado_id);

alter table public.indicacoes_cliente enable row level security;
drop policy if exists "indic_cli_select_own" on public.indicacoes_cliente;
create policy "indic_cli_select_own" on public.indicacoes_cliente
  for select using (indicador_id = auth.uid());

-- == 4. PLANEJADOR — checklist de tarefas ====================================
create table if not exists public.planejador_tarefas (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  evento_id  uuid,                              -- opcional: tarefa de um evento específico
  titulo     text not null,
  categoria  text not null default 'geral',
  concluida  boolean not null default false,
  prazo      date,
  ordem      int not null default 0,
  origem     text not null default 'manual',    -- manual | template
  criado_em  timestamptz not null default now()
);
create index if not exists idx_plan_tarefas_user on public.planejador_tarefas (user_id, evento_id, ordem);

alter table public.planejador_tarefas enable row level security;
drop policy if exists "plan_tarefas_all_own" on public.planejador_tarefas;
create policy "plan_tarefas_all_own" on public.planejador_tarefas
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- == 5. PLANEJADOR — orçamento ===============================================
create table if not exists public.planejador_orcamento (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  evento_id      uuid,
  categoria      text not null default 'geral',
  descricao      text not null,
  valor_previsto numeric(12,2) not null default 0,
  valor_real     numeric(12,2),
  pago           boolean not null default false,
  criado_em      timestamptz not null default now()
);
create index if not exists idx_plan_orc_user on public.planejador_orcamento (user_id, evento_id);

alter table public.planejador_orcamento enable row level security;
drop policy if exists "plan_orc_all_own" on public.planejador_orcamento;
create policy "plan_orc_all_own" on public.planejador_orcamento
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- == 6. PREFERÊNCIAS do cliente ==============================================
create table if not exists public.preferencias_cliente (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  notif_email    boolean not null default true,
  notif_push     boolean not null default true,
  notif_whatsapp boolean not null default false,
  novidades      boolean not null default true,
  tema           text not null default 'auto',   -- auto | claro | escuro
  atualizado_em  timestamptz not null default now()
);

alter table public.preferencias_cliente enable row level security;
drop policy if exists "prefs_cli_all_own" on public.preferencias_cliente;
create policy "prefs_cli_all_own" on public.preferencias_cliente
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- FUNÇÕES
-- ─────────────────────────────────────────────────────────────────────────────

-- Garante (e devolve) o código de indicação do usuário em usuarios.seucodigo.
create or replace function public.garantir_seucodigo(p_user uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_nome text;
  v_base text;
  v_try  int := 0;
begin
  select seucodigo, nome into v_code, v_nome from public.usuarios where id = p_user;
  if v_code is not null and length(trim(v_code)) > 0 then
    return v_code;
  end if;

  v_base := upper(regexp_replace(coalesce(split_part(coalesce(v_nome, ''), ' ', 1), ''), '[^A-Za-z0-9]', '', 'g'));
  if length(v_base) < 3 then v_base := 'VENTSY'; end if;
  v_base := left(v_base, 8);

  loop
    v_code := v_base || to_char((floor(random() * 9000) + 1000)::int, 'FM0000');
    exit when not exists (select 1 from public.usuarios where upper(seucodigo) = upper(v_code));
    v_try := v_try + 1;
    if v_try > 25 then
      v_code := v_base || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
      exit;
    end if;
  end loop;

  update public.usuarios set seucodigo = v_code where id = p_user;
  return v_code;
end;
$$;
grant execute on function public.garantir_seucodigo(uuid) to authenticated, service_role;

-- Registra a indicação no cadastro do NOVO usuário (auth.uid() = indicado).
-- Concede um cupom de boas-vindas ao indicado; o crédito do indicador vem na
-- conversão (primeiro evento). Idempotente por indicado.
create or replace function public.registrar_indicacao_cliente(p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_indicado  uuid := auth.uid();
  v_indicador uuid;
  v_email     text;
  v_cupom     text;
begin
  if v_indicado is null then
    return jsonb_build_object('ok', false, 'erro', 'sem_sessao');
  end if;
  if p_codigo is null or length(trim(p_codigo)) = 0 then
    return jsonb_build_object('ok', false, 'erro', 'sem_codigo');
  end if;

  select id into v_indicador from public.usuarios
    where upper(seucodigo) = upper(trim(p_codigo)) limit 1;
  if v_indicador is null or v_indicador = v_indicado then
    return jsonb_build_object('ok', false, 'erro', 'codigo_invalido');
  end if;

  if exists (select 1 from public.indicacoes_cliente where indicado_id = v_indicado) then
    return jsonb_build_object('ok', true, 'duplicado', true);
  end if;

  select email into v_email from auth.users where id = v_indicado;

  insert into public.indicacoes_cliente (indicador_id, indicado_id, indicado_email, codigo, status)
    values (v_indicador, v_indicado, v_email, upper(trim(p_codigo)), 'cadastrado');

  -- Cupom de boas-vindas ao novo usuário (10% na primeira reserva).
  v_cupom := 'BEMVINDO' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 5));
  insert into public.cupons_cliente (user_id, codigo, descricao, tipo, valor, origem, validade)
    values (v_indicado, v_cupom, 'Boas-vindas: 10% de desconto na sua primeira reserva', 'percentual', 10, 'boas_vindas',
            (now() + interval '90 days')::date)
    on conflict (user_id, codigo) do nothing;

  return jsonb_build_object('ok', true, 'cupom', v_cupom);
end;
$$;
grant execute on function public.registrar_indicacao_cliente(text) to authenticated, service_role;

-- Converte a indicação quando o indicado vira contratante de fato (primeiro
-- acesso a um evento) e credita o indicador. SECURITY DEFINER (escreve no
-- ledger do indicador). Idempotente: só converte indicações ainda não convertidas.
create or replace function public.converter_indicacao_por_indicado(p_indicado uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ind    public.indicacoes_cliente;
  v_premio numeric(12,2) := 50;   -- créditos ao indicador por conversão
begin
  if p_indicado is null then return; end if;

  select * into v_ind from public.indicacoes_cliente
    where indicado_id = p_indicado and status <> 'convertido'
    order by criado_em asc limit 1;
  if v_ind.id is null then return; end if;

  update public.indicacoes_cliente
    set status = 'convertido', convertido_em = now(),
        recompensa_creditos = v_premio, recompensa_paga = true
    where id = v_ind.id;

  insert into public.creditos_cliente (user_id, tipo, valor, descricao, referencia)
    values (v_ind.indicador_id, 'indicacao', v_premio,
            'Indicação convertida — seu indicado começou a usar a Ventsy', v_ind.id::text);
end;
$$;

-- Gatilho de conversão sobre portal_acessos (quando o indicado reivindica o
-- primeiro acesso a um evento). Criado de forma defensiva: só se a tabela e a
-- coluna user_id existirem.
create or replace function public.tg_converter_indicacao_portal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.user_id is not null then
    perform public.converter_indicacao_por_indicado(NEW.user_id);
  end if;
  return NEW;
end;
$$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'portal_acessos' and column_name = 'user_id'
  ) then
    drop trigger if exists trg_converter_indicacao_portal on public.portal_acessos;
    create trigger trg_converter_indicacao_portal
      after insert or update of user_id on public.portal_acessos
      for each row execute function public.tg_converter_indicacao_portal();
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Pronto. Tabelas: creditos_cliente, cupons_cliente, indicacoes_cliente,
-- planejador_tarefas, planejador_orcamento, preferencias_cliente.
-- Funções: garantir_seucodigo, registrar_indicacao_cliente,
-- converter_indicacao_por_indicado (+ gatilho em portal_acessos).
-- ─────────────────────────────────────────────────────────────────────────────

-- ============================================================================
-- Licenças, Alvarás & Compliance — /painel/licencas
-- ----------------------------------------------------------------------------
-- Controla TUDO que mantém a operação legal num só lugar: alvarás PERMANENTES do
-- espaço (funcionamento, AVCB/bombeiros, sanitário, ambiental) e licenças POR
-- EVENTO (autorização do evento, som/ruído, ECAD, vigilância sanitária para A&B,
-- policiamento, licença ambiental temporária, fechamento de via para corrida,
-- NOTAM/ANAC para aéreo). Vencimentos, órgãos, custos e documentos rastreados.
--
--   • `licencas`               — uma licença/alvará. `escopo` separa permanente
--                                (do espaço) de evento (gerada por checklist).
--                                Vencimento (validade) + dias_aviso alimentam os
--                                alertas a-vencer/vencida. `obrigatorio` faz a
--                                exigência BLOQUEAR a prontidão do evento.
--                                `custo_num` → lançável no caixa (lancamento_id).
--   • `compliance_checklists`  — BIBLIOTECA de exigências por tipo/porte de evento
--                                (itens jsonb). Templates editáveis (varia por
--                                município). A engine lib/licencas.ts traz os
--                                defaults embutidos; aqui ficam as versões do dono.
--
-- A engine de status/semáforo/prontidão/templates vive em lib/licencas.ts (pura,
-- testada). O "aplicar checklist" (gera as exigências do evento) e o "lançar
-- custo" (despesa no caixa) passam por /api/licencas (service-role, autoritativo).
-- O CRUD das licenças e dos checklists é feito pelo client via RLS.
--
-- INDEPENDENTE da ordem de migrations: propriedade_id (bigint→propriedades),
-- evento_id (uuid→clientes_eventos) e lancamento_id (bigint→lancamentos) entram
-- como colunas simples; as FOREIGN KEYS são adicionadas DEPOIS, só se as
-- tabelas-alvo existirem (bloco DO no fim). Re-rodar cria as FKs que passaram a
-- ser possíveis.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) licencas — alvarás permanentes + licenças por evento ---------------------
create table if not exists public.licencas (
  id             uuid primary key default gen_random_uuid(),
  usuario_id     uuid not null references auth.users (id) on delete cascade,
  propriedade_id bigint,                                -- FK -> propriedades (fim do arquivo)
  escopo         text not null default 'permanente'
                 check (escopo in ('permanente', 'evento')),
  evento_id      uuid,                                  -- FK -> clientes_eventos (escopo='evento')
  tipo           text not null default 'outro'
                 check (tipo in ('funcionamento','avcb_bombeiros','sanitaria','ambiental',
                                 'ruido_som','ecad','evento_publico','policia',
                                 'via_publica','anac','outro')),
  titulo         text,                                  -- rótulo livre (default = label do tipo)
  orgao          text,                                  -- órgão emissor
  orgao_contato  text,                                  -- telefone/e-mail/endereço do órgão
  numero         text,                                  -- número da licença emitida
  protocolo      text,                                  -- número do protocolo (processo em andamento)
  emissao        date,
  validade       date,                                  -- null = permanente sem vencimento
  dias_aviso     integer not null default 60 check (dias_aviso >= 0),
  custo_num      numeric check (custo_num is null or custo_num >= 0),
  status         text not null default 'em_processo'
                 check (status in ('vigente','a_vencer','vencida','em_processo','nao_aplicavel')),
  obrigatorio    boolean not null default true,         -- exigência obrigatória → bloqueia prontidão
  responsavel    text,
  documento_url  text,                                  -- caminho no Storage (bucket `documentos`)
  documento_nome text,
  lancamento_id  bigint,                                -- FK -> lancamentos (despesa do custo)
  obs            text,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now()
);

-- 2) compliance_checklists — biblioteca de exigências por tipo/porte -----------
--    itens jsonb: [{ tipo, titulo, obrigatorio, publicoMin, orgao, dias_aviso, descricao }]
create table if not exists public.compliance_checklists (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  nome          text not null,
  tipo_evento   text,                                   -- chave/tipo do evento (casamento, show…)
  itens         jsonb not null default '[]'::jsonb,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 3) índices ------------------------------------------------------------------
create index if not exists idx_licencas_usuario     on public.licencas (usuario_id);
create index if not exists idx_licencas_escopo      on public.licencas (usuario_id, escopo);
create index if not exists idx_licencas_evento      on public.licencas (evento_id);
create index if not exists idx_licencas_prop        on public.licencas (propriedade_id);
create index if not exists idx_licencas_validade    on public.licencas (usuario_id, validade);
create index if not exists idx_licencas_status      on public.licencas (usuario_id, status);

create index if not exists idx_compliance_usuario   on public.compliance_checklists (usuario_id);
create index if not exists idx_compliance_tipo      on public.compliance_checklists (usuario_id, tipo_evento);

-- 4) atualizado_em automático (gatilho genérico reaproveitado) ----------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_licencas_touch on public.licencas;
create trigger trg_licencas_touch
  before update on public.licencas
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_compliance_touch on public.compliance_checklists;
create trigger trg_compliance_touch
  before update on public.compliance_checklists
  for each row execute function public.tg_touch_atualizado_em();

-- 5) RLS: o dono vê/edita apenas as próprias linhas ---------------------------
--    "aplicar checklist" e "lançar custo" passam por /api/licencas (service-role,
--    ignora RLS). O CRUD comum é feito pelo client via estas policies.
alter table public.licencas              enable row level security;
alter table public.compliance_checklists enable row level security;

drop policy if exists "dono gerencia licencas" on public.licencas;
create policy "dono gerencia licencas" on public.licencas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia compliance_checklists" on public.compliance_checklists;
create policy "dono gerencia compliance_checklists" on public.compliance_checklists
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- 6) FKs opcionais (só se as tabelas-alvo existirem) --------------------------
-- Adiciona uma FK a uma coluna existente, protegido contra incompatibilidade de
-- tipo. Se falhar, mantém a coluna sem FK. (Mesmo padrão de manutencao.sql.)
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('licencas', 'propriedade_id', 'propriedades',     'id', 'licencas_propriedade_id_fkey'),
      ('licencas', 'evento_id',      'clientes_eventos', 'id', 'licencas_evento_id_fkey'),
      ('licencas', 'lancamento_id',  'lancamentos',      'id', 'licencas_lancamento_id_fkey')
    ) as t(src_table, src_col, ref_table, ref_col, fk_name)
  loop
    if exists (select 1 from information_schema.tables
               where table_schema = 'public' and table_name = r.ref_table)
       and not exists (select 1 from pg_constraint where conname = r.fk_name)
    then
      begin
        execute format(
          'alter table public.%I add constraint %I foreign key (%I) references public.%I (%I) on delete set null',
          r.src_table, r.fk_name, r.src_col, r.ref_table, r.ref_col);
      exception when others then
        raise notice 'FK %.% -> % não criada (%). Coluna mantida sem FK.', r.src_table, r.src_col, r.ref_table, sqlerrm;
      end;
    end if;
  end loop;
end $$;

-- Observação: a checagem de PRONTIDÃO (exigência obrigatória pendente bloqueia o
-- "evento pronto" — liga com /painel/producao), o cálculo de semáforo/a-vencer e
-- a geração por TEMPLATE vivem na engine lib/licencas.ts + a rota /api/licencas.
-- A RLS garante o isolamento multi-tenant; a regra de negócio fica na aplicação
-- (espelha Produção/Manutenção).

-- Fim ------------------------------------------------------------------------

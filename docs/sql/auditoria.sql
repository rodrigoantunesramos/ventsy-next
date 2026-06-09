-- ============================================================================
-- Auditoria & Logs — /painel/auditoria
-- ----------------------------------------------------------------------------
-- Trilha imutável de "quem fez o quê e quando", com foco em ações SENSÍVEIS:
-- criação/edição/exclusão em entidades sensíveis (financeiro, contratos,
-- preços, permissões), além de LOGINS (sucesso/falha), EXPORTAÇÕES de dados e
-- PAGAMENTOS. Essencial com multi-usuário e para confiança/compliance (LGPD).
--
-- Uma tabela:
--   • auditoria_log — append-only. Escrita SEMPRE via service-role pelo helper
--     central lib/auditServer.ts (registrarAuditoria), chamado nas rotas de API
--     sensíveis e no login. Guarda o ator (id + snapshot nome/e-mail), a ação,
--     a entidade afetada, o diff antes→depois (jsonb, JÁ redigido de segredos),
--     origem (ip/user_agent) e se foi sensível/bem-sucedida.
--
-- A leitura/filtro/agregação/diff/CSV vivem em lib/audit.ts (motor puro,
-- testado). A página lê via RLS (o dono vê só as próprias linhas).
--
-- IMUTABILIDADE: há policy de SELECT para o dono, mas NENHUMA policy de
-- INSERT/UPDATE/DELETE — logo, via client (anon/auth) ninguém grava nem altera
-- a trilha. Quem escreve e expurga (retenção) é a service-role, que ignora RLS.
--
-- Convenções (ver docs/prompts/00-contexto-base.md):
--   • snake_case PT; usuario_id (dono) + criado_em. Sem "R$" no banco.
--   • Independente de outras migrations: ator_id é uuid simples; a FK p/
--     auth.users é adicionada no fim, protegida.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) auditoria_log ------------------------------------------------------------
create table if not exists public.auditoria_log (
  id            bigint generated always as identity primary key,
  -- Conta (dono) à qual a trilha pertence — escopo de leitura por RLS.
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  -- Ator que executou a ação (membro/dono). Snapshot de nome/e-mail para exibir
  -- mesmo que o usuário seja removido depois. ator_id null = sistema/cron.
  ator_id       uuid,
  ator_nome     text,
  ator_email    text,
  -- O que aconteceu:
  acao          text not null
                check (acao in ('criar','editar','excluir','login','login_falha',
                                'logout','exportar','permissao','pagamento',
                                'config','acesso','outro')),
  entidade      text,              -- 'lancamento'|'contrato'|'preco'|'permissao'|...
  entidade_id   text,              -- id da linha afetada (text: ids variam uuid/bigint)
  descricao     text,              -- resumo legível ("removeu contrato #12")
  -- Diff (JÁ redigido de segredos pelo lib/auditServer antes de gravar):
  antes         jsonb,
  depois        jsonb,
  meta          jsonb,             -- contexto extra (nome do alvo, formato export, etc.)
  -- Classificação e origem:
  sensivel      boolean not null default false,
  sucesso       boolean not null default true,  -- login_falha => false
  ip            text,
  user_agent    text,
  criado_em     timestamptz not null default now()
);

-- 2) índices (consultas por dono + ordenação/filtros da timeline) -------------
create index if not exists idx_auditoria_usuario   on public.auditoria_log (usuario_id, criado_em desc);
create index if not exists idx_auditoria_acao       on public.auditoria_log (usuario_id, acao);
create index if not exists idx_auditoria_entidade   on public.auditoria_log (usuario_id, entidade);
create index if not exists idx_auditoria_ator       on public.auditoria_log (usuario_id, ator_id);
create index if not exists idx_auditoria_sensivel   on public.auditoria_log (usuario_id, criado_em desc) where sensivel;

-- 3) RLS: o dono LÊ as próprias linhas; ninguém escreve/altera via client -----
-- (a service-role ignora RLS e é quem grava/expurga — trilha imutável p/ clientes.)
alter table public.auditoria_log enable row level security;

drop policy if exists "dono le auditoria" on public.auditoria_log;
create policy "dono le auditoria" on public.auditoria_log
  for select using (usuario_id = auth.uid());

-- 4) FK opcional: ator_id -> auth.users (mantém snapshot se o ator sumir) ------
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'auditoria_log_ator_id_fkey') then
    begin
      alter table public.auditoria_log
        add constraint auditoria_log_ator_id_fkey
        foreign key (ator_id) references auth.users (id) on delete set null;
    exception when others then
      raise notice 'FK auditoria_log.ator_id -> auth.users não criada (%). Coluna mantida sem FK.', sqlerrm;
    end;
  end if;
end $$;

-- Fim ------------------------------------------------------------------------
-- Retenção: a página /painel/auditoria expurga logs antigos sob demanda via
-- POST /api/auditoria { action: 'expurgar', dias }. Para automatizar, agende um
-- job (Supabase pg_cron) chamando a mesma rota — espelha os demais crons do app.

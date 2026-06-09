-- ============================================================================
-- Jurídico & LGPD — /painel/juridico
-- ----------------------------------------------------------------------------
-- Central jurídica e de privacidade do espaço de eventos. Seis tabelas:
--
--   • juridico_contratos  — contratos que NÃO são de cliente (fornecedor/trabalho/
--     parceria/serviço/NDA/seguro…). Os contratos de CLIENTE continuam na tabela
--     `contratos` (geridos em /painel/contratos); o módulo só os CONSOLIDA na visão
--     de prazos. `status` é o ciclo de vida (rascunho/vigente/rescindido/encerrado);
--     "a vencer"/"vencido" são DERIVADOS de `vigencia_fim` pela engine (lib/juridico).
--   • juridico_processos  — processos/notificações (judicial/administrativo/acordo…)
--     com prazo, polo, valor envolvido e advogado responsável.
--   • lgpd_consentimentos — registro de consentimentos (base legal LGPD art. 7/11 +
--     finalidade + canal de origem), com data de concessão e de revogação.
--   • lgpd_solicitacoes   — fila de direitos do titular (acesso/correção/exclusão/
--     portabilidade/…) com o PRAZO LEGAL (art. 19: 15 dias) e a trilha de resposta.
--   • lgpd_retencao       — política de retenção/descarte por tipo de dado.
--   • lgpd_politicas       — documentos versionados (privacidade/termos/cookies…),
--     que ligam com Configurações e as páginas públicas /termos e /privacidade.
--
-- A exportação e a ANONIMIZAÇÃO efetiva dos dados de um titular (varrendo
-- `clientes`, `clientes_eventos`, `convidados`, leads…) passam por /api/juridico
-- (service-role). O CRUD de todas as tabelas abaixo é feito pelo client via RLS.
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e depois
-- regenere types/supabase.ts (enquanto isso o código usa `supabaseAny`).
-- ============================================================================

-- 1) juridico_contratos — contratos não-cliente -----------------------------
create table if not exists public.juridico_contratos (
  id                uuid primary key default gen_random_uuid(),
  usuario_id        uuid not null references auth.users (id) on delete cascade,
  categoria         text not null default 'fornecedor'
                    check (categoria in ('cliente','fornecedor','trabalho','parceria','locacao','servico','nda','seguro','outro')),
  titulo            text,
  contraparte       text,                                   -- a outra parte (fornecedor, funcionário, parceiro…)
  numero            text,                                   -- nº/identificador do contrato
  objeto            text,                                   -- objeto/escopo
  valor_num         numeric not null default 0,
  moeda             text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  inicio            date,
  vigencia_fim      date,                                   -- vencimento (alimenta o alerta)
  renovacao         text not null default 'manual'
                    check (renovacao in ('manual','automatica','nao_renova')),
  aviso_previo_dias integer not null default 30,            -- antecedência do alerta de renovação
  status            text not null default 'vigente'
                    check (status in ('rascunho','vigente','rescindido','encerrado')),
  responsavel       text,
  documento_url     text,
  fornecedor_id     bigint,                                 -- FK lógica p/ fornecedores (sem constraint: tabela opcional)
  obs               text,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now()
);

-- 2) juridico_processos — processos & notificações ---------------------------
create table if not exists public.juridico_processos (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  tipo                text not null default 'judicial'
                      check (tipo in ('judicial','administrativo','notificacao','acordo','arbitragem','outro')),
  parte               text,                                 -- contraparte
  polo                text not null default 'reu'
                      check (polo in ('autor','reu','terceiro','interessado')),
  numero              text,                                 -- nº do processo/protocolo
  vara_orgao          text,                                 -- vara/órgão/comarca
  status              text not null default 'ativo'
                      check (status in ('ativo','suspenso','acordo','encerrado','arquivado')),
  prazo               date,                                 -- próximo prazo
  proximo_passo       text,
  valor_envolvido_num numeric not null default 0,
  moeda               text not null default 'BRL' check (moeda in ('BRL','USD','EUR')),
  advogado            text,
  anexos              jsonb not null default '[]'::jsonb,   -- [{nome,url}]
  obs                 text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 3) lgpd_consentimentos — registro de consentimentos ------------------------
create table if not exists public.lgpd_consentimentos (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  titular_tipo  text not null default 'cliente'
                check (titular_tipo in ('cliente','convidado','funcionario','lead','fornecedor','outro')),
  titular_id    text,                                       -- referência solta (uuid/bigint/email) à origem
  titular_nome  text,
  finalidade    text,                                       -- p/ que o dado é tratado
  base_legal    text not null default 'consentimento'
                check (base_legal in ('consentimento','contrato','obrigacao_legal','legitimo_interesse',
                                      'exercicio_direitos','protecao_vida','tutela_saude','protecao_credito','politicas_publicas')),
  canal         text not null default 'formulario'
                check (canal in ('formulario','ingresso','portal','site','contrato','whatsapp','presencial','lead','outro')),
  concedido_em  timestamptz not null default now(),
  revogado_em   timestamptz,                                -- null = consentimento ativo
  evidencia     text,                                       -- link/hash/print da coleta
  criado_em     timestamptz not null default now()
);

-- 4) lgpd_solicitacoes — direitos do titular (com prazo legal) ---------------
create table if not exists public.lgpd_solicitacoes (
  id              uuid primary key default gen_random_uuid(),
  usuario_id      uuid not null references auth.users (id) on delete cascade,
  titular_nome    text,
  titular_contato text,                                     -- e-mail/telefone do solicitante
  titular_tipo    text not null default 'cliente'
                  check (titular_tipo in ('cliente','convidado','funcionario','lead','fornecedor','outro')),
  titular_id      text,
  tipo            text not null default 'acesso'
                  check (tipo in ('acesso','correcao','exclusao','portabilidade','anonimizacao','revogacao','oposicao','informacao')),
  canal           text not null default 'portal'
                  check (canal in ('formulario','ingresso','portal','site','contrato','whatsapp','presencial','lead','outro')),
  status          text not null default 'aberta'
                  check (status in ('aberta','em_andamento','concluida','recusada')),
  prazo           date,                                     -- prazo legal de resposta (criado_em + 15 dias)
  resposta        text,                                     -- trilha do atendimento
  anexos          jsonb not null default '[]'::jsonb,
  concluida_em    timestamptz,
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

-- 5) lgpd_retencao — política de retenção/descarte por tipo de dado ----------
create table if not exists public.lgpd_retencao (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  tipo_dado     text not null,                              -- ex.: "Cadastro de cliente", "Lista de convidados"
  base_legal    text not null default 'obrigacao_legal'
                check (base_legal in ('consentimento','contrato','obrigacao_legal','legitimo_interesse',
                                      'exercicio_direitos','protecao_vida','tutela_saude','protecao_credito','politicas_publicas')),
  prazo_meses   integer not null default 12,                -- retenção, em meses, a partir do gatilho
  gatilho       text not null default 'coleta'
                check (gatilho in ('coleta','apos_evento','fim_contrato','fim_relacao','fim_processo')),
  acao_apos     text not null default 'anonimizar'
                check (acao_apos in ('excluir','anonimizar','arquivar')),
  responsavel   text,
  obs           text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 6) lgpd_politicas — documentos versionados (privacidade/termos/…) ----------
create table if not exists public.lgpd_politicas (
  id            uuid primary key default gen_random_uuid(),
  usuario_id    uuid not null references auth.users (id) on delete cascade,
  tipo          text not null default 'privacidade'
                check (tipo in ('privacidade','termos','cookies','retencao','seguranca','outro')),
  versao        text not null default '1.0',
  titulo        text,
  resumo        text,                                       -- o que mudou nesta versão
  url           text,                                       -- link público/arquivo
  conteudo      text,                                       -- conteúdo embutido (opcional)
  vigente_desde date,
  publicada     boolean not null default false,             -- só uma vigente por tipo (regra de UI)
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- 7) índices -----------------------------------------------------------------
create index if not exists idx_jur_contratos_usuario on public.juridico_contratos (usuario_id);
create index if not exists idx_jur_contratos_status  on public.juridico_contratos (usuario_id, status);
create index if not exists idx_jur_contratos_venc    on public.juridico_contratos (usuario_id, vigencia_fim);
create index if not exists idx_jur_contratos_forn    on public.juridico_contratos (fornecedor_id);

create index if not exists idx_jur_processos_usuario on public.juridico_processos (usuario_id);
create index if not exists idx_jur_processos_status  on public.juridico_processos (usuario_id, status);
create index if not exists idx_jur_processos_prazo   on public.juridico_processos (usuario_id, prazo);

create index if not exists idx_lgpd_consent_usuario  on public.lgpd_consentimentos (usuario_id);
create index if not exists idx_lgpd_consent_titular  on public.lgpd_consentimentos (usuario_id, titular_tipo, titular_id);
create index if not exists idx_lgpd_consent_ativo    on public.lgpd_consentimentos (usuario_id, revogado_em);

create index if not exists idx_lgpd_solic_usuario    on public.lgpd_solicitacoes (usuario_id);
create index if not exists idx_lgpd_solic_status     on public.lgpd_solicitacoes (usuario_id, status);
create index if not exists idx_lgpd_solic_prazo      on public.lgpd_solicitacoes (usuario_id, prazo);

create index if not exists idx_lgpd_retencao_usuario on public.lgpd_retencao (usuario_id);
create index if not exists idx_lgpd_politicas_usuario on public.lgpd_politicas (usuario_id, tipo);

-- 8) atualizado_em automático (gatilho genérico, reaproveitado) --------------
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_jur_contratos_touch on public.juridico_contratos;
create trigger trg_jur_contratos_touch before update on public.juridico_contratos
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_jur_processos_touch on public.juridico_processos;
create trigger trg_jur_processos_touch before update on public.juridico_processos
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_lgpd_solic_touch on public.lgpd_solicitacoes;
create trigger trg_lgpd_solic_touch before update on public.lgpd_solicitacoes
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_lgpd_retencao_touch on public.lgpd_retencao;
create trigger trg_lgpd_retencao_touch before update on public.lgpd_retencao
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_lgpd_politicas_touch on public.lgpd_politicas;
create trigger trg_lgpd_politicas_touch before update on public.lgpd_politicas
  for each row execute function public.tg_touch_atualizado_em();

-- 9) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    A exportação/anonimização de titulares passa por /api/juridico (service-role,
--    fura RLS de forma controlada) — por isso não há policy anônima aqui.
alter table public.juridico_contratos  enable row level security;
alter table public.juridico_processos  enable row level security;
alter table public.lgpd_consentimentos enable row level security;
alter table public.lgpd_solicitacoes   enable row level security;
alter table public.lgpd_retencao       enable row level security;
alter table public.lgpd_politicas      enable row level security;

drop policy if exists "dono gerencia juridico_contratos" on public.juridico_contratos;
create policy "dono gerencia juridico_contratos" on public.juridico_contratos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia juridico_processos" on public.juridico_processos;
create policy "dono gerencia juridico_processos" on public.juridico_processos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia lgpd_consentimentos" on public.lgpd_consentimentos;
create policy "dono gerencia lgpd_consentimentos" on public.lgpd_consentimentos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia lgpd_solicitacoes" on public.lgpd_solicitacoes;
create policy "dono gerencia lgpd_solicitacoes" on public.lgpd_solicitacoes
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia lgpd_retencao" on public.lgpd_retencao;
create policy "dono gerencia lgpd_retencao" on public.lgpd_retencao
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia lgpd_politicas" on public.lgpd_politicas;
create policy "dono gerencia lgpd_politicas" on public.lgpd_politicas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

-- ============================================================================
-- Feedbacks (privados — cliente ↔ dono) · /painel/feedbacks
-- ----------------------------------------------------------------------------
-- Canal PRIVADO de avaliação pós-evento, separado das avaliações públicas
-- (tabela `avaliacoes`). Estruturado (notas por critério), ligado a um evento
-- (clientes_eventos) e tratado internamente (plano de ação/CAPA em feedbacks_acoes).
-- NÃO aparece no anúncio público — exceto quando o dono "promove" um feedback
-- elogioso a `avaliacoes` (verificada), o que é feito por app/api/feedbacks (POST
-- action=promover, service-role).
--
-- Coleta pública: o formulário /feedback/[token] insere aqui via service-role
-- (app/api/feedbacks/publico). O token carrega o evento_id assinado (lib/feedbackToken),
-- então NÃO há policy de insert público — o anon entra exclusivamente pela API.
--
-- Idempotente: CRIA se faltar e ADICIONA colunas/índices/policies sem erro se já
-- existirem (rode quantas vezes quiser). Depois atualize types/supabase.ts.
-- ============================================================================

-- 1) feedbacks ---------------------------------------------------------------
create table if not exists public.feedbacks (
  id                      uuid primary key default gen_random_uuid(),
  usuario_id              uuid not null references auth.users (id) on delete cascade,  -- dono
  cliente_id              uuid references public.clientes (id) on delete set null,
  evento_id               uuid references public.clientes_eventos (id) on delete set null,
  propriedade_id          bigint,                       -- derivado do evento (filtro)
  autor_nome              text,                         -- quem deu o feedback (cliente)
  autor_contato           text,                         -- e-mail/telefone p/ resposta privada
  canal                   text not null default 'formulario'
                            check (canal in ('formulario', 'whatsapp', 'presencial', 'email')),
  nota_geral              smallint check (nota_geral between 1 and 5),
  criterios               jsonb not null default '{}'::jsonb,  -- { atendimento:5, estrutura:4, ... }
  comentario              text,
  pontos_positivos        text,
  pontos_negativos        text,
  permite_publicar        boolean not null default false,
  status                  text not null default 'novo'
                            check (status in ('novo', 'em_tratativa', 'resolvido')),
  resposta_privada        text,
  respondido_em           timestamptz,
  promovida_avaliacao_id  bigint,                       -- id da avaliação criada ao promover
  resolvido_em            timestamptz,
  criado_em               timestamptz not null default now(),
  atualizado_em           timestamptz not null default now()
);

-- Extensão idempotente (ambientes onde a tabela já existia antes da spec).
alter table public.feedbacks add column if not exists cliente_id             uuid;
alter table public.feedbacks add column if not exists evento_id              uuid;
alter table public.feedbacks add column if not exists propriedade_id         bigint;
alter table public.feedbacks add column if not exists autor_nome             text;
alter table public.feedbacks add column if not exists autor_contato          text;
alter table public.feedbacks add column if not exists canal                  text;
alter table public.feedbacks add column if not exists nota_geral             smallint;
alter table public.feedbacks add column if not exists criterios              jsonb not null default '{}'::jsonb;
alter table public.feedbacks add column if not exists comentario             text;
alter table public.feedbacks add column if not exists pontos_positivos       text;
alter table public.feedbacks add column if not exists pontos_negativos       text;
alter table public.feedbacks add column if not exists permite_publicar       boolean not null default false;
alter table public.feedbacks add column if not exists status                 text not null default 'novo';
alter table public.feedbacks add column if not exists resposta_privada       text;
alter table public.feedbacks add column if not exists respondido_em          timestamptz;
alter table public.feedbacks add column if not exists promovida_avaliacao_id bigint;
alter table public.feedbacks add column if not exists resolvido_em           timestamptz;
alter table public.feedbacks add column if not exists atualizado_em          timestamptz not null default now();

-- 2) feedbacks_acoes (plano de ação / CAPA) ----------------------------------
create table if not exists public.feedbacks_acoes (
  id           uuid primary key default gen_random_uuid(),
  feedback_id  uuid not null references public.feedbacks (id) on delete cascade,
  usuario_id   uuid not null references auth.users (id) on delete cascade,  -- p/ RLS direta
  descricao    text not null,
  responsavel  text,
  prazo        date,
  status       text not null default 'aberta'
                 check (status in ('aberta', 'em_andamento', 'concluida', 'cancelada')),
  concluida_em timestamptz,
  criado_em    timestamptz not null default now()
);

-- 3) índices -----------------------------------------------------------------
create index if not exists idx_feedbacks_usuario      on public.feedbacks (usuario_id);
create index if not exists idx_feedbacks_evento       on public.feedbacks (evento_id);
create index if not exists idx_feedbacks_propriedade  on public.feedbacks (propriedade_id);
create index if not exists idx_feedbacks_status       on public.feedbacks (status);
create index if not exists idx_feedbacks_criado_em    on public.feedbacks (criado_em desc);
create index if not exists idx_feedbacks_acoes_fb     on public.feedbacks_acoes (feedback_id);
create index if not exists idx_feedbacks_acoes_user   on public.feedbacks_acoes (usuario_id);

-- 4) atualizado_em automático ------------------------------------------------
create or replace function public.tg_feedbacks_touch()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

drop trigger if exists trg_feedbacks_touch on public.feedbacks;
create trigger trg_feedbacks_touch
  before update on public.feedbacks
  for each row execute function public.tg_feedbacks_touch();

-- 5) RLS: o dono vê/edita apenas as próprias linhas --------------------------
--    O insert público (formulário anônimo) NÃO tem policy — entra só pela API
--    com service-role, que resolve o dono pelo token assinado do evento.
alter table public.feedbacks       enable row level security;
alter table public.feedbacks_acoes enable row level security;

drop policy if exists "dono gerencia feedbacks" on public.feedbacks;
create policy "dono gerencia feedbacks" on public.feedbacks
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia feedbacks_acoes" on public.feedbacks_acoes;
create policy "dono gerencia feedbacks_acoes" on public.feedbacks_acoes
  for all to authenticated using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- Fim ------------------------------------------------------------------------

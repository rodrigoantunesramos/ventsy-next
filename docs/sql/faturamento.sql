-- ============================================================================
-- Faturamento & Notas Fiscais — /painel/faturamento
-- ----------------------------------------------------------------------------
-- Emissão e controle de documentos fiscais (NFS-e municipal de locação/serviço,
-- NF-e de produto e RECIBO numerado) + cobrança integrada (fatura com link de
-- pagamento) e conciliação nota↔recebimento↔contábil.
--
-- Princípios:
--   • Reaproveita o que já existe: `parcelas` (a receber), `lancamentos` (caixa),
--     `clientes_eventos` (evento/CRM), `contratos`, e os dados do EMITENTE em
--     empresa_config.config_fiscal (regime, CNAE, código de serviço, ISS…).
--     Não duplica nada disso — apenas referencia.
--   • As CREDENCIAIS do provedor de NFS-e são SEGREDO: ficam em
--     `fiscal_provedores` com RLS habilitada e SEM policy — só as rotas de API
--     (service-role) leem/gravam; a chave nunca chega ao navegador (mesmo padrão
--     da tabela `integracoes`).
--   • Toda numeração/valor de imposto é AUTORITATIVA no servidor (rota
--     /api/faturamento/emitir, motor puro lib/fiscal.ts).
--
-- Idempotente: pode rodar mais de uma vez. Rode no Supabase (SQL Editor) e
-- depois regenere types/supabase.ts (enquanto isso o código usa supabaseAny).
-- ============================================================================

-- 0) gatilho genérico de atualizado_em (reaproveitado por outros módulos) -----
create or replace function public.tg_touch_atualizado_em()
returns trigger language plpgsql as $$
begin
  new.atualizado_em = now();
  return new;
end $$;

-- 1) notas_fiscais — documentos fiscais emitidos (NFS-e / NF-e / recibo) ------
-- Registro IMUTÁVEL na prática: guarda um SNAPSHOT do tomador e dos valores no
-- momento da emissão (a config fiscal pode mudar depois). `numero_seq` é a
-- sequência inteira por dono (ordena/gera o próximo número); `numero` é o
-- rótulo renderizado com prefixo (ex.: 'NF-0001').
create table if not exists public.notas_fiscais (
  id                  uuid primary key default gen_random_uuid(),
  usuario_id          uuid not null references auth.users (id) on delete cascade,
  tipo                text not null default 'recibo'
                      check (tipo in ('nfse','nfe','recibo')),
  numero_seq          bigint not null default 0,
  numero              text   not null,
  serie               text,
  -- vínculos (todos opcionais — uma nota pode ser avulsa)
  cliente_id          uuid   references public.clientes (id)          on delete set null,
  evento_id           uuid   references public.clientes_eventos (id)  on delete set null,
  contrato_id         uuid   references public.contratos (id)         on delete set null,
  parcela_id          bigint references public.parcelas (id)          on delete set null,
  -- snapshot do tomador (destinatário) no momento da emissão
  tomador_nome        text,
  tomador_doc         text,
  tomador_email       text,
  -- valores (números crus; formatação é responsabilidade do app via lib/format)
  valor_servicos_num  numeric not null default 0,
  descontos_num       numeric not null default 0,
  aliquota_iss        numeric,                               -- % aplicada
  iss_num             numeric not null default 0,
  retencoes           jsonb   not null default '{}'::jsonb,  -- breakdown {irrf,pis,cofins,csll,inss,iss_retido}
  total_retencoes_num numeric not null default 0,
  valor_liquido_num   numeric not null default 0,            -- total - retenções
  valor_total_num     numeric not null default 0,            -- valor de face da nota (serviços - descontos)
  codigo_servico      text,
  discriminacao       text,
  regime              text,
  status              text not null default 'rascunho'
                      check (status in ('rascunho','emitida','cancelada','erro')),
  emitida_em          timestamptz,
  cancelada_em        timestamptz,
  -- arquivamento e rastreio do provedor
  provedor            text,                                  -- 'focusnfe'|'enotas'|'nfeio'|'plugnotas'|'manual'|'recibo'
  provedor_id         text,                                  -- id/protocolo retornado pelo provedor
  provedor_msg        text,                                  -- mensagem de erro/aviso do provedor
  xml_url             text,
  pdf_url             text,
  motivo_cancelamento text,
  criado_em           timestamptz not null default now(),
  atualizado_em       timestamptz not null default now()
);

-- 2) faturas — cobrança (link de pagamento) sobre um recebível ---------------
-- Uma fatura é o INSTRUMENTO de cobrança: pode cobrir uma `parcela` (a receber),
-- referenciar uma `nota_fiscal`, e carregar o link/PIX/boleto gerado pelo
-- provedor de pagamento (Mercado Pago). Ao ser quitada, baixa a parcela e gera
-- um `lancamento` de receita (regime caixa) — o vínculo `lancamento_id` fecha a
-- conciliação nota↔recebimento↔contábil.
create table if not exists public.faturas (
  id               uuid primary key default gen_random_uuid(),
  usuario_id       uuid not null references auth.users (id) on delete cascade,
  cliente_id       uuid   references public.clientes (id)          on delete set null,
  evento_id        uuid   references public.clientes_eventos (id)  on delete set null,
  parcela_id       bigint references public.parcelas (id)          on delete set null,
  nota_id          uuid   references public.notas_fiscais (id)     on delete set null,
  descricao        text,
  valor_num        numeric not null default 0,
  vencimento       date,
  status           text not null default 'aberta'
                   check (status in ('aberta','paga','vencida','cancelada')),
  meio             text check (meio in ('pix','boleto','cartao','link')),
  link_pagamento   text,
  provedor_pgto    text,                                    -- 'mercadopago'
  provedor_pgto_id text,                                    -- preference/payment id
  pago_em          timestamptz,
  lancamento_id    bigint references public.lancamentos (id) on delete set null,
  criado_em        timestamptz not null default now(),
  atualizado_em    timestamptz not null default now()
);

-- 3) fiscal_provedores — CREDENCIAIS do provedor de NFS-e (SEGREDO) -----------
-- RLS habilitada e SEM policy: nenhuma sessão de navegador lê esta tabela.
-- Apenas /api/faturamento/* (service-role) acessa. `endpoint` permite o
-- adaptador genérico (POST JSON + Bearer) para provedores compatíveis; sem
-- endpoint, a emissão degrada para emissão MANUAL assistida (nota registrada) ou
-- RECIBO — conforme a escolha do dono.
create table if not exists public.fiscal_provedores (
  usuario_id     uuid primary key references auth.users (id) on delete cascade,
  provedor       text not null default 'manual'
                 check (provedor in ('focusnfe','enotas','nfeio','plugnotas','manual')),
  ambiente       text not null default 'homologacao'
                 check (ambiente in ('homologacao','producao')),
  endpoint       text,                                      -- base URL do adaptador genérico
  token          text,                                      -- segredo (Bearer)
  empresa_token  text,                                      -- id/token da empresa no provedor (quando aplicável)
  cnpj           text,
  ativo          boolean not null default true,
  atualizado_em  timestamptz not null default now()
);

-- 4) parcelas: marcar a parcela faturada (vínculo de mão dupla) ---------------
-- A nota referencia a parcela (notas_fiscais.parcela_id); aqui guardamos o
-- caminho inverso para a tela de Recebíveis sinalizar "faturada".
alter table public.parcelas
  add column if not exists nota_id uuid references public.notas_fiscais (id) on delete set null;

-- 5) índices -----------------------------------------------------------------
create index if not exists idx_notas_usuario        on public.notas_fiscais (usuario_id);
create index if not exists idx_notas_usuario_status on public.notas_fiscais (usuario_id, status);
create index if not exists idx_notas_usuario_seq    on public.notas_fiscais (usuario_id, numero_seq);
create index if not exists idx_notas_evento         on public.notas_fiscais (evento_id);
create index if not exists idx_notas_parcela        on public.notas_fiscais (parcela_id);
create index if not exists idx_notas_emitida_em     on public.notas_fiscais (usuario_id, emitida_em);
create index if not exists idx_faturas_usuario      on public.faturas (usuario_id);
create index if not exists idx_faturas_status       on public.faturas (usuario_id, status);
create index if not exists idx_faturas_parcela      on public.faturas (parcela_id);
create index if not exists idx_faturas_vencimento   on public.faturas (usuario_id, vencimento);
create index if not exists idx_parcelas_nota        on public.parcelas (nota_id);

-- 6) atualizado_em automático -------------------------------------------------
drop trigger if exists trg_notas_touch on public.notas_fiscais;
create trigger trg_notas_touch
  before update on public.notas_fiscais
  for each row execute function public.tg_touch_atualizado_em();

drop trigger if exists trg_faturas_touch on public.faturas;
create trigger trg_faturas_touch
  before update on public.faturas
  for each row execute function public.tg_touch_atualizado_em();

-- 7) RLS ---------------------------------------------------------------------
-- notas_fiscais / faturas: o dono vê/edita as próprias linhas. As mutações
-- sensíveis (numeração sequencial, emissão no provedor, geração de link de
-- pagamento) passam por rotas de API com service-role, mas a LEITURA da tela é
-- direta e escopada pela policy abaixo.
alter table public.notas_fiscais    enable row level security;
alter table public.faturas          enable row level security;
alter table public.fiscal_provedores enable row level security;  -- SEM policy: só service-role

drop policy if exists "dono gerencia notas_fiscais" on public.notas_fiscais;
create policy "dono gerencia notas_fiscais" on public.notas_fiscais
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

drop policy if exists "dono gerencia faturas" on public.faturas;
create policy "dono gerencia faturas" on public.faturas
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

-- (fiscal_provedores: nenhuma policy — leitura/escrita só via service-role.)

-- Fim ------------------------------------------------------------------------

-- ============================================================================
-- Rate-limit das checagens de cadastro — Auditoria 2026-06
-- As funções verificar_email/documento/usuario eram RPC SECURITY DEFINER chamadas
-- DIRETO pelo client anônimo: enumeração de e-mail/CPF/usuário; e verificar_email
-- ainda fazia DELETE em auth.users de "zumbis" (destrutivo, disparável por anon).
-- Solução: rota /api/cadastro/verificar (service_role) com rate-limit por IP; as
-- funções deixam de ser executáveis por anon/authenticated.
-- ============================================================================

-- ── SEÇÃO 1 — Infra de rate-limit (ADITIVO; seguro a qualquer momento) ──────────
-- Aplicada em 2026-06-14 via migration sec_rate_limit_infra. Idempotente.
create table if not exists public.rate_limit_hits (
  chave          text        not null,
  janela_inicio  timestamptz not null,
  contador       integer     not null default 0,
  primary key (chave, janela_inicio)
);
alter table public.rate_limit_hits enable row level security;
revoke all on public.rate_limit_hits from anon, authenticated;

create or replace function public.rate_limit_check(p_chave text, p_max integer, p_janela_seg integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inicio timestamptz := to_timestamp(floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg);
  v_cont   integer;
begin
  insert into public.rate_limit_hits as r (chave, janela_inicio, contador)
  values (p_chave, v_inicio, 1)
  on conflict (chave, janela_inicio)
  do update set contador = r.contador + 1
  returning r.contador into v_cont;

  delete from public.rate_limit_hits where chave = p_chave and janela_inicio < v_inicio;

  return v_cont <= p_max;
end;
$$;
revoke all on function public.rate_limit_check(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, integer) to service_role;

-- ── SEÇÃO 2 — Fecha o caminho anônimo (⚠️ APLICAR JUNTO/APÓS O DEPLOY) ───────────
-- NÃO aplicar antes do deploy do client+rota: o site em produção ainda chama estas
-- funções via RPC anônima; revogar antes faz a checagem de disponibilidade perder o
-- feedback inline (o cadastro em si continua funcionando, a unicidade é garantida no
-- signUp/constraints). Depois do deploy, o client usa /api/cadastro/verificar.
-- O EXECUTE default vai para PUBLIC → revogar de PUBLIC (não basta de anon/auth).
revoke execute on function public.verificar_email(text)     from public, anon, authenticated;
revoke execute on function public.verificar_documento(text) from public, anon, authenticated;
revoke execute on function public.verificar_usuario(text)   from public, anon, authenticated;
grant  execute on function public.verificar_email(text)     to service_role;
grant  execute on function public.verificar_documento(text) to service_role;
grant  execute on function public.verificar_usuario(text)   to service_role;

-- ============================================================================
-- Cron Jobs via pg_cron + pg_net (substitui os Cron Jobs do Vercel)
-- ============================================================================
-- POR QUE: o plano Hobby do Vercel limita Cron Jobs a 2 por conta, rodando no
-- maximo 1x/dia. O projeto precisa de 8 rotinas, duas delas a cada 15 min
-- (expirar-holds / expirar-pedidos). Em vez de pagar o plano Pro, agendamos
-- tudo no proprio Supabase: o pg_cron dispara, na frequencia desejada, uma
-- chamada HTTP autenticada para cada endpoint /api/cron/* (que continua sendo
-- a FONTE DE VERDADE da logica). O vercel.json ficou SEM a chave "crons".
--
-- NOTAS IMPORTANTES:
--   * pg_cron usa UTC (igual ao Vercel Cron) -> os horarios sao identicos.
--   * O cron precisa chamar https://www.ventsy.com.br (com "www"): o apex
--     ventsy.com.br responde 308 -> www, e o pg_net NAO segue redirects.
--   * O endpoint exige CRON_SECRET. Garanta que essa env var exista no
--     ambiente de PRODUCAO do Vercel (Settings > Environment Variables),
--     com o MESMO valor guardado no Vault abaixo. Sem isso -> 401.
--   * cron.schedule faz upsert por nome -> este script e idempotente.
-- ============================================================================

-- 1) Extensoes. pg_cron normalmente ja vem instalado no Supabase; pg_net e o
--    cliente HTTP assincrono que faz as chamadas.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Guarda o CRON_SECRET no Vault (criptografado em repouso). Idempotente.
--    >>> TROQUE '<SEU_CRON_SECRET>' pelo mesmo valor de CRON_SECRET do Vercel.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'cron_secret') then
    perform vault.create_secret(
      '<SEU_CRON_SECRET>',
      'cron_secret',
      'Bearer dos endpoints /api/cron/* (mesmo valor de CRON_SECRET no Vercel)'
    );
  end if;
end $$;

-- 3) Funcao helper que dispara um endpoint /api/cron/* com o Bearer do Vault.
--    Fica no schema 'private' (nao exposto via PostgREST) e sem EXECUTE para os
--    roles publicos, de modo que so o pg_cron (postgres) consiga dispara-la.
create schema if not exists private;

create or replace function private.disparar_cron(path text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_secret text;
  v_req_id bigint;
begin
  select decrypted_secret into v_secret
    from vault.decrypted_secrets
   where name = 'cron_secret'
   limit 1;

  select net.http_get(
    url := 'https://www.ventsy.com.br' || path,
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret),
    timeout_milliseconds := 30000
  ) into v_req_id;

  return v_req_id;
end;
$fn$;

revoke all on function private.disparar_cron(text) from public;
revoke all on function private.disparar_cron(text) from anon;
revoke all on function private.disparar_cron(text) from authenticated;

-- 4) Agenda os 8 jobs (mesma frequencia/UTC do vercel.json antigo).
select cron.schedule('expirar-holds',         '*/15 * * * *', $cmd$ select private.disparar_cron('/api/cron/expirar-holds') $cmd$);
select cron.schedule('expirar-pedidos',       '*/15 * * * *', $cmd$ select private.disparar_cron('/api/cron/expirar-pedidos') $cmd$);
select cron.schedule('manutencao-preventiva', '0 4 * * *',    $cmd$ select private.disparar_cron('/api/cron/manutencao-preventiva') $cmd$);
select cron.schedule('apurar-comissoes',      '0 5 * * *',    $cmd$ select private.disparar_cron('/api/cron/apurar-comissoes') $cmd$);
select cron.schedule('contas-vencidas',       '0 6 * * *',    $cmd$ select private.disparar_cron('/api/cron/contas-vencidas') $cmd$);
select cron.schedule('rh-alertas',            '0 7 * * *',    $cmd$ select private.disparar_cron('/api/cron/rh-alertas') $cmd$);
select cron.schedule('clima-eventos',         '0 8 * * *',    $cmd$ select private.disparar_cron('/api/cron/clima-eventos') $cmd$);
select cron.schedule('weekly-report',         '0 12 * * 1',   $cmd$ select private.disparar_cron('/api/cron/weekly-report') $cmd$);

-- ============================================================================
-- Comandos uteis de gestao
-- ============================================================================
-- Ver os jobs agendados:
--   select jobid, jobname, schedule, active from cron.job order by jobid;
--
-- Ver o historico de execucoes (sucesso/falha de cada disparo do pg_cron):
--   select jobid, status, return_message, start_time
--     from cron.job_run_details order by start_time desc limit 20;
--
-- Ver a resposta HTTP que o endpoint devolveu (status 200 = ok, 401 = secret
-- errado/ausente em prod, 404 = rota nao existe no deploy):
--   select id, status_code, timed_out, error_msg, left(content::text,200) as body
--     from net._http_response order by id desc limit 10;
--
-- Disparar um endpoint manualmente em modo simulacao (nao grava nada):
--   select private.disparar_cron('/api/cron/expirar-holds?dry=1');
--
-- Desagendar um job:
--   select cron.unschedule('expirar-holds');
-- ============================================================================

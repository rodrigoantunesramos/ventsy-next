-- ============================================================================
-- Correções de segurança — Auditoria 2026-06-13
-- Já aplicadas em produção via Supabase migrations:
--   - sec_fechar_planos_config_e_views_definer
--   - sec_revoke_limpar_zumbis_from_public
-- Registradas aqui para versionamento no repositório (padrão docs/sql/).
-- ============================================================================

-- V-16 (CRÍTICO): planos_config — escrita anônima.
-- A policy "admin pode tudo" era FOR ALL TO public USING(true) e a role anon
-- tinha grants de escrita → qualquer anônimo alterava preços/planos via REST
-- (e /api/pagamentos/plano lê esse preço para cobrar).
drop policy if exists "admin pode tudo" on public.planos_config;
revoke insert, update, delete on public.planos_config from anon, authenticated;
-- Leitura pública permanece (policy "leitura publica"); escrita só via service-role
-- (/api/admin/planos usa supabaseAdmin).

-- V-17 (ALTO): views SECURITY DEFINER legíveis por anon furavam a RLS de usuarios.
-- vw_leads_remarketing expunha email+nome de leads; v_indicacoes_dashboard, indicações.
revoke select on public.vw_leads_remarketing from anon, authenticated;  -- sem consumidor no app
revoke select on public.v_indicacoes_dashboard from anon;               -- mantém uso autenticado (painel/indique)
-- perfis_publicos mantida (página pública de propriedade usa nome/usuário do anfitrião, dados públicos).
-- FOLLOW-UP: v_indicacoes_dashboard continua SECURITY DEFINER; avaliar security_invoker
--   + policy de SELECT própria, ou troca por rota de API que filtre por auth.uid().

-- V-18 (MÉDIO): função destrutiva (deleta auth.users não confirmados) não pode ser
-- executável por anon. O EXECUTE default vai para PUBLIC; revogar de anon/auth não basta.
revoke execute on function public.limpar_zumbis_auth() from public, anon, authenticated;
grant execute on function public.limpar_zumbis_auth() to service_role;

-- V-18 (cont.): fixa search_path = public em TODAS as funções do schema public
-- (migration sec_fix_function_search_path). Elimina o aviso
-- function_search_path_mutable. Após aplicar: 56 funções, 0 sem search_path.
do $$
declare r record;
begin
  for r in
    select p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
  loop
    begin
      execute format('alter function public.%I(%s) set search_path = public', r.proname, r.args);
    exception when others then raise notice 'skip %(%): %', r.proname, r.args, sqlerrm;
    end;
  end loop;
end $$;

-- ── Rodada 2 (pós-LGPD) ─────────────────────────────────────────────────────────
-- V-17 follow-up: a view só lê de `indicacoes` (policy SELECT indicador_id=auth.uid());
-- security_invoker faz a view respeitar a RLS do chamador (fecha cross-tenant
-- autenticado + o ERROR security_definer_view) sem quebrar o painel/indique.
alter view public.v_indicacoes_dashboard set (security_invoker = on);

-- V-19: bucket público fotos-dashboard expunha LISTAGEM (paths com user-ids) a anon.
-- O app usa URLs /object/public/ + a tabela fotos_imovel (não lista o bucket).
-- Verificado: após remover, /object/public/ segue 200 e a listagem anônima dá [].
drop policy if exists "Leitura pública fotos-dashboard 1fxml9y_0" on storage.objects;

-- ── Aceito / ação manual (ver relatório) ────────────────────────────────────────
-- • HIBP (senha vazada): ligar em Supabase > Authentication > Policies (não é SQL).
-- • pg_net: extensão registrada em public, mas os objetos http_* vivem no schema
--   `net` e disparar_cron usa net.http_get (qualificado). Mover quebraria o cron
--   sem ganho real → MANTIDO (falso-positivo de baixo risco).
-- • perfis_publicos permanece SECURITY DEFINER: é a forma correta de expor um
--   subconjunto de colunas de usuarios numa página pública (RLS não filtra coluna).

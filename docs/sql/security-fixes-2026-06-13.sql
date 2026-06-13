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

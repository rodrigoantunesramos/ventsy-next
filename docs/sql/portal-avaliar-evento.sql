-- ───────────────────────────────────────────────────────────────────────────
-- Portal do Cliente — "avaliar o evento" (feedback privado do contratante logado)
-- Aplicado como migration: feedbacks_canal_add_portal
--
-- Duas avaliações distintas, conectando os dois módulos que já existem:
--   • Avaliar o ESPAÇO  → público  → tabela `avaliacoes` (POST /api/avaliacoes) — sem mudança.
--   • Avaliar o EVENTO  → privado  → tabela `feedbacks`  (módulo Feedbacks do dono).
--
-- O contratante logado avalia o evento na aba "Avaliação" de /client/eventos/[id].
-- A gravação reusa `feedbacks` via /api/portal/cliente action 'avaliar_evento'
-- (service-role; a posse é validada por portal_acessos, não por token). A origem
-- fica registrada como canal 'portal' — por isso ampliamos o CHECK abaixo.
-- ───────────────────────────────────────────────────────────────────────────

alter table public.feedbacks drop constraint if exists feedbacks_canal_check;
alter table public.feedbacks add constraint feedbacks_canal_check
  check (canal = any (array['formulario','portal','whatsapp','presencial','email']));

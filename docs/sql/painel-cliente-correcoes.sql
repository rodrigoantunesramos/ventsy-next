-- ───────────────────────────────────────────────────────────────────────────
-- Correções da revisão de qualidade do painel do cliente
-- Aplicado como migration: painel_cliente_revisao_correcoes
--
-- 1) tg_mensagem_notifica: guard para NÃO notificar o próprio remetente
--    (quando user_id == owner_id na conversa, o destinatário resolvido era o autor).
-- 2) Índices únicos de idempotência (evitam duplicatas sob double-submit/concorrência);
--    os handlers tratam 23505 → 409 "já avaliou" / devolvem a conversa existente.
--
-- NOTA IMPORTANTE (corrigida no código, não aqui): a coluna `propriedades.foto_capa`
-- NÃO existe no banco — apesar de constar em types/supabase.ts (tipos desatualizados,
-- por isso o tsc não pegava). 5 selects que embutiam `foto_capa` falhavam em runtime
-- com "column propriedades_1.foto_capa does not exist", retornando lista vazia
-- mascarada (favoritos/conversas/avaliações/reservas nunca carregavam). Os selects
-- passaram a usar apenas `imagem_url`. Recomenda-se REGENERAR os tipos do Supabase.
-- ───────────────────────────────────────────────────────────────────────────

create or replace function public.tg_mensagem_notifica()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_owner uuid;
  v_dest uuid;
  v_link text;
begin
  select user_id, owner_id into v_user, v_owner from public.conversas where id = NEW.conversation_id;
  if v_user is null and v_owner is null then return NEW; end if;

  if NEW.sender_id = v_user then
    v_dest := v_owner;
    v_link := '/painel/conversas/' || NEW.conversation_id::text;
  else
    v_dest := v_user;
    v_link := '/client/conversas/' || NEW.conversation_id::text;
  end if;
  if v_dest is null or v_dest = NEW.sender_id then return NEW; end if;

  insert into public.notificacoes (usuario_id, tipo, titulo, corpo, link, urgencia, origem, lida)
  values (v_dest, 'mensagem', 'Nova mensagem', left(NEW.text, 140), v_link, 'info', 'chat', false);
  return NEW;
end;
$$;

create unique index if not exists ux_feedbacks_evento_portal on public.feedbacks (evento_id) where canal = 'portal';
create unique index if not exists ux_avaliacoes_user_prop on public.avaliacoes (user_id, propriedade_id);
create unique index if not exists ux_conversas_user_prop on public.conversas (user_id, propriedade_id);

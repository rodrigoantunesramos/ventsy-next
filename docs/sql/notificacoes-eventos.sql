-- ───────────────────────────────────────────────────────────────────────────
-- Notificações dirigidas por evento (in-app, sino do topo)
-- Aplicado como migration: notificacoes_trigger_mensagem
--
-- Antes: `notificacoes` só nascia pelo cron de Automações (avisos por data/estado).
-- Agora ações reais geram aviso imediato:
--   • Nova mensagem  → trigger AFTER INSERT em `mensagens` (writer-agnostic, pois o
--                      front insere via RLS direto) → notifica o OUTRO participante,
--                      com link p/ o inbox do papel certo (/painel vs /client).
--   • Resposta do dono a avaliação → INSERT best-effort no PATCH /api/avaliacoes
--                      → notifica o autor (link /client/avaliacoes).
--
-- O sino (components/NotificationBell.tsx) já lê `notificacoes` por usuario_id e
-- navega pelo campo `link`. urgencia='info' respeita o CHECK existente.
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
  if v_dest is null then return NEW; end if;

  insert into public.notificacoes (usuario_id, tipo, titulo, corpo, link, urgencia, origem, lida)
  values (v_dest, 'mensagem', 'Nova mensagem', left(NEW.text, 140), v_link, 'info', 'chat', false);
  return NEW;
end;
$$;

drop trigger if exists trg_mensagem_notifica on public.mensagens;
create trigger trg_mensagem_notifica
after insert on public.mensagens
for each row execute function public.tg_mensagem_notifica();

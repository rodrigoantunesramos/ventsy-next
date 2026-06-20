-- ───────────────────────────────────────────────────────────────────────────
-- Chat cliente ↔ proprietário — fundação de banco
-- Aplicado como migration: conversas_chat_realtime_e_ultima_mensagem
--
-- Por quê no banco (e não na API):
--   O front insere em `mensagens` direto via RLS (a área do cliente e o inbox do
--   painel do dono). Logo, manter `conversas.ultima_mensagem` em dia tem de ser
--   responsabilidade do BANCO — writer-agnostic. A antiga POST /api/mensagens
--   (que fazia esse update) nunca foi ligada ao front e ficou órfã.
--
-- Realtime:
--   O hook useChat já se inscrevia em postgres_changes, mas `mensagens`/`conversas`
--   não estavam na publication `supabase_realtime` — por isso o "tempo real" não
--   chegava. Aqui habilitamos as duas tabelas e usamos REPLICA IDENTITY FULL para
--   que filtros por owner_id/user_id funcionem também em UPDATE (lista/inbox).
--
-- Segurança: a RLS de `conversas`/`mensagens` já autoriza os dois lados
--   (user_id = hóspede, owner_id = anfitrião). O Realtime respeita essa RLS.
-- ───────────────────────────────────────────────────────────────────────────

-- 1) Resumo da conversa sempre atualizado a cada nova mensagem.
create or replace function public.tg_conversa_ultima_mensagem()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversas
     set ultima_mensagem = left(NEW.text, 140),
         ultima_mensagem_em = coalesce(NEW.created_at, now())
   where id = NEW.conversation_id;
  return NEW;
end;
$$;

drop trigger if exists trg_conversa_ultima_mensagem on public.mensagens;
create trigger trg_conversa_ultima_mensagem
after insert on public.mensagens
for each row execute function public.tg_conversa_ultima_mensagem();

-- 2) Habilita Realtime (postgres_changes) para o chat.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='mensagens') then
      alter publication supabase_realtime add table public.mensagens;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversas') then
      alter publication supabase_realtime add table public.conversas;
    end if;
  end if;
end $$;

-- 3) Filtros de realtime confiáveis em UPDATE.
alter table public.conversas replica identity full;
alter table public.mensagens replica identity full;

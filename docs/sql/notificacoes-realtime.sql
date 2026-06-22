-- Habilita entrega em TEMPO REAL para o sino de notificações (components/NotificationBell.tsx).
-- Sem isto, o componente cai no polling de segurança (a cada 2 min) e continua
-- funcionando — porém sem o "na hora". Rode uma vez no projeto Supabase.
--
-- Idempotente: só adiciona a tabela à publication se ainda não estiver lá.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notificacoes'
  ) then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
end $$;

-- Observações de segurança:
--  • O Realtime RESPEITA a RLS da tabela: cada dono só recebe os eventos das
--    suas próprias linhas (o componente também filtra por usuario_id=eq.<uid>).
--    Garanta que `notificacoes` tenha RLS habilitada com política do dono
--    (usuario_id = auth.uid()) — o sino já lê via RLS.
--  • REPLICA IDENTITY default (PK) basta: lemos apenas `payload.new` em
--    INSERT/UPDATE. Se um dia precisar do `payload.old` completo, use:
--    -- alter table public.notificacoes replica identity full;

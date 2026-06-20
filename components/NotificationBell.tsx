'use client';

// Sino de notificações do topo do painel (central in-app).
// Lê `notificacoes` do dono via RLS, mostra a contagem de não lidas e um menu com
// as mais recentes — marca lida ao abrir o link e oferece "marcar todas". Degrada
// em silêncio se a tabela ainda não existe (módulo Automações não ativado) ou se
// o usuário está deslogado: o sino some, sem quebrar o layout. Conteúdo completo
// fica em /painel/automacoes?tab=notificacoes. Sem "R$" — só avisos.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import { formatDateTime } from '@/lib/format';

type Notif = { id: string; tipo: string; titulo: string; corpo: string | null; link: string | null; urgencia: string; lida: boolean; criado_em: string };

const SEL = 'id,tipo,titulo,corpo,link,urgencia,lida,criado_em';
const URG_DOT: Record<string, string> = { info: 'bg-sky-500', sucesso: 'bg-emerald-500', alerta: 'bg-amber-500', critico: 'bg-red-500' };

export default function NotificationBell({ verTodasHref = '/painel/automacoes?tab=notificacoes' }: { verTodasHref?: string | null } = {}) {
  const [userId, setUserId] = useState<string | null>(null);
  const [indisponivel, setIndisponivel] = useState(false);   // tabela ausente / deslogado
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const naoLidas = notifs.reduce((s, n) => s + (n.lida ? 0 : 1), 0);

  const carregar = useCallback(async (uid: string) => {
    const { data, error } = await sb.from('notificacoes').select(SEL).eq('usuario_id', uid).order('criado_em', { ascending: false }).limit(12);
    if (error) {
      // PGRST205/42P01 = tabela ainda não criada → esconde o sino.
      if (error.code === 'PGRST205' || error.code === '42P01') setIndisponivel(true);
      return;
    }
    setNotifs((data || []) as Notif[]);
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null;
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setIndisponivel(true); return; }
      const uid = session.user.id;
      setUserId(uid);
      await carregar(uid);
      timer = setInterval(() => carregar(uid), 60000);   // refresca a cada 1 min
    })();
    return () => { if (timer) clearInterval(timer); };
  }, [carregar]);

  // fecha ao clicar fora
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, []);

  async function abrir() {
    const next = !open;
    setOpen(next);
    if (next && userId) await carregar(userId);
  }
  async function marcarLida(n: Notif) {
    if (n.lida) return;
    setNotifs((prev) => prev.map((x) => (x.id === n.id ? { ...x, lida: true } : x)));
    await sb.from('notificacoes').update({ lida: true }).eq('id', n.id);
  }
  async function marcarTodas() {
    if (!userId || !naoLidas) return;
    setNotifs((prev) => prev.map((x) => ({ ...x, lida: true })));
    await sb.from('notificacoes').update({ lida: true }).eq('usuario_id', userId).eq('lida', false);
  }

  if (indisponivel) return null;

  return (
    <div ref={ref} className="relative">
      <button onClick={abrir} aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ''}`}
        className="relative flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink-soft hover:bg-black/[0.04]">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {naoLidas > 0 && (
          <span className="absolute right-1 top-1 flex min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[0.6rem] font-bold leading-[16px] text-white">
            {naoLidas > 9 ? '9+' : naoLidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[46px] z-[200] w-[330px] overflow-hidden rounded-xl border border-black/[0.06] bg-white shadow-pop">
          <div className="flex items-center justify-between border-b border-black/[0.06] px-4 py-2.5">
            <span className="text-sm font-bold text-ink">Notificações</span>
            {naoLidas > 0 && <button onClick={marcarTodas} className="text-xs font-semibold text-brand hover:underline">Marcar todas</button>}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm font-semibold text-ink">Tudo limpo por aqui</p>
                <p className="mt-0.5 text-xs text-ink-muted">Seus avisos e lembretes aparecem aqui.</p>
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {notifs.map((n) => {
                  const inner = (
                    <div className={`flex gap-2.5 px-4 py-2.5 ${n.lida ? '' : 'bg-brand-50/40'}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${URG_DOT[n.urgencia] || 'bg-sky-500'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-ink">{n.titulo}</div>
                        {n.corpo && <div className="mt-0.5 line-clamp-2 text-xs text-ink-soft">{n.corpo}</div>}
                        <div className="mt-0.5 text-[0.66rem] text-ink-muted">{formatDateTime(n.criado_em)}</div>
                      </div>
                    </div>
                  );
                  if (n.link && n.link.startsWith('http')) {
                    return <li key={n.id}><a href={n.link} target="_blank" rel="noreferrer" onClick={() => marcarLida(n)} className="block hover:bg-black/[0.02]">{inner}</a></li>;
                  }
                  if (n.link) {
                    return <li key={n.id}><Link href={n.link} onClick={() => { marcarLida(n); setOpen(false); }} className="block hover:bg-black/[0.02]">{inner}</Link></li>;
                  }
                  return <li key={n.id}><button onClick={() => marcarLida(n)} className="block w-full text-left hover:bg-black/[0.02]">{inner}</button></li>;
                })}
              </ul>
            )}
          </div>

          {verTodasHref && (
            <Link href={verTodasHref} onClick={() => setOpen(false)}
              className="block border-t border-black/[0.06] px-4 py-2.5 text-center text-sm font-semibold text-brand hover:bg-brand-50/50">
              Ver todas
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

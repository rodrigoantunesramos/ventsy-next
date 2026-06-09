'use client';

// Ilha interativa da lista pública — curtir / salvar / seguir autor / compartilhar.
// Self-contained: o route group (public) não tem ToastProvider, então o feedback é
// inline. Persiste via RLS (listas_interacoes: o usuário só mexe nas PRÓPRIAS
// interações) e os contadores curtidas/salvos são recomputados por TRIGGER no banco
// (aqui a atualização é só otimista). Exige login: sem sessão, manda para /login.

import { useEffect, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';

type Tipo = 'curtir' | 'salvar' | 'seguir';

export default function Interacoes({
  listaId, autorId, slug, titulo, curtidas, salvos,
}: {
  listaId: string;
  autorId: string;
  slug: string;
  titulo: string;
  curtidas: number;
  salvos: number;
}) {
  const [uid, setUid] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [following, setFollowing] = useState(false);
  const [nCurtidas, setNCurtidas] = useState(curtidas);
  const [nSalvos, setNSalvos] = useState(salvos);
  const [busy, setBusy] = useState<Tipo | ''>('');
  const [flash, setFlash] = useState('');

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      const u = session?.user?.id ?? null;
      setUid(u);
      if (!u) return;
      const { data } = await sb
        .from('listas_interacoes')
        .select('tipo,lista_id,autor_id')
        .eq('user_id', u)
        .or(`lista_id.eq.${listaId},autor_id.eq.${autorId}`);
      const rows = (data || []) as { tipo: Tipo; lista_id: string | null; autor_id: string | null }[];
      setLiked(rows.some((r) => r.tipo === 'curtir' && r.lista_id === listaId));
      setSaved(rows.some((r) => r.tipo === 'salvar' && r.lista_id === listaId));
      setFollowing(rows.some((r) => r.tipo === 'seguir' && r.autor_id === autorId));
    })();
  }, [listaId, autorId]);

  function dica(msg: string) { setFlash(msg); setTimeout(() => setFlash(''), 2200); }

  async function toggle(tipo: Tipo) {
    if (!uid) { window.location.href = `/login?redirect=${encodeURIComponent('/listas/' + slug)}`; return; }
    if (busy) return;
    setBusy(tipo);
    try {
      if (tipo === 'curtir' || tipo === 'salvar') {
        const on = tipo === 'curtir' ? liked : saved;
        const setOn = tipo === 'curtir' ? setLiked : setSaved;
        const setN = tipo === 'curtir' ? setNCurtidas : setNSalvos;
        if (on) {
          await sb.from('listas_interacoes').delete().eq('user_id', uid).eq('lista_id', listaId).eq('tipo', tipo);
          setOn(false); setN((n) => Math.max(0, n - 1));
        } else {
          const { error } = await sb.from('listas_interacoes').insert({ lista_id: listaId, user_id: uid, tipo });
          if (error) throw error;
          setOn(true); setN((n) => n + 1);
          dica(tipo === 'curtir' ? 'Curtida!' : 'Lista salva no seu perfil.');
        }
      } else {
        if (following) {
          await sb.from('listas_interacoes').delete().eq('user_id', uid).eq('autor_id', autorId).eq('tipo', 'seguir');
          setFollowing(false);
        } else {
          const { error } = await sb.from('listas_interacoes').insert({ autor_id: autorId, user_id: uid, tipo: 'seguir' });
          if (error) throw error;
          setFollowing(true); dica('Você está seguindo este autor.');
        }
      }
    } catch {
      dica('Não foi possível registrar. Tente de novo.');
    } finally {
      setBusy('');
    }
  }

  async function compartilhar() {
    const url = `${window.location.origin}/listas/${slug}`;
    // Web Share quando disponível (mobile), senão copia para a área de transferência.
    const nav = navigator as Navigator & { share?: (d: { title: string; url: string }) => Promise<void> };
    if (nav.share) { try { await nav.share({ title: titulo, url }); return; } catch { /* cancelado */ } }
    try { await navigator.clipboard.writeText(url); dica('Link copiado!'); }
    catch { dica(url); }
  }

  const ehAutor = uid != null && uid === autorId;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn onClick={() => toggle('curtir')} active={liked} busy={busy === 'curtir'} icon={<IcoHeart filled={liked} />} label={`${nCurtidas}`} title="Curtir" />
      <Btn onClick={() => toggle('salvar')} active={saved} busy={busy === 'salvar'} icon={<IcoBookmark filled={saved} />} label={saved ? 'Salva' : 'Salvar'} title="Salvar" />
      {!ehAutor && (
        <Btn onClick={() => toggle('seguir')} active={following} busy={busy === 'seguir'} icon={<IcoUserPlus />} label={following ? 'Seguindo' : 'Seguir autor'} title="Seguir autor" />
      )}
      <button onClick={compartilhar} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2 text-sm font-medium text-ink-soft hover:border-brand/40 hover:text-brand">
        <IcoShare /> Compartilhar
      </button>
      {flash && <span className="text-xs font-semibold text-emerald-600" role="status">{flash}</span>}
    </div>
  );
}

function Btn({ onClick, active, busy, icon, label, title }: { onClick: () => void; active: boolean; busy: boolean; icon: React.ReactNode; label: string; title: string }) {
  return (
    <button onClick={onClick} disabled={busy} title={title} className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-semibold transition disabled:opacity-50 ${active ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-soft hover:border-brand/40 hover:text-brand'}`}>
      {icon} {label}
    </button>
  );
}

function IcoHeart({ filled }: { filled: boolean }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>; }
function IcoBookmark({ filled }: { filled: boolean }) { return <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /></svg>; }
function IcoUserPlus() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM19 8v6M22 11h-6" /></svg>; }
function IcoShare() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8M16 6l-4-4-4 4M12 2v14" /></svg>; }

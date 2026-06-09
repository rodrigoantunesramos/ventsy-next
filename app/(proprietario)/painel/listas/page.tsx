'use client';

// Listas Oficiais (comunidade) · /painel/listas.
// Curadoria de listas de lugares/fornecedores recomendados ("Melhores espaços
// para casamento em SP"), gerando comunidade, descoberta e SEO. O dono cria/edita
// suas listas (título, capa, categoria, itens — propriedades da plataforma OU
// itens externos, com nota de curadoria e comentário) e publica para a página
// pública (public)/listas[/slug]. Curtidas/salvos/itens são contadores de banco
// (trigger). CRUD via RLS (o dono só mexe nas próprias linhas). i18n via lib/format
// (sem "R$"). Fonte: tabelas listas/listas_itens/listas_interacoes.

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatNumber, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Lista, agregado, categoriaLabel, isMissingTable, normLista,
} from './_lib';
import { Editor } from './_components/Editor';

export default function ListasPage() {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [autorNome, setAutorNome] = useState('');

  const [listas, setListas] = useState<Lista[]>([]);
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState<'' | 'publica' | 'rascunho'>('');

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Lista | null>(null);

  const carregar = useCallback(async (uid: string) => {
    const { data, error } = await sb.from('listas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false });
    if (isMissingTable(error)) { setNeedsSetup(true); setListas([]); return; }
    setNeedsSetup(false);
    setListas(((data || []) as unknown[]).map(normLista));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { router.replace('/login'); return; }
      const uid = session.user.id;
      setUserId(uid);
      try {
        const { data: u } = await sb.from('usuarios').select('nome').eq('id', uid).maybeSingle();
        setAutorNome((u?.nome || session.user.email || '').toString());
      } catch { /* nome opcional */ }
      await carregar(uid);
      setLoading(false);
    })();
  }, [carregar, router]);

  const agg = useMemo(() => agregado(listas), [listas]);

  const filtradas = useMemo(() => {
    let arr = listas;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((l) => l.titulo.toLowerCase().includes(q) || (l.cidade || '').toLowerCase().includes(q));
    if (fStatus === 'publica') arr = arr.filter((l) => l.publica);
    if (fStatus === 'rascunho') arr = arr.filter((l) => !l.publica);
    return arr;
  }, [listas, busca, fStatus]);
  const temFiltro = !!(busca || fStatus);

  function abrirNova() { setEditing(null); setEditorOpen(true); }
  function abrirEdicao(l: Lista) { setEditing(l); setEditorOpen(true); }

  async function alternarPublica(l: Lista) {
    const novo = !l.publica;
    setListas((prev) => prev.map((x) => (x.id === l.id ? { ...x, publica: novo } : x)));
    const { error } = await sb.from('listas').update({ publica: novo }).eq('id', l.id);
    if (error) { toast.error('Não foi possível alterar a visibilidade.'); await carregar(userId!); }
    else toast.success(novo ? 'Lista publicada.' : 'Lista despublicada (rascunho).');
  }

  async function copiarLink(l: Lista) {
    const url = `${window.location.origin}/listas/${l.slug}`;
    try { await navigator.clipboard.writeText(url); toast.success('Link público copiado.'); }
    catch { toast.info(url); }
  }

  async function excluir(l: Lista) {
    if (!confirm(`Excluir a lista "${l.titulo}" e todos os seus itens? Esta ação não pode ser desfeita.`)) return;
    setListas((prev) => prev.filter((x) => x.id !== l.id));
    const { error } = await sb.from('listas').delete().eq('id', l.id);
    if (error) { toast.error('Falha ao excluir.'); await carregar(userId!); }
    else toast.success('Lista excluída.');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Listas Oficiais</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-muted">Curadoria de lugares e fornecedores recomendados. Monte listas, publique para a comunidade e gere tráfego para os anúncios. Veja a vitrine pública em <Link href="/listas" className="font-semibold text-brand underline">ventsy/listas</Link>.</p>
        </div>
        {!needsSetup && (
          <button onClick={abrirNova} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova lista</button>
        )}
      </div>

      {needsSetup && (
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"><IcoList size={22} /></div>
          <h3 className="text-base font-bold text-ink">Ative o módulo de Listas</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">As tabelas <code className="rounded bg-black/[0.06] px-1">listas</code>, <code className="rounded bg-black/[0.06] px-1">listas_itens</code> e <code className="rounded bg-black/[0.06] px-1">listas_interacoes</code> ainda não existem neste ambiente. Rode <code className="rounded bg-black/[0.06] px-1">docs/sql/listas.sql</code> no Supabase para começar.</p>
        </div>
      )}

      {!needsSetup && (
        <>
          {/* KPIs */}
          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Listas" value={formatNumber(agg.total)} foot={<>{formatNumber(agg.publicas)} pública(s)</>} />
            <Kpi label="Itens curados" value={formatNumber(agg.itens)} foot={<>em todas as listas</>} />
            <Kpi label="Curtidas" value={formatNumber(agg.curtidas)} foot={<>da comunidade</>} />
            <Kpi label="Salvamentos" value={formatNumber(agg.salvos)} foot={<>alcance {formatNumber(agg.curtidas + agg.salvos)}</>} />
          </div>

          {/* Filtros */}
          {listas.length > 0 && (
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar lista por título ou cidade…" className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 pl-9 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              </div>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value as '' | 'publica' | 'rascunho')} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none" aria-label="Filtrar por status">
                <option value="">Todas</option>
                <option value="publica">Publicadas</option>
                <option value="rascunho">Rascunhos</option>
              </select>
              {temFiltro && <button onClick={() => { setBusca(''); setFStatus(''); }} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-brand">Limpar</button>}
            </div>
          )}

          {/* Grid de listas */}
          <div className="mt-4">
            {filtradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-black/10 bg-white py-14 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoList size={22} /></div>
                <h3 className="text-base font-bold text-ink">{listas.length ? 'Nenhuma lista com esses filtros' : 'Crie sua primeira lista'}</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">{listas.length ? 'Ajuste a busca ou os filtros acima.' : 'Reúna os melhores espaços e fornecedores num guia que a comunidade vai querer salvar e compartilhar.'}</p>
                {!listas.length && <button onClick={abrirNova} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova lista</button>}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filtradas.map((l) => (
                  <div key={l.id} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-card transition hover:shadow-pop">
                    {/* Capa */}
                    <div className="relative h-32 w-full overflow-hidden bg-gradient-to-br from-brand-50 to-amber-50">
                      {l.capa_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={l.capa_url} alt="" className="h-full w-full object-cover" />
                        : <div className="flex h-full w-full items-center justify-center text-brand/40"><IcoList size={34} /></div>}
                      <span className={`absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${l.publica ? 'bg-emerald-500 text-white' : 'bg-black/60 text-white'}`}>{l.publica ? 'Publicada' : 'Rascunho'}</span>
                    </div>
                    {/* Corpo */}
                    <div className="flex min-h-0 flex-1 flex-col p-4">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {l.categoria && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-semibold text-brand">{categoriaLabel(l.categoria)}</span>}
                        {l.cidade && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-semibold text-ink-soft">{l.cidade}</span>}
                      </div>
                      <h3 className="mt-2 line-clamp-2 font-bold leading-snug text-ink">{l.titulo}</h3>
                      {l.descricao && <p className="mt-1 line-clamp-2 text-sm text-ink-muted">{l.descricao}</p>}
                      <div className="mt-3 flex items-center gap-3 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1"><IcoList size={13} /> {formatNumber(l.n_itens)} itens</span>
                        <span className="inline-flex items-center gap-1"><IcoHeart /> {formatNumber(l.curtidas)}</span>
                        <span className="inline-flex items-center gap-1"><IcoBookmark /> {formatNumber(l.salvos)}</span>
                      </div>
                      <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-3">
                        <span className="text-[0.7rem] text-ink-muted">{formatDate(l.criado_em, { style: 'short' })}</span>
                        <div className="flex items-center gap-1">
                          {l.publica && <a href={`/listas/${l.slug}`} target="_blank" rel="noreferrer" title="Ver pública" aria-label="Ver pública" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoExternal /></a>}
                          {l.publica && <button onClick={() => copiarLink(l)} title="Copiar link" aria-label="Copiar link" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoLink /></button>}
                          <button onClick={() => alternarPublica(l)} title={l.publica ? 'Despublicar' : 'Publicar'} aria-label={l.publica ? 'Despublicar' : 'Publicar'} className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEye on={l.publica} /></button>
                          <button onClick={() => abrirEdicao(l)} title="Editar" aria-label="Editar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                          <button onClick={() => excluir(l)} title="Excluir" aria-label="Excluir" className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {editorOpen && userId && (
        <Editor
          inicial={editing}
          userId={userId}
          autorNome={autorNome}
          onClose={() => { setEditorOpen(false); setEditing(null); }}
          onSaved={() => carregar(userId)}
        />
      )}
    </div>
  );
}

// ── KPI card ──
function Kpi({ label, value, foot }: { label: string; value: string; foot?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-1 text-2xl font-bold text-ink">{value}</div>
      {foot && <div className="mt-0.5 text-xs text-ink-muted">{foot}</div>}
    </div>
  );
}

// ── Ícones ──
function IcoList({ size = 16 }: { size?: number }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>; }
function IcoPlus() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>; }
function IcoSearch() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>; }
function IcoHeart() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" /></svg>; }
function IcoBookmark() { return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z" /></svg>; }
function IcoExternal() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>; }
function IcoLink() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>; }
function IcoEye({ on }: { on: boolean }) { return on ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></svg> : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.4 0 10 7 10 7a18 18 0 0 1-3 3.7M6.6 6.6A18 18 0 0 0 2 11s3.6 7 10 7a10.9 10.9 0 0 0 4.1-.8M3 3l18 18M9.5 9.5a3 3 0 0 0 4 4" /></svg>; }
function IcoEdit() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>; }
function IcoTrash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" /></svg>; }

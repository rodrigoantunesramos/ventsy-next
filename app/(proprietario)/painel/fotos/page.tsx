'use client';

// Fotos — /painel/fotos (premium).
// Abas Espaço / Eventos / Vídeos. Upload com compressão (WebP) + drag-drop + progresso.
// Arrastar para ordenar (espaço), ações em massa, limite por plano + upgrade,
// vídeos/Tour 360º (Ultra) e prévia da página pública.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { comprimirImagem, uploadComProgresso } from '@/lib/imageUpload';

type Foto = { id: string; url: string | null; ordem: number | null; secao: string | null; tipo: string | null; focal_x: number | null; focal_y: number | null; alt: string | null };
type Video = { id: string | number; url: string | null; titulo: string | null };

const LIMITES: Record<string, number | null> = { basico: 5, pro: null, ultra: null };
const AMBIENTES = ['Destaque', 'Salão principal', 'Área externa', 'Cozinha / Buffet', 'Piscina', 'Banheiros', 'Quartos / Suítes', 'Estacionamento', 'Decoração', 'Outros'];
const EVENTOS_SEC = ['Casamentos', 'Corporativo', 'Aniversários', 'Formaturas', 'Festas', 'Outros'];

export default function FotosPage() {
  const [loading, setLoading] = useState(true);
  const [propId, setPropId] = useState<number | null>(null);
  const [plano, setPlano] = useState('basico');
  const [verificada, setVerificada] = useState(false);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [videos, setVideos] = useState<Video[]>([]);
  const [tab, setTab] = useState<'espaco' | 'eventos' | 'videos'>('espaco');
  const [erro, setErro] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState(false);
  const [progress, setProgress] = useState<{ total: number; done: number; pct: number } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHover, setDropHover] = useState(false);
  const [focoId, setFocoId] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [vUrl, setVUrl] = useState('');
  const [vTitulo, setVTitulo] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(async (pid: number) => {
    const [{ data: fts }, { data: vds }] = await Promise.all([
      sb.from('fotos_imovel').select('id,url,ordem,secao,tipo,focal_x,focal_y,alt').eq('propriedade_id', pid).order('ordem', { ascending: true }),
      sb.from('videos_propriedade').select('*').eq('propriedade_id', pid),
    ]);
    setFotos((fts || []) as Foto[]);
    setVideos((vds || []) as Video[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data: props } = await sb.from('propriedades').select('id, fotos_verificadas').eq('usuario_id', session.user.id).order('id').limit(1);
      const pid = props?.[0]?.id ?? null;
      setPropId(pid);
      setVerificada(!!props?.[0]?.fotos_verificadas);
      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', session.user.id).maybeSingle();
        const p = (a?.plano_ativo || 'basico').toLowerCase();
        if (['basico', 'pro', 'ultra'].includes(p)) setPlano(p);
      } catch { /* basico */ }
      if (pid) await carregar(pid);
      setLoading(false);
    })();
  }, [carregar]);

  const espaco = useMemo(() => fotos.filter((f) => !f.tipo || f.tipo === 'espaco'), [fotos]);
  const eventos = useMemo(() => fotos.filter((f) => f.tipo === 'evento'), [fotos]);
  const limite = LIMITES[plano];
  const noLimite = limite != null && espaco.length >= limite;
  const eventosPorSecao = useMemo(() => {
    const m = new Map<string, Foto[]>();
    eventos.forEach((f) => { const k = f.secao || 'Eventos'; if (!m.has(k)) m.set(k, []); m.get(k)!.push(f); });
    return [...m.entries()];
  }, [eventos]);

  // ── Upload (compressão + progresso) ──
  const enviar = useCallback(async (fileList: FileList | File[] | null) => {
    if (!propId || !fileList) return;
    const arr = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setErro(null); setUpgrade(false);
    if (tab === 'espaco' && limite != null && espaco.length + arr.length > limite) {
      setUpgrade(true); setErro(`Seu plano ${plano} permite até ${limite} fotos do espaço.`);
      return;
    }
    const total = arr.length;
    setProgress({ total, done: 0, pct: 0 });
    const tipo = tab === 'eventos' ? 'evento' : 'espaco';
    const secaoDefault = tab === 'eventos' ? 'Casamentos' : 'Geral';
    const h = await authHeaders();
    let done = 0;
    for (const file of arr) {
      try {
        const blob = await comprimirImagem(file);
        const fd = new FormData();
        fd.append('propriedadeId', String(propId));
        fd.append('tipo', tipo);
        fd.append('secao', secaoDefault);
        fd.append('files', blob, `${(file.name.replace(/\.\w+$/, '') || 'foto')}.webp`);
        const r = await uploadComProgresso('/api/fotos', fd, h, (frac) => setProgress({ total, done, pct: Math.round(((done + frac) / total) * 100) }));
        if (!r.ok) { if (r.json.code === 'LIMITE_PLANO') setUpgrade(true); throw new Error((r.json.error as string) || 'Falha no upload.'); }
        done++; setProgress({ total, done, pct: Math.round((done / total) * 100) });
      } catch (e) { setErro(e instanceof Error ? e.message : 'Falha no upload.'); break; }
    }
    await carregar(propId);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = '';
  }, [propId, tab, limite, espaco.length, plano, carregar]);

  function onDropFiles(e: React.DragEvent) {
    e.preventDefault(); setDropHover(false);
    if (e.dataTransfer.files?.length) enviar(e.dataTransfer.files);
  }

  // ── Reordenar (arrastar) ──
  async function reordenar(idsEspaco: string[]) {
    const full = [...idsEspaco, ...eventos.map((f) => f.id)];
    const pos = new Map(full.map((id, i) => [id, i]));
    setFotos((prev) => [...prev].map((f) => ({ ...f, ordem: pos.get(f.id) ?? f.ordem })).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)));
    if (propId) await fetch('/api/fotos', { method: 'PATCH', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ propriedadeId: propId, ordem: full }) });
  }
  function soltarSobre(targetId: string) {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = espaco.map((f) => f.id);
    const from = ids.indexOf(dragId); const to = ids.indexOf(targetId);
    setDragId(null);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0]);
    reordenar(ids);
  }

  async function mudarSecao(id: string, secao: string) {
    setFotos((arr) => arr.map((f) => (f.id === id ? { ...f, secao } : f)));
    await fetch('/api/fotos', { method: 'PATCH', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fotoId: id, secao }) });
  }
  async function mudarAlt(id: string, alt: string) {
    setFotos((arr) => arr.map((f) => (f.id === id ? { ...f, alt } : f)));
    await fetch('/api/fotos', { method: 'PATCH', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fotoId: id, alt }) });
  }
  async function definirFoco(id: string, fx: number, fy: number) {
    setFotos((arr) => arr.map((f) => (f.id === id ? { ...f, focal_x: fx, focal_y: fy } : f)));
    setFocoId(null);
    await fetch('/api/fotos', { method: 'PATCH', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fotoId: id, focal_x: fx, focal_y: fy }) });
  }
  async function organizarComIA() {
    const lista = (tab === 'eventos' ? eventos : espaco).filter((f) => f.url).map((f) => ({ id: f.id, url: f.url }));
    if (!lista.length) return;
    setAiBusy(true); setErro(null); setUpgrade(false);
    try {
      const res = await fetch('/api/fotos/ia', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ fotos: lista }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha na IA.');
      const h = await authHeaders();
      for (const r of (json.results || []) as { id: string; categoria: string | null; alt: string | null }[]) {
        const upd: Record<string, unknown> = {};
        if (tab !== 'eventos' && r.categoria) upd.secao = r.categoria;
        if (r.alt) upd.alt = r.alt;
        if (Object.keys(upd).length) await fetch('/api/fotos', { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ fotoId: r.id, ...upd }) });
      }
      if (propId) await carregar(propId);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha na IA.'); } finally { setAiBusy(false); }
  }
  async function remover(id: string) {
    await fetch(`/api/fotos/${id}`, { method: 'DELETE', headers: await authHeaders() });
    setFotos((arr) => arr.filter((f) => f.id !== id));
  }

  // ── Ações em massa ──
  function toggleSel(id: string) { setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; }); }
  async function bulkMover(secao: string) {
    if (!secao) return;
    const ids = [...sel]; const h = await authHeaders();
    setFotos((prev) => prev.map((f) => (sel.has(f.id) ? { ...f, secao } : f))); setSel(new Set());
    for (const id of ids) await fetch('/api/fotos', { method: 'PATCH', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ fotoId: id, secao }) });
  }
  async function bulkExcluir() {
    if (!confirm(`Excluir ${sel.size} foto(s)?`)) return;
    const ids = [...sel]; const h = await authHeaders(); setSel(new Set());
    for (const id of ids) await fetch(`/api/fotos/${id}`, { method: 'DELETE', headers: h });
    if (propId) await carregar(propId);
  }

  // ── Vídeos ──
  async function addVideo() {
    if (!propId || !vUrl.trim()) return;
    setVBusy(true); setErro(null);
    try {
      const res = await fetch('/api/videos', { method: 'POST', headers: { ...(await authHeaders()), 'Content-Type': 'application/json' }, body: JSON.stringify({ propriedadeId: propId, url: vUrl.trim(), titulo: vTitulo.trim() }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha ao adicionar vídeo.');
      setVUrl(''); setVTitulo(''); if (propId) await carregar(propId);
    } catch (e) { setErro(e instanceof Error ? e.message : 'Falha ao adicionar vídeo.'); } finally { setVBusy(false); }
  }
  async function removeVideo(id: string | number) {
    await fetch(`/api/videos?id=${id}`, { method: 'DELETE', headers: await authHeaders() });
    setVideos((arr) => arr.filter((v) => v.id !== id));
  }

  if (loading) return <div className="mx-auto h-[460px] max-w-5xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  if (!propId) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Fotos</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <p className="mb-4 text-sm text-ink-soft">Cadastre sua propriedade para adicionar fotos.</p>
          <Link href="/anunciar" className="inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">Anunciar meu espaço →</Link>
        </div>
      </div>
    );
  }

  const secoesAtuais = tab === 'eventos' ? EVENTOS_SEC : AMBIENTES;

  return (
    <div className="mx-auto max-w-5xl pb-20">
      <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => enviar(e.target.files)} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Fotos</h1>
          <p className="mt-1 text-sm text-ink-muted">Boas fotos atraem muito mais contatos. Arraste para ordenar; a 1ª é a capa.</p>
        </div>
        <div className="flex items-center gap-2">
          {verificada && <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">✓ Verificadas</span>}
          <span className="rounded-full border border-brand/20 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand">
            Plano {plano} · {limite == null ? `${espaco.length} fotos` : `${espaco.length}/${limite} fotos`}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1.5 border-b border-black/[0.06]">
        {([['espaco', 'Fotos do Espaço'], ['eventos', 'Fotos de Eventos'], ['videos', 'Vídeos / Tour 360°']] as const).map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id); setSel(new Set()); }} className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${tab === id ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>{label}{id === 'videos' && <span className="ml-1 text-[0.6rem] uppercase text-amber-500">Ultra</span>}</button>
        ))}
      </div>

      {/* VÍDEOS */}
      {tab === 'videos' ? (
        <VideosTab plano={plano} videos={videos} vUrl={vUrl} vTitulo={vTitulo} vBusy={vBusy} setVUrl={setVUrl} setVTitulo={setVTitulo} onAdd={addVideo} onRemove={removeVideo} />
      ) : (
        <>
          {/* Barra de upload + limite */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink">{tab === 'espaco' ? 'Galeria do espaço' : 'Fotos de eventos'}</p>
              <p className="text-xs text-ink-muted">{tab === 'espaco' ? (limite != null ? `Plano ${plano}: ${espaco.length} de ${limite}. Fotos comprimidas automaticamente.` : 'Fotos ilimitadas. Comprimidas automaticamente.') : 'Mostre o espaço montado em eventos — vira cards de destaque no anúncio.'}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={organizarComIA} disabled={aiBusy || (tab === 'eventos' ? eventos : espaco).length === 0} className="rounded-xl border border-brand/30 bg-brand-50 px-4 py-2.5 text-sm font-semibold text-brand transition hover:bg-brand-100 disabled:opacity-50">{aiBusy ? 'Analisando…' : '✨ Organizar com IA'}</button>
              {tab === 'espaco' && noLimite ? (
                <Link href="/painel/planos" className="rounded-xl bg-gradient-to-r from-amber-500 to-brand px-5 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90">⭐ Fazer upgrade para mais fotos</Link>
              ) : (
                <button onClick={() => inputRef.current?.click()} disabled={!!progress} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">+ Adicionar fotos</button>
              )}
            </div>
          </div>

          {/* Progresso de upload */}
          {progress && (
            <div className="mt-2">
              <div className="mb-1 flex justify-between text-xs text-ink-muted"><span>Enviando {progress.done}/{progress.total}…</span><span>{progress.pct}%</span></div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${progress.pct}%` }} /></div>
            </div>
          )}
          {/* Barra do limite (basico) */}
          {tab === 'espaco' && limite != null && !progress && (
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-black/[0.06]"><div className={`h-full rounded-full transition-all ${noLimite ? 'bg-amber-500' : 'bg-brand'}`} style={{ width: `${Math.min(100, Math.round((espaco.length / limite) * 100))}%` }} /></div>
          )}

          {erro && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{erro}{upgrade && <> <Link href="/painel/planos" className="font-bold text-brand underline">Ver planos →</Link></>}{erro.includes('Integrações') && <> <Link href="/painel/configuracoes" className="font-bold text-brand underline">Abrir Integrações →</Link></>}</div>}

          {/* Conteúdo */}
          {tab === 'espaco' ? (
            espaco.length === 0 ? (
              <DropEmpty onClick={() => inputRef.current?.click()} onDrop={onDropFiles} onOver={setDropHover} hover={dropHover} icon="🖼️" label="Arraste as fotos do espaço aqui ou clique para enviar" />
            ) : (
              <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
                <div onDragOver={(e) => { e.preventDefault(); }} onDrop={onDropFiles}>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    {espaco.map((f, i) => (
                      <Card key={f.id} foto={f} capa={i === 0} secoes={AMBIENTES} selecionada={sel.has(f.id)} onToggleSel={() => toggleSel(f.id)}
                        onSecao={(s) => mudarSecao(f.id, s)} onAlt={(s) => mudarAlt(f.id, s)} onRemover={() => remover(f.id)}
                        foco={focoId === f.id} onToggleFoco={() => setFocoId(focoId === f.id ? null : f.id)} onSetFocal={(x, y) => definirFoco(f.id, x, y)}
                        draggable onDragStart={() => setDragId(f.id)} onDropCard={() => soltarSobre(f.id)} arrastando={dragId === f.id} />
                    ))}
                  </div>
                  <p className="mt-3 text-center text-xs text-ink-muted">Arraste as fotos para reordenar. A primeira é a capa do anúncio.</p>
                </div>
                <PreviewPublico fotos={espaco} />
              </div>
            )
          ) : (
            eventos.length === 0 ? (
              <DropEmpty onClick={() => inputRef.current?.click()} onDrop={onDropFiles} onOver={setDropHover} hover={dropHover} icon="🎉" label="Arraste fotos de eventos aqui ou clique para enviar" />
            ) : (
              <div className="mt-6 space-y-6" onDragOver={(e) => { e.preventDefault(); }} onDrop={onDropFiles}>
                {eventosPorSecao.map(([secName, items]) => (
                  <div key={secName}>
                    <div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-bold text-ink">{secName}</h3><div className="h-px flex-1 bg-black/[0.06]" /><span className="text-xs text-ink-muted">{items.length}</span></div>
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {items.map((f) => (
                        <Card key={f.id} foto={f} secoes={EVENTOS_SEC} selecionada={sel.has(f.id)} onToggleSel={() => toggleSel(f.id)} onSecao={(s) => mudarSecao(f.id, s)} onAlt={(s) => mudarAlt(f.id, s)} onRemover={() => remover(f.id)}
                          foco={focoId === f.id} onToggleFoco={() => setFocoId(focoId === f.id ? null : f.id)} onSetFocal={(x, y) => definirFoco(f.id, x, y)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
        </>
      )}

      {/* Barra de ações em massa */}
      {sel.size > 0 && tab !== 'videos' && (
        <div className="fixed bottom-4 left-1/2 z-[200] flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-pop">
          <span className="text-sm font-semibold text-ink">{sel.size} selecionada(s)</span>
          <select onChange={(e) => { bulkMover(e.target.value); e.currentTarget.selectedIndex = 0; }} className="rounded-xl border border-black/10 px-3 py-2 text-sm focus:outline-none">
            <option value="">Mover para seção…</option>
            {secoesAtuais.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button onClick={bulkExcluir} className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100">Excluir</button>
          <button onClick={() => setSel(new Set())} className="text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
        </div>
      )}
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function DropEmpty({ onClick, onDrop, onOver, hover, icon, label }: { onClick: () => void; onDrop: (e: React.DragEvent) => void; onOver: (v: boolean) => void; hover: boolean; icon: string; label: string }) {
  return (
    <div
      onClick={onClick}
      onDragOver={(e) => { e.preventDefault(); onOver(true); }}
      onDragLeave={() => onOver(false)}
      onDrop={onDrop}
      className={`mt-6 flex w-full cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-12 text-center transition ${hover ? 'border-brand bg-brand-50' : 'border-black/15 bg-white hover:border-brand'}`}
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className="text-xs text-ink-muted">JPG ou PNG · comprimimos automaticamente</span>
    </div>
  );
}

function Card({ foto, capa, secoes, selecionada, onToggleSel, onSecao, onAlt, onRemover, foco, onToggleFoco, onSetFocal, draggable, onDragStart, onDropCard, arrastando }: {
  foto: Foto; capa?: boolean; secoes: string[]; selecionada: boolean; onToggleSel: () => void; onSecao: (s: string) => void; onAlt: (s: string) => void; onRemover: () => void;
  foco?: boolean; onToggleFoco?: () => void; onSetFocal?: (x: number, y: number) => void;
  draggable?: boolean; onDragStart?: () => void; onDropCard?: () => void; arrastando?: boolean;
}) {
  const fx = foto.focal_x ?? 50; const fy = foto.focal_y ?? 50;
  return (
    <div
      draggable={draggable && !foco}
      onDragStart={onDragStart}
      onDragOver={draggable ? (e) => e.preventDefault() : undefined}
      onDrop={onDropCard}
      className={`group overflow-hidden rounded-2xl border bg-black/[0.03] shadow-card transition ${selecionada ? 'border-brand ring-2 ring-brand/40' : 'border-black/[0.06]'} ${arrastando ? 'opacity-40' : ''} ${draggable && !foco ? 'cursor-move' : ''}`}
    >
      <div
        className={`relative ${foco ? 'cursor-crosshair ring-2 ring-brand' : ''}`}
        onClick={foco && onSetFocal ? (e) => { const r = e.currentTarget.getBoundingClientRect(); onSetFocal(Math.round(((e.clientX - r.left) / r.width) * 100), Math.round(((e.clientY - r.top) / r.height) * 100)); } : undefined}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={foto.url || ''} alt={foto.alt || foto.secao || 'Foto'} className="aspect-[4/3] w-full object-cover" style={{ objectPosition: `${fx}% ${fy}%` }} />
        <button onClick={(e) => { e.stopPropagation(); onToggleSel(); }} className={`absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border text-xs font-bold transition ${selecionada ? 'border-brand bg-brand text-white' : 'border-white/70 bg-black/30 text-transparent hover:text-white'}`}>✓</button>
        {capa && <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white shadow">★ Capa</span>}
        <span className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow transition-opacity" style={{ left: `${fx}%`, top: `${fy}%`, opacity: foco ? 1 : 0 }} />
        {foco && <div className="pointer-events-none absolute inset-x-0 top-2 text-center text-xs font-semibold text-white drop-shadow">Clique para definir o foco</div>}
        <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 transition-transform group-hover:translate-y-0">
          {onToggleFoco && <button onClick={(e) => { e.stopPropagation(); onToggleFoco(); }} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${foco ? 'bg-brand text-white' : 'bg-white/95 text-ink-soft hover:bg-white'}`}>🎯 Foco</button>}
          <button onClick={(e) => { e.stopPropagation(); onRemover(); }} className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-white">Remover</button>
        </div>
      </div>
      <select value={foto.secao || ''} onChange={(e) => onSecao(e.target.value)} className="w-full border-t border-black/[0.06] bg-white px-2 py-1.5 text-xs font-medium text-ink-soft focus:outline-none">
        <option value="">Sem categoria</option>
        {secoes.map((s) => <option key={s} value={s}>{s}</option>)}
        {foto.secao && !secoes.includes(foto.secao) && <option value={foto.secao}>{foto.secao}</option>}
      </select>
      <input key={foto.alt || 'na'} defaultValue={foto.alt || ''} onBlur={(e) => { if (e.target.value !== (foto.alt || '')) onAlt(e.target.value); }} placeholder="Descrição (alt/SEO)…" className="w-full border-t border-black/[0.06] bg-white px-2 py-1.5 text-xs text-ink-soft placeholder:text-ink-muted/60 focus:outline-none" />
    </div>
  );
}

function PreviewPublico({ fotos }: { fotos: Foto[] }) {
  const cinco = fotos.slice(0, 5);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <h3 className="text-sm font-bold text-ink">Prévia da página pública</h3>
      <p className="mb-3 text-xs text-ink-muted">É assim que a galeria aparece para o cliente.</p>
      <div className="grid aspect-[16/10] grid-cols-4 grid-rows-2 gap-1 overflow-hidden rounded-xl bg-black/[0.04]">
        {cinco.map((f, i) => (
          <div key={f.id} className={`relative ${i === 0 ? 'col-span-2 row-span-2' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url || ''} alt="" className="h-full w-full object-cover" />
            {i === 4 && fotos.length > 5 && <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-bold text-white">+{fotos.length - 4}</div>}
          </div>
        ))}
        {cinco.length === 0 && <div className="col-span-4 row-span-2 flex items-center justify-center text-xs text-ink-muted">Sem fotos</div>}
      </div>
      {fotos.length > 0 && <div className="mt-3 rounded-lg border border-black/10 px-3 py-2 text-center text-xs font-semibold text-ink-soft">⊞ Ver todas as {fotos.length} fotos</div>}
    </div>
  );
}

function VideosTab({ plano, videos, vUrl, vTitulo, vBusy, setVUrl, setVTitulo, onAdd, onRemove }: {
  plano: string; videos: Video[]; vUrl: string; vTitulo: string; vBusy: boolean;
  setVUrl: (v: string) => void; setVTitulo: (v: string) => void; onAdd: () => void; onRemove: (id: string | number) => void;
}) {
  if (plano !== 'ultra') {
    return (
      <div className="mt-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50/50 p-8 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">🎬</div>
        <h2 className="text-lg font-bold text-ink">Vídeos e Tour 360° são exclusivos do plano Ultra</h2>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Mostre seu espaço em movimento e ofereça um tour imersivo — recursos que aumentam muito a conversão.</p>
        <Link href="/painel/planos" className="mt-5 inline-flex rounded-full bg-gradient-to-r from-amber-500 to-brand px-6 py-3 text-sm font-bold text-white hover:opacity-90">⭐ Fazer upgrade para Ultra</Link>
      </div>
    );
  }
  return (
    <div className="mt-6">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="text-sm font-bold text-ink">Adicionar vídeo / Tour 360°</h3>
        <p className="text-xs text-ink-muted">Cole o link do YouTube, Vimeo ou de um vídeo/tour 360°.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <input className={inp} value={vUrl} onChange={(e) => setVUrl(e.target.value)} placeholder="https://…" />
          <input className={inp} value={vTitulo} onChange={(e) => setVTitulo(e.target.value)} placeholder="Título (opcional)" />
          <button onClick={onAdd} disabled={vBusy || !vUrl.trim()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">{vBusy ? 'Adicionando…' : 'Adicionar'}</button>
        </div>
      </div>
      {videos.length === 0 ? (
        <p className="mt-6 text-center text-sm text-ink-muted">Nenhum vídeo ainda.</p>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((v) => (
            <div key={String(v.id)} className="overflow-hidden rounded-2xl bg-white shadow-card">
              <div className="flex aspect-video items-center justify-center bg-black/[0.04] text-3xl">🎬</div>
              <div className="flex items-center justify-between gap-2 p-3">
                <div className="min-w-0"><div className="truncate text-sm font-semibold text-ink">{v.titulo || 'Vídeo'}</div><a href={v.url || '#'} target="_blank" rel="noreferrer" className="truncate text-xs text-brand hover:underline">{v.url}</a></div>
                <button onClick={() => onRemove(v.id)} className="shrink-0 text-ink-muted hover:text-red-600">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

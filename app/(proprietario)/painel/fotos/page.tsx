'use client';

// Fotos — /painel/fotos.
// Galeria do espaço sobre `fotos_imovel` + Storage, usando as rotas /api/fotos
// (POST upload, PATCH reordenar/capa, DELETE /[id]). Capa = primeira (ordem) e
// é sincronizada com propriedades.imagem_url pelo backend.

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';

type Foto = { id: string; url: string | null; ordem: number | null };

export default function FotosPage() {
  const [loading, setLoading] = useState(true);
  const [propId, setPropId] = useState<number | null>(null);
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const carregarFotos = useCallback(async (pid: number) => {
    const { data } = await sb.from('fotos_imovel').select('id,url,ordem').eq('propriedade_id', pid).order('ordem', { ascending: true });
    setFotos((data || []) as Foto[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await sb.from('propriedades').select('id').eq('usuario_id', session.user.id).order('id').limit(1);
      const pid = data?.[0]?.id ?? null;
      setPropId(pid);
      if (pid) await carregarFotos(pid);
      setLoading(false);
    })();
  }, [carregarFotos]);

  async function enviar(files: FileList | null) {
    if (!propId || !files || files.length === 0) return;
    setErro(null);
    setBusy(true);
    const fd = new FormData();
    fd.append('propriedadeId', String(propId));
    Array.from(files).forEach((f) => fd.append('files', f));
    try {
      const res = await fetch('/api/fotos', { method: 'POST', headers: await authHeaders(), body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Falha no upload.');
      await carregarFotos(propId);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha no upload.');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function tornarCapa(id: string) {
    if (!propId) return;
    const ordem = [id, ...fotos.filter((f) => f.id !== id).map((f) => f.id)];
    setBusy(true);
    try {
      await fetch('/api/fotos', {
        method: 'PATCH',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ propriedadeId: propId, ordem }),
      });
      await carregarFotos(propId);
    } finally { setBusy(false); }
  }

  async function remover(id: string) {
    if (!propId) return;
    setBusy(true);
    try {
      await fetch(`/api/fotos/${id}`, { method: 'DELETE', headers: await authHeaders() });
      setFotos((arr) => arr.filter((f) => f.id !== id));
    } finally { setBusy(false); }
  }

  if (loading) return <div className="mx-auto h-[420px] max-w-5xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  if (!propId) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Fotos</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl">📸</div>
          <h2 className="text-lg font-bold text-ink">Cadastre sua propriedade primeiro</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Você precisa ter um espaço cadastrado para adicionar fotos.</p>
          <Link href="/anunciar" className="mt-5 inline-flex rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white hover:bg-brand-600">Anunciar meu espaço →</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Fotos do espaço</h1>
          <p className="mt-1 text-sm text-ink-muted">A primeira foto é a capa do anúncio. Use fotos boas — espaços com fotos recebem muito mais contatos.</p>
        </div>
        <button onClick={() => inputRef.current?.click()} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
          {busy ? 'Enviando…' : '+ Adicionar fotos'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => enviar(e.target.files)} />
      </div>

      {erro && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</div>}

      {fotos.length === 0 ? (
        <button
          onClick={() => inputRef.current?.click()}
          className="mt-6 flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-black/15 bg-white p-12 text-center transition hover:border-brand"
        >
          <span className="text-3xl">🖼️</span>
          <span className="text-sm font-semibold text-ink-soft">Arraste ou clique para enviar fotos</span>
          <span className="text-xs text-ink-muted">JPG ou PNG. A primeira vira a capa.</span>
        </button>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {fotos.map((f, i) => (
            <div key={f.id} className="group relative overflow-hidden rounded-2xl border border-black/[0.06] bg-black/[0.03] shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.url || ''} alt={`Foto ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
              {i === 0 && (
                <span className="absolute left-2 top-2 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white shadow">★ Capa</span>
              )}
              <div className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-center gap-2 bg-gradient-to-t from-black/70 to-transparent p-3 transition-transform group-hover:translate-y-0">
                {i !== 0 && (
                  <button onClick={() => tornarCapa(f.id)} disabled={busy} className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-white disabled:opacity-60">
                    Tornar capa
                  </button>
                )}
                <button onClick={() => remover(f.id)} disabled={busy} className="rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-white disabled:opacity-60">
                  Remover
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

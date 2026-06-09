'use client';

// Modal de DISTRIBUIÇÃO de uma pesquisa (/painel/pesquisas) — gera o link público
// estável (POST /api/pesquisas gerar_link → token assinado) e mostra QR
// (lib/qrcode, dependency-free) + copiar. O evento é opcional: link genérico ou
// link por evento (segmentação). Sem "R$" (lib/format). Fecha com Esc/backdrop.

import { useEffect, useMemo, useState } from 'react';
import { qrSvgString } from '@/lib/qrcode';
import { formatDate } from '@/lib/format';
import { type Pesquisa, type EventoLite } from '@/lib/pesquisas';
import { IcoQr, IcoCopy, IcoCheck } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function eventoLabel(e: EventoLite): string {
  const base = e.nome_evento || e.tipo_evento || e.quem_contratou || 'Evento';
  const d = e.data_inicio ? ` · ${formatDate(e.data_inicio, { style: 'short' })}` : '';
  return base + d;
}

export function DistribuirModal({
  pesquisa, eventos, onClose, onGerarLink,
}: {
  pesquisa: Pesquisa;
  eventos: EventoLite[];
  onClose: () => void;
  onGerarLink: (pesquisaId: string, eventoId: string | null) => Promise<string | null>;
}) {
  const [eventoId, setEventoId] = useState('');
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const url = useMemo(() => (path && typeof window !== 'undefined' ? window.location.origin + path : path || ''), [path]);
  const qr = useMemo(() => (url ? qrSvgString(url, { size: 168 }) : ''), [url]);

  async function gerar() {
    setBusy(true); setCopied(false);
    const p = await onGerarLink(pesquisa.id, eventoId || null);
    setBusy(false);
    setPath(p);
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Distribuir pesquisa</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-black/[0.04] hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Gere o link/QR de <span className="font-semibold text-ink-soft">{pesquisa.titulo}</span>. Vincule a um evento para segmentar as respostas (opcional).</p>

        {!pesquisa.ativo && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Esta pesquisa está inativa — o link não aceitará respostas até você reativá-la.</p>
        )}

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Evento (opcional)</span>
            <select value={eventoId} onChange={(e) => { setEventoId(e.target.value); setPath(null); }} className={inp}>
              <option value="">Link genérico (sem evento)</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{eventoLabel(e)}</option>)}
            </select>
          </label>
          <button onClick={gerar} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            <IcoQr /> {busy ? 'Gerando…' : 'Gerar link & QR'}
          </button>

          {path && (
            <div className="rounded-2xl border border-black/[0.06] bg-black/[0.015] p-4 text-center">
              <div className="mx-auto w-fit rounded-xl bg-white p-2 shadow-card" dangerouslySetInnerHTML={{ __html: qr }} />
              <div className="mt-3 flex items-center gap-2">
                <input readOnly value={url} className={`${inp} text-xs`} onFocus={(e) => e.currentTarget.select()} />
                <button onClick={copiar} className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold hover:bg-black/[0.03]">
                  {copied ? <><IcoCheck /> Copiado</> : <><IcoCopy /> Copiar</>}
                </button>
              </div>
              <p className="mt-2 text-xs text-ink-muted">Compartilhe por WhatsApp/e-mail. O cliente responde sem login; as respostas caem no painel.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

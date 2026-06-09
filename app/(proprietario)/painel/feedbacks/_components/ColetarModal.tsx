'use client';

// Modal de COLETA de feedback (/painel/feedbacks).
//  • Link & QR: gera o link público estável de um evento (POST /api/feedbacks
//    gerar_link → token assinado) e mostra QR (lib/qrcode, dependency-free) + copiar.
//  • Registro manual: o dono lança um feedback recebido por outro canal
//    (presencial/WhatsApp), com nota geral + critérios + comentário.
// Sem "R$" (lib/format). Fecha com Esc e clique no backdrop.

import { useEffect, useMemo, useState } from 'react';
import { qrSvgString } from '@/lib/qrcode';
import { formatDate } from '@/lib/format';
import { type EventoLite, type CanalFeedback, CRITERIOS, CANAIS } from '@/lib/feedback';
import { StarInput, IcoQr, IcoCopy, IcoCheck } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export type ManualPayload = {
  evento_id: string | null; propriedade_id: number | null; cliente_id: string | null;
  autor_nome: string; autor_contato: string; canal: CanalFeedback; nota_geral: number;
  criterios: Record<string, number>; comentario: string; pontos_positivos: string;
  pontos_negativos: string; permite_publicar: boolean;
};

function eventoLabel(e: EventoLite): string {
  const base = e.nome_evento || e.tipo_evento || e.quem_contratou || 'Evento';
  const d = e.data_inicio ? ` · ${formatDate(e.data_inicio, { style: 'short' })}` : '';
  return base + d;
}

export function ColetarModal({
  eventos, onClose, onGerarLink, onRegistrarManual,
}: {
  eventos: EventoLite[];
  onClose: () => void;
  onGerarLink: (eventoId: string) => Promise<string | null>; // retorna o path (/feedback/<token>)
  onRegistrarManual: (p: ManualPayload) => Promise<boolean>;
}) {
  const [tab, setTab] = useState<'link' | 'manual'>('link');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">Coletar feedback</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-black/[0.04] hover:text-ink">✕</button>
        </div>
        <p className="mt-1 text-sm text-ink-muted">Envie um link/QR ao contratante após o evento ou registre um retorno recebido por outro canal.</p>

        <div className="mt-4 inline-flex rounded-xl border border-black/10 p-0.5 text-sm">
          <button onClick={() => setTab('link')} className={`rounded-lg px-3 py-1.5 font-semibold ${tab === 'link' ? 'bg-brand text-white' : 'text-ink-soft'}`}>Link & QR</button>
          <button onClick={() => setTab('manual')} className={`rounded-lg px-3 py-1.5 font-semibold ${tab === 'manual' ? 'bg-brand text-white' : 'text-ink-soft'}`}>Registro manual</button>
        </div>

        {tab === 'link'
          ? <AbaLink eventos={eventos} onGerarLink={onGerarLink} />
          : <AbaManual eventos={eventos} onRegistrarManual={onRegistrarManual} onClose={onClose} />}
      </div>
    </div>
  );
}

// ── Aba: link + QR ────────────────────────────────────────────────────────────
function AbaLink({ eventos, onGerarLink }: { eventos: EventoLite[]; onGerarLink: (id: string) => Promise<string | null> }) {
  const [eventoId, setEventoId] = useState('');
  const [path, setPath] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = useMemo(() => (path && typeof window !== 'undefined' ? window.location.origin + path : path || ''), [path]);
  const qr = useMemo(() => (url ? qrSvgString(url, { size: 168 }) : ''), [url]);

  async function gerar() {
    if (!eventoId) return;
    setBusy(true); setCopied(false);
    const p = await onGerarLink(eventoId);
    setBusy(false);
    setPath(p);
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* ignore */ }
  }

  if (!eventos.length) {
    return <p className="mt-5 rounded-xl border border-dashed border-black/10 bg-black/[0.02] p-5 text-center text-sm text-ink-muted">Cadastre um evento em Clientes/Leads para gerar um link de feedback.</p>;
  }

  return (
    <div className="mt-4 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Evento</span>
        <select value={eventoId} onChange={(e) => { setEventoId(e.target.value); setPath(null); }} className={inp}>
          <option value="">Selecione o evento…</option>
          {eventos.map((e) => <option key={e.id} value={e.id}>{eventoLabel(e)}</option>)}
        </select>
      </label>
      <button onClick={gerar} disabled={!eventoId || busy} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
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
          <p className="mt-2 text-xs text-ink-muted">Compartilhe por WhatsApp/e-mail. O cliente responde sem login; o feedback cai aqui.</p>
        </div>
      )}
    </div>
  );
}

// ── Aba: registro manual ──────────────────────────────────────────────────────
function AbaManual({ eventos, onRegistrarManual, onClose }: { eventos: EventoLite[]; onRegistrarManual: (p: ManualPayload) => Promise<boolean>; onClose: () => void }) {
  const [eventoId, setEventoId] = useState('');
  const [nota, setNota] = useState(0);
  const [crit, setCrit] = useState<Record<string, number>>({});
  const [canal, setCanal] = useState<CanalFeedback>('presencial');
  const [f, setF] = useState({ autor_nome: '', autor_contato: '', comentario: '', pontos_positivos: '', pontos_negativos: '' });
  const [permite, setPermite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function salvar() {
    setErro('');
    if (nota < 1) { setErro('Dê uma nota geral de 1 a 5.'); return; }
    const ev = eventos.find((e) => e.id === eventoId) || null;
    setBusy(true);
    const ok = await onRegistrarManual({
      evento_id: ev?.id || null,
      propriedade_id: ev?.propriedade_id ?? null,
      cliente_id: ev?.cliente_id ?? null,
      autor_nome: f.autor_nome.trim() || (ev?.quem_contratou || ''),
      autor_contato: f.autor_contato.trim(),
      canal, nota_geral: nota, criterios: crit,
      comentario: f.comentario.trim(), pontos_positivos: f.pontos_positivos.trim(),
      pontos_negativos: f.pontos_negativos.trim(), permite_publicar: permite,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Evento (opcional)</span>
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className={inp}>
            <option value="">Sem evento vinculado</option>
            {eventos.map((e) => <option key={e.id} value={e.id}>{eventoLabel(e)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome do cliente</span>
          <input className={inp} value={f.autor_nome} onChange={set('autor_nome')} placeholder="Quem deu o retorno" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Canal</span>
          <select value={canal} onChange={(e) => setCanal(e.target.value as CanalFeedback)} className={inp}>
            {CANAIS.map((c) => <option key={c.v} value={c.v}>{c.icon} {c.label}</option>)}
          </select>
        </label>
      </div>

      <div className="rounded-xl bg-black/[0.02] p-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-ink-soft">Nota geral *</span>
          <StarInput value={nota} onChange={setNota} size={28} />
        </div>
        <div className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
          {CRITERIOS.map((c) => (
            <div key={c.v} className="flex items-center justify-between gap-2">
              <span className="text-sm text-ink-soft">{c.label}</span>
              <StarInput value={crit[c.v] || 0} onChange={(n) => setCrit((s) => ({ ...s, [c.v]: n }))} size={20} />
            </div>
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Comentário</span>
        <textarea className={`${inp} min-h-[64px]`} value={f.comentario} onChange={set('comentario')} placeholder="O que o cliente disse…" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <textarea className={`${inp} min-h-[56px]`} value={f.pontos_positivos} onChange={set('pontos_positivos')} placeholder="Pontos positivos" />
        <textarea className={`${inp} min-h-[56px]`} value={f.pontos_negativos} onChange={set('pontos_negativos')} placeholder="Pontos a melhorar" />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={permite} onChange={(e) => setPermite(e.target.checked)} className="h-4 w-4 accent-brand" />
        Cliente autoriza usar como avaliação pública
      </label>

      {erro && <p className="text-sm text-red-600">{erro}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
        <button onClick={salvar} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{busy ? 'Salvando…' : 'Registrar feedback'}</button>
      </div>
    </div>
  );
}

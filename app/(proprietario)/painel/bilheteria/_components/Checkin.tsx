'use client';

// Aba CHECK-IN — leitura do QR do ingresso (coletor/câmera) com validação
// AUTORITATIVA em /api/bilheteria/checkin (anti-duplicidade; só ingresso pago
// entra). O QR é o mesmo das credenciais, então a Portaria de /painel/acesso
// também funciona para controle de lotação por zona. Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { authHeaders } from '@/lib/supabase';
import { formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { type Ingresso, type Categoria, ingressoStatusMeta } from '@/lib/bilheteria';
import { IcoCam, IcoCheck, IcoX, IcoAlert, IcoSearch } from './Icons';

type MovResult = { kind: 'ok' | 'warn' | 'erro'; nome?: string; categoria?: string; aviso?: string };

const MOTIVO_LABEL: Record<string, string> = {
  duplicado: 'Check-in já realizado', nao_pago: 'Ingresso não pago', cancelado: 'Ingresso cancelado',
  desconhecido: 'QR não reconhecido',
};

export function Checkin({ ingressos, categorias, onSync }: { ingressos: Ingresso[]; categorias: Categoria[]; onSync: () => void }) {
  const toast = useToast();
  const [scan, setScan] = useState('');
  const [busy, setBusy] = useState(false);
  const [ultimo, setUltimo] = useState<MovResult | null>(null);
  const [feed, setFeed] = useState<MovResult[]>([]);
  const [buscaManual, setBuscaManual] = useState('');
  const [camOn, setCamOn] = useState(false);
  const [checados, setChecados] = useState<Set<string>>(new Set());

  const inputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastScanRef = useRef<{ v: string; t: number }>({ v: '', t: 0 });

  const catNome = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Contadores (base dos props + otimista dos check-ins desta sessão).
  const base = useMemo(() => {
    let vendidos = 0, checkin = 0;
    for (const i of ingressos) { if (i.status === 'pago' || i.status === 'checkin') vendidos++; if (i.status === 'checkin') checkin++; }
    return { vendidos, checkin };
  }, [ingressos]);
  const novosCheckins = useMemo(() => Array.from(checados).filter((id) => {
    const ing = ingressos.find((x) => x.id === id);
    return ing && ing.status !== 'checkin';
  }).length, [checados, ingressos]);
  const presentes = base.checkin + novosCheckins;

  const processar = useCallback(async (args: { token?: string; ingresso_id?: string; force?: boolean }) => {
    setBusy(true);
    try {
      const res = await fetch('/api/bilheteria/checkin', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(args) });
      const json = await res.json().catch(() => ({}));
      let r: MovResult;
      if (res.ok) {
        r = { kind: 'ok', nome: json.ingresso?.nome, categoria: json.ingresso?.categoria, aviso: json.reentrada ? 'Reentrada liberada.' : undefined };
        if (json.ingresso?.id) setChecados((s) => new Set(s).add(json.ingresso.id));
        toast.success(`${json.ingresso?.nome || 'Ingresso'} — check-in OK`);
      } else {
        const motivo = json.motivo || (res.status === 404 ? 'desconhecido' : 'erro');
        r = { kind: motivo === 'duplicado' ? 'warn' : 'erro', nome: json.ingresso?.nome, categoria: json.ingresso?.categoria, aviso: json.aviso || MOTIVO_LABEL[motivo] || 'Recusado' };
        if (r.kind === 'warn') toast.info(r.aviso || 'Aviso'); else toast.error(r.aviso || 'Recusado');
      }
      setUltimo(r);
      setFeed((f) => [r, ...f].slice(0, 14));
    } catch {
      setUltimo({ kind: 'erro', aviso: 'Sem conexão — tente novamente.' });
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }, [toast]);

  const onScanSubmit = useCallback(() => {
    const v = scan.trim();
    if (!v || busy) return;
    setScan('');
    processar({ token: v });
  }, [scan, busy, processar]);

  // Câmera (progressive enhancement via BarcodeDetector).
  const pararCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }, []);
  useEffect(() => () => pararCamera(), [pararCamera]);

  async function iniciarCamera() {
    const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!BD) { toast.info('Leitura por câmera não suportada neste navegador — use um coletor (campo abaixo) ou a busca manual.'); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      const detector = new BD({ formats: ['qr_code'] });
      setCamOn(true);
      const loop = async () => {
        if (videoRef.current && videoRef.current.readyState === 4) {
          try {
            const codes = await detector.detect(videoRef.current);
            const raw = codes[0]?.rawValue;
            if (raw) {
              const now = Date.now();
              if (raw !== lastScanRef.current.v || now - lastScanRef.current.t > 3000) {
                lastScanRef.current = { v: raw, t: now };
                processar({ token: raw });
              }
            }
          } catch { /* frame sem código */ }
        }
        rafRef.current = requestAnimationFrame(loop);
      };
      rafRef.current = requestAnimationFrame(loop);
    } catch { toast.error('Não foi possível acessar a câmera. Verifique a permissão.'); }
  }

  const sugestoes = useMemo(() => {
    const q = buscaManual.trim().toLowerCase();
    if (!q) return [];
    return ingressos.filter((i) => (i.status === 'pago' || i.status === 'checkin') && `${i.comprador_nome || ''} ${i.comprador_doc || ''}`.toLowerCase().includes(q)).slice(0, 6);
  }, [buscaManual, ingressos]);

  return (
    <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-4">
        {/* Contadores */}
        <div className="grid grid-cols-3 gap-3">
          <Counter label="Vendidos" value={formatNumber(base.vendidos)} tone="ink" />
          <Counter label="Check-in" value={formatNumber(presentes)} tone="verde" />
          <Counter label="Presença" value={base.vendidos ? formatPercent(presentes / base.vendidos) : '—'} tone="azul" />
        </div>

        {/* Feedback */}
        <Feedback r={ultimo} />

        {/* Leitura */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Leitura de QR</h3>
            <button onClick={() => (camOn ? pararCamera() : iniciarCamera())} className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${camOn ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-brand/30'}`}><IcoCam size={15} /> {camOn ? 'Parar câmera' : 'Usar câmera'}</button>
          </div>
          {camOn && (
            <div className="mt-3 overflow-hidden rounded-xl bg-black">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video ref={videoRef} className="mx-auto max-h-[260px] w-full object-cover" muted playsInline />
            </div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); onScanSubmit(); }} className="mt-3 flex gap-2">
            <input ref={inputRef} value={scan} onChange={(e) => setScan(e.target.value)} placeholder="Bipe o QR do ingresso ou digite o código…" autoComplete="off" className="flex-1 rounded-xl border border-black/10 px-3.5 py-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <button type="submit" disabled={busy || !scan.trim()} className="rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50">Validar</button>
          </form>
          <p className="mt-2 text-xs text-ink-muted">Validação autoritativa no servidor (anti-duplicidade). Para lotação por zona, use a Portaria em Acesso & Credenciamento — o QR é o mesmo.</p>

          {/* Busca manual */}
          <div className="mt-4 border-t border-black/[0.06] pt-4">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Sem QR? Buscar pelo nome</span>
            <div className="relative">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch size={15} /></span>
              <input value={buscaManual} onChange={(e) => setBuscaManual(e.target.value)} placeholder="Nome ou documento…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
            {sugestoes.length > 0 && (
              <div className="mt-2 space-y-1.5">
                {sugestoes.map((i) => {
                  const im = ingressoStatusMeta(i.status);
                  return (
                    <button key={i.id} onClick={() => { setBuscaManual(''); processar({ ingresso_id: i.id }); }} className="flex w-full items-center gap-2.5 rounded-xl border border-black/[0.06] p-2 text-left transition hover:border-brand/30 hover:bg-brand-50/30">
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-ink">{i.comprador_nome || 'Portador'}</span><span className="block truncate text-xs text-ink-muted">{catNome.get(i.categoria_id) || '—'}</span></span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${im.chip}`}>{im.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Check-ins recentes</h3>
          <button onClick={onSync} className="text-xs font-semibold text-brand hover:underline">Atualizar</button>
        </div>
        {feed.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Os check-ins aparecem aqui.</p>
        ) : (
          <div className="space-y-2">
            {feed.map((r, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl border border-black/[0.05] p-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.kind === 'ok' ? 'bg-emerald-500' : r.kind === 'warn' ? 'bg-amber-500' : 'bg-red-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-ink">{r.nome || (r.aviso || '—')}</div>
                  <div className="truncate text-xs text-ink-muted">{r.categoria || ''}{r.categoria && r.aviso ? ' · ' : ''}{r.kind !== 'ok' ? r.aviso : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Counter({ label, value, tone }: { label: string; value: string; tone: 'ink' | 'verde' | 'azul' }) {
  const t: Record<string, string> = { ink: 'text-ink', verde: 'text-emerald-600', azul: 'text-sky-600' };
  return (
    <div className="rounded-2xl bg-white p-4 text-center shadow-card">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${t[tone]}`}>{value}</div>
    </div>
  );
}

function Feedback({ r }: { r: MovResult | null }) {
  if (!r) {
    return <div className="flex items-center justify-center rounded-2xl border-2 border-dashed border-black/10 bg-white py-10 text-center text-sm text-ink-muted">Aguardando leitura… bipe um QR ou busque pelo nome.</div>;
  }
  const cfg = r.kind === 'ok'
    ? { bg: 'bg-emerald-50 border-emerald-300', icoCls: 'bg-emerald-600', ico: <IcoCheck size={32} />, tit: 'text-emerald-900', titulo: 'Check-in liberado' }
    : r.kind === 'warn'
      ? { bg: 'bg-amber-50 border-amber-300', icoCls: 'bg-amber-500', ico: <IcoAlert size={28} />, tit: 'text-amber-900', titulo: 'Atenção' }
      : { bg: 'bg-red-50 border-red-300', icoCls: 'bg-red-600', ico: <IcoX size={28} />, tit: 'text-red-900', titulo: 'Recusado' };
  return (
    <div className={`rounded-2xl border-2 p-5 shadow-card ${cfg.bg}`}>
      <div className="flex items-center gap-4">
        <span className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white ${cfg.icoCls}`}>{cfg.ico}</span>
        <div className="min-w-0 flex-1">
          <div className={`text-lg font-bold ${cfg.tit}`}>{cfg.titulo}</div>
          {r.nome ? <div className="mt-0.5 truncate text-sm text-ink-soft"><span className="font-semibold text-ink">{r.nome}</span>{r.categoria ? ` · ${r.categoria}` : ''}</div> : <div className="mt-0.5 text-sm text-ink-soft">{r.aviso || '—'}</div>}
          {r.nome && r.aviso && <div className="mt-0.5 text-xs text-ink-muted">{r.aviso}</div>}
        </div>
      </div>
    </div>
  );
}

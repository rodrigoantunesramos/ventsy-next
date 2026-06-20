'use client';

// Página PÚBLICA de assinatura — /contrato/[token].
// O signatário (sem login) confere o contrato e assina. A trilha de auditoria
// (IP, user-agent, hash, timestamp) é capturada no SERVIDOR pela rota
// /api/contratos/[token]. Aqui só coletamos nome/doc/método + aceite. Fora do
// painel ⇒ sem ToastProvider: feedback é inline. Moeda via lib/format.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { formatMoney, formatDateTime, type Currency } from '@/lib/format';
import ContractBody from '@/components/ContractBody';
import { PAPEL_META, type Papel, type MetodoAssinatura } from '@/lib/contracts';
import { maskCpfCnpj } from '@/lib/masks';

type PubSign = {
  id: string; signatario_nome: string; papel: Papel; ordem: number;
  obrigatorio: boolean; assinou_em: string | null; metodo: MetodoAssinatura | null; email_mascara: string;
};
type PubView = {
  numero: string; titulo: string | null; conteudo_final: string;
  valor: number; moeda: Currency; status: string; contratada: string; assinaturas: PubSign[];
};
type Estado = 'loading' | 'ok' | 'notfound' | 'unavailable' | 'error';

export default function ContratoPublicoPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token;
  const [estado, setEstado] = useState<Estado>('loading');
  const [data, setData] = useState<PubView | null>(null);
  const [aviso, setAviso] = useState('');
  const [signId, setSignId] = useState<string | null>(null); // signatário em assinatura

  const carregar = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`/api/contratos/${token}`, { cache: 'no-store' });
      if (res.status === 404) { setEstado('notfound'); return; }
      if (res.status === 410) { setEstado('unavailable'); return; }
      const j = await res.json();
      if (!res.ok) { setEstado('error'); setAviso(j.error || 'Erro ao carregar.'); return; }
      setData(j.data); setEstado('ok');
    } catch { setEstado('error'); setAviso('Falha de conexão.'); }
  }, [token]);

  useEffect(() => { carregar(); }, [carregar]);

  if (estado === 'loading') return <Shell><Centered>Carregando contrato…</Centered></Shell>;
  if (estado === 'notfound') return <Shell><Msg titulo="Contrato não encontrado" texto="O link pode estar incorreto ou expirado." /></Shell>;
  if (estado === 'unavailable') return <Shell><Msg titulo="Indisponível para assinatura" texto="Este contrato não está mais aberto para assinatura. Fale com quem o enviou." /></Shell>;
  if (estado === 'error' || !data) return <Shell><Msg titulo="Algo deu errado" texto={aviso || 'Tente novamente em instantes.'} /></Shell>;

  const prog = { assinadas: data.assinaturas.filter((a) => a.assinou_em).length, total: data.assinaturas.length };
  const tudoAssinado = data.assinaturas.every((a) => !a.obrigatorio || a.assinou_em);

  return (
    <Shell>
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Cabeçalho */}
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Contrato {data.numero}</div>
            <h1 className="font-display text-2xl font-bold text-ink">{data.titulo || 'Contrato de locação'}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">{data.contratada} · {formatMoney(data.valor, { currency: data.moeda })}</p>
          </div>
          <div className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-ink shadow-card">{prog.assinadas}/{prog.total} assinaturas</div>
        </div>

        {tudoAssinado && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            <CheckCircle /> Contrato assinado por todas as partes obrigatórias.
          </div>
        )}

        {/* Documento */}
        <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card sm:p-8">
          <ContractBody text={data.conteudo_final} />
        </div>

        {/* Signatários */}
        <div className="mt-6 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
          <h2 className="mb-3 text-sm font-bold text-ink">Assinaturas</h2>
          <div className="space-y-2.5">
            {data.assinaturas.map((a) => (
              <div key={a.id} className={`rounded-xl border p-3 ${a.assinou_em ? 'border-emerald-200 bg-emerald-50/40' : 'border-black/[0.08]'}`}>
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.assinou_em ? 'bg-emerald-100 text-emerald-700' : 'bg-black/[0.05] text-ink-muted'}`}>{a.assinou_em ? <CheckCircle /> : <UserIcon />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{a.signatario_nome || 'A definir'}</div>
                    <div className="text-[0.7rem] text-ink-muted">{PAPEL_META[a.papel].label}{a.email_mascara ? ` · ${a.email_mascara}` : ''}{a.obrigatorio ? '' : ' · opcional'}</div>
                  </div>
                  {a.assinou_em
                    ? <span className="text-right text-[0.7rem] text-emerald-700"><div className="font-semibold">Assinado</div><div>{formatDateTime(a.assinou_em)}</div></span>
                    : <button onClick={() => setSignId(signId === a.id ? null : a.id)} className="shrink-0 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-600">{signId === a.id ? 'Fechar' : 'Assinar'}</button>}
                </div>
                {signId === a.id && !a.assinou_em && (
                  <SignPanel token={token!} signatario={a} onSigned={() => { setSignId(null); carregar(); }} />
                )}
              </div>
            ))}
          </div>
          <p className="mt-4 flex items-start gap-1.5 text-[0.7rem] leading-relaxed text-ink-muted">
            <Lock /> Ao assinar, registramos data e hora, seu endereço IP e dispositivo, e um hash criptográfico do conteúdo — para garantir a integridade e a validade jurídica da assinatura eletrônica.
          </p>
        </div>

        <div className="mt-6 text-center text-xs text-ink-muted">Assinatura eletrônica via <span className="font-display font-bold italic text-brand">VENTSY</span></div>
      </div>
    </Shell>
  );
}

// ── Painel de assinatura (por signatário) ─────────────────────────────────────
function SignPanel({ token, signatario, onSigned }: { token: string; signatario: PubSign; onSigned: () => void }) {
  const [nome, setNome] = useState(signatario.signatario_nome || '');
  const [doc, setDoc] = useState('');
  const [email, setEmail] = useState('');
  const [metodo, setMetodo] = useState<'clique' | 'desenho'>('clique');
  const [assinaturaImg, setAssinaturaImg] = useState<string | null>(null);
  const [aceite, setAceite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  async function assinar() {
    setErro('');
    if (!nome.trim()) { setErro('Informe seu nome completo.'); return; }
    if (!aceite) { setErro('Marque o aceite para assinar.'); return; }
    if (metodo === 'desenho' && !assinaturaImg) { setErro('Desenhe sua assinatura ou use o aceite por clique.'); return; }
    setBusy(true);
    try {
      const res = await fetch(`/api/contratos/${token}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signatario_id: signatario.id, nome, doc, email, metodo, assinatura_img: assinaturaImg, aceite: true }),
      });
      const j = await res.json();
      if (!res.ok) { setErro(j.error || 'Não foi possível assinar.'); setBusy(false); return; }
      onSigned();
    } catch { setErro('Falha de conexão.'); setBusy(false); }
  }

  const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
  return (
    <div className="mt-3 space-y-3 border-t border-black/[0.06] pt-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} placeholder="Nome completo" aria-label="Nome completo" autoComplete="name" />
        <input value={doc} onChange={(e) => setDoc(maskCpfCnpj(e.target.value))} className={inp} placeholder="CPF/CNPJ" aria-label="CPF ou CNPJ" inputMode="numeric" />
        <input value={email} onChange={(e) => setEmail(e.target.value)} className={inp} placeholder="E-mail" aria-label="E-mail" type="email" autoComplete="email" inputMode="email" />
      </div>

      <div className="flex gap-2">
        {(['clique', 'desenho'] as const).map((m) => (
          <button key={m} onClick={() => setMetodo(m)} className={`flex-1 rounded-xl border px-3 py-2 text-xs font-semibold transition ${metodo === m ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-muted'}`}>
            {m === 'clique' ? 'Aceite por clique' : 'Desenhar assinatura'}
          </button>
        ))}
      </div>

      {metodo === 'desenho' && <SignaturePad onChange={setAssinaturaImg} />}

      <label className="flex items-start gap-2 text-xs text-ink-soft">
        <input type="checkbox" checked={aceite} onChange={(e) => setAceite(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
        <span>Declaro que li e concordo com todos os termos deste contrato e que esta é a minha assinatura eletrônica como <strong>{PAPEL_META[signatario.papel].label}</strong>.</span>
      </label>

      {erro && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{erro}</div>}

      <button onClick={assinar} disabled={busy} className="w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
        {busy ? 'Registrando assinatura…' : 'Assinar contrato'}
      </button>
    </div>
  );
}

// ── Pad de assinatura (canvas, sem libs) ──────────────────────────────────────
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);

  const ctx = () => ref.current?.getContext('2d') ?? null;

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const g = c.getContext('2d'); if (!g) return;
    g.lineWidth = 2.2; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#0d0d0d';
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!; const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  }
  function down(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault(); const g = ctx(); if (!g) return;
    drawing.current = true; const p = point(e); g.beginPath(); g.moveTo(p.x, p.y);
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return; const g = ctx(); if (!g) return;
    const p = point(e); g.lineTo(p.x, p.y); g.stroke(); dirty.current = true;
  }
  function up() {
    if (!drawing.current) return; drawing.current = false;
    onChange(dirty.current && ref.current ? ref.current.toDataURL('image/png') : null);
  }
  function clear() {
    const c = ref.current, g = ctx(); if (!c || !g) return;
    g.clearRect(0, 0, c.width, c.height); dirty.current = false; onChange(null);
  }

  return (
    <div>
      <canvas
        ref={ref} width={600} height={180}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up}
        className="h-[180px] w-full touch-none rounded-xl border border-dashed border-black/20 bg-[#fcfcfc]"
      />
      <div className="mt-1 flex items-center justify-between text-[0.7rem] text-ink-muted">
        <span>Desenhe sua assinatura acima</span>
        <button onClick={clear} className="font-semibold text-brand hover:underline">Limpar</button>
      </div>
    </div>
  );
}

// ── Chrome / estados ──────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f7f7f8] text-ink">
      <header className="flex h-[60px] items-center border-b border-black/[0.06] bg-white px-5">
        <span className="font-display text-[1.4rem] font-bold italic text-brand">VENTSY</span>
      </header>
      {children}
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-[60vh] items-center justify-center text-sm text-ink-muted">{children}</div>;
}
function Msg({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-ink-muted shadow-card"><Lock /></div>
      <h1 className="mb-1 text-lg font-bold text-ink">{titulo}</h1>
      <p className="text-sm text-ink-muted">{texto}</p>
    </div>
  );
}

// Ícones inline locais (página pública, fora do mapa do painel).
function CheckCircle() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><path d="m22 4-10 10.01-3-3" /></svg>; }
function UserIcon() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /></svg>; }
function Lock() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>; }

'use client';

// Conteúdo & ativos (/painel/marketing · aba Conteúdo).
// Três ferramentas de divulgação:
//   1) UTM builder — monta links rastreáveis (lib/marketing.buildUTM), preview ao
//      vivo + copiar.
//   2) QR de divulgação — gera o QR do link (encoder puro lib/qrcode), copiar/baixar.
//   3) Gerador de legenda/post com IA (Pro+) — chama app/api/marketing/ai; degrada
//      sem AI_GATEWAY_API_KEY. Não inventa "R$".
// Também atalha para a biblioteca de fotos (/painel/fotos).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { qrMatrix, withQuietZone, modulesToSvgPath, qrSvgString } from '@/lib/qrcode';
import { buildUTM, ORIGENS, ORIGEM_LABEL, type UtmParams } from '@/lib/marketing';
import { useToast } from '@/components/Toast';
import { IcoLink, IcoQr, IcoCopy, IcoSparkles, IcoImage, IcoExternal, IcoDownload } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

const REDES = [
  { v: 'Instagram', label: 'Instagram' },
  { v: 'Facebook', label: 'Facebook' },
  { v: 'LinkedIn', label: 'LinkedIn' },
  { v: 'TikTok', label: 'TikTok' },
  { v: 'Google', label: 'Google' },
  { v: 'WhatsApp', label: 'WhatsApp' },
];
const TONS = ['Caloroso e profissional', 'Sofisticado', 'Divertido', 'Direto ao ponto', 'Inspirador'];
const FORMATOS = [
  { v: 'legenda', label: 'Legenda de post' },
  { v: 'post', label: 'Texto longo' },
  { v: 'ideias', label: '5 ideias de conteúdo' },
];

function QrView({ value, size = 168 }: { value: string; size?: number }) {
  const r = useMemo(() => {
    try { const m = withQuietZone(qrMatrix(value, { ecLevel: 'M' }), 4); return { path: modulesToSvgPath(m), dim: m.length }; }
    catch { return { path: '', dim: 0 }; }
  }, [value]);
  if (!r.dim) return <div className="flex items-center justify-center rounded-xl bg-black/[0.03] text-xs text-ink-muted" style={{ width: size, height: size }}>sem QR</div>;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${r.dim} ${r.dim}`} shapeRendering="crispEdges" role="img" aria-label="QR de divulgação" className="rounded-xl border border-black/[0.06]">
      <rect width={r.dim} height={r.dim} fill="#fff" /><path d={r.path} fill="#000" />
    </svg>
  );
}

export function Conteudo({
  empresa, siteUrl, isPro, onGerarIA,
}: {
  empresa: string;
  siteUrl: string;
  isPro: boolean;
  onGerarIA: (args: { formato: string; tema: string; rede: string; tom: string }) => Promise<string | null>;
}) {
  const toast = useToast();

  // UTM
  const [base, setBase] = useState(siteUrl);
  const [source, setSource] = useState('instagram');
  const [medium, setMedium] = useState('social');
  const [campaign, setCampaign] = useState('');
  const utm = useMemo<UtmParams>(() => ({ source, medium, campaign }), [source, medium, campaign]);
  const linkFinal = useMemo(() => buildUTM(base, utm), [base, utm]);

  // IA
  const [tema, setTema] = useState('');
  const [rede, setRede] = useState('Instagram');
  const [tom, setTom] = useState(TONS[0]);
  const [formato, setFormato] = useState('legenda');
  const [gerando, setGerando] = useState(false);
  const [saida, setSaida] = useState('');

  async function copiar(txt: string, msg = 'Copiado!') {
    if (!txt) return;
    try { await navigator.clipboard.writeText(txt); toast.success(msg); }
    catch { toast.error('Não foi possível copiar.'); }
  }
  function baixarQr() {
    const alvo = linkFinal || base;
    if (!alvo) return;
    const svg = qrSvgString(alvo, { size: 512 });
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'qr-divulgacao.svg'; a.click();
    URL.revokeObjectURL(url);
  }
  async function gerar() {
    if (!tema.trim()) { toast.info('Descreva o tema do conteúdo.'); return; }
    setGerando(true); setSaida('');
    const txt = await onGerarIA({ formato, tema: tema.trim(), rede, tom });
    setGerando(false);
    if (txt) setSaida(txt);
  }

  return (
    <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* UTM builder */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><IcoLink /> Construtor de links (UTM)</h3>
        <p className="mt-1 text-xs text-ink-muted">Rastreie de onde vêm os cliques. Use um link por canal/campanha.</p>
        <div className="mt-4 space-y-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">URL de destino</span><input value={base} onChange={(e) => setBase(e.target.value)} className={inp} placeholder="https://www.ventsy.com.br/sua-propriedade" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Origem (source)</span>
              <input list="utm-origens" value={source} onChange={(e) => setSource(e.target.value)} className={inp} placeholder="instagram" />
              <datalist id="utm-origens">{ORIGENS.map((o) => <option key={o} value={o}>{ORIGEM_LABEL[o]}</option>)}</datalist>
            </label>
            <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Mídia (medium)</span><input value={medium} onChange={(e) => setMedium(e.target.value)} className={inp} placeholder="social / cpc / bio" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Campanha <span className="font-normal text-ink-muted">(opcional)</span></span><input value={campaign} onChange={(e) => setCampaign(e.target.value)} className={inp} placeholder="verao-2026" /></label>
        </div>
        <div className="mt-4 rounded-xl bg-black/[0.03] p-3">
          <div className="mb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">Link gerado</div>
          <p className="break-all text-xs text-ink-soft">{linkFinal || '—'}</p>
        </div>
        <button onClick={() => copiar(linkFinal, 'Link copiado!')} disabled={!linkFinal} className="mt-3 inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50"><IcoCopy /> Copiar link</button>
      </div>

      {/* QR */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><IcoQr /> QR de divulgação</h3>
        <p className="mt-1 text-xs text-ink-muted">Para materiais impressos, balcão e estandes. Aponta para o link acima.</p>
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
          <QrView value={linkFinal || base} />
          <div className="flex-1">
            <p className="text-xs text-ink-muted">O QR aponta para:</p>
            <p className="mt-1 break-all text-xs font-medium text-ink-soft">{linkFinal || base || '—'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button onClick={baixarQr} disabled={!(linkFinal || base)} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><IcoDownload /> Baixar SVG</button>
              <button onClick={() => copiar(linkFinal || base, 'Link copiado!')} disabled={!(linkFinal || base)} className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50"><IcoCopy /> Copiar link</button>
            </div>
          </div>
        </div>
      </div>

      {/* Biblioteca de fotos */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><IcoImage /> Conteúdo & ativos</h3>
        <p className="mt-1 text-xs text-ink-muted">Suas fotos e vídeos do espaço — a matéria-prima dos posts e anúncios.</p>
        <Link href="/painel/fotos" className="mt-4 inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">
          <IcoImage /> Abrir biblioteca de fotos <IcoExternal />
        </Link>
      </div>

      {/* Gerador IA */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><IcoSparkles /> Gerar conteúdo com IA <span className="rounded-full bg-gradient-to-r from-amber-500 to-brand px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-white">Pro+</span></h3>
        {!isPro ? (
          <div className="mt-4 rounded-xl bg-gradient-to-br from-amber-50 to-brand-50/40 p-4">
            <p className="text-sm font-semibold text-ink">Crie legendas e posts em segundos</p>
            <p className="mt-1 text-xs text-ink-muted">A IA escreve legendas, textos e ideias de conteúdo a partir de um tema, no tom da sua marca. Disponível nos planos Pro e Ultra.</p>
            <Link href="/painel/planos" className="mt-3 inline-block rounded-lg bg-gradient-to-r from-amber-500 to-brand px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90">Ver planos</Link>
          </div>
        ) : (
          <>
            <div className="mt-4 space-y-3">
              <label className="block"><span className="mb-1 block text-xs font-semibold text-ink-soft">Tema</span><input value={tema} onChange={(e) => setTema(e.target.value)} className={inp} placeholder="Ex: pacote de casamento para o verão" /></label>
              <div className="grid grid-cols-3 gap-2">
                <label className="block"><span className="mb-1 block text-[0.7rem] text-ink-muted">Formato</span><select value={formato} onChange={(e) => setFormato(e.target.value)} className={inp}>{FORMATOS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-[0.7rem] text-ink-muted">Rede</span><select value={rede} onChange={(e) => setRede(e.target.value)} className={inp}>{REDES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select></label>
                <label className="block"><span className="mb-1 block text-[0.7rem] text-ink-muted">Tom</span><select value={tom} onChange={(e) => setTom(e.target.value)} className={inp}>{TONS.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              </div>
              <button onClick={gerar} disabled={gerando} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"><IcoSparkles /> {gerando ? 'Gerando…' : 'Gerar conteúdo'}</button>
            </div>
            {saida && (
              <div className="mt-4">
                <textarea value={saida} onChange={(e) => setSaida(e.target.value)} rows={7} className={`${inp} resize-y`} />
                <button onClick={() => copiar(saida, 'Conteúdo copiado!')} className="mt-2 inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoCopy /> Copiar</button>
              </div>
            )}
          </>
        )}
        {empresa ? <p className="mt-3 text-[0.7rem] text-ink-muted">A IA assina como <span className="font-medium">{empresa}</span> e não inventa preços ou datas.</p> : null}
      </div>
    </div>
  );
}

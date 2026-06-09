'use client';

// Página PÚBLICA de feedback privado — /feedback/[token].
// Avaliação PÓS-EVENTO franca entre contratante e dono, que NÃO vai ao público —
// cai direto na tratativa interna do dono em /painel/feedbacks. O token carrega o
// evento assinado (lib/feedbackToken). Lê o contexto via /api/feedbacks/publico
// (service-role) e grava por POST. Sem login; honeypot anti-bot. Sem "R$" (lib/format).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { CRITERIOS } from '@/lib/feedback';

type Ctx = {
  evento: { nome: string | null; tipo: string | null; data: string | null; contratante: string | null };
  espaco: { nome: string | null; cidade: string | null; estado: string | null } | null;
  empresa: { nome: string | null; logo: string | null } | null;
};

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function FeedbackPublicoPage({ params }: { params: { token: string } }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [nota, setNota] = useState(0);
  const [crit, setCrit] = useState<Record<string, number>>({});
  const [f, setF] = useState({ autor_nome: '', autor_contato: '', comentario: '', pontos_positivos: '', pontos_negativos: '', website: '' });
  const [permite, setPermite] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/feedbacks/publico?token=${encodeURIComponent(params.token)}`);
        const json = await res.json();
        if (res.ok && json.evento) {
          setCtx(json);
          setF((s) => ({ ...s, autor_nome: json.evento.contratante || '' }));
          setEstado('ok');
        } else setEstado('notfound');
      } catch { setEstado('notfound'); }
    })();
  }, [params.token]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const setCriterio = (v: string, n: number) => setCrit((s) => ({ ...s, [v]: n }));

  const dataLabel = useMemo(() => (ctx?.evento.data ? formatDate(ctx.evento.data, { style: 'long' }) : ''), [ctx]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (nota < 1) { setErro('Dê uma nota geral de 1 a 5 estrelas.'); return; }
    setEnviando(true);
    try {
      const res = await fetch('/api/feedbacks/publico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, nota_geral: nota, criterios: crit, permite_publicar: permite, ...f }),
      });
      const json = await res.json();
      setEnviando(false);
      if (res.ok && json.ok) setEnviado(true);
      else setErro(json.error || 'Não foi possível enviar. Tente novamente.');
    } catch { setEnviando(false); setErro('Falha de rede. Tente novamente.'); }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-[60px] max-w-2xl items-center gap-3 px-4">
          {ctx?.empresa?.logo
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={ctx.empresa.logo} alt={ctx.empresa.nome || ''} className="h-8 w-auto object-contain" />
            : <Link href="/" className="font-display text-[1.4rem] font-bold italic text-brand">VENTSY</Link>}
          {ctx?.empresa?.nome && <span className="text-sm font-semibold text-ink-soft">{ctx.empresa.nome}</span>}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {estado === 'loading' && <div className="h-[420px] animate-pulse rounded-2xl bg-black/[0.05]" />}

        {estado === 'notfound' && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-card">
            <h1 className="font-display text-xl font-bold text-ink">Link indisponível</h1>
            <p className="mt-2 text-sm text-ink-muted">Este link de feedback é inválido ou expirou. Peça um novo ao organizador.</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Voltar ao site</Link>
          </div>
        )}

        {estado === 'ok' && ctx && (
          enviado ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-card">
              <div className="text-4xl">💜</div>
              <h1 className="mt-2 font-display text-2xl font-bold text-ink">Obrigado pelo seu feedback!</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">Sua opinião é confidencial e nos ajuda a melhorar de verdade. {permite ? 'Como você autorizou, parte do seu comentário pode virar um depoimento público.' : ''}</p>
              <Link href="/" className="mt-5 inline-block rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-black/[0.03]">Conhecer a Ventsy</Link>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Contexto do evento */}
              <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand">🔒 Feedback confidencial</span>
                <h1 className="mt-3 font-display text-2xl font-bold text-ink sm:text-3xl">Como foi sua experiência?</h1>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                  {ctx.evento.nome ? <>Conte com sinceridade como foi <span className="font-semibold text-ink">{ctx.evento.nome}</span>.</> : 'Conte com sinceridade como foi seu evento.'}
                  {' '}Este retorno é privado — vai direto para quem organizou, não aparece publicamente.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {ctx.espaco?.nome && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{ctx.espaco.nome}</span>}
                  {ctx.evento.tipo && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{ctx.evento.tipo}</span>}
                  {dataLabel && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{dataLabel}</span>}
                </div>
              </div>

              <form onSubmit={enviar} className="space-y-5">
                {/* Nota geral */}
                <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Nota geral *</h2>
                  <div className="mt-3 flex items-center gap-3">
                    <StarInput value={nota} onChange={setNota} size={36} />
                    <span className="text-sm font-semibold text-ink-soft">{nota ? `${nota} de 5` : 'Toque nas estrelas'}</span>
                  </div>
                </div>

                {/* Critérios */}
                <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Avalie por item</h2>
                  <p className="mt-1 text-xs text-ink-muted">Opcional — pule o que não se aplica.</p>
                  <div className="mt-4 space-y-3">
                    {CRITERIOS.map((c) => (
                      <div key={c.v} className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.04] pb-3 last:border-0 last:pb-0">
                        <span className="text-sm font-medium text-ink-soft">{c.label}</span>
                        <StarInput value={crit[c.v] || 0} onChange={(n) => setCriterio(c.v, n)} size={24} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Comentários */}
                <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                  <div className="grid grid-cols-1 gap-4">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">O que mais gostou?</span>
                      <textarea className={`${inp} min-h-[72px]`} value={f.pontos_positivos} onChange={set('pontos_positivos')} placeholder="O que funcionou bem…" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">O que podemos melhorar?</span>
                      <textarea className={`${inp} min-h-[72px]`} value={f.pontos_negativos} onChange={set('pontos_negativos')} placeholder="Seja franco — é assim que melhoramos…" />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Comentário geral</span>
                      <textarea className={`${inp} min-h-[72px]`} value={f.comentario} onChange={set('comentario')} placeholder="Algo mais que queira contar?" />
                    </label>
                  </div>
                </div>

                {/* Identificação + autorização */}
                <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Seu nome</span>
                      <input className={inp} value={f.autor_nome} onChange={set('autor_nome')} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">E-mail ou telefone</span>
                      <input className={inp} value={f.autor_contato} onChange={set('autor_contato')} placeholder="Caso queira retorno" />
                    </label>
                  </div>
                  <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-xl bg-black/[0.02] p-3">
                    <input type="checkbox" checked={permite} onChange={(e) => setPermite(e.target.checked)} className="mt-0.5 h-4 w-4 accent-brand" />
                    <span className="text-sm text-ink-soft">Autorizo usar meu comentário como depoimento público (caso positivo). Sem isso, seu feedback fica 100% privado.</span>
                  </label>
                  {/* honeypot (oculto) */}
                  <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
                </div>

                {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
                <button type="submit" disabled={enviando} className="w-full rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                  {enviando ? 'Enviando…' : 'Enviar feedback'}
                </button>
                <p className="text-center text-xs text-ink-muted">🔒 Suas respostas são confidenciais.</p>
              </form>
            </div>
          )
        )}
      </main>
    </div>
  );
}

// ── Estrelas clicáveis (SVG puro, design system) ──────────────────────────────
const STAR_PATH = 'M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z';
function StarInput({ value, onChange, size = 28 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(i)}
          className="transition-transform hover:scale-110"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={i <= active ? 'text-amber-400' : 'text-black/[0.15]'}><path d={STAR_PATH} /></svg>
        </button>
      ))}
    </div>
  );
}

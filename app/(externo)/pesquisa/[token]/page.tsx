'use client';

// Página PÚBLICA de pesquisa — /pesquisa/[token].
// Pesquisa pós-evento (NPS/CSAT/custom) respondida pelo contratante SEM login. O
// token carrega a pesquisa (+ evento opcional) assinada (lib/pesquisaToken). Lê o
// modelo via /api/pesquisas/publico (service-role) e grava por POST, que calcula
// nps/categoria no servidor. Honeypot anti-bot. Sem "R$" (lib/format).

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { NPS_MAX, type Pergunta } from '@/lib/pesquisas';

type Ctx = {
  pesquisa: { titulo: string; descricao: string | null; tipo: string; perguntas: Pergunta[] };
  evento: { nome: string | null; tipo: string | null; data: string | null; contratante: string | null } | null;
  espaco: { nome: string | null; cidade: string | null; estado: string | null } | null;
  empresa: { nome: string | null; logo: string | null } | null;
};

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function PesquisaPublicaPage({ params }: { params: { token: string } }) {
  const [ctx, setCtx] = useState<Ctx | null>(null);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [respostas, setRespostas] = useState<Record<string, unknown>>({});
  const [autor, setAutor] = useState({ autor_nome: '', autor_contato: '', website: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/pesquisas/publico?token=${encodeURIComponent(params.token)}`);
        const json = await res.json();
        if (res.ok && json.pesquisa) {
          setCtx(json);
          setAutor((s) => ({ ...s, autor_nome: json.evento?.contratante || '' }));
          setEstado('ok');
        } else setEstado('notfound');
      } catch { setEstado('notfound'); }
    })();
  }, [params.token]);

  const setResp = (id: string, v: unknown) => setRespostas((s) => ({ ...s, [id]: v }));
  const setA = (k: keyof typeof autor) => (e: React.ChangeEvent<HTMLInputElement>) => setAutor((s) => ({ ...s, [k]: e.target.value }));
  const dataLabel = useMemo(() => (ctx?.evento?.data ? formatDate(ctx.evento.data, { style: 'long' }) : ''), [ctx]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    const perguntas = ctx?.pesquisa.perguntas || [];
    for (const q of perguntas) {
      if (!q.obrigatoria) continue;
      const v = respostas[q.id];
      if (v == null || (typeof v === 'string' && !v.trim())) { setErro(`Responda: "${q.titulo}".`); return; }
    }
    setEnviando(true);
    try {
      const res = await fetch('/api/pesquisas/publico', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token, respostas, ...autor }),
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
            <h1 className="font-display text-xl font-bold text-ink">Pesquisa indisponível</h1>
            <p className="mt-2 text-sm text-ink-muted">Este link é inválido, expirou ou a pesquisa não está mais ativa. Peça um novo ao organizador.</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Voltar ao site</Link>
          </div>
        )}

        {estado === 'ok' && ctx && (
          enviado ? (
            <div className="rounded-2xl bg-white p-10 text-center shadow-card">
              <div className="text-4xl">💜</div>
              <h1 className="mt-2 font-display text-2xl font-bold text-ink">Obrigado por responder!</h1>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">Sua opinião nos ajuda a melhorar a cada evento.</p>
              <Link href="/" className="mt-5 inline-block rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-semibold hover:bg-black/[0.03]">Conhecer a Ventsy</Link>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Contexto */}
              <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{ctx.pesquisa.titulo}</h1>
                {ctx.pesquisa.descricao
                  ? <p className="mt-2 text-sm leading-relaxed text-ink-soft">{ctx.pesquisa.descricao}</p>
                  : <p className="mt-2 text-sm leading-relaxed text-ink-soft">Leva menos de 1 minuto — sua opinião é muito importante para nós.</p>}
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {ctx.evento?.nome && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{ctx.evento.nome}</span>}
                  {ctx.espaco?.nome && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{ctx.espaco.nome}</span>}
                  {dataLabel && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{dataLabel}</span>}
                </div>
              </div>

              <form onSubmit={enviar} className="space-y-5">
                {ctx.pesquisa.perguntas.map((q, i) => (
                  <div key={q.id} className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                    <h2 className="text-base font-semibold text-ink">
                      <span className="text-ink-muted">{i + 1}.</span> {q.titulo}
                      {q.obrigatoria && <span className="ml-1 text-brand">*</span>}
                    </h2>
                    <div className="mt-4">
                      <Campo q={q} value={respostas[q.id]} onChange={(v) => setResp(q.id, v)} />
                    </div>
                  </div>
                ))}

                {/* Identificação (opcional) */}
                <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Seu nome</span>
                      <input className={inp} value={autor.autor_nome} onChange={setA('autor_nome')} />
                    </label>
                    <label className="block">
                      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">E-mail ou telefone</span>
                      <input className={inp} value={autor.autor_contato} onChange={setA('autor_contato')} placeholder="Caso queira retorno" />
                    </label>
                  </div>
                  {/* honeypot (oculto) */}
                  <input type="text" tabIndex={-1} autoComplete="off" value={autor.website} onChange={setA('website')} className="hidden" aria-hidden />
                </div>

                {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{erro}</p>}
                <button type="submit" disabled={enviando} className="w-full rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
                  {enviando ? 'Enviando…' : 'Enviar respostas'}
                </button>
                <p className="text-center text-xs text-ink-muted">🔒 Suas respostas são tratadas com confidencialidade.</p>
              </form>
            </div>
          )
        )}
      </main>
    </div>
  );
}

// ── Campo por tipo de pergunta ────────────────────────────────────────────────
function Campo({ q, value, onChange }: { q: Pergunta; value: unknown; onChange: (v: unknown) => void }) {
  if (q.tipo === 'nps') return <NpsScale value={typeof value === 'number' ? value : null} onChange={onChange} />;
  if (q.tipo === 'csat' || q.tipo === 'escala') return (
    <div className="flex items-center gap-3">
      <StarInput value={typeof value === 'number' ? value : 0} onChange={onChange} size={34} />
      <span className="text-sm font-semibold text-ink-soft">{typeof value === 'number' && value ? `${value} de 5` : 'Toque nas estrelas'}</span>
    </div>
  );
  if (q.tipo === 'multipla') return (
    <div className="flex flex-col gap-2">
      {(q.opcoes || []).map((op) => {
        const sel = value === op;
        return (
          <button
            key={op} type="button" onClick={() => onChange(op)}
            className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 text-left text-sm transition ${sel ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-black/10 hover:border-brand/30'}`}
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${sel ? 'border-brand' : 'border-black/25'}`}>{sel && <span className="h-2 w-2 rounded-full bg-brand" />}</span>
            {op}
          </button>
        );
      })}
    </div>
  );
  // texto
  return <textarea className={`${inp} min-h-[88px]`} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)} placeholder="Escreva aqui…" />;
}

// ── NPS 0–10 (botões coloridos por faixa) ─────────────────────────────────────
function NpsScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  const cor = (n: number) => (n >= 9 ? 'bg-emerald-500' : n >= 7 ? 'bg-amber-400' : 'bg-red-500');
  return (
    <div>
      <div className="grid grid-cols-11 gap-1.5">
        {Array.from({ length: NPS_MAX + 1 }, (_, n) => {
          const sel = value === n;
          return (
            <button
              key={n} type="button" onClick={() => onChange(n)} aria-label={`Nota ${n}`} aria-pressed={sel}
              className={`flex aspect-square items-center justify-center rounded-lg text-sm font-bold transition ${sel ? `${cor(n)} text-white ring-2 ring-offset-1 ring-black/20` : 'bg-black/[0.05] text-ink-soft hover:bg-black/[0.09]'}`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-muted">
        <span>Nada provável</span>
        <span>Muito provável</span>
      </div>
    </div>
  );
}

// ── Estrelas clicáveis (SVG puro) ─────────────────────────────────────────────
const STAR_PATH = 'M12 3.5l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.77l-5.2 2.73.99-5.79-4.21-4.1 5.82-.85L12 3.5Z';
function StarInput({ value, onChange, size = 28 }: { value: number; onChange: (n: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="Nota">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} estrela${i > 1 ? 's' : ''}`}
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} onClick={() => onChange(value === i ? 0 : i)}
          className="transition-transform hover:scale-110"
        >
          <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={i <= active ? 'text-amber-400' : 'text-black/[0.15]'}><path d={STAR_PATH} /></svg>
        </button>
      ))}
    </div>
  );
}

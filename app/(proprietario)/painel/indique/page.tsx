'use client';

// Indique & Ganhe — /painel/indique.
// Código de indicação (usuarios.seucodigo) + link + compartilhamento + histórico
// (view v_indicacoes_dashboard). Porta o módulo legado.

import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { waShareLink } from '@/lib/waLink';

type Indicacao = { propriedade: string | null; data: string | null; status: string | null; status_label: string | null; recompensa: string | null; recompensa_label: string | null };

export default function IndiquePage() {
  const [loading, setLoading] = useState(true);
  const [codigo, setCodigo] = useState('');
  const [origin, setOrigin] = useState('');
  const [lista, setLista] = useState<Indicacao[]>([]);
  const [copied, setCopied] = useState<'codigo' | 'link' | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      try {
        const { data: perfil } = await sb.from('usuarios').select('seucodigo').eq('id', session.user.id).single();
        setCodigo(perfil?.seucodigo || '');
      } catch { /* sem código */ }
      try {
        const { data } = await sb.from('v_indicacoes_dashboard').select('*').eq('indicador_id', session.user.id).order('data', { ascending: false });
        setLista((data || []) as Indicacao[]);
      } catch { /* view ausente */ }
      setLoading(false);
    })();
  }, []);

  const link = useMemo(() => `${origin || 'https://ventsy.com'}/anunciar?ref=${codigo || ''}`, [origin, codigo]);

  const kpis = useMemo(() => ({
    indicados: lista.length,
    publicaram: lista.filter((i) => i.status && i.status !== 'pendente').length,
    creditos: lista.filter((i) => i.recompensa === 'ganho').length,
  }), [lista]);

  function copiar(tipo: 'codigo' | 'link', texto: string) {
    if (!texto) return;
    navigator.clipboard.writeText(texto).then(() => { setCopied(tipo); setTimeout(() => setCopied(null), 2000); });
  }

  const msgWhats = `Estou anunciando meu espaço na VENTSY — eles conectam quem procura locais para eventos. Se você tem um espaço, anuncie também: ${link}`;

  if (loading) return <div className="mx-auto h-[480px] max-w-5xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Indique &amp; Ganhe</h1>
        <p className="mt-1 text-sm text-ink-muted">Indique outros donos de espaços e ganhe meses grátis quando eles publicarem.</p>
      </div>

      {/* Hero código/link */}
      <div className="mt-5 rounded-2xl bg-gradient-to-br from-brand to-brand-700 p-6 text-white shadow-card">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Seu código</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="font-display text-3xl font-black tracking-wide">{codigo || '—'}</span>
              <button onClick={() => copiar('codigo', codigo)} className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold backdrop-blur transition hover:bg-white/30">{copied === 'codigo' ? '✓ Copiado' : 'Copiar'}</button>
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-white/70">Seu link de indicação</div>
            <div className="mt-1 flex items-center gap-2">
              <input readOnly value={link} className="min-w-0 flex-1 rounded-lg bg-white/15 px-3 py-2 text-sm text-white placeholder-white/60 backdrop-blur" />
              <button onClick={() => copiar('link', link)} className="shrink-0 rounded-lg bg-white px-3 py-2 text-xs font-bold text-brand transition hover:bg-white/90">{copied === 'link' ? '✓' : 'Copiar'}</button>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={waShareLink(msgWhats)} target="_blank" rel="noreferrer" className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30">Compartilhar no WhatsApp</a>
          <a href={`mailto:?subject=${encodeURIComponent('Convite para anunciar na VENTSY')}&body=${encodeURIComponent(msgWhats)}`} className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30">Enviar por e-mail</a>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Kpi label="Indicados" value={String(kpis.indicados)} />
        <Kpi label="Publicaram" value={String(kpis.publicaram)} color="text-emerald-600" />
        <Kpi label="Meses grátis" value={String(kpis.creditos)} color="text-brand" />
      </div>

      {/* Como funciona */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { n: '1', t: 'Compartilhe seu link', d: 'Envie para outros donos de espaços.' },
          { n: '2', t: 'Eles publicam o anúncio', d: 'Quando o anúncio é aprovado, conta como indicação.' },
          { n: '3', t: 'Você ganha', d: 'Receba 1 mês grátis por indicação publicada.' },
        ].map((p) => (
          <div key={p.n} className="rounded-2xl bg-white p-5 shadow-card">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand">{p.n}</div>
            <div className="mt-3 font-bold text-ink">{p.t}</div>
            <div className="mt-1 text-sm text-ink-muted">{p.d}</div>
          </div>
        ))}
      </div>

      {/* Histórico */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Suas indicações</h3>
        {lista.length === 0 ? (
          <div className="py-10 text-center text-sm text-ink-muted">🔗 Nenhuma indicação ainda. Compartilhe seu link e comece a ganhar!</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Propriedade</th>
                  <th className="pb-2 font-semibold">Data</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Recompensa</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((i, idx) => (
                  <tr key={idx} className="border-b border-black/[0.04]">
                    <td className="py-2.5 font-semibold text-ink">{i.propriedade || '—'}</td>
                    <td className="py-2.5 text-ink-muted">{i.data || '—'}</td>
                    <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${i.status && i.status !== 'pendente' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{i.status_label || '—'}</span></td>
                    <td className="py-2.5">{i.recompensa === 'ganho' ? <span className="font-semibold text-emerald-600">✅ {i.recompensa_label}</span> : <span className="text-ink-muted">{i.recompensa_label || '—'}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, color = 'text-ink' }: { label: string; value: string; color?: string }) {
  return <div className="rounded-2xl bg-white p-4 shadow-card"><div className="text-xs text-ink-muted">{label}</div><div className={`mt-2 text-2xl font-bold ${color}`}>{value}</div></div>;
}

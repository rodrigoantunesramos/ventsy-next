'use client';

// Relatórios — /painel/relatorios.
// Desempenho real do anúncio a partir de `analytics_eventos` (por propriedade) +
// buscas populares (`buscas`). Sem Chart.js (barras em CSS). Estados vazios.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatNumber } from '@/lib/format';

type Evento = { evento_tipo: string; created_at: string | null };

const METRICAS = [
  { key: 'view', label: 'Visualizações', icon: '👁️', color: '#ff385c' },
  { key: 'ver_fotos', label: 'Ver fotos', icon: '📸', color: '#3b82f6' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '📱', color: '#22c55e' },
  { key: 'formulario', label: 'Formulários', icon: '📋', color: '#f59e0b' },
  { key: 'instagram', label: 'Instagram', icon: '📷', color: '#e1306c' },
  { key: 'facebook', label: 'Facebook', icon: '👍', color: '#1877f2' },
  { key: 'youtube', label: 'YouTube', icon: '▶️', color: '#ff0000' },
];
const PERIODOS = [{ v: 7, label: '7 dias' }, { v: 30, label: '30 dias' }, { v: 365, label: '12 meses' }];

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [temProp, setTemProp] = useState(true);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [buscas, setBuscas] = useState<{ nome: string; n: number }[]>([]);
  const [dias, setDias] = useState(30);

  const carregar = useCallback(async (uid: string) => {
    const { data: props } = await sb.from('propriedades').select('id').eq('usuario_id', uid).order('id').limit(1);
    const pid = props?.[0]?.id;
    if (!pid) { setTemProp(false); return; }
    try {
      const { data } = await sb.from('analytics_eventos').select('evento_tipo,created_at').eq('propriedade_id', String(pid)).order('created_at', { ascending: false }).limit(5000);
      setEventos((data || []) as Evento[]);
    } catch { setEventos([]); }
    try {
      const { data } = await sb.from('buscas').select('tipo_evento').not('tipo_evento', 'is', null).limit(5000);
      const cont: Record<string, number> = {};
      (data || []).forEach((b: { tipo_evento: string | null }) => { const t = (b.tipo_evento || '').trim(); if (t) cont[t] = (cont[t] || 0) + 1; });
      setBuscas(Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 7).map(([nome, n]) => ({ nome, n })));
    } catch { setBuscas([]); }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const cutoff = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - dias); return d.getTime(); }, [dias]);
  const noPeriodo = useMemo(() => eventos.filter((e) => e.created_at && new Date(e.created_at).getTime() >= cutoff), [eventos, cutoff]);
  const totais = useMemo(() => {
    const m: Record<string, number> = {};
    noPeriodo.forEach((e) => { m[e.evento_tipo] = (m[e.evento_tipo] || 0) + 1; });
    return m;
  }, [noPeriodo]);
  const maxTotal = Math.max(1, ...METRICAS.map((m) => totais[m.key] || 0));
  const maxBusca = Math.max(1, ...buscas.map((b) => b.n));

  if (loading) return <div className="mx-auto h-[480px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  if (!temProp) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios</h1>
        <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center text-sm text-ink-muted shadow-card">
          Cadastre sua propriedade para acompanhar o desempenho do anúncio.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios</h1>
          <p className="mt-1 text-sm text-ink-muted">Desempenho do seu anúncio nos últimos {dias === 365 ? '12 meses' : `${dias} dias`}.</p>
        </div>
        <div className="flex gap-1 rounded-full border border-black/10 bg-white p-1 text-sm">
          {PERIODOS.map((p) => (
            <button key={p.v} onClick={() => setDias(p.v)} className={`rounded-full px-3 py-1.5 font-semibold transition ${dias === p.v ? 'bg-ink text-white' : 'text-ink-muted'}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {/* KPIs principais */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICAS.slice(0, 4).map((m) => (
          <div key={m.key} className="rounded-2xl bg-white p-4 shadow-card">
            <div className="text-lg">{m.icon}</div>
            <div className="mt-2 text-2xl font-bold text-ink">{formatNumber(totais[m.key] || 0)}</div>
            <div className="text-xs text-ink-muted">{m.label}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        {/* Tabela de métricas */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Métricas do período</h3>
          {noPeriodo.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Ainda não há dados de desempenho neste período. As métricas aparecem conforme as pessoas interagem com seu anúncio.</p>
          ) : (
            <div className="space-y-3">
              {METRICAS.map((m) => {
                const total = totais[m.key] || 0;
                const media = (total / dias).toFixed(1);
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="flex w-40 items-center gap-2 text-sm"><span>{m.icon}</span><span className="text-ink-soft">{m.label}</span></div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                      <div className="h-full rounded-full" style={{ width: `${Math.round((total / maxTotal) * 100)}%`, background: m.color }} />
                    </div>
                    <div className="w-16 text-right text-sm font-bold text-ink">{formatNumber(total)}</div>
                    <div className="w-14 text-right text-xs text-ink-muted">{media}/dia</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buscas populares */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-ink">Buscas populares</h3>
          <p className="text-xs text-ink-muted">Tipos de evento mais procurados na Ventsy.</p>
          {buscas.length === 0 ? (
            <p className="mt-4 text-sm text-ink-muted">Sem dados de buscas.</p>
          ) : (
            <div className="mt-4 space-y-3">
              {buscas.map((b) => (
                <div key={b.nome}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="font-semibold text-ink-soft">{b.nome}</span><span className="text-ink-muted">{b.n}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((b.n / maxBusca) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

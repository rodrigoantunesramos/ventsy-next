'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatNumber } from '@/lib/format';

type Evento = { evento_tipo: string; created_at: string | null };

const METRICAS = [
  { key: 'view',       label: 'Visualizações', icon: '👁️', color: '#ff385c' },
  { key: 'ver_fotos',  label: 'Ver fotos',      icon: '📸', color: '#3b82f6' },
  { key: 'whatsapp',   label: 'WhatsApp',       icon: '📱', color: '#22c55e' },
  { key: 'formulario', label: 'Formulários',    icon: '📋', color: '#f59e0b' },
  { key: 'instagram',  label: 'Instagram',      icon: '📷', color: '#e1306c' },
  { key: 'facebook',   label: 'Facebook',       icon: '👍', color: '#1877f2' },
  { key: 'youtube',    label: 'YouTube',        icon: '▶️', color: '#ff0000' },
];

const PERIODOS = [
  { v: 7,   label: '7 dias'    },
  { v: 30,  label: '30 dias'   },
  { v: 365, label: '12 meses'  },
];

export default function RelatoriosPage() {
  const [loading, setLoading]   = useState(true);
  const [temProp, setTemProp]   = useState(true);
  const [eventos, setEventos]   = useState<Evento[]>([]);
  const [buscas, setBuscas]     = useState<{ nome: string; n: number }[]>([]);
  const [dias, setDias]         = useState(30);

  const carregar = useCallback(async (uid: string) => {
    const { data: props } = await sb
      .from('propriedades')
      .select('id')
      .eq('usuario_id', uid)
      .order('id')
      .limit(1);
    const pid = props?.[0]?.id;
    if (!pid) { setTemProp(false); return; }

    // Carrega até 2× o período máximo para suportar comparação com período anterior
    try {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 365 * 2);
      const { data } = await sb
        .from('analytics_eventos')
        .select('evento_tipo,created_at')
        .eq('propriedade_id', String(pid))
        .gte('created_at', cutoff.toISOString())
        .order('created_at', { ascending: false })
        .limit(10000);
      setEventos((data || []) as Evento[]);
    } catch { setEventos([]); }

    try {
      const { data } = await sb
        .from('buscas')
        .select('tipo_evento')
        .not('tipo_evento', 'is', null)
        .limit(5000);
      const cont: Record<string, number> = {};
      (data || []).forEach((b: { tipo_evento: string | null }) => {
        const t = (b.tipo_evento || '').trim();
        if (t) cont[t] = (cont[t] || 0) + 1;
      });
      setBuscas(
        Object.entries(cont)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 7)
          .map(([nome, n]) => ({ nome, n })),
      );
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

  // ── Partição atual vs anterior ────────────────────────────────────────────
  const { noPeriodo, noPeriodoPrev } = useMemo(() => {
    const now = Date.now();
    const cutoffAtual = now - dias * 24 * 60 * 60 * 1000;
    const cutoffPrev  = now - dias * 2 * 24 * 60 * 60 * 1000;
    return {
      noPeriodo:     eventos.filter((e) => e.created_at && new Date(e.created_at).getTime() >= cutoffAtual),
      noPeriodoPrev: eventos.filter((e) => {
        if (!e.created_at) return false;
        const t = new Date(e.created_at).getTime();
        return t >= cutoffPrev && t < cutoffAtual;
      }),
    };
  }, [eventos, dias]);

  const totais = useMemo(() => {
    const m: Record<string, number> = {};
    noPeriodo.forEach((e) => { m[e.evento_tipo] = (m[e.evento_tipo] || 0) + 1; });
    return m;
  }, [noPeriodo]);

  const totaisPrev = useMemo(() => {
    const m: Record<string, number> = {};
    noPeriodoPrev.forEach((e) => { m[e.evento_tipo] = (m[e.evento_tipo] || 0) + 1; });
    return m;
  }, [noPeriodoPrev]);

  // ── Métricas resumo ───────────────────────────────────────────────────────
  const totalInteracoes     = useMemo(() => METRICAS.reduce((s, m) => s + (totais[m.key] || 0), 0),     [totais]);
  const totalInteracoesPrev = useMemo(() => METRICAS.reduce((s, m) => s + (totaisPrev[m.key] || 0), 0), [totaisPrev]);

  const interacoesDelta = totalInteracoesPrev > 0
    ? Math.round(((totalInteracoes - totalInteracoesPrev) / totalInteracoesPrev) * 100)
    : null;

  const viewsDelta = (totaisPrev['view'] || 0) > 0
    ? Math.round((((totais['view'] || 0) - (totaisPrev['view'] || 0)) / (totaisPrev['view'] || 1)) * 100)
    : null;

  const taxaConversao = useMemo(() => {
    const views = totais['view'] || 0;
    const wpp   = totais['whatsapp'] || 0;
    return views > 0 ? ((wpp / views) * 100).toFixed(1) : null;
  }, [totais]);

  const mediaDiaria = dias > 0 ? (totalInteracoes / dias).toFixed(1) : '0';

  const maxTotal = Math.max(1, ...METRICAS.map((m) => totais[m.key] || 0));
  const maxBusca = Math.max(1, ...buscas.map((b) => b.n));

  // ── Export CSV ────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const rows = [
      ['Métrica', 'Total', 'Média/dia', 'Variação (%)'],
      ...METRICAS.map((m) => {
        const total = totais[m.key] || 0;
        const prev  = totaisPrev[m.key] || 0;
        const delta = prev > 0 ? Math.round(((total - prev) / prev) * 100) : '';
        return [m.label, String(total), (total / dias).toFixed(1), String(delta)];
      }),
    ];
    const csv  = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `relatorio-ventsy-${dias}dias.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-5">
      <div className="h-14 rounded-2xl bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0,1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />)}
      </div>
      <div className="h-64 rounded-2xl bg-black/[0.05]" />
    </div>
  );

  if (!temProp) return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center text-sm text-ink-muted shadow-card">
        Cadastre sua propriedade para acompanhar o desempenho do anúncio.
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5">

      {/* Cabeçalho ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Desempenho do seu anúncio nos últimos {dias === 365 ? '12 meses' : `${dias} dias`}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 rounded-full border border-black/10 bg-white p-1 text-sm">
            {PERIODOS.map((p) => (
              <button
                key={p.v}
                onClick={() => setDias(p.v)}
                className={`rounded-full px-3 py-1.5 font-semibold transition ${
                  dias === p.v ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportCSV}
            className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Cards resumo ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="Total de interações"
          value={formatNumber(totalInteracoes)}
          delta={interacoesDelta}
          sub="vs período anterior"
        />
        <SummaryCard
          label="Visualizações"
          value={formatNumber(totais['view'] || 0)}
          delta={viewsDelta}
          sub="visitas ao anúncio"
        />
        <SummaryCard
          label="Taxa de conversão"
          value={taxaConversao != null ? `${taxaConversao}%` : '—'}
          sub="visualizações → WhatsApp"
        />
        <SummaryCard
          label="Média diária"
          value={mediaDiaria}
          sub="interações / dia"
        />
      </div>

      {/* Tabela de métricas + Buscas ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">

        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Métricas do período</h3>
          {noPeriodo.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-muted">
              Ainda não há dados neste período.{' '}
              As métricas aparecem conforme as pessoas interagem com seu anúncio.
            </p>
          ) : (
            <div className="space-y-4">
              {METRICAS.map((m) => {
                const total = totais[m.key]     || 0;
                const prev  = totaisPrev[m.key] || 0;
                const media = (total / dias).toFixed(1);
                const delta = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;
                return (
                  <div key={m.key} className="flex items-center gap-3">
                    <div className="flex w-36 shrink-0 items-center gap-2 text-sm">
                      <span>{m.icon}</span>
                      <span className="truncate text-ink-soft">{m.label}</span>
                    </div>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.round((total / maxTotal) * 100)}%`, background: m.color }}
                      />
                    </div>
                    <div className="w-12 shrink-0 text-right text-sm font-bold text-ink">{formatNumber(total)}</div>
                    <div className="w-12 shrink-0 text-right text-xs text-ink-muted">{media}/dia</div>
                    {delta != null && delta !== 0 ? (
                      <span className={`w-14 shrink-0 text-right text-[0.65rem] font-bold ${
                        delta > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}>
                        {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%
                      </span>
                    ) : (
                      <span className="w-14 shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Buscas populares ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-ink">Buscas populares</h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            Tipos de evento mais pesquisados na plataforma Ventsy.
          </p>
          {buscas.length === 0 ? (
            <p className="mt-6 text-sm text-ink-muted">Sem dados de buscas.</p>
          ) : (
            <div className="mt-4 space-y-3.5">
              {buscas.map((b, i) => (
                <div key={b.nome}>
                  <div className="mb-1.5 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
                      <span className="w-4 text-right font-normal tabular-nums text-ink-muted/50">{i + 1}.</span>
                      {b.nome}
                    </span>
                    <span className="tabular-nums text-ink-muted">{b.n}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div
                      className="h-full rounded-full bg-brand transition-all duration-500"
                      style={{ width: `${Math.round((b.n / maxBusca) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Componentes ───────────────────────────────────────────────────────────────

function SummaryCard({
  label, value, delta, sub,
}: {
  label: string; value: string; delta?: number | null; sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-muted/80">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-bold text-ink leading-none">{value}</div>
        {delta != null && delta !== 0 && (
          <span className={`mb-0.5 shrink-0 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
            delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      {sub && <div className="mt-1 text-xs text-ink-muted">{sub}</div>}
    </div>
  );
}

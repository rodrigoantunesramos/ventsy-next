'use client';

// Relatórios — /painel/relatorios.
// Dashboard de analytics premium do anúncio. Usa apenas sinais REAIS de
// analytics_eventos (view / whatsapp / formulario) + reservas (funil de fundo).
// Tudo client-side, sem libs de chart (SVG/CSS). PDF via jsPDF (dynamic import).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatNumber, formatMoney } from '@/lib/format';

type Evento = { evento_tipo: string; created_at: string | null };
type Reserva = { created_at: string | null; status: string | null; valor_estimado: number | null };

const PERIODOS = [
  { v: 7,   label: '7 dias'   },
  { v: 30,  label: '30 dias'  },
  { v: 365, label: '12 meses' },
];

// Métricas reais — só o que realmente é rastreado.
const METRICAS = [
  { key: 'view',       label: 'Visualizações', icon: '👁️', color: '#ff385c' },
  { key: 'whatsapp',   label: 'WhatsApp',      icon: '📱', color: '#22c55e' },
  { key: 'formulario', label: 'Formulários',   icon: '📋', color: '#f59e0b' },
];

const DIA = 24 * 60 * 60 * 1000;
const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(true);
  const [temProp, setTemProp] = useState(true);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [reservas, setReservas] = useState<Reserva[]>([]);
  const [buscas, setBuscas] = useState<{ nome: string; n: number }[]>([]);
  const [benchConv, setBenchConv] = useState<number | null>(null);
  const [dias, setDias] = useState(30);
  const [exporting, setExporting] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const { data: props } = await sb
      .from('propriedades')
      .select('id,nome')
      .eq('usuario_id', uid)
      .order('id')
      .limit(1);
    const pid = props?.[0]?.id;
    if (!pid) { setTemProp(false); return; }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 365 * 2);
    const cutoffISO = cutoff.toISOString();

    // Eventos da propriedade (2 anos para suportar comparação)
    try {
      const { data } = await sb
        .from('analytics_eventos')
        .select('evento_tipo,created_at')
        .eq('propriedade_id', String(pid))
        .gte('created_at', cutoffISO)
        .order('created_at', { ascending: false })
        .limit(10000);
      setEventos((data || []) as Evento[]);
    } catch { setEventos([]); }

    // Reservas (fundo do funil + pipeline de receita)
    try {
      const { data } = await sb
        .from('reservas')
        .select('created_at,status,valor_estimado')
        .eq('propriedade_id', pid)
        .gte('created_at', cutoffISO)
        .limit(5000);
      setReservas((data || []) as Reserva[]);
    } catch { setReservas([]); }

    // Buscas populares (plataforma)
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
        Object.entries(cont).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([nome, n]) => ({ nome, n })),
      );
    } catch { setBuscas([]); }

    // Benchmark de plataforma — taxa média view→whatsapp (degrada se RLS bloquear)
    try {
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data } = await sb
        .from('analytics_eventos')
        .select('evento_tipo,propriedade_id')
        .gte('created_at', since.toISOString())
        .limit(20000);
      const rows = (data || []) as { evento_tipo: string; propriedade_id: string }[];
      const props = new Set(rows.map((r) => r.propriedade_id));
      // Só é um benchmark real se enxergamos mais de uma propriedade.
      if (props.size > 1) {
        const v = rows.filter((r) => r.evento_tipo === 'view').length;
        const w = rows.filter((r) => r.evento_tipo === 'whatsapp').length;
        if (v > 0) setBenchConv((w / v) * 100);
      }
    } catch { /* benchmark é opcional */ }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  // ── Janelas de tempo ────────────────────────────────────────────────────────
  const { evAtual, evPrev, resAtual } = useMemo(() => {
    const now = Date.now();
    const cAtual = now - dias * DIA;
    const cPrev = now - dias * 2 * DIA;
    const inWindow = (ts: string | null, lo: number, hi: number) => {
      if (!ts) return false;
      const t = new Date(ts).getTime();
      return t >= lo && t < hi;
    };
    return {
      evAtual: eventos.filter((e) => e.created_at && new Date(e.created_at).getTime() >= cAtual),
      evPrev: eventos.filter((e) => inWindow(e.created_at, cPrev, cAtual)),
      resAtual: reservas.filter((r) => r.created_at && new Date(r.created_at).getTime() >= cAtual),
    };
  }, [eventos, reservas, dias]);

  const totais = useMemo(() => contar(evAtual), [evAtual]);
  const totaisPrev = useMemo(() => contar(evPrev), [evPrev]);

  const views = totais['view'] || 0;
  const viewsPrev = totaisPrev['view'] || 0;
  const contatos = (totais['whatsapp'] || 0) + (totais['formulario'] || 0);
  const contatosPrev = (totaisPrev['whatsapp'] || 0) + (totaisPrev['formulario'] || 0);
  const nReservas = resAtual.length;
  const pipeline = useMemo(
    () => resAtual.reduce((s, r) => s + (Number(r.valor_estimado) || 0), 0),
    [resAtual],
  );

  const taxaConversao = views > 0 ? (contatos / views) * 100 : null;
  const taxaReserva = contatos > 0 ? (nReservas / contatos) * 100 : null;

  // ── Série temporal ──────────────────────────────────────────────────────────
  const serie = useMemo(() => construirSerie(evAtual, resAtual, dias), [evAtual, resAtual, dias]);

  // ── Distribuições derivadas ─────────────────────────────────────────────────
  const porDiaSemana = useMemo(() => {
    const c = new Array(7).fill(0);
    evAtual.forEach((e) => { if (e.evento_tipo === 'view' && e.created_at) c[new Date(e.created_at).getDay()]++; });
    return c;
  }, [evAtual]);

  const porHora = useMemo(() => {
    const c = new Array(24).fill(0);
    evAtual.forEach((e) => { if (e.evento_tipo === 'view' && e.created_at) c[new Date(e.created_at).getHours()]++; });
    return c;
  }, [evAtual]);

  const melhorDiaIdx = porDiaSemana.some((n) => n > 0) ? porDiaSemana.indexOf(Math.max(...porDiaSemana)) : -1;
  const picoHora = porHora.some((n) => n > 0) ? porHora.indexOf(Math.max(...porHora)) : -1;

  // ── Insights automáticos ────────────────────────────────────────────────────
  const insights = useMemo(() => {
    const out: { icon: string; texto: string; tom: 'up' | 'down' | 'neutro' }[] = [];
    const totA = views + contatos;
    const totP = viewsPrev + contatosPrev;
    if (totP > 0) {
      const d = Math.round(((totA - totP) / totP) * 100);
      if (d !== 0) out.push({
        icon: d > 0 ? '📈' : '📉',
        texto: `Suas interações ${d > 0 ? 'cresceram' : 'caíram'} ${Math.abs(d)}% vs o período anterior.`,
        tom: d > 0 ? 'up' : 'down',
      });
    }
    if (melhorDiaIdx >= 0) out.push({
      icon: '🗓️', tom: 'neutro',
      texto: `${diaSemanaExtenso(melhorDiaIdx)} é o dia que seu anúncio mais recebe visitas.`,
    });
    if (taxaConversao != null) out.push({
      icon: '🎯', tom: taxaConversao >= (benchConv ?? 0) ? 'up' : 'neutro',
      texto: `Você converte ${taxaConversao.toFixed(1)}% das visitas em contato${
        benchConv != null ? ` (média da plataforma: ${benchConv.toFixed(1)}%)` : ''
      }.`,
    });
    if (nReservas > 0) out.push({
      icon: '🤝', tom: 'up',
      texto: `${nReservas} ${nReservas === 1 ? 'reserva solicitada' : 'reservas solicitadas'}${
        pipeline > 0 ? ` — ${formatMoney(pipeline)} em pipeline.` : '.'
      }`,
    });
    return out.slice(0, 4);
  }, [views, contatos, viewsPrev, contatosPrev, melhorDiaIdx, taxaConversao, benchConv, nReservas, pipeline]);

  // ── Deltas ──────────────────────────────────────────────────────────────────
  const viewsDelta = pctDelta(views, viewsPrev);
  const contatosDelta = pctDelta(contatos, contatosPrev);

  const rotuloPeriodo = dias === 365 ? '12 meses' : `${dias} dias`;

  // ── Exports ─────────────────────────────────────────────────────────────────
  const linhasExport = () => ([
    ['Métrica', 'Total', 'Média/dia'],
    ['Visualizações', String(views), (views / dias).toFixed(1)],
    ['Contatos', String(contatos), (contatos / dias).toFixed(1)],
    ['  WhatsApp', String(totais['whatsapp'] || 0), ((totais['whatsapp'] || 0) / dias).toFixed(1)],
    ['  Formulários', String(totais['formulario'] || 0), ((totais['formulario'] || 0) / dias).toFixed(1)],
    ['Reservas solicitadas', String(nReservas), (nReservas / dias).toFixed(1)],
    ['Pipeline (R$)', String(pipeline), ''],
    ['Taxa de conversão (%)', taxaConversao != null ? taxaConversao.toFixed(1) : '0', ''],
  ]);

  const exportCSV = () => {
    const csv = linhasExport().map((r) => r.join(',')).join('\n');
    baixar(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `relatorio-ventsy-${dias}dias.csv`);
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const M = 48;
      let y = 56;
      doc.setFontSize(20); doc.setTextColor('#ff385c');
      doc.text('VENTSY', M, y);
      doc.setFontSize(13); doc.setTextColor('#222');
      doc.text('Relatório de desempenho', M, y + 22);
      doc.setFontSize(10); doc.setTextColor('#888');
      doc.text(`Período: últimos ${rotuloPeriodo}  ·  Gerado em ${new Date().toLocaleDateString('pt-BR')}`, M, y + 40);
      y += 76;

      // Cards de resumo
      const resumo: [string, string][] = [
        ['Visualizações', formatNumber(views)],
        ['Contatos', formatNumber(contatos)],
        ['Reservas', formatNumber(nReservas)],
        ['Pipeline', pipeline > 0 ? formatMoney(pipeline) : '—'],
        ['Taxa de conversão', taxaConversao != null ? `${taxaConversao.toFixed(1)}%` : '—'],
      ];
      doc.setDrawColor('#eee');
      resumo.forEach(([k, v]) => {
        doc.setFontSize(10); doc.setTextColor('#888'); doc.text(k, M, y);
        doc.setFontSize(13); doc.setTextColor('#111'); doc.text(v, 320, y);
        doc.line(M, y + 8, 547, y + 8);
        y += 30;
      });

      doc.setFontSize(8); doc.setTextColor('#aaa');
      doc.text('Gerado automaticamente pela Ventsy · ventsy.com.br', M, 800);
      doc.save(`relatorio-ventsy-${dias}dias.pdf`);
    } catch { /* jsPDF indisponível */ }
    finally { setExporting(false); }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) return <RelSkeleton />;

  if (!temProp) return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios</h1>
      <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center text-sm text-ink-muted shadow-card">
        Cadastre sua propriedade para acompanhar o desempenho do anúncio.
      </div>
    </div>
  );

  const semDados = evAtual.length === 0 && resAtual.length === 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">

      {/* Cabeçalho ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Relatórios</h1>
          <p className="mt-1 text-sm text-ink-muted">Desempenho do seu anúncio nos últimos {rotuloPeriodo}.</p>
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
          <button onClick={exportCSV} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand">
            CSV
          </button>
          <button onClick={exportPDF} disabled={exporting} className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand disabled:opacity-50">
            {exporting ? '…' : 'PDF'}
          </button>
        </div>
      </div>

      {semDados ? (
        <div className="rounded-2xl border border-dashed border-black/10 bg-white p-12 text-center shadow-card">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl">📊</div>
          <h3 className="text-base font-bold text-ink">Ainda sem dados neste período</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Assim que as pessoas visitarem e interagirem com seu anúncio, seus números de desempenho aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Insights ──────────────────────────────────────────────────────────── */}
          {insights.length > 0 && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {insights.map((ins, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-2.5 rounded-xl border p-3 text-sm ${
                    ins.tom === 'up' ? 'border-emerald-100 bg-emerald-50/60 text-emerald-900'
                      : ins.tom === 'down' ? 'border-amber-100 bg-amber-50/60 text-amber-900'
                      : 'border-black/[0.06] bg-white text-ink-soft'
                  }`}
                >
                  <span className="text-base leading-none">{ins.icon}</span>
                  <span className="leading-snug">{ins.texto}</span>
                </div>
              ))}
            </div>
          )}

          {/* Cards resumo ──────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard label="Visualizações" value={formatNumber(views)} delta={viewsDelta} sub="visitas ao anúncio" />
            <SummaryCard label="Contatos" value={formatNumber(contatos)} delta={contatosDelta} sub="WhatsApp + formulário" />
            <SummaryCard label="Reservas" value={formatNumber(nReservas)} sub="solicitações recebidas" />
            <SummaryCard label="Pipeline" value={pipeline > 0 ? formatMoney(pipeline) : '—'} sub="valor estimado" />
          </div>

          {/* Gráfico de série temporal ─────────────────────────────────────────── */}
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-bold text-ink">Evolução no período</h3>
              <div className="flex items-center gap-4 text-xs">
                <Legenda cor="#ff385c" label="Visualizações" />
                <Legenda cor="#22c55e" label="Contatos" />
              </div>
            </div>
            <AreaChart serie={serie} />
          </div>

          {/* Funil + Canais ────────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Funil de conversão</h3>
              <Funil
                etapas={[
                  { label: 'Visualizações', n: views, cor: '#ff385c' },
                  { label: 'Contatos', n: contatos, cor: '#f59e0b', taxa: taxaConversao },
                  { label: 'Reservas', n: nReservas, cor: '#22c55e', taxa: taxaReserva },
                ]}
              />
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Canais de contato</h3>
              <CanaisContato wpp={totais['whatsapp'] || 0} form={totais['formulario'] || 0} />
              <div className="mt-5 border-t border-black/[0.05] pt-4">
                <h4 className="text-sm font-bold text-ink">Horário de pico</h4>
                <HoraStrip horas={porHora} pico={picoHora} />
              </div>
            </div>
          </div>

          {/* Melhor dia + Métricas reais ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Visitas por dia da semana</h3>
              <DiaSemanaBars dados={porDiaSemana} melhor={melhorDiaIdx} />
            </div>

            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-4 text-base font-bold text-ink">Métricas do período</h3>
              <div className="space-y-4">
                {METRICAS.map((m) => {
                  const total = totais[m.key] || 0;
                  const prev = totaisPrev[m.key] || 0;
                  const delta = prev > 0 ? Math.round(((total - prev) / prev) * 100) : null;
                  const max = Math.max(1, ...METRICAS.map((x) => totais[x.key] || 0));
                  return (
                    <div key={m.key} className="flex items-center gap-3">
                      <div className="flex w-32 shrink-0 items-center gap-2 text-sm">
                        <span>{m.icon}</span><span className="truncate text-ink-soft">{m.label}</span>
                      </div>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-black/[0.06]">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((total / max) * 100)}%`, background: m.color }} />
                      </div>
                      <div className="w-12 shrink-0 text-right text-sm font-bold text-ink">{formatNumber(total)}</div>
                      {delta != null && delta !== 0 ? (
                        <span className={`w-12 shrink-0 text-right text-[0.65rem] font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}%
                        </span>
                      ) : <span className="w-12 shrink-0" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Buscas + Benchmark ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-bold text-ink">Buscas populares</h3>
                <span className="text-xs text-ink-muted">plataforma Ventsy</span>
              </div>
              {buscas.length === 0 ? (
                <p className="mt-6 text-sm text-ink-muted">Sem dados de buscas.</p>
              ) : (
                <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                  {buscas.map((b, i) => {
                    const max = Math.max(1, ...buscas.map((x) => x.n));
                    return (
                      <div key={b.nome}>
                        <div className="mb-1.5 flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 font-semibold text-ink-soft">
                            <span className="w-4 text-right font-normal tabular-nums text-ink-muted/50">{i + 1}.</span>{b.nome}
                          </span>
                          <span className="tabular-nums text-ink-muted">{b.n}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                          <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.round((b.n / max) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-2xl bg-gradient-to-br from-ink to-ink-soft p-5 text-white shadow-card">
              <h3 className="text-base font-bold">Benchmark</h3>
              {benchConv != null && taxaConversao != null ? (
                <>
                  <p className="mt-1 text-xs text-white/60">Sua taxa de conversão vs a média da plataforma.</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-bold leading-none">{taxaConversao.toFixed(1)}%</span>
                    <span className={`mb-1 rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
                      taxaConversao >= benchConv ? 'bg-emerald-400/20 text-emerald-300' : 'bg-amber-400/20 text-amber-300'
                    }`}>
                      {taxaConversao >= benchConv ? 'acima' : 'abaixo'} da média
                    </span>
                  </div>
                  <div className="mt-3 text-xs text-white/60">Média da plataforma: <strong className="text-white/90">{benchConv.toFixed(1)}%</strong></div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/15">
                    <div className="h-full rounded-full bg-white" style={{ width: `${Math.min(100, Math.round((taxaConversao / Math.max(benchConv * 2, 0.1)) * 100))}%` }} />
                  </div>
                </>
              ) : (
                <p className="mt-2 text-sm text-white/70">
                  O comparativo com a média da plataforma aparece quando há volume suficiente de dados.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Helpers de dados ──────────────────────────────────────────────────────────

function contar(evs: Evento[]): Record<string, number> {
  const m: Record<string, number> = {};
  evs.forEach((e) => { m[e.evento_tipo] = (m[e.evento_tipo] || 0) + 1; });
  return m;
}

function pctDelta(atual: number, prev: number): number | null {
  return prev > 0 ? Math.round(((atual - prev) / prev) * 100) : null;
}

function diaSemanaExtenso(i: number): string {
  return ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][i] || '—';
}

type Ponto = { label: string; views: number; contatos: number; reservas: number };

function construirSerie(evs: Evento[], res: Reserva[], dias: number): Ponto[] {
  const now = new Date();
  const pontos: Ponto[] = [];

  if (dias <= 30) {
    // Buckets diários
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(now); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const ini = d.getTime(); const fim = ini + DIA;
      pontos.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        views: contaJanela(evs, 'view', ini, fim),
        contatos: contaJanela(evs, 'whatsapp', ini, fim) + contaJanela(evs, 'formulario', ini, fim),
        reservas: res.filter((r) => emJanela(r.created_at, ini, fim)).length,
      });
    }
  } else {
    // Buckets mensais (12 meses)
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ini = d.getTime();
      const fim = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
      pontos.push({
        label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        views: contaJanela(evs, 'view', ini, fim),
        contatos: contaJanela(evs, 'whatsapp', ini, fim) + contaJanela(evs, 'formulario', ini, fim),
        reservas: res.filter((r) => emJanela(r.created_at, ini, fim)).length,
      });
    }
  }
  return pontos;
}

function emJanela(ts: string | null, ini: number, fim: number): boolean {
  if (!ts) return false;
  const t = new Date(ts).getTime();
  return t >= ini && t < fim;
}

function contaJanela(evs: Evento[], tipo: string, ini: number, fim: number): number {
  return evs.filter((e) => e.evento_tipo === tipo && emJanela(e.created_at, ini, fim)).length;
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nome; a.click();
  URL.revokeObjectURL(url);
}

// ── Componentes visuais ───────────────────────────────────────────────────────

function SummaryCard({ label, value, delta, sub }: { label: string; value: string; delta?: number | null; sub?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-[0.68rem] font-bold uppercase tracking-wider text-ink-muted/80">{label}</div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="text-2xl font-bold leading-none text-ink">{value}</div>
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

function Legenda({ cor, label }: { cor: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-ink-muted">
      <span className="h-2 w-2 rounded-full" style={{ background: cor }} />{label}
    </span>
  );
}

function AreaChart({ serie }: { serie: Ponto[] }) {
  const W = 760, H = 180, P = 8;
  const max = Math.max(1, ...serie.map((p) => Math.max(p.views, p.contatos)));
  const n = serie.length;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, n - 1);
  const y = (v: number) => H - P - (v / max) * (H - 2 * P - 14);

  const linha = (sel: (p: Ponto) => number) =>
    serie.map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(sel(p)).toFixed(1)}`).join(' ');
  const area = (sel: (p: Ponto) => number) =>
    `${linha(sel)} L ${x(n - 1).toFixed(1)} ${H - P} L ${x(0).toFixed(1)} ${H - P} Z`;

  // Rótulos do eixo X — no máx. ~7 para não poluir
  const step = Math.ceil(n / 7);

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" preserveAspectRatio="none" style={{ height: 'auto' }}>
        <defs>
          <linearGradient id="gradViews" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff385c" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#ff385c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area((p) => p.views)} fill="url(#gradViews)" />
        <path d={linha((p) => p.views)} fill="none" stroke="#ff385c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <path d={linha((p) => p.contatos)} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.views)} r="2.5" fill="#ff385c" />
        ))}
        {serie.map((p, i) => (i % step === 0 || i === n - 1) ? (
          <text key={`t${i}`} x={x(i)} y={H + 12} fontSize="9" fill="#9ca3af" textAnchor="middle">{p.label}</text>
        ) : null)}
      </svg>
    </div>
  );
}

function Funil({ etapas }: { etapas: { label: string; n: number; cor: string; taxa?: number | null }[] }) {
  const max = Math.max(1, etapas[0]?.n || 1);
  return (
    <div className="space-y-3">
      {etapas.map((e, i) => (
        <div key={e.label}>
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold text-ink-soft">{e.label}</span>
            <span className="flex items-center gap-2">
              <span className="font-bold text-ink">{formatNumber(e.n)}</span>
              {i > 0 && e.taxa != null && (
                <span className="rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-bold text-ink-muted">
                  {e.taxa.toFixed(1)}%
                </span>
              )}
            </span>
          </div>
          <div className="h-7 overflow-hidden rounded-lg bg-black/[0.04]">
            <div
              className="flex h-full items-center rounded-lg transition-all duration-700"
              style={{ width: `${Math.max(4, Math.round((e.n / max) * 100))}%`, background: e.cor }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function CanaisContato({ wpp, form }: { wpp: number; form: number }) {
  const total = wpp + form;
  if (total === 0) return <p className="text-sm text-ink-muted">Nenhum contato no período.</p>;
  const pWpp = Math.round((wpp / total) * 100);
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full">
        <div className="bg-[#22c55e]" style={{ width: `${pWpp}%` }} />
        <div className="bg-[#f59e0b]" style={{ width: `${100 - pWpp}%` }} />
      </div>
      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#22c55e]" />WhatsApp</span>
        <span className="font-bold text-ink">{formatNumber(wpp)} <span className="text-xs font-normal text-ink-muted">({pWpp}%)</span></span>
      </div>
      <div className="mt-1.5 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#f59e0b]" />Formulário</span>
        <span className="font-bold text-ink">{formatNumber(form)} <span className="text-xs font-normal text-ink-muted">({100 - pWpp}%)</span></span>
      </div>
    </div>
  );
}

function DiaSemanaBars({ dados, melhor }: { dados: number[]; melhor: number }) {
  const max = Math.max(1, ...dados);
  return (
    <div className="flex items-end justify-between gap-2" style={{ height: 140 }}>
      {dados.map((n, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-2">
          <span className="text-[0.65rem] font-bold text-ink-muted">{n > 0 ? n : ''}</span>
          <div
            className={`w-full rounded-md transition-all duration-500 ${i === melhor ? 'bg-brand' : 'bg-black/[0.1]'}`}
            style={{ height: `${Math.max(3, (n / max) * 100)}%` }}
          />
          <span className={`text-[0.65rem] ${i === melhor ? 'font-bold text-brand' : 'text-ink-muted'}`}>{WEEKDAYS[i]}</span>
        </div>
      ))}
    </div>
  );
}

function HoraStrip({ horas, pico }: { horas: number[]; pico: number }) {
  const max = Math.max(1, ...horas);
  return (
    <div>
      <div className="mt-2 flex items-end gap-[2px]" style={{ height: 44 }}>
        {horas.map((n, h) => (
          <div
            key={h}
            title={`${h}h — ${n} visita${n === 1 ? '' : 's'}`}
            className={`flex-1 rounded-sm transition-all ${h === pico ? 'bg-brand' : 'bg-black/[0.08]'}`}
            style={{ height: `${Math.max(6, (n / max) * 100)}%` }}
          />
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.6rem] text-ink-muted/70">
        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
      </div>
      {pico >= 0 && (
        <p className="mt-2 text-xs text-ink-muted">
          Pico de visitas por volta das <strong className="text-ink-soft">{pico}h</strong>.
        </p>
      )}
    </div>
  );
}

function RelSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-5">
      <div className="h-12 rounded-2xl bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />)}
      </div>
      <div className="h-52 rounded-2xl bg-black/[0.05]" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="h-56 rounded-2xl bg-black/[0.05]" />
        <div className="h-56 rounded-2xl bg-black/[0.05]" />
      </div>
    </div>
  );
}

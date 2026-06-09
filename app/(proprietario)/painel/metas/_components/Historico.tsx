'use client';

// Aba Histórico — atingimento ao longo do tempo para uma métrica (últimos
// períodos da granularidade ativa, realizado calculado por período) + um corte
// por responsável no período corrente. Gráfico em SVG puro.

import { useEffect, useMemo, useState } from 'react';
import { formatMonth } from '@/lib/format';
import type { MetasBag } from './shared';
import {
  type Avaliacao, type Realizado, type Periodo,
  METRICAS, metricaMeta, periodoDeOffset, fracaoDecorrida,
  avaliarMeta, finStoredToEngine, computarRealizado,
} from '../_lib';
import { selCls } from '../_lib';
import {
  fmtValor, SEMAFORO_COR, SEMAFORO_CHIP, SEMAFORO_LABEL, Dot,
  IcoChart, IcoTrend,
} from './ui';

type Ponto = { periodo: Periodo; label: string; realizado: number | null; alvo: number; definido: boolean; av: Avaliacao };
const N_PERIODOS = 6;

function labelDe(p: Periodo): string {
  if (p.gran === 'ano') return p.key;
  if (p.gran === 'trimestre') { const m = /Q([1-4])$/.exec(p.key); return `T${m?.[1] ?? ''} ${p.key.slice(0, 4)}`; }
  return formatMonth(p.key, { withYear: false });
}

export default function Historico({ bag }: { bag: MetasBag }) {
  const autoMetricas = useMemo(() => METRICAS.filter((m) => m.auto), []);
  const [metrica, setMetrica] = useState<string>('receita');
  const [serie, setSerie] = useState<Ponto[]>([]);
  const [loading, setLoading] = useState(true);

  const m = metricaMeta(metrica);

  // Últimos N períodos da granularidade ativa (do mais antigo ao atual).
  const periodos = useMemo(
    () => Array.from({ length: N_PERIODOS }, (_, i) => periodoDeOffset(bag.gran, -(N_PERIODOS - 1 - i), bag.hoje)),
    [bag.gran, bag.hoje],
  );

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    const propIds = bag.props.map((p) => p.id);
    const alvoDe = (p: Periodo): { alvo: number; definido: boolean } => {
      if (m.store === 'metas_financeiras') {
        const fin = bag.metasFin.find((x) => x.metrica === metrica && x.periodo === bag.gran);
        const stored = fin?.alvo ?? 0;
        return { alvo: finStoredToEngine(metrica, stored), definido: stored > 0 };
      }
      const row = bag.metas.find((x) => x.metrica === metrica && x.periodo === p.key && (x.propriedade_id ?? null) === (bag.propriedadeId ?? null));
      return { alvo: row?.alvo_num ?? 0, definido: !!row && row.alvo_num > 0 };
    };
    Promise.all(periodos.map((p) => computarRealizado(bag.userId, p, bag.propriedadeId, bag.props.length, propIds)
      .then((r: Realizado): Ponto => {
        const realizado = r[metrica] ?? null;
        const { alvo, definido } = alvoDe(p);
        return { periodo: p, label: labelDe(p), realizado, alvo, definido, av: avaliarMeta(alvo, realizado ?? 0, m.sentido, fracaoDecorrida(p, bag.hoje)) };
      })
      .catch((): Ponto => ({ periodo: p, label: labelDe(p), realizado: null, alvo: 0, definido: false, av: avaliarMeta(0, 0, m.sentido, 1) }))))
      .then((pts) => { if (vivo) { setSerie(pts); setLoading(false); } });
    return () => { vivo = false; };
  }, [metrica, bag.gran, bag.hoje, bag.userId, bag.propriedadeId, bag.props, bag.metas, bag.metasFin, periodos, m.store, m.sentido]);

  const maxVal = useMemo(() => Math.max(1, ...serie.map((p) => Math.max(p.realizado ?? 0, p.alvo))), [serie]);

  // Corte por responsável (período corrente, tabela metas).
  const porResp = useMemo(() => {
    const fracao = fracaoDecorrida(bag.periodo, bag.hoje);
    const map = new Map<string, { soma: number; n: number }>();
    for (const row of bag.metas) {
      if (row.periodo !== bag.periodo.key) continue;
      if ((row.propriedade_id ?? null) !== (bag.propriedadeId ?? null)) continue;
      const mm = metricaMeta(row.metrica);
      const realizado = mm.auto ? (bag.realizado[row.metrica] ?? null) : (row.realizado_num ?? 0);
      if (realizado == null) continue;
      const av = avaliarMeta(row.alvo_num, realizado, mm.sentido, fracao);
      const key = row.responsavel?.trim() || 'Sem responsável';
      const cur = map.get(key) || { soma: 0, n: 0 };
      cur.soma += Math.min(1, Math.max(0, av.pct)); cur.n++;
      map.set(key, cur);
    }
    return [...map.entries()].map(([nome, v]) => ({ nome, media: v.soma / v.n, n: v.n })).sort((a, b) => b.media - a.media);
  }, [bag.metas, bag.realizado, bag.periodo, bag.propriedadeId, bag.hoje]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink">Atingimento ao longo do tempo</h3>
          <p className="text-xs text-ink-muted">Últimos {N_PERIODOS} {bag.gran === 'mes' ? 'meses' : bag.gran === 'trimestre' ? 'trimestres' : 'anos'} · realizado puxado por período</p>
        </div>
        <select value={metrica} onChange={(e) => setMetrica(e.target.value)} className={selCls}>
          {autoMetricas.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
        </select>
      </div>

      <div className="mt-4 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
        {loading ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-ink-muted">
            <span className="inline-flex items-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-brand/30 border-t-brand" /> calculando histórico…</span>
          </div>
        ) : serie.every((p) => p.realizado == null) ? (
          <div className="flex h-[200px] flex-col items-center justify-center text-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted"><IcoChart /></div>
            <p className="text-sm text-ink-muted">Sem dados de <strong>{m.label}</strong> nos últimos períodos.</p>
            <p className="text-xs text-ink-muted">A fonte ({m.fonte}) pode ainda não ter movimentação.</p>
          </div>
        ) : (
          <>
            {/* Gráfico de barras com marcador de alvo por período */}
            <div className="flex h-[220px] items-end gap-2 sm:gap-4">
              {serie.map((p) => {
                const h = ((p.realizado ?? 0) / maxVal) * 100;
                const alvoH = p.definido ? (p.alvo / maxVal) * 100 : null;
                const cor = p.realizado == null ? '#cbd5e1' : SEMAFORO_COR[p.av.semaforo];
                return (
                  <div key={p.periodo.key} className="flex flex-1 flex-col items-center">
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      <div className="relative h-full w-full max-w-[56px]">
                        {/* barra */}
                        <div className="absolute bottom-0 w-full rounded-t-lg transition-all duration-700" style={{ height: `${Math.max(h, p.realizado != null ? 2 : 0)}%`, background: cor }} title={fmtValor(p.realizado, m.unidade)} />
                        {/* linha de alvo */}
                        {alvoH != null && (
                          <div className="absolute w-full border-t-2 border-dashed border-ink/40" style={{ bottom: `${Math.min(100, alvoH)}%` }} title={`Alvo: ${fmtValor(p.alvo, m.unidade)}`} />
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 text-center">
                      <div className="text-[0.7rem] font-semibold text-ink">{p.realizado != null ? fmtValor(p.realizado, m.unidade) : '—'}</div>
                      <div className="text-[0.65rem] capitalize text-ink-muted">{p.label}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Tabela de atingimento por período */}
            <div className="mt-4 overflow-x-auto border-t border-black/[0.06] pt-3">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-ink-muted">
                  <th className="pb-1.5 font-semibold">Período</th>
                  <th className="pb-1.5 text-right font-semibold">Realizado</th>
                  <th className="pb-1.5 text-right font-semibold">Alvo</th>
                  <th className="pb-1.5 text-right font-semibold">Atingido</th>
                  <th className="pb-1.5 text-right font-semibold">Status</th>
                </tr></thead>
                <tbody>
                  {serie.map((p) => (
                    <tr key={p.periodo.key} className="border-t border-black/[0.04]">
                      <td className="py-1.5 capitalize text-ink-soft">{p.label}</td>
                      <td className="py-1.5 text-right font-medium text-ink">{p.realizado != null ? fmtValor(p.realizado, m.unidade) : '—'}</td>
                      <td className="py-1.5 text-right text-ink-muted">{p.definido ? fmtValor(p.alvo, m.unidade) : '—'}</td>
                      <td className="py-1.5 text-right font-semibold text-ink">{p.definido && p.realizado != null ? `${Math.round(p.av.pct * 100)}%` : '—'}</td>
                      <td className="py-1.5 text-right">
                        {p.definido && p.realizado != null
                          ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${SEMAFORO_CHIP[p.av.semaforo]}`}><Dot tone={p.av.semaforo} /> {SEMAFORO_LABEL[p.av.semaforo]}</span>
                          : <span className="text-ink-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Por responsável (período corrente) */}
      {porResp.length > 0 && (
        <div className="mt-5 rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-ink-muted"><IcoTrend /></span>
            <h3 className="text-base font-bold text-ink">Por responsável</h3>
            <span className="text-xs text-ink-muted">· {bag.periodo.key}</span>
          </div>
          <div className="space-y-3">
            {porResp.map((r) => {
              const cor = r.media >= 0.95 ? SEMAFORO_COR.verde : r.media >= 0.7 ? SEMAFORO_COR.amarelo : SEMAFORO_COR.vermelho;
              return (
                <div key={r.nome}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-soft">{r.nome} <span className="text-ink-muted">· {r.n} meta{r.n > 1 ? 's' : ''}</span></span>
                    <span className="font-bold text-ink">{Math.round(r.media * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(100, Math.round(r.media * 100))}%`, background: cor }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

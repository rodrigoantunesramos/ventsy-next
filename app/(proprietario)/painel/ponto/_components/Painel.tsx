'use client';

// Aba "Painel" — visão geral de Ponto & Escala: cobertura das escalas (vagas
// preenchidas), custo de pessoal previsto, no-show de freelancers e ranking.
// Só agrega dados já carregados (engine pura lib/ponto). Sem "R$" hardcoded.

import { useMemo } from 'react';
import { formatMoney, formatMoneyShort, formatPercent, formatDate } from '@/lib/format';
import {
  coberturaEscala, custoPrevistoEscala, taxaNoShow, funcaoLabel, funcaoCor,
} from '@/lib/ponto';
import { type PontoBag, eventoLabel, ymd } from '../_lib';
import { Kpi, EmptyState, Estrelas, IcoTarget, IcoWallet, IcoUsers, IcoAlert, IcoCalendar } from './ui';

export default function Painel({ bag, onIrEscala }: { bag: PontoBag; onIrEscala: () => void }) {
  const { escalas, alocsPorEscala, eventos, freelancers, alocacoes } = bag;
  const hoje = ymd(new Date());

  // ── Eventos com escala (próximos primeiro) ──
  const eventosComEscala = useMemo(() => {
    const porEvento = new Map<string, typeof escalas>();
    for (const s of escalas) { if (!s.evento_id) continue; const arr = porEvento.get(s.evento_id) || []; arr.push(s); porEvento.set(s.evento_id, arr); }
    return [...porEvento.entries()].map(([evId, escs]) => {
      const ev = eventos.find((e) => e.id === evId);
      let vagas = 0, preenchidas = 0, custo = 0;
      for (const s of escs) {
        const alocs = alocsPorEscala.get(s.id) || [];
        const c = coberturaEscala(s.necessario, alocs);
        vagas += c.necessario; preenchidas += c.preenchidas; custo += custoPrevistoEscala(alocs);
      }
      const data = escs.map((s) => s.data).sort()[0] || ev?.data_inicio?.slice(0, 10) || '';
      return { evId, ev, escs, vagas, preenchidas, custo, data, cobertura: vagas > 0 ? preenchidas / vagas : 0 };
    }).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [escalas, alocsPorEscala, eventos]);

  const futuros = useMemo(() => eventosComEscala.filter((x) => !x.data || x.data >= hoje), [eventosComEscala, hoje]);

  const kpis = useMemo(() => {
    const vagas = eventosComEscala.reduce((s, x) => s + x.vagas, 0);
    const preenchidas = eventosComEscala.reduce((s, x) => s + x.preenchidas, 0);
    const custo = eventosComEscala.reduce((s, x) => s + x.custo, 0);
    const noShow = taxaNoShow(alocacoes);
    return { eventos: eventosComEscala.length, vagas, preenchidas, cobertura: vagas > 0 ? preenchidas / vagas : 0, custo, noShow };
  }, [eventosComEscala, alocacoes]);

  // ── No-show por freelancer (faltas / presenças) ──
  const noShowFreela = useMemo(() => {
    const m = new Map<string, { faltas: number; presencas: number }>();
    for (const a of alocacoes) {
      if (!a.freelancer_id) continue;
      const cur = m.get(a.freelancer_id) || { faltas: 0, presencas: 0 };
      if (a.status === 'falta') cur.faltas++;
      else if (a.status === 'presente') cur.presencas++;
      m.set(a.freelancer_id, cur);
    }
    return [...m.entries()]
      .map(([id, v]) => ({ f: freelancers.find((x) => x.id === id), taxa: v.faltas + v.presencas > 0 ? v.faltas / (v.faltas + v.presencas) : 0, ...v }))
      .filter((x) => x.f && x.faltas > 0)
      .sort((a, b) => b.taxa - a.taxa).slice(0, 5);
  }, [alocacoes, freelancers]);

  // ── Top freelancers (convocações + avaliação) ──
  const topFreela = useMemo(() => {
    const conv = new Map<string, number>();
    for (const a of alocacoes) if (a.freelancer_id) conv.set(a.freelancer_id, (conv.get(a.freelancer_id) || 0) + 1);
    return freelancers.filter((f) => f.ativo)
      .map((f) => ({ f, convocacoes: conv.get(f.id) || 0 }))
      .sort((a, b) => b.convocacoes - a.convocacoes || (b.f.avaliacao || 0) - (a.f.avaliacao || 0))
      .slice(0, 5);
  }, [freelancers, alocacoes]);

  if (eventosComEscala.length === 0 && freelancers.length === 0) {
    return (
      <EmptyState icon={<IcoCalendar />} title="Comece pela escala de um evento" cta={<button onClick={onIrEscala} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">Montar escala</button>}>
        Planeje as funções e quantidades de cada evento, convoque equipe fixa e freelancers, registre o ponto e apure o custo de mão de obra. Este painel resume tudo.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Eventos com escala" value={String(kpis.eventos)} tone="ink" icon={<IcoCalendar />} />
        <Kpi label="Cobertura" value={formatPercent(kpis.cobertura)} sub={`${kpis.preenchidas}/${kpis.vagas} vagas`} tone={kpis.cobertura >= 1 ? 'verde' : 'gold'} icon={<IcoTarget />} />
        <Kpi label="Custo previsto" value={formatMoneyShort(kpis.custo)} sub="mão de obra planejada" tone="roxo" icon={<IcoWallet />} />
        <Kpi label="No-show freelancers" value={formatPercent(kpis.noShow)} tone={kpis.noShow > 0.1 ? 'vermelho' : 'verde'} icon={<IcoAlert />} />
      </div>

      {/* Próximos eventos */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Próximos eventos a escalar</h3>
        {futuros.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum evento futuro com escala. Monte uma na aba Escala.</p>
        ) : (
          <div className="space-y-2.5">
            {futuros.slice(0, 6).map((x) => {
              const completa = x.cobertura >= 1;
              return (
                <button key={x.evId} onClick={onIrEscala} className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] p-3 text-left transition hover:border-brand/30 hover:bg-brand-50/30">
                  <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl bg-black/[0.03] text-ink-soft">
                    <span className="text-[0.6rem] uppercase">{x.data ? formatDate(x.data, { style: 'short' }).slice(3, 6) : '—'}</span>
                    <span className="text-sm font-bold leading-none">{x.data ? x.data.slice(8, 10) : '—'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-ink">{eventoLabel(x.ev)}</div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-black/[0.06]"><div className={`h-full rounded-full ${completa ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${Math.min(1, x.cobertura) * 100}%` }} /></div>
                      <span className="text-xs text-ink-muted">{x.preenchidas}/{x.vagas} vagas</span>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-bold text-ink">{formatMoney(x.custo)}</div>
                    <div className="text-[0.65rem] text-ink-muted">previsto</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Top freelancers */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink"><IcoUsers /> Freelancers mais acionados</h3>
          {topFreela.length === 0 ? <p className="py-8 text-center text-sm text-ink-muted">Cadastre e convoque freelancers para ver o ranking.</p> : (
            <div className="space-y-2">
              {topFreela.map(({ f, convocacoes }, i) => (
                <div key={f.id} className="flex items-center gap-3 rounded-xl border border-black/[0.05] p-2.5">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-black/[0.05] text-ink-muted'}`}>{i + 1}</span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white" style={{ background: funcaoCor(f.funcao) }}>{f.nome.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{f.nome}</div>
                    <div className="text-xs text-ink-muted">{funcaoLabel(f.funcao)}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <Estrelas valor={f.avaliacao} />
                    <div className="text-[0.65rem] text-ink-muted">{convocacoes} convocação{convocacoes !== 1 ? 'ões' : ''}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* No-show */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink"><IcoAlert /> Atenção: faltas (no-show)</h3>
          {noShowFreela.length === 0 ? (
            <div className="flex h-[140px] flex-col items-center justify-center text-center text-sm text-ink-muted">
              <span className="mb-1 text-2xl">🎉</span> Nenhuma falta registrada de freelancers.
            </div>
          ) : (
            <div className="space-y-2">
              {noShowFreela.map(({ f, taxa, faltas, presencas }) => (
                <div key={f!.id} className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50/40 p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-[0.6rem] font-bold text-red-700">{f!.nome.slice(0, 2).toUpperCase()}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{f!.nome}</div>
                    <div className="text-xs text-ink-muted">{faltas} falta(s) · {presencas} presença(s)</div>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">{formatPercent(taxa)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

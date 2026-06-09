'use client';

// Painel de conformidade — visão geral do licenciamento da operação.
// Semáforo geral, KPIs por status, alertas a-vencer (30/60/90d), vencidas
// (bloqueante), custo anual de licenças e quebra por propriedade. Tudo derivado
// da engine pura lib/licencas.ts; moeda/data via lib/format (sem "R$" cru).

import { useMemo } from 'react';
import { formatMoney, formatDate } from '@/lib/format';
import {
  resumoConformidade, aVencerBuckets, vencidas, proximasRenovacoes, custoAnualLicencas,
  agruparPorPropriedade, statusEfetivo, statusMeta, tipoMeta, diasAte, diasLabel,
} from '@/lib/licencas';
import type { LicencasCtx } from '../_lib';
import {
  Kpi, Semaforo, Chip, EmptyState,
  IcoCheckCircle, IcoAlert, IcoClock, IcoCoins, IcoShield, IcoBuilding,
} from './ui';

export default function Painel({ ctx, onNovo }: { ctx: LicencasCtx; onNovo: () => void }) {
  const { licencas, hoje } = ctx;

  const resumo = useMemo(() => resumoConformidade(licencas, hoje), [licencas, hoje]);
  const buckets = useMemo(() => aVencerBuckets(licencas, hoje), [licencas, hoje]);
  const venc = useMemo(() => vencidas(licencas, hoje), [licencas, hoje]);
  const proximas = useMemo(() => proximasRenovacoes(licencas, hoje, 6), [licencas, hoje]);
  const custoAno = useMemo(() => custoAnualLicencas(licencas), [licencas]);

  // Conformidade por propriedade (semáforo de cada espaço).
  const porProp = useMemo(() => {
    const grupos = agruparPorPropriedade(licencas.filter((l) => l.escopo === 'permanente'));
    return [...grupos.entries()]
      .map(([propId, ls]) => ({ propId, nome: ctx.propNome(propId), resumo: resumoConformidade(ls, hoje) }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [licencas, hoje, ctx]);

  if (licencas.length === 0) {
    return (
      <EmptyState
        icon={<IcoShield />}
        title="Nenhuma licença cadastrada ainda"
        cta={<button onClick={onNovo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Adicionar primeiro alvará</button>}
      >
        Cadastre os alvarás permanentes do seu espaço (funcionamento, AVCB, sanitário, ambiental) e acompanhe vencimentos, órgãos, custos e documentos num só lugar.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Semáforo + KPIs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Semaforo nivel={resumo.geral}>
            {resumo.vencida > 0
              ? `${resumo.vencida} ${resumo.vencida === 1 ? 'licença vencida' : 'licenças vencidas'} — regularize com urgência.`
              : resumo.a_vencer + resumo.em_processo > 0
                ? `${resumo.a_vencer} a vencer · ${resumo.em_processo} em processo.`
                : `${resumo.vigente} ${resumo.vigente === 1 ? 'licença vigente' : 'licenças vigentes'}.`}
          </Semaforo>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
          <Kpi label="Vigentes" value={String(resumo.vigente)} tone="verde" icon={<IcoCheckCircle />} />
          <Kpi label="A vencer" value={String(resumo.a_vencer)} tone="gold" icon={<IcoClock />} />
          <Kpi label="Vencidas" value={String(resumo.vencida)} tone="vermelho" icon={<IcoAlert />} />
          <Kpi label="Em processo" value={String(resumo.em_processo)} tone="sky" icon={<IcoClock />} />
        </div>
      </div>

      {/* Custo anual + buckets a vencer */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Kpi label="Custo anual de licenças" value={formatMoney(custoAno)} tone="brand" icon={<IcoCoins />} sub="Soma das taxas das licenças permanentes" />
        <div className="rounded-2xl bg-white p-4 shadow-card md:col-span-2">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Renovações se aproximando</div>
          <div className="grid grid-cols-3 gap-3">
            {([['30 dias', buckets.d30, 'text-red-600'], ['60 dias', buckets.d60, 'text-amber-600'], ['90 dias', buckets.d90, 'text-ink']] as const).map(([lbl, n, cor]) => (
              <div key={lbl} className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3 text-center">
                <div className={`text-2xl font-bold ${cor}`}>{n}</div>
                <div className="text-[0.72rem] text-ink-muted">em até {lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vencidas (bloqueante) */}
      {venc.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-red-700"><IcoAlert /> Licenças vencidas — ação imediata</div>
          <div className="space-y-1.5">
            {venc.map((l) => (
              <div key={l.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                <span className="font-semibold text-ink">{l.titulo || tipoMeta(l.tipo).label}</span>
                <span className="text-[0.78rem] text-red-600">{l.validade ? `${formatDate(l.validade, { style: 'short' })} · ${diasLabel(diasAte(l.validade, hoje))}` : ''} · {ctx.propNome(l.propriedade_id)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Próximas renovações + por propriedade */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Próximas renovações</div>
          {proximas.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-muted">Nada vencendo no horizonte. 👍</div>
          ) : (
            <div className="space-y-2">
              {proximas.map((l) => {
                const sm = statusMeta(statusEfetivo(l, hoje));
                return (
                  <div key={l.id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{l.titulo || tipoMeta(l.tipo).label}</div>
                      <div className="text-[0.72rem] text-ink-muted">{ctx.propNome(l.propriedade_id)}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Chip className={sm.chip}>{sm.label}</Chip>
                      <div className="mt-0.5 text-[0.7rem] text-ink-muted">{l.validade ? formatDate(l.validade, { style: 'short' }) : '—'}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-card">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted"><IcoBuilding /> Conformidade por propriedade</div>
          {porProp.length === 0 ? (
            <div className="py-6 text-center text-sm text-ink-muted">Sem alvarás permanentes por propriedade.</div>
          ) : (
            <div className="space-y-2.5">
              {porProp.map(({ propId, nome, resumo: r }) => {
                const cor = r.geral === 'vermelho' ? 'bg-red-500' : r.geral === 'amarelo' ? 'bg-amber-400' : 'bg-emerald-500';
                return (
                  <div key={String(propId)} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${cor}`} />
                      <span className="truncate text-sm font-medium text-ink">{nome}</span>
                    </div>
                    <span className="shrink-0 text-[0.72rem] text-ink-muted">
                      {r.vigente} ok · {r.a_vencer + r.em_processo} pend. · {r.vencida} venc.
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

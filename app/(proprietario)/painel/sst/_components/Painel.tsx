'use client';

// Aba Painel — /painel/sst.
// Visão geral de segurança (org-wide): semáforo geral (lib/sst.nivelGeralSST),
// prontidão dos próximos eventos (cobertura de recursos obrigatórios), validades
// de EPIs/NRs/planos a vencer e indicadores de ocorrências. Só leitura/atalhos.

import { useEffect, useMemo, useState } from 'react';
import { formatDate, formatDateTime, formatPercent } from '@/lib/format';
import {
  type SstCtx, type RecursoRow, type OcorrenciaRow, type EpiRow, type TreinamentoRow, type PlanoRow,
  listarRecursosTodos, listarOcorrencias, listarEpis, listarTreinamentos, listarPlanos,
  mapRecurso, mapOcorrencia, mapEpi, mapTreinamento, mapPlano,
  coberturaRecursos, prontidaoEvento, indicadoresOcorrencias, nivelGeralSST, nivelSSTMeta,
  validadeStatus, gravidadeMeta, ocorrenciaTipoMeta, eventoLabel, nrMeta,
} from '../_lib';
import { Ico, Kpi, Chip, EmptyState, SectionCard, btnGhost } from './ui';

type TabKey = 'painel' | 'planos' | 'dimensionamento' | 'episnrs' | 'simulados' | 'ocorrencias';

export default function Painel({ ctx, onIr }: { ctx: SstCtx; onIr: (t: TabKey) => void }) {
  const [loading, setLoading] = useState(true);
  const [recursos, setRecursos] = useState<RecursoRow[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaRow[]>([]);
  const [epis, setEpis] = useState<EpiRow[]>([]);
  const [treinos, setTreinos] = useState<TreinamentoRow[]>([]);
  const [planos, setPlanos] = useState<PlanoRow[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [r, o, e, t, p] = await Promise.all([
        listarRecursosTodos(ctx.userId), listarOcorrencias(ctx.userId), listarEpis(ctx.userId),
        listarTreinamentos(ctx.userId), listarPlanos(ctx.userId),
      ]);
      setRecursos(r.error ? [] : (r.data || []).map(mapRecurso));
      setOcorrencias(o.error ? [] : (o.data || []).map(mapOcorrencia));
      setEpis(e.error ? [] : (e.data || []).map(mapEpi));
      setTreinos(t.error ? [] : (t.data || []).map(mapTreinamento));
      setPlanos(p.error ? [] : (p.data || []).map(mapPlano));
      setLoading(false);
    })();
  }, [ctx.userId]);

  const nowMs = useMemo(() => Date.parse(ctx.hoje + 'T23:59:59'), [ctx.hoje]);
  const ind = useMemo(() => indicadoresOcorrencias(ocorrencias, nowMs), [ocorrencias, nowMs]);

  // Prontidão por evento (a partir das linhas de recursos agrupadas).
  const porEvento = useMemo(() => {
    const map = new Map<string, RecursoRow[]>();
    for (const r of recursos) { const a = map.get(r.evento_id) || []; a.push(r); map.set(r.evento_id, a); }
    return map;
  }, [recursos]);

  const proximos = useMemo(() => {
    return ctx.eventos
      .filter((e) => e.data_inicio && e.data_inicio.slice(0, 10) >= ctx.hoje)
      .sort((a, b) => (a.data_inicio || '').localeCompare(b.data_inicio || ''))
      .slice(0, 6)
      .map((ev) => {
        const rows = porEvento.get(ev.id) || [];
        const cob = coberturaRecursos(rows.map((r) => ({ tipo: r.tipo, quantidade: r.exigido, obrigatorio: r.obrigatorio })), rows);
        return { ev, prontidao: prontidaoEvento(cob), temRecursos: rows.length > 0 };
      });
  }, [ctx.eventos, ctx.hoje, porEvento]);

  const eventosBloqueados = useMemo(() => proximos.filter((p) => p.temRecursos && !p.prontidao.pronto).length, [proximos]);

  // Validades (EPIs + treinamentos + planos).
  const validades = useMemo(() => {
    type V = { kind: string; label: string; sub: string; validade: string | null; nivel: ReturnType<typeof validadeStatus>['nivel']; dias: number | null };
    const out: V[] = [];
    const add = (kind: string, label: string, sub: string, validade: string | null) => {
      const info = validadeStatus(validade, ctx.hoje);
      if (info.nivel === 'a_vencer' || info.nivel === 'vencida') out.push({ kind, label, sub, validade, nivel: info.nivel, dias: info.dias });
    };
    epis.forEach((e) => add('EPI', e.nome, `CA ${e.ca || '—'}`, e.validade_ca));
    treinos.forEach((t) => add('NR', ctx.equipe.find((q) => q.id === t.equipe_id)?.nome || t.pessoa || '—', nrMeta(t.nr).label, t.validade));
    planos.forEach((p) => add('Plano', p.nome, 'Plano de emergência', p.validade));
    return out.sort((a, b) => (a.dias ?? 0) - (b.dias ?? 0));
  }, [epis, treinos, planos, ctx.equipe, ctx.hoje]);

  const validadesVencidas = validades.filter((v) => v.nivel === 'vencida').length;
  const validadesAVencer = validades.filter((v) => v.nivel === 'a_vencer').length;
  const planosVigentes = planos.filter((p) => p.status === 'vigente').length;

  const nivel = nivelGeralSST({
    obrigatoriosPendentes: eventosBloqueados,
    ocorrenciasGraves: ind.graves,
    validadesVencidas,
    validadesAVencer,
    catPendentes: ind.catPendentes,
  });
  const nm = nivelSSTMeta(nivel);

  if (loading) {
    return <div className="space-y-4"><div className="h-[96px] animate-pulse rounded-2xl bg-black/[0.05]" /><div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div></div>;
  }

  const vazio = recursos.length === 0 && ocorrencias.length === 0 && epis.length === 0 && treinos.length === 0 && planos.length === 0;

  return (
    <div className="space-y-4">
      {/* Banner semáforo */}
      <div className={`rounded-2xl border p-4 ${nm.ring}`}>
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${nm.dot} text-white`}><Ico name="shield" size={22} /></span>
          <div>
            <div className="text-base font-bold text-ink">{nm.label}</div>
            <div className="mt-0.5 text-[0.78rem] text-ink-muted">
              {nivel === 'ok'
                ? 'Sem pendências críticas de SST no momento.'
                : `${eventosBloqueados} evento(s) com recurso obrigatório pendente · ${ind.graves} ocorrência(s) grave(s) · ${validadesVencidas} validade(s) vencida(s) · ${ind.catPendentes} CAT pendente(s).`}
            </div>
          </div>
        </div>
      </div>

      {vazio ? (
        <EmptyState icon={<Ico name="shield" size={22} />} title="Comece pela segurança do seu evento"
          cta={<button onClick={() => onIr('dimensionamento')} className={btnGhost}>Dimensionar um evento <Ico name="users" size={15} /></button>}>
          Dimensione os recursos por público, crie um plano de emergência e registre EPIs/treinamentos. Tudo aparece aqui consolidado.
        </EmptyState>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Eventos bloqueados" value={eventosBloqueados} tone={eventosBloqueados > 0 ? 'bad' : 'ok'} sub="recurso obrigatório pendente" icon="users" />
            <Kpi label="Ocorrências graves" value={ind.graves} tone={ind.graves > 0 ? 'bad' : 'ok'} sub={`${ind.total} no total`} icon="alert" />
            <Kpi label="Validades a vencer" value={validadesAVencer} tone={validadesAVencer > 0 ? 'warn' : 'ok'} sub={`${validadesVencidas} vencidas`} icon="helmet" />
            <Kpi label="Planos vigentes" value={planosVigentes} sub={`${planos.length} no total`} icon="doc" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Próximos eventos & prontidão */}
            <SectionCard title="Próximos eventos" desc="Prontidão de recursos de SST por evento." icon="calendar"
              actions={<button onClick={() => onIr('dimensionamento')} className={btnGhost}>Dimensionar</button>}>
              {proximos.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">Nenhum evento futuro com data definida.</p>
              ) : (
                <ul className="space-y-2">
                  {proximos.map(({ ev, prontidao, temRecursos }) => (
                    <li key={ev.id} className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] p-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{eventoLabel(ev)}</div>
                        <div className="text-[0.72rem] text-ink-muted">{ev.data_inicio ? formatDate(ev.data_inicio, { style: 'medium' }) : '—'}{ev.publico ? ` · ${ev.publico} pessoas` : ''}</div>
                      </div>
                      {!temRecursos ? (
                        <Chip className="bg-slate-100 text-slate-500">sem dimensionamento</Chip>
                      ) : prontidao.pronto ? (
                        <Chip className="bg-emerald-50 text-emerald-700"><Ico name="check" size={12} /> pronto</Chip>
                      ) : (
                        <Chip className="bg-red-50 text-red-700">{prontidao.bloqueios.length} pendente(s) · {formatPercent(prontidao.coberturaPct)}</Chip>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            {/* Validades a vencer */}
            <SectionCard title="Validades a renovar" desc="EPIs, NRs e planos vencidos ou a vencer (30 dias)." icon="helmet"
              actions={<button onClick={() => onIr('episnrs')} className={btnGhost}>EPIs & NRs</button>}>
              {validades.length === 0 ? (
                <p className="py-4 text-center text-sm text-ink-muted">Nenhuma validade próxima do vencimento. 👍</p>
              ) : (
                <ul className="space-y-2">
                  {validades.slice(0, 6).map((v, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] p-2.5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5"><Chip className="bg-slate-100 text-slate-600">{v.kind}</Chip><span className="truncate text-sm font-semibold text-ink">{v.label}</span></div>
                        <div className="text-[0.72rem] text-ink-muted">{v.sub}{v.validade ? ` · ${formatDate(v.validade, { style: 'short' })}` : ''}</div>
                      </div>
                      <Chip className={v.nivel === 'vencida' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}>
                        {v.nivel === 'vencida' ? `vencida ${Math.abs(v.dias || 0)}d` : `${v.dias}d`}
                      </Chip>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          </div>

          {/* Ocorrências recentes */}
          <SectionCard title="Ocorrências recentes" desc={ind.diasDesdeUltima != null ? `${ind.diasDesdeUltima} dia(s) desde a última.` : 'Nenhuma ocorrência registrada.'} icon="alert"
            actions={<button onClick={() => onIr('ocorrencias')} className={btnGhost}>Ver todas</button>}>
            {ocorrencias.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-muted">Nenhuma ocorrência registrada — ótimo sinal de segurança.</p>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {ocorrencias.slice(0, 5).map((r) => {
                  const gm = gravidadeMeta(r.gravidade); const tm = ocorrenciaTipoMeta(r.tipo);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Chip className={gm.chip}>{gm.label}</Chip>
                          <span className="truncate text-sm text-ink">{r.descricao || tm.label}</span>
                        </div>
                        <div className="text-[0.72rem] text-ink-muted">{r.data ? formatDateTime(r.data) : ''}{r.local ? ` · ${r.local}` : ''}</div>
                      </div>
                      {gm.label && r.cat_emitida && <Chip className="bg-emerald-50 text-emerald-700">CAT</Chip>}
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}

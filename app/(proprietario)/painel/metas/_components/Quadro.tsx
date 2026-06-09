'use client';

// Aba Quadro — metas por área/período: alvo × realizado (automático), %,
// projeção de fechamento (run-rate), semáforo. KPIs no topo, alertas de meta em
// risco/batida, e cartões agrupados por área. Criar/editar/excluir via modal.

import { useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import type { MetasBag } from './shared';
import {
  type Area, type Avaliacao,
  AREAS, areaMeta, metricaMeta, metricasDaArea,
  avaliarMeta, fracaoDecorrida, resumoQuadro, periodoEncerrado,
  finStoredToEngine, finEngineToStored,
  criarMeta, salvarMeta, excluirMeta, upsertMetaFinanceira, exportCSV,
  inp, selCls,
} from '../_lib';
import {
  fmtValor, alvoInputValue, parseAlvo, dicaUnidade,
  SEMAFORO_COR, SEMAFORO_CHIP, SEMAFORO_LABEL, Dot, Ring, Barra,
  IcoGoal, IcoTrophy, IcoAlert, IcoTrend, IcoPlus, IcoEdit, IcoTrash, IcoDownload,
} from './ui';

type MetaView = {
  key: string; id: string | null; store: 'metas' | 'metas_financeiras';
  metrica: string; area: Area; label: string; unidade: ReturnType<typeof metricaMeta>['unidade'];
  sentido: ReturnType<typeof metricaMeta>['sentido']; auto: boolean;
  alvo: number; realizado: number | null; temDado: boolean; definido: boolean;
  responsavel: string | null; av: Avaliacao;
};
const TRIO_FIN = ['receita', 'lucro', 'adimplencia'];

export default function Quadro({ bag }: { bag: MetasBag }) {
  const toast = useToast();
  const [modal, setModal] = useState<null | { editing?: MetaView }>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const fracao = useMemo(() => fracaoDecorrida(bag.periodo, bag.hoje), [bag.periodo, bag.hoje]);
  const encerrado = useMemo(() => periodoEncerrado(bag.periodo, bag.hoje), [bag.periodo, bag.hoje]);

  // Constrói a lista unificada de metas do período+escopo ativos.
  const views = useMemo<MetaView[]>(() => {
    const consolidado = bag.propriedadeId == null;
    const list: MetaView[] = [];
    const realDe = (metrica: string): number | null => bag.realizado[metrica] ?? null;

    // metas_financeiras (receita/lucro/adimplência) — só no consolidado.
    if (consolidado) {
      for (const metrica of TRIO_FIN) {
        const m = metricaMeta(metrica);
        const finRow = bag.metasFin.find((x) => x.metrica === metrica && x.periodo === bag.gran);
        const alvoStored = finRow?.alvo ?? 0;
        const alvo = finStoredToEngine(metrica, alvoStored);
        const realizado = realDe(metrica);
        const av = avaliarMeta(alvo, realizado ?? 0, m.sentido, fracao);
        list.push({
          key: `fin-${metrica}`, id: null, store: 'metas_financeiras', metrica, area: m.area,
          label: m.label, unidade: m.unidade, sentido: m.sentido, auto: m.auto,
          alvo, realizado, temDado: realizado != null, definido: alvoStored > 0,
          responsavel: null, av,
        });
      }
    }

    // tabela metas — período absoluto + escopo de propriedade.
    for (const row of bag.metas) {
      if (row.periodo !== bag.periodo.key) continue;
      if ((row.propriedade_id ?? null) !== (bag.propriedadeId ?? null)) continue;
      const m = metricaMeta(row.metrica);
      const realizado = m.auto ? realDe(row.metrica) : (row.realizado_num ?? 0);
      const av = avaliarMeta(row.alvo_num, realizado ?? 0, m.sentido, fracao);
      list.push({
        key: `meta-${row.id}`, id: row.id, store: 'metas', metrica: row.metrica, area: m.area,
        label: m.label, unidade: m.unidade, sentido: m.sentido, auto: m.auto,
        alvo: row.alvo_num, realizado, temDado: realizado != null, definido: row.alvo_num > 0,
        responsavel: row.responsavel, av,
      });
    }
    return list;
  }, [bag.metas, bag.metasFin, bag.realizado, bag.propriedadeId, bag.gran, bag.periodo, fracao]);

  // Métricas já definidas (p/ não duplicar no "nova meta").
  const definidas = useMemo(() => new Set(views.map((v) => v.metrica)), [views]);

  // Só metas com ALVO definido entram nos KPIs/alertas (placeholders não poluem).
  const metasDef = useMemo(() => views.filter((v) => v.definido), [views]);
  const comDado = useMemo(() => metasDef.filter((v) => v.temDado), [metasDef]);
  const resumo = useMemo(() => resumoQuadro(comDado.map((v) => v.av)), [comDado]);
  const emRisco = useMemo(() => comDado.filter((v) => v.av.emRisco), [comDado]);
  const batidas = useMemo(() => comDado.filter((v) => v.av.atingida), [comDado]);

  const porArea = useMemo(() => {
    return AREAS.map((a) => ({ area: a, metas: views.filter((v) => v.area === a.v) })).filter((g) => g.metas.length > 0);
  }, [views]);

  function abrirNova() { setModal({}); }
  function abrirEdit(v: MetaView) { setModal({ editing: v }); }

  async function remover(v: MetaView) {
    if (v.store !== 'metas' || !v.id) return;
    if (confirmDel !== v.id) { setConfirmDel(v.id); setTimeout(() => setConfirmDel((c) => (c === v.id ? null : c)), 3000); return; }
    const { error } = await excluirMeta(v.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Meta removida.'); setConfirmDel(null); await bag.recarregar();
  }

  function baixarCSV() {
    const rows = views.map((v) => [
      areaMeta(v.area).label, v.label, v.unidade,
      v.alvo, v.realizado ?? '', Math.round(v.av.pct * 100), Math.round(v.av.projPct * 100),
      SEMAFORO_LABEL[v.av.semaforo], v.responsavel || '',
    ]);
    exportCSV(`metas-${bag.periodo.key}.csv`,
      ['Área', 'Métrica', 'Unidade', 'Alvo', 'Realizado', 'Atingido %', 'Projeção %', 'Status', 'Responsável'], rows);
  }

  return (
    <div>
      {/* KPIs do quadro */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiQuadro label="Metas no período" value={String(metasDef.length)} sub={metasDef.length - comDado.length > 0 ? `${metasDef.length - comDado.length} sem fonte` : 'todas com dados'} icon={<IcoGoal />} tone="ink" />
        <KpiQuadro label="Atingimento médio" value={`${Math.round(resumo.atingimentoMedio * 100)}%`} sub="ponderado pelo alvo" icon={<IcoTrend />} tone="azul" />
        <KpiQuadro label="Batidas" value={String(resumo.atingidas)} sub={`${resumo.verde} no verde`} icon={<IcoTrophy />} tone="verde" />
        <KpiQuadro label={encerrado ? 'Não atingidas' : 'Em risco'} value={String(encerrado ? resumo.vermelho : resumo.emRisco)} sub={encerrado ? 'período encerrado' : 'projeção < alvo'} icon={<IcoAlert />} tone="vermelho" />
      </div>

      {/* Barra de ações */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-ink-muted">
          {bag.realizadoLoading
            ? <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border-2 border-brand/30 border-t-brand" /> calculando realizado…</span>
            : <span>Realizado calculado automaticamente das fontes.</span>}
        </div>
        <div className="flex items-center gap-2">
          {views.length > 0 && <button onClick={baixarCSV} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
          <button onClick={abrirNova} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova meta</button>
        </div>
      </div>

      {/* Alertas */}
      {(emRisco.length > 0 || batidas.length > 0) && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {emRisco.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-bold text-red-800"><IcoAlert /> {emRisco.length === 1 ? '1 meta em risco' : `${emRisco.length} metas em risco`}</div>
              <ul className="space-y-0.5 text-xs text-red-700">
                {emRisco.slice(0, 4).map((v) => <li key={v.key}>• {v.label}: projeção {Math.round(v.av.projPct * 100)}% do alvo</li>)}
              </ul>
            </div>
          )}
          {batidas.length > 0 && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-sm font-bold text-emerald-800"><IcoTrophy /> {batidas.length === 1 ? '1 meta batida' : `${batidas.length} metas batidas`} 🎉</div>
              <ul className="space-y-0.5 text-xs text-emerald-700">
                {batidas.slice(0, 4).map((v) => <li key={v.key}>• {v.label}: {fmtValor(v.realizado, v.unidade)} ({Math.round(v.av.pct * 100)}%)</li>)}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Metas por área */}
      {views.length === 0 ? (
        <EmptyQuadro onNova={abrirNova} />
      ) : (
        <div className="mt-5 space-y-6">
          {porArea.map(({ area, metas }) => (
            <section key={area.v}>
              <div className="mb-2.5 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: area.cor }} />
                <h3 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{area.label}</h3>
                <span className="text-xs text-ink-muted">· {metas.length}</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {metas.map((v) => <MetaCard key={v.key} v={v} encerrado={encerrado} onEdit={() => abrirEdit(v)} onDel={() => remover(v)} confirmDel={confirmDel === v.id} />)}
              </div>
            </section>
          ))}
        </div>
      )}

      {modal && (
        <MetaModal bag={bag} editing={modal.editing} definidas={definidas} onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await bag.recarregar(); }} toast={toast} />
      )}
    </div>
  );
}

// ── Cartão de meta ────────────────────────────────────────────────────────────
function MetaCard({ v, encerrado, onEdit, onDel, confirmDel }: {
  v: MetaView; encerrado: boolean; onEdit: () => void; onDel: () => void; confirmDel: boolean;
}) {
  const cor = v.temDado ? SEMAFORO_COR[v.av.semaforo] : '#94a3b8';
  const pctTxt = v.definido ? `${Math.round(v.av.pct * 100)}%` : '—';
  return (
    <div className="group relative rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{v.label}</p>
          <p className="mt-0.5 text-xs text-ink-muted">{metricaMeta(v.metrica).fonte}{v.responsavel ? ` · ${v.responsavel}` : ''}</p>
        </div>
        <Ring pct={v.definido && v.temDado ? v.av.pct : 0} cor={cor} size={48} stroke={5}>
          <span style={{ fontSize: '0.6rem' }}>{pctTxt}</span>
        </Ring>
      </div>

      <div className="mt-3">
        <div className="mb-1 flex items-end justify-between">
          <span className="text-lg font-bold text-ink">{v.temDado ? fmtValor(v.realizado, v.unidade) : '—'}</span>
          <span className="text-xs text-ink-muted">de {v.definido ? fmtValor(v.alvo, v.unidade) : '—'}</span>
        </div>
        <Barra pct={v.definido && v.temDado ? v.av.pct : 0} cor={cor} proj={!encerrado && v.definido && v.temDado ? v.av.projPct : undefined} />
        <div className="mt-1.5 flex items-center justify-between text-[0.7rem]">
          {v.temDado && v.definido ? (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${SEMAFORO_CHIP[v.av.semaforo]}`}><Dot tone={v.av.semaforo} /> {SEMAFORO_LABEL[v.av.semaforo]}</span>
          ) : (
            <span className="rounded-full bg-black/[0.04] px-2 py-0.5 font-medium text-ink-muted">{v.definido ? 'sem fonte de dados' : 'defina o alvo'}</span>
          )}
          {!encerrado && v.definido && v.temDado && (
            <span className="text-ink-muted" title="Projeção de fechamento (run-rate)">proj. {fmtValor(v.av.projecao, v.unidade)}</span>
          )}
        </div>
      </div>

      {/* Ações */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={onEdit} aria-label="Editar meta" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
        {v.store === 'metas' && v.id && (
          <button onClick={onDel} aria-label="Excluir meta" className={`rounded-lg p-1.5 ${confirmDel ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}><IcoTrash /></button>
        )}
      </div>
    </div>
  );
}

// ── KPI ────────────────────────────────────────────────────────────────────────
function KpiQuadro({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: React.ReactNode; tone: 'ink' | 'azul' | 'verde' | 'vermelho' }) {
  const ring = { ink: 'text-ink', azul: 'text-blue-600', verde: 'text-emerald-600', vermelho: 'text-red-500' }[tone];
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        <span className={ring}>{icon}</span>
      </div>
      <div className="mt-1.5 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[0.7rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

function EmptyQuadro({ onNova }: { onNova: () => void }) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand"><IcoGoal /></div>
      <h3 className="text-base font-bold text-ink">Defina suas metas do período</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Receita, eventos, ocupação, NPS, CAC… o realizado é puxado automaticamente dos módulos. Comece criando a primeira meta.</p>
      <button onClick={onNova} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova meta</button>
    </div>
  );
}

// ── Modal de criar/editar meta ──────────────────────────────────────────────
function MetaModal({ bag, editing, definidas, onClose, onSaved, toast }: {
  bag: MetasBag; editing?: MetaView; definidas: Set<string>;
  onClose: () => void; onSaved: () => Promise<void>;
  toast: ReturnType<typeof useToast>;
}) {
  const isEdit = !!editing;
  const [area, setArea] = useState<Area>(editing?.area ?? 'comercial');
  const [metrica, setMetrica] = useState<string>(editing?.metrica ?? '');
  const [alvoRaw, setAlvoRaw] = useState<string>(editing ? alvoInputValue(editing.unidade, editing.alvo) : '');
  const [realizadoRaw, setRealizadoRaw] = useState<string>(
    editing && !editing.auto ? alvoInputValue(editing.unidade, editing.realizado ?? 0) : '');
  const [responsavel, setResponsavel] = useState<string>(editing?.responsavel ?? '');
  const [saving, setSaving] = useState(false);

  // Métricas disponíveis para a área (no modo "nova", exclui as já definidas).
  const opcoes = useMemo(() => {
    const all = metricasDaArea(area);
    return isEdit ? all : all.filter((m) => !definidas.has(m.v));
  }, [area, isEdit, definidas]);

  const mSel = metrica ? metricaMeta(metrica) : (opcoes[0] ?? null);
  const metricaAtual = metrica || opcoes[0]?.v || '';
  const unidade = mSel?.unidade ?? 'numero';
  const ehManual = mSel ? !mSel.auto : false;

  async function salvar() {
    if (!metricaAtual) { toast.error('Escolha uma métrica.'); return; }
    const m = metricaMeta(metricaAtual);
    const alvo = parseAlvo(m.unidade, alvoRaw);
    if (!(alvo > 0) && m.unidade !== 'nps') { toast.error('Informe um alvo válido.'); return; }
    setSaving(true);
    try {
      if (m.store === 'metas_financeiras') {
        const { error } = await upsertMetaFinanceira(bag.userId, m.v, bag.gran, finEngineToStored(m.v, alvo));
        if (error) throw error;
      } else {
        const patch: Record<string, unknown> = {
          area: m.area, metrica: m.v, alvo_num: alvo, responsavel: responsavel || null,
          realizado_num: m.auto ? null : parseAlvo(m.unidade, realizadoRaw),
        };
        if (isEdit && editing?.id) {
          const { error } = await salvarMeta(editing.id, patch); if (error) throw error;
        } else {
          const { error } = await criarMeta({
            ...patch, usuario_id: bag.userId, periodo: bag.periodo.key, propriedade_id: bag.propriedadeId,
          });
          if (error) throw error;
        }
      }
      toast.success(isEdit ? 'Meta atualizada!' : 'Meta criada!');
      await onSaved();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      toast.error(err.code === '23505' ? 'Já existe uma meta dessa métrica neste período.' : 'Erro ao salvar a meta.');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-lg rounded-t-3xl bg-white p-5 shadow-pop sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-ink">{isEdit ? 'Editar meta' : 'Nova meta'}</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">{bag.periodo.key}</span>
        </div>

        <div className="space-y-3.5">
          {!isEdit && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">Área</span>
                <select value={area} onChange={(e) => { setArea(e.target.value as Area); setMetrica(''); }} className={`${selCls} w-full`}>
                  {AREAS.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-ink-soft">Métrica</span>
                <select value={metricaAtual} onChange={(e) => setMetrica(e.target.value)} className={`${selCls} w-full`} disabled={opcoes.length === 0}>
                  {opcoes.length === 0 && <option>Todas já definidas</option>}
                  {opcoes.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                </select>
              </label>
            </div>
          )}
          {isEdit && (
            <div className="rounded-xl bg-black/[0.03] px-3.5 py-2.5 text-sm">
              <span className="font-semibold text-ink">{mSel?.label}</span>
              <span className="text-ink-muted"> · {areaMeta(area).label}</span>
            </div>
          )}

          {mSel && <p className="-mt-1 text-xs text-ink-muted">{mSel.descricao}</p>}

          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">Alvo <span className="font-normal text-ink-muted">({dicaUnidade(unidade)})</span></span>
            <input type="number" step="any" value={alvoRaw} onChange={(e) => setAlvoRaw(e.target.value)} className={inp} placeholder="0" autoFocus />
          </label>

          {ehManual && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Realizado atual <span className="font-normal text-ink-muted">(manual — sem fonte automática)</span></span>
              <input type="number" step="any" value={realizadoRaw} onChange={(e) => setRealizadoRaw(e.target.value)} className={inp} placeholder="0" />
            </label>
          )}

          {mSel?.store !== 'metas_financeiras' && (
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-ink-soft">Responsável <span className="font-normal text-ink-muted">(opcional)</span></span>
              <input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inp} placeholder="Quem responde por esta meta" />
            </label>
          )}

          {mSel?.store === 'metas_financeiras' && (
            <p className="rounded-xl bg-sky-50 px-3 py-2 text-xs text-sky-700">Esta meta é compartilhada com o <strong>Financeiro</strong> — alterá-la aqui atualiza lá também.</p>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={salvar} disabled={saving || !metricaAtual} className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar meta'}</button>
        </div>
      </div>
    </div>
  );
}

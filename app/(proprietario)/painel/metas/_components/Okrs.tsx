'use client';

// Aba OKRs — objetivos do trimestre + resultados-chave (KRs) com progresso.
// Onde o KR é vinculado a uma métrica do catálogo, o "atual" é puxado
// automaticamente do realizado do trimestre (consolidado); senão é manual.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import type { MetasBag } from './shared';
import {
  type KR, type Unidade, type Realizado,
  METRICAS, metricaMeta, periodoDeOffset,
  normalizarKRs, progressoOkr,
  computarRealizado, criarOkr, salvarOkr, excluirOkr, inp, selCls,
} from '../_lib';
import {
  fmtValor, alvoInputValue, parseAlvo, dicaUnidade, Ring,
  IcoRocket, IcoPlus, IcoEdit, IcoTrash, IcoChevL, IcoChevR, IcoCheck,
} from './ui';

const STATUS_META: Record<string, { label: string; chip: string; cor: string }> = {
  concluido:  { label: 'Concluído',  chip: 'bg-emerald-50 text-emerald-700', cor: '#10b981' },
  no_caminho: { label: 'No caminho', chip: 'bg-sky-50 text-sky-700',         cor: '#1a73e8' },
  atencao:    { label: 'Atenção',    chip: 'bg-amber-50 text-amber-700',     cor: '#f59e0b' },
  em_risco:   { label: 'Em risco',   chip: 'bg-red-50 text-red-700',         cor: '#ef4444' },
};
function triLabel(key: string): string {
  const m = /^(\d{4})-Q([1-4])$/.exec(key);
  return m ? `T${m[2]} ${m[1]}` : key;
}

export default function Okrs({ bag }: { bag: MetasBag }) {
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const tri = useMemo(() => periodoDeOffset('trimestre', offset, bag.hoje), [offset, bag.hoje]);
  const [realTri, setRealTri] = useState<Realizado>({});
  const [loadingReal, setLoadingReal] = useState(true);
  const [modal, setModal] = useState<null | { editing?: ReturnType<typeof toOkr> }>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  // Realizado do trimestre (consolidado) p/ auto-preencher KRs vinculados.
  useEffect(() => {
    let vivo = true;
    setLoadingReal(true);
    const propIds = bag.props.map((p) => p.id);
    computarRealizado(bag.userId, tri, null, bag.props.length, propIds)
      .then((r) => { if (vivo) { setRealTri(r); setLoadingReal(false); } })
      .catch(() => { if (vivo) setLoadingReal(false); });
    return () => { vivo = false; };
  }, [bag.userId, tri, bag.props]);

  const doTri = useMemo(() => bag.okrs.filter((o) => o.trimestre === tri.key).map(toOkr), [bag.okrs, tri.key]);

  // Aplica o realizado automático aos KRs vinculados.
  const aplicarAuto = useCallback((krs: KR[]): KR[] => krs.map((kr) => {
    if (kr.metrica && realTri[kr.metrica] != null) return { ...kr, atual: realTri[kr.metrica] as number };
    return kr;
  }), [realTri]);

  async function remover(id: string) {
    if (confirmDel !== id) { setConfirmDel(id); setTimeout(() => setConfirmDel((c) => (c === id ? null : c)), 3000); return; }
    const { error } = await excluirOkr(id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('OKR removido.'); setConfirmDel(null); await bag.recarregar();
  }

  return (
    <div>
      {/* Navegação de trimestre */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button onClick={() => setOffset((o) => o - 1)} aria-label="Trimestre anterior" className="rounded-lg border border-black/10 p-2 hover:bg-black/[0.03]"><IcoChevL /></button>
          <span className="min-w-[110px] text-center text-sm font-bold text-ink">{triLabel(tri.key)}</span>
          <button onClick={() => setOffset((o) => o + 1)} aria-label="Próximo trimestre" className="rounded-lg border border-black/10 p-2 hover:bg-black/[0.03]"><IcoChevR /></button>
          {offset !== 0 && <button onClick={() => setOffset(0)} className="ml-1 text-xs font-semibold text-brand hover:underline">hoje</button>}
        </div>
        <button onClick={() => setModal({})} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Novo OKR</button>
      </div>

      {loadingReal && <p className="mt-2 text-xs text-ink-muted">Puxando o realizado do trimestre…</p>}

      {doTri.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-black/10 bg-white p-10 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-50 text-brand"><IcoRocket /></div>
          <h3 className="text-base font-bold text-ink">Nenhum OKR em {triLabel(tri.key)}</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Defina um objetivo ambicioso e 2–4 resultados-chave mensuráveis. Vincule cada KR a uma métrica para acompanhar o progresso automaticamente.</p>
          <button onClick={() => setModal({})} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Novo OKR</button>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {doTri.map((okr) => {
            const krsAuto = aplicarAuto(okr.krs);
            const prog = progressoOkr({ ...okr, krs: krsAuto });
            const st = STATUS_META[prog.status];
            return (
              <div key={okr.id} className="group relative rounded-2xl border border-black/[0.06] bg-white p-5 shadow-card">
                <div className="flex items-start gap-4">
                  <Ring pct={prog.progresso} cor={st.cor} size={60} stroke={6}>
                    <span style={{ fontSize: '0.75rem' }}>{Math.round(prog.progresso * 100)}%</span>
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold leading-snug text-ink">{okr.objetivo}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${st.chip}`}>{st.label}</span>
                      <span className="text-xs text-ink-muted">{prog.concluidos}/{prog.total} KRs</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {krsAuto.map((kr, i) => {
                    const p = okrKrProgress(kr);
                    const bound = !!kr.metrica;
                    const autoOn = bound && realTri[kr.metrica!] != null;
                    return (
                      <div key={kr.id || i}>
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 items-center gap-1.5 font-medium text-ink-soft">
                            {p >= 1 && <IcoCheck className="text-emerald-500" />}
                            <span className="truncate">{kr.titulo || metricaMeta(kr.metrica || '').label}</span>
                            {autoOn && <span className="shrink-0 rounded bg-sky-50 px-1.5 py-0.5 text-[0.6rem] font-semibold text-sky-600">auto</span>}
                          </span>
                          <span className="shrink-0 font-semibold text-ink">{fmtValor(kr.atual, kr.unidade)} <span className="text-ink-muted">/ {fmtValor(kr.alvo, kr.unidade)}</span></span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.round(p * 100)}%`, background: st.cor }} />
                        </div>
                      </div>
                    );
                  })}
                  {krsAuto.length === 0 && <p className="text-xs text-ink-muted">Sem resultados-chave. Edite para adicionar.</p>}
                </div>

                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  <button onClick={() => setModal({ editing: okr })} aria-label="Editar OKR" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                  <button onClick={() => remover(okr.id)} aria-label="Excluir OKR" className={`rounded-lg p-1.5 ${confirmDel === okr.id ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}><IcoTrash /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <OkrModal bag={bag} trimestre={tri.key} editing={modal.editing} onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await bag.recarregar(); }} toast={toast} />
      )}
    </div>
  );
}

// Linha do banco → OKR do motor.
function toOkr(r: { id: string; objetivo: string; trimestre: string; krs: unknown }) {
  return { id: r.id, objetivo: r.objetivo, trimestre: r.trimestre, krs: normalizarKRs(r.krs) };
}
// Progresso de um KR (reusa a regra do motor via clamp local p/ evitar import extra).
function okrKrProgress(kr: KR): number {
  const span = kr.alvo - kr.inicial;
  if (span === 0) return kr.atual >= kr.alvo ? 1 : 0;
  return Math.min(1, Math.max(0, (kr.atual - kr.inicial) / span));
}

// ── Modal de criar/editar OKR ─────────────────────────────────────────────────
type DraftKR = { id: string; titulo: string; metrica: string; unidade: Unidade; inicial: string; alvo: string; atual: string };
function novaKR(): DraftKR { return { id: crypto.randomUUID(), titulo: '', metrica: '', unidade: 'numero', inicial: '0', alvo: '', atual: '0' }; }

function OkrModal({ bag, trimestre, editing, onClose, onSaved, toast }: {
  bag: MetasBag; trimestre: string;
  editing?: { id: string; objetivo: string; trimestre: string; krs: KR[] };
  onClose: () => void; onSaved: () => Promise<void>; toast: ReturnType<typeof useToast>;
}) {
  const isEdit = !!editing;
  const [objetivo, setObjetivo] = useState(editing?.objetivo ?? '');
  const [krs, setKrs] = useState<DraftKR[]>(
    editing?.krs?.length
      ? editing.krs.map((k) => ({ id: k.id, titulo: k.titulo, metrica: k.metrica || '', unidade: k.unidade, inicial: alvoInputValue(k.unidade, k.inicial), alvo: alvoInputValue(k.unidade, k.alvo), atual: alvoInputValue(k.unidade, k.atual) }))
      : [novaKR()],
  );
  const [saving, setSaving] = useState(false);

  function setKr(i: number, patch: Partial<DraftKR>) { setKrs((arr) => arr.map((k, j) => (j === i ? { ...k, ...patch } : k))); }
  function onMetricaChange(i: number, metrica: string) {
    if (!metrica) { setKr(i, { metrica: '' }); return; }
    const m = metricaMeta(metrica);
    setKr(i, { metrica, unidade: m.unidade, titulo: krs[i].titulo || m.label });
  }

  async function salvar() {
    if (!objetivo.trim()) { toast.error('Descreva o objetivo.'); return; }
    const limpos: KR[] = krs
      .filter((k) => k.titulo.trim() || k.metrica)
      .map((k) => ({
        id: k.id, titulo: k.titulo.trim() || metricaMeta(k.metrica).label,
        unidade: k.unidade, metrica: k.metrica || null,
        inicial: parseAlvo(k.unidade, k.inicial), alvo: parseAlvo(k.unidade, k.alvo), atual: parseAlvo(k.unidade, k.atual),
      }));
    if (limpos.length === 0) { toast.error('Adicione ao menos um resultado-chave.'); return; }
    setSaving(true);
    try {
      const payload = { objetivo: objetivo.trim(), krs: limpos };
      if (isEdit && editing) { const { error } = await salvarOkr(editing.id, payload); if (error) throw error; }
      else { const { error } = await criarOkr({ ...payload, usuario_id: bag.userId, trimestre }); if (error) throw error; }
      toast.success(isEdit ? 'OKR atualizado!' : 'OKR criado!');
      await onSaved();
    } catch { toast.error('Erro ao salvar o OKR.'); } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl">
        <div className="flex items-center justify-between border-b border-black/[0.06] p-5">
          <h3 className="text-lg font-bold text-ink">{isEdit ? 'Editar OKR' : 'Novo OKR'}</h3>
          <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand">{triLabel(trimestre)}</span>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-ink-soft">Objetivo</span>
            <input value={objetivo} onChange={(e) => setObjetivo(e.target.value)} className={inp} placeholder="Ex.: Ser a referência de casamentos da região" autoFocus />
          </label>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Resultados-chave</span>
              <button onClick={() => setKrs((a) => [...a, novaKR()])} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><IcoPlus /> KR</button>
            </div>
            <div className="space-y-3">
              {krs.map((k, i) => (
                <div key={k.id} className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <input value={k.titulo} onChange={(e) => setKr(i, { titulo: e.target.value })} className={`${inp} py-2`} placeholder="Resultado-chave (ex.: Fechar 10 eventos)" />
                    {krs.length > 1 && <button onClick={() => setKrs((a) => a.filter((_, j) => j !== i))} aria-label="Remover KR" className="shrink-0 rounded-lg p-2 text-ink-muted hover:bg-black/[0.05] hover:text-red-600"><IcoTrash /></button>}
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="col-span-2 sm:col-span-1">
                      <span className="mb-0.5 block text-[0.7rem] text-ink-muted">Métrica (auto)</span>
                      <select value={k.metrica} onChange={(e) => onMetricaChange(i, e.target.value)} className={`${selCls} w-full py-1.5 text-xs`}>
                        <option value="">Manual</option>
                        {METRICAS.filter((m) => m.auto).map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
                      </select>
                    </label>
                    <label>
                      <span className="mb-0.5 block text-[0.7rem] text-ink-muted">De</span>
                      <input type="number" step="any" value={k.inicial} onChange={(e) => setKr(i, { inicial: e.target.value })} className={`${inp} py-1.5 text-xs`} />
                    </label>
                    <label>
                      <span className="mb-0.5 block text-[0.7rem] text-ink-muted">Até ({dicaUnidade(k.unidade)})</span>
                      <input type="number" step="any" value={k.alvo} onChange={(e) => setKr(i, { alvo: e.target.value })} className={`${inp} py-1.5 text-xs`} placeholder="alvo" />
                    </label>
                    <label>
                      <span className="mb-0.5 block text-[0.7rem] text-ink-muted">Atual {k.metrica ? '(auto)' : ''}</span>
                      <input type="number" step="any" value={k.atual} onChange={(e) => setKr(i, { atual: e.target.value })} disabled={!!k.metrica} className={`${inp} py-1.5 text-xs disabled:bg-black/[0.04] disabled:text-ink-muted`} />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 border-t border-black/[0.06] p-5">
          <button onClick={onClose} className="flex-1 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
          <button onClick={salvar} disabled={saving} className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{saving ? 'Salvando…' : isEdit ? 'Salvar' : 'Criar OKR'}</button>
        </div>
      </div>
    </div>
  );
}

'use client';

// Aba "Contingência" — a checklist de preparação agregada de todos os planos do
// evento (lonas, escoamento, ventiladores, sinalização, seguro-chuva…), com
// responsável e progresso. Marcar um item grava de volta no plano de origem
// (jsonb checklist) via RLS. Planos em maior risco aparecem primeiro. Sem "R$".

import { useMemo, useState } from 'react';
import { formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type PlanoBBag, type Plano, type ChecklistItem,
  riscoMeta, nivelMeta, avaliarPlano, progressoChecklist,
  salvarChecklist,
} from '../_lib';
import {
  Kpi, Progress, EmptyState, Chip,
  IcoCloud, IcoCheck, IcoList, IcoAlert,
} from './ui';

export default function Contingencia({ bag, onIrPlanos }: { bag: PlanoBBag; onIrPlanos: () => void }) {
  const toast = useToast();
  const { planos, resumo } = bag;
  const [busy, setBusy] = useState<string | null>(null);

  // Planos com checklist, não-descartados, ordenados por risco (pior primeiro).
  const grupos = useMemo(() => {
    return planos
      .filter((p) => p.status !== 'descartado' && p.checklist.length > 0)
      .map((p) => ({ p, av: avaliarPlano(p, resumo) }))
      .sort((a, b) => nivelMeta(b.av.nivel).peso - nivelMeta(a.av.nivel).peso || a.p.ordem - b.p.ordem);
  }, [planos, resumo]);

  const todosItens = useMemo(() => grupos.flatMap((g) => g.p.checklist), [grupos]);
  const total = todosItens.length;
  const feitos = todosItens.filter((i) => i.ok).length;
  const frac = total ? feitos / total : 0;

  const toggle = async (plano: Plano, indice: number) => {
    setBusy(`${plano.id}:${indice}`);
    const nova: ChecklistItem[] = plano.checklist.map((c, j) => j === indice ? { ...c, ok: !c.ok } : c);
    const { error } = await salvarChecklist(plano.id, nova);
    setBusy(null);
    if (error) { toast.error('Não foi possível atualizar o item.'); return; }
    await bag.recarregarPlanos();
  };

  if (total === 0) {
    return (
      <EmptyState icon={<IcoList />} title="Sem itens de contingência ainda"
        cta={<button onClick={onIrPlanos} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoCloud /> Ir para Gatilhos & Planos</button>}>
        Os itens de contingência (lonas, escoamento, ventiladores, sinalização, seguro-chuva…) vêm da checklist de cada plano. Gere os planos do modelo ou adicione itens em <strong>Gatilhos & Planos</strong>.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Kpi label="Itens preparados" value={`${feitos}/${total}`} tone={frac >= 1 ? 'verde' : 'brand'} icon={<IcoCheck />} />
        <Kpi label="Prontidão" value={formatPercent(frac)} tone={frac >= 1 ? 'verde' : 'gold'} icon={<IcoList />} />
        <Kpi label="Planos ativos" value={String(grupos.length)} tone="sky" icon={<IcoCloud />} />
      </div>
      <Progress value={frac} tone={frac >= 1 ? 'verde' : 'brand'} />

      <div className="space-y-4">
        {grupos.map(({ p, av }) => {
          const rm = riscoMeta(p.tipo_risco);
          const nm = nivelMeta(av.nivel);
          const prog = progressoChecklist(p.checklist);
          return (
            <div key={p.id} className="rounded-2xl bg-white p-4 shadow-card">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${rm.cor}1a`, color: rm.cor }}><IcoCloud /></span>
                  <div>
                    <div className="text-sm font-bold text-ink">{rm.label}</div>
                    {p.acao && <div className="max-w-md truncate text-[0.7rem] text-ink-muted">{p.acao}</div>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {(av.nivel === 'amarelo' || av.nivel === 'vermelho') && <Chip className={nm.chip}><IcoAlert /> {nm.label}</Chip>}
                  <span className="text-xs font-semibold text-ink-muted">{p.checklist.filter((c) => c.ok).length}/{p.checklist.length}</span>
                </div>
              </div>
              <Progress value={prog} tone={prog >= 1 ? 'verde' : 'brand'} className="mb-3" />
              <ul className="space-y-1.5">
                {p.checklist.map((item, i) => (
                  <li key={i}>
                    <button onClick={() => toggle(p, i)} disabled={busy === `${p.id}:${i}`}
                      className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2 text-left transition hover:bg-black/[0.02] disabled:opacity-60">
                      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${item.ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/20 text-transparent'}`}><IcoCheck /></span>
                      <span className={`flex-1 text-sm ${item.ok ? 'text-ink-muted line-through' : 'text-ink-soft'}`}>{item.label}</span>
                      {item.responsavel && <Chip className="bg-black/[0.04] text-ink-muted">{item.responsavel}</Chip>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

'use client';

// Aba Receitas — biblioteca de automações prontas (1 clique para ativar).
// Cada receita já vem com gatilho/condição/ação/mensagem sensatos (lib/automacoes
// RECEITAS); ativar = criar a automação via RLS (_lib.ativarReceita). Sem "R$".

import { useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { RECEITAS, ACAO_BY, resumoAutomacao, type Receita } from '@/lib/automacoes';
import type { AutomacoesCtx } from '../_lib';
import { ativarReceita } from '../_lib';
import { Chip, GatilhoIcon, AcaoIcon, IcoBolt, IcoCheck, IcoPlus } from './ui';

export default function Receitas({ ctx, onAtivada }: { ctx: AutomacoesCtx; onAtivada: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  // Receitas já ativas (mesmo gatilho+ação) — para marcar "Ativada".
  const ativasKeys = useMemo(() => new Set(ctx.automacoes.map((a) => `${a.gatilho}|${a.acao}`)), [ctx.automacoes]);

  async function ativar(r: Receita) {
    setBusy(r.id);
    const id = await ativarReceita(ctx.userId, r);
    setBusy(null);
    if (!id) { toast.error('Não foi possível ativar a receita.'); return; }
    toast.success(`"${r.nome}" ativada. Ajuste os detalhes na aba Automações se quiser.`);
    onAtivada();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">Ative em 1 clique. Depois é só editar a mensagem ou os filtros na aba <strong className="text-ink-soft">Automações</strong>.</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RECEITAS.map((r) => {
          const resumo = resumoAutomacao(r);
          const jaTem = ativasKeys.has(`${r.gatilho}|${r.acao}`);
          return (
            <div key={r.id} className="flex flex-col rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-start gap-2.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xl">{r.emoji}</span>
                <div className="min-w-0">
                  <h3 className="font-bold leading-tight text-ink">{r.nome}</h3>
                  <p className="mt-0.5 text-xs text-ink-muted">{r.desc}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <Chip className="bg-black/[0.04] text-ink-soft"><GatilhoIcon g={r.gatilho} /> {resumo.se}</Chip>
                <Chip className="bg-black/[0.04] text-ink-soft"><AcaoIcon a={r.acao} /> {ACAO_BY[r.acao]?.label}</Chip>
              </div>
              <div className="mt-auto pt-3.5">
                {jaTem ? (
                  <button onClick={() => ativar(r)} disabled={busy === r.id}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
                    <IcoCheck size={14} /> Ativa — adicionar outra
                  </button>
                ) : (
                  <button onClick={() => ativar(r)} disabled={busy === r.id}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
                    {busy === r.id ? 'Ativando…' : <><IcoPlus size={14} /> Ativar</>}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-ink-muted"><IcoBolt size={13} /> As receitas rodam no processador diário (5h da manhã). Use <strong className="text-ink-soft">Testar</strong> na aba Automações para disparar sob demanda.</p>
    </div>
  );
}

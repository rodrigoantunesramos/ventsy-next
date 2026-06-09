'use client';

// Aba Automações — lista das regras "se isto → então aquilo" com ligar/desligar,
// editar, testar e excluir. Abre o Builder para criar/editar. CRUD via RLS (_lib);
// teste pela /api/automacoes. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/lib/format';
import { type Automacao, resumoAutomacao } from '@/lib/automacoes';
import type { AutomacoesCtx } from '../_lib';
import { toggleAtivo, excluirAutomacao, apiTestar } from '../_lib';
import {
  Toggle, Chip, GatilhoIcon, AcaoIcon, EmptyState,
  btnPrimary, IcoBolt, IcoPlus, IcoEdit, IcoTrash, IcoPlay,
} from './ui';
import Builder from './Builder';

export default function Automacoes({ ctx }: { ctx: AutomacoesCtx }) {
  const toast = useToast();
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<Automacao | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  const lista = useMemo(() => [...ctx.automacoes].sort((a, b) => Number(b.ativo) - Number(a.ativo) || (b.criado_em > a.criado_em ? 1 : -1)), [ctx.automacoes]);

  async function onToggle(a: Automacao) {
    setBusy(a.id);
    const ok = await toggleAtivo(a.id, !a.ativo);
    setBusy(null);
    if (!ok) { toast.error('Não foi possível mudar o status.'); return; }
    await ctx.reloadAutomacoes();
  }
  async function onTestar(a: Automacao) {
    setBusy(a.id);
    const r = await apiTestar(a.id);
    setBusy(null);
    if (r.error) { toast.error(String(r.error)); return; }
    const exec = Number(r.executados) || 0, pul = Number(r.pulados) || 0;
    if (exec > 0) toast.success(`Disparou para ${exec} alvo(s).`);
    else if (pul > 0) toast.info('Alvos de hoje já processados.');
    else toast.info('Nenhum alvo casou com a regra hoje.');
    await Promise.all([ctx.reloadAutomacoes(), ctx.reloadNotificacoes(), ctx.reloadLogs()]);
  }
  async function onExcluir(a: Automacao) {
    if (confirmDel !== a.id) { setConfirmDel(a.id); return; }
    setConfirmDel(null);
    setBusy(a.id);
    const ok = await excluirAutomacao(a.id);
    setBusy(null);
    if (!ok) { toast.error('Falha ao excluir.'); return; }
    toast.success('Automação excluída.');
    await ctx.reloadAutomacoes();
  }

  function novo() { setEditing(null); setBuilderOpen(true); }
  function editar(a: Automacao) { setEditing(a); setBuilderOpen(true); }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">{lista.length} regra(s) · {lista.filter((a) => a.ativo).length} ativa(s)</p>
        <button onClick={novo} className={btnPrimary}><IcoPlus /> Nova automação</button>
      </div>

      {lista.length === 0 ? (
        <EmptyState icon={<IcoBolt size={22} />} title="Crie sua primeira automação"
          cta={<button onClick={novo} className={btnPrimary}><IcoPlus /> Nova automação</button>}>
          Regras <strong>se isto → então aquilo</strong> que trabalham por você: lembretes, cobranças, alertas e mensagens automáticas. Veja também as <strong>receitas prontas</strong>.
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {lista.map((a) => {
            const r = resumoAutomacao(a);
            const isBusy = busy === a.id;
            return (
              <div key={a.id} className={`rounded-2xl bg-white p-4 shadow-card transition ${a.ativo ? '' : 'opacity-70'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold text-ink">{a.nome}</h3>
                      {!a.ativo && <Chip className="bg-black/[0.05] text-ink-muted">Inativa</Chip>}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                      <Chip className="bg-black/[0.04] text-ink-soft"><GatilhoIcon g={a.gatilho} /> {r.se}</Chip>
                      <span>→</span>
                      <Chip className="bg-black/[0.04] text-ink-soft"><AcaoIcon a={a.acao} /> {r.entao}</Chip>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 text-[0.7rem] text-ink-muted">
                      <span>{a.n_exec} disparo(s)</span>
                      {a.ultima_exec && <span>· última: {formatDateTime(a.ultima_exec)}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Toggle checked={a.ativo} onChange={() => onToggle(a)} label="Ativa" />
                    <button onClick={() => onTestar(a)} disabled={isBusy} title="Testar agora" aria-label="Testar" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoPlay /></button>
                    <button onClick={() => editar(a)} title="Editar" aria-label="Editar" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => onExcluir(a)} disabled={isBusy} title={confirmDel === a.id ? 'Confirmar exclusão' : 'Excluir'} aria-label="Excluir"
                      className={`rounded-lg p-2 ${confirmDel === a.id ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-red-50 hover:text-red-600'}`}><IcoTrash /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {builderOpen && (
        <Builder ctx={ctx} inicial={editing}
          onClose={() => { setBuilderOpen(false); setEditing(null); }}
          onSaved={async () => { await ctx.reloadAutomacoes(); }} />
      )}
    </div>
  );
}

'use client';

// Aba "Pós-evento" — o encerramento: checklist de fechamento (tarefas da
// categoria "pos": desmontagem, devolução de equipamentos, vistoria, acerto),
// coleta de feedback e LIÇÕES APRENDIDAS (gravadas em briefing.licoesAprendidas).
// Permite marcar a produção como ENCERRADA. Liga a Equipamentos (devolução) e a
// Clientes/Avaliações (feedback). Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatDate, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ProducaoBag, type Tarefa,
  mesclarBriefing, dependenciaPendente, prontidao, patchTarefa, salvarProducao, inp,
} from '../_lib';
import {
  Kpi, Progress, EmptyState, Chip,
  IcoFlag, IcoCheck, IcoLock, IcoTruck, IcoUsers, IcoChevron, btnPrimary, btnSecondary,
} from './ui';

export default function PosEvento({ bag, onIrChecklist }: { bag: ProducaoBag; onIrChecklist: () => void }) {
  const toast = useToast();
  const { producao } = bag;
  const [licoes, setLicoes] = useState(() => mesclarBriefing(producao.briefing).licoesAprendidas);
  const [salvando, setSalvando] = useState(false);
  const [encerrando, setEncerrando] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const posTarefas = useMemo(() => bag.tarefas.filter((t) => t.categoria === 'pos').sort((a, b) => a.ordem - b.ordem), [bag.tarefas]);
  const pront = useMemo(() => prontidao(posTarefas), [posTarefas]);
  const encerrado = producao.status === 'encerrado';
  const tudoConcluido = useMemo(() => bag.tarefas.length > 0 && bag.tarefas.every((t) => t.status === 'concluida' || t.status === 'cancelada'), [bag.tarefas]);

  const concluir = async (t: Tarefa) => {
    setBusyId(t.id);
    const r = await patchTarefa({ tarefa_id: t.id, status: t.status === 'concluida' ? 'pendente' : 'concluida' });
    setBusyId(null);
    if (!r.ok) {
      toast.error(r.status === 409 ? `Conclua antes: "${r.dependencia || 'a tarefa de que esta depende'}".` : (r.error || 'Falha ao atualizar.'));
      return;
    }
    await bag.recarregar();
  };

  const salvarLicoes = async () => {
    setSalvando(true);
    const b = mesclarBriefing(producao.briefing);
    b.licoesAprendidas = licoes;
    const { error } = await salvarProducao(producao.id, { briefing: b });
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success('Lições aprendidas salvas.');
    await bag.recarregar();
  };

  const alternarEncerramento = async () => {
    setEncerrando(true);
    const { error } = await salvarProducao(producao.id, { status: encerrado ? 'em_execucao' : 'encerrado' });
    setEncerrando(false);
    if (error) { toast.error('Não foi possível atualizar o estágio.'); return; }
    toast.success(encerrado ? 'Produção reaberta.' : 'Produção encerrada. 🎉');
    await bag.recarregar();
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Estágio" value={encerrado ? 'Encerrado' : 'Aberto'} tone={encerrado ? 'cinza' : 'sky'} icon={<IcoFlag />} />
        <Kpi label="Fechamento" value={formatPercent(pront.fracao)} sub={`${pront.concluidas}/${pront.total} itens`} tone={pront.fracao >= 1 ? 'verde' : 'gold'} icon={<IcoCheck />} />
        <Kpi label="Tarefas totais" value={`${bag.tarefas.filter((t) => t.status === 'concluida').length}/${bag.tarefas.length}`} tone="brand" icon={<IcoCheck />} />
        <Kpi label="Itens do roteiro" value={`${bag.runshow.filter((r) => r.concluido).length}/${bag.runshow.length}`} tone="roxo" icon={<IcoCheck />} />
      </div>

      {/* Encerramento */}
      <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4 ${encerrado ? 'border-emerald-200 bg-emerald-50/60' : 'border-black/[0.06] bg-white shadow-card'}`}>
        <div>
          <h3 className="text-base font-bold text-ink">{encerrado ? 'Produção encerrada' : 'Encerrar a produção'}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {encerrado
              ? 'Tudo registrado. Você pode reabrir se precisar ajustar algo.'
              : tudoConcluido
                ? 'Todas as tarefas estão concluídas. Pode encerrar com segurança.'
                : 'Ainda há tarefas abertas — encerre quando o fechamento estiver completo.'}
          </p>
        </div>
        <button onClick={alternarEncerramento} disabled={encerrando}
          className={encerrado ? btnSecondary : btnPrimary}>
          {encerrando ? '…' : encerrado ? 'Reabrir produção' : 'Encerrar produção'}
        </button>
      </div>

      {/* Checklist de fechamento */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink"><IcoFlag /> Checklist de fechamento</h3>
          <button onClick={onIrChecklist} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Ver tudo <IcoChevron /></button>
        </div>
        {posTarefas.length === 0 ? (
          <EmptyState icon={<IcoFlag />} title="Sem tarefas de pós-evento"
            cta={<button onClick={onIrChecklist} className={btnSecondary}>Adicionar na checklist</button>}>
            Crie tarefas na categoria <strong>Pós-evento</strong> (desmontagem, devolução de equipamentos, vistoria, acerto financeiro) — elas aparecem aqui como o roteiro de encerramento.
          </EmptyState>
        ) : (
          <>
            <Progress value={pront.fracao} tone={pront.fracao >= 1 ? 'verde' : 'gold'} className="mb-4" />
            <div className="space-y-2">
              {posTarefas.map((t) => {
                const bloqueada = dependenciaPendente(t, bag.tarefaById);
                const concluida = t.status === 'concluida';
                return (
                  <div key={t.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                    <button onClick={() => concluir(t)} disabled={busyId === t.id || (bloqueada && !concluida)}
                      aria-label={concluida ? 'Reabrir' : 'Concluir'}
                      title={bloqueada && !concluida ? 'Há uma dependência pendente' : ''}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${concluida ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/15 text-transparent hover:border-emerald-400'} disabled:opacity-40`}>
                      <IcoCheck />
                    </button>
                    <span className={`min-w-0 flex-1 text-sm font-medium text-ink ${concluida ? 'text-ink-muted line-through' : ''}`}>{t.titulo}</span>
                    {bloqueada && !concluida && <Chip className="bg-amber-50 text-amber-700"><IcoLock /> aguarda</Chip>}
                    {t.responsavel_nome && <Chip className="bg-black/[0.04] text-ink-soft">{t.responsavel_nome}</Chip>}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Atalhos */}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <a href="/painel/equipamentos?tab=romaneio" className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3 transition hover:border-brand/30 hover:bg-brand-50/30">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><IcoTruck /></span>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink">Devolução de equipamentos</div><div className="text-[0.7rem] text-ink-muted">Conferir romaneio em Equipamentos</div></div>
            <IcoChevron />
          </a>
          <a href="/painel/clientes" className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3 transition hover:border-brand/30 hover:bg-brand-50/30">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><IcoUsers /></span>
            <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-ink">Coletar feedback</div><div className="text-[0.7rem] text-ink-muted">Registrar avaliação do cliente</div></div>
            <IcoChevron />
          </a>
        </div>
      </section>

      {/* Lições aprendidas */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-1 text-base font-bold text-ink">Lições aprendidas</h3>
        <p className="mb-3 text-sm text-ink-muted">O que deu certo, o que evitar no próximo evento, o que ajustar com fornecedores. Vira referência para os próximos briefings.</p>
        <textarea value={licoes} onChange={(e) => setLicoes(e.target.value)} rows={5} className={inp} placeholder="Ex.: A passagem de som atrasou 30min — pedir chegada do fornecedor 1h mais cedo. Buffet elogiado. Faltou sinalização no estacionamento." />
        <div className="mt-3 flex justify-end">
          <button onClick={salvarLicoes} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : 'Salvar lições'}</button>
        </div>
      </section>

      {producao.atualizado_em && (
        <p className="text-center text-[0.7rem] text-ink-muted">Última atualização da produção: {formatDate(producao.atualizado_em)}</p>
      )}
    </div>
  );
}

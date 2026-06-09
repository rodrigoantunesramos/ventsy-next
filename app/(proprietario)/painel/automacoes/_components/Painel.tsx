'use client';

// Aba Painel — a "central de pendências do dia" + KPIs do módulo.
// As pendências vêm do motor PURO (pendenciasDoDia) sobre os dados já carregados
// (parcelas/contratos/eventos/licenças) — dá valor mesmo sem nenhuma automação
// configurada. "Rodar agora" processa as automações ativas sob demanda
// (/api/automacoes). Sem "R$" hardcoded — valores via lib/format.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useToast } from '@/components/Toast';
import { formatMoneyShort, formatDate } from '@/lib/format';
import { pendenciasDoDia, contarNaoLidas, type Pendencia } from '@/lib/automacoes';
import type { AutomacoesCtx } from '../_lib';
import { apiProcessar } from '../_lib';
import { Kpi, UrgDot, btnSecondary, IcoBolt, IcoBell, IcoClock, IcoPlay, IcoExternal } from './ui';

const TIPO_LABEL: Record<string, string> = {
  parcela: 'Parcela', contrato: 'Contrato', evento: 'Evento', licenca: 'Licença', cliente: 'Cliente', feedback: 'Feedback',
};

export default function Painel({ ctx, onIrParaReceitas }: { ctx: AutomacoesCtx; onIrParaReceitas: () => void }) {
  const toast = useToast();
  const [rodando, setRodando] = useState(false);

  const pendencias = useMemo(() => pendenciasDoDia(ctx.dados, ctx.hoje, 7), [ctx.dados, ctx.hoje]);
  const ativas = useMemo(() => ctx.automacoes.filter((a) => a.ativo).length, [ctx.automacoes]);
  const naoLidas = useMemo(() => contarNaoLidas(ctx.notificacoes), [ctx.notificacoes]);
  const exec30d = useMemo(() => {
    const lim = new Date(Date.now() - 30 * 86400000).toISOString();
    return ctx.logs.filter((l) => l.sucesso && l.criado_em >= lim).length;
  }, [ctx.logs]);

  async function rodarAgora() {
    setRodando(true);
    const r = await apiProcessar();
    setRodando(false);
    if (r.error) { toast.error(String(r.error)); return; }
    const exec = Number(r.executados) || 0;
    if (exec > 0) toast.success(`${exec} ação(ões) executada(s) agora.`);
    else toast.info('Tudo em dia — nada novo para disparar hoje.');
    await Promise.all([ctx.reloadNotificacoes(), ctx.reloadLogs(), ctx.reloadAutomacoes()]);
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Automações ativas" value={String(ativas)} tone="brand" icon={<IcoBolt />} sub={`${ctx.automacoes.length} no total`} />
        <Kpi label="Pendências hoje" value={String(pendencias.length)} tone={pendencias.some((p) => p.urgencia === 'critico') ? 'vermelho' : 'gold'} icon={<IcoClock />} sub="próximos 7 dias" />
        <Kpi label="Não lidas" value={String(naoLidas)} tone="azul" icon={<IcoBell />} sub="no sino de notificações" />
        <Kpi label="Disparos (30d)" value={String(exec30d)} tone="verde" icon={<IcoPlay size={13} />} sub="execuções com sucesso" />
      </div>

      {/* Pendências do dia */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-ink">Minhas pendências do dia</h3>
            <p className="text-xs text-ink-muted">Parcelas, contratos, eventos e licenças que pedem atenção agora.</p>
          </div>
          <button onClick={rodarAgora} disabled={rodando} className={btnSecondary}>
            <IcoPlay /> {rodando ? 'Processando…' : 'Rodar automações agora'}
          </button>
        </div>

        {pendencias.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 py-10 text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><IcoBell /></div>
            <p className="text-sm font-semibold text-ink">Você está em dia 🎉</p>
            <p className="mt-0.5 text-xs text-ink-muted">Nenhuma parcela, contrato ou licença pedindo atenção nos próximos 7 dias.</p>
          </div>
        ) : (
          <ul className="divide-y divide-black/[0.05]">
            {pendencias.slice(0, 12).map((p, i) => <PendItem key={i} p={p} />)}
          </ul>
        )}
        {pendencias.length > 12 && <p className="mt-2 text-center text-xs text-ink-muted">+{pendencias.length - 12} outras pendências</p>}
      </div>

      {/* dica receitas */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/15 bg-brand-50/40 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white"><IcoBolt /></span>
          <div>
            <p className="text-sm font-bold text-ink">Automatize o trabalho repetitivo</p>
            <p className="text-xs text-ink-muted">Ative receitas prontas em 1 clique: lembrete de parcela, cobrança de atraso, aniversário, licença a vencer…</p>
          </div>
        </div>
        <button onClick={onIrParaReceitas} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Ver receitas</button>
      </div>
    </div>
  );
}

function PendItem({ p }: { p: Pendencia }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <UrgDot u={p.urgencia} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-ink">{p.titulo}</span>
          <span className="shrink-0 rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide text-ink-muted">{TIPO_LABEL[p.tipo] || p.tipo}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
          <span>{p.sub}</span>
          {p.data && <span>· {formatDate(p.data, { style: 'short' })}</span>}
          {p.valor_num != null && <span>· {formatMoneyShort(p.valor_num)}</span>}
        </div>
      </div>
      <Link href={p.link} className="shrink-0 rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand" aria-label="Abrir"><IcoExternal /></Link>
    </li>
  );
}

'use client';

// Aba Histórico — trilha de execução das automações (automacoes_log).
// KPIs de execução + tabela filtrável (automação/canal/resultado). Read-only:
// o log é gravado pelo processador/“testar”. Sem "R$".

import { useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { type AutomacaoLog, agregadoLog, ACAO_BY, GATILHO_BY } from '@/lib/automacoes';
import type { AutomacoesCtx } from '../_lib';
import { Kpi, Chip, EmptyState, IcoHistory, IcoCheck, IcoX } from './ui';

const CANAL_LABEL: Record<string, string> = { app: 'No app', email: 'E-mail', whatsapp: 'WhatsApp', funil: 'Funil' };

export default function Historico({ ctx }: { ctx: AutomacoesCtx }) {
  const [fAuto, setFAuto] = useState('');
  const [fResultado, setFResultado] = useState<'' | 'ok' | 'falha'>('');

  const nomePorId = useMemo(() => new Map(ctx.automacoes.map((a) => [a.id, a.nome])), [ctx.automacoes]);
  const agg = useMemo(() => agregadoLog(ctx.logs), [ctx.logs]);

  const filtrados = useMemo(() => {
    let arr = ctx.logs;
    if (fAuto) arr = arr.filter((l) => l.automacao_id === fAuto);
    if (fResultado === 'ok') arr = arr.filter((l) => l.sucesso);
    if (fResultado === 'falha') arr = arr.filter((l) => !l.sucesso);
    return [...arr].sort((a, b) => (b.criado_em > a.criado_em ? 1 : -1)).slice(0, 200);
  }, [ctx.logs, fAuto, fResultado]);

  const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Execuções" value={String(agg.total)} tone="ink" icon={<IcoHistory />} />
        <Kpi label="Com sucesso" value={String(agg.sucesso)} tone="verde" icon={<IcoCheck size={14} />} />
        <Kpi label="Falhas" value={String(agg.falha)} tone={agg.falha ? 'vermelho' : 'ink'} icon={<IcoX />} />
        <Kpi label="Por e-mail" value={String(agg.porCanal.email || 0)} tone="azul" sub={`${agg.porCanal.app || 0} no app · ${agg.porCanal.whatsapp || 0} WhatsApp`} />
      </div>

      {ctx.logs.length === 0 ? (
        <EmptyState icon={<IcoHistory size={22} />} title="Sem execuções ainda">
          Quando o processador diário rodar (ou você testar uma regra), cada disparo aparece aqui com o resultado.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <select value={fAuto} onChange={(e) => setFAuto(e.target.value)} className={selCls} aria-label="Filtrar por automação">
              <option value="">Todas as automações</option>
              {ctx.automacoes.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}
            </select>
            <select value={fResultado} onChange={(e) => setFResultado(e.target.value as '' | 'ok' | 'falha')} className={selCls} aria-label="Filtrar por resultado">
              <option value="">Todos os resultados</option>
              <option value="ok">Sucesso</option>
              <option value="falha">Falha</option>
            </select>
            {(fAuto || fResultado) && <button onClick={() => { setFAuto(''); setFResultado(''); }} className="rounded-xl px-3 py-2 text-sm text-ink-muted hover:text-brand">Limpar</button>}
          </div>

          {/* tabela (desktop) / cards (mobile) */}
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="hidden grid-cols-[1fr_1fr_auto_auto_auto] gap-3 border-b border-black/[0.06] px-4 py-2.5 text-[0.68rem] font-bold uppercase tracking-wide text-ink-muted sm:grid">
              <span>Quando</span><span>Automação / alvo</span><span>Gatilho</span><span>Canal</span><span>Resultado</span>
            </div>
            <ul className="divide-y divide-black/[0.05]">
              {filtrados.map((l) => <LogRow key={l.id} l={l} nome={nomePorId.get(l.automacao_id || '') || '—'} />)}
            </ul>
            {filtrados.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-muted">Nenhuma execução com esses filtros.</p>}
          </div>
          {ctx.logs.length > 200 && <p className="text-center text-xs text-ink-muted">Mostrando as 200 execuções mais recentes.</p>}
        </>
      )}
    </div>
  );
}

function LogRow({ l, nome }: { l: AutomacaoLog; nome: string }) {
  return (
    <li className="grid grid-cols-1 gap-1.5 px-4 py-3 text-sm sm:grid-cols-[1fr_1fr_auto_auto_auto] sm:items-center sm:gap-3">
      <span className="text-xs text-ink-muted">{formatDateTime(l.criado_em)}</span>
      <div className="min-w-0">
        <div className="truncate font-semibold text-ink-soft">{nome}</div>
        {l.alvo_label && <div className="truncate text-xs text-ink-muted">{l.alvo_label}</div>}
      </div>
      <span className="text-xs text-ink-muted">{GATILHO_BY[l.gatilho as keyof typeof GATILHO_BY]?.label || l.gatilho}</span>
      <span className="text-xs text-ink-muted">{CANAL_LABEL[l.canal || 'app'] || l.canal}</span>
      <div className="flex items-center gap-1.5">
        {l.sucesso
          ? <Chip className="bg-emerald-50 text-emerald-700"><IcoCheck size={11} /> Ok</Chip>
          : <Chip className="bg-red-50 text-red-700"><IcoX /> Falha</Chip>}
        {l.detalhe && <span className="truncate text-[0.68rem] text-ink-muted" title={l.detalhe}>{l.detalhe}</span>}
      </div>
    </li>
  );
}

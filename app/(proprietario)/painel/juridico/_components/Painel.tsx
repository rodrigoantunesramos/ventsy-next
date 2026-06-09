'use client';

// Aba "Painel" — visão geral da conformidade. Semáforo de pendências, KPIs de
// contratos/processos/LGPD, valor sob contrato (por moeda) e o FEED de prazos
// próximos (contratos + processos + solicitações de titular), tudo calculado pela
// engine pura (lib/juridico). Clicar num prazo leva para a aba correspondente.
// Sem "R$" hardcoded — moeda/data via lib/format.

import { useMemo } from 'react';
import { formatMoney, formatDate } from '@/lib/format';
import {
  type JuridicoBag, type PrazoItem,
  consolidarContratos, resumoContratos, resumoProcessos, resumoLGPD, prazosProximos,
} from '../_lib';
import {
  Kpi, EmptyState, SectionCard, toneClasses,
  IcoDoc, IcoGavel, IcoShield, IcoUserCheck, IcoClock, IcoAlert, IcoCheck, IcoCalendar,
} from './ui';

// i18n: texto relativo de prazo (centralizado; extrair p/ dicionário PT/EN/ES).
function prazoTexto(dias: number): string {
  if (dias < 0) return `vencido há ${Math.abs(dias)}d`;
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  return `em ${dias}d`;
}

export default function Painel({ bag }: { bag: JuridicoBag }) {
  const { hoje } = bag;

  const consolidados = useMemo(
    () => consolidarContratos(bag.contratosCliente, bag.contratosJur, hoje),
    [bag.contratosCliente, bag.contratosJur, hoje],
  );
  const rc = useMemo(() => resumoContratos(consolidados), [consolidados]);
  const rp = useMemo(() => resumoProcessos(bag.processos), [bag.processos]);
  const rl = useMemo(() => resumoLGPD(bag.consentimentos, bag.solicitacoes, hoje), [bag.consentimentos, bag.solicitacoes, hoje]);
  const prazos = useMemo(
    () => prazosProximos(consolidados, bag.processos, bag.solicitacoes, hoje),
    [consolidados, bag.processos, bag.solicitacoes, hoje],
  );

  const vencidos = rc.vencidos + rl.solicVencidas;
  const aVencer = rc.aVencer + rl.solicAVencer;
  const semaforo = vencidos > 0 ? 'vermelho' : aVencer > 0 ? 'amarelo' : 'verde';
  const moedas = Object.entries(rc.valorPorMoeda).filter(([, v]) => v > 0);

  const vazio = consolidados.length === 0 && bag.processos.length === 0 && bag.consentimentos.length === 0 && bag.solicitacoes.length === 0;
  if (vazio) {
    return (
      <EmptyState icon={<IcoDoc />} title="Comece a centralizar o jurídico aqui"
        cta={<button onClick={() => bag.goTab('contratos')} className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Adicionar primeiro contrato</button>}>
        Cadastre contratos (fornecedor, trabalho, parceria), processos e registros de LGPD. Os contratos de cliente vindos de <strong>Contratos</strong> aparecem aqui automaticamente, e os prazos passam a alertar com 30/60/90 dias de antecedência.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Semáforo de conformidade */}
      <SemaforoBanner semaforo={semaforo} vencidos={vencidos} aVencer={aVencer} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Contratos vigentes" value={String(rc.vigentes)} tone="verde" icon={<IcoDoc />} sub={`${rc.ativos} ativos de ${rc.total}`} />
        <Kpi label="A vencer (90 dias)" value={String(rc.aVencer)} tone={rc.aVencer > 0 ? 'amarelo' : 'cinza'} icon={<IcoClock />} sub={`30d ${rc.faixa30} · 60d ${rc.faixa60} · 90d ${rc.faixa90}`} />
        <Kpi label="Contratos vencidos" value={String(rc.vencidos)} tone={rc.vencidos > 0 ? 'vermelho' : 'verde'} icon={<IcoAlert />} sub={rc.vencidos > 0 ? 'requer renovação' : 'tudo em dia'} />
        <Kpi label="Processos ativos" value={String(rp.ativos)} tone={rp.ativos > 0 ? 'azul' : 'cinza'} icon={<IcoGavel />} sub={`${rp.comPrazo} com prazo`} />
        <Kpi label="Consentimentos ativos" value={String(rl.consentAtivos)} tone="verde" icon={<IcoUserCheck />} sub={`${rl.consentRevogados} revogados`} />
        <Kpi label="Solicitações abertas" value={String(rl.solicAbertas)} tone={rl.solicVencidas > 0 ? 'vermelho' : rl.solicAVencer > 0 ? 'amarelo' : 'cinza'} icon={<IcoShield />} sub={rl.solicVencidas > 0 ? `${rl.solicVencidas} fora do prazo` : 'dentro do prazo'} />
        <Kpi label="Total de contratos" value={String(rc.total)} tone="cinza" icon={<IcoDoc />} sub={`${bag.contratosCliente.length} de clientes`} />
        <Kpi label="Regras de retenção" value={String(bag.retencao.length)} tone="cinza" icon={<IcoCheck />} sub={`${bag.politicas.filter((p) => p.publicada).length} políticas publicadas`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Prazos próximos (feed) */}
        <div className="lg:col-span-2">
          <SectionCard title="Prazos próximos" desc="Vencimentos de contratos, prazos de processos e solicitações de titular nos próximos 120 dias.">
            {prazos.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-700">
                <IcoCheck /> Nenhum prazo nos próximos 120 dias. Tudo sob controle.
              </div>
            ) : (
              <ul className="divide-y divide-black/[0.05]">
                {prazos.slice(0, 12).map((p) => <PrazoRow key={p.id} p={p} onGo={bag.goTab} />)}
              </ul>
            )}
          </SectionCard>
        </div>

        {/* Coluna lateral: valor sob contrato + LGPD */}
        <div className="space-y-5">
          <SectionCard title="Valor sob contrato" desc="Soma dos contratos ativos, separada por moeda.">
            {moedas.length === 0 ? (
              <p className="text-sm text-ink-muted">Sem valores informados nos contratos ativos.</p>
            ) : (
              <ul className="space-y-2.5">
                {moedas.map(([moeda, valor]) => (
                  <li key={moeda} className="flex items-center justify-between">
                    <span className="text-sm text-ink-muted">{moeda}</span>
                    <span className="text-lg font-bold text-ink">{formatMoney(valor, { currency: moeda as 'BRL' | 'USD' | 'EUR' })}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="LGPD em números" desc="Privacidade do tratamento de dados.">
            <ul className="space-y-2 text-sm">
              <LinhaLgpd label="Consentimentos ativos" valor={rl.consentAtivos} />
              <LinhaLgpd label="Consentimentos revogados" valor={rl.consentRevogados} />
              <LinhaLgpd label="Solicitações abertas" valor={rl.solicAbertas} alerta={rl.solicAbertas > 0} />
              <LinhaLgpd label="Fora do prazo legal" valor={rl.solicVencidas} alerta={rl.solicVencidas > 0} />
            </ul>
            <button onClick={() => bag.goTab('direitos')} className="mt-4 w-full rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">
              Ver direitos do titular
            </button>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

const SEM_BANNER: Record<'verde' | 'amarelo' | 'vermelho', string> = {
  verde: 'border-emerald-200 bg-emerald-50',
  amarelo: 'border-amber-200 bg-amber-50',
  vermelho: 'border-red-200 bg-red-50',
};
function SemaforoBanner({ semaforo, vencidos, aVencer }: { semaforo: 'verde' | 'amarelo' | 'vermelho'; vencidos: number; aVencer: number }) {
  const t = toneClasses(semaforo);
  const titulo = semaforo === 'vermelho' ? 'Há pendências vencidas' : semaforo === 'amarelo' ? 'Atenção a prazos próximos' : 'Conformidade em dia';
  const desc = semaforo === 'vermelho'
    ? `${vencidos} item(ns) vencido(s) entre contratos e solicitações de titular. Priorize a renovação/atendimento.`
    : semaforo === 'amarelo'
      ? `${aVencer} item(ns) a vencer. Programe renovações e respostas dentro do prazo.`
      : 'Nenhum contrato vencido e nenhuma solicitação de titular fora do prazo legal.';
  return (
    <div className={`flex items-center gap-3 rounded-2xl border border-l-4 p-4 ${SEM_BANNER[semaforo]}`}>
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${t.dot} text-white`}>
        {semaforo === 'verde' ? <IcoCheck /> : <IcoAlert />}
      </span>
      <div>
        <div className="text-base font-bold text-ink">{titulo}</div>
        <div className="mt-0.5 text-[0.8rem] text-ink-muted">{desc}</div>
      </div>
    </div>
  );
}

function PrazoRow({ p, onGo }: { p: PrazoItem; onGo: (t: 'contratos' | 'processos' | 'direitos') => void }) {
  const t = toneClasses(p.tone);
  const destino = p.origem === 'contrato' ? 'contratos' : p.origem === 'processo' ? 'processos' : 'direitos';
  const Ico = p.origem === 'contrato' ? IcoDoc : p.origem === 'processo' ? IcoGavel : IcoShield;
  return (
    <li>
      <button onClick={() => onGo(destino)} className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-black/[0.015]">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.badge}`}><Ico /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{p.titulo}</div>
          <div className="truncate text-[0.75rem] text-ink-muted">{p.subtitulo}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-1.5 text-xs text-ink-muted"><IcoCalendar />{formatDate(p.data, { style: 'short' })}</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[0.7rem] font-semibold ${t.chip}`}>{prazoTexto(p.dias)}</span>
        </div>
      </button>
    </li>
  );
}

function LinhaLgpd({ label, valor, alerta }: { label: string; valor: number; alerta?: boolean }) {
  return (
    <li className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`font-bold ${alerta && valor > 0 ? 'text-red-600' : 'text-ink'}`}>{valor}</span>
    </li>
  );
}

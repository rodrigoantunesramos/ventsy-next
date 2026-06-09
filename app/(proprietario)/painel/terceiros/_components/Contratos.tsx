'use client';

// Aba "Contratos & SLA" — o lado contratual de cada terceiro: vigência,
// renovação/rescisão, aviso prévio, multas/glosas e as metas de SLA com o
// cumprimento medido. Ordena por urgência (vencendo primeiro) e destaca as
// renovações a decidir. Reusa o modal de edição da Carteira.

import { useMemo, useState } from 'react';
import { formatDate, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Terceiro, type TerceiroAgg, type VigenciaStatus, type FornecedorLite,
  categoriaLabel, statusVigencia, diasAte, diasLabel,
  signedUrl, fornecedorLabel,
} from '../_lib';
import type { TerceirosBag } from './shared';
import { TerceiroModal } from './Carteira';
import {
  EmptyState, Chip, Farol, Progress, btnPrimary, btnSecondary,
  IcoSignature, IcoDoc, IcoEdit, IcoAlert, IcoCalendar, IcoCheck, IcoRefresh,
} from './ui';

const VIGENCIA_META: Record<VigenciaStatus, { label: string; chip: string }> = {
  vencida:   { label: 'Vencido',   chip: 'bg-red-50 text-red-700' },
  a_vencer:  { label: 'A vencer',  chip: 'bg-amber-50 text-amber-700' },
  vigente:   { label: 'Vigente',   chip: 'bg-emerald-50 text-emerald-700' },
  futura:    { label: 'Futuro',    chip: 'bg-sky-50 text-sky-700' },
  sem_termo: { label: 'Sem termo', chip: 'bg-black/[0.04] text-ink-soft' },
};
const ORDEM: Record<VigenciaStatus, number> = { vencida: 0, a_vencer: 1, vigente: 2, futura: 3, sem_termo: 4 };

export default function Contratos({ bag, onAbrirFicha }: { bag: TerceirosBag; onAbrirFicha: (id: string) => void }) {
  const toast = useToast();
  const { aggs, hoje, fornecedoresMap } = bag;
  const [edit, setEdit] = useState<Terceiro | null>(null);

  const ordenados = useMemo(() => {
    return [...aggs]
      .filter((a) => a.terceiro.status !== 'encerrado')
      .sort((a, a2) => {
        const va = statusVigencia(a.terceiro, hoje), vb = statusVigencia(a2.terceiro, hoje);
        if (ORDEM[va] !== ORDEM[vb]) return ORDEM[va] - ORDEM[vb];
        return (diasAte(a.terceiro.vigencia_fim, hoje) ?? 9e9) - (diasAte(a2.terceiro.vigencia_fim, hoje) ?? 9e9);
      });
  }, [aggs, hoje]);

  const renovacoes = useMemo(() => ordenados.filter((a) => {
    const v = statusVigencia(a.terceiro, hoje);
    return (v === 'a_vencer' || v === 'vencida') && !a.terceiro.renovacao_automatica;
  }), [ordenados, hoje]);

  if (aggs.length === 0) {
    return (
      <EmptyState icon={<IcoSignature />} title="Nenhum contrato para acompanhar">
        Cadastre um terceirizado na aba <strong>Carteira</strong> com vigência e SLA para acompanhar renovação, rescisão e cumprimento aqui.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Renovações a decidir */}
      {renovacoes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800"><IcoAlert /> Renovações a decidir ({renovacoes.length})</div>
          <div className="space-y-1.5">
            {renovacoes.slice(0, 6).map((a) => {
              const d = diasAte(a.terceiro.vigencia_fim, hoje);
              const vencido = d != null && d < 0;
              return (
                <button key={a.terceiro.id} onClick={() => setEdit(a.terceiro)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-left text-sm hover:bg-white">
                  <span className="truncate font-medium text-ink">{a.terceiro.servico}</span>
                  <span className={`shrink-0 text-xs font-semibold ${vencido ? 'text-red-600' : 'text-amber-700'}`}>
                    {a.terceiro.vigencia_fim ? formatDate(a.terceiro.vigencia_fim, { style: 'short' }) : '—'} · {diasLabel(d).toLowerCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista de contratos */}
      <div className="space-y-2.5">
        {ordenados.map((a) => (
          <ContratoCard key={a.terceiro.id} agg={a} hoje={hoje}
            forn={fornNome(a, fornecedoresMap)}
            onEdit={() => setEdit(a.terceiro)} onFicha={() => onAbrirFicha(a.terceiro.id)}
            toast={toast} />
        ))}
      </div>

      {edit && (
        <TerceiroModal bag={bag} editing={edit}
          onClose={() => setEdit(null)}
          onSaved={async () => { setEdit(null); await bag.recarregar(); }}
          onDeleted={async () => { setEdit(null); await bag.recarregar(); }}
          toastError={(m) => toast.error(m)} toastOk={(m) => toast.success(m)} />
      )}
    </div>
  );
}

function fornNome(agg: TerceiroAgg, map: Map<string, FornecedorLite>): string | null {
  const id = agg.terceiro.fornecedor_id;
  if (!id) return null;
  const f = map.get(id);
  return f ? fornecedorLabel(f) : null;
}

function ContratoCard({ agg, hoje, forn, onEdit, onFicha, toast }: {
  agg: TerceiroAgg; hoje: string; forn: string | null;
  onEdit: () => void; onFicha: () => void; toast: ReturnType<typeof useToast>;
}) {
  const t = agg.terceiro;
  const vig = statusVigencia(t, hoje);
  const vm = VIGENCIA_META[vig];
  const fimDias = diasAte(t.vigencia_fim, hoje);

  const abrirDoc = async () => {
    const url = await signedUrl(t.documento_url);
    if (url) window.open(url, '_blank'); else toast.error('Não foi possível abrir o contrato.');
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={onFicha} className="font-bold text-ink hover:text-brand">{t.servico}</button>
            <Chip className="bg-black/[0.04] text-ink-soft">{categoriaLabel(t.categoria)}</Chip>
            <Chip className={vm.chip}>{vm.label}</Chip>
            {t.renovacao_automatica && <Chip className="bg-sky-50 text-sky-700"><IcoRefresh /> Renova auto</Chip>}
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            {forn && <>{forn} · </>}
            {t.vigencia_inicio || t.vigencia_fim
              ? <>{t.vigencia_inicio ? formatDate(t.vigencia_inicio, { style: 'short' }) : '…'} → {t.vigencia_fim ? formatDate(t.vigencia_fim, { style: 'short' }) : 'sem termo'}{fimDias != null && (vig === 'a_vencer' || vig === 'vencida') ? ` · ${diasLabel(fimDias).toLowerCase()}` : ''}</>
              : 'Vigência não informada'}
            {t.aviso_previo_dias ? ` · aviso ${t.aviso_previo_dias}d` : ''}
          </div>
          {t.multa_rescisao && <div className="mt-1 text-xs text-ink-muted">⚠️ Rescisão: {t.multa_rescisao}</div>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {t.documento_url && <button onClick={abrirDoc} className={btnSecondary}><IcoDoc /> Contrato</button>}
          <button onClick={onEdit} className={btnSecondary}><IcoEdit /> Editar</button>
        </div>
      </div>

      {/* SLA */}
      <div className="mt-3 border-t border-black/[0.05] pt-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-soft"><Farol nivel={agg.slaNivel} /> SLA</span>
          {t.sla.alvo_pct != null ? (
            <span className="text-xs text-ink-muted">
              meta {formatPercent(t.sla.alvo_pct / 100, { maximumFractionDigits: 0 })}
              {agg.slaCumpridoPct != null && <> · cumprido <strong className={agg.slaNivel === 'verde' ? 'text-emerald-600' : agg.slaNivel === 'amarelo' ? 'text-amber-600' : 'text-red-600'}>{formatPercent(agg.slaCumpridoPct / 100, { maximumFractionDigits: 0 })}</strong></>}
            </span>
          ) : (
            <span className="text-xs text-ink-muted">Sem meta de SLA definida</span>
          )}
        </div>
        {agg.slaCumpridoPct != null && t.sla.alvo_pct != null && (
          <div className="mt-2"><Progress value={agg.slaCumpridoPct / 100} tone={agg.slaNivel === 'verde' ? 'verde' : agg.slaNivel === 'amarelo' ? 'gold' : 'vermelho'} /></div>
        )}
        {t.sla.metas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.sla.metas.map((m, i) => (
              <span key={i} className="inline-flex items-center gap-1 rounded-lg bg-black/[0.03] px-2 py-1 text-[0.7rem] text-ink-soft">
                <IcoCheck /> <strong className="font-semibold">{m.nome}</strong>{m.alvo ? `: ${m.alvo}` : ''}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

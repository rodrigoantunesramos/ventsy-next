'use client';

// Cartão de UMA licença — reaproveitado por Alvarás permanentes e Por evento.
// Mostra status efetivo (derivado da validade), prazo, órgão, custo e ações
// (editar, abrir documento, lançar/estornar custo, excluir). Sem "R$" cru:
// custo via formatMoney; datas via formatDate.

import { useState } from 'react';
import { formatMoney, formatDate } from '@/lib/format';
import {
  type Licenca, statusEfetivo, statusMeta, tipoMeta, diasAte, diasLabel, ESCOPO_META,
} from '@/lib/licencas';
import { signedUrl } from '../_lib';
import {
  Chip, btnGhost, IcoEdit, IcoTrash, IcoDoc, IcoCoins, IcoBuildingSmall, IcoCalendar,
} from './ui';

type Props = {
  licenca: Licenca;
  hoje: string;
  propNome?: string;
  eventoNome?: string;
  showEscopo?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLancar?: () => void;
  onEstornar?: () => void;
  busy?: boolean;
};

export default function LicencaCard({
  licenca: l, hoje, propNome, eventoNome, showEscopo, onEdit, onDelete, onLancar, onEstornar, busy,
}: Props) {
  const [abrindo, setAbrindo] = useState(false);
  const st = statusEfetivo(l, hoje);
  const sm = statusMeta(st);
  const tm = tipoMeta(l.tipo);
  const dias = diasAte(l.validade, hoje);
  const prazoTone = st === 'vencida' ? 'text-red-600' : st === 'a_vencer' ? 'text-amber-600' : 'text-ink-muted';

  const abrirDoc = async () => {
    setAbrindo(true);
    try {
      const url = await signedUrl(l.documento_url);
      if (url) window.open(url, '_blank', 'noopener');
    } finally {
      setAbrindo(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card sm:flex-row sm:items-center">
      {/* Identidade */}
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span className="mt-0.5 h-9 w-9 shrink-0 rounded-lg" style={{ backgroundColor: tm.cor + '1a', color: tm.cor }}>
          <span className="flex h-full w-full items-center justify-center text-[0.8rem] font-bold">{tm.label.slice(0, 1)}</span>
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-sm font-bold text-ink">{l.titulo || tm.label}</span>
            {l.obrigatorio && l.escopo === 'evento' && <Chip className="bg-brand-50 text-brand">Obrigatória</Chip>}
            {showEscopo && <Chip className={ESCOPO_META[(l.escopo as 'permanente' | 'evento')]?.chip || 'bg-gray-100 text-gray-600'}>{ESCOPO_META[(l.escopo as 'permanente' | 'evento')]?.label || l.escopo}</Chip>}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.78rem] text-ink-muted">
            {l.orgao && <span>{l.orgao}</span>}
            {l.numero && <span>· nº {l.numero}</span>}
            {l.protocolo && <span>· protocolo {l.protocolo}</span>}
            {propNome && <span className="inline-flex items-center gap-1"><IcoBuildingSmall /> {propNome}</span>}
            {eventoNome && <span className="inline-flex items-center gap-1"><IcoCalendar /> {eventoNome}</span>}
          </div>
        </div>
      </div>

      {/* Prazo + custo */}
      <div className="flex shrink-0 flex-col items-start gap-0.5 sm:items-end">
        <Chip className={sm.chip}><span className={`h-1.5 w-1.5 rounded-full ${sm.dot}`} /> {sm.label}</Chip>
        {l.validade ? (
          <span className={`text-[0.72rem] ${prazoTone}`}>
            {formatDate(l.validade, { style: 'short' })} · {diasLabel(dias)}
          </span>
        ) : (
          <span className="text-[0.72rem] text-ink-muted">Sem vencimento</span>
        )}
        {l.custo_num != null && l.custo_num > 0 && (
          <span className="text-[0.72rem] font-semibold text-ink-soft">{formatMoney(l.custo_num)}</span>
        )}
      </div>

      {/* Ações */}
      <div className="flex shrink-0 items-center gap-1 border-t border-black/[0.05] pt-2 sm:border-l sm:border-t-0 sm:pl-2 sm:pt-0">
        {l.documento_url && (
          <button onClick={abrirDoc} disabled={abrindo} className={btnGhost} aria-label="Abrir documento" title="Abrir documento"><IcoDoc /></button>
        )}
        {l.custo_num != null && l.custo_num > 0 && (
          l.lancamento_id
            ? onEstornar && <button onClick={onEstornar} disabled={busy} className={`${btnGhost} text-emerald-600`} title="Custo lançado no caixa — clique para estornar"><IcoCoins /></button>
            : onLancar && <button onClick={onLancar} disabled={busy} className={btnGhost} title="Lançar custo no caixa (contábil)"><IcoCoins /></button>
        )}
        <button onClick={onEdit} className={btnGhost} aria-label="Editar" title="Editar"><IcoEdit /></button>
        <button onClick={onDelete} className={`${btnGhost} text-red-600 hover:text-red-700`} aria-label="Excluir" title="Excluir"><IcoTrash /></button>
      </div>
    </div>
  );
}

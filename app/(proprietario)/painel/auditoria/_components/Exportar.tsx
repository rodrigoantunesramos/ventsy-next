'use client'

// Aba Exportar & Retenção: baixa a trilha por período (CSV, para auditoria
// externa) e define por quanto tempo guardar os logs — com expurgo sob demanda
// dos registros mais antigos que a política. O cálculo/serialização é puro
// (lib/audit); a escrita/expurgo passa pela rota service-role.

import { useState } from 'react'
import { addDiasYMD } from '@/lib/audit'
import { useToast } from '@/components/Toast'
import {
  type AuditBag, RETENCAO_OPCOES, lerRetencao, salvarRetencao,
  buscarParaExport, baixarCSV, expurgarRetencao,
} from '../_lib'
import { Section, IcoDownload, IcoTrash, IcoClock, IcoExport, IcoAlert } from './ui'

const inp = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function Exportar({ bag }: { bag: AuditBag }) {
  const toast = useToast()
  const [de, setDe] = useState(() => addDiasYMD(bag.hoje, -30))
  const [ate, setAte] = useState(bag.hoje)
  const [exportando, setExportando] = useState(false)

  const [retencao, setRetencao] = useState(() => lerRetencao())
  const [confirmar, setConfirmar] = useState(false)
  const [expurgando, setExpurgando] = useState(false)

  async function exportarPeriodo() {
    if (de > ate) { toast.error('A data inicial não pode ser depois da final.'); return }
    setExportando(true)
    try {
      const logs = await buscarParaExport(bag.userId, de, ate)
      if (!logs.length) { toast.info('Nenhum evento no período selecionado.'); return }
      baixarCSV(logs, `${de}_a_${ate}`)
      toast.success(`${logs.length} evento(s) exportado(s).`)
    } finally {
      setExportando(false)
    }
  }

  function mudarRetencao(dias: number) {
    setRetencao(dias)
    salvarRetencao(dias)
    setConfirmar(false)
    toast.success('Política de retenção atualizada.')
  }

  async function executarExpurgo() {
    setExpurgando(true)
    try {
      const { ok, removidos } = await expurgarRetencao(retencao)
      if (!ok) { toast.error('Não foi possível expurgar agora.'); return }
      toast.success(removidos > 0 ? `${removidos} registro(s) antigo(s) removido(s).` : 'Nada a remover — tudo dentro da retenção.')
      setConfirmar(false)
      await bag.recarregar()
    } finally {
      setExpurgando(false)
    }
  }

  const retLabel = RETENCAO_OPCOES.find((o) => o.v === retencao)?.label || `${retencao} dias`

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Exportação por período */}
      <Section title="Exportar trilha por período" hint="Gera um CSV com todos os eventos do intervalo — para auditoria externa ou arquivamento.">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-xs font-medium text-ink-soft">
            De
            <input type="date" value={de} max={ate} onChange={(e) => setDe(e.target.value)} className={`${inp} mt-1 block`} />
          </label>
          <label className="text-xs font-medium text-ink-soft">
            Até
            <input type="date" value={ate} min={de} max={bag.hoje} onChange={(e) => setAte(e.target.value)} className={`${inp} mt-1 block`} />
          </label>
          <button onClick={exportarPeriodo} disabled={exportando}
            className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
            <IcoDownload /> {exportando ? 'Gerando…' : 'Exportar CSV'}
          </button>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl bg-black/[0.02] p-3 text-xs text-ink-muted">
          <span className="mt-0.5 text-ink-soft"><IcoExport /></span>
          <p>O arquivo inclui ator, e-mail, ação, entidade, data/hora (ISO), IP, dispositivo e o resumo das alterações. Segredos (senhas, tokens, cartões) nunca são exportados — são redigidos na gravação.</p>
        </div>
      </Section>

      {/* Retenção */}
      <Section title="Retenção de logs" hint="Por quanto tempo guardar a trilha antes de expurgar os registros mais antigos.">
        <div className="flex items-center gap-2">
          <span className="text-ink-muted"><IcoClock /></span>
          <select value={retencao} onChange={(e) => mudarRetencao(Number(e.target.value))} className={inp} aria-label="Período de retenção">
            {RETENCAO_OPCOES.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
          </select>
        </div>
        <p className="mt-3 text-sm text-ink-soft">Política atual: guardar por <span className="font-semibold text-ink">{retLabel}</span>.</p>

        {!confirmar ? (
          <button onClick={() => setConfirmar(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">
            <IcoTrash /> Expurgar logs antigos
          </button>
        ) : (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="flex items-start gap-2 text-sm text-red-800">
              <span className="mt-0.5 shrink-0"><IcoAlert /></span>
              Remover permanentemente os logs com mais de <span className="font-semibold">{retLabel}</span>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-3 flex gap-2">
              <button onClick={executarExpurgo} disabled={expurgando}
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                <IcoTrash /> {expurgando ? 'Expurgando…' : 'Confirmar expurgo'}
              </button>
              <button onClick={() => setConfirmar(false)} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
            </div>
          </div>
        )}
        <p className="mt-4 text-xs text-ink-muted">Dica: para expurgar automaticamente, agende um job (Supabase pg_cron) que chame <code className="rounded bg-black/[0.06] px-1 py-0.5">/api/auditoria</code> periodicamente — como os demais crons do app.</p>
      </Section>
    </div>
  )
}

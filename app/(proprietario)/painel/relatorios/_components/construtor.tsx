'use client'

// Construtor de relatórios — escolha DIMENSÃO × MÉTRICA → tabela + gráfico (SVG),
// com exportação (CSV/Excel/PDF) e salvar/abrir relatórios. Opera sobre os
// eventos JÁ filtrados (período + propriedade + tipo) → números sempre coerentes
// com os dashboards. A agregação é da engine pura lib/bi.ts (agregar).

import { useMemo, useState } from 'react'
import { formatMoneyShort, formatNumber } from '@/lib/format'
import { type EventoBI, type Dimensao, type Metrica, DIMENSOES, METRICAS, agregar } from '@/lib/bi'
import {
  type ConstrutorConfig, type RelatorioSalvo, type ChartTipo, type RelatorioExport,
  inp, rotuloMes, exportarCSV, exportarExcel, exportarPDF,
} from '../_lib'
import { Card, BarsChart, Donut, EmptyChart, IcoDownload } from './ui'

type Props = {
  eventos: EventoBI[]
  rotuloChave: (dim: Dimensao, chave: string) => string
  salvos: RelatorioSalvo[]
  premium: boolean
  subtitulo: string
  onSalvar: (nome: string, config: ConstrutorConfig) => Promise<void>
  onExcluir: (id: string) => Promise<void>
  onAplicar: (config: ConstrutorConfig) => void
}

export function Construtor({ eventos, rotuloChave, salvos, premium, subtitulo, onSalvar, onExcluir, onAplicar }: Props) {
  const [dimensao, setDimensao] = useState<Dimensao>('tipo')
  const [metrica, setMetrica] = useState<Metrica>('receita')
  const [chart, setChart] = useState<ChartTipo>('barras')
  const [nome, setNome] = useState('')
  const [salvando, setSalvando] = useState(false)

  const metricaMeta = METRICAS.find((m) => m.v === metrica)!
  const fmt = (n: number) => (metricaMeta.formato === 'moeda' ? formatMoneyShort(n) : formatNumber(Math.round(n)))

  const linhas = useMemo(() => agregar(eventos, dimensao, metrica), [eventos, dimensao, metrica])
  const totalGeral = useMemo(() => linhas.reduce((s, l) => s + (metrica === 'ticket' ? 0 : l.valor), 0), [linhas, metrica])

  const dados = linhas.map((l) => ({ label: rotuloChave(dimensao, l.chave), valor: l.valor, n: l.n }))

  const config: ConstrutorConfig = { dimensao, metrica, chart }
  const tituloRel = `${metricaMeta.label} por ${DIMENSOES.find((d) => d.v === dimensao)!.label.toLowerCase()}`

  function montarExport(): RelatorioExport {
    return {
      titulo: tituloRel,
      subtitulo,
      colunas: [DIMENSOES.find((d) => d.v === dimensao)!.label, metricaMeta.label, 'Nº eventos'],
      linhas: dados.map((d) => [d.label, metricaMeta.formato === 'moeda' ? formatMoneyShort(d.valor) : Math.round(d.valor), d.n ?? 0]),
    }
  }

  async function salvar() {
    if (!nome.trim()) return
    setSalvando(true)
    try { await onSalvar(nome.trim(), config) ; setNome('') } finally { setSalvando(false) }
  }

  const selCls = inp + ' bg-white'
  return (
    <div className="space-y-5">
      {/* Configuração */}
      <Card title="Construtor de relatório">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Dimensão (agrupar por)</span>
            <select value={dimensao} onChange={(e) => setDimensao(e.target.value as Dimensao)} className={selCls}>
              {DIMENSOES.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Métrica</span>
            <select value={metrica} onChange={(e) => setMetrica(e.target.value as Metrica)} className={selCls}>
              {METRICAS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
            </select>
          </label>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Visualização</span>
            <select value={chart} onChange={(e) => setChart(e.target.value as ChartTipo)} className={selCls}>
              <option value="barras">Barras</option><option value="rosca">Rosca</option><option value="tabela">Só tabela</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-ink-muted">{subtitulo} · {eventos.length} evento(s)</span>
          <div className="ml-auto flex flex-wrap gap-1.5">
            <ExportBtn label="CSV" onClick={() => exportarCSV(montarExport())} />
            <ExportBtn label="Excel" onClick={() => exportarExcel(montarExport())} />
            <ExportBtn label="PDF" onClick={() => exportarPDF(montarExport())} />
          </div>
        </div>
      </Card>

      {/* Resultado: gráfico + tabela */}
      {linhas.length === 0 ? (
        <Card><EmptyChart h={180} msg="Sem eventos para os filtros atuais. Ajuste o período/propriedade/tipo." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <Card title={tituloRel}>
            {chart === 'tabela' ? (
              <p className="text-sm text-ink-muted">Visualização em tabela — veja ao lado.</p>
            ) : chart === 'rosca' ? (
              <Donut data={dados.slice(0, 8).map((d) => [d.label, d.valor] as [string, number])} fmt={fmt} />
            ) : (
              <BarsChart data={dimensao === 'mes' ? dados.map((d, i) => ({ label: rotuloMes(linhas[i].chave), valor: d.valor })) : dados.slice(0, 12)} fmt={fmt} color="#ff385c" height={200} />
            )}
          </Card>
          <Card title="Tabela" className="overflow-hidden">
            <div className="max-h-[320px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="pb-2 font-semibold">{DIMENSOES.find((d) => d.v === dimensao)!.label}</th><th className="pb-2 text-right font-semibold">{metricaMeta.label}</th></tr></thead>
                <tbody>
                  {dados.map((d, i) => (
                    <tr key={i} className="border-b border-black/[0.04] last:border-0"><td className="py-2 pr-2 text-ink-soft"><span className="line-clamp-1">{d.label}</span></td><td className="py-2 text-right font-semibold tabular-nums text-ink">{fmt(d.valor)}</td></tr>
                  ))}
                </tbody>
                {metrica !== 'ticket' && <tfoot><tr className="border-t border-black/[0.08]"><td className="pt-2 text-xs font-bold text-ink-muted">Total</td><td className="pt-2 text-right text-sm font-bold text-ink">{fmt(totalGeral)}</td></tr></tfoot>}
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Salvar + relatórios salvos */}
      <Card title="Relatórios salvos">
        {premium ? (
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="block flex-1"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Salvar a configuração atual</span>
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder={`Ex.: ${tituloRel}`} className={inp} />
            </label>
            <button onClick={salvar} disabled={salvando || !nome.trim()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{salvando ? 'Salvando…' : 'Salvar'}</button>
          </div>
        ) : (
          <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Salvar relatórios é um recurso <strong>Pro+</strong>.</p>
        )}
        {salvos.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum relatório salvo ainda.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {salvos.map((r) => (
              <div key={r.id} className="group flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm">
                <button onClick={() => { onAplicar(r.config); setDimensao(r.config.dimensao); setMetrica(r.config.metrica); setChart(r.config.chart) }} className="font-semibold text-ink-soft hover:text-brand" title="Abrir relatório">{r.nome}</button>
                <button onClick={() => onExcluir(r.id)} className="text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" title="Excluir" aria-label="Excluir relatório">✕</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function ExportBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return <button onClick={onClick} className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft transition hover:border-brand hover:text-brand"><IcoDownload />{label}</button>
}

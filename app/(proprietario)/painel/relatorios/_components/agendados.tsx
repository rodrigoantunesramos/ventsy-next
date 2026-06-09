'use client'

// Exportação agendada — envia um dashboard ou relatório salvo por e-mail em
// frequência diário/semanal/mensal. O cron /api/cron/relatorios-agendados lê os
// ativos cuja proxima_exec <= hoje, renderiza o digest e reprograma. A próxima
// execução é calculada pela engine pura lib/bi.proximaExecucao.

import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { type Frequencia, proximaExecucao, todayYMD } from '@/lib/bi'
import { type RelatorioAgendado, type RelatorioSalvo, inp } from '../_lib'
import { DASHBOARDS } from './dashboards'
import { Card } from './ui'

const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const FORMATOS: { v: 'pdf' | 'excel' | 'csv'; label: string }[] = [
  { v: 'pdf', label: 'PDF' }, { v: 'excel', label: 'Excel' }, { v: 'csv', label: 'CSV' },
]
const FREQS: { v: Frequencia; label: string }[] = [
  { v: 'diario', label: 'Diário' }, { v: 'semanal', label: 'Semanal' }, { v: 'mensal', label: 'Mensal' },
]

export type NovoAgendado = {
  nome: string; relatorio_id: string | null; dashboard: string | null
  formato: 'pdf' | 'excel' | 'csv'; frequencia: Frequencia
  dia_semana: number | null; dia_mes: number | null; destinatarios: string[]
}

type Props = {
  agendados: RelatorioAgendado[]
  salvos: RelatorioSalvo[]
  premium: boolean
  emailPadrao: string
  onCriar: (a: NovoAgendado) => Promise<void>
  onToggle: (id: string, ativo: boolean) => Promise<void>
  onExcluir: (id: string) => Promise<void>
}

export function Agendados({ agendados, salvos, premium, emailPadrao, onCriar, onToggle, onExcluir }: Props) {
  const [fonte, setFonte] = useState<string>('dash:comercial')
  const [formato, setFormato] = useState<'pdf' | 'excel' | 'csv'>('pdf')
  const [freq, setFreq] = useState<Frequencia>('semanal')
  const [diaSemana, setDiaSemana] = useState(1)
  const [diaMes, setDiaMes] = useState(1)
  const [emails, setEmails] = useState(emailPadrao)
  const [salvando, setSalvando] = useState(false)

  const hoje = todayYMD()
  const proxima = proximaExecucao(freq, hoje, { diaSemana, diaMes })

  const fonteLabel = (a: RelatorioAgendado) =>
    a.relatorio_id ? (salvos.find((s) => s.id === a.relatorio_id)?.nome || 'Relatório salvo')
      : (DASHBOARDS.find((d) => d.key === a.dashboard)?.label || a.dashboard || 'Dashboard')

  async function criar() {
    const dest = emails.split(/[,;\n]/).map((e) => e.trim()).filter((e) => /.+@.+\..+/.test(e))
    if (!dest.length) return
    const isDash = fonte.startsWith('dash:')
    const nomeFonte = isDash ? (DASHBOARDS.find((d) => `dash:${d.key}` === fonte)?.label || 'Dashboard') : (salvos.find((s) => s.id === fonte.replace('rel:', ''))?.nome || 'Relatório')
    setSalvando(true)
    try {
      await onCriar({
        nome: `${nomeFonte} (${FREQS.find((f) => f.v === freq)!.label.toLowerCase()})`,
        relatorio_id: isDash ? null : fonte.replace('rel:', ''),
        dashboard: isDash ? fonte.replace('dash:', '') : null,
        formato, frequencia: freq,
        dia_semana: freq === 'semanal' ? diaSemana : null,
        dia_mes: freq === 'mensal' ? diaMes : null,
        destinatarios: dest,
      })
    } finally { setSalvando(false) }
  }

  const selCls = inp + ' bg-white'
  return (
    <div className="space-y-5">
      <Card title="Novo envio agendado">
        {!premium && <p className="mb-4 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">A exportação agendada por e-mail é um recurso <strong>Pro+</strong>.</p>}
        <fieldset disabled={!premium} className="space-y-4 disabled:opacity-60">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">O que enviar</span>
              <select value={fonte} onChange={(e) => setFonte(e.target.value)} className={selCls}>
                <optgroup label="Dashboards">
                  {DASHBOARDS.map((d) => <option key={d.key} value={`dash:${d.key}`}>{d.label}</option>)}
                </optgroup>
                {salvos.length > 0 && <optgroup label="Relatórios salvos">{salvos.map((s) => <option key={s.id} value={`rel:${s.id}`}>{s.nome}</option>)}</optgroup>}
              </select>
            </label>
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Formato anexado</span>
              <select value={formato} onChange={(e) => setFormato(e.target.value as 'pdf' | 'excel' | 'csv')} className={selCls}>{FORMATOS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select>
            </label>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Frequência</span>
              <select value={freq} onChange={(e) => setFreq(e.target.value as Frequencia)} className={selCls}>{FREQS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select>
            </label>
            {freq === 'semanal' && (
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Dia da semana</span>
                <select value={diaSemana} onChange={(e) => setDiaSemana(Number(e.target.value))} className={selCls}>{DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}</select>
              </label>
            )}
            {freq === 'mensal' && (
              <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Dia do mês</span>
                <input type="number" min={1} max={28} value={diaMes} onChange={(e) => setDiaMes(Math.min(28, Math.max(1, Number(e.target.value) || 1)))} className={inp} />
              </label>
            )}
            <div className="flex items-end"><p className="text-xs text-ink-muted">Próximo envio: <strong className="text-ink-soft">{formatDate(proxima)}</strong></p></div>
          </div>
          <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Destinatários <span className="font-normal text-ink-muted">(e-mails separados por vírgula)</span></span>
            <input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="voce@empresa.com, socio@empresa.com" className={inp} />
          </label>
          <div className="flex items-center gap-3">
            <button onClick={criar} disabled={salvando || !premium} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{salvando ? 'Agendando…' : 'Agendar envio'}</button>
            <span className="text-xs text-ink-muted">O envio real ocorre quando o SMTP está configurado; senão o cron roda em modo simulado.</span>
          </div>
        </fieldset>
      </Card>

      <Card title="Envios agendados">
        {agendados.length === 0 ? (
          <p className="text-sm text-ink-muted">Nenhum envio agendado. Configure um acima para receber relatórios por e-mail automaticamente.</p>
        ) : (
          <div className="space-y-2">
            {agendados.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{a.nome || fonteLabel(a)}</p>
                  <p className="text-xs text-ink-muted">
                    {fonteLabel(a)} · {a.formato.toUpperCase()} · {FREQS.find((f) => f.v === a.frequencia)?.label}
                    {a.frequencia === 'semanal' && a.dia_semana != null ? ` (${DIAS_SEMANA[a.dia_semana]})` : ''}
                    {a.frequencia === 'mensal' && a.dia_mes != null ? ` (dia ${a.dia_mes})` : ''}
                    {a.proxima_exec ? ` · próximo ${formatDate(a.proxima_exec)}` : ''}
                  </p>
                  <p className="mt-0.5 truncate text-[0.68rem] text-ink-muted/80">{a.destinatarios.join(', ')}</p>
                </div>
                <button onClick={() => onToggle(a.id, !a.ativo)} className={`rounded-full px-2.5 py-1 text-xs font-bold ${a.ativo ? 'bg-emerald-50 text-emerald-700' : 'bg-black/[0.05] text-ink-muted'}`}>{a.ativo ? 'Ativo' : 'Pausado'}</button>
                <button onClick={() => onExcluir(a.id)} className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600" title="Excluir" aria-label="Excluir agendamento">✕</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

'use client'

// Aba Segurança: foco em autenticação e sessões — logins (sucesso/falha),
// dispositivos/locais usados e alertas de acesso incomum (IP novo ou login logo
// após várias falhas). A heurística de "suspeito" é pura (lib/audit).

import { useMemo } from 'react'
import { formatDateTime } from '@/lib/format'
import {
  ACOES_SEGURANCA, loginsSuspeitos, resumirUserAgent, type AcaoAudit,
} from '@/lib/audit'
import { type AuditBag } from '../_lib'
import { Section, KpiCard, EmptyState, AcaoChip, IcoUser, IcoAlert, IcoMonitor, IcoGlobe, IcoClock } from './ui'

export default function Seguranca({ bag }: { bag: AuditBag }) {
  const eventos = useMemo(
    () => bag.logs.filter((l) => ACOES_SEGURANCA.includes(l.acao as AcaoAudit)),
    [bag.logs],
  )
  const suspeitos = useMemo(() => loginsSuspeitos(eventos), [eventos])

  const kpis = useMemo(() => {
    let ok = 0, falhas = 0
    const ips = new Set<string>(), devs = new Set<string>()
    for (const e of eventos) {
      if (e.acao === 'login' && e.sucesso) ok++
      if (e.acao === 'login_falha' || !e.sucesso) falhas++
      if (e.ip) ips.add(e.ip)
      if (e.user_agent) devs.add(resumirUserAgent(e.user_agent))
    }
    return { ok, falhas, ips: ips.size, devs: devs.size, suspeitos: suspeitos.size }
  }, [eventos, suspeitos])

  // Dispositivos/locais agregados (último acesso + contagem).
  const dispositivos = useMemo(() => {
    const m = new Map<string, { dev: string; ip: string | null; ultimo: string; n: number }>()
    for (const e of eventos) {
      if (e.acao === 'login_falha') continue
      const dev = resumirUserAgent(e.user_agent)
      const chave = `${dev}|${e.ip || ''}`
      const cur = m.get(chave)
      if (!cur) m.set(chave, { dev, ip: e.ip, ultimo: e.criado_em, n: 1 })
      else { cur.n++; if (e.criado_em > cur.ultimo) cur.ultimo = e.criado_em }
    }
    return Array.from(m.values()).sort((a, b) => b.ultimo.localeCompare(a.ultimo)).slice(0, 12)
  }, [eventos])

  const recentes = useMemo(() => eventos.slice(0, 40), [eventos])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Logins" value={String(kpis.ok)} tone="verde" icon={<IcoUser />} />
        <KpiCard label="Falhas de login" value={String(kpis.falhas)} tone={kpis.falhas > 0 ? 'vermelho' : 'ink'} icon={<IcoAlert />} />
        <KpiCard label="Dispositivos" value={String(kpis.devs)} sub={`${kpis.ips} IP(s) distintos`} tone="azul" icon={<IcoMonitor />} />
        <KpiCard label="Acessos incomuns" value={String(kpis.suspeitos)} tone={kpis.suspeitos > 0 ? 'gold' : 'ink'} icon={<IcoGlobe />} />
      </div>

      {kpis.suspeitos > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <span className="mt-0.5 text-amber-600"><IcoAlert /></span>
          <p className="text-amber-900">
            <span className="font-semibold">{kpis.suspeitos} acesso(s) incomum(ns) detectado(s).</span>{' '}
            Logins de um IP nunca usado antes ou logo após várias tentativas falhas. Confira abaixo e troque a senha se não reconhecer.
          </p>
        </div>
      )}

      <Section title="Acessos recentes" hint="Logins, falhas e logouts — os destacados foram marcados como incomuns.">
        {recentes.length === 0 ? (
          <EmptyState icon={<IcoUser />} title="Nenhum acesso registrado" msg="Os logins passam a ser registrados aqui após ativar a auditoria." />
        ) : (
          <ul className="divide-y divide-black/[0.04]">
            {recentes.map((e) => {
              const susp = suspeitos.has(e.id)
              return (
                <li key={e.id} className={`flex items-center gap-3 py-2.5 ${susp ? '-mx-2 rounded-lg bg-amber-50/60 px-2' : ''}`}>
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${e.acao === 'login_falha' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
                    {e.acao === 'login_falha' ? <IcoAlert /> : <IcoUser />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AcaoChip acao={e.acao} />
                      <span className="text-sm font-medium text-ink">{e.ator_nome || e.ator_email || 'Desconhecido'}</span>
                      {susp && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-semibold text-amber-700"><IcoAlert /> incomum</span>}
                    </div>
                    <p className="mt-0.5 text-[0.7rem] text-ink-muted">
                      {formatDateTime(e.criado_em, { withSeconds: true })}{e.ip ? ` · ${e.ip}` : ''} · {resumirUserAgent(e.user_agent)}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <Section title="Dispositivos & locais" hint="Combinações de dispositivo e IP usadas para acessar a conta.">
        {dispositivos.length === 0 ? (
          <EmptyState icon={<IcoMonitor />} title="Sem dispositivos registrados" />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {dispositivos.map((d, i) => (
              <li key={i} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><IcoMonitor /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{d.dev}</p>
                  <p className="text-[0.7rem] text-ink-muted">{d.ip || 'IP não registrado'} · {d.n} acesso(s)</p>
                </div>
                <span className="flex shrink-0 items-center gap-1 text-[0.7rem] text-ink-muted"><IcoClock /> {formatDateTime(d.ultimo)}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'

type Cron = { rota: string; agenda: string; orfao: boolean }
type Saude = {
  crons: Cron[]
  webhooks: { total: number | null }
  integracoes: {
    email_smtp: boolean
    ia_gateway: boolean
    cron_secret: boolean
    service_role: boolean
    site_url: string | null
  }
}

function Check({ ok, label, detalhe }: { ok: boolean; label: string; detalhe?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] px-3.5 py-2.5">
      <div>
        <div className="text-sm">{label}</div>
        {detalhe && <div className="text-[0.72rem] text-[#5c5c78]">{detalhe}</div>}
      </div>
      <span className={ok ? 'text-[#3ddc84]' : 'text-[#ff385c]'}>{ok ? '✓ ok' : '✗ não configurado'}</span>
    </div>
  )
}

export default function AdminSaude() {
  const [d, setD] = useState<Saude | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/saude')
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? 'Acesso negado.' : `Erro ${r.status}`)
        return r.json()
      })
      .then((j) => setD(j))
      .catch((e) => setErro((e as Error).message))
      .finally(() => setLoading(false))
  }, [])

  const orfaos = d?.crons.filter((c) => c.orfao).length ?? 0

  return (
    <div className="max-w-4xl p-8">
      <h1 className="text-2xl font-bold">Saúde do Sistema</h1>
      <p className="mb-6 mt-1 text-sm text-[#a0a0b8]">Integrações configuradas, tarefas agendadas e webhooks.</p>

      {loading && <div className="text-[#a0a0b8]">Carregando…</div>}
      {erro && <div className="rounded-lg border border-[#ff385c]/30 bg-[#ff385c]/10 px-4 py-3 text-[#ff385c]">{erro}</div>}

      {d && (
        <div className="space-y-6">
          <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <div className="mb-3 font-bold">Integrações &amp; chaves</div>
            <div className="space-y-2">
              <Check ok={d.integracoes.email_smtp} label="E-mail (SMTP)" detalhe="Envio de e-mails do sistema" />
              <Check ok={d.integracoes.ia_gateway} label="IA (AI Gateway)" detalhe="Recursos de IA dos módulos" />
              <Check ok={d.integracoes.cron_secret} label="Segredo dos crons (CRON_SECRET)" />
              <Check ok={d.integracoes.service_role} label="Service-role do Supabase" />
              <Check
                ok={!!d.integracoes.site_url}
                label="URL do site (NEXT_PUBLIC_SITE_URL)"
                detalhe={d.integracoes.site_url || 'usando fallback fixo no código'}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <div className="mb-1 font-bold">Tarefas agendadas (crons)</div>
            {orfaos > 0 && (
              <div className="mb-3 rounded-lg border border-[#f5a623]/30 bg-[#f5a623]/10 px-3 py-2 text-[0.8rem] text-[#f5a623]">
                ⚠ {orfaos} cron(s) têm rota no código mas <strong>não estão agendados</strong> no pg_cron — não rodam em produção.
              </div>
            )}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[0.72rem] uppercase tracking-wide text-[#5c5c78]">
                  <th className="py-2">Rota</th>
                  <th className="py-2">Agenda</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {d.crons.map((c) => (
                  <tr key={c.rota} className="border-b border-white/[0.04] last:border-0">
                    <td className="py-2 font-mono text-[0.8rem]">/api/cron/{c.rota}</td>
                    <td className="py-2 text-[#a0a0b8]">{c.agenda}</td>
                    <td className="py-2 text-right">
                      {c.orfao ? <span className="text-[#f5a623]">não agendado</span> : <span className="text-[#3ddc84]">agendado</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-3 text-[0.72rem] text-[#5c5c78]">
              O status reflete o catálogo de agendamento. A última execução real (via pg_cron) entra numa etapa futura.
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.07] bg-[#111118] p-5">
            <div className="mb-2 font-bold">Webhooks</div>
            <div className="text-sm text-[#a0a0b8]">
              Registros no log de webhooks de integração:{' '}
              <strong className="text-[#f0f0f5]">{d.webhooks.total ?? '—'}</strong>
            </div>
          </section>
        </div>
      )}
    </div>
  )
}

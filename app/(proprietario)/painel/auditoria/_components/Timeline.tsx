'use client'

// Linha do tempo da auditoria: filtros (ator/ação/entidade/período/busca) +
// lista paginada + detalhe expansível com o diff "antes → depois". Reutilizada
// pela aba "Sensíveis" via prop `soSensiveis` (pré-filtra os destaques).

import { useEffect, useMemo, useState } from 'react'
import { formatDateTime } from '@/lib/format'
import {
  ACOES, acaoCor, entidadeLabel, calcularDiff, filtrarLogs, resumirUserAgent,
  type FiltrosAudit,
} from '@/lib/audit'
import { type AuditBag, type AuditLog, PAGE_SIZE, baixarCSV } from '../_lib'
import {
  Section, AcaoChip, EmptyState, IcoSearch, IcoDownload, IcoChevron, IcoAlert, IcoList,
} from './ui'

const inp = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20'

export default function Timeline({ bag, soSensiveis }: { bag: AuditBag; soSensiveis?: boolean }) {
  const [busca, setBusca] = useState('')
  const [acao, setAcao] = useState('')
  const [entidade, setEntidade] = useState('')
  const [ator, setAtor] = useState('')
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [pagina, setPagina] = useState(1)
  const [aberto, setAberto] = useState<Set<number>>(new Set())

  useEffect(() => { setPagina(1) }, [busca, acao, entidade, ator, de, ate])

  const filtros: FiltrosAudit = useMemo(
    () => ({ busca, acao, entidade, ator, de, ate, sensivel: soSensiveis }),
    [busca, acao, entidade, ator, de, ate, soSensiveis],
  )
  const filtrados = useMemo(() => filtrarLogs(bag.logs, filtros), [bag.logs, filtros])
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE))
  const visiveis = useMemo(() => filtrados.slice((pagina - 1) * PAGE_SIZE, pagina * PAGE_SIZE), [filtrados, pagina])

  const limpar = () => { setBusca(''); setAcao(''); setEntidade(''); setAtor(''); setDe(''); setAte('') }
  const temFiltro = !!(busca || acao || entidade || ator || de || ate)
  const toggle = (id: number) => setAberto((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <Section
      title={soSensiveis ? 'Ações sensíveis' : 'Linha do tempo'}
      hint={soSensiveis
        ? 'Exclusões, mudanças de preço/financeiro, permissões, exportações, pagamentos e logins falhos.'
        : 'Todos os eventos registrados — clique para ver o antes → depois.'}
      action={filtrados.length > 0 && (
        <button onClick={() => baixarCSV(filtrados, soSensiveis ? 'sensiveis' : '')}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand">
          <IcoDownload /> Exportar CSV
        </button>
      )}
    >
      {/* Filtros */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar descrição, ator, IP…" className={`${inp} w-full pl-9`} />
        </div>
        <select value={acao} onChange={(e) => setAcao(e.target.value)} className={inp} aria-label="Ação">
          <option value="">Todas as ações</option>
          {ACOES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
        </select>
        <select value={entidade} onChange={(e) => setEntidade(e.target.value)} className={inp} aria-label="Entidade">
          <option value="">Todas as entidades</option>
          {bag.entidades.map((e) => <option key={e} value={e}>{entidadeLabel(e)}</option>)}
        </select>
        <select value={ator} onChange={(e) => setAtor(e.target.value)} className={inp} aria-label="Ator">
          <option value="">Todos os atores</option>
          {bag.atores.map((a) => <option key={a.id} value={a.id}>{a.nome || a.email || a.id.slice(0, 8)}</option>)}
        </select>
        <div className="flex items-center gap-1.5">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={`${inp} w-full`} aria-label="De" />
          <span className="text-xs text-ink-muted">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={`${inp} w-full`} aria-label="Até" />
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-xs text-ink-muted">
        <span>{filtrados.length} evento(s){bag.logs.length >= 2000 ? ' (janela recente)' : ''}</span>
        {temFiltro && <button onClick={limpar} className="font-semibold text-brand hover:underline">Limpar filtros</button>}
      </div>

      {/* Lista */}
      {visiveis.length === 0 ? (
        <EmptyState icon={<IcoList />} title="Nenhum evento encontrado" msg={temFiltro ? 'Ajuste os filtros para ver outros registros.' : 'As ações sensíveis aparecem aqui assim que acontecem.'} />
      ) : (
        <ul className="space-y-2">
          {visiveis.map((log) => <LogItem key={log.id} log={log} aberto={aberto.has(log.id)} onToggle={() => toggle(log.id)} />)}
        </ul>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 hover:border-brand/30">Anterior</button>
          <span className="text-ink-muted">{pagina} / {totalPaginas}</span>
          <button disabled={pagina >= totalPaginas} onClick={() => setPagina((p) => p + 1)} className="rounded-lg border border-black/10 px-3 py-1.5 disabled:opacity-40 hover:border-brand/30">Próxima</button>
        </div>
      )}
    </Section>
  )
}

// ── Item da timeline ──────────────────────────────────────────────────────────
function LogItem({ log, aberto, onToggle }: { log: AuditLog; aberto: boolean; onToggle: () => void }) {
  const diff = useMemo(() => calcularDiff(log.antes, log.depois), [log.antes, log.depois])
  const meta = (log.meta && typeof log.meta === 'object' && !Array.isArray(log.meta)) ? (log.meta as Record<string, unknown>) : null
  const metaItens = meta ? Object.entries(meta).filter(([, v]) => v != null && v !== '') : []
  const ator = log.ator_nome || log.ator_email || (log.ator_id ? log.ator_id.slice(0, 8) : 'Sistema')

  return (
    <li className={`rounded-xl border ${log.sensivel ? 'border-amber-200 bg-amber-50/40' : 'border-black/[0.06] bg-white'}`}>
      <button onClick={onToggle} className="flex w-full items-start gap-3 p-3 text-left">
        <span className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: acaoCor(log.acao) }} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <AcaoChip acao={log.acao} />
            {log.entidade && <span className="text-sm font-semibold text-ink">{entidadeLabel(log.entidade)}{log.entidade_id ? ` #${log.entidade_id}` : ''}</span>}
            {!log.sucesso && <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[0.62rem] font-semibold text-red-700"><IcoAlert /> falhou</span>}
            {log.sensivel && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[0.62rem] font-semibold text-amber-700">sensível</span>}
          </div>
          <p className="mt-1 truncate text-sm text-ink-soft">{log.descricao || '—'}</p>
          <p className="mt-0.5 text-[0.7rem] text-ink-muted">
            {ator} · {formatDateTime(log.criado_em, { withSeconds: true })}{log.ip ? ` · ${log.ip}` : ''}
          </p>
        </div>
        <span className={`shrink-0 text-ink-muted transition-transform ${aberto ? 'rotate-180' : ''}`}><IcoChevron /></span>
      </button>

      {aberto && (
        <div className="border-t border-black/[0.06] p-3 pt-3 text-sm">
          {diff.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-black/[0.06]">
              <table className="w-full text-left text-xs">
                <thead className="bg-black/[0.02] text-ink-muted">
                  <tr><th className="px-3 py-1.5 font-semibold">Campo</th><th className="px-3 py-1.5 font-semibold">Antes</th><th className="px-3 py-1.5 font-semibold">Depois</th></tr>
                </thead>
                <tbody>
                  {diff.map((d) => (
                    <tr key={d.campo} className="border-t border-black/[0.04]">
                      <td className="px-3 py-1.5 font-medium text-ink-soft">{d.campo}</td>
                      <td className="px-3 py-1.5 text-red-600"><span className="break-all line-through decoration-red-300">{d.de}</span></td>
                      <td className="px-3 py-1.5 text-emerald-700"><span className="break-all">{d.para}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-ink-muted">Sem alterações de campo registradas para este evento.</p>
          )}

          {metaItens.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
              {metaItens.map(([k, v]) => <span key={k}><span className="font-medium text-ink-soft">{k}:</span> {typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>)}
            </div>
          )}

          <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs text-ink-muted sm:grid-cols-2">
            {log.ator_email && <div><dt className="inline font-medium text-ink-soft">Ator: </dt><dd className="inline break-all">{log.ator_email}</dd></div>}
            {log.entidade_id && <div><dt className="inline font-medium text-ink-soft">ID alvo: </dt><dd className="inline break-all">{log.entidade_id}</dd></div>}
            {log.ip && <div><dt className="inline font-medium text-ink-soft">IP: </dt><dd className="inline">{log.ip}</dd></div>}
            {log.user_agent && <div><dt className="inline font-medium text-ink-soft">Dispositivo: </dt><dd className="inline">{resumirUserAgent(log.user_agent)}</dd></div>}
          </dl>
        </div>
      )}
    </li>
  )
}

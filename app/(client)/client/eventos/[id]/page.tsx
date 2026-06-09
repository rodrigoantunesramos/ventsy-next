'use client'
// Portal do evento — (client)/eventos/[id]. Área logada do CONTRATANTE para
// acompanhar o próprio evento: resumo, financeiro (pagar via PIX), contrato
// (ver/assinar), briefing, cronograma, convidados (RSVP), documentos, mensagens
// e avaliação. Todo dado vem de /api/portal/cliente (valida o acesso). As abas
// visíveis respeitam o que o dono liberou. Sem "R$" hardcoded — moeda via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { formatMoney, formatDate } from '@/lib/format'
import {
  MODULOS_PORTAL, resumoFinanceiro, notificacoesEvento, rsvpResumo,
  eventoJaOcorreu, parcelaPaga, parcelaEmAberto, boasVindasEfetiva,
  type ModuloKey, type Notificacao,
} from '@/lib/portal'
import { portalClienteApi, type ParcelaCli, type ContratoCli, type ConvidadoCli } from '../_lib'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Evento = Record<string, any>

type Detalhe = {
  acesso: { status: string; modulos: Record<string, boolean> | null; boas_vindas: string | null }
  config: { cor: string | null; boas_vindas: string | null; modulos: Record<string, boolean> | null } | null
  modulos: Record<ModuloKey, boolean>
  evento: Evento
  propriedade: { nome: string | null; cidade: string | null; estado: string | null; endereco: string | null; bairro: string | null } | null
  dono: { nome: string | null } | null
  parcelas: ParcelaCli[]
  contrato: ContratoCli
  convidados: ConvidadoCli[]
  conversa_id: string | null
  mp_disponivel: boolean
}

type Flash = { kind: 'ok' | 'err'; msg: string } | null

export default function PortalEventoPage() {
  const router = useRouter()
  const params = useParams()
  const eventoId = String(params.id || '')

  const [d, setD] = useState<Detalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aba, setAba] = useState<ModuloKey>('resumo')
  const [flash, setFlash] = useState<Flash>(null)
  const now = useMemo(() => new Date(), [])

  const showFlash = useCallback((kind: 'ok' | 'err', msg: string) => {
    setFlash({ kind, msg })
    setTimeout(() => setFlash(null), 3600)
  }, [])

  const carregar = useCallback(async () => {
    try {
      const r = await portalClienteApi('evento', { evento_id: eventoId })
      setD(r as unknown as Detalhe)
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar o evento.')
    }
  }, [eventoId])

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      await carregar()
      setLoading(false)
    })()
  }, [router, carregar])

  if (loading) {
    return (
      <div className="mx-auto max-w-[980px] px-6 py-7">
        <div className="h-24 animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="mt-4 h-72 animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    )
  }

  if (erro || !d) {
    return (
      <div className="mx-auto max-w-[680px] px-6 py-10">
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-700">
          {erro || 'Evento indisponível.'}
        </div>
        <div className="mt-4 text-center">
          <Link href="/client/eventos" className="text-[.85rem] font-semibold text-[#ff385c]">← Voltar para Meus Eventos</Link>
        </div>
      </div>
    )
  }

  const cor = d.config?.cor || '#ff385c'
  const ev = d.evento
  const abas = MODULOS_PORTAL.filter((m) => d.modulos[m.key])
  const boasVindas = boasVindasEfetiva(d.config, d.acesso)
  const notifs = notificacoesEvento({ evento: ev, parcelas: d.parcelas, contrato: d.contrato, agora: now })

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-6">
      {flash && (
        <div className={`fixed left-1/2 top-4 z-[400] -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium text-white shadow-lg ${flash.kind === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {flash.msg}
        </div>
      )}

      <Link href="/client/eventos" className="text-[.8rem] text-gray-400 hover:text-gray-600">← Meus Eventos</Link>

      {/* Cabeçalho */}
      <div className="mt-2 rounded-2xl p-5 text-white shadow-[0_2px_12px_rgba(0,0,0,.08)]" style={{ background: `linear-gradient(135deg, ${cor}, ${cor}cc)` }}>
        <div className="text-[.78rem] opacity-90">{ev.tipo_evento || 'Seu evento'}</div>
        <h1 className="mt-0.5 text-[1.5rem] font-extrabold leading-tight">{ev.nome_evento || 'Meu evento'}</h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[.82rem] opacity-95">
          {ev.data_inicio && <span>📅 {formatDate(ev.data_inicio)}</span>}
          {d.propriedade?.nome && <span>📍 {[d.propriedade.nome, d.propriedade.cidade].filter(Boolean).join(' · ')}</span>}
          {d.dono?.nome && <span>👤 {d.dono.nome}</span>}
        </div>
      </div>

      {boasVindas && (
        <div className="mt-3 rounded-xl border px-4 py-3 text-[.85rem] text-gray-700" style={{ borderColor: `${cor}33`, background: `${cor}0d` }}>
          {boasVindas}
        </div>
      )}

      {/* Notificações */}
      {notifs.length > 0 && (
        <div className="mt-3 space-y-2">
          {notifs.map((n, i) => <NotifCard key={i} n={n} onIr={(k) => setAba(k)} />)}
        </div>
      )}

      {/* Tabs */}
      <div className="mt-4 flex gap-1 overflow-x-auto border-b border-[#eee] pb-px">
        {abas.map((m) => {
          const active = aba === m.key
          return (
            <button
              key={m.key}
              onClick={() => setAba(m.key)}
              className="whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[.85rem] font-semibold transition-colors"
              style={active ? { color: cor, borderColor: cor } : { color: '#9ca3af', borderColor: 'transparent' }}
            >
              {m.label}
            </button>
          )
        })}
      </div>

      {/* Conteúdo */}
      <div className="mt-5">
        {aba === 'resumo' && <Resumo d={d} now={now} cor={cor} onIr={setAba} />}
        {aba === 'financeiro' && <Financeiro d={d} now={now} cor={cor} eventoId={eventoId} onPaid={carregar} showFlash={showFlash} />}
        {aba === 'contrato' && <Contrato contrato={d.contrato} cor={cor} />}
        {aba === 'briefing' && <Briefing ev={ev} />}
        {aba === 'cronograma' && <Cronograma ev={ev} />}
        {aba === 'convidados' && <Convidados d={d} eventoId={eventoId} cor={cor} onChange={carregar} showFlash={showFlash} />}
        {aba === 'documentos' && <Documentos contrato={d.contrato} />}
        {aba === 'mensagens' && <Mensagens eventoId={eventoId} conversaId={d.conversa_id} showFlash={showFlash} />}
        {aba === 'avaliacao' && <Avaliacao ev={ev} now={now} cor={cor} />}
      </div>
    </div>
  )
}

// ── Notificação ────────────────────────────────────────────────────────────────
function NotifCard({ n, onIr }: { n: Notificacao; onIr: (k: ModuloKey) => void }) {
  const styles = {
    urgent: 'border-red-200 bg-red-50 text-red-700',
    warn: 'border-amber-200 bg-amber-50 text-amber-700',
    info: 'border-sky-200 bg-sky-50 text-sky-700',
  }[n.nivel]
  const ir: ModuloKey | null = n.tipo === 'parcela' ? 'financeiro' : n.tipo === 'contrato' ? 'contrato' : null
  const detalhe = n.tipo === 'parcela' && n.dias != null
    ? (n.dias < 0 ? `venceu há ${Math.abs(n.dias)} dia(s)` : n.dias === 0 ? 'vence hoje' : `vence em ${n.dias} dia(s)`)
    : n.tipo === 'evento' && n.dias != null && n.dias > 0 ? `faltam ${n.dias} dia(s)` : ''
  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-[.83rem] ${styles}`}>
      <div><span className="font-semibold">{n.titulo}</span>{detalhe ? ` — ${detalhe}` : ''}</div>
      {ir && <button onClick={() => onIr(ir)} className="shrink-0 rounded-lg bg-white/70 px-2.5 py-1 text-[.75rem] font-semibold">Ver</button>}
    </div>
  )
}

// ── Resumo ───────────────────────────────────────────────────────────────────
function Resumo({ d, now, cor, onIr }: { d: Detalhe; now: Date; cor: string; onIr: (k: ModuloKey) => void }) {
  const fin = resumoFinanceiro(d.parcelas, now)
  const rsvp = rsvpResumo(d.convidados)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Status" value={String(d.evento.status || '—')} />
        {d.modulos.financeiro && <Card label="Pago" value={formatMoney(fin.pago)} />}
        {d.modulos.financeiro && <Card label="Em aberto" value={formatMoney(fin.aberto)} accent={fin.vencido > 0 ? '#dc2626' : undefined} />}
        {d.modulos.convidados && <Card label="Confirmados" value={`${rsvp.pessoas}`} hint={`${rsvp.confirmados} convite(s)`} />}
      </div>

      {d.modulos.financeiro && fin.proxima && (
        <div className="rounded-2xl border border-[#f0f0f0] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
          <div className="text-[.78rem] text-gray-400">Próxima parcela</div>
          <div className="mt-1 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900">{formatMoney(fin.proxima.valor)}</div>
              <div className="text-[.8rem] text-gray-500">{fin.proxima.descricao || `Parcela ${fin.proxima.numero ?? ''}`}{fin.proxima.vencimento ? ` · vence ${formatDate(fin.proxima.vencimento)}` : ''}</div>
            </div>
            <button onClick={() => onIr('financeiro')} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: cor }}>Pagar</button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-[#f0f0f0] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
        <div className="mb-1 text-[.9rem] font-bold text-gray-900">Atalhos</div>
        <div className="flex flex-wrap gap-2">
          {MODULOS_PORTAL.filter((m) => !m.fixo && d.modulos[m.key]).map((m) => (
            <button key={m.key} onClick={() => onIr(m.key)} className="rounded-full border border-black/10 px-3 py-1.5 text-[.8rem] font-medium text-gray-600 hover:border-black/20">{m.label}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Card({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: string }) {
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <div className="text-[1.2rem] font-extrabold" style={accent ? { color: accent } : undefined}>{value}</div>
      <div className="mt-0.5 text-[.75rem] font-medium text-gray-500">{label}</div>
      {hint && <div className="text-[.68rem] text-gray-400">{hint}</div>}
    </div>
  )
}

// ── Financeiro ──────────────────────────────────────────────────────────────
function Financeiro({
  d, now, cor, eventoId, onPaid, showFlash,
}: { d: Detalhe; now: Date; cor: string; eventoId: string; onPaid: () => void; showFlash: (k: 'ok' | 'err', m: string) => void }) {
  const fin = resumoFinanceiro(d.parcelas, now)
  const [pag, setPag] = useState<{ parcela: ParcelaCli; loading: boolean; pix?: { qr_code?: string; qr_code_base64?: string; ticket_url?: string }; status?: string; erro?: string } | null>(null)

  async function pagar(parcela: ParcelaCli) {
    setPag({ parcela, loading: true })
    try {
      const r = await portalClienteApi('pagar_parcela', { evento_id: eventoId, parcela_id: parcela.id })
      setPag({ parcela, loading: false, status: String(r.status || ''), pix: r.pix as { qr_code?: string; qr_code_base64?: string; ticket_url?: string } | undefined })
      if (r.status === 'approved') { showFlash('ok', 'Pagamento confirmado!'); onPaid() }
    } catch (e) {
      const err = e as Error & { code?: string }
      if (err.code === 'mp_indisponivel') { setPag(null); showFlash('err', 'Pagamento online indisponível. Combine com o organizador.') }
      else setPag({ parcela, loading: false, erro: err.message })
    }
  }

  if (d.parcelas.length === 0) {
    return <Vazio icon="💳" titulo="Nenhuma parcela" texto="Quando o organizador registrar as parcelas do seu evento, elas aparecem aqui." />
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card label="Total" value={formatMoney(fin.total)} />
        <Card label="Pago" value={formatMoney(fin.pago)} accent="#059669" />
        <Card label="Em aberto" value={formatMoney(fin.aberto)} accent={fin.vencido > 0 ? '#dc2626' : undefined} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white shadow-[0_2px_12px_rgba(0,0,0,.05)]">
        {d.parcelas.map((p) => {
          const paga = parcelaPaga(p.status)
          const vencida = parcelaEmAberto(p) && p.vencimento && new Date(p.vencimento) < now
          return (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-[#f5f5f5] px-4 py-3 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-[.88rem] font-semibold text-gray-900">{p.descricao || `Parcela ${p.numero ?? ''}`}</div>
                <div className="text-[.76rem] text-gray-400">
                  {p.vencimento ? `Vence ${formatDate(p.vencimento)}` : 'Sem vencimento'}
                  {paga && p.pago_em ? ` · pago em ${formatDate(p.pago_em)}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <div className="text-[.9rem] font-bold text-gray-900">{formatMoney(p.valor)}</div>
                  <div className={`text-[.7rem] font-semibold ${paga ? 'text-emerald-600' : vencida ? 'text-red-600' : 'text-amber-600'}`}>
                    {paga ? 'Pago' : vencida ? 'Vencida' : 'Em aberto'}
                  </div>
                </div>
                {!paga && (
                  <button onClick={() => pagar(p)} className="rounded-xl px-3.5 py-2 text-[.8rem] font-semibold text-white" style={{ background: cor }}>Pagar</button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {!d.mp_disponivel && (
        <p className="text-[.76rem] text-gray-400">Pagamento online ainda não foi habilitado pelo organizador — combine o pagamento diretamente com ele.</p>
      )}

      {pag && (
        <Modal onClose={() => setPag(null)} titulo={`Pagar ${formatMoney(pag.parcela.valor)}`}>
          {pag.loading && <div className="py-8 text-center text-sm text-gray-500">Gerando cobrança PIX…</div>}
          {pag.erro && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{pag.erro}</div>}
          {pag.status === 'approved' && <div className="rounded-xl bg-emerald-50 p-4 text-center text-sm font-semibold text-emerald-700">✓ Pagamento confirmado!</div>}
          {pag.pix && (
            <div className="text-center">
              {pag.pix.qr_code_base64 && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`data:image/png;base64,${pag.pix.qr_code_base64}`} alt="QR Code PIX" className="mx-auto h-52 w-52" />
              )}
              <p className="mt-2 text-[.8rem] text-gray-500">Escaneie o QR Code no app do seu banco ou copie o código abaixo.</p>
              {pag.pix.qr_code && (
                <div className="mt-2 flex gap-2">
                  <input readOnly value={pag.pix.qr_code} className="w-full rounded-xl border border-black/10 px-3 py-2 text-[.72rem]" />
                  <button onClick={() => { navigator.clipboard?.writeText(pag.pix!.qr_code!); showFlash('ok', 'Código copiado!') }} className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-white" style={{ background: cor }}>Copiar</button>
                </div>
              )}
              <button onClick={onPaid} className="mt-3 text-[.8rem] font-semibold" style={{ color: cor }}>Já paguei — atualizar status</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}

// ── Contrato ─────────────────────────────────────────────────────────────────
function Contrato({ contrato, cor }: { contrato: ContratoCli; cor: string }) {
  if (!contrato) return <Vazio icon="📄" titulo="Sem contrato" texto="Nenhum contrato foi disponibilizado para este evento ainda." />
  const status = String(contrato.status || '').toLowerCase()
  const assinado = status === 'assinado' || !!contrato.assinado_em
  const disponivel = status === 'enviado' || assinado
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[.95rem] font-bold text-gray-900">{contrato.titulo || `Contrato ${contrato.numero || ''}`}</div>
          {contrato.valor_num != null && <div className="text-[.82rem] text-gray-500">{formatMoney(contrato.valor_num, { currency: (contrato.moeda as 'BRL' | 'USD' | 'EUR') || undefined })}</div>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[.72rem] font-semibold ${assinado ? 'bg-emerald-50 text-emerald-700' : status === 'enviado' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
          {assinado ? 'Assinado' : status === 'enviado' ? 'Aguardando assinatura' : 'Em preparação'}
        </span>
      </div>
      {assinado && contrato.assinado_em && <p className="mt-2 text-[.82rem] text-gray-500">Assinado em {formatDate(contrato.assinado_em)}.</p>}
      {disponivel && contrato.link_token ? (
        <a href={`/contrato/${contrato.link_token}`} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block rounded-xl px-4 py-2.5 text-sm font-semibold text-white" style={{ background: cor }}>
          {assinado ? 'Ver contrato' : 'Ver e assinar contrato'}
        </a>
      ) : (
        <p className="mt-3 text-[.82rem] text-gray-400">O contrato ficará disponível aqui assim que o organizador enviá-lo.</p>
      )}
    </div>
  )
}

// ── Briefing ─────────────────────────────────────────────────────────────────
function Briefing({ ev }: { ev: Evento }) {
  const itens: [string, string | number | null | undefined][] = [
    ['Tipo de evento', ev.tipo_evento],
    ['Adultos', ev.qtd_adultos],
    ['Crianças', ev.qtd_criancas],
    ['Formato da recepção', ev.formato_recepcao],
    ['Layout de mesas', ev.layout_mesas],
    ['Necessidades técnicas', ev.necessidades_tecnicas],
    ['Restrições alimentares', ev.restricoes_alimentares],
    ['Atrações', ev.atracoes],
    ['Contato de emergência', ev.contato_emergencia],
    ['Observações', ev.observacoes],
  ]
  const visiveis = itens.filter(([, v]) => v != null && v !== '')
  if (visiveis.length === 0) return <Vazio icon="📝" titulo="Briefing vazio" texto="Os detalhes do seu evento aparecerão aqui conforme forem preenchidos." />
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        {visiveis.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[.74rem] font-semibold uppercase tracking-wide text-gray-400">{k}</dt>
            <dd className="mt-0.5 text-[.88rem] text-gray-800">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── Cronograma ──────────────────────────────────────────────────────────────
function Cronograma({ ev }: { ev: Evento }) {
  const linhas: [string, string | null | undefined][] = [
    ['Montagem', ev.horario_montagem],
    ['Início', ev.horario_inicio || ev.data_inicio],
    ['Término', ev.horario_fim || ev.data_fim],
    ['Desmontagem', ev.horario_desmontagem],
  ]
  const visiveis = linhas.filter(([, v]) => v != null && v !== '')
  if (visiveis.length === 0) return <Vazio icon="🕒" titulo="Sem cronograma" texto="Os horários do evento aparecerão aqui quando definidos." />
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <ol className="relative ml-3 border-l border-[#eee]">
        {visiveis.map(([k, v], i) => (
          <li key={i} className="mb-4 ml-4 last:mb-0">
            <div className="absolute -left-[6px] mt-1 h-2.5 w-2.5 rounded-full bg-[#ff385c]" />
            <div className="text-[.76rem] font-semibold uppercase tracking-wide text-gray-400">{k}</div>
            <div className="text-[.9rem] text-gray-800">{String(v)}</div>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ── Convidados ──────────────────────────────────────────────────────────────
function Convidados({
  d, eventoId, cor, onChange, showFlash,
}: { d: Detalhe; eventoId: string; cor: string; onChange: () => void; showFlash: (k: 'ok' | 'err', m: string) => void }) {
  const rsvp = rsvpResumo(d.convidados)
  const [modal, setModal] = useState<{ editando?: ConvidadoCli } | null>(null)
  const [busy, setBusy] = useState(false)

  async function op(opName: string, convidado: Record<string, unknown>, okMsg?: string) {
    setBusy(true)
    try {
      await portalClienteApi('rsvp', { evento_id: eventoId, op: opName, convidado })
      if (okMsg) showFlash('ok', okMsg)
      setModal(null)
      onChange()
    } catch (e) {
      showFlash('err', e instanceof Error ? e.message : 'Falha ao salvar.')
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-2">
        <Card label="Confirmados" value={`${rsvp.confirmados}`} accent="#059669" />
        <Card label="Pendentes" value={`${rsvp.pendentes}`} />
        <Card label="Recusados" value={`${rsvp.recusados}`} accent="#dc2626" />
        <Card label="Pessoas" value={`${rsvp.pessoas}`} hint="c/ acompanhantes" />
      </div>

      <div className="flex justify-end">
        <button onClick={() => setModal({})} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: cor }}>+ Adicionar convidado</button>
      </div>

      {d.convidados.length === 0 ? (
        <Vazio icon="🧑‍🤝‍🧑" titulo="Nenhum convidado" texto="Monte a lista de convidados do seu evento e acompanhe as confirmações." />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#f0f0f0] bg-white shadow-[0_2px_12px_rgba(0,0,0,.05)]">
          {d.convidados.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border-b border-[#f5f5f5] px-4 py-3 last:border-0">
              <div className="min-w-0">
                <div className="truncate text-[.88rem] font-semibold text-gray-900">{c.nome}</div>
                <div className="text-[.74rem] text-gray-400">
                  {c.acompanhantes > 0 ? `+${c.acompanhantes} acompanhante(s)` : 'sem acompanhantes'}
                  {c.mesa ? ` · mesa ${c.mesa}` : ''}
                  {c.restricao_alimentar ? ` · ${c.restricao_alimentar}` : ''}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <StatusPill status={c.status} />
                <div className="flex gap-1">
                  <button onClick={() => op('set_status', { id: c.id, status: 'confirmado' }, 'Confirmado!')} title="Confirmar" className="rounded-lg border border-emerald-200 px-2 py-1 text-[.72rem] font-semibold text-emerald-700 hover:bg-emerald-50">✓</button>
                  <button onClick={() => op('set_status', { id: c.id, status: 'recusado' }, 'Marcado como recusado.')} title="Recusar" className="rounded-lg border border-red-200 px-2 py-1 text-[.72rem] font-semibold text-red-600 hover:bg-red-50">✕</button>
                  <button onClick={() => setModal({ editando: c })} title="Editar" className="rounded-lg border border-black/10 px-2 py-1 text-[.72rem] text-gray-600 hover:bg-black/[0.03]">✎</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <ConvidadoModal cor={cor} busy={busy} editando={modal.editando} onClose={() => setModal(null)} onSave={op} onRemove={(id) => op('remove', { id }, 'Convidado removido.')} />}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  const s = String(status || 'convidado').toLowerCase()
  const cls = s === 'confirmado' || s === 'checkin' ? 'bg-emerald-50 text-emerald-700' : s === 'recusado' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
  const label = s === 'checkin' ? 'check-in' : s
  return <span className={`rounded-full px-2 py-0.5 text-[.68rem] font-semibold capitalize ${cls}`}>{label}</span>
}

function ConvidadoModal({
  cor, busy, editando, onClose, onSave, onRemove,
}: {
  cor: string; busy: boolean; editando?: ConvidadoCli
  onClose: () => void
  onSave: (op: string, convidado: Record<string, unknown>, okMsg?: string) => void
  onRemove: (id: string) => void
}) {
  const [f, setF] = useState({
    nome: editando?.nome || '', email: editando?.email || '', telefone: editando?.telefone || '',
    acompanhantes: editando?.acompanhantes || 0, mesa: editando?.mesa || '',
    restricao_alimentar: editando?.restricao_alimentar || '', observacao: editando?.observacao || '',
    status: editando?.status || 'convidado',
  })
  const inp = 'w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-[#ff385c] focus:outline-none focus:ring-2 focus:ring-[#ff385c]/20'
  function salvar() {
    if (!f.nome.trim()) { return }
    if (editando) onSave('update', { id: editando.id, ...f }, 'Convidado atualizado.')
    else onSave('add', f, 'Convidado adicionado!')
  }
  return (
    <Modal onClose={onClose} titulo={editando ? 'Editar convidado' : 'Novo convidado'}>
      <div className="space-y-2.5">
        <input className={inp} placeholder="Nome *" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} />
        <div className="grid grid-cols-2 gap-2.5">
          <input className={inp} placeholder="E-mail" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className={inp} placeholder="Telefone" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <input className={inp} type="number" min={0} placeholder="Acompanhantes" value={f.acompanhantes} onChange={(e) => setF({ ...f, acompanhantes: Number(e.target.value) })} />
          <input className={inp} placeholder="Mesa" value={f.mesa} onChange={(e) => setF({ ...f, mesa: e.target.value })} />
        </div>
        <input className={inp} placeholder="Restrição alimentar" value={f.restricao_alimentar} onChange={(e) => setF({ ...f, restricao_alimentar: e.target.value })} />
        <select className={inp} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}>
          <option value="convidado">Convidado</option>
          <option value="confirmado">Confirmado</option>
          <option value="recusado">Recusado</option>
        </select>
        <div className="flex items-center justify-between pt-1">
          {editando ? <button onClick={() => onRemove(editando.id)} disabled={busy} className="text-[.82rem] font-semibold text-red-600">Remover</button> : <span />}
          <button onClick={salvar} disabled={busy || !f.nome.trim()} className="rounded-xl px-5 py-2 text-sm font-semibold text-white disabled:opacity-50" style={{ background: cor }}>Salvar</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Documentos ──────────────────────────────────────────────────────────────
function Documentos({ contrato }: { contrato: ContratoCli }) {
  const temContrato = contrato && (String(contrato.status).toLowerCase() === 'assinado' || String(contrato.status).toLowerCase() === 'enviado') && contrato.link_token
  return (
    <div className="space-y-3">
      {temContrato && (
        <a href={`/contrato/${contrato!.link_token}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-[#f0f0f0] bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,.05)] hover:border-black/10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff5f6] text-xl">📄</div>
          <div>
            <div className="text-[.88rem] font-semibold text-gray-900">{contrato!.titulo || `Contrato ${contrato!.numero || ''}`}</div>
            <div className="text-[.76rem] text-gray-400">Abrir documento</div>
          </div>
        </a>
      )}
      <Vazio icon="📁" titulo="Documentos do evento" texto="Outros arquivos compartilhados pelo organizador aparecerão aqui." />
    </div>
  )
}

// ── Mensagens ───────────────────────────────────────────────────────────────
function Mensagens({ eventoId, conversaId, showFlash }: { eventoId: string; conversaId: string | null; showFlash: (k: 'ok' | 'err', m: string) => void }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function abrir() {
    if (conversaId) { router.push(`/client/conversas/${conversaId}`); return }
    setBusy(true)
    try {
      const r = await portalClienteApi('abrir_conversa', { evento_id: eventoId })
      router.push(`/client/conversas/${r.conversa_id}`)
    } catch (e) {
      showFlash('err', e instanceof Error ? e.message : 'Não foi possível abrir a conversa.')
      setBusy(false)
    }
  }
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <div className="mb-2 text-[2.4rem]">💬</div>
      <div className="text-[.95rem] font-bold text-gray-900">Fale com o organizador</div>
      <p className="mx-auto mt-1 max-w-sm text-[.84rem] text-gray-500">Tire dúvidas e combine os detalhes do seu evento diretamente pelo chat.</p>
      <button onClick={abrir} disabled={busy} className="mt-4 rounded-xl bg-[#ff385c] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#e0304f] disabled:opacity-50">
        {conversaId ? 'Abrir conversa' : 'Iniciar conversa'}
      </button>
    </div>
  )
}

// ── Avaliação ───────────────────────────────────────────────────────────────
function Avaliacao({ ev, now, cor }: { ev: Evento; now: Date; cor: string }) {
  const ocorreu = eventoJaOcorreu(ev, now)
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white p-6 text-center shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <div className="mb-2 text-[2.4rem]">⭐</div>
      {ocorreu ? (
        <>
          <div className="text-[.95rem] font-bold text-gray-900">Como foi o seu evento?</div>
          <p className="mx-auto mt-1 max-w-sm text-[.84rem] text-gray-500">Sua avaliação ajuda o organizador e outros clientes.</p>
          <Link href="/client/avaliacoes" className="mt-4 inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white" style={{ background: cor }}>Avaliar agora</Link>
        </>
      ) : (
        <>
          <div className="text-[.95rem] font-bold text-gray-900">Avaliação após o evento</div>
          <p className="mx-auto mt-1 max-w-sm text-[.84rem] text-gray-500">Assim que o evento acontecer, você poderá deixar sua avaliação por aqui.</p>
        </>
      )}
    </div>
  )
}

// ── UI compartilhada ──────────────────────────────────────────────────────────
function Vazio({ icon, titulo, texto }: { icon: string; titulo: string; texto: string }) {
  return (
    <div className="rounded-2xl border border-[#f0f0f0] bg-white px-5 py-12 text-center shadow-[0_2px_12px_rgba(0,0,0,.05)]">
      <div className="mb-2 text-[2.4rem]">{icon}</div>
      <div className="text-[.95rem] font-semibold text-gray-600">{titulo}</div>
      <p className="mx-auto mt-1 max-w-sm text-[.82rem] text-gray-400">{texto}</p>
    </div>
  )
}

function Modal({ titulo, children, onClose }: { titulo: string; children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-[0_8px_40px_rgba(0,0,0,.2)] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[1rem] font-bold text-gray-900">{titulo}</h3>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-gray-400 hover:bg-black/[0.04]">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

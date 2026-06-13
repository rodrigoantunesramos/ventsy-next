import { NextRequest } from 'next/server'
import { supabaseAdminAny as db } from '@/lib/supabaseAdmin'
import { sendEmail, emailConfigurado } from '@/lib/email'
import { formatMoneyShort, formatPercent, formatNumber } from '@/lib/format'
import {
  todayYMD, addDiasYMD, noRange, proximaExecucao, type Range, type Frequencia,
  funilComercial, calcularOcupacao, revpas, receitaPorM2, receitaPorEvento, calcularNps,
  montarBlocosOcupacao, stageRank,
  type EventoBI, type ReservaBI, type EspacoBI, type RespostaNpsBI,
} from '@/lib/bi'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cron de exportação agendada de relatórios — disparado pelo agendador (pg_cron+
// pg_net no Supabase; ver docs/sql/relatorios.sql). Para cada agendamento ATIVO
// cuja proxima_exec <= hoje: calcula o resumo executivo (engine pura lib/bi.ts),
// envia o digest por e-mail aos destinatários (anexo CSV) e reprograma a próxima
// execução. Sem SMTP (ou ?dry=1) roda em modo simulado, sem enviar nem avançar.
//
// Segurança: exige CRON_SECRET (Bearer ou ?secret=).

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  return bearer === secret
}

async function safe<T>(p: PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  try { const { data } = await p; return (data || []) as T[] } catch { return [] }
}

type Agendado = {
  id: string; usuario_id: string; nome: string | null; relatorio_id: string | null; dashboard: string | null
  formato: string; frequencia: Frequencia; dia_semana: number | null; dia_mes: number | null
  destinatarios: string[]; ativo: boolean
}

// Resumo executivo do dono nos últimos 30 dias (KPIs do nicho).
async function resumoDoDono(uid: string, range: Range): Promise<[string, string][]> {
  const [eventos, lanc, espacos, props, reservas, nps, propostas, contratos] = await Promise.all([
    safe<EventoBI>(db.from('clientes_eventos').select('id,status,data_inicio,data_fim,valor_total_num,propriedade_id,qtd_adultos,qtd_criancas,criado_em').eq('usuario_id', uid)),
    safe<{ tipo: string; valor: number; data: string | null }>(db.from('lancamentos').select('tipo,valor,data').eq('usuario_id', uid)),
    safe<EspacoBI>(db.from('espacos').select('id,propriedade_id,area_m2,capacidade').eq('usuario_id', uid)),
    safe<{ id: number }>(db.from('propriedades').select('id').eq('usuario_id', uid)),
    safe<ReservaBI>(db.from('reservas').select('espaco_id,propriedade_id,status,inicio,fim,data_inicio,data_fim').eq('usuario_id', uid).limit(8000)),
    safe<RespostaNpsBI & { criado_em: string | null }>(db.from('pesquisas_respostas').select('nps,criado_em').eq('usuario_id', uid)),
    safe<{ evento_id: string | null; status: string | null }>(db.from('propostas').select('evento_id,status').eq('usuario_id', uid)),
    safe<{ evento_id: string | null; status: string | null; assinado_em: string | null }>(db.from('contratos').select('evento_id,status,assinado_em').eq('usuario_id', uid)),
  ])

  let receita = 0, despesa = 0
  for (const l of lanc) { if (!noRange(l.data, range)) continue; if (l.tipo === 'receita') receita += Number(l.valor) || 0; else if (l.tipo === 'despesa') despesa += Number(l.valor) || 0 }
  const lucro = receita - despesa

  const comProposta = new Set<string>()
  propostas.forEach((p) => { if (p.evento_id && (p.status || '').toLowerCase() !== 'rascunho') comProposta.add(p.evento_id) })
  const assinadoEm = new Map<string, string>()
  contratos.forEach((c) => { if (c.evento_id && (c.status || '').toLowerCase() === 'assinado') assinadoEm.set(c.evento_id, c.assinado_em || '') })
  const f = funilComercial(eventos.filter((e) => noRange(e.criado_em || e.data_inicio, range)), { comProposta, assinadoEm })

  const { blocos, nEspacos, areaTotal } = montarBlocosOcupacao(reservas, eventos, espacos, props, null)
  const oc = calcularOcupacao(blocos, nEspacos, range)
  const dias = Math.max(1, oc.spaceDaysDisponiveis / Math.max(1, nEspacos))
  const eventosContratados = eventos.filter((e) => stageRank(e.status) >= 2 && noRange(e.data_inicio, range)).length
  const rM2 = receitaPorM2(receita, areaTotal)
  const npsR = calcularNps(nps.filter((r) => noRange(r.criado_em, range)))

  return [
    ['Receita', formatMoneyShort(receita)],
    ['Despesas', formatMoneyShort(despesa)],
    ['Lucro líquido', formatMoneyShort(lucro)],
    ['Margem', receita > 0 ? formatPercent(lucro / receita) : '—'],
    ['Taxa de ocupação', formatPercent(oc.taxa)],
    ['RevPAS', formatMoneyShort(revpas(receita, nEspacos, dias))],
    ['Receita por m²', rM2 != null ? formatMoneyShort(rM2) : '—'],
    ['Receita por evento', formatMoneyShort(receitaPorEvento(receita, eventosContratados))],
    ['Leads', formatNumber(f.leads)],
    ['Contratos', formatNumber(f.contratos)],
    ['Conversão geral', formatPercent(f.convGeral)],
    ['NPS', npsR.total ? String(npsR.score) : '—'],
  ]
}

function renderEmail(ag: Agendado, kpis: [string, string][]): string {
  const url = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br') + '/painel/relatorios'
  const cards = kpis.map(([k, v]) => `
    <td style="padding:12px 10px;text-align:center;background:#fff;border:1px solid #eee;border-radius:12px;width:33%">
      <div style="font-size:18px;font-weight:800;color:#111">${v}</div>
      <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:.4px;margin-top:2px">${k}</div>
    </td>`)
  const rows: string[] = []
  for (let i = 0; i < cards.length; i += 3) rows.push(`<tr>${cards.slice(i, i + 3).join('')}</tr>`)
  return `<!doctype html><html><body style="margin:0;background:#f7f7f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:600px;margin:0 auto;padding:28px 20px">
      <div style="font-family:Georgia,serif;font-style:italic;font-size:26px;font-weight:700;color:#ff385c">VENTSY</div>
      <div style="background:#fff;border-radius:18px;padding:26px;margin-top:14px;box-shadow:0 1px 3px rgba(0,0,0,.06)">
        <h1 style="font-size:18px;color:#111;margin:0 0 4px">Seu relatório — ${ag.nome || 'Relatório'}</h1>
        <p style="font-size:13px;color:#888;margin:0 0 18px">Resumo executivo dos últimos 30 dias. O detalhamento (${ag.formato.toUpperCase()}) está em anexo e no painel.</p>
        <table width="100%" cellspacing="8" cellpadding="0" style="border-collapse:separate">${rows.join('')}</table>
        <a href="${url}" style="display:block;text-align:center;margin-top:22px;background:#ff385c;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:13px;border-radius:999px">Abrir o BI completo →</a>
      </div>
      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px">Você recebe este envio por ter agendado um relatório na Ventsy.</p>
    </div>
  </body></html>`
}

function csvDe(ag: Agendado, kpis: [string, string][]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  return '﻿' + `Relatório,${esc(ag.nome || '')}\nPeríodo,Últimos 30 dias\n\nIndicador,Valor\n` + kpis.map(([k, v]) => `${esc(k)},${esc(v)}`).join('\n')
}

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })

  const hoje = todayYMD()
  const dryParam = new URL(req.url).searchParams.get('dry') === '1'
  const dryRun = dryParam || !emailConfigurado()
  const range: Range = { ini: addDiasYMD(hoje, -29), fim: hoje }

  // Agendamentos ativos e devidos (proxima_exec <= hoje OU ainda não programada).
  const { data, error } = await db
    .from('relatorios_agendados')
    .select('id,usuario_id,nome,relatorio_id,dashboard,formato,frequencia,dia_semana,dia_mes,destinatarios,ativo,proxima_exec')
    .eq('ativo', true)
    .or(`proxima_exec.lte.${hoje},proxima_exec.is.null`)
  if (error) return Response.json({ error: 'tabela ausente ou indisponível', detail: error.message }, { status: 200 })

  const lista = (data || []) as (Agendado & { proxima_exec: string | null })[]
  let enviados = 0, pulados = 0, falhas = 0
  const resumoCache = new Map<string, [string, string][]>()
  const erros: string[] = []

  for (const ag of lista) {
    const dest = (ag.destinatarios || []).filter((e) => /.+@.+\..+/.test(e))
    if (dest.length === 0) { pulados++; continue }
    try {
      if (!resumoCache.has(ag.usuario_id)) resumoCache.set(ag.usuario_id, await resumoDoDono(ag.usuario_id, range))
      const kpis = resumoCache.get(ag.usuario_id)!

      if (dryRun) { pulados++; continue }

      const html = renderEmail(ag, kpis)
      const attachments = [{ filename: `relatorio-${hoje}.csv`, content: csvDe(ag, kpis), contentType: 'text/csv' }]
      let okAlgum = false
      for (const to of dest) {
        const r = await sendEmail({ to, subject: `📊 ${ag.nome || 'Seu relatório'} — Ventsy`, html, attachments })
        if (r.ok) okAlgum = true
      }
      const prox = proximaExecucao(ag.frequencia, hoje, { diaSemana: ag.dia_semana ?? 0, diaMes: ag.dia_mes ?? 1 })
      await db.from('relatorios_agendados').update({ ultima_exec: new Date().toISOString(), proxima_exec: prox }).eq('id', ag.id)
      if (okAlgum) enviados++; else pulados++
    } catch (e) { falhas++; erros.push(`${ag.id}: ${(e as Error).message}`) }
  }

  return Response.json({
    dryRun,
    motivo: dryRun ? (dryParam ? 'forçado ?dry=1' : 'SMTP não configurado') : undefined,
    devidos: lista.length, enviados, pulados, falhas, erros: erros.slice(0, 10),
  })
}

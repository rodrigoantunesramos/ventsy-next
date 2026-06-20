import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

// Manutenção diária das contas a pagar (ver vercel.json) — disparado por Cron.
//   1) Vencidas: contas 'pendente' com vencimento no passado viram 'atrasado'.
//      (A UI já deriva "atrasado" em tempo real; este cron é o autoritativo.)
//   2) Recorrências: para cada série recorrente, se a última ocorrência já
//      venceu, gera a PRÓXIMA conta (um passo por execução, sem duplicar).
//
// Segurança: exige CRON_SECRET. A Vercel injeta `Authorization: Bearer <secret>`.
// Teste manual: ?secret=<CRON_SECRET>. Simulação: ?dry=1.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

type Freq = 'semanal' | 'quinzenal' | 'mensal' | 'bimestral' | 'trimestral' | 'semestral' | 'anual'

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  return bearer === secret
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function addMonths(d: Date, n: number): Date {
  const day = d.getDate()
  const r = new Date(d.getFullYear(), d.getMonth() + n, 1, 12, 0, 0)
  const ult = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, ult))
  return r
}
function proximaData(iso: string, freq: Freq): string {
  const d = new Date(iso + 'T12:00:00')
  switch (freq) {
    case 'semanal': d.setDate(d.getDate() + 7); return ymd(d)
    case 'quinzenal': d.setDate(d.getDate() + 14); return ymd(d)
    case 'mensal': return ymd(addMonths(d, 1))
    case 'bimestral': return ymd(addMonths(d, 2))
    case 'trimestral': return ymd(addMonths(d, 3))
    case 'semestral': return ymd(addMonths(d, 6))
    case 'anual': return ymd(addMonths(d, 12))
    default: return ymd(addMonths(d, 1))
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Conta = any

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const hoje = new Date().toISOString().slice(0, 10)

  // 1) Marcar vencidas como 'atrasado'
  let atrasadas = 0
  {
    const { data, error } = await admin
      .from('contas_pagar')
      .select('id')
      .eq('status', 'pendente')
      .not('vencimento', 'is', null)
      .lt('vencimento', hoje)
    if (error) {
      // Tabela ainda não criada (rodar docs/sql/contas-pagar.sql): nada a fazer.
      if (error.code === 'PGRST205' || error.code === '42P01') return Response.json({ skipped: 'contas_pagar ausente' })
      return Response.json({ error: error.message }, { status: 500 })
    }
    const ids = (data || []).map((r: { id: string }) => r.id)
    atrasadas = ids.length
    if (!dry && ids.length) {
      const { error: upErr } = await admin.from('contas_pagar').update({ status: 'atrasado' }).in('id', ids)
      if (upErr) return Response.json({ error: upErr.message }, { status: 500 })
    }
  }

  // 2) Rolar recorrências vencidas (uma próxima por série)
  let geradas = 0
  {
    const { data: recs, error } = await admin
      .from('contas_pagar')
      .select('id,usuario_id,fornecedor_id,categoria,plano_conta,descricao,valor_num,vencimento,status,metodo,recorrente,recorrencia,recorrencia_pai,aprovado')
      .eq('recorrente', true)
      .neq('status', 'cancelado')
    if (error) return Response.json({ error: error.message }, { status: 500 })

    // Agrupa por raiz da série; pega a ocorrência de maior vencimento.
    const ultimaPorSerie = new Map<string, Conta>()
    for (const c of (recs || []) as Conta[]) {
      const raiz = c.recorrencia_pai || c.id
      const atual = ultimaPorSerie.get(raiz)
      if (!atual || (c.vencimento || '') > (atual.vencimento || '')) ultimaPorSerie.set(raiz, c)
    }

    const novas: Conta[] = []
    for (const [raiz, c] of ultimaPorSerie) {
      if (!c.vencimento || c.vencimento >= hoje) continue // ainda não venceu → nada a gerar
      const freq: Freq = (c.recorrencia?.freq as Freq) || 'mensal'
      const prox = proximaData(c.vencimento, freq)
      const ate = c.recorrencia?.ate
      if (ate && prox > ate) continue
      novas.push({
        usuario_id: c.usuario_id, fornecedor_id: c.fornecedor_id, categoria: c.categoria, plano_conta: c.plano_conta,
        descricao: c.descricao, valor_num: c.valor_num, vencimento: prox, status: 'pendente', metodo: c.metodo,
        recorrente: true, recorrencia: c.recorrencia, recorrencia_pai: raiz, aprovado: c.aprovado,
      })
    }
    geradas = novas.length
    if (!dry && novas.length) {
      const { error: insErr } = await admin.from('contas_pagar').insert(novas)
      if (insErr) return Response.json({ error: insErr.message }, { status: 500 })
    }
  }

  return Response.json({ dry, hoje, atrasadas, recorrencias_geradas: geradas })
}

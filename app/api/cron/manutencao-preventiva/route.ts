import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { proximaData, type Periodicidade } from '@/lib/manutencao'

// Geração diária de OS preventivas (ver vercel.json) — disparado por Cron.
// Para cada plano ATIVO, calendarizado e com `proxima_data` já vencida (≤ hoje),
// gera UMA ordem de serviço (status 'aberta') copiando alvo/responsável/checklist
// do plano, e avança `proxima_data` para a próxima ocorrência (mantém a cadência).
// Planos `horas_uso` são ignorados (disparo por uso, não por calendário).
//
// Idempotente no dia: não duplica se já existe OS do plano aberta hoje.
// Segurança: exige CRON_SECRET. A Vercel injeta `Authorization: Bearer <secret>`.
// Teste manual: ?secret=<CRON_SECRET>. Simulação: ?dry=1.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

function autorizado(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const bearer = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  return bearer === secret
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Plano = any

export async function GET(req: NextRequest) {
  if (!autorizado(req)) return Response.json({ error: 'não autorizado' }, { status: 401 })
  const dry = new URL(req.url).searchParams.get('dry') === '1'
  const hoje = new Date().toISOString().slice(0, 10)

  // 1) Planos devidos: ativos, calendarizados e com próxima data vencida.
  const { data: planos, error } = await admin
    .from('manutencao_planos')
    .select('id,usuario_id,propriedade_id,espaco_id,ativo_id,ativo_nome,titulo,descricao,tipo,prioridade,periodicidade,intervalo,proxima_data,responsavel_tipo,responsavel_id,responsavel_nome,checklist,ativo')
    .eq('ativo', true)
    .neq('periodicidade', 'horas_uso')
    .not('proxima_data', 'is', null)
    .lte('proxima_data', hoje)
  if (error) {
    // Tabela ainda não criada (rodar docs/sql/manutencao.sql): nada a fazer.
    if (error.code === 'PGRST205' || error.code === '42P01') return Response.json({ skipped: 'manutencao_planos ausente' })
    return Response.json({ error: error.message }, { status: 500 })
  }

  let geradas = 0
  const detalhes: { plano: string; os?: string; pulado?: boolean }[] = []

  for (const p of (planos || []) as Plano[]) {
    // Anti-duplicação: já existe OS deste plano aberta hoje?
    const { data: existe } = await admin
      .from('manutencao_os')
      .select('id')
      .eq('plano_id', p.id)
      .eq('abertura', hoje)
      .limit(1)
    if (existe && existe.length) { detalhes.push({ plano: p.id, pulado: true }); continue }

    const checklist = Array.isArray(p.checklist) ? p.checklist.map((c: { item: string }) => ({ item: c.item, ok: false })) : []
    const prox = proximaData(p.proxima_data, p.periodicidade as Periodicidade, p.intervalo || 1)

    if (dry) { geradas++; detalhes.push({ plano: p.id }); continue }

    const { data: nova, error: insErr } = await admin
      .from('manutencao_os')
      .insert({
        usuario_id: p.usuario_id,
        propriedade_id: p.propriedade_id, espaco_id: p.espaco_id, ativo_id: p.ativo_id, ativo_nome: p.ativo_nome,
        tipo: p.tipo || 'preventiva', titulo: p.titulo, descricao: p.descricao,
        prioridade: p.prioridade || 'media', status: 'aberta',
        responsavel_tipo: p.responsavel_tipo, responsavel_id: p.responsavel_id, responsavel_nome: p.responsavel_nome,
        abertura: hoje, prazo: p.proxima_data, plano_id: p.id, checklist,
        custo_mao_obra_num: 0, custo_pecas_num: 0,
      })
      .select('id')
      .single()
    if (insErr) { detalhes.push({ plano: p.id, pulado: true }); continue }

    await admin.from('manutencao_planos').update({ proxima_data: prox, ultima_geracao: hoje }).eq('id', p.id)
    geradas++
    detalhes.push({ plano: p.id, os: nova?.id })
  }

  return Response.json({ dry, hoje, planos_devidos: (planos || []).length, os_geradas: geradas, detalhes })
}

import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/adminAuth'
import { forbidden } from '@/lib/apiAuth'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { registrarAcaoAdmin } from '@/lib/adminAudit'
import { MODULOS_PAINEL, modulosDefaultDoPlano } from '@/lib/modulos'

// Edição de planos (preço/benefícios/status + MÓDULOS incluídos) na fonte única
// `planos_config`, e dos metadados/preço de cada módulo em `modulos_config`
// (venda avulsa). Consumido pelas páginas pública e do painel. Via service-role
// após requireAdmin.
export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const PLANOS = ['basico', 'pro', 'ultra']
const MODULO_KEYS = new Set(MODULOS_PAINEL.map((m) => m.key))

type ModRow = {
  key: string
  ativo?: boolean
  vendavel?: boolean
  preco_avulso?: number
  destaque?: boolean
  descricao?: string | null
}

export async function GET(req: NextRequest) {
  const ctx = await requireAdmin(req, 'planos', 'ver')
  if (!ctx) return forbidden()

  const [{ data: planosData }, { data: modData }] = await Promise.all([
    admin.from('planos_config').select('*'),
    admin.from('modulos_config').select('*'),
  ])

  const pmap = new Map<string, Record<string, unknown>>()
  for (const p of (planosData ?? []) as Array<Record<string, unknown>>) pmap.set(p.id as string, p)

  const planos = PLANOS.map((id) => {
    const p = pmap.get(id) ?? {}
    const modulos = Array.isArray(p.modulos) && (p.modulos as string[]).length
      ? (p.modulos as string[]).filter((k) => MODULO_KEYS.has(k))
      : modulosDefaultDoPlano(id) // default do catálogo até o admin salvar
    return {
      id,
      preco: Number(p.preco) || 0,
      items: Array.isArray(p.items) ? (p.items as string[]) : [],
      status: (p.status as string) || 'ativo',
      modulos,
    }
  })

  const cmap = new Map<string, Record<string, unknown>>()
  for (const m of (modData ?? []) as Array<Record<string, unknown>>) cmap.set(m.key as string, m)

  // Catálogo canônico + overrides salvos (ativo/vendável/preço/destaque/descrição).
  const modulos = MODULOS_PAINEL.map((def) => {
    const c = cmap.get(def.key) ?? {}
    return {
      key: def.key,
      label: def.label,
      grupo: def.grupo,
      core: def.core === true,
      planoDefault: def.plano,
      ativo: c.ativo === undefined ? true : c.ativo === true,
      vendavel: c.vendavel === true,
      preco_avulso: Number(c.preco_avulso) || 0,
      destaque: c.destaque === true,
      descricao: (c.descricao as string) ?? '',
    }
  })

  return Response.json({ planos, modulos })
}

export async function POST(req: NextRequest) {
  const ctx = await requireAdmin(req, 'planos', 'editar')
  if (!ctx) return forbidden()

  const body = (await req.json().catch(() => ({}))) as {
    planos?: Array<Record<string, unknown>>
    modulos?: ModRow[]
  }
  const entradaPlanos = Array.isArray(body.planos) ? body.planos : []
  const entradaMods = Array.isArray(body.modulos) ? body.modulos : []

  // 1) Planos — preço/benefícios/status/módulos.
  const registros = entradaPlanos
    .filter((p) => PLANOS.includes(p.id as string))
    .map((p) => {
      const itemsRaw = p.items
      const items = Array.isArray(itemsRaw)
        ? (itemsRaw as string[]).map((s) => String(s).trim()).filter(Boolean)
        : String(itemsRaw || '')
            .split('\n')
            .map((s) => s.trim())
            .filter(Boolean)
      const modulos = Array.isArray(p.modulos)
        ? Array.from(new Set((p.modulos as string[]).filter((k) => MODULO_KEYS.has(k))))
        : []
      return {
        id: p.id as string,
        preco: Number(p.preco) || 0,
        items,
        status: p.status === 'oculto' ? 'oculto' : 'ativo',
        modulos,
        atualizado_em: new Date().toISOString(),
      }
    })

  if (!registros.length) return Response.json({ error: 'Nada para salvar.' }, { status: 400 })

  const { error: ePlanos } = await admin
    .from('planos_config')
    .upsert(registros, { onConflict: 'id' })
  if (ePlanos) return Response.json({ error: ePlanos.message }, { status: 500 })

  // 2) Módulos — metadados/preço avulso (só chaves válidas do catálogo).
  const labelGrupo = new Map(MODULOS_PAINEL.map((m) => [m.key, { label: m.label, grupo: m.grupo }]))
  const modRegistros = entradaMods
    .filter((m) => MODULO_KEYS.has(m.key))
    .map((m) => ({
      key: m.key,
      label: labelGrupo.get(m.key)?.label ?? m.key,
      grupo: labelGrupo.get(m.key)?.grupo ?? null,
      ativo: m.ativo !== false,
      vendavel: m.vendavel === true,
      preco_avulso: Math.max(0, Number(m.preco_avulso) || 0),
      destaque: m.destaque === true,
      descricao: m.descricao ? String(m.descricao).slice(0, 500) : null,
      atualizado_em: new Date().toISOString(),
    }))

  if (modRegistros.length) {
    const { error: eMods } = await admin
      .from('modulos_config')
      .upsert(modRegistros, { onConflict: 'key' })
    if (eMods) return Response.json({ error: eMods.message }, { status: 500 })
  }

  await registrarAcaoAdmin(ctx, 'planos', 'salvar', null, {
    planos: registros.length,
    modulos: modRegistros.length,
  })
  return Response.json({ ok: true })
}

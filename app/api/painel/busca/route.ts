import type { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/apiAuth'
import { supabaseServer } from '@/lib/supabaseServer'

// Busca GLOBAL FEDERADA do painel do dono (alimenta o Command Palette / ⌘K).
// Distinta de /api/busca (busca PÚBLICA de espaços via RPC buscar_espacos).
// Roda no servidor com o client ciente da sessão (RLS) E, como defesa em
// profundidade, filtra SEMPRE por usuario_id = dono autenticado — porque
// algumas tabelas (clientes_eventos, reservas, documentos) não têm RLS de
// linha e dependem do filtro de aplicação. Cada consulta degrada para [] em
// erro (ex.: tabela ausente), nunca derruba a busca inteira.

export const dynamic = 'force-dynamic'

type FedItem = { id: string; titulo: string; sub: string; href: string }
type FedGroup = { key: string; items: FedItem[] }

// Sanitiza o termo para o filtro .or() do PostgREST: vírgula, parênteses, barra
// e os curingas (% *) são metacaracteres do parser — viram espaço. Limita tamanho.
function safeTerm(raw: string): string {
  return raw.replace(/[,()\\%*]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
}

const sub = (...parts: Array<string | null | undefined>) =>
  parts.map((p) => (p ?? '').toString().trim()).filter(Boolean).join(' · ')

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return Response.json({ grupos: [] }, { status: 401 })

  const term = safeTerm(new URL(req.url).searchParams.get('q') || '')
  if (term.length < 2) return Response.json({ grupos: [] })

  const uid = user.id
  const like = `%${term}%`
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabaseServer() as any

  // Roda uma query do PostgREST, devolvendo apenas as linhas (ou [] em erro).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const run = async (builder: any): Promise<any[]> => {
    try {
      const { data, error } = await builder
      if (error) return []
      return data ?? []
    } catch {
      return []
    }
  }

  const [cli, evt, res, prop, doc] = await Promise.all([
    run(
      sb.from('clientes').select('id,nome,email,telefone').eq('usuario_id', uid)
        .or(`nome.ilike.${like},email.ilike.${like},telefone.ilike.${like},whatsapp.ilike.${like}`)
        .limit(5),
    ),
    run(
      sb.from('clientes_eventos').select('id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio').eq('usuario_id', uid)
        .or(`nome_evento.ilike.${like},quem_contratou.ilike.${like},tipo_evento.ilike.${like}`)
        .order('data_inicio', { ascending: false }).limit(5),
    ),
    run(
      sb.from('reservas').select('id,titulo,nome,tipo_evento,status,data_inicio').eq('usuario_id', uid)
        .or(`titulo.ilike.${like},nome.ilike.${like},tipo_evento.ilike.${like}`)
        .order('data_inicio', { ascending: false }).limit(5),
    ),
    run(
      sb.from('propostas').select('id,titulo,status,criado_em').eq('usuario_id', uid)
        .or(`titulo.ilike.${like},observacoes.ilike.${like}`)
        .order('criado_em', { ascending: false }).limit(5),
    ),
    run(
      sb.from('documentos').select('id,nome,numero,orgao,categoria').eq('usuario_id', uid)
        .or(`nome.ilike.${like},numero.ilike.${like},orgao.ilike.${like},categoria.ilike.${like}`)
        .limit(5),
    ),
  ])

  const grupos: FedGroup[] = []

  const cliItems: FedItem[] = cli.map((c) => ({
    id: String(c.id), titulo: c.nome || c.email || 'Cliente',
    sub: sub(c.email, c.telefone), href: `/painel/clientes/${c.id}`,
  }))
  if (cliItems.length) grupos.push({ key: 'clientes', items: cliItems })

  const evtItems: FedItem[] = evt.map((e) => ({
    id: String(e.id), titulo: e.nome_evento || e.tipo_evento || e.quem_contratou || 'Evento',
    sub: sub(e.tipo_evento, e.status, e.data_inicio),
    href: e.cliente_id ? `/painel/clientes/${e.cliente_id}` : '/painel/leads',
  }))
  if (evtItems.length) grupos.push({ key: 'eventos', items: evtItems })

  const resItems: FedItem[] = res.map((r) => ({
    id: String(r.id), titulo: r.titulo || r.nome || r.tipo_evento || 'Reserva',
    sub: sub(r.tipo_evento, r.status, r.data_inicio), href: '/painel/reservas',
  }))
  if (resItems.length) grupos.push({ key: 'reservas', items: resItems })

  const propItems: FedItem[] = prop.map((p) => ({
    id: String(p.id), titulo: p.titulo || 'Proposta',
    sub: sub(p.status), href: '/painel/propostas',
  }))
  if (propItems.length) grupos.push({ key: 'propostas', items: propItems })

  const docItems: FedItem[] = doc.map((d) => ({
    id: String(d.id), titulo: d.nome || d.numero || 'Documento',
    sub: sub(d.categoria, d.orgao), href: `/painel/documentos/${d.id}`,
  }))
  if (docItems.length) grupos.push({ key: 'documentos', items: docItems })

  return Response.json({ grupos })
}

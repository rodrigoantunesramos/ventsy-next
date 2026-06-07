import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { getAuthUser, unauthorized } from '@/lib/apiAuth'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any

const AMBIENTES = ['Destaque', 'Salão principal', 'Área externa', 'Cozinha / Buffet', 'Piscina', 'Banheiros', 'Quartos / Suítes', 'Estacionamento', 'Decoração', 'Outros']

// POST /api/fotos/ia — usa a CHAVE DE IA DO PRÓPRIO USUÁRIO (BYOK) para sugerir
// categoria/ambiente + alt-text de cada foto. body: { fotos: [{id, url}] }.
export async function POST(req: NextRequest) {
  const user = await getAuthUser(req)
  if (!user) return unauthorized()

  const { fotos } = await req.json()
  if (!Array.isArray(fotos) || fotos.length === 0) return Response.json({ error: 'fotos[] é obrigatório.' }, { status: 400 })

  const { data: integ } = await admin.from('integracoes').select('provider, api_key, modelo').eq('usuario_id', user.id).maybeSingle()
  const key: string = integ?.api_key || ''
  if (!key) {
    return Response.json({ error: 'Configure sua chave de IA em Configurações → Integrações para usar este recurso.', code: 'SEM_CHAVE' }, { status: 400 })
  }
  const modelo = integ?.modelo || 'gpt-4o-mini'

  const results: { id: string; categoria: string | null; alt: string | null }[] = []
  for (const f of fotos.slice(0, 12) as { id: string; url: string }[]) {
    try {
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelo,
          max_tokens: 120,
          temperature: 0.2,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: `Você organiza fotos de espaços para eventos. Responda APENAS um JSON {"categoria": <uma de: ${AMBIENTES.join(', ')}>, "alt": <descrição curta em português, máx 12 palavras, sem aspas>}.` },
              { type: 'image_url', image_url: { url: f.url } },
            ],
          }],
        }),
      })
      if (!r.ok) {
        const e = await r.json().catch(() => ({}))
        if (r.status === 401) return Response.json({ error: 'Chave de IA inválida. Verifique em Integrações.', code: 'CHAVE_INVALIDA' }, { status: 400 })
        results.push({ id: f.id, categoria: null, alt: null })
        if (e?.error?.message) console.error('IA erro:', e.error.message)
        continue
      }
      const j = await r.json()
      const txt: string = j?.choices?.[0]?.message?.content || '{}'
      const parsed = JSON.parse(txt.replace(/```json|```/g, '').trim())
      const categoria = AMBIENTES.includes(parsed.categoria) ? parsed.categoria : null
      results.push({ id: f.id, categoria, alt: typeof parsed.alt === 'string' ? parsed.alt.slice(0, 140) : null })
    } catch {
      results.push({ id: f.id, categoria: null, alt: null })
    }
  }

  return Response.json({ results })
}

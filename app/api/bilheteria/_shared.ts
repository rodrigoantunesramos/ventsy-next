// Helpers server-side compartilhados pelas rotas de /api/bilheteria.
// (Lógica de negócio pura fica em lib/bilheteria.ts; aqui só I/O com o banco.)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any

// Janela de "hold" de uma reserva pendente: enquanto não paga, segura o assento.
// Mantida em sincronia com o cron /api/cron/expirar-pedidos.
export const HOLD_MINUTOS = 30
export const HOLD_MS = HOLD_MINUTOS * 60 * 1000

/** Token único (página pública / QR de ingresso). 32 hex. */
export function gerarToken(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, '')
  let s = ''
  for (let i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16)
  return s
}

/**
 * Conta os ocupados de cada categoria = ingressos pagos/checkin + reservas
 * AINDA ativas (criadas dentro da janela de hold). Reservas vencidas não contam
 * — o assento volta a ficar livre mesmo antes do cron rodar. Devolve um mapa
 * categoria_id → ocupados.
 */
export async function ocupadosPorCategoria(admin: Admin, categoriaIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {}
  if (!categoriaIds.length) return out
  const cutoff = new Date(Date.now() - HOLD_MS).toISOString()
  for (const id of categoriaIds) {
    const [{ count: pagos }, { count: reservados }] = await Promise.all([
      admin.from('ingressos').select('id', { count: 'exact', head: true }).eq('categoria_id', id).in('status', ['pago', 'checkin']),
      admin.from('ingressos').select('id', { count: 'exact', head: true }).eq('categoria_id', id).eq('status', 'reservado').gte('criado_em', cutoff),
    ])
    out[id] = (pagos || 0) + (reservados || 0)
  }
  return out
}

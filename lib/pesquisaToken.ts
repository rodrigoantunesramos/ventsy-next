import crypto from 'crypto';

// Token AUTO-CONTIDO (stateless) para o link público de uma pesquisa.
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ SERVER-ONLY — usa `crypto` e um segredo do ambiente. Nunca importar em
// componentes 'use client'.
//
// Espelha lib/feedbackToken: o link é gerado SOB DEMANDA, é estável e não exige
// coluna/tabela extra. Aqui o payload carrega a PESQUISA e (opcionalmente) o
// EVENTO — assim a mesma pesquisa pode ter um link genérico ou um link por evento
// (segmentação). Assinado por HMAC: só quem tem o segredo do servidor forja.
//
// Formato: "<base64url(pesquisaId|eventoId?)>.<hmac-sha256 truncado>".

function secret(): string {
  // Reaproveita a service-role key como segredo se nenhum dedicado for definido.
  return process.env.PESQUISA_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ventsy-pesquisa-dev-secret';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 24);
}

/** Assina um token estável para a pesquisa (com evento opcional). */
export function signPesquisaToken(pesquisaId: string, eventoId?: string | null): string {
  const raw = `${pesquisaId}|${eventoId || ''}`;
  const payload = Buffer.from(raw, 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Valida o token e devolve { pesquisaId, eventoId|null }, ou null se inválido. */
export function verifyPesquisaToken(token: string): { pesquisaId: string; eventoId: string | null } | null {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  // Comparação em tempo constante (evita timing attack na assinatura).
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const raw = Buffer.from(payload, 'base64url').toString('utf8');
    const [pesquisaId, eventoId] = raw.split('|');
    if (!pesquisaId) return null;
    return { pesquisaId, eventoId: eventoId || null };
  } catch {
    return null;
  }
}

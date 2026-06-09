import crypto from 'crypto';

// Token AUTO-CONTIDO (stateless) para o link público de coleta de feedback.
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ SERVER-ONLY — usa `crypto` e um segredo do ambiente. Nunca importar em
// componentes 'use client'.
//
// Por que stateless (e não um link_token armazenado como em propostas): o link de
// feedback é gerado SOB DEMANDA por evento, é estável (sempre o mesmo p/ o evento)
// e não exige coluna/tabela extra. O token carrega o evento_id assinado por HMAC;
// só quem tem o segredo do servidor consegue forjar — suficiente para um formulário
// público anti-spam. O `verify` extrai o evento_id sem varrer o banco.
//
// Formato: "<base64url(evento_id)>.<hmac-sha256 truncado>".

function secret(): string {
  // Reaproveita a service-role key como segredo se nenhum dedicado for definido.
  return process.env.FEEDBACK_TOKEN_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'ventsy-feedback-dev-secret';
}

function sign(payload: string): string {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url').slice(0, 24);
}

/** Assina um token estável para o evento. */
export function signEventToken(eventoId: string): string {
  const payload = Buffer.from(String(eventoId), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Valida o token e devolve o evento_id, ou null se inválido/adulterado. */
export function verifyEventToken(token: string): string | null {
  const [payload, sig] = String(token || '').split('.');
  if (!payload || !sig) return null;
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  // Comparação em tempo constante (evita timing attack na assinatura).
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const id = Buffer.from(payload, 'base64url').toString('utf8');
    return id || null;
  } catch {
    return null;
  }
}

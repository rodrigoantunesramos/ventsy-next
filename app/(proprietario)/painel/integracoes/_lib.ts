// Camada de dados (client) da Central de Integrações. TODAS as leituras/escritas
// passam pelas rotas /api/integracoes/* (service-role) — o client nunca toca os
// segredos, só recebe status mascarado. Anexa o Bearer da sessão via authHeaders.

import { authHeaders } from '@/lib/supabase';
import type { ConexaoStatusDTO } from '@/lib/integracoes';

export type { ConexaoStatusDTO };

export type Webhook = {
  id: string; evento: string; url: string; ativo: boolean; descricao: string | null;
  segredo_last4: string; ultimo_status: number | null; ultimo_em: string | null; criado_em: string;
};
export type WebhookLog = {
  id: string; webhook_id: string; evento: string; tentativa: number; http_status: number;
  ok: boolean; erro: string | null; proxima_tentativa_em: string | null; criado_em: string;
};
export type ApiKey = {
  id: string; nome: string; prefixo: string; last4: string; escopos: string[];
  rate_limit: number | null; ultimo_uso: string | null; revogada: boolean; criado_em: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function req(path: string, method = 'GET', body?: any): Promise<any> {
  const res = await fetch(path, {
    method,
    headers: { 'content-type': 'application/json', ...(await authHeaders()) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || 'Falha na requisição.');
  return json;
}

// ── Conexões (catálogo) ──────────────────────────────────────────────────────
export const carregarConexoes = (): Promise<ConexaoStatusDTO[]> =>
  req('/api/integracoes/conexoes').then((j) => j.conexoes as ConexaoStatusDTO[]);
export const salvarConexao = (chave: string, valores: Record<string, string>): Promise<ConexaoStatusDTO> =>
  req('/api/integracoes/conexoes', 'POST', { chave, valores }).then((j) => j.conexao as ConexaoStatusDTO);
export const testarConexao = (chave: string): Promise<{ ok: boolean; mensagem: string; origem: string }> =>
  req('/api/integracoes/testar', 'POST', { chave });
export const desconectar = (chave: string): Promise<{ ok: boolean }> =>
  req('/api/integracoes/conexoes', 'DELETE', { chave });
export const iniciarMercadoPago = (): Promise<string> =>
  req('/api/mp/oauth/start').then((j) => j.url as string);

// ── Webhooks ─────────────────────────────────────────────────────────────────
export const carregarWebhooks = (): Promise<{ webhooks: Webhook[]; log: WebhookLog[] }> =>
  req('/api/integracoes/webhooks');
export const criarWebhook = (evento: string, url: string, descricao: string): Promise<{ webhook: Webhook; segredo: string }> =>
  req('/api/integracoes/webhooks', 'POST', { evento, url, descricao });
export const patchWebhook = (id: string, patch: Partial<Pick<Webhook, 'ativo' | 'url' | 'evento' | 'descricao'>>): Promise<Webhook> =>
  req('/api/integracoes/webhooks', 'PATCH', { id, ...patch }).then((j) => j.webhook as Webhook);
export const deletarWebhook = (id: string): Promise<{ ok: boolean }> =>
  req('/api/integracoes/webhooks', 'DELETE', { id });
export const testarWebhook = (id: string): Promise<{ ok: boolean; status: number }> =>
  req('/api/integracoes/webhooks/testar', 'POST', { id });

// ── Chaves de API ────────────────────────────────────────────────────────────
export const carregarChaves = (): Promise<ApiKey[]> =>
  req('/api/integracoes/chaves').then((j) => j.chaves as ApiKey[]);
export const criarChave = (nome: string, escopos: string[], rate_limit: number | null): Promise<{ chave: ApiKey; token: string }> =>
  req('/api/integracoes/chaves', 'POST', { nome, escopos, rate_limit });
export const revogarChave = (id: string): Promise<{ ok: boolean }> =>
  req('/api/integracoes/chaves', 'DELETE', { id });

// ── Util ─────────────────────────────────────────────────────────────────────
export function hojeYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

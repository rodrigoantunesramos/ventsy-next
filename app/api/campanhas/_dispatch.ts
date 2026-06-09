// Núcleo de ENVIO de campanhas — SERVER-ONLY (service-role + SMTP). Compartilhado
// pela rota de disparo (app/api/campanhas/enviar) e pelo cron (app/api/cron/campanhas).
// Processa a fila (`campanhas_envios` em status 'fila') em LOTES: renderiza o e-mail
// (interpolando {{variáveis}}), injeta pixel de abertura + redirect de clique +
// link de descadastro (todos via app/api/track), envia via lib/email e atualiza o
// estado de cada destinatário. Os contadores de rollup da campanha são RECALCULADOS
// a partir das linhas de envio (fonte da verdade) ao fim de cada lote.
//
// Sem "R$": campanha não carrega valores monetários.

import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { sendEmail, emailConfigurado } from '@/lib/email';
import { interpolar, chaveDescadastro, contarEnvios, type StatusEnvio } from '@/lib/campanhas';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export const LOTE = 50;  // destinatários por execução (mantém a requisição/cron rápidos)

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'https://ventsy.com.br').replace(/\/$/, '');
}

type CampanhaRow = {
  id: string; usuario_id: string; nome: string; canal: string;
  assunto: string | null; corpo: string; enviada_em: string | null; status: string;
};
type EnvioRow = {
  id: string; contato: string; nome: string | null; vars: Record<string, string> | null; status: StatusEnvio;
};

// ── Renderização do e-mail ────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Reescreve URLs do corpo para passar pelo redirect de clique (app/api/track).
function linkificar(textoEscapado: string, envioId: string): string {
  const b = baseUrl();
  return textoEscapado.replace(/(https?:\/\/[^\s<]+)/g, (url) => {
    const track = `${b}/api/track?c=${encodeURIComponent(envioId)}&e=click&u=${encodeURIComponent(url)}`;
    return `<a href="${track}" style="color:#ff385c;text-decoration:underline">${url}</a>`;
  });
}

/** HTML completo do e-mail de campanha (corpo interpolado + pixel + descadastro). */
export function renderEmailCampanha(opts: {
  corpo: string; vars: Record<string, string>; empresa: string; envioId: string;
}): string {
  const { corpo, vars, empresa, envioId } = opts;
  const b = baseUrl();
  const corpoHtml = linkificar(escapeHtml(interpolar(corpo, vars)), envioId).replace(/\n/g, '<br>');
  const pixel = `${b}/api/track?c=${encodeURIComponent(envioId)}&e=open`;
  const unsub = `${b}/api/track?c=${encodeURIComponent(envioId)}&e=unsub`;
  const marca = empresa || 'Ventsy';
  return `<!doctype html><html><body style="margin:0;background:#f7f7f8;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:560px;margin:0 auto;padding:28px 20px">
      <div style="font-family:Georgia,serif;font-style:italic;font-size:24px;font-weight:700;color:#ff385c">${escapeHtml(marca)}</div>
      <div style="background:#fff;border-radius:18px;padding:26px;margin-top:14px;box-shadow:0 1px 3px rgba(0,0,0,.06);font-size:15px;line-height:1.6;color:#333">
        ${corpoHtml}
      </div>
      <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px;line-height:1.5">
        Você recebe este e-mail por ser cliente de ${escapeHtml(marca)}.<br>
        <a href="${unsub}" style="color:#aaa;text-decoration:underline">Não quero mais receber estas mensagens</a>
      </p>
    </div>
    <img src="${pixel}" width="1" height="1" alt="" style="display:none">
  </body></html>`;
}

// ── Recálculo de contadores (a partir das linhas de envio) ────────────────────
export async function recomputarContadores(campanhaId: string): Promise<{ fila: number }> {
  const { data } = await admin.from('campanhas_envios').select('status').eq('campanha_id', campanhaId);
  const c = contarEnvios((data || []) as { status: StatusEnvio }[]);
  await admin.from('campanhas').update({
    n_total: c.total, n_enviados: c.enviados, n_entregues: c.entregues, n_abertos: c.abertos,
    n_clicados: c.clicados, n_falhas: c.falhas, n_descadastros: c.descadastros,
  }).eq('id', campanhaId);
  return { fila: c.fila };
}

// ── Processa um lote de e-mails da campanha ───────────────────────────────────
export type ResultadoLote = {
  ok: boolean; code?: 'NO_SMTP' | 'MANUAL'; processados: number; enviados: number;
  falhas: number; descadastrados: number; restantes: number;
};

/** Envia até `cap` (limite do plano) destinatários da fila desta campanha.
 *  `cap` limita por execução; o cron retoma o restante. */
export async function processarCampanhaEmail(camp: CampanhaRow, cap: number): Promise<ResultadoLote> {
  if (camp.canal !== 'email') return { ok: false, code: 'MANUAL', processados: 0, enviados: 0, falhas: 0, descadastrados: 0, restantes: 0 };
  if (!emailConfigurado()) return { ok: false, code: 'NO_SMTP', processados: 0, enviados: 0, falhas: 0, descadastrados: 0, restantes: 0 };

  const limite = Math.max(0, Math.min(LOTE, cap));
  const { data: filaData } = await admin
    .from('campanhas_envios').select('id, contato, nome, vars, status')
    .eq('campanha_id', camp.id).eq('status', 'fila').order('criado_em', { ascending: true }).limit(limite);
  const fila = (filaData || []) as EnvioRow[];

  // Opt-out autoritativo no momento do envio (independe do que foi materializado).
  const { data: descData } = await admin
    .from('descadastros').select('contato').eq('usuario_id', camp.usuario_id).eq('canal', 'email');
  const optOut = new Set(((descData || []) as { contato: string }[]).map((d) => chaveDescadastro(d.contato, 'email')));

  let enviados = 0, falhas = 0, descadastrados = 0;
  const agora = new Date().toISOString();

  for (const e of fila) {
    if (optOut.has(chaveDescadastro(e.contato, 'email'))) {
      await admin.from('campanhas_envios').update({ status: 'descadastrado' }).eq('id', e.id);
      descadastrados++; continue;
    }
    const vars = (e.vars && typeof e.vars === 'object') ? e.vars : {};
    const empresa = vars.empresa || '';
    const subject = interpolar(camp.assunto || camp.nome, vars) || camp.nome;
    const html = renderEmailCampanha({ corpo: camp.corpo, vars, empresa, envioId: e.id });
    try {
      const r = await sendEmail({ to: e.contato, subject, html });
      if (r.ok) {
        await admin.from('campanhas_envios').update({ status: 'entregue', enviado_em: agora, erro: null }).eq('id', e.id);
        enviados++;
      } else {
        await admin.from('campanhas_envios').update({ status: 'falha', erro: 'E-mail não configurado.' }).eq('id', e.id);
        falhas++;
      }
    } catch (err) {
      await admin.from('campanhas_envios').update({ status: 'falha', erro: String((err as Error).message || err).slice(0, 300) }).eq('id', e.id);
      falhas++;
    }
  }

  const { fila: restantes } = await recomputarContadores(camp.id);
  // Finaliza a campanha quando a fila zera.
  if (restantes === 0) {
    await admin.from('campanhas').update({ status: 'enviada', enviada_em: camp.enviada_em || agora }).eq('id', camp.id);
  }
  return { ok: true, processados: fila.length, enviados, falhas, descadastrados, restantes };
}

/** Envia um e-mail de TESTE da campanha para `destino` (sem tocar na fila). */
export async function enviarTeste(camp: CampanhaRow, destino: string, empresa: string): Promise<{ ok: boolean; code?: string; error?: string }> {
  if (camp.canal !== 'email') return { ok: false, code: 'MANUAL', error: 'Teste disponível apenas para e-mail.' };
  if (!emailConfigurado()) return { ok: false, code: 'NO_SMTP', error: 'SMTP não configurado. Defina SMTP_USER/SMTP_PASS.' };
  const vars = { nome: 'Você', evento: 'seu evento', empresa: empresa || '' };
  // Para o teste, usa um envioId fictício de pré-visualização (tracking inócuo).
  const html = renderEmailCampanha({ corpo: camp.corpo, vars, empresa: empresa || '', envioId: 'preview' });
  const subject = '[TESTE] ' + (interpolar(camp.assunto || camp.nome, vars) || camp.nome);
  try {
    const r = await sendEmail({ to: destino, subject, html });
    return r.ok ? { ok: true } : { ok: false, code: 'NO_SMTP', error: 'Falha ao enviar (SMTP).' };
  } catch (e) {
    return { ok: false, error: String((e as Error).message || e) };
  }
}

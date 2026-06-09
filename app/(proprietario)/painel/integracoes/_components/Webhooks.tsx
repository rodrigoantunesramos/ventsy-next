'use client';

// Webhooks de saída: o dono assina eventos do sistema e a Ventsy entrega numa URL
// dele, com assinatura HMAC (header x-ventsy-signature) e retentativa em falha.
// O segredo de assinatura aparece UMA vez (ao criar). Lista + log de entregas.

import { useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { EVENTOS_WEBHOOK, eventoWebhookLabel } from '@/lib/integracoes';
import type { Webhook, WebhookLog } from '../_lib';
import { criarWebhook, patchWebhook, deletarWebhook, testarWebhook } from '../_lib';
import { Ico, Chip, Field, Modal, Toggle, CopyBox, EmptyHint, inp, btnPrimary, btnGhost } from './ui';

type Props = { webhooks: Webhook[]; log: WebhookLog[]; recarregar: () => Promise<void> };

export default function Webhooks({ webhooks, log, recarregar }: Props) {
  const toast = useToast();
  const [novo, setNovo] = useState(false);
  const [revelado, setRevelado] = useState<{ url: string; segredo: string } | null>(null);
  const [busy, setBusy] = useState('');

  const toggle = async (w: Webhook) => {
    try { await patchWebhook(w.id, { ativo: !w.ativo }); await recarregar(); }
    catch (e) { toast.error((e as Error).message); }
  };
  const testar = async (w: Webhook) => {
    setBusy(w.id);
    try {
      const r = await testarWebhook(w.id);
      r.ok ? toast.success(`Entrega de teste OK (HTTP ${r.status}).`) : toast.error(`Falha na entrega (HTTP ${r.status || 'sem resposta'}).`);
      await recarregar();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  };
  const remover = async (w: Webhook) => {
    if (!confirm(`Excluir o webhook de "${eventoWebhookLabel(w.evento)}"?`)) return;
    setBusy(w.id);
    try { await deletarWebhook(w.id); toast.success('Webhook excluído.'); await recarregar(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-muted">
          Receba eventos do sistema em tempo real numa URL sua. Cada entrega vai assinada (HMAC-SHA256 no header <code className="rounded bg-black/[0.06] px-1 text-xs">x-ventsy-signature</code>) e é retentada em falha.
        </p>
        <button onClick={() => setNovo(true)} className={btnPrimary}><Ico name="plus" className="h-4 w-4" />Novo webhook</button>
      </div>

      {revelado && (
        <div className="space-y-1.5">
          <CopyBox valor={revelado.segredo} label={`Segredo de assinatura para ${revelado.url}`} />
        </div>
      )}

      {webhooks.length === 0 ? (
        <EmptyHint>Nenhum webhook ainda. Crie um para integrar com Zapier, Make, n8n ou seu próprio servidor.</EmptyHint>
      ) : (
        <div className="space-y-2">
          {webhooks.map((w) => (
            <div key={w.id} className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-card sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Chip className="bg-brand-50 text-brand"><Ico name="webhook" className="h-3.5 w-3.5" />{eventoWebhookLabel(w.evento)}</Chip>
                  {typeof w.ultimo_status === 'number' && (
                    <Chip className={w.ultimo_status >= 200 && w.ultimo_status < 300 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                      HTTP {w.ultimo_status || '—'}
                    </Chip>
                  )}
                </div>
                <div className="mt-1 truncate text-xs text-ink-muted">{w.url}</div>
                <div className="mt-0.5 text-[0.7rem] text-ink-muted">
                  segredo •••• {w.segredo_last4}{w.ultimo_em && <> · última entrega {formatDateTime(w.ultimo_em)}</>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Toggle checked={w.ativo} onChange={() => toggle(w)} />
                <button disabled={busy === w.id} onClick={() => testar(w)} className={btnGhost + ' !py-2'}><Ico name="refresh" className="h-4 w-4" />Testar</button>
                <button disabled={busy === w.id} onClick={() => remover(w)} className={btnGhost + ' !py-2 !text-red-600'} aria-label="Excluir"><Ico name="trash" className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <LogEntregas log={log} />

      {novo && (
        <NovoWebhook
          onClose={() => setNovo(false)}
          onCriado={async (url, segredo) => { setNovo(false); setRevelado({ url, segredo }); await recarregar(); }}
        />
      )}
    </div>
  );
}

function LogEntregas({ log }: { log: WebhookLog[] }) {
  if (log.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 mt-6 text-sm font-bold text-ink-soft">Entregas recentes</h3>
      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-black/[0.06] text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-semibold">Quando</th>
              <th className="px-3 py-2 font-semibold">Evento</th>
              <th className="px-3 py-2 font-semibold">Tentativa</th>
              <th className="px-3 py-2 font-semibold">Resultado</th>
              <th className="hidden px-3 py-2 font-semibold sm:table-cell">Próxima tentativa</th>
            </tr>
          </thead>
          <tbody>
            {log.map((l) => (
              <tr key={l.id} className="border-b border-black/[0.03] last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-ink-muted">{formatDateTime(l.criado_em)}</td>
                <td className="px-3 py-2 text-ink-soft">{eventoWebhookLabel(l.evento)}</td>
                <td className="px-3 py-2 text-ink-muted">#{l.tentativa}</td>
                <td className="px-3 py-2">
                  <Chip className={l.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}>
                    <Ico name={l.ok ? 'check' : 'x'} className="h-3 w-3" />{l.ok ? `HTTP ${l.http_status}` : (l.erro || `HTTP ${l.http_status || '—'}`)}
                  </Chip>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2 text-ink-muted sm:table-cell">{l.proxima_tentativa_em ? formatDateTime(l.proxima_tentativa_em) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NovoWebhook({ onClose, onCriado }: { onClose: () => void; onCriado: (url: string, segredo: string) => void }) {
  const toast = useToast();
  const [evento, setEvento] = useState(EVENTOS_WEBHOOK[0].v);
  const [url, setUrl] = useState('');
  const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);

  const grupos = useMemo(() => {
    const map = new Map<string, typeof EVENTOS_WEBHOOK>();
    for (const e of EVENTOS_WEBHOOK) { const arr = map.get(e.grupo) || []; arr.push(e); map.set(e.grupo, arr); }
    return Array.from(map.entries());
  }, []);

  const criar = async () => {
    if (!/^https:\/\/.+/i.test(url.trim())) { toast.error('Informe uma URL https válida.'); return; }
    setSaving(true);
    try {
      const r = await criarWebhook(evento, url.trim(), descricao.trim());
      toast.success('Webhook criado.');
      onCriado(r.webhook.url, r.segredo);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title="Novo webhook"
      onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={criar} disabled={saving} className={btnPrimary}>{saving ? 'Criando…' : 'Criar'}</button></>}
    >
      <div className="space-y-3.5">
        <Field label="Evento">
          <select className={inp} value={evento} onChange={(e) => setEvento(e.target.value)}>
            {grupos.map(([grupo, itens]) => (
              <optgroup key={grupo} label={grupo}>
                {itens.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field label="URL de destino" hint="Receberá um POST JSON assinado a cada ocorrência do evento.">
          <input className={inp} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://seu-servidor.com/webhooks/ventsy" autoComplete="off" />
        </Field>
        <Field label="Descrição (opcional)">
          <input className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: notifica meu CRM" />
        </Field>
      </div>
    </Modal>
  );
}

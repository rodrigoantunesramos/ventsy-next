'use client';

// Chaves de API do dono — para integrações próprias (Zapier/Make/n8n). Guardamos
// só o HASH no servidor; o token completo aparece UMA vez, ao gerar. Lista com
// escopos, limite e revogação.

import { useState } from 'react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { ESCOPOS_API, mascararChave } from '@/lib/integracoes';
import type { ApiKey } from '../_lib';
import { criarChave, revogarChave } from '../_lib';
import { Ico, Chip, Field, Modal, CopyBox, EmptyHint, inp, btnPrimary, btnGhost } from './ui';

type Props = { chaves: ApiKey[]; recarregar: () => Promise<void> };

export default function Chaves({ chaves, recarregar }: Props) {
  const toast = useToast();
  const [nova, setNova] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState('');

  const revogar = async (k: ApiKey) => {
    if (!confirm(`Revogar a chave "${k.nome}"? Integrações que a usam deixarão de funcionar imediatamente.`)) return;
    setBusy(k.id);
    try { await revogarChave(k.id); toast.success('Chave revogada.'); await recarregar(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-ink-muted">
          Gere chaves para automações próprias chamarem a API da Ventsy. Trate-as como senha — concedem acesso conforme os escopos.
        </p>
        <button onClick={() => setNova(true)} className={btnPrimary}><Ico name="plus" className="h-4 w-4" />Nova chave</button>
      </div>

      {token && <CopyBox valor={token} label="Sua nova chave de API" />}

      {chaves.length === 0 ? (
        <EmptyHint>Nenhuma chave gerada. Crie uma para conectar ferramentas externas com segurança.</EmptyHint>
      ) : (
        <div className="space-y-2">
          {chaves.map((k) => (
            <div key={k.id} className="flex flex-col gap-2 rounded-2xl border border-black/[0.06] bg-white p-3.5 shadow-card sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-black/[0.04] text-ink-soft"><Ico name="key" className="h-4 w-4" /></span>
                  <span className="text-sm font-semibold text-ink">{k.nome}</span>
                  {k.revogada && <Chip className="bg-red-50 text-red-700">Revogada</Chip>}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <code className="rounded bg-black/[0.04] px-1.5 py-0.5 text-[0.7rem] text-ink-soft">{mascararChave(k.prefixo, k.last4)}</code>
                  {k.escopos.map((s) => <Chip key={s} className="bg-sky-50 text-sky-700">{ESCOPOS_API.find((e) => e.v === s)?.label || s}</Chip>)}
                  {k.rate_limit && <span className="text-[0.7rem] text-ink-muted">{k.rate_limit} req/min</span>}
                </div>
                <div className="mt-0.5 text-[0.7rem] text-ink-muted">Criada em {formatDate(k.criado_em)}{k.ultimo_uso && <> · último uso {formatDate(k.ultimo_uso)}</>}</div>
              </div>
              {!k.revogada && (
                <button disabled={busy === k.id} onClick={() => revogar(k)} className={btnGhost + ' !py-2 !text-red-600'}><Ico name="trash" className="h-4 w-4" />Revogar</button>
              )}
            </div>
          ))}
        </div>
      )}

      {nova && (
        <NovaChave
          onClose={() => setNova(false)}
          onCriada={async (t) => { setNova(false); setToken(t); await recarregar(); }}
        />
      )}
    </div>
  );
}

function NovaChave({ onClose, onCriada }: { onClose: () => void; onCriada: (token: string) => void }) {
  const toast = useToast();
  const [nome, setNome] = useState('');
  const [escopos, setEscopos] = useState<string[]>(['leitura']);
  const [rate, setRate] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleEscopo = (v: string) => setEscopos((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));

  const criar = async () => {
    if (!nome.trim()) { toast.error('Dê um nome para a chave.'); return; }
    if (escopos.length === 0) { toast.error('Selecione ao menos um escopo.'); return; }
    setSaving(true);
    try {
      const r = await criarChave(nome.trim(), escopos, rate.trim() ? Number(rate) : null);
      toast.success('Chave gerada.');
      onCriada(r.token);
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title="Nova chave de API"
      onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={criar} disabled={saving} className={btnPrimary}>{saving ? 'Gerando…' : 'Gerar chave'}</button></>}
    >
      <div className="space-y-3.5">
        <Field label="Nome">
          <input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Integração Zapier" autoComplete="off" />
        </Field>
        <Field label="Escopos">
          <div className="space-y-2">
            {ESCOPOS_API.map((e) => (
              <label key={e.v} className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/10 px-3 py-2.5 hover:bg-black/[0.02]">
                <input type="checkbox" checked={escopos.includes(e.v)} onChange={() => toggleEscopo(e.v)} className="mt-0.5 h-4 w-4 accent-brand" />
                <span><span className="block text-sm font-medium text-ink-soft">{e.label}</span><span className="block text-xs text-ink-muted">{e.descricao}</span></span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Limite de requisições (opcional)" hint="Por minuto. Em branco = sem limite definido.">
          <input className={inp} type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="ex.: 120" />
        </Field>
      </div>
    </Modal>
  );
}

'use client';

// Modal de TAXA / adicional (limpeza, segurança, caução, hora extra…).
// Marcável como obrigatória (entra sempre no total) e reembolsável (ex.: caução).

import { useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { getFormatPrefs } from '@/lib/format';
import type { Taxa, TaxaTipo } from '@/lib/pricing';
import { TAXAS_TIPOS, TAXAS_SUGESTOES, inp } from '../_lib';
import type { Propriedade } from '../_lib';
import { ModalShell, Field, MoneyInput, PrimaryBtn, GhostBtn, Icon } from './ui';

export function TaxaModal({
  userId, editando, propriedades, onClose, onSaved,
}: {
  userId: string;
  editando: Taxa | null;
  propriedades: Propriedade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [tipo, setTipo] = useState<TaxaTipo>(editando?.tipo ?? 'fixo');
  const [valor, setValor] = useState(editando ? String(editando.valor) : '');
  const [prop, setProp] = useState<string>(editando?.propriedade_id != null ? String(editando.propriedade_id) : '');
  const [obrigatoria, setObrigatoria] = useState(editando?.obrigatoria ?? false);
  const [reembolsavel, setReembolsavel] = useState(editando?.reembolsavel ?? false);
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const moeda = getFormatPrefs().currency;

  async function salvar() {
    if (!nome.trim()) { toast.error('Dê um nome à taxa.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId,
      propriedade_id: prop ? Number(prop) : null,
      nome: nome.trim(),
      tipo,
      valor: Number(valor) || 0,
      obrigatoria,
      reembolsavel,
      ativo,
    };
    const { error } = editando
      ? await sb.from('taxas').update(payload).eq('id', editando.id)
      : await sb.from('taxas').insert(payload);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar a taxa.'); return; }
    toast.success(editando ? 'Taxa atualizada!' : 'Taxa criada!');
    onSaved();
  }

  return (
    <ModalShell
      title={editando ? 'Editar taxa' : 'Nova taxa / adicional'}
      subtitle="Limpeza, segurança, energia, caução, hora extra…"
      icon={<Icon name="receipt" size={18} />}
      onClose={onClose}
      footer={<>
        <PrimaryBtn onClick={salvar} disabled={saving || !nome.trim()}>{saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar taxa'}</PrimaryBtn>
        <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
      </>}
    >
      <div className="space-y-4">
        <Field label="Nome">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} autoFocus placeholder="Ex.: Taxa de limpeza" />
        </Field>
        {!editando && (
          <div className="-mt-1 flex flex-wrap gap-1.5">
            {TAXAS_SUGESTOES.map((s) => (
              <button key={s} type="button" onClick={() => setNome(s)} className="rounded-full bg-black/[0.04] px-2.5 py-1 text-xs font-medium text-ink-muted hover:bg-brand-50 hover:text-brand">+ {s}</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cobrança">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TaxaTipo)} className={inp}>
              {TAXAS_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </Field>
          <Field label="Valor">
            {tipo === 'percentual' ? (
              <div className="relative">
                <input type="number" step="0.1" value={valor} onChange={(e) => setValor(e.target.value)} className={`${inp} pr-8`} placeholder="10" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">%</span>
              </div>
            ) : (
              <MoneyInput value={valor} onChange={setValor} moeda={moeda} />
            )}
          </Field>
        </div>
        <Field label="Espaço" hint="Vazio = vale para todos os espaços.">
          <select value={prop} onChange={(e) => setProp(e.target.value)} className={inp}>
            <option value="">Todos os espaços</option>
            {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-1 gap-2 rounded-xl border border-black/[0.06] bg-black/[0.015] p-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={obrigatoria} onChange={(e) => setObrigatoria(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
            <span className="text-sm font-medium text-ink-soft">Obrigatória <span className="font-normal text-ink-muted">(entra sempre)</span></span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={reembolsavel} onChange={(e) => setReembolsavel(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
            <span className="text-sm font-medium text-ink-soft">Reembolsável <span className="font-normal text-ink-muted">(ex.: caução)</span></span>
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
          <span className="text-sm font-medium text-ink-soft">Taxa ativa</span>
        </label>
      </div>
    </ModalShell>
  );
}

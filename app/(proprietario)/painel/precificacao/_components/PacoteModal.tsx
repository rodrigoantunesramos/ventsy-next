'use client';

// Modal de PACOTE — combo de preço fechado (espaço + serviços inclusos).
// Os itens são descritivos (com valor de referência opcional); o preço de
// venda é o `valor_num` (fechado), com sugestão = soma dos itens.

import { useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatMoney, getFormatPrefs } from '@/lib/format';
import { inp } from '../_lib';
import type { Pacote, PacoteItem, Propriedade } from '../_lib';
import { ModalShell, Field, MoneyInput, PrimaryBtn, GhostBtn, Icon } from './ui';

export function PacoteModal({
  userId, editando, propriedades, onClose, onSaved,
}: {
  userId: string;
  editando: Pacote | null;
  propriedades: Propriedade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');
  const [prop, setProp] = useState<string>(editando?.propriedade_id != null ? String(editando.propriedade_id) : '');
  const [itens, setItens] = useState<PacoteItem[]>(editando?.itens?.length ? editando.itens : [{ descricao: '' }]);
  const [valor, setValor] = useState(editando ? String(editando.valor_num) : '');
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const moeda = getFormatPrefs().currency;

  const soma = itens.reduce((s, i) => s + (Number(i.valor_num) || 0), 0);

  function setItem(i: number, p: Partial<PacoteItem>) { setItens((arr) => arr.map((x, j) => (j === i ? { ...x, ...p } : x))); }
  function addItem() { setItens((arr) => [...arr, { descricao: '' }]); }
  function delItem(i: number) { setItens((arr) => (arr.length > 1 ? arr.filter((_, j) => j !== i) : arr)); }

  async function salvar() {
    if (!nome.trim()) { toast.error('Dê um nome ao pacote.'); return; }
    setSaving(true);
    const itensLimpos = itens
      .filter((i) => i.descricao.trim())
      .map((i) => ({ descricao: i.descricao.trim(), ...(i.valor_num != null && String(i.valor_num) !== '' ? { valor_num: Number(i.valor_num) || 0 } : {}) }));
    const payload = {
      usuario_id: userId,
      propriedade_id: prop ? Number(prop) : null,
      nome: nome.trim(),
      descricao: descricao.trim() || null,
      itens: itensLimpos,
      valor_num: Number(valor) || 0,
      ativo,
    };
    const { error } = editando
      ? await sb.from('pacotes').update(payload).eq('id', editando.id)
      : await sb.from('pacotes').insert(payload);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar o pacote.'); return; }
    toast.success(editando ? 'Pacote atualizado!' : 'Pacote criado!');
    onSaved();
  }

  return (
    <ModalShell
      title={editando ? 'Editar pacote' : 'Novo pacote'}
      subtitle="Combo com preço fechado (espaço + serviços)."
      icon={<Icon name="box" size={18} />}
      onClose={onClose}
      wide
      footer={<>
        <PrimaryBtn onClick={salvar} disabled={saving || !nome.trim()}>{saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar pacote'}</PrimaryBtn>
        <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
      </>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Nome do pacote">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} autoFocus placeholder="Ex.: Casamento Completo" />
          </Field>
          <Field label="Espaço" hint="Opcional.">
            <select value={prop} onChange={(e) => setProp(e.target.value)} className={inp}>
              <option value="">Nenhum / vários</option>
              {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Descrição" hint="Opcional.">
          <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={inp} placeholder="O que está incluso, condições…" />
        </Field>

        {/* Itens inclusos */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-soft">Itens inclusos</span>
            <button type="button" onClick={addItem} className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><Icon name="plus" size={12} /> Adicionar item</button>
          </div>
          <div className="space-y-2">
            {itens.map((it, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={it.descricao} onChange={(e) => setItem(i, { descricao: e.target.value })} className={`${inp} flex-1`} placeholder="Ex.: Buffet para 100 pessoas" />
                <div className="w-32 shrink-0">
                  <MoneyInput value={it.valor_num != null ? String(it.valor_num) : ''} onChange={(v) => setItem(i, { valor_num: v === '' ? undefined : Number(v) })} moeda={moeda} placeholder="—" />
                </div>
                <button type="button" onClick={() => delItem(i)} aria-label="Remover item" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
          {soma > 0 && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-2 text-xs">
              <span className="text-ink-muted">Soma dos itens (referência)</span>
              <span className="flex items-center gap-2 font-semibold text-ink-soft">
                {formatMoney(soma, { currency: moeda })}
                {String(Number(valor)) !== String(soma) && <button type="button" onClick={() => setValor(String(soma))} className="text-brand hover:underline">usar como preço</button>}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
          <Field label="Preço do pacote (fechado)">
            <MoneyInput value={valor} onChange={setValor} moeda={moeda} />
          </Field>
          <label className="flex cursor-pointer items-center gap-2 pb-2.5">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
            <span className="text-sm font-medium text-ink-soft">Pacote ativo</span>
          </label>
        </div>
      </div>
    </ModalShell>
  );
}

'use client';

// Modal de criação/edição de uma TABELA de preço (valor base + unidade por
// espaço). Autossuficiente: persiste via supabase e avisa a página por
// onSaved(). Sem "R$" hardcoded — valores via MoneyInput (moeda da tabela).

import { useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import type { Currency } from '@/lib/format';
import type { Base, PrecoTabela } from '@/lib/pricing';
import { BASES, BASE_BY, inp } from '../_lib';
import type { Propriedade } from '../_lib';
import { ModalShell, Field, MoneyInput, PrimaryBtn, GhostBtn, Icon } from './ui';
import { MOEDAS } from '@/lib/prefs';

export function TabelaModal({
  userId, editando, propriedades, onClose, onSaved,
}: {
  userId: string;
  editando: PrecoTabela | null;
  propriedades: Propriedade[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [prop, setProp] = useState<string>(editando?.propriedade_id != null ? String(editando.propriedade_id) : '');
  const [base, setBase] = useState<Base>(editando?.base ?? 'diaria');
  const [moeda, setMoeda] = useState<Currency>(editando?.moeda ?? 'BRL');
  const [valor, setValor] = useState(editando ? String(editando.valor_base_num) : '');
  const [custo, setCusto] = useState(editando?.custo_num != null ? String(editando.custo_num) : '');
  const [concorr, setConcorr] = useState(editando?.concorrencia_num != null ? String(editando.concorrencia_num) : '');
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!nome.trim()) { toast.error('Dê um nome à tabela.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId,
      propriedade_id: prop ? Number(prop) : null,
      nome: nome.trim(),
      base,
      valor_base_num: Number(valor) || 0,
      moeda,
      custo_num: custo ? Number(custo) : null,
      concorrencia_num: concorr ? Number(concorr) : null,
      ativo,
    };
    const { error } = editando
      ? await sb.from('precos_tabela').update(payload).eq('id', editando.id)
      : await sb.from('precos_tabela').insert(payload);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar a tabela.'); return; }
    toast.success(editando ? 'Tabela atualizada!' : 'Tabela criada!');
    onSaved();
  }

  return (
    <ModalShell
      title={editando ? 'Editar tabela de preço' : 'Nova tabela de preço'}
      subtitle="Defina o valor base e como o espaço é cobrado."
      icon={<Icon name="tag" size={18} />}
      onClose={onClose}
      footer={<>
        <PrimaryBtn onClick={salvar} disabled={saving || !nome.trim()}>{saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar tabela'}</PrimaryBtn>
        <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
      </>}
    >
      <div className="space-y-4">
        <Field label="Nome da tabela">
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} autoFocus placeholder="Ex.: Salão Principal — Locação" />
        </Field>
        <Field label="Espaço" hint="Vincule a uma propriedade ou deixe como padrão da conta.">
          <select value={prop} onChange={(e) => setProp(e.target.value)} className={inp}>
            <option value="">Padrão da conta (todos os espaços)</option>
            {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cobrança">
            <select value={base} onChange={(e) => setBase(e.target.value as Base)} className={inp}>
              {BASES.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
            </select>
          </Field>
          <Field label="Moeda">
            <select value={moeda} onChange={(e) => setMoeda(e.target.value as Currency)} className={inp}>
              {MOEDAS.map((m) => <option key={m.v} value={m.v}>{m.simbolo} {m.v}</option>)}
            </select>
          </Field>
        </div>
        <p className="-mt-2 rounded-lg bg-black/[0.02] px-3 py-2 text-xs text-ink-muted">{BASE_BY[base].hint}</p>
        <Field label={`Valor base (${BASE_BY[base].sufixo.replace('/ ', 'por ')})`}>
          <MoneyInput value={valor} onChange={setValor} moeda={moeda} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Custo de referência" hint="Opcional — calcula a margem no Simulador.">
            <MoneyInput value={custo} onChange={setCusto} moeda={moeda} />
          </Field>
          <Field label="Preço da concorrência" hint="Opcional — comparação manual.">
            <MoneyInput value={concorr} onChange={setConcorr} moeda={moeda} />
          </Field>
        </div>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
          <span className="text-sm font-medium text-ink-soft">Tabela ativa</span>
        </label>
      </div>
    </ModalShell>
  );
}

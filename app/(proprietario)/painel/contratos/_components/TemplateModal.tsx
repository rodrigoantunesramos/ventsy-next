'use client';

// Editor de MODELO de contrato (/painel/contratos · aba Modelos).
// Define nome, tipo de evento, corpo (markdown-lite com {{variáveis}}) e a lista
// de cláusulas. Variáveis entram por chips (inserção no cursor). A IA (opcional,
// via /api/contratos/ai) rascunha o corpo ou uma cláusula. Grava em
// contratos_templates (RLS por dono). Sem "R$" hardcoded.

import { useRef, useState } from 'react';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  VAR_DEFS, CLAUSULAS_PRESET, templatePadrao, TIPOS_EVENTO,
  type ContratoTemplate, type Clausula,
} from '@/lib/contracts';
import { Icon, ModalShell, Field, inp, PrimaryBtn, GhostBtn } from './ui';

// Agrupa as variáveis por grupo para a paleta.
const GRUPOS = [...new Set(VAR_DEFS.map((v) => v.grupo))];

export function TemplateModal({
  userId, editando, onClose, onSaved,
}: {
  userId: string; editando: ContratoTemplate | null; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const base = editando ?? templatePadrao();
  const [nome, setNome] = useState(editando?.nome ?? base.nome);
  const [tipo, setTipo] = useState<string>(editando?.tipo_evento ?? '');
  const [corpo, setCorpo] = useState(editando?.corpo ?? base.corpo);
  const [clausulas, setClausulas] = useState<Clausula[]>(editando?.clausulas ?? (base.clausulas as Clausula[]));
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [saving, setSaving] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  function inserirVar(token: string) {
    const ta = corpoRef.current;
    const marca = `{{${token}}}`;
    if (!ta) { setCorpo((c) => c + marca); return; }
    const start = ta.selectionStart ?? corpo.length;
    const end = ta.selectionEnd ?? corpo.length;
    const next = corpo.slice(0, start) + marca + corpo.slice(end);
    setCorpo(next);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = start + marca.length; });
  }

  async function gerarCorpoIA() {
    setAiBusy(true);
    try {
      const res = await fetch('/api/contratos/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ action: 'template', tipo_evento: tipo }),
      });
      const j = await res.json();
      if (j.code === 'NO_KEY') { toast.info('IA não configurada (AI_GATEWAY_API_KEY). Editor segue manual.'); return; }
      if (!res.ok || !j.text) { toast.error(j.error || 'Falha na IA.'); return; }
      setCorpo(j.text);
      toast.success('Rascunho gerado. Revise antes de salvar.');
    } catch { toast.error('Falha na IA.'); } finally { setAiBusy(false); }
  }

  function addClausulaPreset(chave: string) {
    const preset = CLAUSULAS_PRESET.find((c) => c.chave === chave);
    if (!preset) return;
    if (clausulas.some((c) => c.chave === preset.chave)) { toast.info('Essa cláusula já está no modelo.'); return; }
    setClausulas((a) => [...a, { ...preset }]);
  }
  function addClausulaVazia() {
    setClausulas((a) => [...a, { chave: `custom_${a.length + 1}_${Math.floor(performance.now())}`, titulo: 'Nova cláusula', texto: '' }]);
  }
  function updateClausula(i: number, patch: Partial<Clausula>) { setClausulas((a) => a.map((c, idx) => (idx === i ? { ...c, ...patch } : c))); }
  function removeClausula(i: number) { setClausulas((a) => a.filter((_, idx) => idx !== i)); }
  function moveClausula(i: number, dir: -1 | 1) {
    setClausulas((a) => {
      const j = i + dir; if (j < 0 || j >= a.length) return a;
      const next = [...a]; [next[i], next[j]] = [next[j], next[i]]; return next;
    });
  }

  async function salvar() {
    if (!nome.trim()) { toast.error('Dê um nome ao modelo.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId, nome: nome.trim(), tipo_evento: tipo || null,
      corpo, clausulas, ativo,
    };
    const q = editando
      ? sb.from('contratos_templates').update(payload).eq('id', editando.id)
      : sb.from('contratos_templates').insert(payload);
    const { error } = await q;
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar o modelo.'); return; }
    toast.success(editando ? 'Modelo atualizado.' : 'Modelo criado.');
    onSaved();
  }

  return (
    <ModalShell
      size="xl" onClose={onClose} icon={<Icon name="layers" size={18} />}
      title={editando ? 'Editar modelo' : 'Novo modelo de contrato'}
      subtitle="Use variáveis {{...}} — elas serão preenchidas ao gerar cada contrato."
      footer={<><GhostBtn onClick={onClose}>Cancelar</GhostBtn><PrimaryBtn onClick={salvar} disabled={saving}>{saving ? 'Salvando…' : 'Salvar modelo'}</PrimaryBtn></>}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome do modelo"><input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} placeholder="Locação — Casamento" autoFocus /></Field>
        <Field label="Tipo de evento" hint="Ajuda a sugerir o modelo certo ao gerar.">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>
            <option value="">Genérico</option>
            {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      {/* Corpo */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink-soft">Corpo do contrato</span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowVars((v) => !v)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-brand"><Icon name="plus" size={12} /> Variáveis</button>
            <button onClick={gerarCorpoIA} disabled={aiBusy} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-brand disabled:opacity-50"><Icon name="sparkles" size={12} /> {aiBusy ? 'Gerando…' : 'Gerar com IA'}</button>
          </div>
        </div>
        {showVars && (
          <div className="mb-2 max-h-44 overflow-y-auto rounded-xl border border-black/[0.06] bg-[#fafafa] p-2.5">
            {GRUPOS.map((g) => (
              <div key={g} className="mb-2 last:mb-0">
                <div className="mb-1 text-[0.62rem] font-bold uppercase tracking-wide text-ink-muted/70">{g}</div>
                <div className="flex flex-wrap gap-1">
                  {VAR_DEFS.filter((v) => v.grupo === g).map((v) => (
                    <button key={v.token} onClick={() => inserirVar(v.token)} title={`{{${v.token}}}`} className="rounded-md border border-black/10 bg-white px-2 py-1 text-[0.68rem] font-medium text-ink-soft transition hover:border-brand/40 hover:text-brand">{v.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <textarea ref={corpoRef} value={corpo} onChange={(e) => setCorpo(e.target.value)} rows={9} className={`${inp} font-mono text-[0.8rem] leading-relaxed`} placeholder="# CONTRATO…&#10;Use # título, ## cláusula, - lista, **negrito** e {{variáveis}}." />
      </div>

      {/* Cláusulas */}
      <div className="mt-5">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-ink-soft">Cláusulas ({clausulas.length})</span>
          <div className="flex items-center gap-1.5">
            <select onChange={(e) => { if (e.target.value) { addClausulaPreset(e.target.value); e.target.value = ''; } }} className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none" defaultValue="">
              <option value="" disabled>+ Cláusula da biblioteca</option>
              {CLAUSULAS_PRESET.map((c) => <option key={c.chave} value={c.chave}>{c.titulo}</option>)}
            </select>
            <button onClick={addClausulaVazia} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-brand"><Icon name="plus" size={12} /> Em branco</button>
          </div>
        </div>
        {clausulas.length === 0
          ? <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-xs text-ink-muted">Sem cláusulas. Adicione da biblioteca (multa, caução, cancelamento, força maior, LGPD…) ou em branco.</p>
          : (
            <div className="space-y-2">
              {clausulas.map((c, i) => (
                <div key={c.chave} className="rounded-xl border border-black/[0.08] bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-[0.7rem] font-bold text-brand">{i + 1}</span>
                    <input value={c.titulo} onChange={(e) => updateClausula(i, { titulo: e.target.value })} className="flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none" placeholder="Título da cláusula" />
                    <button onClick={() => moveClausula(i, -1)} disabled={i === 0} title="Subir" className="rounded p-1 text-ink-muted hover:text-brand disabled:opacity-30">↑</button>
                    <button onClick={() => moveClausula(i, 1)} disabled={i === clausulas.length - 1} title="Descer" className="rounded p-1 text-ink-muted hover:text-brand disabled:opacity-30">↓</button>
                    <button onClick={() => removeClausula(i)} title="Remover" className="rounded p-1 text-ink-muted hover:text-red-600"><Icon name="trash" size={13} /></button>
                  </div>
                  <textarea value={c.texto} onChange={(e) => updateClausula(i, { texto: e.target.value })} rows={2} className="w-full rounded-lg border border-black/10 px-2.5 py-2 text-[0.8rem] leading-relaxed focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" placeholder="Texto da cláusula (pode usar {{variáveis}})." />
                </div>
              ))}
            </div>
          )}
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
        Modelo ativo (disponível ao gerar contratos)
      </label>
    </ModalShell>
  );
}

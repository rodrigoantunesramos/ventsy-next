'use client';

// Aba "Freelancers" — banco reutilizável de diaristas por função (garçom,
// segurança, recepção, montador…). CRUD direto via RLS (tabela `freelancers`).
// Diária, função, avaliação e chave PIX alimentam a convocação (aba Escala) e o
// pagamento (aba Apuração). Sem "R$" hardcoded — tudo via lib/format.

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { FUNCOES, funcaoLabel, funcaoCor, type Freelancer } from '@/lib/ponto';
import { type PontoBag, SEL_FREELANCER, mapFreelancer, inp, selCls } from '../_lib';
import { Kpi, ModalShell, Campo, EmptyState, Estrelas, IcoUser, IcoPlus, IcoEdit, IcoTrash, IcoSearch, IcoStar } from './ui';

type FormState = {
  nome: string; funcao: string; contato: string; email: string;
  valor_diaria_num: string; avaliacao: string; doc: string; chave_pix: string; ativo: boolean; obs: string;
};
const EMPTY: FormState = { nome: '', funcao: 'garcom', contato: '', email: '', valor_diaria_num: '', avaliacao: '', doc: '', chave_pix: '', ativo: true, obs: '' };

export default function Freelancers({ bag }: { bag: PontoBag }) {
  const toast = useToast();
  const { userId, freelancers, alocacoes, recarregar } = bag;

  const [busca, setBusca] = useState('');
  const [fFuncao, setFFuncao] = useState('');
  const [incluirInativos, setIncluirInativos] = useState(false);
  const [modal, setModal] = useState<{ editing: Freelancer | null } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  // nº de convocações por freelancer (histórico) — para o KPI/insight.
  const convocacoesPorFreela = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of alocacoes) if (a.freelancer_id) m.set(a.freelancer_id, (m.get(a.freelancer_id) || 0) + 1);
    return m;
  }, [alocacoes]);

  const kpis = useMemo(() => {
    const ativos = freelancers.filter((f) => f.ativo);
    const comDiaria = ativos.filter((f) => f.valor_diaria_num > 0);
    const diariaMedia = comDiaria.length ? comDiaria.reduce((s, f) => s + f.valor_diaria_num, 0) / comDiaria.length : 0;
    const funcoes = new Set(ativos.map((f) => f.funcao)).size;
    return { total: freelancers.length, ativos: ativos.length, diariaMedia, funcoes };
  }, [freelancers]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return freelancers
      .filter((f) => (incluirInativos ? true : f.ativo))
      .filter((f) => (fFuncao ? f.funcao === fFuncao : true))
      .filter((f) => (q ? `${f.nome} ${f.contato || ''} ${f.email || ''}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [freelancers, busca, fFuncao, incluirInativos]);

  async function salvar(form: FormState, editing: Freelancer | null) {
    if (!form.nome.trim()) { toast.error('Informe o nome do freelancer.'); return false; }
    const payload = {
      usuario_id: userId, nome: form.nome.trim(), funcao: form.funcao,
      contato: form.contato.trim() || null, email: form.email.trim() || null,
      valor_diaria_num: form.valor_diaria_num ? Number(form.valor_diaria_num) : 0,
      avaliacao: form.avaliacao ? Math.max(0, Math.min(5, Number(form.avaliacao))) : null,
      doc: form.doc.trim() || null, chave_pix: form.chave_pix.trim() || null, ativo: form.ativo, obs: form.obs.trim() || null,
    };
    const { error } = editing
      ? await sb.from('freelancers').update(payload).eq('id', editing.id).eq('usuario_id', userId)
      : await sb.from('freelancers').insert(payload);
    if (error) { toast.error('Não foi possível salvar o freelancer.'); return false; }
    toast.success(editing ? 'Freelancer atualizado.' : 'Freelancer cadastrado.');
    await recarregar();
    return true;
  }

  async function excluir(f: Freelancer) {
    const key = `del:${f.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const { error } = await sb.from('freelancers').delete().eq('id', f.id).eq('usuario_id', userId);
    if (error) { toast.error('Há convocações vinculadas — desative em vez de excluir.'); return; }
    toast.success('Freelancer removido.');
    await recarregar();
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Freelancers" value={String(kpis.total)} sub={`${kpis.ativos} ativos`} tone="ink" icon={<IcoUser />} />
        <Kpi label="Funções cobertas" value={String(kpis.funcoes)} tone="roxo" icon={<IcoStar />} />
        <Kpi label="Diária média" value={kpis.diariaMedia > 0 ? formatMoney(kpis.diariaMedia) : '—'} tone="gold" icon={<IcoStar />} />
        <Kpi label="No banco" value={String(kpis.ativos)} sub="disponíveis p/ convocar" tone="verde" icon={<IcoUser />} />
      </div>

      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, contato…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <select value={fFuncao} onChange={(e) => setFFuncao(e.target.value)} className={selCls}>
            <option value="">Todas as funções</option>
            {FUNCOES.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </select>
          <button onClick={() => setIncluirInativos((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${incluirInativos ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Incluir inativos</button>
          <button onClick={() => setModal({ editing: null })} className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Novo freelancer</button>
        </div>

        {filtrados.length === 0 ? (
          <EmptyState icon={<IcoUser />} title="Nenhum freelancer no banco" cta={<button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"><IcoPlus /> Cadastrar freelancer</button>}>
            Monte um banco de diaristas reutilizável (garçom, segurança, recepção…). Eles aparecem para convocação ao montar a escala de um evento.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((f) => {
              const usos = convocacoesPorFreela.get(f.id) || 0;
              return (
                <div key={f.id} className={`rounded-2xl border border-black/[0.06] p-4 transition hover:border-brand/30 ${!f.ativo ? 'opacity-60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: funcaoCor(f.funcao) }}>{f.nome.slice(0, 2).toUpperCase()}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate font-bold text-ink">{f.nome}</span>
                        {!f.ativo && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">inativo</span>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                        <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: funcaoCor(f.funcao) }} />{funcaoLabel(f.funcao)}</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-ink">{f.valor_diaria_num > 0 ? formatMoney(f.valor_diaria_num) : '—'}</div>
                      <div className="text-[0.65rem] text-ink-muted">/ diária</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs">
                    <Estrelas valor={f.avaliacao} />
                    <span className="text-ink-muted">{usos > 0 ? `${usos} convocação${usos > 1 ? 'ões' : ''}` : 'sem histórico'}</span>
                  </div>
                  {(f.contato || f.chave_pix) && (
                    <div className="mt-2 space-y-0.5 border-t border-black/[0.05] pt-2 text-xs text-ink-muted">
                      {f.contato && <div className="truncate">📞 {f.contato}</div>}
                      {f.chave_pix && <div className="truncate">PIX: {f.chave_pix}</div>}
                    </div>
                  )}
                  <div className="mt-3 flex border-t border-black/[0.06] pt-2 text-xs">
                    <button onClick={() => setModal({ editing: f })} className="flex flex-1 items-center justify-center gap-1 py-1 font-semibold text-ink-soft hover:text-brand"><IcoEdit /> Editar</button>
                    <div className="w-px bg-black/[0.06]" />
                    <button onClick={() => excluir(f)} className={`flex flex-1 items-center justify-center gap-1 py-1 font-semibold ${confirmKey === `del:${f.id}` ? 'text-red-700' : 'text-red-600 hover:text-red-700'}`}><IcoTrash /> {confirmKey === `del:${f.id}` ? 'Confirmar?' : 'Excluir'}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {modal && <FreelancerModal editing={modal.editing} onClose={() => setModal(null)} onSave={salvar} />}
    </div>
  );
}

// ── Modal de cadastro/edição ──────────────────────────────────────────────────
function FreelancerModal({ editing, onClose, onSave }: { editing: Freelancer | null; onClose: () => void; onSave: (f: FormState, e: Freelancer | null) => Promise<boolean> }) {
  const [form, setForm] = useState<FormState>(editing ? {
    nome: editing.nome, funcao: String(editing.funcao), contato: editing.contato || '', email: editing.email || '',
    valor_diaria_num: editing.valor_diaria_num ? String(editing.valor_diaria_num) : '', avaliacao: editing.avaliacao != null ? String(editing.avaliacao) : '',
    doc: editing.doc || '', chave_pix: editing.chave_pix || '', ativo: editing.ativo, obs: editing.obs || '',
  } : EMPTY);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editing ? 'Editar freelancer' : 'Novo freelancer'}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" full><input className={inp} value={form.nome} onChange={(e) => set('nome', e.target.value)} autoFocus /></Campo>
        <Campo label="Função">
          <select className={inp} value={form.funcao} onChange={(e) => set('funcao', e.target.value)}>
            {FUNCOES.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
          </select>
        </Campo>
        <Campo label="Valor da diária"><input type="number" min={0} step="0.01" className={inp} value={form.valor_diaria_num} onChange={(e) => set('valor_diaria_num', e.target.value)} /></Campo>
        <Campo label="Contato / WhatsApp"><input className={inp} value={form.contato} onChange={(e) => set('contato', e.target.value)} /></Campo>
        <Campo label="E-mail"><input type="email" className={inp} value={form.email} onChange={(e) => set('email', e.target.value)} /></Campo>
        <Campo label="Avaliação (0–5)"><input type="number" min={0} max={5} step="0.5" className={inp} value={form.avaliacao} onChange={(e) => set('avaliacao', e.target.value)} /></Campo>
        <Campo label="Documento (CPF/RG)"><input className={inp} value={form.doc} onChange={(e) => set('doc', e.target.value)} /></Campo>
        <Campo label="Chave PIX" full hint="Usada ao fechar as diárias (gera a conta a pagar)."><input className={inp} value={form.chave_pix} onChange={(e) => set('chave_pix', e.target.value)} /></Campo>
        <Campo label="Observações" full><textarea className={`${inp} min-h-[64px]`} value={form.obs} onChange={(e) => set('obs', e.target.value)} /></Campo>
        <label className="flex items-center gap-2 text-sm font-medium text-ink-soft sm:col-span-2">
          <input type="checkbox" checked={form.ativo} onChange={(e) => set('ativo', e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
          Disponível para convocação (ativo)
        </label>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={async () => { setSaving(true); const ok = await onSave(form, editing); setSaving(false); if (ok) onClose(); }} disabled={saving || !form.nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

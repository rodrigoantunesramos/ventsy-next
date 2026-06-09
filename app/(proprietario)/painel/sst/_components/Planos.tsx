'use client';

// Aba Planos — /painel/sst.
// Planos de emergência/evacuação/APH/incêndio por espaço e/ou evento. Conteúdo
// editável: rotas de fuga, pontos de encontro, recursos, procedimentos e contatos
// de emergência. "Gerar do modelo" semeia procedimentos + SAMU/Bombeiros/Polícia
// (lib/sst.gerarConteudoPlano). Validade com semáforo. CRUD via RLS.

import { useCallback, useEffect, useState } from 'react';
import {
  type SstCtx, type Toast, type PlanoRow, type PlanoTipo, type PlanoConteudo,
  PLANO_TIPOS, planoTipoMeta, PLANO_STATUS_META, planoStatusMeta,
  gerarConteudoPlano, normalizarConteudo, completudePlano,
  listarPlanos, criarPlano, salvarPlano, excluirPlano, mapPlano, eventoLabel, inp, selCls,
} from '../_lib';
import {
  Ico, Chip, Barra, EmptyState, SectionCard, Modal, Field, ConfirmDelete, ValidadeBadge,
  btnPrimary, btnGhost, btnSm,
} from './ui';

type Form = {
  id?: string; tipo: PlanoTipo; nome: string; propriedade_id: string; evento_id: string;
  responsavel: string; validade: string; status: string; conteudo: PlanoConteudo; obs: string;
};
const emptyForm = (): Form => ({
  tipo: 'emergencia', nome: '', propriedade_id: '', evento_id: '', responsavel: '', validade: '',
  status: 'rascunho', conteudo: normalizarConteudo(null), obs: '',
});

export default function Planos({ ctx, toast }: { ctx: SstCtx; toast: Toast }) {
  const [rows, setRows] = useState<PlanoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Form | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listarPlanos(ctx.userId);
    setRows(error ? [] : (data || []).map(mapPlano));
    setLoading(false);
  }, [ctx.userId]);
  useEffect(() => { carregar(); }, [carregar]);

  const salvar = useCallback(async (f: Form) => {
    if (!f.nome.trim()) { toast.error('Dê um nome ao plano.'); return; }
    const payload = {
      tipo: f.tipo, nome: f.nome.trim(),
      propriedade_id: f.propriedade_id ? Number(f.propriedade_id) : null,
      evento_id: f.evento_id || null, responsavel: f.responsavel.trim() || null,
      validade: f.validade || null, status: f.status, conteudo: f.conteudo, obs: f.obs.trim() || null,
    };
    if (f.id) {
      const { data, error } = await salvarPlano(f.id, payload);
      if (error || !data) { toast.error('Não foi possível salvar.'); return; }
      setRows((rs) => rs.map((r) => (r.id === f.id ? mapPlano(data) : r)));
    } else {
      const { data, error } = await criarPlano({ usuario_id: ctx.userId, ...payload });
      if (error || !data) { toast.error('Não foi possível criar.'); return; }
      setRows((rs) => [mapPlano(data), ...rs]);
    }
    setModal(null);
    toast.success('Plano salvo.');
  }, [ctx.userId, toast]);

  const remover = useCallback(async (id: string) => {
    const { error } = await excluirPlano(id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }, [toast]);

  return (
    <div className="space-y-4">
      <SectionCard title="Planos de emergência" desc="Por espaço e por evento. Liga com Layouts (mapa) e com os contatos de emergência." icon="doc"
        actions={<button onClick={() => setModal(emptyForm())} className={btnPrimary}><Ico name="plus" size={16} /> Novo plano</button>}>
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Ico name="doc" size={22} />} title="Nenhum plano ainda">
            Crie planos de emergência, evacuação, APH e incêndio. Use <strong>Gerar do modelo</strong> para começar com procedimentos e contatos prontos.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {rows.map((r) => {
              const tm = planoTipoMeta(r.tipo); const sm = planoStatusMeta(r.status);
              const prop = ctx.propriedades.find((p) => p.id === r.propriedade_id);
              const ev = ctx.eventos.find((e) => e.id === r.evento_id);
              const comp = completudePlano(r.conteudo);
              return (
                <div key={r.id} className="rounded-xl border border-black/[0.06] bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: tm.hex + '1a', color: tm.hex }}><Ico name={tm.icone || 'doc'} size={18} /></span>
                      <div>
                        <div className="text-sm font-bold text-ink">{r.nome}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Chip className={tm.chip}>{tm.label}</Chip>
                          <Chip className={sm.chip}>{sm.label}</Chip>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setModal(toForm(r))} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><Ico name="edit" size={15} /></button>
                      <ConfirmDelete onConfirm={() => remover(r.id)} />
                    </div>
                  </div>
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.72rem] text-ink-muted">
                    {prop && <span className="inline-flex items-center gap-1"><Ico name="building" size={12} /> {prop.nome}</span>}
                    {ev && <span className="inline-flex items-center gap-1"><Ico name="calendar" size={12} /> {eventoLabel(ev)}</span>}
                    {r.responsavel && <span className="inline-flex items-center gap-1"><Ico name="users" size={12} /> {r.responsavel}</span>}
                    {r.validade && <ValidadeBadge validade={r.validade} hoje={ctx.hoje} />}
                  </div>
                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[0.7rem] text-ink-muted"><span>Completude</span><span>{Math.round(comp * 100)}%</span></div>
                    <Barra ratio={comp} tone={comp >= 0.8 ? 'ok' : comp >= 0.4 ? 'warn' : 'bad'} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {modal && <PlanoModal ctx={ctx} form={modal} onClose={() => setModal(null)} onSave={salvar} toast={toast} />}
    </div>
  );
}

function toForm(r: PlanoRow): Form {
  return {
    id: r.id, tipo: r.tipo as PlanoTipo, nome: r.nome, propriedade_id: r.propriedade_id != null ? String(r.propriedade_id) : '',
    evento_id: r.evento_id || '', responsavel: r.responsavel || '', validade: r.validade || '', status: r.status,
    conteudo: r.conteudo, obs: r.obs || '',
  };
}

// ── Modal de plano (com editor de conteúdo) ───────────────────────────────────
function PlanoModal({ ctx, form, onClose, onSave, toast }: { ctx: SstCtx; form: Form; onClose: () => void; onSave: (f: Form) => void; toast: Toast }) {
  const [f, setF] = useState<Form>(form);
  const set = (p: Partial<Form>) => setF((cur) => ({ ...cur, ...p }));
  const setC = (p: Partial<PlanoConteudo>) => setF((cur) => ({ ...cur, conteudo: { ...cur.conteudo, ...p } }));

  const gerar = () => {
    const seed = gerarConteudoPlano(f.tipo);
    // Preserva o que o usuário já escreveu; só preenche procedimentos/contatos vazios.
    setC({
      procedimentos: f.conteudo.procedimentos.length ? f.conteudo.procedimentos : seed.procedimentos,
      contatos: f.conteudo.contatos.length ? f.conteudo.contatos : seed.contatos,
    });
    toast.success('Modelo aplicado: procedimentos e contatos de emergência.');
  };

  return (
    <Modal open onClose={onClose} title={f.id ? 'Editar plano' : 'Novo plano'} wide
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={() => onSave(f)} className={btnPrimary}>Salvar plano</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2"><input value={f.nome} onChange={(e) => set({ nome: e.target.value })} className={inp} placeholder="Ex.: Plano de evacuação — Arena" /></Field>
        <Field label="Tipo">
          <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value as PlanoTipo })} className={selCls + ' w-full'}>
            {PLANO_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Status">
          <select value={f.status} onChange={(e) => set({ status: e.target.value })} className={selCls + ' w-full'}>
            {(Object.keys(PLANO_STATUS_META) as (keyof typeof PLANO_STATUS_META)[]).map((s) => <option key={s} value={s}>{planoStatusMeta(s).label}</option>)}
          </select>
        </Field>
        <Field label="Espaço">
          <select value={f.propriedade_id} onChange={(e) => set({ propriedade_id: e.target.value })} className={selCls + ' w-full'}>
            <option value="">Nenhum</option>
            {ctx.propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Field>
        <Field label="Evento">
          <select value={f.evento_id} onChange={(e) => set({ evento_id: e.target.value })} className={selCls + ' w-full'}>
            <option value="">Nenhum</option>
            {ctx.eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}
          </select>
        </Field>
        <Field label="Responsável"><input value={f.responsavel} onChange={(e) => set({ responsavel: e.target.value })} className={inp} placeholder="Coordenador de segurança" /></Field>
        <Field label="Validade"><input type="date" value={f.validade} onChange={(e) => set({ validade: e.target.value })} className={inp} /></Field>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink">Conteúdo do plano</h4>
        <button onClick={gerar} className={btnSm}><Ico name="spark" size={14} /> Gerar do modelo</button>
      </div>
      <div className="mt-2 space-y-3">
        <StringList label="Rotas de fuga" itens={f.conteudo.rotas} onChange={(rotas) => setC({ rotas })} placeholder="Ex.: Saída A → portão norte" />
        <StringList label="Pontos de encontro" itens={f.conteudo.pontos_encontro} onChange={(pontos_encontro) => setC({ pontos_encontro })} placeholder="Ex.: Estacionamento principal" />
        <StringList label="Recursos (extintores, hidrantes, saídas)" itens={f.conteudo.recursos} onChange={(recursos) => setC({ recursos })} placeholder="Ex.: 4 extintores no setor B" />
        <StringList label="Procedimentos" itens={f.conteudo.procedimentos} onChange={(procedimentos) => setC({ procedimentos })} placeholder="Passo do acionamento" />
        <ContatoList itens={f.conteudo.contatos} onChange={(contatos) => setC({ contatos })} />
      </div>
      <Field label="Observações" className="mt-3"><textarea value={f.obs} onChange={(e) => set({ obs: e.target.value })} rows={2} className={inp} /></Field>
    </Modal>
  );
}

// ── Editor de lista de strings ────────────────────────────────────────────────
function StringList({ label, itens, onChange, placeholder }: { label: string; itens: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const add = () => { const v = draft.trim(); if (!v) return; onChange([...itens, v]); setDraft(''); };
  return (
    <div className="rounded-xl border border-black/[0.06] p-3">
      <div className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      {itens.length > 0 && (
        <ul className="mb-2 space-y-1">
          {itens.map((it, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-[#f7f7f8] px-2.5 py-1.5 text-sm">
              <span className="flex-1">{it}</span>
              <button onClick={() => onChange(itens.filter((_, j) => j !== i))} aria-label="Remover" className="text-ink-muted hover:text-red-600"><Ico name="trash" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          className="flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" placeholder={placeholder} />
        <button onClick={add} className={btnSm}><Ico name="plus" size={14} /></button>
      </div>
    </div>
  );
}

// ── Editor de contatos ────────────────────────────────────────────────────────
function ContatoList({ itens, onChange }: { itens: { nome: string; telefone: string }[]; onChange: (v: { nome: string; telefone: string }[]) => void }) {
  const [nome, setNome] = useState(''); const [tel, setTel] = useState('');
  const add = () => { if (!nome.trim() && !tel.trim()) return; onChange([...itens, { nome: nome.trim(), telefone: tel.trim() }]); setNome(''); setTel(''); };
  return (
    <div className="rounded-xl border border-black/[0.06] p-3">
      <div className="mb-1.5 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-muted">Contatos de emergência</div>
      {itens.length > 0 && (
        <ul className="mb-2 space-y-1">
          {itens.map((c, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg bg-[#f7f7f8] px-2.5 py-1.5 text-sm">
              <Ico name="phone" size={13} className="text-ink-muted" />
              <span className="flex-1">{c.nome}{c.nome && c.telefone ? ' · ' : ''}<span className="font-semibold">{c.telefone}</span></span>
              <button onClick={() => onChange(itens.filter((_, j) => j !== i))} aria-label="Remover" className="text-ink-muted hover:text-red-600"><Ico name="trash" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} className="min-w-[120px] flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" placeholder="Nome (SAMU, Bombeiros…)" />
        <input value={tel} onChange={(e) => setTel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} className="w-28 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" placeholder="Telefone" />
        <button onClick={add} className={btnSm}><Ico name="plus" size={14} /></button>
      </div>
    </div>
  );
}

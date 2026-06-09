'use client';

// Aba EPIs & NRs — /painel/sst.
// Dois controles: EPIs (CA do MTE + validade) e treinamentos obrigatórios / NRs
// por pessoa da equipe (validade com semáforo). Liga com RH (equipe). CRUD via RLS.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import {
  type SstCtx, type Toast, type EpiRow, type TreinamentoRow,
  NR_CATALOGO, nrMeta, validadeStatus,
  listarEpis, criarEpi, salvarEpi, excluirEpi, mapEpi,
  listarTreinamentos, criarTreinamento, salvarTreinamento, excluirTreinamento, mapTreinamento,
  inp, selCls,
} from '../_lib';
import {
  Ico, Kpi, Chip, EmptyState, SectionCard, Modal, Field, ConfirmDelete, ValidadeBadge,
  btnPrimary, btnGhost,
} from './ui';

export default function EpisNrs({ ctx, toast }: { ctx: SstCtx; toast: Toast }) {
  const [epis, setEpis] = useState<EpiRow[]>([]);
  const [treinos, setTreinos] = useState<TreinamentoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [epiModal, setEpiModal] = useState<EpiForm | null>(null);
  const [treinoModal, setTreinoModal] = useState<TreinoForm | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const [e, t] = await Promise.all([listarEpis(ctx.userId), listarTreinamentos(ctx.userId)]);
    setEpis(e.error ? [] : (e.data || []).map(mapEpi));
    setTreinos(t.error ? [] : (t.data || []).map(mapTreinamento));
    setLoading(false);
  }, [ctx.userId]);
  useEffect(() => { carregar(); }, [carregar]);

  // Indicadores de validade (a vencer / vencidos).
  const valStats = useMemo(() => {
    let aVencer = 0, vencidos = 0;
    const conta = (v: string | null | undefined) => {
      const n = validadeStatus(v, ctx.hoje).nivel;
      if (n === 'a_vencer') aVencer++; else if (n === 'vencida') vencidos++;
    };
    epis.forEach((e) => conta(e.validade_ca));
    treinos.forEach((t) => conta(t.validade));
    return { aVencer, vencidos };
  }, [epis, treinos, ctx.hoje]);

  // ── EPIs ──
  const salvarEpiRow = useCallback(async (f: EpiForm) => {
    if (!f.nome.trim()) { toast.error('Nome do EPI é obrigatório.'); return; }
    const payload = { nome: f.nome.trim(), ca: f.ca.trim() || null, quantidade: f.quantidade, funcao: f.funcao.trim() || null, validade_ca: f.validade_ca || null, obs: f.obs.trim() || null };
    if (f.id) {
      const { data, error } = await salvarEpi(f.id, payload);
      if (error || !data) { toast.error('Não foi possível salvar.'); return; }
      setEpis((rs) => rs.map((r) => (r.id === f.id ? mapEpi(data) : r)));
    } else {
      const { data, error } = await criarEpi({ usuario_id: ctx.userId, ...payload });
      if (error || !data) { toast.error('Não foi possível criar.'); return; }
      setEpis((rs) => [...rs, mapEpi(data)].sort((a, b) => a.nome.localeCompare(b.nome)));
    }
    setEpiModal(null); toast.success('EPI salvo.');
  }, [ctx.userId, toast]);
  const removerEpi = useCallback(async (id: string) => {
    const { error } = await excluirEpi(id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setEpis((rs) => rs.filter((r) => r.id !== id));
  }, [toast]);

  // ── Treinamentos ──
  const salvarTreino = useCallback(async (f: TreinoForm) => {
    if (!f.equipe_id && !f.pessoa.trim()) { toast.error('Informe a pessoa (equipe ou nome).'); return; }
    const payload = {
      equipe_id: f.equipe_id ? Number(f.equipe_id) : null, pessoa: f.pessoa.trim() || null, nr: f.nr,
      instituicao: f.instituicao.trim() || null, emissao: f.emissao || null, validade: f.validade || null,
      certificado_url: f.certificado_url.trim() || null, obs: f.obs.trim() || null,
    };
    if (f.id) {
      const { data, error } = await salvarTreinamento(f.id, payload);
      if (error || !data) { toast.error('Não foi possível salvar.'); return; }
      setTreinos((rs) => rs.map((r) => (r.id === f.id ? mapTreinamento(data) : r)));
    } else {
      const { data, error } = await criarTreinamento({ usuario_id: ctx.userId, ...payload });
      if (error || !data) { toast.error('Não foi possível criar.'); return; }
      setTreinos((rs) => [...rs, mapTreinamento(data)]);
    }
    setTreinoModal(null); toast.success('Treinamento salvo.');
  }, [ctx.userId, toast]);
  const removerTreino = useCallback(async (id: string) => {
    const { error } = await excluirTreinamento(id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setTreinos((rs) => rs.filter((r) => r.id !== id));
  }, [toast]);

  const pessoaLabel = (t: TreinamentoRow) => ctx.equipe.find((e) => e.id === t.equipe_id)?.nome || t.pessoa || '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="EPIs" value={epis.length} icon="helmet" />
        <Kpi label="Treinamentos" value={treinos.length} icon="users" />
        <Kpi label="A vencer (30d)" value={valStats.aVencer} tone={valStats.aVencer > 0 ? 'warn' : 'ok'} />
        <Kpi label="Vencidos" value={valStats.vencidos} tone={valStats.vencidos > 0 ? 'bad' : 'ok'} />
      </div>

      {/* EPIs */}
      <SectionCard title="EPIs" desc="Equipamentos de proteção individual — CA (MTE), quantidade e validade do CA (NR-06)." icon="helmet"
        actions={<button onClick={() => setEpiModal(emptyEpi())} className={btnPrimary}><Ico name="plus" size={16} /> EPI</button>}>
        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
        ) : epis.length === 0 ? (
          <EmptyState icon={<Ico name="helmet" size={22} />} title="Nenhum EPI cadastrado">Controle capacetes, luvas, protetores e outros EPIs com CA e validade.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {epis.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-white p-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-ink">{e.nome}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.72rem] text-ink-muted">
                    {e.ca && <span>CA {e.ca}</span>}
                    <span>{e.quantidade} un</span>
                    {e.funcao && <span>• {e.funcao}</span>}
                    {e.validade_ca && <span>• validade {formatDate(e.validade_ca, { style: 'short' })}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ValidadeBadge validade={e.validade_ca} hoje={ctx.hoje} semData="CA sem validade" />
                  <button onClick={() => setEpiModal(toEpiForm(e))} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><Ico name="edit" size={15} /></button>
                  <ConfirmDelete onConfirm={() => removerEpi(e.id)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {/* Treinamentos / NRs */}
      <SectionCard title="Treinamentos & NRs" desc="Certificações obrigatórias da equipe (brigada, NR-23, NR-35, primeiros socorros…). As de brigada cobrem o dimensionamento." icon="users"
        actions={<button onClick={() => setTreinoModal(emptyTreino())} className={btnPrimary}><Ico name="plus" size={16} /> Treinamento</button>}>
        {loading ? (
          <div className="space-y-2">{[0, 1].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
        ) : treinos.length === 0 ? (
          <EmptyState icon={<Ico name="users" size={22} />} title="Nenhum treinamento registrado">Registre as certificações de NRs e brigada da equipe, com validade.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {treinos.map((t) => {
              const nm = nrMeta(t.nr);
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-white p-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-semibold text-ink">{pessoaLabel(t)}</span>
                      <Chip className="bg-indigo-50 text-indigo-700">{nm.codigo === 'outro' ? nm.label : nm.codigo}</Chip>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.72rem] text-ink-muted">
                      <span>{nm.label}</span>
                      {t.instituicao && <span>• {t.instituicao}</span>}
                      {t.validade && <span>• validade {formatDate(t.validade, { style: 'short' })}</span>}
                      {t.certificado_url && <a href={t.certificado_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline"><Ico name="doc" size={11} /> certificado</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <ValidadeBadge validade={t.validade} hoje={ctx.hoje} semData="sem validade" />
                    <button onClick={() => setTreinoModal(toTreinoForm(t))} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><Ico name="edit" size={15} /></button>
                    <ConfirmDelete onConfirm={() => removerTreino(t.id)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {epiModal && <EpiModal form={epiModal} onClose={() => setEpiModal(null)} onSave={salvarEpiRow} />}
      {treinoModal && <TreinoModal ctx={ctx} form={treinoModal} onClose={() => setTreinoModal(null)} onSave={salvarTreino} />}
    </div>
  );
}

// ── EPI form/modal ────────────────────────────────────────────────────────────
type EpiForm = { id?: string; nome: string; ca: string; quantidade: number; funcao: string; validade_ca: string; obs: string };
const emptyEpi = (): EpiForm => ({ nome: '', ca: '', quantidade: 0, funcao: '', validade_ca: '', obs: '' });
const toEpiForm = (e: EpiRow): EpiForm => ({ id: e.id, nome: e.nome, ca: e.ca || '', quantidade: e.quantidade, funcao: e.funcao || '', validade_ca: e.validade_ca || '', obs: e.obs || '' });

function EpiModal({ form, onClose, onSave }: { form: EpiForm; onClose: () => void; onSave: (f: EpiForm) => void }) {
  const [f, setF] = useState<EpiForm>(form);
  const set = (p: Partial<EpiForm>) => setF((c) => ({ ...c, ...p }));
  return (
    <Modal open onClose={onClose} title={f.id ? 'Editar EPI' : 'Novo EPI'}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={() => onSave(f)} className={btnPrimary}>Salvar</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nome" className="col-span-2"><input value={f.nome} onChange={(e) => set({ nome: e.target.value })} className={inp} placeholder="Ex.: Capacete de segurança" /></Field>
        <Field label="CA (Certificado de Aprovação)"><input value={f.ca} onChange={(e) => set({ ca: e.target.value })} className={inp} placeholder="Nº do CA" /></Field>
        <Field label="Quantidade"><input type="number" min={0} value={f.quantidade} onChange={(e) => set({ quantidade: Math.max(0, Number(e.target.value) || 0) })} className={inp} /></Field>
        <Field label="Função / destino"><input value={f.funcao} onChange={(e) => set({ funcao: e.target.value })} className={inp} placeholder="Ex.: Montagem" /></Field>
        <Field label="Validade do CA"><input type="date" value={f.validade_ca} onChange={(e) => set({ validade_ca: e.target.value })} className={inp} /></Field>
        <Field label="Observações" className="col-span-2"><textarea value={f.obs} onChange={(e) => set({ obs: e.target.value })} rows={2} className={inp} /></Field>
      </div>
    </Modal>
  );
}

// ── Treinamento form/modal ────────────────────────────────────────────────────
type TreinoForm = { id?: string; equipe_id: string; pessoa: string; nr: string; instituicao: string; emissao: string; validade: string; certificado_url: string; obs: string };
const emptyTreino = (): TreinoForm => ({ equipe_id: '', pessoa: '', nr: 'brigada', instituicao: '', emissao: '', validade: '', certificado_url: '', obs: '' });
const toTreinoForm = (t: TreinamentoRow): TreinoForm => ({ id: t.id, equipe_id: t.equipe_id != null ? String(t.equipe_id) : '', pessoa: t.pessoa || '', nr: t.nr, instituicao: t.instituicao || '', emissao: t.emissao || '', validade: t.validade || '', certificado_url: t.certificado_url || '', obs: t.obs || '' });

function TreinoModal({ ctx, form, onClose, onSave }: { ctx: SstCtx; form: TreinoForm; onClose: () => void; onSave: (f: TreinoForm) => void }) {
  const [f, setF] = useState<TreinoForm>(form);
  const set = (p: Partial<TreinoForm>) => setF((c) => ({ ...c, ...p }));
  return (
    <Modal open onClose={onClose} title={f.id ? 'Editar treinamento' : 'Novo treinamento'}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={() => onSave(f)} className={btnPrimary}>Salvar</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pessoa (equipe)">
          <select value={f.equipe_id} onChange={(e) => set({ equipe_id: e.target.value })} className={selCls + ' w-full'}>
            <option value="">— ou digite abaixo —</option>
            {ctx.equipe.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.cargo ? ` (${p.cargo})` : ''}</option>)}
          </select>
        </Field>
        <Field label="Pessoa (nome livre)"><input value={f.pessoa} onChange={(e) => set({ pessoa: e.target.value })} className={inp} placeholder="Se não estiver na equipe" disabled={!!f.equipe_id} /></Field>
        <Field label="Treinamento / NR">
          <select value={f.nr} onChange={(e) => set({ nr: e.target.value })} className={selCls + ' w-full'}>
            {NR_CATALOGO.map((n) => <option key={n.codigo} value={n.codigo}>{n.codigo === 'outro' ? n.label : `${n.codigo} — ${n.label}`}</option>)}
          </select>
        </Field>
        <Field label="Instituição"><input value={f.instituicao} onChange={(e) => set({ instituicao: e.target.value })} className={inp} placeholder="Quem emitiu" /></Field>
        <Field label="Emissão"><input type="date" value={f.emissao} onChange={(e) => set({ emissao: e.target.value })} className={inp} /></Field>
        <Field label="Validade"><input type="date" value={f.validade} onChange={(e) => set({ validade: e.target.value })} className={inp} /></Field>
        <Field label="Certificado (URL)" className="col-span-2"><input value={f.certificado_url} onChange={(e) => set({ certificado_url: e.target.value })} className={inp} placeholder="https://…" /></Field>
        <Field label="Observações" className="col-span-2"><textarea value={f.obs} onChange={(e) => set({ obs: e.target.value })} rows={2} className={inp} /></Field>
      </div>
    </Modal>
  );
}

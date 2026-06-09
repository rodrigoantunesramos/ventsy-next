'use client';

// Aba Ocorrências — /painel/sst.
// Registro de acidentes/incidentes/atendimentos com gravidade, pessoa, local,
// conduta e CAT. Indicadores (lib/sst.indicadoresOcorrencias) no topo: total,
// graves, fatais, CAT pendentes e dias desde a última. CRUD via RLS.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import {
  type SstCtx, type Toast, type OcorrenciaRow, type OcorrenciaTipo, type Gravidade,
  OCORRENCIA_TIPOS, ocorrenciaTipoMeta, GRAVIDADES, gravidadeMeta, exigeCAT,
  indicadoresOcorrencias, listarOcorrencias, criarOcorrencia, salvarOcorrencia, excluirOcorrencia,
  mapOcorrencia, eventoLabel, inp, selCls, exportCSV,
} from '../_lib';
import {
  Ico, Kpi, Chip, EmptyState, SectionCard, Modal, Field, ConfirmDelete, btnPrimary, btnGhost, btnSm,
} from './ui';

type Form = {
  id?: string; tipo: OcorrenciaTipo; gravidade: Gravidade; descricao: string;
  pessoa: string; local: string; atendimento: string; data: string; evento_id: string; cat_emitida: boolean;
};
const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};
const emptyForm = (): Form => ({
  tipo: 'incidente', gravidade: 'leve', descricao: '', pessoa: '', local: '', atendimento: '',
  data: nowLocal(), evento_id: '', cat_emitida: false,
});

export default function Ocorrencias({ ctx, toast }: { ctx: SstCtx; toast: Toast }) {
  const [rows, setRows] = useState<OcorrenciaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroEvento, setFiltroEvento] = useState<string>('');
  const [filtroGrav, setFiltroGrav] = useState<string>('');
  const [modal, setModal] = useState<Form | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listarOcorrencias(ctx.userId);
    setRows(error ? [] : (data || []).map(mapOcorrencia));
    setLoading(false);
  }, [ctx.userId]);
  useEffect(() => { carregar(); }, [carregar]);

  const nowMs = useMemo(() => Date.parse(ctx.hoje + 'T23:59:59'), [ctx.hoje]);
  const ind = useMemo(() => indicadoresOcorrencias(rows, nowMs), [rows, nowMs]);

  const filtradas = useMemo(() => rows.filter((r) =>
    (!filtroEvento || r.evento_id === filtroEvento) && (!filtroGrav || r.gravidade === filtroGrav),
  ), [rows, filtroEvento, filtroGrav]);

  const salvar = useCallback(async (f: Form) => {
    if (!f.descricao.trim()) { toast.error('Descreva a ocorrência.'); return; }
    const payload = {
      tipo: f.tipo, gravidade: f.gravidade, descricao: f.descricao.trim(),
      pessoa: f.pessoa.trim() || null, local: f.local.trim() || null, atendimento: f.atendimento.trim() || null,
      data: f.data ? new Date(f.data).toISOString() : new Date().toISOString(),
      evento_id: f.evento_id || null, cat_emitida: f.cat_emitida,
    };
    if (f.id) {
      const { data, error } = await salvarOcorrencia(f.id, payload);
      if (error || !data) { toast.error('Não foi possível salvar.'); return; }
      setRows((rs) => rs.map((r) => (r.id === f.id ? mapOcorrencia(data) : r)));
    } else {
      const { data, error } = await criarOcorrencia({ usuario_id: ctx.userId, ...payload });
      if (error || !data) { toast.error('Não foi possível registrar.'); return; }
      setRows((rs) => [mapOcorrencia(data), ...rs]);
    }
    setModal(null);
    toast.success('Ocorrência registrada.');
  }, [ctx.userId, toast]);

  const remover = useCallback(async (id: string) => {
    const { error } = await excluirOcorrencia(id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }, [toast]);

  const onExport = () => {
    if (!filtradas.length) return;
    exportCSV('sst-ocorrencias.csv',
      ['Data', 'Tipo', 'Gravidade', 'Pessoa', 'Local', 'Descrição', 'Atendimento', 'CAT'],
      filtradas.map((r) => [
        formatDateTime(r.data), ocorrenciaTipoMeta(r.tipo).label, gravidadeMeta(r.gravidade).label,
        r.pessoa || '', r.local || '', r.descricao, r.atendimento || '', r.cat_emitida ? 'sim' : 'não',
      ]));
  };

  return (
    <div className="space-y-4">
      {/* Indicadores */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total" value={ind.total} icon="alert" />
        <Kpi label="Graves+" value={ind.graves} tone={ind.graves > 0 ? 'bad' : 'ok'} sub={ind.fatais > 0 ? `${ind.fatais} fatal(is)` : undefined} />
        <Kpi label="CAT pendentes" value={ind.catPendentes} tone={ind.catPendentes > 0 ? 'warn' : 'ok'} icon="doc" />
        <Kpi label="Dias sem acidente" value={ind.diasDesdeUltima == null ? '—' : ind.diasDesdeUltima} tone={ind.diasDesdeUltima != null && ind.diasDesdeUltima < 1 ? 'warn' : 'ok'} />
        <Kpi label="Última" value={ind.ultimaData ? formatDateTime(ind.ultimaData, { withSeconds: false }).split(' ').slice(0, 3).join(' ') : '—'} />
      </div>

      <SectionCard title="Ocorrências registradas" desc="Acidentes, incidentes e atendimentos. Gravidade ≥ moderada sugere emissão de CAT." icon="alert"
        actions={<>
          {filtradas.length > 0 && <button onClick={onExport} className={btnSm}><Ico name="download" size={14} /> CSV</button>}
          <button onClick={() => setModal(emptyForm())} className={btnPrimary}><Ico name="plus" size={16} /> Registrar</button>
        </>}>
        {/* Filtros */}
        <div className="mb-3 flex flex-wrap gap-2">
          <select value={filtroEvento} onChange={(e) => setFiltroEvento(e.target.value)} className={selCls}>
            <option value="">Todos os eventos</option>
            {ctx.eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}
          </select>
          <select value={filtroGrav} onChange={(e) => setFiltroGrav(e.target.value)} className={selCls}>
            <option value="">Todas as gravidades</option>
            {GRAVIDADES.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
        ) : filtradas.length === 0 ? (
          <EmptyState icon={<Ico name="check" size={22} />} title={rows.length === 0 ? 'Nenhuma ocorrência — ótimo sinal' : 'Nada com esses filtros'}>
            {rows.length === 0 ? 'Registre aqui acidentes, incidentes e atendimentos para acompanhar os indicadores de segurança.' : 'Ajuste os filtros acima.'}
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {filtradas.map((r) => {
              const tm = ocorrenciaTipoMeta(r.tipo); const gm = gravidadeMeta(r.gravidade);
              const ev = ctx.eventos.find((e) => e.id === r.evento_id);
              const catFalta = exigeCAT(r.gravidade) && !r.cat_emitida;
              return (
                <li key={r.id} className="rounded-xl border border-black/[0.06] bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip className={gm.chip}><span className="h-1.5 w-1.5 rounded-full" style={{ background: gm.hex }} />{gm.label}</Chip>
                        <Chip className={tm.chip}>{tm.label}</Chip>
                        {catFalta && <Chip className="bg-amber-100 text-amber-800"><Ico name="doc" size={12} /> CAT pendente</Chip>}
                        {r.cat_emitida && <Chip className="bg-emerald-50 text-emerald-700">CAT emitida</Chip>}
                      </div>
                      <p className="mt-1.5 text-sm text-ink">{r.descricao}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[0.72rem] text-ink-muted">
                        <span>{formatDateTime(r.data)}</span>
                        {r.pessoa && <span>• {r.pessoa}</span>}
                        {r.local && <span className="inline-flex items-center gap-0.5"><Ico name="pin" size={11} /> {r.local}</span>}
                        {ev && <span>• {eventoLabel(ev)}</span>}
                      </div>
                      {r.atendimento && <p className="mt-1 text-[0.78rem] text-ink-soft"><span className="font-semibold">Conduta:</span> {r.atendimento}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setModal({
                        id: r.id, tipo: r.tipo as OcorrenciaTipo, gravidade: r.gravidade as Gravidade, descricao: r.descricao,
                        pessoa: r.pessoa || '', local: r.local || '', atendimento: r.atendimento || '',
                        data: r.data ? new Date(r.data).toISOString().slice(0, 16) : nowLocal(), evento_id: r.evento_id || '', cat_emitida: r.cat_emitida,
                      })} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><Ico name="edit" size={15} /></button>
                      <ConfirmDelete onConfirm={() => remover(r.id)} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {modal && <OcorrenciaModal ctx={ctx} form={modal} onClose={() => setModal(null)} onSave={salvar} />}
    </div>
  );
}

function OcorrenciaModal({ ctx, form, onClose, onSave }: { ctx: SstCtx; form: Form; onClose: () => void; onSave: (f: Form) => void }) {
  const [f, setF] = useState<Form>(form);
  const set = (p: Partial<Form>) => setF((cur) => ({ ...cur, ...p }));
  const catSugerido = exigeCAT(f.gravidade);
  return (
    <Modal open onClose={onClose} title={f.id ? 'Editar ocorrência' : 'Registrar ocorrência'} wide
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={() => onSave(f)} className={btnPrimary}>Salvar</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value as OcorrenciaTipo })} className={selCls + ' w-full'}>
            {OCORRENCIA_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Gravidade">
          <select value={f.gravidade} onChange={(e) => set({ gravidade: e.target.value as Gravidade })} className={selCls + ' w-full'}>
            {GRAVIDADES.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
          </select>
        </Field>
        <Field label="Descrição" className="col-span-2">
          <textarea value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} rows={2} className={inp} placeholder="O que aconteceu" />
        </Field>
        <Field label="Pessoa envolvida"><input value={f.pessoa} onChange={(e) => set({ pessoa: e.target.value })} className={inp} placeholder="Nome (opcional)" /></Field>
        <Field label="Local / setor"><input value={f.local} onChange={(e) => set({ local: e.target.value })} className={inp} placeholder="Onde ocorreu" /></Field>
        <Field label="Data e hora"><input type="datetime-local" value={f.data} onChange={(e) => set({ data: e.target.value })} className={inp} /></Field>
        <Field label="Evento">
          <select value={f.evento_id} onChange={(e) => set({ evento_id: e.target.value })} className={selCls + ' w-full'}>
            <option value="">Nenhum / espaço</option>
            {ctx.eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}
          </select>
        </Field>
        <Field label="Atendimento / conduta" className="col-span-2">
          <textarea value={f.atendimento} onChange={(e) => set({ atendimento: e.target.value })} rows={2} className={inp} placeholder="Primeiros socorros, encaminhamento, providências" />
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.cat_emitida} onChange={(e) => set({ cat_emitida: e.target.checked })} className="h-4 w-4 rounded accent-brand" />
          CAT emitida {catSugerido && !f.cat_emitida && <span className="text-amber-600">(recomendada para esta gravidade)</span>}
        </label>
      </div>
    </Modal>
  );
}

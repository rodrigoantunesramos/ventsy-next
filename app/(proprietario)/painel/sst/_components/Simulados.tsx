'use client';

// Aba Simulados — /painel/sst.
// Registro de simulados (evacuação/incêndio/APH) e inspeções de segurança, com
// participantes, tempo de evacuação, resultado e próxima data (periodicidade).
// CRUD via RLS.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import {
  type SstCtx, type Toast, type SimuladoRow, type SimuladoTipo,
  SIMULADO_TIPOS, simuladoTipoMeta, validadeStatus, eventoLabel, inp, selCls,
  listarSimulados, criarSimulado, salvarSimulado, excluirSimulado, mapSimulado,
} from '../_lib';
import {
  Ico, Kpi, Chip, EmptyState, SectionCard, Modal, Field, ConfirmDelete, btnPrimary, btnGhost,
} from './ui';

const RESULTADO_META: Record<string, { label: string; chip: string }> = {
  satisfatorio: { label: 'Satisfatório', chip: 'bg-emerald-50 text-emerald-700' },
  parcial: { label: 'Parcial', chip: 'bg-amber-50 text-amber-700' },
  insatisfatorio: { label: 'Insatisfatório', chip: 'bg-red-50 text-red-700' },
};
const fmtTempo = (s: number | null) => {
  if (s == null) return null;
  const m = Math.floor(s / 60); const r = s % 60;
  return m > 0 ? `${m}min${r ? ` ${r}s` : ''}` : `${r}s`;
};

type Form = {
  id?: string; tipo: SimuladoTipo; data: string; participantes: number; tempo_seg: number | '';
  resultado: string; responsavel: string; observacoes: string; proxima_data: string; propriedade_id: string; evento_id: string;
};
const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = (): Form => ({ tipo: 'evacuacao', data: today(), participantes: 0, tempo_seg: '', resultado: 'satisfatorio', responsavel: '', observacoes: '', proxima_data: '', propriedade_id: '', evento_id: '' });

export default function Simulados({ ctx, toast }: { ctx: SstCtx; toast: Toast }) {
  const [rows, setRows] = useState<SimuladoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Form | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    const { data, error } = await listarSimulados(ctx.userId);
    setRows(error ? [] : (data || []).map(mapSimulado));
    setLoading(false);
  }, [ctx.userId]);
  useEffect(() => { carregar(); }, [carregar]);

  const proximos = useMemo(() => rows.filter((r) => {
    const n = validadeStatus(r.proxima_data, ctx.hoje).nivel;
    return n === 'a_vencer' || n === 'vencida';
  }).length, [rows, ctx.hoje]);
  const ultimo = rows[0];

  const salvar = useCallback(async (f: Form) => {
    const payload = {
      tipo: f.tipo, data: f.data || today(), participantes: f.participantes,
      tempo_seg: f.tempo_seg === '' ? null : Number(f.tempo_seg), resultado: f.resultado,
      responsavel: f.responsavel.trim() || null, observacoes: f.observacoes.trim() || null,
      proxima_data: f.proxima_data || null,
      propriedade_id: f.propriedade_id ? Number(f.propriedade_id) : null, evento_id: f.evento_id || null,
    };
    if (f.id) {
      const { data, error } = await salvarSimulado(f.id, payload);
      if (error || !data) { toast.error('Não foi possível salvar.'); return; }
      setRows((rs) => rs.map((r) => (r.id === f.id ? mapSimulado(data) : r)));
    } else {
      const { data, error } = await criarSimulado({ usuario_id: ctx.userId, ...payload });
      if (error || !data) { toast.error('Não foi possível registrar.'); return; }
      setRows((rs) => [mapSimulado(data), ...rs].sort((a, b) => (b.data || '').localeCompare(a.data || '')));
    }
    setModal(null); toast.success('Simulado registrado.');
  }, [ctx.userId, toast]);

  const remover = useCallback(async (id: string) => {
    const { error } = await excluirSimulado(id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }, [toast]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Registros" value={rows.length} icon="clipboard" />
        <Kpi label="Reincidências devidas" value={proximos} tone={proximos > 0 ? 'warn' : 'ok'} sub="próxima data vencida/a vencer" />
        <Kpi label="Último" value={ultimo ? formatDate(ultimo.data, { style: 'short' }) : '—'} sub={ultimo ? simuladoTipoMeta(ultimo.tipo).label : undefined} />
      </div>

      <SectionCard title="Simulados & inspeções" desc="Treine evacuação, incêndio e APH; registre inspeções e a periodicidade." icon="clipboard"
        actions={<button onClick={() => setModal(emptyForm())} className={btnPrimary}><Ico name="plus" size={16} /> Registrar</button>}>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Ico name="clipboard" size={22} />} title="Nenhum simulado ainda">Registre simulados de evacuação/incêndio/APH e inspeções, com resultado e próxima data.</EmptyState>
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const tm = simuladoTipoMeta(r.tipo); const rm = RESULTADO_META[r.resultado] || RESULTADO_META.satisfatorio;
              const prop = ctx.propriedades.find((p) => p.id === r.propriedade_id);
              const ev = ctx.eventos.find((e) => e.id === r.evento_id);
              const proxNivel = validadeStatus(r.proxima_data, ctx.hoje).nivel;
              return (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-black/[0.06] bg-white p-3">
                  <div className="flex items-start gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: tm.hex + '1a', color: tm.hex }}><Ico name={tm.icone || 'clipboard'} size={17} /></span>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm font-semibold text-ink">{tm.label}</span>
                        <Chip className={rm.chip}>{rm.label}</Chip>
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[0.72rem] text-ink-muted">
                        <span>{formatDate(r.data, { style: 'medium' })}</span>
                        {r.participantes > 0 && <span>• {r.participantes} participantes</span>}
                        {fmtTempo(r.tempo_seg) && <span>• evacuação {fmtTempo(r.tempo_seg)}</span>}
                        {prop && <span>• {prop.nome}</span>}
                        {ev && <span>• {eventoLabel(ev)}</span>}
                      </div>
                      {r.observacoes && <p className="mt-1 text-[0.78rem] text-ink-soft">{r.observacoes}</p>}
                      {r.proxima_data && (
                        <div className="mt-1 text-[0.72rem]">
                          <span className={proxNivel === 'vencida' ? 'text-red-600' : proxNivel === 'a_vencer' ? 'text-amber-600' : 'text-ink-muted'}>
                            Próximo: {formatDate(r.proxima_data, { style: 'short' })}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setModal(toForm(r))} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><Ico name="edit" size={15} /></button>
                    <ConfirmDelete onConfirm={() => remover(r.id)} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {modal && <SimuladoModal ctx={ctx} form={modal} onClose={() => setModal(null)} onSave={salvar} />}
    </div>
  );
}

function toForm(r: SimuladoRow): Form {
  return {
    id: r.id, tipo: r.tipo as SimuladoTipo, data: r.data || today(), participantes: r.participantes,
    tempo_seg: r.tempo_seg == null ? '' : r.tempo_seg, resultado: r.resultado, responsavel: r.responsavel || '',
    observacoes: r.observacoes || '', proxima_data: r.proxima_data || '',
    propriedade_id: r.propriedade_id != null ? String(r.propriedade_id) : '', evento_id: r.evento_id || '',
  };
}

function SimuladoModal({ ctx, form, onClose, onSave }: { ctx: SstCtx; form: Form; onClose: () => void; onSave: (f: Form) => void }) {
  const [f, setF] = useState<Form>(form);
  const set = (p: Partial<Form>) => setF((c) => ({ ...c, ...p }));
  return (
    <Modal open onClose={onClose} title={f.id ? 'Editar simulado' : 'Registrar simulado'} wide
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={() => onSave(f)} className={btnPrimary}>Salvar</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo">
          <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value as SimuladoTipo })} className={selCls + ' w-full'}>
            {SIMULADO_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Resultado">
          <select value={f.resultado} onChange={(e) => set({ resultado: e.target.value })} className={selCls + ' w-full'}>
            {Object.entries(RESULTADO_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </Field>
        <Field label="Data"><input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} className={inp} /></Field>
        <Field label="Próxima data" hint="periodicidade"><input type="date" value={f.proxima_data} onChange={(e) => set({ proxima_data: e.target.value })} className={inp} /></Field>
        <Field label="Participantes"><input type="number" min={0} value={f.participantes} onChange={(e) => set({ participantes: Math.max(0, Number(e.target.value) || 0) })} className={inp} /></Field>
        <Field label="Tempo de evacuação (s)"><input type="number" min={0} value={f.tempo_seg} onChange={(e) => set({ tempo_seg: e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0) })} className={inp} placeholder="opcional" /></Field>
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
        <Field label="Responsável" className="col-span-2"><input value={f.responsavel} onChange={(e) => set({ responsavel: e.target.value })} className={inp} /></Field>
        <Field label="Observações" className="col-span-2"><textarea value={f.observacoes} onChange={(e) => set({ observacoes: e.target.value })} rows={2} className={inp} placeholder="Pontos de melhoria, falhas observadas" /></Field>
      </div>
    </Modal>
  );
}

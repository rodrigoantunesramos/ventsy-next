'use client';

// Aba "Ponto" — registro de entrada/saída do dia (check-in/out), manual ou a
// partir da escala. As horas/extras/adicional noturno/atraso/saldo são apurados
// pelo motor puro lib/ponto.ts no momento de salvar e gravados em
// `ponto_registros` via RLS. Cobre fixos e freelancers. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  calcularRegistro, minToHHMM, parseTs, funcaoLabel,
  type PontoRegistro, type EscalaAlocacao,
} from '@/lib/ponto';
import {
  type PontoBag, type EquipeLite, pessoaDaAloc, eventoLabel,
  SEL_PONTO, mapPonto, combinarDataHora, inp, selCls, ymd,
} from '../_lib';
import { Kpi, ModalShell, Campo, EmptyState, IcoClock, IcoLogin, IcoBolt, IcoMoon, IcoAlert, IcoPlus, IcoTrash, IcoCheck } from './ui';

const ORIGENS = [
  { v: 'manual', label: 'Manual' },
  { v: 'app', label: 'App' },
  { v: 'qr', label: 'QR / link' },
  { v: 'biometria', label: 'Biometria' },
];

type Prefill = {
  alocacao_id?: string; equipe_id?: number | null; freelancer_id?: string | null; evento_id?: string | null;
  nome?: string; entrada?: string; jornadaMin?: number; previstoInicio?: string | null;
};

export default function Ponto({ bag }: { bag: PontoBag }) {
  const toast = useToast();
  const { userId, registros, alocacoes, escalas, equipeById, freelaById, eventoById, recarregar } = bag;
  const hojeStr = ymd(new Date());
  const [dia, setDia] = useState(hojeStr);
  const [modal, setModal] = useState<{ editing: PontoRegistro | null; prefill?: Prefill } | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  // Mapa escala_id → escala (p/ resolver evento/turno/previsto da alocação).
  const escalaById = useMemo(() => new Map(escalas.map((s) => [s.id, s])), [escalas]);

  const registrosDoDia = useMemo(() => registros.filter((r) => r.data === dia).sort((a, b) => (a.entrada || '').localeCompare(b.entrada || '')), [registros, dia]);

  // Escalados do dia que ainda NÃO bateram ponto (para o atalho "bater ponto").
  const escaladosSemPonto = useMemo(() => {
    const comPonto = new Set(registrosDoDia.map((r) => r.alocacao_id).filter(Boolean));
    return alocacoes.filter((a) => {
      if (a.status !== 'presente' && a.status !== 'confirmado') return false;
      const s = escalaById.get(a.escala_id);
      if (!s || s.data !== dia) return false;
      return !comPonto.has(a.id);
    });
  }, [alocacoes, registrosDoDia, escalaById, dia]);

  const kpis = useMemo(() => {
    const trabalhado = registrosDoDia.reduce((s, r) => s + r.trabalhado_min, 0);
    const extras = registrosDoDia.reduce((s, r) => s + r.extras_min, 0);
    const noturno = registrosDoDia.reduce((s, r) => s + r.noturno_min, 0);
    const atrasos = registrosDoDia.filter((r) => r.atraso_min > 0).length;
    return { registros: registrosDoDia.length, trabalhado, extras, noturno, atrasos };
  }, [registrosDoDia]);

  async function salvar(payload: Record<string, unknown>, editing: PontoRegistro | null) {
    const { error } = editing
      ? await sb.from('ponto_registros').update(payload).eq('id', editing.id).eq('usuario_id', userId)
      : await sb.from('ponto_registros').insert({ ...payload, usuario_id: userId });
    if (error) { toast.error('Não foi possível salvar o registro.'); return false; }
    toast.success(editing ? 'Registro atualizado.' : 'Ponto registrado.');
    await recarregar();
    return true;
  }

  async function excluir(r: PontoRegistro) {
    const key = `del:${r.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir o registro.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const { error } = await sb.from('ponto_registros').delete().eq('id', r.id).eq('usuario_id', userId);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Registro removido.');
    await recarregar();
  }

  function baterPontoDe(a: EscalaAlocacao) {
    const s = escalaById.get(a.escala_id);
    const p = pessoaDaAloc(a, equipeById, freelaById);
    let jornadaMin = 0;
    const ini = parseTs(a.inicio_previsto), fim = parseTs(a.fim_previsto);
    if (ini != null && fim != null && fim > ini) jornadaMin = Math.round((fim - ini) / 60000);
    setModal({ editing: null, prefill: {
      alocacao_id: a.id, equipe_id: a.equipe_id, freelancer_id: a.freelancer_id, evento_id: s?.evento_id ?? null,
      nome: p.nome, entrada: a.inicio_previsto ? a.inicio_previsto.slice(11, 16) : '', jornadaMin, previstoInicio: a.inicio_previsto,
    } });
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <Campo label="Dia">
            <input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className={selCls} />
          </Campo>
          <button onClick={() => setModal({ editing: null })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Registrar ponto</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Registros" value={String(kpis.registros)} tone="ink" icon={<IcoClock />} />
        <Kpi label="Horas no dia" value={minToHHMM(kpis.trabalhado)} tone="azul" icon={<IcoLogin />} />
        <Kpi label="Horas extras" value={minToHHMM(kpis.extras)} tone="gold" icon={<IcoBolt />} />
        <Kpi label="Adic. noturno" value={minToHHMM(kpis.noturno)} tone="roxo" icon={<IcoMoon />} />
        <Kpi label="Atrasos" value={String(kpis.atrasos)} tone={kpis.atrasos ? 'vermelho' : 'verde'} icon={<IcoAlert />} />
      </div>

      {/* Escalados sem ponto — atalho */}
      {escaladosSemPonto.length > 0 && (
        <div className="rounded-2xl border border-sky-200 bg-sky-50/60 p-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sky-700">Escalados sem ponto neste dia</div>
          <div className="flex flex-wrap gap-2">
            {escaladosSemPonto.map((a) => {
              const p = pessoaDaAloc(a, equipeById, freelaById);
              return (
                <button key={a.id} onClick={() => baterPontoDe(a)} className="inline-flex items-center gap-1.5 rounded-full border border-sky-300 bg-white py-1 pl-1 pr-3 text-xs font-semibold text-sky-800 hover:bg-sky-100">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 text-[0.6rem] font-bold text-white">{p.nome.slice(0, 2).toUpperCase()}</span>
                  {p.nome.split(' ')[0]} <IcoPlus />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Lista do dia */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Pontos de {formatDate(dia, { style: 'long' })}</h3>
        {registrosDoDia.length === 0 ? (
          <EmptyState icon={<IcoClock />} title="Sem batidas neste dia">
            Use <strong>Registrar ponto</strong> ou bata o ponto dos escalados acima.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Pessoa</th>
                  <th className="pb-2 font-semibold">Entrada → Saída</th>
                  <th className="pb-2 text-right font-semibold">Trabalhado</th>
                  <th className="pb-2 text-right font-semibold">Extras</th>
                  <th className="pb-2 text-right font-semibold">Noturno</th>
                  <th className="pb-2 text-right font-semibold">Atraso</th>
                  <th className="w-16 pb-2" />
                </tr>
              </thead>
              <tbody>
                {registrosDoDia.map((r) => {
                  const p = pessoaDaAloc(r, equipeById, freelaById);
                  const ev = r.evento_id ? eventoById.get(r.evento_id) : null;
                  return (
                    <tr key={r.id} className="group border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white" style={{ background: r.freelancer_id ? '#8b5cf6' : '#0ca678' }}>{p.nome.slice(0, 2).toUpperCase()}</span>
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-ink">{p.nome}</div>
                            {ev && <div className="truncate text-xs text-ink-muted">{eventoLabel(ev)}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-ink-soft">
                        {r.entrada ? formatDateTime(r.entrada).split(', ').pop() : '—'} → {r.saida ? formatDateTime(r.saida).split(', ').pop() : <span className="text-amber-600">aberto</span>}
                      </td>
                      <td className="py-2.5 text-right font-semibold text-ink">{minToHHMM(r.trabalhado_min)}</td>
                      <td className="py-2.5 text-right">{r.extras_min > 0 ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-700">{minToHHMM(r.extras_min)}</span> : <span className="text-ink-muted">—</span>}</td>
                      <td className="py-2.5 text-right">{r.noturno_min > 0 ? <span className="rounded bg-violet-50 px-1.5 py-0.5 text-xs font-bold text-violet-700">{minToHHMM(r.noturno_min)}</span> : <span className="text-ink-muted">—</span>}</td>
                      <td className="py-2.5 text-right">{r.atraso_min > 0 ? <span className="rounded bg-red-50 px-1.5 py-0.5 text-xs font-bold text-red-700">{r.atraso_min}min</span> : <span className="text-ink-muted">—</span>}</td>
                      <td className="py-2.5 text-right">
                        <div className="flex justify-end gap-1 opacity-0 transition group-hover:opacity-100">
                          <button onClick={() => setModal({ editing: r })} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-ink-muted hover:border-brand hover:text-brand"><IcoClock /></button>
                          <button onClick={() => excluir(r)} aria-label="Excluir" className={`flex h-7 w-7 items-center justify-center rounded-lg border text-xs ${confirmKey === `del:${r.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-black/10 text-red-600 hover:border-red-300'}`}><IcoTrash /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <PontoModal dia={dia} editing={modal.editing} prefill={modal.prefill} equipe={bag.equipe} freelancers={bag.freelancers} eventos={bag.eventos} equipeById={equipeById} freelaById={freelaById} onClose={() => setModal(null)} onSave={salvar} />}
    </div>
  );
}

// ── Modal de registro de ponto ────────────────────────────────────────────────
function PontoModal({ dia, editing, prefill, equipe, freelancers, eventos, onClose, onSave }: {
  dia: string; editing: PontoRegistro | null; prefill?: Prefill;
  equipe: EquipeLite[]; freelancers: PontoBag['freelancers']; eventos: PontoBag['eventos'];
  equipeById: Map<number, EquipeLite>; freelaById: Map<string, PontoBag['freelancers'][number]>;
  onClose: () => void; onSave: (p: Record<string, unknown>, e: PontoRegistro | null) => Promise<boolean>;
}) {
  const toast = useToast();
  // Identidade da pessoa: 'fixo:<id>' | 'freela:<id>'.
  const initPessoa = editing
    ? (editing.freelancer_id ? `freela:${editing.freelancer_id}` : editing.equipe_id != null ? `fixo:${editing.equipe_id}` : '')
    : (prefill?.freelancer_id ? `freela:${prefill.freelancer_id}` : prefill?.equipe_id != null ? `fixo:${prefill.equipe_id}` : '');

  const [pessoa, setPessoa] = useState(initPessoa);
  const [data, setData] = useState(editing?.data || dia);
  const [horaEntrada, setHoraEntrada] = useState(editing?.entrada ? editing.entrada.slice(11, 16) : prefill?.entrada || '08:00');
  const [horaSaida, setHoraSaida] = useState(editing?.saida ? editing.saida.slice(11, 16) : '');
  const [intervalo, setIntervalo] = useState(String(editing?.intervalo_min ?? 0));
  const [jornada, setJornada] = useState(String(editing?.jornada_min ?? prefill?.jornadaMin ?? 480));
  const [origem, setOrigem] = useState(editing?.origem || 'manual');
  const [local, setLocal] = useState(editing?.local || '');
  const [eventoId, setEventoId] = useState(editing?.evento_id || prefill?.evento_id || '');
  const [tolerancia, setTolerancia] = useState('10');
  const [saving, setSaving] = useState(false);

  // Prévia da apuração (mesma engine do back).
  const previa = useMemo(() => {
    const entradaMs = parseTs(combinarDataHora(data, horaEntrada));
    const saidaMs = horaSaida ? parseTs(combinarDataHora(data, horaSaida)) : null;
    if (entradaMs == null) return null;
    const previstoInicioMs = editing ? null : (prefill?.previstoInicio ? parseTs(prefill.previstoInicio) : null);
    return calcularRegistro({ entradaMs, saidaMs, intervaloMin: Number(intervalo) || 0, jornadaMin: Number(jornada) || 0, previstoInicioMs, toleranciaAtrasoMin: Number(tolerancia) || 0 });
  }, [data, horaEntrada, horaSaida, intervalo, jornada, tolerancia, prefill, editing]);

  async function salvar() {
    if (!pessoa) { toast.error('Selecione a pessoa.'); return; }
    const entradaISO = combinarDataHora(data, horaEntrada);
    const entradaMs = parseTs(entradaISO);
    if (entradaMs == null) { toast.error('Informe a entrada.'); return; }
    // Saída pode cruzar a meia-noite → soma 1 dia se a hora for menor que a entrada.
    let saidaISO: string | null = null;
    if (horaSaida) {
      const mesmoDia = combinarDataHora(data, horaSaida);
      const sMs = parseTs(mesmoDia);
      saidaISO = sMs != null && sMs <= entradaMs ? combinarDataHora(addDia(data, 1), horaSaida) : mesmoDia;
    }
    const saidaMs = saidaISO ? parseTs(saidaISO) : null;
    const previstoInicioMs = !editing && prefill?.previstoInicio ? parseTs(prefill.previstoInicio) : null;
    const calc = calcularRegistro({ entradaMs, saidaMs, intervaloMin: Number(intervalo) || 0, jornadaMin: Number(jornada) || 0, previstoInicioMs, toleranciaAtrasoMin: Number(tolerancia) || 0 });

    const [tipo, id] = pessoa.split(':');
    const payload: Record<string, unknown> = {
      alocacao_id: editing?.alocacao_id ?? prefill?.alocacao_id ?? null,
      equipe_id: tipo === 'fixo' ? Number(id) : null,
      freelancer_id: tipo === 'freela' ? id : null,
      evento_id: eventoId || null, data,
      entrada: entradaISO, saida: saidaISO,
      intervalo_min: Number(intervalo) || 0, jornada_min: Number(jornada) || 0,
      trabalhado_min: calc.trabalhadoMin, extras_min: calc.extrasMin, noturno_min: calc.noturnoMin,
      atraso_min: calc.atrasoMin, saldo_min: calc.saldoMin,
      origem, local: local.trim() || null,
    };
    setSaving(true);
    const ok = await onSave(payload, editing);
    setSaving(false);
    if (ok) onClose();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editing ? 'Editar ponto' : 'Registrar ponto'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Pessoa" full>
          <select className={inp} value={pessoa} onChange={(e) => setPessoa(e.target.value)} disabled={!!editing}>
            <option value="">Selecione…</option>
            <optgroup label="Equipe fixa">
              {equipe.filter((x) => x.status !== 'afastado').map((x) => <option key={`fixo:${x.id}`} value={`fixo:${x.id}`}>{x.nome}{x.cargo ? ` · ${x.cargo}` : ''}</option>)}
            </optgroup>
            <optgroup label="Freelancers">
              {freelancers.filter((f) => f.ativo).map((f) => <option key={`freela:${f.id}`} value={`freela:${f.id}`}>{f.nome} · {funcaoLabel(f.funcao)}</option>)}
            </optgroup>
          </select>
        </Campo>
        <Campo label="Data"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        <Campo label="Evento (opcional)">
          <select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
            <option value="">—</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}
          </select>
        </Campo>
        <Campo label="Entrada"><input type="time" className={inp} value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} /></Campo>
        <Campo label="Saída" hint="Vazio = ponto aberto."><input type="time" className={inp} value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} /></Campo>
        <Campo label="Intervalo (min)"><input type="number" min={0} className={inp} value={intervalo} onChange={(e) => setIntervalo(e.target.value)} /></Campo>
        <Campo label="Jornada do turno (min)"><input type="number" min={0} className={inp} value={jornada} onChange={(e) => setJornada(e.target.value)} /></Campo>
        <Campo label="Origem"><select className={inp} value={origem} onChange={(e) => setOrigem(e.target.value)}>{ORIGENS.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}</select></Campo>
        <Campo label="Tolerância atraso (min)"><input type="number" min={0} className={inp} value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} /></Campo>
        <Campo label="Local" full><input className={inp} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Portaria, salão…" /></Campo>
      </div>

      {previa && (
        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-center text-xs">
          <PreviaCel label="Trabalhado" v={minToHHMM(previa.trabalhadoMin)} />
          <PreviaCel label="Extras" v={minToHHMM(previa.extrasMin)} tone={previa.extrasMin > 0 ? 'amber' : undefined} />
          <PreviaCel label="Noturno" v={minToHHMM(previa.noturnoMin)} tone={previa.noturnoMin > 0 ? 'violet' : undefined} />
          <PreviaCel label="Atraso" v={`${previa.atrasoMin}min`} tone={previa.atrasoMin > 0 ? 'red' : undefined} />
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !pessoa} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"><IcoCheck /> {saving ? 'Salvando…' : 'Salvar ponto'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

function PreviaCel({ label, v, tone }: { label: string; v: string; tone?: 'amber' | 'violet' | 'red' }) {
  const c = tone === 'amber' ? 'text-amber-700' : tone === 'violet' ? 'text-violet-700' : tone === 'red' ? 'text-red-700' : 'text-ink';
  return (<div><div className="text-ink-muted">{label}</div><div className={`mt-0.5 text-sm font-bold ${c}`}>{v}</div></div>);
}

/** Soma dias a 'YYYY-MM-DD' (local). */
function addDia(s: string, n: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return s;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n);
  return ymd(d);
}

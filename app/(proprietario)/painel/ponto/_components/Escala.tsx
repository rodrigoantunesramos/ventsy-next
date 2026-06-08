'use client';

// Aba "Escala" — planeja as vagas de cada evento (função × turno × quantidade),
// convoca pessoas FIXAS (equipe) e FREELANCERS para preencher, e mostra a
// cobertura e o custo PREVISTO. A convocação passa pela /api/ponto (autoritativa)
// que BLOQUEIA super-alocação por vaga (mais pessoas que o `necessario`). O CRUD
// das escalas é via RLS. Sem "R$" hardcoded — tudo via lib/format.

import { useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  FUNCOES, TURNOS, funcaoLabel, funcaoCor, turnoLabel, turnoJanela,
  alocStatusMeta, coberturaEscala, custoPrevistoEscala, ocupaVaga, alocEncerrada,
  type Escala, type EscalaAlocacao,
} from '@/lib/ponto';
import {
  type PontoBag, type EventoLite, type EquipeLite, pessoaDaAloc, eventoLabel,
  postAloc, patchAloc, deleteAloc, combinarDataHora, inp, selCls, ymd,
} from '../_lib';
import { Kpi, ModalShell, Campo, EmptyState, IcoCalendar, IcoPlus, IcoEdit, IcoTrash, IcoUser, IcoUsers, IcoTarget, IcoWallet, IcoCheck } from './ui';

// Modelos rápidos: bundles de vagas por porte de evento (a UI só pré-popula).
const MODELOS: { nome: string; vagas: { funcao: string; necessario: number }[] }[] = [
  { nome: 'Casamento 200 pax', vagas: [{ funcao: 'garcom', necessario: 8 }, { funcao: 'seguranca', necessario: 2 }, { funcao: 'recepcao', necessario: 2 }, { funcao: 'coordenacao', necessario: 1 }, { funcao: 'limpeza', necessario: 2 }] },
  { nome: 'Corporativo 100 pax', vagas: [{ funcao: 'garcom', necessario: 4 }, { funcao: 'recepcao', necessario: 2 }, { funcao: 'seguranca', necessario: 1 }, { funcao: 'coordenacao', necessario: 1 }] },
  { nome: 'Festa / aniversário', vagas: [{ funcao: 'garcom', necessario: 3 }, { funcao: 'bar', necessario: 1 }, { funcao: 'limpeza', necessario: 1 }] },
];

type EscalaForm = { data: string; turno: string; funcao: string; necessario: string; valor_diaria_ref_num: string; obs: string };

export default function EscalaTab({ bag }: { bag: PontoBag }) {
  const toast = useToast();
  const { userId, escalas, eventos, freelancers, equipe, alocsPorEscala, equipeById, freelaById, recarregar } = bag;
  const hoje = ymd(new Date());

  const [eventoSel, setEventoSel] = useState<string>('');
  const [escalaModal, setEscalaModal] = useState<{ editing: Escala | null } | null>(null);
  const [convocarPara, setConvocarPara] = useState<Escala | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const eventoAtual = useMemo(() => eventos.find((e) => e.id === eventoSel) || null, [eventos, eventoSel]);

  // Escalas do evento selecionado (ou todas as "sem evento" quando vazio).
  const escalasDoEvento = useMemo(() => {
    const arr = escalas.filter((s) => (eventoSel ? s.evento_id === eventoSel : !s.evento_id));
    return arr.sort((a, b) => (a.data || '').localeCompare(b.data || '') || funcaoLabel(a.funcao).localeCompare(funcaoLabel(b.funcao)));
  }, [escalas, eventoSel]);

  const resumo = useMemo(() => {
    let vagas = 0, preenchidas = 0, custo = 0;
    for (const s of escalasDoEvento) {
      const alocs = alocsPorEscala.get(s.id) || [];
      const c = coberturaEscala(s.necessario, alocs);
      vagas += c.necessario; preenchidas += c.preenchidas; custo += custoPrevistoEscala(alocs);
    }
    return { escalas: escalasDoEvento.length, vagas, preenchidas, faltam: Math.max(0, vagas - preenchidas), custo };
  }, [escalasDoEvento, alocsPorEscala]);

  async function salvarEscala(form: EscalaForm, editing: Escala | null) {
    const payload = {
      usuario_id: userId, evento_id: eventoSel || null, propriedade_id: eventoAtual?.propriedade_id || null,
      data: form.data || hoje, turno: form.turno, funcao: form.funcao,
      necessario: Math.max(0, Math.floor(Number(form.necessario) || 0)),
      valor_diaria_ref_num: form.valor_diaria_ref_num ? Number(form.valor_diaria_ref_num) : 0, obs: form.obs.trim() || null,
    };
    const { error } = editing
      ? await sb.from('escalas').update(payload).eq('id', editing.id).eq('usuario_id', userId)
      : await sb.from('escalas').insert(payload);
    if (error) { toast.error('Não foi possível salvar a escala.'); return false; }
    toast.success(editing ? 'Escala atualizada.' : 'Vaga adicionada à escala.');
    await recarregar();
    return true;
  }

  async function aplicarModelo(vagas: { funcao: string; necessario: number }[]) {
    const rows = vagas.map((v) => ({
      usuario_id: userId, evento_id: eventoSel || null, propriedade_id: eventoAtual?.propriedade_id || null,
      data: eventoAtual?.data_inicio?.slice(0, 10) || hoje, turno: 'integral', funcao: v.funcao, necessario: v.necessario, valor_diaria_ref_num: 0,
    }));
    const { error } = await sb.from('escalas').insert(rows);
    if (error) { toast.error('Não foi possível aplicar o modelo.'); return; }
    toast.success(`${rows.length} vagas adicionadas à escala.`);
    await recarregar();
  }

  async function excluirEscala(s: Escala) {
    const key = `dele:${s.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir a vaga e suas convocações.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const { error } = await sb.from('escalas').delete().eq('id', s.id).eq('usuario_id', userId);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Vaga removida.');
    await recarregar();
  }

  async function mudarStatus(a: EscalaAlocacao, status: string) {
    const r = await patchAloc({ id: a.id, status });
    if (!r.ok) {
      if (r.status === 409) toast.error(`Vaga cheia: ${r.preenchidas}/${r.necessario}. Aumente o necessário ou cancele alguém.`);
      else toast.error(r.error || 'Não foi possível atualizar.');
      return;
    }
    toast.success(`Marcado como ${alocStatusMeta(status).label.toLowerCase()}.`);
    await recarregar();
  }

  async function removerAloc(a: EscalaAlocacao) {
    const key = `dela:${a.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para remover a convocação.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const r = await deleteAloc(a.id);
    if (!r.ok) { toast.error(r.error === 'alocacao_paga' ? 'Diária já paga — não dá para remover.' : 'Não foi possível remover.'); return; }
    toast.success('Convocação cancelada.');
    await recarregar();
  }

  return (
    <div className="space-y-5">
      {/* Seletor de evento + ações */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Evento</span>
            <select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} className={inp}>
              <option value="">— Escalas sem evento —</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </div>
          <button onClick={() => setEscalaModal({ editing: null })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova vaga</button>
        </div>
        {escalasDoEvento.length === 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-black/[0.05] pt-4">
            <span className="text-xs font-semibold text-ink-muted">Modelos rápidos:</span>
            {MODELOS.map((m) => (
              <button key={m.nome} onClick={() => aplicarModelo(m.vagas)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand/40 hover:text-brand">{m.nome}</button>
            ))}
          </div>
        )}
      </div>

      {escalasDoEvento.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi label="Vagas planejadas" value={String(resumo.vagas)} sub={`${resumo.escalas} turnos/funções`} tone="ink" icon={<IcoTarget />} />
          <Kpi label="Preenchidas" value={String(resumo.preenchidas)} tone="verde" icon={<IcoUsers />} />
          <Kpi label="Em aberto" value={String(resumo.faltam)} tone={resumo.faltam > 0 ? 'gold' : 'verde'} icon={<IcoUser />} />
          <Kpi label="Custo previsto" value={formatMoneyShort(resumo.custo)} sub="entra no custo do evento" tone="roxo" icon={<IcoWallet />} />
        </div>
      )}

      {escalasDoEvento.length === 0 ? (
        <EmptyState icon={<IcoCalendar />} title={eventoSel ? 'Sem vagas para este evento' : 'Monte a escala de um evento'} cta={<button onClick={() => setEscalaModal({ editing: null })} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"><IcoPlus /> Adicionar vaga</button>}>
          {eventoSel ? 'Defina as funções × quantidade × turno necessários e convoque pessoas para preencher.' : 'Escolha um evento acima ou use um modelo rápido para começar.'}
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {escalasDoEvento.map((s) => {
            const alocs = alocsPorEscala.get(s.id) || [];
            const cob = coberturaEscala(s.necessario, alocs);
            const vivos = alocs.filter((a) => !alocEncerrada(a.status) || a.status === 'falta');
            const custo = custoPrevistoEscala(alocs);
            const frac = cob.necessario > 0 ? Math.min(1, cob.preenchidas / cob.necessario) : (cob.preenchidas > 0 ? 1 : 0);
            return (
              <div key={s.id} className="rounded-2xl bg-white p-4 shadow-card sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ background: funcaoCor(s.funcao) }}>{funcaoLabel(s.funcao).slice(0, 3)}</span>
                    <div>
                      <div className="font-bold text-ink">{funcaoLabel(s.funcao)}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-ink-muted">
                        <span>{formatDate(s.data, { style: 'short' })}</span>
                        <span>· {turnoLabel(s.turno)}</span>
                        {s.valor_diaria_ref_num > 0 && <span>· {formatMoney(s.valor_diaria_ref_num)}/diária</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${cob.completa ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {cob.preenchidas}/{cob.necessario}{cob.excedido ? ' ⚠' : ''}
                    </span>
                    <button onClick={() => setEscalaModal({ editing: s })} aria-label="Editar vaga" className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 text-ink-muted hover:border-brand hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => excluirEscala(s)} aria-label="Excluir vaga" className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs ${confirmKey === `dele:${s.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-black/10 text-red-600 hover:border-red-300'}`}><IcoTrash /></button>
                  </div>
                </div>

                {/* Barra de cobertura */}
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/[0.05]">
                  <div className={`h-full rounded-full ${cob.completa ? 'bg-emerald-500' : 'bg-amber-400'}`} style={{ width: `${frac * 100}%` }} />
                </div>

                {/* Pessoas alocadas */}
                <div className="mt-3 flex flex-wrap gap-2">
                  {vivos.length === 0 && <span className="text-xs text-ink-muted">Ninguém convocado ainda.</span>}
                  {vivos.map((a) => {
                    const p = pessoaDaAloc(a, equipeById, freelaById);
                    const meta = alocStatusMeta(a.status);
                    return (
                      <div key={a.id} className="group inline-flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white py-1 pl-1 pr-2 text-xs">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-[0.6rem] font-bold text-white" style={{ background: p.tipo === 'freelancer' ? '#8b5cf6' : '#0ca678' }}>{p.nome.slice(0, 2).toUpperCase()}</span>
                        <span className="font-semibold text-ink-soft">{p.nome.split(' ')[0]}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${meta.chip}`}>{meta.label}</span>
                        <AlocActions a={a} onStatus={mudarStatus} onRemove={removerAloc} confirmKey={confirmKey} />
                      </div>
                    );
                  })}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5">
                  <span className="text-xs text-ink-muted">Custo previsto: <strong className="text-ink-soft">{formatMoney(custo)}</strong></span>
                  <button onClick={() => setConvocarPara(s)} disabled={cob.completa} title={cob.completa ? 'Vaga completa' : 'Convocar pessoa'} className="inline-flex items-center gap-1 rounded-lg bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/20 disabled:opacity-40"><IcoPlus /> Convocar</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {escalaModal && <EscalaModal editing={escalaModal.editing} defaultData={eventoAtual?.data_inicio?.slice(0, 10) || hoje} onClose={() => setEscalaModal(null)} onSave={salvarEscala} />}
      {convocarPara && <ConvocarModal escala={convocarPara} equipe={equipe} freelancers={freelancers} jaAlocados={(alocsPorEscala.get(convocarPara.id) || [])} onClose={() => setConvocarPara(null)} onDone={recarregar} />}
    </div>
  );
}

// ── Ações rápidas de uma alocação (confirmar/presença/falta/remover) ──────────
function AlocActions({ a, onStatus, onRemove, confirmKey }: { a: EscalaAlocacao; onStatus: (a: EscalaAlocacao, s: string) => void; onRemove: (a: EscalaAlocacao) => void; confirmKey: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative">
      <button onClick={() => setOpen((v) => !v)} aria-label="Ações" className="flex h-5 w-5 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.06]">⋯</button>
      {open && (
        <>
          <span className="fixed inset-0 z-[5]" onClick={() => setOpen(false)} />
          <span className="absolute right-0 top-6 z-[6] flex w-36 flex-col rounded-xl border border-black/[0.08] bg-white p-1 text-left shadow-pop">
            {a.status === 'convocado' && <MenuBtn onClick={() => { setOpen(false); onStatus(a, 'confirmado'); }}>Confirmar</MenuBtn>}
            {(a.status === 'convocado' || a.status === 'confirmado') && <MenuBtn onClick={() => { setOpen(false); onStatus(a, 'presente'); }}>Marcar presença</MenuBtn>}
            {(a.status === 'convocado' || a.status === 'confirmado') && <MenuBtn onClick={() => { setOpen(false); onStatus(a, 'falta'); }} tone="amber">Marcar falta</MenuBtn>}
            {a.status === 'falta' && <MenuBtn onClick={() => { setOpen(false); onStatus(a, 'convocado'); }}>Reconvocar</MenuBtn>}
            <MenuBtn onClick={() => { setOpen(false); onRemove(a); }} tone="red">{confirmKey === `dela:${a.id}` ? 'Confirmar?' : 'Cancelar'}</MenuBtn>
          </span>
        </>
      )}
    </span>
  );
}
function MenuBtn({ children, onClick, tone }: { children: React.ReactNode; onClick: () => void; tone?: 'red' | 'amber' }) {
  const c = tone === 'red' ? 'text-red-600 hover:bg-red-50' : tone === 'amber' ? 'text-amber-700 hover:bg-amber-50' : 'text-ink-soft hover:bg-black/[0.04]';
  return <button onClick={onClick} className={`rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold ${c}`}>{children}</button>;
}

// ── Modal: nova/editar vaga (escala) ──────────────────────────────────────────
function EscalaModal({ editing, defaultData, onClose, onSave }: { editing: Escala | null; defaultData: string; onClose: () => void; onSave: (f: EscalaForm, e: Escala | null) => Promise<boolean> }) {
  const [form, setForm] = useState<EscalaForm>(editing ? {
    data: editing.data, turno: String(editing.turno), funcao: String(editing.funcao), necessario: String(editing.necessario),
    valor_diaria_ref_num: editing.valor_diaria_ref_num ? String(editing.valor_diaria_ref_num) : '', obs: editing.obs || '',
  } : { data: defaultData, turno: 'integral', funcao: 'garcom', necessario: '1', valor_diaria_ref_num: '', obs: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof EscalaForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <ModalShell onClose={onClose} maxW="max-w-md">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editing ? 'Editar vaga' : 'Nova vaga na escala'}</h3>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Função"><select className={inp} value={form.funcao} onChange={(e) => set('funcao', e.target.value)}>{FUNCOES.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select></Campo>
        <Campo label="Quantidade"><input type="number" min={0} className={inp} value={form.necessario} onChange={(e) => set('necessario', e.target.value)} /></Campo>
        <Campo label="Data"><input type="date" className={inp} value={form.data} onChange={(e) => set('data', e.target.value)} /></Campo>
        <Campo label="Turno"><select className={inp} value={form.turno} onChange={(e) => set('turno', e.target.value)}>{TURNOS.map((t) => <option key={t.v} value={t.v}>{t.label} ({t.inicio}–{t.fim})</option>)}</select></Campo>
        <Campo label="Diária de referência" full hint="Valor sugerido por pessoa nesta vaga."><input type="number" min={0} step="0.01" className={inp} value={form.valor_diaria_ref_num} onChange={(e) => set('valor_diaria_ref_num', e.target.value)} /></Campo>
        <Campo label="Observações" full><input className={inp} value={form.obs} onChange={(e) => set('obs', e.target.value)} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={async () => { setSaving(true); const ok = await onSave(form, editing); setSaving(false); if (ok) onClose(); }} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// ── Modal: convocar pessoa (fixo ou freelancer) ───────────────────────────────
function ConvocarModal({ escala, equipe, freelancers, jaAlocados, onClose, onDone }: {
  escala: Escala; equipe: EquipeLite[]; freelancers: EscalaBagFreela[]; jaAlocados: EscalaAlocacao[]; onClose: () => void; onDone: () => Promise<void>;
}) {
  const toast = useToast();
  const [tipo, setTipo] = useState<'freelancer' | 'fixo'>('freelancer');
  const janela = turnoJanela(escala.turno);
  const [pessoaId, setPessoaId] = useState('');
  const [horaIni, setHoraIni] = useState(janela.inicio || '08:00');
  const [horaFim, setHoraFim] = useState(janela.fim || '18:00');
  const [diaria, setDiaria] = useState(escala.valor_diaria_ref_num ? String(escala.valor_diaria_ref_num) : '');
  const [saving, setSaving] = useState(false);

  // IDs já ocupando a vaga (não reconvocar a mesma pessoa).
  const fixosUsados = new Set(jaAlocados.filter((a) => ocupaVaga(a.status) && a.equipe_id != null).map((a) => Number(a.equipe_id)));
  const freelasUsados = new Set(jaAlocados.filter((a) => ocupaVaga(a.status) && a.freelancer_id).map((a) => a.freelancer_id as string));

  // Sugere freelancers da mesma função primeiro.
  const freelasOrdenados = useMemo(() => {
    return [...freelancers].filter((f) => f.ativo && !freelasUsados.has(f.id))
      .sort((a, b) => Number(b.funcao === escala.funcao) - Number(a.funcao === escala.funcao) || a.nome.localeCompare(b.nome));
  }, [freelancers, escala.funcao]);
  const fixosDisp = useMemo(() => equipe.filter((e) => e.status !== 'afastado' && !fixosUsados.has(e.id)).sort((a, b) => a.nome.localeCompare(b.nome)), [equipe]);

  // Pré-seleciona diária do freelancer escolhido.
  function onPickFreela(id: string) {
    setPessoaId(id);
    const f = freelancers.find((x) => x.id === id);
    if (f && !diaria) setDiaria(String(f.valor_diaria_num || ''));
  }

  async function convocar() {
    if (!pessoaId) { toast.error('Selecione uma pessoa.'); return; }
    setSaving(true);
    const r = await postAloc({
      escala_id: escala.id,
      ...(tipo === 'fixo' ? { equipe_id: Number(pessoaId) } : { freelancer_id: pessoaId }),
      inicio_previsto: combinarDataHora(escala.data, horaIni),
      fim_previsto: combinarDataHora(escala.data, horaFim),
      valor_diaria_num: diaria ? Number(diaria) : undefined,
      status: 'convocado',
    });
    setSaving(false);
    if (!r.ok) {
      if (r.status === 409 && r.error === 'superalocacao') toast.error(`Vaga cheia (${r.preenchidas}/${r.necessario}). Aumente o necessário para convocar mais.`);
      else if (r.error === 'duplicada') toast.error('Essa pessoa já está nesta vaga.');
      else toast.error(r.error || 'Não foi possível convocar.');
      return;
    }
    toast.success('Pessoa convocada.');
    await onDone();
    onClose();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-md">
      <h3 className="font-display text-xl font-bold text-ink">Convocar para {funcaoLabel(escala.funcao)}</h3>
      <p className="mt-1 text-xs text-ink-muted">{formatDate(escala.data, { style: 'short' })} · {turnoLabel(escala.turno)}</p>

      <div className="mt-4 flex gap-1 rounded-xl bg-black/[0.04] p-1">
        {(['freelancer', 'fixo'] as const).map((t) => (
          <button key={t} onClick={() => { setTipo(t); setPessoaId(''); }} className={`flex-1 rounded-lg py-1.5 text-sm font-semibold transition ${tipo === t ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}>
            {t === 'freelancer' ? 'Freelancer' : 'Equipe fixa'}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        <Campo label={tipo === 'freelancer' ? 'Freelancer' : 'Colaborador'}>
          {tipo === 'freelancer' ? (
            freelasOrdenados.length === 0
              ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum freelancer disponível. Cadastre na aba Freelancers.</p>
              : <select className={inp} value={pessoaId} onChange={(e) => onPickFreela(e.target.value)}>
                  <option value="">Selecione…</option>
                  {freelasOrdenados.map((f) => <option key={f.id} value={f.id}>{f.nome} · {funcaoLabel(f.funcao)}{f.valor_diaria_num ? ` · ${formatMoney(f.valor_diaria_num)}` : ''}</option>)}
                </select>
          ) : (
            fixosDisp.length === 0
              ? <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum colaborador disponível. Cadastre em /painel/equipe.</p>
              : <select className={inp} value={pessoaId} onChange={(e) => setPessoaId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {fixosDisp.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` · ${e.cargo}` : ''}</option>)}
                </select>
          )}
        </Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Entrada prevista"><input type="time" className={inp} value={horaIni} onChange={(e) => setHoraIni(e.target.value)} /></Campo>
          <Campo label="Saída prevista"><input type="time" className={inp} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} /></Campo>
        </div>
        <Campo label="Diária / cachê" hint="Fotografada na convocação; alimenta o custo e o pagamento."><input type="number" min={0} step="0.01" className={inp} value={diaria} onChange={(e) => setDiaria(e.target.value)} /></Campo>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={convocar} disabled={saving || !pessoaId} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"><IcoCheck /> {saving ? 'Convocando…' : 'Convocar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

type EscalaBagFreela = PontoBag['freelancers'][number];

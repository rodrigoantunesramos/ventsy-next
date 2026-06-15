'use client';

// Recrutamento & Seleção — /painel/rh/recrutamento.
// Vagas (com link público /vagas/[slug]) + funil Kanban de candidatos
// (triagem→entrevista→teste→proposta→contratado/reprovado), banco de talentos e
// triagem por IA (opcional). Persiste a etapa do candidato a cada movimento.
// Dados: rh_vagas, rh_candidatos (RLS). Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatMoneyShort } from '@/lib/format';
import { ETAPAS, taxaConversao } from '@/lib/rh';
import {
  useRh, mapVaga, mapCand, SEL_VAGA, SEL_CAND, slugify, triagemIA, inp,
  TIPO_CONTRATO_VAGA, DEPARTAMENTOS, ETAPA_CLS, VAGA_STATUS_CLS, type Vaga, type Candidato,
} from '../_lib';
import { Kpi, Card, Chip, EmptyState, ModalShell, Campo, btnPrimary, btnSecondary, IcoBriefcase, IcoPlus, IcoLink, IcoSparkles, IcoStar, IcoChevron } from '../_components/ui';

type View = 'vagas' | 'funil';

export default function RecrutamentoPage() {
  const { userId } = useRh();
  const toast = useToast();
  const [view, setView] = useState<View>('vagas');
  const [vagas, setVagas] = useState<Vaga[]>([]);
  const [cands, setCands] = useState<Candidato[]>([]);
  const [loading, setLoading] = useState(true);

  const [vagaModal, setVagaModal] = useState<{ open: boolean; v?: Vaga }>({ open: false });
  const [candModal, setCandModal] = useState(false);
  const [iaBusy, setIaBusy] = useState<string | null>(null);

  async function carregar() {
    const [v, c] = await Promise.all([
      sb.from('rh_vagas').select(SEL_VAGA).eq('usuario_id', userId).order('criado_em', { ascending: false }),
      sb.from('rh_candidatos').select(SEL_CAND).eq('usuario_id', userId).order('criado_em', { ascending: false }),
    ]);
    setVagas(v.error ? [] : (v.data || []).map(mapVaga));
    setCands(c.error ? [] : (c.data || []).map(mapCand));
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const etapasCount = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of cands) acc[c.etapa] = (acc[c.etapa] ?? 0) + 1;
    return acc;
  }, [cands]);
  const vagaTitulo = (id: string | null) => vagas.find((v) => v.id === id)?.titulo ?? 'Banco de talentos';

  async function moverEtapa(c: Candidato, etapa: Candidato['etapa']) {
    setCands((arr) => arr.map((x) => (x.id === c.id ? { ...x, etapa } : x)));
    const { error } = await sb.from('rh_candidatos').update({ etapa }).eq('id', c.id).eq('usuario_id', userId);
    if (error) { toast.error('Não foi possível mover o candidato.'); carregar(); }
  }
  async function setNota(c: Candidato, nota: number) {
    setCands((arr) => arr.map((x) => (x.id === c.id ? { ...x, nota } : x)));
    await sb.from('rh_candidatos').update({ nota }).eq('id', c.id).eq('usuario_id', userId);
  }
  async function excluirCand(c: Candidato) {
    if (!confirm(`Remover ${c.nome} do funil?`)) return;
    await sb.from('rh_candidatos').delete().eq('id', c.id).eq('usuario_id', userId);
    setCands((arr) => arr.filter((x) => x.id !== c.id));
  }
  async function rodarIA(c: Candidato) {
    setIaBusy(c.id);
    const vaga = vagas.find((v) => v.id === c.vaga_id);
    const r = await triagemIA({ candidatoId: c.id, nome: c.nome, curriculo: c.obs || c.curriculo_url || '', vagaTitulo: vaga?.titulo, requisitos: vaga?.requisitos || '' });
    setIaBusy(null);
    if (!r.ok || !r.resumo) { toast.error('Triagem por IA indisponível agora.'); return; }
    await sb.from('rh_candidatos').update({ ia_resumo: r.resumo }).eq('id', c.id).eq('usuario_id', userId);
    setCands((arr) => arr.map((x) => (x.id === c.id ? { ...x, ia_resumo: r.resumo! } : x)));
    toast.success('Resumo gerado pela IA.');
  }

  if (loading) return <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Vagas abertas" value={String(vagas.filter((v) => v.status === 'aberta').length)} tone="verde" icon={<IcoBriefcase />} />
        <Kpi label="Candidatos" value={String(cands.length)} tone="azul" />
        <Kpi label="No funil" value={String(cands.filter((c) => ['triagem', 'entrevista', 'teste', 'proposta'].includes(c.etapa)).length)} tone="roxo" />
        <Kpi label="Conversão" value={`${Math.round(taxaConversao(etapasCount) * 100)}%`} tone="gold" hint="contratados / total" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-black/[0.04] p-0.5 text-sm font-semibold">
          {(['vagas', 'funil'] as View[]).map((v) => (
            <button key={v} onClick={() => setView(v)} className={`rounded-lg px-4 py-1.5 transition ${view === v ? 'bg-white text-ink shadow-sm' : 'text-ink-muted'}`}>{v === 'vagas' ? 'Vagas' : 'Funil de candidatos'}</button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {view === 'vagas'
            ? <button onClick={() => setVagaModal({ open: true })} className={btnPrimary}><IcoPlus /> Nova vaga</button>
            : <button onClick={() => setCandModal(true)} className={btnPrimary}><IcoPlus /> Novo candidato</button>}
        </div>
      </div>

      {/* ── VAGAS ── */}
      {view === 'vagas' && (
        vagas.length === 0 ? (
          <EmptyState icon={<IcoBriefcase />} title="Abra sua primeira vaga"
            action={<button onClick={() => setVagaModal({ open: true })} className={btnPrimary}><IcoPlus /> Nova vaga</button>}>
            Publique vagas (CLT, freelancer, estágio…) e divulgue o link público para receber candidatos direto no funil.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vagas.map((v) => {
              const nCand = cands.filter((c) => c.vaga_id === v.id).length;
              return (
                <Card key={v.id}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-bold text-ink">{v.titulo}</div>
                      <div className="truncate text-xs text-ink-muted">{v.departamento ?? '—'}{v.local ? ` · ${v.local}` : ''}</div>
                    </div>
                    <Chip cls={VAGA_STATUS_CLS[v.status]}>{v.status}</Chip>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    <Chip cls="bg-black/[0.05] text-ink-soft">{TIPO_CONTRATO_VAGA.find((t) => t.v === v.tipo_contrato)?.label ?? v.tipo_contrato}</Chip>
                    {(v.salario_min || v.salario_max) && <Chip cls="bg-black/[0.05] text-ink-soft">{[v.salario_min, v.salario_max].filter(Boolean).map((x) => formatMoneyShort(x!)).join(' – ')}</Chip>}
                    <Chip cls="bg-black/[0.05] text-ink-soft">{nCand} candidato(s)</Chip>
                  </div>
                  <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-2 text-xs">
                    {v.slug && (
                      <button onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/vagas/${v.slug}`); toast.success('Link público copiado!'); }} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"><IcoLink /> Copiar link</button>
                    )}
                    <button onClick={() => setVagaModal({ open: true, v })} className="ml-auto font-semibold text-ink-soft hover:text-brand">Editar</button>
                  </div>
                </Card>
              );
            })}
          </div>
        )
      )}

      {/* ── FUNIL (Kanban) ── */}
      {view === 'funil' && (
        cands.length === 0 ? (
          <EmptyState icon={<IcoStar />} title="Seu funil está vazio"
            action={<button onClick={() => setCandModal(true)} className={btnPrimary}><IcoPlus /> Novo candidato</button>}>
            Adicione candidatos manualmente ou receba pelo link público da vaga. Mova-os pelas etapas até a contratação.
          </EmptyState>
        ) : (
          <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
            {ETAPAS.map((et) => {
              const lista = cands.filter((c) => c.etapa === et.v);
              return (
                <div key={et.v} className="w-[260px] shrink-0">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <Chip cls={ETAPA_CLS[et.v]}>{et.label}</Chip>
                    <span className="text-xs font-semibold text-ink-muted">{lista.length}</span>
                  </div>
                  <div className="space-y-2 rounded-2xl bg-black/[0.03] p-2">
                    {lista.length === 0 && <p className="px-2 py-4 text-center text-xs text-ink-muted">—</p>}
                    {lista.map((c) => (
                      <div key={c.id} className="rounded-xl bg-white p-3 shadow-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-ink">{c.nome}</div>
                            <div className="truncate text-xs text-ink-muted">{vagaTitulo(c.vaga_id)}</div>
                          </div>
                          <button onClick={() => excluirCand(c)} aria-label="Remover" className="text-ink-muted hover:text-red-600">✕</button>
                        </div>
                        {/* Nota (estrelas) */}
                        <div className="mt-1.5 flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button key={n} onClick={() => setNota(c, n)} aria-label={`Nota ${n}`} className={(c.nota ?? 0) >= n ? 'text-amber-500' : 'text-black/15'}><IcoStar /></button>
                          ))}
                        </div>
                        {c.ia_resumo && <p className="mt-1.5 line-clamp-3 rounded-lg bg-brand-50 px-2 py-1 text-[0.7rem] text-ink-soft">{c.ia_resumo}</p>}
                        <div className="mt-2 flex items-center gap-1.5">
                          <select value={c.etapa} onChange={(e) => moverEtapa(c, e.target.value as Candidato['etapa'])} className="flex-1 rounded-lg border border-black/10 px-2 py-1 text-xs focus:border-brand focus:outline-none">
                            {ETAPAS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
                          </select>
                          <button onClick={() => rodarIA(c)} disabled={iaBusy === c.id} aria-label="Triagem IA" className="flex h-7 w-7 items-center justify-center rounded-lg border border-black/10 text-violet-600 hover:bg-violet-50 disabled:opacity-50"><IcoSparkles /></button>
                        </div>
                        {(c.etapa === 'proposta' || c.etapa === 'contratado') && (
                          <Link href={`/painel/rh/admissao?candidato=${c.id}`} className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Admitir <IcoChevron /></Link>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {vagaModal.open && <VagaModal userId={userId} vaga={vagaModal.v} onClose={() => setVagaModal({ open: false })} onSaved={() => { setVagaModal({ open: false }); carregar(); }} />}
      {candModal && <CandModal userId={userId} vagas={vagas} onClose={() => setCandModal(false)} onSaved={() => { setCandModal(false); carregar(); }} />}
    </div>
  );
}

// ── Modal de vaga ──────────────────────────────────────────────────────────────
function VagaModal({ userId, vaga, onClose, onSaved }: { userId: string; vaga?: Vaga; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    titulo: vaga?.titulo ?? '', departamento: vaga?.departamento ?? 'Operações', tipo_contrato: vaga?.tipo_contrato ?? 'clt',
    salario_min: vaga?.salario_min ? String(vaga.salario_min) : '', salario_max: vaga?.salario_max ? String(vaga.salario_max) : '',
    local: vaga?.local ?? '', vagas: vaga?.vagas ? String(vaga.vagas) : '1', status: vaga?.status ?? 'aberta',
    descricao: vaga?.descricao ?? '', requisitos: vaga?.requisitos ?? '', beneficios: vaga?.beneficios ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function salvar() {
    if (!f.titulo.trim()) { toast.error('Informe o título da vaga.'); return; }
    setSaving(true);
    const payload = {
      titulo: f.titulo.trim(), departamento: f.departamento || null, tipo_contrato: f.tipo_contrato,
      salario_min: f.salario_min ? Number(f.salario_min) : null, salario_max: f.salario_max ? Number(f.salario_max) : null,
      local: f.local || null, vagas: f.vagas ? Number(f.vagas) : 1, status: f.status,
      descricao: f.descricao || null, requisitos: f.requisitos || null, beneficios: f.beneficios || null,
    };
    let error;
    if (vaga) ({ error } = await sb.from('rh_vagas').update(payload).eq('id', vaga.id).eq('usuario_id', userId));
    else ({ error } = await sb.from('rh_vagas').insert({ ...payload, usuario_id: userId, slug: slugify(payload.titulo, Math.random().toString(36).slice(2, 7)) }));
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar a vaga.'); return; }
    toast.success(vaga ? 'Vaga atualizada.' : 'Vaga publicada.');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl" title={vaga ? 'Editar vaga' : 'Nova vaga'}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Título" full><input className={inp} value={f.titulo} onChange={set('titulo')} autoFocus placeholder="Ex.: Garçom para eventos" /></Campo>
        <Campo label="Departamento"><select className={inp} value={f.departamento} onChange={set('departamento')}>{DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}</select></Campo>
        <Campo label="Contrato"><select className={inp} value={f.tipo_contrato} onChange={set('tipo_contrato')}>{TIPO_CONTRATO_VAGA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Campo>
        <Campo label="Salário (mín.)"><input type="number" min={0} className={inp} value={f.salario_min} onChange={set('salario_min')} /></Campo>
        <Campo label="Salário (máx.)"><input type="number" min={0} className={inp} value={f.salario_max} onChange={set('salario_max')} /></Campo>
        <Campo label="Local"><input className={inp} value={f.local} onChange={set('local')} placeholder="Cidade / remoto" /></Campo>
        <Campo label="Nº de vagas"><input type="number" min={1} className={inp} value={f.vagas} onChange={set('vagas')} /></Campo>
        <Campo label="Status"><select className={inp} value={f.status} onChange={set('status')}><option value="aberta">Aberta</option><option value="pausada">Pausada</option><option value="fechada">Fechada</option></select></Campo>
        <Campo label="Descrição" full><textarea className={`${inp} min-h-[64px]`} value={f.descricao} onChange={set('descricao')} /></Campo>
        <Campo label="Requisitos" full><textarea className={`${inp} min-h-[56px]`} value={f.requisitos} onChange={set('requisitos')} /></Campo>
        <Campo label="Benefícios" full><textarea className={`${inp} min-h-[56px]`} value={f.beneficios} onChange={set('beneficios')} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// ── Modal de candidato (manual) ─────────────────────────────────────────────────
function CandModal({ userId, vagas, onClose, onSaved }: { userId: string; vagas: Vaga[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ nome: '', email: '', telefone: '', vaga_id: '', fonte: 'indicacao', curriculo_url: '', obs: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function salvar() {
    if (!f.nome.trim()) { toast.error('Informe o nome.'); return; }
    setSaving(true);
    const { error } = await sb.from('rh_candidatos').insert({
      usuario_id: userId, nome: f.nome.trim(), email: f.email || null, telefone: f.telefone || null,
      vaga_id: f.vaga_id || null, fonte: f.fonte || null, curriculo_url: f.curriculo_url || null, obs: f.obs || null, etapa: 'triagem',
    });
    setSaving(false);
    if (error) { toast.error('Não foi possível adicionar.'); return; }
    toast.success('Candidato adicionado ao funil.');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg" title="Novo candidato">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome" full><input className={inp} value={f.nome} onChange={set('nome')} autoFocus /></Campo>
        <Campo label="E-mail"><input type="email" className={inp} value={f.email} onChange={set('email')} /></Campo>
        <Campo label="Telefone"><input className={inp} value={f.telefone} onChange={set('telefone')} /></Campo>
        <Campo label="Vaga"><select className={inp} value={f.vaga_id} onChange={set('vaga_id')}><option value="">Banco de talentos</option>{vagas.map((v) => <option key={v.id} value={v.id}>{v.titulo}</option>)}</select></Campo>
        <Campo label="Fonte"><select className={inp} value={f.fonte} onChange={set('fonte')}><option value="indicacao">Indicação</option><option value="portal">Portal</option><option value="linkedin">LinkedIn</option><option value="site">Site</option><option value="outro">Outro</option></select></Campo>
        <Campo label="Link do currículo" full><input className={inp} value={f.curriculo_url} onChange={set('curriculo_url')} placeholder="https://" /></Campo>
        <Campo label="Observações / currículo colado" full><textarea className={`${inp} min-h-[72px]`} value={f.obs} onChange={set('obs')} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Adicionar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

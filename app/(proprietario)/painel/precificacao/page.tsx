'use client';

// Precificação & Tabela de preços — /painel/precificacao
// Define COMO cada espaço é cobrado, de forma flexível, alimentando Propostas e
// Reservas pela mesma engine pura (lib/pricing.ts). Pilares:
//   • Tabelas por espaço (valor base + unidade) + calendário de tarifas
//   • Regras dinâmicas (temporada, dia da semana, feriado, tipo de evento,
//     antecedência, duração, nº de convidados) — aplicadas por prioridade
//   • Taxas/adicionais (obrigatórias entram sempre) e Pacotes (preço fechado)
//   • Simulador que usa a MESMA engine da Proposta (breakdown transparente)
// Fonte de dados: precos_tabela, precos_regras, taxas, pacotes (RLS por dono).
// Sem "R$" hardcoded — tudo via lib/format (moeda/idioma do dono).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import type { PrecoTabela, PrecoRegra, Taxa } from '@/lib/pricing';
import {
  BASE_BY, REGRA_TIPO_BY, TAXA_TIPO_BY, unidadeLabel, descreveAjuste, descreveCondicao,
  type Pacote, type Propriedade,
} from './_lib';
import { Icon } from './_components/ui';
import { TabelaModal } from './_components/TabelaModal';
import { RegraModal } from './_components/RegraModal';
import { TaxaModal } from './_components/TaxaModal';
import { PacoteModal } from './_components/PacoteModal';
import { Simulador } from './_components/Simulador';
import { TarifaCalendar } from './_components/TarifaCalendar';

type Tab = 'tabelas' | 'regras' | 'taxas' | 'pacotes' | 'simulador';
type DelTarget = { kind: 'tabela' | 'regra' | 'taxa' | 'pacote'; id: string };

const numOrNull = (v: unknown) => (v == null || v === '' ? null : Number(v));
const propId = (v: unknown) => (v == null ? null : Number(v));

// Tabela ainda não criada (migration pendente). O Postgres cru devolve 42P01,
// mas a API REST (PostgREST) devolve 404 com code PGRST205 ("table not found in
// schema cache") — tratamos ambos para mostrar o aviso de setup, não tela vazia.
function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205' || err.code === 'PGRST202'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '');
}

export default function PrecificacaoPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [tabelas, setTabelas] = useState<PrecoTabela[]>([]);
  const [regras, setRegras] = useState<PrecoRegra[]>([]);
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);

  const [tab, setTab] = useState<Tab>('tabelas');
  const [propFiltro, setPropFiltro] = useState<string>('all');
  const [confirmDel, setConfirmDel] = useState<DelTarget | null>(null);

  // Modais (cada um: alvo de edição ou null para "novo")
  const [tabelaModal, setTabelaModal] = useState<{ editando: PrecoTabela | null } | null>(null);
  const [regraModal, setRegraModal] = useState<{ editando: PrecoRegra | null; defaultTabelaId?: string } | null>(null);
  const [taxaModal, setTaxaModal] = useState<{ editando: Taxa | null } | null>(null);
  const [pacoteModal, setPacoteModal] = useState<{ editando: Pacote | null } | null>(null);

  const carregar = useCallback(async (uid: string) => {
    const [tRes, rRes, xRes, pRes, propRes] = await Promise.all([
      sb.from('precos_tabela').select('*').eq('usuario_id', uid).order('criado_em', { ascending: true }),
      sb.from('precos_regras').select('*').eq('usuario_id', uid),
      sb.from('taxas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: true }),
      sb.from('pacotes').select('*').eq('usuario_id', uid).order('criado_em', { ascending: true }),
      sb.from('propriedades').select('id,nome').eq('usuario_id', uid).order('id'),
    ]);

    if (isMissingTable(tRes.error) || isMissingTable(rRes.error)) {
      setNeedsSetup(true);
      setTabelas([]); setRegras([]); setTaxas([]); setPacotes([]);
      setPropriedades(((propRes.data || []) as Propriedade[]));
      return;
    }
    setNeedsSetup(false);
    setPropriedades((propRes.data || []) as Propriedade[]);
    setTabelas(((tRes.data || []) as PrecoTabela[]).map((r) => ({
      ...r, valor_base_num: Number(r.valor_base_num) || 0,
      custo_num: numOrNull(r.custo_num), concorrencia_num: numOrNull(r.concorrencia_num),
      propriedade_id: propId(r.propriedade_id), espaco_id: propId(r.espaco_id),
    })));
    setRegras(((rRes.data || []) as PrecoRegra[]).map((r) => ({
      ...r, ajuste_valor: Number(r.ajuste_valor) || 0, prioridade: Number(r.prioridade) || 0, condicao: r.condicao || {},
    })));
    setTaxas(((xRes.data || []) as Taxa[]).map((r) => ({ ...r, valor: Number(r.valor) || 0, propriedade_id: propId(r.propriedade_id) })));
    setPacotes(((pRes.data || []) as Pacote[]).map((r) => ({
      ...r, valor_num: Number(r.valor_num) || 0, itens: Array.isArray(r.itens) ? r.itens : [], propriedade_id: propId(r.propriedade_id),
    })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const refetch = useCallback(() => { if (userId) carregar(userId); }, [userId, carregar]);

  const propNome = useCallback(
    (id: number | null) => (id == null ? 'Padrão da conta' : propriedades.find((p) => p.id === id)?.nome || `Espaço #${id}`),
    [propriedades],
  );

  // ── Filtro por espaço ──
  const fNum = propFiltro === 'all' ? null : Number(propFiltro);
  const tabelaIds = useMemo(() => new Set(tabelas.filter((t) => fNum == null || t.propriedade_id === fNum).map((t) => t.id)), [tabelas, fNum]);
  const tabelasView = useMemo(() => tabelas.filter((t) => fNum == null || t.propriedade_id === fNum), [tabelas, fNum]);
  const regrasView = useMemo(() => regras.filter((r) => tabelaIds.has(r.tabela_id)), [regras, tabelaIds]);
  const taxasView = useMemo(() => taxas.filter((t) => fNum == null || t.propriedade_id === fNum || t.propriedade_id == null), [taxas, fNum]);
  const pacotesView = useMemo(() => pacotes.filter((p) => fNum == null || p.propriedade_id === fNum), [pacotes, fNum]);

  const regrasPorTabela = useCallback((tid: string) => regras.filter((r) => r.tabela_id === tid).length, [regras]);

  // ── KPIs ──
  const kpis = useMemo(() => ({
    tabelas: tabelas.length, tabelasAtivas: tabelas.filter((t) => t.ativo).length,
    regras: regras.length, regrasAtivas: regras.filter((r) => r.ativo).length,
    taxas: taxas.length, taxasObrig: taxas.filter((t) => t.obrigatoria).length,
    pacotes: pacotes.length,
  }), [tabelas, regras, taxas, pacotes]);

  // ── Handlers ──
  async function remover(target: DelTarget) {
    if (!confirmDel || confirmDel.kind !== target.kind || confirmDel.id !== target.id) {
      setConfirmDel(target);
      setTimeout(() => setConfirmDel((c) => (c?.id === target.id ? null : c)), 3000);
      return;
    }
    const table = { tabela: 'precos_tabela', regra: 'precos_regras', taxa: 'taxas', pacote: 'pacotes' }[target.kind];
    const { error } = await sb.from(table).delete().eq('id', target.id);
    setConfirmDel(null);
    if (error) { toast.error('Não foi possível remover.'); return; }
    if (target.kind === 'tabela') { setTabelas((a) => a.filter((x) => x.id !== target.id)); setRegras((a) => a.filter((r) => r.tabela_id !== target.id)); }
    if (target.kind === 'regra') setRegras((a) => a.filter((x) => x.id !== target.id));
    if (target.kind === 'taxa') setTaxas((a) => a.filter((x) => x.id !== target.id));
    if (target.kind === 'pacote') setPacotes((a) => a.filter((x) => x.id !== target.id));
    toast.success('Removido.');
  }

  async function toggleAtivo(kind: DelTarget['kind'], id: string, atual: boolean) {
    const table = { tabela: 'precos_tabela', regra: 'precos_regras', taxa: 'taxas', pacote: 'pacotes' }[kind];
    const set = { tabela: setTabelas, regra: setRegras, taxa: setTaxas, pacote: setPacotes }[kind] as React.Dispatch<React.SetStateAction<{ id: string; ativo: boolean }[]>>;
    set((a: { id: string; ativo: boolean }[]) => a.map((x) => (x.id === id ? { ...x, ativo: !atual } : x)));
    const { error } = await sb.from(table).update({ ativo: !atual }).eq('id', id);
    if (error) { toast.error('Não foi possível atualizar.'); refetch(); }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[52px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const semTabelas = tabelas.length === 0;
  const novoBtn: Record<Tab, { label: string; onClick: () => void } | null> = {
    tabelas: { label: 'Nova tabela', onClick: () => setTabelaModal({ editando: null }) },
    regras: { label: 'Nova regra', onClick: () => setRegraModal({ editando: null }) },
    taxas: { label: 'Nova taxa', onClick: () => setTaxaModal({ editando: null }) },
    pacotes: { label: 'Novo pacote', onClick: () => setPacoteModal({ editando: null }) },
    simulador: null,
  };

  const TABS: { v: Tab; label: string; icon: Parameters<typeof Icon>[0]['name']; count?: number }[] = [
    { v: 'tabelas', label: 'Tabelas', icon: 'tag', count: kpis.tabelas },
    { v: 'regras', label: 'Regras', icon: 'percent', count: kpis.regras },
    { v: 'taxas', label: 'Taxas', icon: 'receipt', count: kpis.taxas },
    { v: 'pacotes', label: 'Pacotes', icon: 'box', count: kpis.pacotes },
    { v: 'simulador', label: 'Simulador', icon: 'sparkles' },
  ];

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Precificação</h1>
          <p className="mt-1 text-sm text-ink-muted">Defina como cada espaço é cobrado. Alimenta <Link href="/painel/propostas" className="font-semibold text-brand underline">Propostas</Link> e <Link href="/painel/reservas" className="font-semibold text-brand underline">Reservas</Link> pela mesma engine de cálculo.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {propriedades.length > 0 && (
            <select value={propFiltro} onChange={(e) => setPropFiltro(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none">
              <option value="all">Todos os espaços</option>
              {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
          )}
          {novoBtn[tab] && (
            <button onClick={novoBtn[tab]!.onClick} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="plus" size={14} /> {novoBtn[tab]!.label}</button>
          )}
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          As tabelas de precificação ainda não foram criadas. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/precificacao.sql</code> no Supabase para ativar este módulo.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Tabelas de preço" value={String(kpis.tabelas)} sub={`${kpis.tabelasAtivas} ativas`} icon={<Icon name="tag" size={15} />} tone="brand" />
        <Kpi label="Regras dinâmicas" value={String(kpis.regras)} sub={`${kpis.regrasAtivas} ativas`} icon={<Icon name="percent" size={15} />} tone="azul" />
        <Kpi label="Taxas & adicionais" value={String(kpis.taxas)} sub={`${kpis.taxasObrig} obrigatórias`} icon={<Icon name="receipt" size={15} />} tone="ambar" />
        <Kpi label="Pacotes" value={String(kpis.pacotes)} sub="preço fechado" icon={<Icon name="box" size={15} />} tone="verde" />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1.5 shadow-card">
        {TABS.map((t) => (
          <button
            key={t.v} onClick={() => setTab(t.v)}
            className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === t.v ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:bg-black/[0.03] hover:text-ink'}`}
          >
            <Icon name={t.icon} size={15} /> {t.label}
            {t.count != null && t.count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${tab === t.v ? 'bg-white/25' : 'bg-black/[0.06] text-ink-muted'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'tabelas' && (
          <TabelasTab
            tabelas={tabelasView} regras={regras} propNome={propNome} regrasPorTabela={regrasPorTabela}
            empty={semTabelas} confirmDel={confirmDel}
            onNew={() => setTabelaModal({ editando: null })}
            onEdit={(t) => setTabelaModal({ editando: t })}
            onDelete={(id) => remover({ kind: 'tabela', id })}
            onToggle={(id, a) => toggleAtivo('tabela', id, a)}
            onAddRegra={(tid) => setRegraModal({ editando: null, defaultTabelaId: tid })}
          />
        )}
        {tab === 'regras' && (
          <RegrasTab
            regras={regrasView} tabelas={tabelas} confirmDel={confirmDel} semTabelas={semTabelas}
            onNew={() => setRegraModal({ editando: null })}
            onEdit={(r) => setRegraModal({ editando: r })}
            onDelete={(id) => remover({ kind: 'regra', id })}
            onToggle={(id, a) => toggleAtivo('regra', id, a)}
          />
        )}
        {tab === 'taxas' && (
          <TaxasTab
            taxas={taxasView} propNome={propNome} confirmDel={confirmDel}
            onNew={() => setTaxaModal({ editando: null })}
            onEdit={(t) => setTaxaModal({ editando: t })}
            onDelete={(id) => remover({ kind: 'taxa', id })}
            onToggle={(id, a) => toggleAtivo('taxa', id, a)}
          />
        )}
        {tab === 'pacotes' && (
          <PacotesTab
            pacotes={pacotesView} propNome={propNome} confirmDel={confirmDel}
            onNew={() => setPacoteModal({ editando: null })}
            onEdit={(p) => setPacoteModal({ editando: p })}
            onDelete={(id) => remover({ kind: 'pacote', id })}
            onToggle={(id, a) => toggleAtivo('pacote', id, a)}
          />
        )}
        {tab === 'simulador' && <Simulador tabelas={tabelas} regras={regras} taxas={taxas} />}
      </div>

      {/* Modais */}
      {userId && tabelaModal && (
        <TabelaModal userId={userId} editando={tabelaModal.editando} propriedades={propriedades} onClose={() => setTabelaModal(null)} onSaved={() => { setTabelaModal(null); refetch(); }} />
      )}
      {userId && regraModal && (
        <RegraModal userId={userId} editando={regraModal.editando} defaultTabelaId={regraModal.defaultTabelaId} tabelas={tabelas} onClose={() => setRegraModal(null)} onSaved={() => { setRegraModal(null); refetch(); }} />
      )}
      {userId && taxaModal && (
        <TaxaModal userId={userId} editando={taxaModal.editando} propriedades={propriedades} onClose={() => setTaxaModal(null)} onSaved={() => { setTaxaModal(null); refetch(); }} />
      )}
      {userId && pacoteModal && (
        <PacoteModal userId={userId} editando={pacoteModal.editando} propriedades={propriedades} onClose={() => setPacoteModal(null)} onSaved={() => { setPacoteModal(null); refetch(); }} />
      )}
    </div>
  );
}

// ── Tab: Tabelas ──────────────────────────────────────────────────────────────
function TabelasTab({
  tabelas, regras, propNome, regrasPorTabela, empty, confirmDel, onNew, onEdit, onDelete, onToggle, onAddRegra,
}: {
  tabelas: PrecoTabela[]; regras: PrecoRegra[]; propNome: (id: number | null) => string; regrasPorTabela: (tid: string) => number;
  empty: boolean; confirmDel: DelTarget | null; onNew: () => void; onEdit: (t: PrecoTabela) => void; onDelete: (id: string) => void;
  onToggle: (id: string, ativo: boolean) => void; onAddRegra: (tid: string) => void;
}) {
  if (empty) return <EmptyState icon="tag" title="Nenhuma tabela de preço ainda" desc="Crie a primeira tabela definindo o valor base e a unidade de cobrança do seu espaço." cta="Criar primeira tabela" onCta={onNew} />;
  if (tabelas.length === 0) return <FilterEmpty />;
  const ativasComRegra = tabelas.filter((t) => t.ativo);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tabelas.map((t) => {
          const nReg = regrasPorTabela(t.id);
          return (
            <div key={t.id} className={`group rounded-2xl border bg-white p-4 shadow-card transition ${t.ativo ? 'border-black/[0.06]' : 'border-dashed border-black/15 opacity-70'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-ink">{t.nome}</h3>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-muted"><Icon name="building" size={11} /> {propNome(t.propriedade_id)}</p>
                </div>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand">{BASE_BY[t.base].label}</span>
              </div>
              <div className="mt-3 flex items-end justify-between">
                <div>
                  <div className="text-xl font-bold text-ink">{formatMoney(t.valor_base_num, { currency: t.moeda })}</div>
                  <div className="text-[0.68rem] text-ink-muted">{BASE_BY[t.base].sufixo}</div>
                </div>
                <button onClick={() => onAddRegra(t.id)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand/30 hover:text-brand">+ regra</button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.65rem]">
                {nReg > 0 && <span className="rounded-full bg-blue-50 px-2 py-0.5 font-semibold text-blue-700">{nReg} regra{nReg > 1 ? 's' : ''}</span>}
                {t.custo_num != null && <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">margem ativa</span>}
                {t.concorrencia_num != null && <span className="rounded-full bg-black/[0.05] px-2 py-0.5 font-semibold text-ink-muted">vs concorrência</span>}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5">
                <button onClick={() => onToggle(t.id, t.ativo)} className={`text-xs font-semibold ${t.ativo ? 'text-emerald-600' : 'text-ink-muted'}`}>{t.ativo ? '● Ativa' : '○ Inativa'}</button>
                <div className="flex items-center gap-0.5">
                  <IconBtn label="Editar" onClick={() => onEdit(t)}><Icon name="edit" size={13} /></IconBtn>
                  <DelBtn confirming={confirmDel?.kind === 'tabela' && confirmDel.id === t.id} onClick={() => onDelete(t.id)} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {ativasComRegra.length > 0 && <TarifaCalendar tabelas={tabelas} regras={regras} />}
    </div>
  );
}

// ── Tab: Regras ───────────────────────────────────────────────────────────────
function RegrasTab({
  regras, tabelas, confirmDel, semTabelas, onNew, onEdit, onDelete, onToggle,
}: {
  regras: PrecoRegra[]; tabelas: PrecoTabela[]; confirmDel: DelTarget | null; semTabelas: boolean;
  onNew: () => void; onEdit: (r: PrecoRegra) => void; onDelete: (id: string) => void; onToggle: (id: string, ativo: boolean) => void;
}) {
  const tabelaById = useMemo(() => new Map(tabelas.map((t) => [t.id, t])), [tabelas]);
  if (semTabelas) return <EmptyState icon="percent" title="Crie uma tabela primeiro" desc="As regras dinâmicas ajustam o preço de uma tabela base. Comece criando uma tabela de preço." cta="Ir para Tabelas" onCta={onNew} disabledCta />;
  if (regras.length === 0) return <EmptyState icon="percent" title="Nenhuma regra dinâmica" desc="Acrescente fim de semana, alta temporada, feriados, descontos por antecedência e mais." cta="Criar primeira regra" onCta={onNew} />;
  const ordenadas = [...regras].sort((a, b) => b.prioridade - a.prioridade);
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="divide-y divide-black/[0.05]">
        {ordenadas.map((r) => {
          const tabela = tabelaById.get(r.tabela_id);
          const moeda = tabela?.moeda ?? 'BRL';
          return (
            <div key={r.id} className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.01] ${r.ativo ? '' : 'opacity-60'}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.03] text-base">{REGRA_TIPO_BY[r.tipo].icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold text-ink">{r.nome || REGRA_TIPO_BY[r.tipo].label}</span>
                  <span className="hidden rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.6rem] font-semibold text-ink-muted sm:inline">{tabela?.nome || '—'}</span>
                </div>
                <div className="mt-0.5 truncate text-xs text-ink-muted">{REGRA_TIPO_BY[r.tipo].label} · {descreveCondicao(r)}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className={`text-sm font-bold ${r.ajuste_tipo === 'percentual' ? (r.ajuste_valor < 0 ? 'text-emerald-600' : 'text-amber-600') : 'text-ink'}`}>{descreveAjuste(r.ajuste_tipo, r.ajuste_valor, moeda)}</div>
                <div className="text-[0.62rem] text-ink-muted">prioridade {r.prioridade}</div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                <button onClick={() => onToggle(r.id, r.ativo)} title={r.ativo ? 'Desativar' : 'Ativar'} className={`mr-1 h-2.5 w-2.5 rounded-full ${r.ativo ? 'bg-emerald-500' : 'bg-black/15'}`} />
                <IconBtn label="Editar" onClick={() => onEdit(r)}><Icon name="edit" size={13} /></IconBtn>
                <DelBtn confirming={confirmDel?.kind === 'regra' && confirmDel.id === r.id} onClick={() => onDelete(r.id)} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Tab: Taxas ────────────────────────────────────────────────────────────────
function TaxasTab({
  taxas, propNome, confirmDel, onNew, onEdit, onDelete, onToggle,
}: {
  taxas: Taxa[]; propNome: (id: number | null) => string; confirmDel: DelTarget | null;
  onNew: () => void; onEdit: (t: Taxa) => void; onDelete: (id: string) => void; onToggle: (id: string, ativo: boolean) => void;
}) {
  if (taxas.length === 0) return <EmptyState icon="receipt" title="Nenhuma taxa cadastrada" desc="Catalogue limpeza, segurança, energia, caução, hora extra — marque as obrigatórias para entrarem no total automaticamente." cta="Criar primeira taxa" onCta={onNew} />;
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card">
      <div className="divide-y divide-black/[0.05]">
        {taxas.map((t) => (
          <div key={t.id} className={`group flex items-center gap-3 px-4 py-3 transition hover:bg-black/[0.01] ${t.ativo === false ? 'opacity-60' : ''}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-black/[0.03] text-ink-muted"><Icon name="receipt" size={15} /></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink">{t.nome}</span>
                {t.obrigatoria && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand">obrigatória</span>}
                {t.reembolsavel && <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[0.6rem] font-semibold text-blue-700">reembolsável</span>}
              </div>
              <div className="mt-0.5 text-xs text-ink-muted">{propNome(t.propriedade_id)}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-sm font-bold text-ink">{t.tipo === 'percentual' ? formatPercent(t.valor / 100, { maximumFractionDigits: 1 }) : formatMoney(t.valor)}</div>
              <div className="text-[0.62rem] text-ink-muted">{TAXA_TIPO_BY[t.tipo].label}</div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button onClick={() => onToggle(t.id, t.ativo !== false)} title={t.ativo !== false ? 'Desativar' : 'Ativar'} className={`mr-1 h-2.5 w-2.5 rounded-full ${t.ativo !== false ? 'bg-emerald-500' : 'bg-black/15'}`} />
              <IconBtn label="Editar" onClick={() => onEdit(t)}><Icon name="edit" size={13} /></IconBtn>
              <DelBtn confirming={confirmDel?.kind === 'taxa' && confirmDel.id === t.id} onClick={() => onDelete(t.id)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Tab: Pacotes ──────────────────────────────────────────────────────────────
function PacotesTab({
  pacotes, propNome, confirmDel, onNew, onEdit, onDelete, onToggle,
}: {
  pacotes: Pacote[]; propNome: (id: number | null) => string; confirmDel: DelTarget | null;
  onNew: () => void; onEdit: (p: Pacote) => void; onDelete: (id: string) => void; onToggle: (id: string, ativo: boolean) => void;
}) {
  if (pacotes.length === 0) return <EmptyState icon="box" title="Nenhum pacote montado" desc="Monte combos de preço fechado (espaço + buffet + som) para vender mais rápido." cta="Criar primeiro pacote" onCta={onNew} />;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {pacotes.map((p) => (
        <div key={p.id} className={`group flex flex-col rounded-2xl border bg-white p-4 shadow-card transition ${p.ativo ? 'border-black/[0.06]' : 'border-dashed border-black/15 opacity-70'}`}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-bold text-ink">{p.nome}</h3>
            <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.6rem] font-semibold text-ink-muted">{p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}</span>
          </div>
          {p.descricao && <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{p.descricao}</p>}
          {p.itens.length > 0 && (
            <ul className="mt-2 space-y-0.5 text-xs text-ink-soft">
              {p.itens.slice(0, 3).map((it, i) => <li key={i} className="flex items-center gap-1.5"><span className="text-brand">•</span><span className="truncate">{it.descricao}</span></li>)}
              {p.itens.length > 3 && <li className="text-ink-muted">+{p.itens.length - 3} mais…</li>}
            </ul>
          )}
          <div className="mt-3 flex items-end justify-between border-t border-black/[0.05] pt-2.5">
            <div>
              <div className="text-lg font-bold text-ink">{formatMoney(p.valor_num)}</div>
              <div className="text-[0.62rem] text-ink-muted">{propNome(p.propriedade_id)}</div>
            </div>
            <div className="flex items-center gap-0.5">
              <button onClick={() => onToggle(p.id, p.ativo)} title={p.ativo ? 'Desativar' : 'Ativar'} className={`mr-1 h-2.5 w-2.5 rounded-full ${p.ativo ? 'bg-emerald-500' : 'bg-black/15'}`} />
              <IconBtn label="Editar" onClick={() => onEdit(p)}><Icon name="edit" size={13} /></IconBtn>
              <DelBtn confirming={confirmDel?.kind === 'pacote' && confirmDel.id === p.id} onClick={() => onDelete(p.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-componentes compartilhados ───────────────────────────────────────────
function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: ReactNode; tone: 'brand' | 'azul' | 'ambar' | 'verde' }) {
  const bg = { brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', ambar: 'bg-amber-50 text-amber-600', verde: 'bg-emerald-50 text-emerald-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bg}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

function IconBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} title={label} aria-label={label} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-black/[0.04] hover:text-brand">{children}</button>;
}
function DelBtn({ confirming, onClick }: { confirming: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={confirming ? 'Confirmar exclusão' : 'Remover'} aria-label="Remover" className={`rounded-lg px-1.5 py-1.5 text-xs font-bold transition ${confirming ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}>
      {confirming ? 'Confirmar?' : <Icon name="trash" size={13} />}
    </button>
  );
}

function EmptyState({ icon, title, desc, cta, onCta, disabledCta }: { icon: Parameters<typeof Icon>[0]['name']; title: string; desc: string; cta: string; onCta: () => void; disabledCta?: boolean }) {
  return (
    <div className="rounded-2xl bg-white py-14 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name={icon} size={26} /></div>
      <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mb-5 max-w-md px-6 text-xs text-ink-muted">{desc}</p>
      {!disabledCta && <button onClick={onCta} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="plus" size={14} /> {cta}</button>}
    </div>
  );
}
function FilterEmpty() {
  return <div className="rounded-2xl bg-white py-12 text-center text-sm text-ink-muted shadow-card">Nenhum item para o espaço selecionado.</div>;
}

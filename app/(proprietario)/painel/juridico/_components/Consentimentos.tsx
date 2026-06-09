'use client';

// Aba "Consentimentos" (LGPD) — registro de quando/como cada titular consentiu, a
// FINALIDADE, a BASE LEGAL (LGPD art. 7/11) e o CANAL de origem (formulário,
// ingresso, portal, contrato…). Registrar o consentimento na origem é critério de
// aceite; revogar grava `revogado_em`. CRUD via RLS. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type JuridicoBag, type Consentimento, type TitularTipo, type BaseLegal, type CanalConsentimento,
  BASES_LEGAIS, baseLegalLabel, CANAIS_CONSENTIMENTO, canalConsentimentoLabel,
  TITULAR_TIPOS, titularTipoLabel, consentimentoAtivo,
  criarConsentimento, salvarConsentimento, excluirConsentimento, exportCSV, inp, selCls,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, EmptyState, StatusPill, SectionCard,
  IcoUserCheck, IcoPlus, IcoEdit, IcoTrash, IcoDownload, IcoSearch, IcoX, IcoCheck, btnPrimary, btnSecondary,
} from './ui';

type FAtivo = 'todos' | 'ativos' | 'revogados';

export default function Consentimentos({ bag }: { bag: JuridicoBag }) {
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [fTipo, setFTipo] = useState<TitularTipo | 'todos'>('todos');
  const [fBase, setFBase] = useState<BaseLegal | 'todas'>('todas');
  const [fAtivo, setFAtivo] = useState<FAtivo>('todos');
  const [edit, setEdit] = useState<Consentimento | 'novo' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return bag.consentimentos.filter((c) => {
      const ativo = consentimentoAtivo(c);
      if (fAtivo === 'ativos' && !ativo) return false;
      if (fAtivo === 'revogados' && ativo) return false;
      if (fTipo !== 'todos' && c.titular_tipo !== fTipo) return false;
      if (fBase !== 'todas' && c.base_legal !== fBase) return false;
      if (q && !(`${c.titular_nome || ''} ${c.finalidade || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [bag.consentimentos, busca, fTipo, fBase, fAtivo]);

  const ativos = bag.consentimentos.filter(consentimentoAtivo).length;

  const onExport = () => exportCSV(
    `consentimentos-${bag.hoje}.csv`,
    ['Titular', 'Tipo', 'Finalidade', 'Base legal', 'Canal', 'Concedido em', 'Revogado em'],
    lista.map((c) => [c.titular_nome || '', titularTipoLabel(c.titular_tipo), c.finalidade || '', baseLegalLabel(c.base_legal), canalConsentimentoLabel(c.canal), c.concedido_em || '', c.revogado_em || '']),
  );

  const toggleRevogar = async (c: Consentimento) => {
    setBusyId(c.id);
    const patch = consentimentoAtivo(c) ? { revogado_em: new Date().toISOString() } : { revogado_em: null };
    const { error } = await salvarConsentimento(c.id, patch);
    setBusyId(null);
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    toast.success(consentimentoAtivo(c) ? 'Consentimento revogado.' : 'Consentimento reativado.');
    await bag.reload();
  };

  const remover = async (id: string) => {
    setBusyId(id);
    const { error } = await excluirConsentimento(id);
    setBusyId(null);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Registro excluído.');
    await bag.reload();
  };

  if (bag.consentimentos.length === 0) {
    return (
      <EmptyState icon={<IcoUserCheck />} title="Nenhum consentimento registrado"
        cta={<button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Registrar consentimento</button>}>
        Documente cada autorização de uso de dados pessoais — com finalidade, base legal e canal de coleta. Esse registro é a sua prova de conformidade com a LGPD quando um titular questionar.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Ativos" value={String(ativos)} tone="verde" icon={<IcoUserCheck />} />
        <Kpi label="Revogados" value={String(bag.consentimentos.length - ativos)} tone="cinza" icon={<IcoX />} />
        <Kpi label="Total" value={String(bag.consentimentos.length)} tone="cinza" icon={<IcoUserCheck />} />
        <Kpi label="Base: consentimento" value={String(bag.consentimentos.filter((c) => c.base_legal === 'consentimento').length)} tone="azul" sub="demais têm outra base legal" />
      </div>

      <SectionCard
        title="Registro de consentimentos"
        desc="Base legal e finalidade de cada tratamento de dados pessoais."
        action={
          <div className="flex gap-2">
            <button onClick={onExport} className={btnSecondary}><IcoDownload /> CSV</button>
            <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Novo</button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por titular ou finalidade…" className={`${inp} pl-9`} />
          </div>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value as TitularTipo | 'todos')} className={selCls + ' max-w-[150px]'}>
            <option value="todos">Todo titular</option>
            {TITULAR_TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <select value={fBase} onChange={(e) => setFBase(e.target.value as BaseLegal | 'todas')} className={selCls + ' max-w-[180px]'}>
            <option value="todas">Toda base legal</option>
            {BASES_LEGAIS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
          <select value={fAtivo} onChange={(e) => setFAtivo(e.target.value as FAtivo)} className={selCls + ' max-w-[140px]'}>
            <option value="todos">Todos</option>
            <option value="ativos">Ativos</option>
            <option value="revogados">Revogados</option>
          </select>
        </div>

        {lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum consentimento com esses filtros.</p>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((c) => {
              const ativo = consentimentoAtivo(c);
              return (
                <li key={c.id} className="rounded-xl border border-black/[0.06] p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink">{c.titular_nome || 'Titular'}</span>
                        <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">{titularTipoLabel(c.titular_tipo)}</span>
                        <StatusPill label={ativo ? 'Ativo' : 'Revogado'} tone={ativo ? 'verde' : 'cinza'} />
                      </div>
                      {c.finalidade && <div className="mt-1 text-sm text-ink-soft">{c.finalidade}</div>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-muted">
                        <span>Base: <strong className="text-ink-soft">{baseLegalLabel(c.base_legal)}</strong></span>
                        <span>Canal: <strong className="text-ink-soft">{canalConsentimentoLabel(c.canal)}</strong></span>
                        {c.concedido_em && <span>Em {formatDate(c.concedido_em, { style: 'short' })}</span>}
                        {c.revogado_em && <span className="text-red-600">Revogado {formatDate(c.revogado_em, { style: 'short' })}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => toggleRevogar(c)} disabled={busyId === c.id} title={ativo ? 'Revogar' : 'Reativar'} aria-label={ativo ? 'Revogar' : 'Reativar'}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg ${ativo ? 'text-ink-muted hover:bg-red-50 hover:text-red-600' : 'text-emerald-600 hover:bg-emerald-50'}`}>
                        {ativo ? <IcoX /> : <IcoCheck />}
                      </button>
                      <button onClick={() => setEdit(c)} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
                      <button onClick={() => remover(c.id)} disabled={busyId === c.id} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      {edit && <ConsentimentoModal bag={bag} editando={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.reload(); }} />}
    </div>
  );
}

function ConsentimentoModal({ bag, editando, onClose, onSaved }: { bag: JuridicoBag; editando: Consentimento | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const hojeDateTime = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState<Consentimento>(() => editando || {
    id: '', titular_tipo: 'cliente', titular_id: null, titular_nome: '', finalidade: '',
    base_legal: 'consentimento', canal: 'formulario', concedido_em: hojeDateTime, revogado_em: null, evidencia: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Consentimento>) => setF((v) => ({ ...v, ...patch }));

  const salvar = async () => {
    if (!f.titular_nome?.trim()) { toast.error('Informe o nome do titular.'); return; }
    setBusy(true);
    const row = {
      usuario_id: bag.userId, titular_tipo: f.titular_tipo, titular_id: f.titular_id || null, titular_nome: f.titular_nome || null,
      finalidade: f.finalidade || null, base_legal: f.base_legal, canal: f.canal,
      concedido_em: f.concedido_em || new Date().toISOString(), evidencia: f.evidencia || null,
    };
    const { error } = editando ? await salvarConsentimento(editando.id, row) : await criarConsentimento(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(editando ? 'Consentimento atualizado.' : 'Consentimento registrado.');
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="text-lg font-bold text-ink">{editando ? 'Editar consentimento' : 'Registrar consentimento'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo label="Tipo de titular">
          <select value={f.titular_tipo} onChange={(e) => set({ titular_tipo: e.target.value as TitularTipo })} className={selCls}>
            {TITULAR_TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Nome do titular">
          <input value={f.titular_nome || ''} onChange={(e) => set({ titular_nome: e.target.value })} list="jur-clientes" className={inp} />
          <datalist id="jur-clientes">{bag.clientes.map((c) => <option key={c.id} value={c.nome || ''} />)}</datalist>
        </Campo>
        <Campo label="Finalidade do tratamento" full>
          <input value={f.finalidade || ''} onChange={(e) => set({ finalidade: e.target.value })} placeholder="Ex.: Envio de propostas e comunicações do evento" className={inp} />
        </Campo>
        <Campo label="Base legal (LGPD)">
          <select value={f.base_legal} onChange={(e) => set({ base_legal: e.target.value as BaseLegal })} className={selCls}>
            {BASES_LEGAIS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </Campo>
        <Campo label="Canal de coleta">
          <select value={f.canal} onChange={(e) => set({ canal: e.target.value as CanalConsentimento })} className={selCls}>
            {CANAIS_CONSENTIMENTO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Concedido em">
          <input type="date" value={(f.concedido_em || '').slice(0, 10)} onChange={(e) => set({ concedido_em: e.target.value || null })} className={inp} />
        </Campo>
        <Campo label="Evidência (link/print/hash)">
          <input value={f.evidencia || ''} onChange={(e) => set({ evidencia: e.target.value })} placeholder="https://…" className={inp} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

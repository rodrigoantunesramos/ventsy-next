'use client';

// Aba "Processos" — processos, notificações e acordos. Polo (autor/réu/terceiro),
// número/órgão, status, próximo prazo (com tom de urgência), valor envolvido (por
// moeda) e advogado responsável. CRUD via RLS. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatMoney, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type JuridicoBag, type Processo, type TipoProcesso, type PoloProcesso, type StatusProcesso,
  TIPOS_PROCESSO, tipoProcessoLabel, POLOS_PROCESSO, STATUS_PROCESSO_META, processoEmAberto,
  statusVigencia, vigenciaTone,
  criarProcesso, salvarProcesso, excluirProcesso, exportCSV, inp, selCls,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, EmptyState, StatusPill, SectionCard, toneClasses,
  IcoGavel, IcoPlus, IcoEdit, IcoTrash, IcoDownload, IcoSearch, IcoClock, btnPrimary, btnSecondary, btnDanger,
} from './ui';

export default function Processos({ bag }: { bag: JuridicoBag }) {
  const toast = useToast();
  const { hoje } = bag;
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState<StatusProcesso | 'todos' | 'abertos'>('abertos');
  const [edit, setEdit] = useState<Processo | 'novo' | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return bag.processos.filter((p) => {
      if (fStatus === 'abertos' && !processoEmAberto(p.status)) return false;
      if (fStatus !== 'abertos' && fStatus !== 'todos' && p.status !== fStatus) return false;
      if (q && !(`${p.parte || ''} ${p.numero || ''} ${p.proximo_passo || ''} ${p.advogado || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [bag.processos, busca, fStatus]);

  const kpi = useMemo(() => {
    const ativos = bag.processos.filter((p) => processoEmAberto(p.status));
    const comPrazoVencido = ativos.filter((p) => p.prazo && statusVigencia(p.prazo, hoje, 7).status === 'vencido').length;
    const valor: Record<string, number> = {};
    for (const p of ativos) { const v = p.valor_envolvido_num || 0; if (v) valor[p.moeda] = (valor[p.moeda] || 0) + v; }
    return { ativos: ativos.length, vencidos: comPrazoVencido, valor };
  }, [bag.processos, hoje]);

  const onExport = () => exportCSV(
    `processos-${hoje}.csv`,
    ['Tipo', 'Parte', 'Polo', 'Número', 'Órgão', 'Status', 'Prazo', 'Valor', 'Moeda', 'Advogado'],
    lista.map((p) => [tipoProcessoLabel(p.tipo), p.parte || '', p.polo, p.numero || '', p.vara_orgao || '', STATUS_PROCESSO_META[p.status]?.label || p.status, p.prazo || '', p.valor_envolvido_num, p.moeda, p.advogado || '']),
  );

  const onDelete = async () => {
    if (!del) return;
    setBusy(true);
    const { error } = await excluirProcesso(del);
    setBusy(false); setDel(null);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Processo excluído.');
    await bag.reload();
  };

  if (bag.processos.length === 0) {
    return (
      <EmptyState icon={<IcoGavel />} title="Nenhum processo registrado"
        cta={<button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Registrar processo</button>}>
        Acompanhe processos judiciais/administrativos, notificações e acordos — com polo, prazo, valor envolvido e advogado. Os prazos aparecem no Painel junto com os vencimentos de contratos.
      </EmptyState>
    );
  }

  const moedas = Object.entries(kpi.valor).filter(([, v]) => v > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Em aberto" value={String(kpi.ativos)} tone={kpi.ativos > 0 ? 'azul' : 'cinza'} icon={<IcoGavel />} />
        <Kpi label="Prazos vencidos" value={String(kpi.vencidos)} tone={kpi.vencidos > 0 ? 'vermelho' : 'verde'} icon={<IcoClock />} />
        <Kpi label="Total" value={String(bag.processos.length)} tone="cinza" icon={<IcoGavel />} />
        <Kpi label="Valor envolvido" value={moedas[0] ? formatMoney(moedas[0][1], { currency: moedas[0][0] as 'BRL' | 'USD' | 'EUR' }) : '—'} tone="cinza" sub={moedas.length > 1 ? `+${moedas.length - 1} moeda(s)` : 'em aberto'} />
      </div>

      <SectionCard
        title="Processos & notificações"
        action={
          <div className="flex gap-2">
            <button onClick={onExport} className={btnSecondary}><IcoDownload /> CSV</button>
            <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Novo</button>
          </div>
        }
      >
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por parte, número, advogado…" className={`${inp} pl-9`} />
          </div>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as StatusProcesso | 'todos' | 'abertos')} className={selCls + ' max-w-[170px]'}>
            <option value="abertos">Em aberto</option>
            <option value="todos">Todos</option>
            {Object.entries(STATUS_PROCESSO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum processo com esses filtros.</p>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((p) => <ProcRow key={p.id} p={p} hoje={hoje} onEdit={() => setEdit(p)} onDelete={() => setDel(p.id)} />)}
          </ul>
        )}
      </SectionCard>

      {edit && <ProcessoModal bag={bag} editando={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.reload(); }} />}
      {del && (
        <ModalShell onClose={() => setDel(null)} maxW="max-w-sm">
          <h3 className="text-lg font-bold text-ink">Excluir processo?</h3>
          <p className="mt-1 text-sm text-ink-muted">Esta ação não pode ser desfeita.</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setDel(null)} className={btnSecondary + ' flex-1'}>Cancelar</button>
            <button onClick={onDelete} disabled={busy} className={btnDanger + ' flex-1'}><IcoTrash /> Excluir</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function ProcRow({ p, hoje, onEdit, onDelete }: { p: Processo; hoje: string; onEdit: () => void; onDelete: () => void }) {
  const meta = STATUS_PROCESSO_META[p.status] || STATUS_PROCESSO_META.ativo;
  const vig = p.prazo ? statusVigencia(p.prazo, hoje, 7) : null;
  const vt = vig ? toneClasses(vigenciaTone(vig.status)) : null;
  return (
    <li className="rounded-xl border border-black/[0.06] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{p.parte || 'Sem parte'}</span>
            <span className="rounded-md bg-black/[0.04] px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">{tipoProcessoLabel(p.tipo)}</span>
            <StatusPill label={meta.label} tone={meta.tone} />
          </div>
          <div className="mt-1 text-[0.78rem] text-ink-muted">
            {POLOS_PROCESSO.find((x) => x.key === p.polo)?.label}{p.numero ? ` · nº ${p.numero}` : ''}{p.vara_orgao ? ` · ${p.vara_orgao}` : ''}
          </div>
          {p.proximo_passo && <div className="mt-1.5 text-sm text-ink-soft">→ {p.proximo_passo}</div>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onEdit} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
          <button onClick={onDelete} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.78rem]">
        {p.prazo && vt && (
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold ${vt.chip}`}>
            <IcoClock /> {formatDate(p.prazo, { style: 'short' })}{vig && vig.dias != null ? ` · ${vig.dias < 0 ? `há ${Math.abs(vig.dias)}d` : `em ${vig.dias}d`}` : ''}
          </span>
        )}
        {p.valor_envolvido_num > 0 && <span className="text-ink-muted">Valor: <strong className="text-ink-soft">{formatMoney(p.valor_envolvido_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })}</strong></span>}
        {p.advogado && <span className="text-ink-muted">Adv.: <strong className="text-ink-soft">{p.advogado}</strong></span>}
      </div>
    </li>
  );
}

function ProcessoModal({ bag, editando, onClose, onSaved }: { bag: JuridicoBag; editando: Processo | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Processo>(() => editando || {
    id: '', tipo: 'judicial', parte: '', polo: 'reu', numero: '', vara_orgao: '', status: 'ativo',
    prazo: null, proximo_passo: '', valor_envolvido_num: 0, moeda: 'BRL', advogado: '', obs: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Processo>) => setF((v) => ({ ...v, ...patch }));

  const salvar = async () => {
    if (!f.parte?.trim() && !f.numero?.trim()) { toast.error('Informe a parte ou o número do processo.'); return; }
    setBusy(true);
    const row = {
      usuario_id: bag.userId, tipo: f.tipo, parte: f.parte || null, polo: f.polo, numero: f.numero || null,
      vara_orgao: f.vara_orgao || null, status: f.status, prazo: f.prazo || null, proximo_passo: f.proximo_passo || null,
      valor_envolvido_num: Number(f.valor_envolvido_num) || 0, moeda: f.moeda, advogado: f.advogado || null, obs: f.obs || null,
    };
    const { error } = editando ? await salvarProcesso(editando.id, row) : await criarProcesso(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(editando ? 'Processo atualizado.' : 'Processo registrado.');
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="text-lg font-bold text-ink">{editando ? 'Editar processo' : 'Novo processo'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo label="Tipo">
          <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value as TipoProcesso })} className={selCls}>
            {TIPOS_PROCESSO.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select value={f.status} onChange={(e) => set({ status: e.target.value as StatusProcesso })} className={selCls}>
            {Object.entries(STATUS_PROCESSO_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Campo>
        <Campo label="Parte (contraparte)">
          <input value={f.parte || ''} onChange={(e) => set({ parte: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Nosso polo">
          <select value={f.polo} onChange={(e) => set({ polo: e.target.value as PoloProcesso })} className={selCls}>
            {POLOS_PROCESSO.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
        </Campo>
        <Campo label="Número / protocolo">
          <input value={f.numero || ''} onChange={(e) => set({ numero: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Vara / órgão / comarca">
          <input value={f.vara_orgao || ''} onChange={(e) => set({ vara_orgao: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Próximo passo / objeto" full>
          <input value={f.proximo_passo || ''} onChange={(e) => set({ proximo_passo: e.target.value })} placeholder="Ex.: Audiência de conciliação" className={inp} />
        </Campo>
        <Campo label="Próximo prazo">
          <input type="date" value={f.prazo || ''} onChange={(e) => set({ prazo: e.target.value || null })} className={inp} />
        </Campo>
        <Campo label="Advogado responsável">
          <input value={f.advogado || ''} onChange={(e) => set({ advogado: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Valor envolvido">
          <input type="number" min={0} step="0.01" value={f.valor_envolvido_num || ''} onChange={(e) => set({ valor_envolvido_num: Number(e.target.value) })} className={inp} />
        </Campo>
        <Campo label="Moeda">
          <select value={f.moeda} onChange={(e) => set({ moeda: e.target.value })} className={selCls}>
            <option value="BRL">BRL (R$)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </Campo>
        <Campo label="Observações" full>
          <textarea value={f.obs || ''} onChange={(e) => set({ obs: e.target.value })} rows={2} className={inp} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

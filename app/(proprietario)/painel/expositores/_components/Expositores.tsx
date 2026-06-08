'use client';

// Aba "Expositores" — cadastro 360º da marca/empresa do estande: contato, doc,
// estande vinculado, status do funil, necessidades técnicas e os atalhos de
// integração: FATURAR (→ Financeiro), CREDENCIAR (→ Acesso), GERAR CONTRATO
// (→ Contratos) e ENVIAR NECESSIDADES p/ a checklist de Produção/Logística.
// As integrações são best-effort: degradam com aviso se o módulo-alvo não existir.

import { useMemo, useState } from 'react';
import { formatMoneyShort } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ExpoBag, type Expositor, type Necessidades,
  EXPOSITOR_STATUS_META, expositorStatusMeta, estandeTipoLabel,
  faturar, estornar, credenciar, gerarContrato, enviarLogistica,
  criarExpositor, salvarExpositor, excluirExpositor,
  inp, selCls, exportCSV,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, EmptyState, Chip, btnPrimary, btnSecondary, btnGhost,
  IcoBuilding, IcoMoney, IcoCheckCircle, IcoPlus, IcoEdit, IcoTrash, IcoSign, IcoBadge,
  IcoBolt, IcoWifi, IcoWrench, IcoDrop, IcoSearch, IcoDownload,
} from './ui';

export default function Expositores({ bag }: { bag: ExpoBag }) {
  const toast = useToast();
  const { expositores, estandes } = bag;
  const estandeById = useMemo(() => new Map(estandes.map((e) => [e.id, e])), [estandes]);

  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Expositor | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return expositores.filter((e) =>
      (!statusFiltro || e.status === statusFiltro) &&
      (!q || e.empresa.toLowerCase().includes(q) || (e.contato || '').toLowerCase().includes(q)),
    );
  }, [expositores, busca, statusFiltro]);

  const kpis = useMemo(() => {
    const ativos = expositores.filter((e) => e.status !== 'cancelado');
    const confirmados = ativos.filter((e) => e.status === 'confirmado' || e.status === 'faturado').length;
    const receita = expositores.filter((e) => e.status === 'faturado').reduce((s, e) => s + (Number(e.valor_num) || 0), 0);
    const comEstande = ativos.filter((e) => e.estande_id).length;
    return { total: ativos.length, confirmados, receita, comEstande };
  }, [expositores]);

  // ── Integrações (best-effort) ──────────────────────────────────────────────
  const run = async (id: string, fn: () => Promise<{ ok: boolean; error?: string; [k: string]: unknown }>, msgs: { ok: (r: Record<string, unknown>) => string; fail: Record<string, string> }) => {
    setBusyId(id);
    try {
      const r = await fn();
      if (r.ok) { toast.success(msgs.ok(r)); await bag.recarregar(); }
      else toast.error(msgs.fail[r.error || ''] || r.error || 'Não foi possível concluir.');
    } finally { setBusyId(null); }
  };

  const doFaturar = (e: Expositor) => run(e.id, () => faturar('expositor', e.id), {
    ok: (r) => r.ja_faturado ? 'Expositor já faturado.' : `Receita lançada: ${formatMoneyShort(Number(r.valor) || 0)}.`,
    fail: {},
  });
  const doEstornar = (e: Expositor) => run(e.id, () => estornar('expositor', e.id), { ok: () => 'Fatura estornada.', fail: {} });
  const doCredenciar = (e: Expositor) => run(e.id, () => credenciar(e.id), {
    ok: () => 'Credencial de expositor emitida.',
    fail: { modulo_acesso_indisponivel: 'Ative o módulo Acesso (docs/sql/acesso.sql) para emitir credenciais.' },
  });
  const doContrato = (e: Expositor) => run(e.id, () => gerarContrato('expositor', e.id), {
    ok: (r) => r.ja_gerado ? 'Contrato já gerado.' : `Contrato ${r.numero || ''} gerado (rascunho).`,
    fail: { modulo_contratos_indisponivel: 'Ative o módulo Contratos para gerar contratos.' },
  });
  const doLogistica = (e: Expositor) => run(e.id, () => enviarLogistica(e.id), {
    ok: (r) => `${r.tarefas || 0} tarefa(s) enviada(s) à Produção.`,
    fail: {
      modulo_producao_indisponivel: 'Ative o módulo Produção (docs/sql/producao.sql) para receber as tarefas.',
      'nenhuma necessidade técnica marcada neste expositor': 'Marque ao menos uma necessidade técnica no cadastro.',
    },
  });

  const onExcluir = async (e: Expositor) => {
    if (!window.confirm(`Excluir o expositor ${e.empresa}?`)) return;
    const { error } = await excluirExpositor(e.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    await bag.recarregar();
    toast.success('Expositor excluído.');
  };

  const onExport = () => {
    exportCSV(`expositores-${bag.evento.id}.csv`,
      ['Empresa', 'Contato', 'Estande', 'Status', 'Valor', 'Faturado'],
      filtrados.map((e) => [
        e.empresa, e.contato || '', e.estande_id ? estandeById.get(e.estande_id)?.codigo || '' : '',
        expositorStatusMeta(e.status).label, Number(e.valor_num) || 0, e.lancamento_id ? 'sim' : 'não',
      ]));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Expositores" value={String(kpis.total)} tone="ink" icon={<IcoBuilding />} sub={`${kpis.comEstande} com estande`} />
        <Kpi label="Confirmados" value={String(kpis.confirmados)} tone="verde" icon={<IcoCheckCircle />} />
        <Kpi label="Receita faturada" value={formatMoneyShort(kpis.receita)} tone="brand" icon={<IcoMoney />} />
        <Kpi label="Em prospecção" value={String(kpis.total - kpis.confirmados)} tone="sky" />
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-card">
        <button onClick={() => { setEditing(null); setShowForm(true); }} className={btnPrimary}><IcoPlus /> Novo expositor</button>
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa/contato"
            className="w-52 rounded-lg border border-black/10 py-1.5 pl-8 pr-3 text-sm focus:border-brand focus:outline-none" />
        </div>
        <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} className={selCls}>
          <option value="">Todos os status</option>
          {Object.entries(EXPOSITOR_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <button onClick={onExport} className={`${btnSecondary} ml-auto`}><IcoDownload /> CSV</button>
      </div>

      {expositores.length === 0 ? (
        <EmptyState icon={<IcoBuilding />} title="Nenhum expositor ainda"
          cta={<button onClick={() => { setEditing(null); setShowForm(true); }} className={btnPrimary}><IcoPlus /> Cadastrar expositor</button>}>
          Cadastre as marcas/empresas da feira. Vincule cada uma a um estande, gere contrato, fatura e credencial, e mande as necessidades técnicas para a produção.
        </EmptyState>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {filtrados.map((e) => (
            <ExpositorCard
              key={e.id} exp={e} estandeCodigo={e.estande_id ? estandeById.get(e.estande_id)?.codigo || null : null}
              estandeTipo={e.estande_id ? estandeById.get(e.estande_id)?.tipo || null : null}
              busy={busyId === e.id}
              onEditar={() => { setEditing(e); setShowForm(true); }} onExcluir={() => onExcluir(e)}
              onFaturar={() => doFaturar(e)} onEstornar={() => doEstornar(e)}
              onCredenciar={() => doCredenciar(e)} onContrato={() => doContrato(e)} onLogistica={() => doLogistica(e)}
            />
          ))}
          {filtrados.length === 0 && <div className="rounded-2xl bg-white p-6 text-center text-sm text-ink-muted shadow-card lg:col-span-2">Nenhum expositor com esse filtro.</div>}
        </div>
      )}

      {showForm && <ExpositorFormModal bag={bag} exp={editing} onClose={() => setShowForm(false)} />}
    </div>
  );
}

// ── Card do expositor ──────────────────────────────────────────────────────────
function ExpositorCard({ exp, estandeCodigo, estandeTipo, busy, onEditar, onExcluir, onFaturar, onEstornar, onCredenciar, onContrato, onLogistica }: {
  exp: Expositor; estandeCodigo: string | null; estandeTipo: string | null; busy: boolean;
  onEditar: () => void; onExcluir: () => void; onFaturar: () => void; onEstornar: () => void;
  onCredenciar: () => void; onContrato: () => void; onLogistica: () => void;
}) {
  const meta = expositorStatusMeta(exp.status);
  const nec = exp.necessidades || {};
  const temNec = !!(Number(nec.energia_kva) > 0 || nec.internet || nec.agua || nec.montagem || (nec.obs && nec.obs.trim()));
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-ink">{exp.empresa}</div>
          <div className="truncate text-xs text-ink-muted">
            {exp.contato || '—'}{exp.telefone ? ` · ${exp.telefone}` : ''}
          </div>
        </div>
        <Chip className={meta.chip}>{meta.label}</Chip>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">Estande: <span className="font-semibold text-ink">{estandeCodigo || '—'}{estandeTipo ? ` (${estandeTipoLabel(estandeTipo)})` : ''}</span></span>
        <span className="text-ink-muted">Valor: <span className="font-semibold text-ink">{formatMoneyShort(Number(exp.valor_num) || 0)}</span></span>
      </div>

      {/* necessidades técnicas */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {Number(nec.energia_kva) > 0 && <Chip className="bg-amber-50 text-amber-700"><IcoBolt /> {nec.energia_kva} kVA</Chip>}
        {nec.internet && <Chip className="bg-sky-50 text-sky-700"><IcoWifi /> Internet</Chip>}
        {nec.agua && <Chip className="bg-blue-50 text-blue-700"><IcoDrop /> Água</Chip>}
        {nec.montagem && <Chip className="bg-violet-50 text-violet-700"><IcoWrench /> Montagem</Chip>}
        {!temNec && <span className="text-[0.7rem] text-ink-muted">Sem necessidades técnicas.</span>}
      </div>

      {/* status de integração */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[0.68rem]">
        {exp.contrato_id && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><IcoSign /> Contrato</span>}
        {exp.credencial_id && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><IcoBadge /> Credenciado</span>}
        {exp.lancamento_id && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><IcoMoney /> Faturado</span>}
      </div>

      {/* ações */}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-black/[0.06] pt-3">
        {exp.lancamento_id
          ? <button disabled={busy} onClick={onEstornar} className={`${btnGhost} text-ink-muted`}>Estornar</button>
          : <button disabled={busy} onClick={onFaturar} className={`${btnGhost} text-emerald-700`}><IcoMoney /> Faturar</button>}
        {!exp.contrato_id && <button disabled={busy} onClick={onContrato} className={`${btnGhost} text-ink-soft`}><IcoSign /> Contrato</button>}
        {!exp.credencial_id && <button disabled={busy} onClick={onCredenciar} className={`${btnGhost} text-ink-soft`}><IcoBadge /> Credenciar</button>}
        <button disabled={busy} onClick={onLogistica} className={`${btnGhost} text-ink-soft`}><IcoWrench /> Logística</button>
        <span className="ml-auto flex items-center gap-1">
          <button onClick={onEditar} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
          <button onClick={onExcluir} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
        </span>
      </div>
    </div>
  );
}

// ── Modal: criar/editar expositor ──────────────────────────────────────────────
function ExpositorFormModal({ bag, exp, onClose }: { bag: ExpoBag; exp: Expositor | null; onClose: () => void }) {
  const toast = useToast();
  const editing = !!exp;
  const livresEstandes = useMemo(() => bag.estandes.filter((e) => !e.expositor_id || e.expositor_id === exp?.id), [bag.estandes, exp]);

  const [f, setF] = useState({
    empresa: exp?.empresa || '', contato: exp?.contato || '', email: exp?.email || '', telefone: exp?.telefone || '',
    doc: exp?.doc || '', valor: exp?.valor_num != null ? String(exp.valor_num) : '', status: String(exp?.status || 'prospecto'),
    estande_id: exp?.estande_id || '',
  });
  const nec0 = exp?.necessidades || {};
  const [nec, setNec] = useState<Necessidades>({
    energia_kva: nec0.energia_kva ?? null, internet: !!nec0.internet, agua: !!nec0.agua, montagem: !!nec0.montagem, obs: nec0.obs ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async () => {
    if (!f.empresa.trim()) { toast.error('Informe a empresa.'); return; }
    setSaving(true);
    try {
      const payload = {
        empresa: f.empresa.trim(), contato: f.contato.trim() || null, email: f.email.trim() || null,
        telefone: f.telefone.trim() || null, doc: f.doc.trim() || null,
        valor_num: f.valor ? Number(f.valor) : 0, status: f.status, estande_id: f.estande_id || null,
        necessidades: {
          energia_kva: nec.energia_kva ? Number(nec.energia_kva) : null,
          internet: !!nec.internet, agua: !!nec.agua, montagem: !!nec.montagem, obs: (nec.obs || '').toString().trim() || null,
        },
      };
      if (editing && exp) {
        const { error } = await salvarExpositor(exp.id, payload);
        if (error) throw error;
      } else {
        const { error } = await criarExpositor({ ...payload, usuario_id: bag.userId, evento_id: bag.evento.id });
        if (error) throw error;
      }
      await bag.recarregar();
      toast.success(editing ? 'Expositor atualizado.' : 'Expositor cadastrado.');
      onClose();
    } catch (e) {
      toast.error((e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '') || 'Não foi possível salvar.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="mb-4 text-lg font-bold text-ink">{editing ? 'Editar expositor' : 'Novo expositor'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Empresa" full><input value={f.empresa} onChange={(e) => set('empresa', e.target.value)} className={inp} placeholder="Marca / razão social" /></Campo>
        <Campo label="Contato"><input value={f.contato} onChange={(e) => set('contato', e.target.value)} className={inp} placeholder="Nome do responsável" /></Campo>
        <Campo label="Documento"><input value={f.doc} onChange={(e) => set('doc', e.target.value)} className={inp} placeholder="CNPJ / CPF" /></Campo>
        <Campo label="E-mail"><input value={f.email} onChange={(e) => set('email', e.target.value)} className={inp} placeholder="contato@marca.com" /></Campo>
        <Campo label="Telefone"><input value={f.telefone} onChange={(e) => set('telefone', e.target.value)} className={inp} placeholder="(00) 00000-0000" /></Campo>
        <Campo label="Valor do contrato"><input type="number" min={0} value={f.valor} onChange={(e) => set('valor', e.target.value)} className={inp} placeholder="0" /></Campo>
        <Campo label="Status">
          <select value={f.status} onChange={(e) => set('status', e.target.value)} className={`${selCls} w-full`}>
            {Object.entries(EXPOSITOR_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </Campo>
        <Campo label="Estande" full hint="Vincular aqui não altera o status comercial do ponto — use o Mapa para vender/reservar.">
          <select value={f.estande_id} onChange={(e) => set('estande_id', e.target.value)} className={`${selCls} w-full`}>
            <option value="">— Sem estande —</option>
            {livresEstandes.map((e) => <option key={e.id} value={e.id}>{e.codigo} ({estandeTipoLabel(String(e.tipo))})</option>)}
          </select>
        </Campo>
      </div>

      <div className="mt-4 rounded-xl border border-black/[0.06] p-3">
        <div className="mb-2 text-sm font-semibold text-ink-soft">Necessidades técnicas <span className="font-normal text-ink-muted">(viram tarefas de produção)</span></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Energia (kVA)"><input type="number" min={0} value={nec.energia_kva ?? ''} onChange={(e) => setNec((s) => ({ ...s, energia_kva: e.target.value ? Number(e.target.value) : null }))} className={inp} placeholder="0" /></Campo>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm"><input type="checkbox" checked={!!nec.internet} onChange={(e) => setNec((s) => ({ ...s, internet: e.target.checked }))} className="accent-brand" /> Internet</label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm"><input type="checkbox" checked={!!nec.agua} onChange={(e) => setNec((s) => ({ ...s, agua: e.target.checked }))} className="accent-brand" /> Água</label>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm"><input type="checkbox" checked={!!nec.montagem} onChange={(e) => setNec((s) => ({ ...s, montagem: e.target.checked }))} className="accent-brand" /> Montagem</label>
        </div>
        <Campo label="Observações técnicas" full><input value={nec.obs || ''} onChange={(e) => setNec((s) => ({ ...s, obs: e.target.value }))} className={inp} placeholder="Ex.: piso elevado, pé-direito 6m, carga/descarga…" /></Campo>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button disabled={saving} onClick={submit} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

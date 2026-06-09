'use client';

// Aba "Contratos" — repositório CONSOLIDADO de contratos com prazos e alertas.
// Junta os contratos de CLIENTE (read-only, vindos de /painel/contratos) com os
// demais contratos do espaço (fornecedor/trabalho/parceria/serviço/NDA/seguro),
// estes geridos aqui via RLS. Filtros por categoria/vigência + busca, export CSV,
// e a vigência (vigente/a vencer 30·60·90/vencido) é calculada pela engine.
// Sem "R$" hardcoded — moeda/data via lib/format.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatMoney, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type JuridicoBag, type JuridicoContrato, type ContratoConsolidado, type CategoriaContrato, type StatusContratoJur,
  CATEGORIAS_CONTRATO, RENOVACOES, STATUS_CONTRATO_JUR_META,
  consolidarContratos, statusVigencia, vigenciaTone,
  criarContratoJur, salvarContratoJur, excluirContratoJur, exportCSV, inp, selCls,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, EmptyState, StatusPill, SectionCard, toneClasses,
  IcoDoc, IcoPlus, IcoEdit, IcoTrash, IcoDownload, IcoExternal, IcoSearch, IcoAlert, btnPrimary, btnSecondary, btnDanger,
} from './ui';

type Filtro = 'todos' | 'a_vencer' | 'vencido' | 'vigente';

export default function Contratos({ bag }: { bag: JuridicoBag }) {
  const toast = useToast();
  const { hoje } = bag;
  const [busca, setBusca] = useState('');
  const [fCat, setFCat] = useState<CategoriaContrato | 'todas'>('todas');
  const [fVig, setFVig] = useState<Filtro>('todos');
  const [edit, setEdit] = useState<JuridicoContrato | 'novo' | null>(null);
  const [del, setDel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const todos = useMemo(() => consolidarContratos(bag.contratosCliente, bag.contratosJur, hoje), [bag.contratosCliente, bag.contratosJur, hoje]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return todos.filter((c) => {
      if (fCat !== 'todas' && c.categoria !== fCat) return false;
      if (fVig !== 'todos' && c.vigencia.status !== fVig) return false;
      if (q && !(`${c.titulo} ${c.contraparte} ${c.numero || ''}`.toLowerCase().includes(q))) return false;
      return true;
    }).sort((a, b) => {
      // vencidos e a vencer primeiro, depois por data de vencimento
      const rank = (x: ContratoConsolidado) => x.vigencia.status === 'vencido' ? 0 : x.vigencia.status === 'a_vencer' ? 1 : x.vigencia.status === 'vigente' ? 2 : 3;
      return rank(a) - rank(b) || (a.vencimento || '9999').localeCompare(b.vencimento || '9999');
    });
  }, [todos, busca, fCat, fVig]);

  const venc = useMemo(() => ({
    aVencer: todos.filter((c) => c.ativo && c.vigencia.status === 'a_vencer').length,
    vencido: todos.filter((c) => c.ativo && c.vigencia.status === 'vencido').length,
  }), [todos]);

  const onExport = () => {
    exportCSV(
      `contratos-${hoje}.csv`,
      ['Categoria', 'Título', 'Contraparte', 'Número', 'Vencimento', 'Status', 'Valor', 'Moeda', 'Origem'],
      lista.map((c) => [c.categoriaLabel, c.titulo, c.contraparte, c.numero || '', c.vencimento || '', c.statusLabel, c.valor_num, c.moeda, c.origem === 'cliente' ? 'Cliente' : 'Jurídico']),
    );
  };

  const onDelete = async () => {
    if (!del) return;
    setBusy(true);
    const { error } = await excluirContratoJur(del.replace(/^jur:/, ''));
    setBusy(false);
    setDel(null);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Contrato excluído.');
    await bag.reload();
  };

  if (todos.length === 0) {
    return (
      <EmptyState icon={<IcoDoc />} title="Nenhum contrato cadastrado"
        cta={<button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Adicionar contrato</button>}>
        Cadastre contratos de fornecedor, trabalho, parceria, serviço ou NDA. Os contratos de cliente vindos do módulo <strong>Contratos</strong> aparecem aqui automaticamente para você acompanhar os vencimentos.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Total" value={String(todos.length)} tone="cinza" icon={<IcoDoc />} />
        <Kpi label="Ativos" value={String(todos.filter((c) => c.ativo).length)} tone="verde" icon={<IcoDoc />} />
        <Kpi label="A vencer" value={String(venc.aVencer)} tone={venc.aVencer > 0 ? 'amarelo' : 'cinza'} icon={<IcoAlert />} />
        <Kpi label="Vencidos" value={String(venc.vencido)} tone={venc.vencido > 0 ? 'vermelho' : 'verde'} icon={<IcoAlert />} />
      </div>

      <SectionCard
        title="Repositório de contratos"
        desc="Contratos de cliente são geridos em Contratos; os demais, aqui."
        action={
          <div className="flex gap-2">
            <button onClick={onExport} className={btnSecondary}><IcoDownload /> CSV</button>
            <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Novo</button>
          </div>
        }
      >
        {/* Filtros */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por título, contraparte, número…" className={`${inp} pl-9`} />
          </div>
          <select value={fCat} onChange={(e) => setFCat(e.target.value as CategoriaContrato | 'todas')} className={selCls + ' max-w-[180px]'}>
            <option value="todas">Todas as categorias</option>
            {CATEGORIAS_CONTRATO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <select value={fVig} onChange={(e) => setFVig(e.target.value as Filtro)} className={selCls + ' max-w-[160px]'}>
            <option value="todos">Toda vigência</option>
            <option value="vencido">Vencidos</option>
            <option value="a_vencer">A vencer</option>
            <option value="vigente">Vigentes</option>
          </select>
        </div>

        {lista.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum contrato com esses filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="hidden w-full text-sm sm:table">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Contrato</th>
                  <th className="py-2 pr-3 font-semibold">Categoria</th>
                  <th className="py-2 pr-3 font-semibold">Vencimento</th>
                  <th className="py-2 pr-3 font-semibold">Valor</th>
                  <th className="py-2 pr-3 font-semibold">Situação</th>
                  <th className="py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => <Row key={c.id} c={c} onEdit={() => abrirEdicao(c, bag, setEdit)} onDelete={() => setDel(c.id)} />)}
              </tbody>
            </table>
            {/* Mobile: cards */}
            <ul className="space-y-2.5 sm:hidden">
              {lista.map((c) => <CardMobile key={c.id} c={c} onEdit={() => abrirEdicao(c, bag, setEdit)} onDelete={() => setDel(c.id)} />)}
            </ul>
          </div>
        )}
      </SectionCard>

      {edit && <ContratoModal bag={bag} editando={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.reload(); }} />}
      {del && (
        <ModalShell onClose={() => setDel(null)} maxW="max-w-sm">
          <h3 className="text-lg font-bold text-ink">Excluir contrato?</h3>
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

// Edição só faz sentido para contratos jurídicos (os de cliente são read-only).
function abrirEdicao(c: ContratoConsolidado, bag: JuridicoBag, setEdit: (v: JuridicoContrato | 'novo' | null) => void) {
  if (c.origem !== 'juridico') return;
  const real = bag.contratosJur.find((j) => `jur:${j.id}` === c.id);
  if (real) setEdit(real);
}

function VencCell({ c }: { c: ContratoConsolidado }) {
  if (!c.vencimento) return <span className="text-ink-muted">—</span>;
  const t = toneClasses(vigenciaTone(c.vigencia.status));
  const dias = c.vigencia.dias;
  return (
    <div>
      <div className="text-ink-soft">{formatDate(c.vencimento, { style: 'short' })}</div>
      {c.ativo && dias != null && (
        <span className={`mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[0.65rem] font-semibold ${t.chip}`}>
          {dias < 0 ? `vencido há ${Math.abs(dias)}d` : dias === 0 ? 'vence hoje' : `em ${dias}d`}
        </span>
      )}
    </div>
  );
}

function Row({ c, onEdit, onDelete }: { c: ContratoConsolidado; onEdit: () => void; onDelete: () => void }) {
  return (
    <tr className="border-b border-black/[0.04]">
      <td className="py-3 pr-3">
        <div className="font-semibold text-ink">{c.titulo}</div>
        <div className="text-[0.78rem] text-ink-muted">{c.contraparte}{c.numero ? ` · ${c.numero}` : ''}</div>
      </td>
      <td className="py-3 pr-3 text-ink-soft">{c.categoriaLabel}</td>
      <td className="py-3 pr-3"><VencCell c={c} /></td>
      <td className="py-3 pr-3 text-ink-soft">{c.valor_num > 0 ? formatMoney(c.valor_num, { currency: c.moeda as 'BRL' | 'USD' | 'EUR' }) : '—'}</td>
      <td className="py-3 pr-3"><StatusPill label={c.statusLabel} tone={c.tone} /></td>
      <td className="py-3 text-right">
        {c.origem === 'cliente' ? (
          <Link href="/painel/contratos" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><IcoExternal /> Contratos</Link>
        ) : (
          <div className="flex justify-end gap-1">
            <button onClick={onEdit} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
            <button onClick={onDelete} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
          </div>
        )}
      </td>
    </tr>
  );
}

function CardMobile({ c, onEdit, onDelete }: { c: ContratoConsolidado; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="rounded-xl border border-black/[0.06] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{c.titulo}</div>
          <div className="truncate text-[0.78rem] text-ink-muted">{c.contraparte} · {c.categoriaLabel}</div>
        </div>
        <StatusPill label={c.statusLabel} tone={c.tone} />
      </div>
      <div className="mt-2 flex items-center justify-between">
        <VencCell c={c} />
        <div className="flex items-center gap-2">
          <span className="text-sm text-ink-soft">{c.valor_num > 0 ? formatMoney(c.valor_num, { currency: c.moeda as 'BRL' | 'USD' | 'EUR' }) : ''}</span>
          {c.origem === 'cliente' ? (
            <Link href="/painel/contratos" aria-label="Abrir em Contratos" className="text-brand"><IcoExternal /></Link>
          ) : (
            <>
              <button onClick={onEdit} aria-label="Editar" className="text-ink-muted"><IcoEdit /></button>
              <button onClick={onDelete} aria-label="Excluir" className="text-ink-muted"><IcoTrash /></button>
            </>
          )}
        </div>
      </div>
    </li>
  );
}

// ── Modal de criação/edição (contrato jurídico) ───────────────────────────────
function ContratoModal({ bag, editando, onClose, onSaved }: { bag: JuridicoBag; editando: JuridicoContrato | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<JuridicoContrato>(() => editando || {
    id: '', categoria: 'fornecedor', titulo: '', contraparte: '', numero: '', objeto: '',
    valor_num: 0, moeda: 'BRL', inicio: null, vigencia_fim: null, renovacao: 'manual',
    aviso_previo_dias: 30, status: 'vigente', responsavel: '', documento_url: '', fornecedor_id: null, obs: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<JuridicoContrato>) => setF((v) => ({ ...v, ...patch }));

  const previa = f.vigencia_fim ? statusVigencia(f.vigencia_fim, bag.hoje, f.aviso_previo_dias) : null;

  const salvar = async () => {
    if (!f.titulo?.trim() && !f.contraparte?.trim()) { toast.error('Informe ao menos o título ou a contraparte.'); return; }
    setBusy(true);
    const row = {
      usuario_id: bag.userId, categoria: f.categoria, titulo: f.titulo || null, contraparte: f.contraparte || null,
      numero: f.numero || null, objeto: f.objeto || null, valor_num: Number(f.valor_num) || 0, moeda: f.moeda,
      inicio: f.inicio || null, vigencia_fim: f.vigencia_fim || null, renovacao: f.renovacao,
      aviso_previo_dias: Number(f.aviso_previo_dias) || 30, status: f.status, responsavel: f.responsavel || null,
      documento_url: f.documento_url || null, fornecedor_id: f.fornecedor_id || null, obs: f.obs || null,
    };
    const { error } = editando ? await salvarContratoJur(editando.id, row) : await criarContratoJur(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(editando ? 'Contrato atualizado.' : 'Contrato adicionado.');
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="text-lg font-bold text-ink">{editando ? 'Editar contrato' : 'Novo contrato'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo label="Categoria">
          <select value={f.categoria} onChange={(e) => set({ categoria: e.target.value as CategoriaContrato })} className={selCls}>
            {CATEGORIAS_CONTRATO.filter((c) => c.key !== 'cliente').map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select value={f.status} onChange={(e) => set({ status: e.target.value as StatusContratoJur })} className={selCls}>
            {Object.entries(STATUS_CONTRATO_JUR_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Campo>
        <Campo label="Título / objeto curto" full>
          <input value={f.titulo || ''} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Fornecimento de buffet 2026" className={inp} />
        </Campo>
        <Campo label="Contraparte">
          <input value={f.contraparte || ''} onChange={(e) => set({ contraparte: e.target.value })} placeholder="Nome da outra parte" className={inp} />
        </Campo>
        <Campo label="Número do contrato">
          <input value={f.numero || ''} onChange={(e) => set({ numero: e.target.value })} className={inp} />
        </Campo>
        {bag.fornecedores.length > 0 && (
          <Campo label="Fornecedor vinculado" full>
            <select value={f.fornecedor_id ?? ''} onChange={(e) => set({ fornecedor_id: e.target.value ? Number(e.target.value) : null })} className={selCls}>
              <option value="">— Nenhum —</option>
              {bag.fornecedores.map((fr) => <option key={fr.id} value={fr.id}>{fr.nome}</option>)}
            </select>
          </Campo>
        )}
        <Campo label="Objeto / escopo" full>
          <textarea value={f.objeto || ''} onChange={(e) => set({ objeto: e.target.value })} rows={2} className={inp} />
        </Campo>
        <Campo label="Valor">
          <input type="number" min={0} step="0.01" value={f.valor_num || ''} onChange={(e) => set({ valor_num: Number(e.target.value) })} className={inp} />
        </Campo>
        <Campo label="Moeda">
          <select value={f.moeda} onChange={(e) => set({ moeda: e.target.value })} className={selCls}>
            <option value="BRL">BRL (R$)</option>
            <option value="USD">USD ($)</option>
            <option value="EUR">EUR (€)</option>
          </select>
        </Campo>
        <Campo label="Início da vigência">
          <input type="date" value={f.inicio || ''} onChange={(e) => set({ inicio: e.target.value || null })} className={inp} />
        </Campo>
        <Campo label="Fim da vigência (vencimento)" hint={previa ? `Situação: ${previa.status === 'vencido' ? 'vencido' : previa.status === 'a_vencer' ? 'a vencer' : 'vigente'}` : undefined}>
          <input type="date" value={f.vigencia_fim || ''} onChange={(e) => set({ vigencia_fim: e.target.value || null })} className={inp} />
        </Campo>
        <Campo label="Renovação">
          <select value={f.renovacao} onChange={(e) => set({ renovacao: e.target.value as JuridicoContrato['renovacao'] })} className={selCls}>
            {RENOVACOES.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
          </select>
        </Campo>
        <Campo label="Aviso prévio (dias)" hint="Antecedência do alerta de renovação.">
          <input type="number" min={0} value={f.aviso_previo_dias} onChange={(e) => set({ aviso_previo_dias: Number(e.target.value) })} className={inp} />
        </Campo>
        <Campo label="Responsável">
          <input value={f.responsavel || ''} onChange={(e) => set({ responsavel: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Link do documento">
          <input value={f.documento_url || ''} onChange={(e) => set({ documento_url: e.target.value })} placeholder="https://…" className={inp} />
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

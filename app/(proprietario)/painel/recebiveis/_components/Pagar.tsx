'use client';

// Aba "A pagar" — gestão de saídas sobre `contas_pagar`.
//   • Cadastro avulso ou vinculado a Fornecedor (folha/aluguel/energia/…)
//   • Aging real (a vencer / 0–30 / 31–60 / 61–90 / 90+)
//   • Baixa → lançamento de despesa no caixa (+ estorno); comprovante anexável
//   • Recorrência: ao baixar, gera a próxima conta da série
//   • Aprovação (alçada leve): conta não-aprovada não pode ser paga
// Tipos/helpers em ../_lib; UI compartilhada em ./ui.

import { useCallback, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import type { TablesInsert } from '@/types/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ContaPagar, type FornecedorLite, type EfetivoPagar, type Freq,
  METODOS, inp, CAT_PAGAR, FREQS, FREQ_LABEL, ST_PAGAR_CLS, ST_PAGAR_LABEL, AGING_BUCKETS,
  catPagarLabel, catPagarCor, ymd, diffDias, efetivoPagar, aging, proximaData,
  uploadComprovante, signedUrl, removeArquivo, exportContasPagarCSV,
} from '../_lib';
import { Kpi, ModalShell, IcoWallet, IcoAlert, IcoClock, IcoCheck, IcoEdit, IcoTrash, IcoDownload, IcoRepeat, IcoPaperclip } from './ui';

type Filtro = 'todos' | 'aberto' | 'atrasado' | 'agendado' | 'pago';

// Insere despesa no caixa; tenta com fornecedor_id e cai p/ sem ele se a coluna
// não existir (migração de Fornecedores ainda não aplicada).
async function inserirDespesa(payload: Record<string, unknown>): Promise<{ id: number } | null> {
  let r = await sb.from('lancamentos').insert(payload as TablesInsert<'lancamentos'>).select('id').single();
  if (r.error && (r.error.code === 'PGRST204' || r.error.code === '42703' || /fornecedor_id/i.test(r.error.message || ''))) {
    const semForn = { ...payload };
    delete semForn.fornecedor_id;
    r = await sb.from('lancamentos').insert(semForn as TablesInsert<'lancamentos'>).select('id').single();
  }
  return r.error ? null : (r.data as { id: number });
}

export default function Pagar({ userId, contas, fornecedores, recarregar }: {
  userId: string; contas: ContaPagar[]; fornecedores: FornecedorLite[]; recarregar: () => Promise<void>;
}) {
  const toast = useToast();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [fForn, setFForn] = useState('');
  const [fCat, setFCat] = useState('');
  const [busca, setBusca] = useState('');

  // baixa
  const [pagar, setPagar] = useState<ContaPagar | null>(null);
  const [pgData, setPgData] = useState('');
  const [pgMetodo, setPgMetodo] = useState('Pix');
  const [pgFile, setPgFile] = useState<File | null>(null);
  const [pgSaving, setPgSaving] = useState(false);

  // criar/editar
  const [modal, setModal] = useState<null | { editando?: ContaPagar }>(null);
  const [fDesc, setFDesc] = useState('');
  const [fValor, setFValor] = useState('');
  const [fVenc, setFVenc] = useState('');
  const [fFornId, setFFornId] = useState('');
  const [fCategoria, setFCategoria] = useState('fornecedor');
  const [fStatus, setFStatus] = useState<'pendente' | 'agendado'>('pendente');
  const [fPlano, setFPlano] = useState('');
  const [fObs, setFObs] = useState('');
  const [fRecorrente, setFRecorrente] = useState(false);
  const [fFreq, setFFreq] = useState<Freq>('mensal');
  const [fAte, setFAte] = useState('');
  const [fAprovado, setFAprovado] = useState(true);
  const [fFile, setFFile] = useState<File | null>(null);
  const [fRemoverAnexo, setFRemoverAnexo] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const hoje = ymd(new Date());
  const fornById = useCallback((id: string | null) => fornecedores.find((f) => f.id === id), [fornecedores]);
  const fornNome = useCallback((id: string | null) => { const f = fornById(id); return f ? (f.fantasia || f.nome) : ''; }, [fornById]);

  const abertas = useMemo(() => contas.filter((c) => c.status !== 'pago' && c.status !== 'cancelado'), [contas]);

  const kpis = useMemo(() => {
    let aPagar = 0, vencido = 0, aVencer30 = 0, pagoMes = 0;
    const mes = hoje.slice(0, 7);
    contas.forEach((c) => {
      const ef = efetivoPagar(c, hoje);
      if (ef === 'pago') { if ((c.pago_em || '').slice(0, 7) === mes) pagoMes += c.valor; return; }
      if (ef === 'cancelado') return;
      aPagar += c.valor;
      if (ef === 'atrasado') vencido += c.valor;
      else if (c.vencimento && diffDias(c.vencimento, new Date()) <= 30) aVencer30 += c.valor;
    });
    return { aPagar, vencido, aVencer30, pagoMes };
  }, [contas, hoje]);

  const ag = useMemo(() => aging(abertas.map((c) => ({ vencimento: c.vencimento, valor: c.valor })), hoje), [abertas, hoje]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contas
      .filter((c) => {
        const ef = efetivoPagar(c, hoje);
        if (filtro === 'aberto' && (ef === 'pago' || ef === 'cancelado')) return false;
        if (filtro === 'atrasado' && ef !== 'atrasado') return false;
        if (filtro === 'agendado' && ef !== 'agendado') return false;
        if (filtro === 'pago' && ef !== 'pago') return false;
        if (fForn && c.fornecedor_id !== fForn) return false;
        if (fCat && c.categoria !== fCat) return false;
        if (q) {
          const hay = `${c.descricao} ${fornNome(c.fornecedor_id)} ${catPagarLabel(c.categoria)}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
  }, [contas, filtro, fForn, fCat, busca, hoje, fornNome]);

  // ── Baixa ──
  function abrirBaixa(c: ContaPagar) { setPagar(c); setPgData(ymd(new Date())); setPgMetodo(c.metodo || 'Pix'); setPgFile(null); }
  async function confirmarBaixa() {
    if (!userId || !pagar) return;
    setPgSaving(true);
    // 1) comprovante (opcional)
    let anexo = { anexo_url: pagar.anexo_url, anexo_nome: pagar.anexo_nome };
    if (pgFile) {
      try { anexo = await uploadComprovante(userId, pgFile); } catch { setPgSaving(false); toast.error('Falha ao enviar o comprovante.'); return; }
    }
    // 2) lançamento de despesa no caixa
    const lanc = await inserirDespesa({
      usuario_id: userId, tipo: 'despesa', categoria: catPagarLabel(pagar.categoria),
      descricao: pagar.descricao, valor: pagar.valor, status: 'pago', data: pgData,
      metodo_pagamento: pgMetodo, fornecedor_id: pagar.fornecedor_id, observacao: 'Baixa de conta a pagar (Contas a pagar)',
    });
    if (!lanc) { setPgSaving(false); toast.error('Erro ao lançar a despesa no caixa.'); return; }
    // 3) baixa da conta
    const { error: e2 } = await sb.from('contas_pagar').update({
      status: 'pago', pago_em: pgData, metodo: pgMetodo, lancamento_id: lanc.id, anexo_url: anexo.anexo_url, anexo_nome: anexo.anexo_nome,
    }).eq('id', pagar.id);
    if (e2) { await sb.from('lancamentos').delete().eq('id', lanc.id); setPgSaving(false); toast.error('Erro ao baixar a conta.'); return; }
    // 4) recorrência: gera a próxima ocorrência
    let gerouProxima = false;
    if (pagar.recorrente) gerouProxima = await spawnProxima(pagar, pgData);
    setPgSaving(false);
    toast.success(gerouProxima ? 'Conta paga, lançada no caixa e próxima recorrência gerada!' : 'Conta paga e lançada no caixa!');
    setPagar(null);
    await recarregar();
  }
  // Gera a próxima conta da série recorrente (sem duplicar). Retorna se criou.
  async function spawnProxima(c: ContaPagar, baseData: string): Promise<boolean> {
    const freq = c.recorrencia?.freq || 'mensal';
    const prox = proximaData(c.vencimento || baseData, freq);
    const ate = c.recorrencia?.ate;
    if (ate && prox > ate) return false;
    const raiz = c.recorrencia_pai || c.id;
    const existe = contas.some((x) => (x.recorrencia_pai === raiz || x.id === raiz) && x.vencimento === prox && x.status !== 'cancelado' && x.id !== c.id);
    if (existe) return false;
    const { error } = await sb.from('contas_pagar').insert({
      usuario_id: userId, fornecedor_id: c.fornecedor_id, categoria: c.categoria, plano_conta: c.plano_conta,
      descricao: c.descricao, valor_num: c.valor, vencimento: prox, status: 'pendente', metodo: c.metodo,
      recorrente: true, recorrencia: c.recorrencia, recorrencia_pai: raiz, aprovado: c.aprovado,
    });
    return !error;
  }
  async function estornar(c: ContaPagar) {
    if (!userId) return;
    if (c.lancamento_id) await sb.from('lancamentos').delete().eq('id', c.lancamento_id);
    const { error } = await sb.from('contas_pagar').update({ status: 'pendente', pago_em: null, lancamento_id: null }).eq('id', c.id);
    if (error) { toast.error('Erro ao estornar.'); return; }
    toast.info('Pagamento estornado.');
    await recarregar();
  }
  async function aprovar(c: ContaPagar, valor: boolean) {
    const { error } = await sb.from('contas_pagar').update({ aprovado: valor, aprovado_em: valor ? new Date().toISOString() : null }).eq('id', c.id);
    if (error) { toast.error('Erro ao atualizar aprovação.'); return; }
    toast.success(valor ? 'Conta aprovada.' : 'Aprovação removida.');
    await recarregar();
  }

  // ── Criar/editar ──
  function abrirModal(editando?: ContaPagar) {
    setModal({ editando });
    setFDesc(editando?.descricao ?? '');
    setFValor(editando ? String(editando.valor) : '');
    setFVenc(editando?.vencimento ?? '');
    setFFornId(editando?.fornecedor_id ?? '');
    setFCategoria(editando?.categoria ?? 'fornecedor');
    setFStatus(editando?.status === 'agendado' ? 'agendado' : 'pendente');
    setFPlano(editando?.plano_conta ?? '');
    setFObs(editando?.obs ?? '');
    setFRecorrente(editando?.recorrente ?? false);
    setFFreq((editando?.recorrencia?.freq as Freq) ?? 'mensal');
    setFAte(editando?.recorrencia?.ate ?? '');
    setFAprovado(editando?.aprovado ?? true);
    setFFile(null); setFRemoverAnexo(false);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function salvar() {
    if (!userId) return;
    const valor = Number(fValor);
    if (!fDesc.trim()) { toast.error('Informe a descrição.'); return; }
    if (!valor || valor <= 0) { toast.error('Informe um valor válido.'); return; }
    setSaving(true);
    // anexo
    let anexo_url = modal?.editando?.anexo_url ?? null;
    let anexo_nome = modal?.editando?.anexo_nome ?? null;
    if (fRemoverAnexo) { await removeArquivo(anexo_url); anexo_url = null; anexo_nome = null; }
    if (fFile) {
      try { const up = await uploadComprovante(userId, fFile); anexo_url = up.anexo_url; anexo_nome = up.anexo_nome; }
      catch { setSaving(false); toast.error('Falha ao enviar o anexo.'); return; }
    }
    const recorrencia = fRecorrente ? { freq: fFreq, ate: fAte || null } : {};
    const payload = {
      usuario_id: userId, fornecedor_id: fFornId || null, categoria: fCategoria, plano_conta: fPlano || null,
      descricao: fDesc.trim(), valor_num: valor, vencimento: fVenc || null, status: fStatus,
      recorrente: fRecorrente, recorrencia, aprovado: fAprovado, anexo_url, anexo_nome, obs: fObs || null,
    };
    const { error } = modal?.editando
      ? await sb.from('contas_pagar').update(payload).eq('id', modal.editando.id)
      : await sb.from('contas_pagar').insert(payload);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar a conta.'); return; }
    toast.success(modal?.editando ? 'Conta atualizada!' : 'Conta a pagar adicionada!');
    setModal(null);
    await recarregar();
  }
  async function excluir(c: ContaPagar) {
    if (!userId) return;
    if (c.status === 'pago') { toast.error('Estorne o pagamento antes de excluir.'); return; }
    if (c.anexo_url) await removeArquivo(c.anexo_url);
    const { error } = await sb.from('contas_pagar').delete().eq('id', c.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Conta removida.');
    await recarregar();
  }
  async function abrirAnexo(path: string | null) {
    const url = await signedUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else toast.error('Não foi possível abrir o anexo.');
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => exportContasPagarCSV(filtradas, fornNome, hoje)} disabled={contas.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoDownload /> Exportar</button>
        <button onClick={() => abrirModal()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Conta a pagar</button>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="A pagar" value={formatMoneyShort(kpis.aPagar)} tone="roxo" icon={<IcoWallet />} />
        <Kpi label="Vencido" value={formatMoneyShort(kpis.vencido)} tone="vermelho" icon={<IcoAlert />} />
        <Kpi label="Vence em 30 dias" value={formatMoneyShort(kpis.aVencer30)} tone="gold" icon={<IcoClock />} />
        <Kpi label="Pago no mês" value={formatMoneyShort(kpis.pagoMes)} tone="verde" icon={<IcoCheck />} />
      </div>

      {/* Aging */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-3 text-base font-bold text-ink">Aging — contas em aberto</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {AGING_BUCKETS.map((b) => (
            <div key={b.key} className="rounded-xl border border-black/[0.06] p-3">
              <div className="text-[0.7rem] text-ink-muted">{b.label}</div>
              <div className={`mt-1 text-base font-bold ${b.cls}`}>{formatMoneyShort(ag[b.key])}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Contas a pagar</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar conta/fornecedor…" className="w-40 rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none sm:w-48" />
            {fornecedores.length > 0 && (
              <select value={fForn} onChange={(e) => setFForn(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
                <option value="">Todos fornecedores</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.fantasia || f.nome}</option>)}
              </select>
            )}
            <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
              <option value="">Todas categorias</option>
              {CAT_PAGAR.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
            <div className="flex gap-1">
              {(['todos', 'aberto', 'atrasado', 'agendado', 'pago'] as Filtro[]).map((f) => (
                <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${filtro === f ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>
                  {f === 'aberto' ? 'Em aberto' : f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtradas.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">
            {contas.length === 0 ? 'Nenhuma conta a pagar ainda. Use + Conta a pagar para cadastrar fornecedores, folha e recorrências.' : 'Nenhuma conta neste filtro.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Descrição</th>
                  <th className="hidden pb-2 font-semibold md:table-cell">Categoria</th>
                  <th className="pb-2 font-semibold">Vencimento</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                  <th className="w-28 pb-2" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((c) => {
                  const ef: EfetivoPagar = efetivoPagar(c, hoje);
                  const pago = ef === 'pago';
                  return (
                    <tr key={c.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-ink-soft">{c.descricao}</p>
                          {c.recorrente && <span title={`Recorrência ${FREQ_LABEL[c.recorrencia.freq || 'mensal']}`} className="text-violet-500"><IcoRepeat /></span>}
                          {c.anexo_url && <button onClick={() => abrirAnexo(c.anexo_url)} title={c.anexo_nome || 'Comprovante'} className="text-ink-muted hover:text-brand"><IcoPaperclip /></button>}
                        </div>
                        <p className="text-xs text-ink-muted">{fornNome(c.fornecedor_id) || <span className="italic">Avulsa</span>}</p>
                      </td>
                      <td className="hidden py-2.5 md:table-cell">
                        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
                          <span className="h-2 w-2 rounded-full" style={{ background: catPagarCor(c.categoria) }} />{catPagarLabel(c.categoria)}
                        </span>
                      </td>
                      <td className="py-2.5 text-ink-muted">{c.vencimento ? formatDate(c.vencimento, { style: 'short' }) : '—'}</td>
                      <td className="py-2.5">
                        <div className="flex flex-col gap-1">
                          <span className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${ST_PAGAR_CLS[ef]}`}>{ST_PAGAR_LABEL[ef]}</span>
                          {!c.aprovado && !pago && <span className="w-fit rounded-full bg-orange-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-orange-600">Aguardando aprovação</span>}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-ink-soft">{formatMoney(c.valor)}</td>
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center justify-end gap-1">
                          {pago ? (
                            <button onClick={() => estornar(c)} title="Estornar" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-amber-300 hover:text-amber-700">Estornar</button>
                          ) : c.aprovado ? (
                            <button onClick={() => abrirBaixa(c)} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-violet-700">Pagar</button>
                          ) : (
                            <button onClick={() => aprovar(c, true)} className="rounded-lg bg-orange-500 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-orange-600">Aprovar</button>
                          )}
                          <div className="flex opacity-0 transition group-hover:opacity-100">
                            <button onClick={() => abrirModal(c)} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                            <button onClick={() => excluir(c)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
                          </div>
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

      {/* Modal baixa */}
      {pagar && (
        <ModalShell onClose={() => setPagar(null)} maxW="max-w-sm">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600"><IcoCheck /></span>
            <div>
              <h3 className="font-display text-xl font-bold text-ink">Registrar pagamento</h3>
              <p className="text-xs text-ink-muted">{pagar.descricao} · {formatMoney(pagar.valor)}</p>
            </div>
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Data do pagamento</span>
              <input type="date" value={pgData} onChange={(e) => setPgData(e.target.value)} className={inp} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Método</span>
              <select value={pgMetodo} onChange={(e) => setPgMetodo(e.target.value)} className={inp}>
                {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Comprovante <span className="font-normal text-ink-muted">(opcional)</span></span>
              <input type="file" accept="image/*,application/pdf" onChange={(e) => setPgFile(e.target.files?.[0] ?? null)} className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-black/[0.04] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink-soft" />
            </label>
            {pagar.recorrente && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">Conta recorrente ({FREQ_LABEL[pagar.recorrencia.freq || 'mensal']}): a próxima será gerada automaticamente.</p>}
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">Isto gera automaticamente um lançamento de despesa no Financeiro.</p>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button onClick={confirmarBaixa} disabled={pgSaving} className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60">{pgSaving ? 'Registrando…' : 'Confirmar pagamento'}</button>
            <button onClick={() => setPagar(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
          </div>
        </ModalShell>
      )}

      {/* Modal criar/editar */}
      {modal && (
        <ModalShell onClose={() => setModal(null)} maxW="max-w-lg">
          <h3 className="mb-5 font-display text-xl font-bold text-ink">{modal.editando ? 'Editar conta a pagar' : 'Nova conta a pagar'}</h3>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Descrição</span>
              <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} className={inp} autoFocus placeholder="Ex: Aluguel do salão / Folha de junho / NF buffet" />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Valor</span>
                <input type="number" min={0} step="0.01" value={fValor} onChange={(e) => setFValor(e.target.value)} className={inp} placeholder="0,00" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Vencimento</span>
                <input type="date" value={fVenc} onChange={(e) => setFVenc(e.target.value)} className={inp} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Categoria</span>
                <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={inp}>
                  {CAT_PAGAR.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Fornecedor <span className="font-normal text-ink-muted">(opcional)</span></span>
                <select value={fFornId} onChange={(e) => setFFornId(e.target.value)} className={inp}>
                  <option value="">Avulsa / sem fornecedor</option>
                  {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.fantasia || f.nome}</option>)}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Situação inicial</span>
                <select value={fStatus} onChange={(e) => setFStatus(e.target.value as 'pendente' | 'agendado')} className={inp}>
                  <option value="pendente">Pendente</option>
                  <option value="agendado">Agendado</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Conta contábil <span className="font-normal text-ink-muted">(opcional)</span></span>
                <input value={fPlano} onChange={(e) => setFPlano(e.target.value)} className={inp} placeholder="Ex: 4.1.02" />
              </label>
            </div>

            {/* Recorrência */}
            <div className="rounded-xl border border-black/[0.06] p-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={fRecorrente} onChange={(e) => setFRecorrente(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
                <span className="text-sm font-semibold text-ink-soft">Conta recorrente</span>
              </label>
              {fRecorrente && (
                <div className="mt-3 grid grid-cols-2 gap-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-muted">Frequência</span>
                    <select value={fFreq} onChange={(e) => setFFreq(e.target.value as Freq)} className={inp}>
                      {FREQS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-muted">Repetir até <span className="font-normal">(opcional)</span></span>
                    <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className={inp} />
                  </label>
                  <p className="col-span-2 text-[0.7rem] text-ink-muted">A próxima conta da série é criada automaticamente quando esta for paga.</p>
                </div>
              )}
            </div>

            {/* Aprovação + anexo */}
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={fAprovado} onChange={(e) => setFAprovado(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
              <span className="text-sm text-ink-soft">Aprovada para pagamento <span className="text-ink-muted">(desmarque para exigir aprovação)</span></span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Anexo / nota <span className="font-normal text-ink-muted">(opcional)</span></span>
              {modal.editando?.anexo_url && !fRemoverAnexo && !fFile && (
                <div className="mb-2 flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2 text-xs">
                  <button type="button" onClick={() => abrirAnexo(modal.editando!.anexo_url)} className="truncate font-medium text-brand hover:underline">{modal.editando.anexo_nome || 'Ver anexo'}</button>
                  <button type="button" onClick={() => setFRemoverAnexo(true)} className="ml-2 shrink-0 text-ink-muted hover:text-red-600">Remover</button>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={(e) => { setFFile(e.target.files?.[0] ?? null); setFRemoverAnexo(false); }} className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-black/[0.04] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink-soft" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Observação <span className="font-normal text-ink-muted">(opcional)</span></span>
              <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} className={inp} placeholder="Notas internas…" />
            </label>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar conta'}</button>
            <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
          </div>
        </ModalShell>
      )}

      <p className="mt-4 text-center text-xs text-ink-muted">
        Fornecedores em <Link href="/painel/fornecedores" className="font-semibold text-brand hover:underline">Suprimentos</Link> · folha em <Link href="/painel/equipe" className="font-semibold text-brand hover:underline">Equipe</Link>
      </p>
    </div>
  );
}

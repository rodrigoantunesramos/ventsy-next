'use client';

// Aba "Saldo atual" — visão de inventário em tempo real.
//   • KPIs: itens ativos, valor do estoque (custo médio), abaixo do mínimo, lotes a vencer
//   • Valor por categoria (barras puras)
//   • Tabela com semáforo de mínimo, busca/categoria/local/nível
//   • CRUD de produto (direto via RLS); estoque inicial vira uma entrada (/api/estoque)
//   • Movimentar rápido reabre o MovModal já no produto

import { useMemo, useRef, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { statusMinimo, valorProduto, valorEstoque, diasParaVencer, type NivelEstoque } from '@/lib/estoque';
import {
  type Produto, type EstoqueMov, type EventoLite,
  CATEGORIAS, LOCAIS, UNIDADES, catLabel, catCor, localLabel,
  NIVEL_CLS, NIVEL_LABEL, NIVEL_DOT, inp, postMov, exportCSV,
} from '../_lib';
import { Kpi, ModalShell, EmptyState, IcoBox, IcoBoxes, IcoAlert, IcoClock, IcoEdit, IcoTrash, IcoDownload } from './ui';

export default function Saldo({ userId, produtos, movs, eventos, recarregar, onMover }: {
  userId: string;
  produtos: Produto[];
  movs: EstoqueMov[];
  eventos: EventoLite[];
  recarregar: () => Promise<void>;
  onMover: (produtoId: string) => void;
}) {
  const toast = useToast();
  const nowMs = Date.now();
  const [busca, setBusca] = useState('');
  const [fCat, setFCat] = useState('');
  const [fLocal, setFLocal] = useState('');
  const [soAbaixo, setSoAbaixo] = useState(false);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const ativos = produtos.filter((p) => p.ativo);
    const abaixo = ativos.filter((p) => statusMinimo(p) !== 'ok').length;
    const lotesAVencer = movs.filter((m) => m.tipo === 'entrada' && m.validade && diasParaVencer(m.validade, nowMs) <= 30).length;
    return { itens: ativos.length, valor: valorEstoque(ativos), abaixo, lotesAVencer };
  }, [produtos, movs, nowMs]);

  const porCategoria = useMemo(() => {
    const map = new Map<string, number>();
    produtos.filter((p) => p.ativo).forEach((p) => map.set(p.categoria, (map.get(p.categoria) || 0) + valorProduto(p)));
    const arr = [...map.entries()].map(([cat, valor]) => ({ cat, valor })).sort((a, b) => b.valor - a.valor);
    const max = Math.max(1, ...arr.map((a) => a.valor));
    return { arr, max };
  }, [produtos]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return produtos
      .filter((p) => {
        if (fCat && p.categoria !== fCat) return false;
        if (fLocal && p.local !== fLocal) return false;
        if (soAbaixo && (statusMinimo(p) === 'ok' || !p.ativo)) return false;
        if (q && !`${p.nome} ${p.sku || ''}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => {
        // alertas primeiro (zerado/baixo), depois por nome
        const rank = (p: Produto) => (statusMinimo(p) === 'zerado' ? 0 : statusMinimo(p) === 'baixo' ? 1 : 2);
        return rank(a) - rank(b) || a.nome.localeCompare(b.nome);
      });
  }, [produtos, busca, fCat, fLocal, soAbaixo]);

  // ── CRUD de produto ──
  const [modal, setModal] = useState<null | { editando?: Produto }>(null);
  const [fNome, setFNome] = useState('');
  const [fSku, setFSku] = useState('');
  const [fCategoria, setFCategoria] = useState('bebidas');
  const [fUnidade, setFUnidade] = useState('un');
  const [fLocalProd, setFLocalProd] = useState('almoxarifado');
  const [fMin, setFMin] = useState('');
  const [fPerecivel, setFPerecivel] = useState(false);
  const [fAtivo, setFAtivo] = useState(true);
  const [fObs, setFObs] = useState('');
  const [fEstoqueIni, setFEstoqueIni] = useState('');
  const [fCustoIni, setFCustoIni] = useState('');
  const [saving, setSaving] = useState(false);
  const nomeRef = useRef<HTMLInputElement>(null);

  function abrir(editando?: Produto) {
    setModal({ editando });
    setFNome(editando?.nome ?? '');
    setFSku(editando?.sku ?? '');
    setFCategoria(editando?.categoria ?? 'bebidas');
    setFUnidade(editando?.unidade ?? 'un');
    setFLocalProd(editando?.local ?? 'almoxarifado');
    setFMin(editando ? String(editando.estoque_minimo) : '');
    setFPerecivel(editando?.perecivel ?? false);
    setFAtivo(editando?.ativo ?? true);
    setFObs(editando?.obs ?? '');
    setFEstoqueIni(''); setFCustoIni('');
  }

  async function salvar() {
    if (!fNome.trim()) { toast.error('Informe o nome do produto.'); return; }
    setSaving(true);
    const base = {
      usuario_id: userId, nome: fNome.trim(), sku: fSku.trim() || null, categoria: fCategoria,
      unidade: fUnidade, local: fLocalProd, estoque_minimo: Number(fMin) || 0, perecivel: fPerecivel, ativo: fAtivo, obs: fObs.trim() || null,
    };
    if (modal?.editando) {
      const { error } = await sb.from('produtos').update(base).eq('id', modal.editando.id);
      setSaving(false);
      if (error) { toast.error(error.code === '23505' ? 'Já existe um produto com este SKU.' : 'Erro ao salvar o produto.'); return; }
      toast.success('Produto atualizado!');
    } else {
      const { data, error } = await sb.from('produtos').insert(base).select('id').single();
      if (error) { setSaving(false); toast.error(error.code === '23505' ? 'Já existe um produto com este SKU.' : 'Erro ao criar o produto.'); return; }
      // Estoque inicial → entrada autoritativa (recalcula custo médio).
      const qIni = Number(fEstoqueIni) || 0;
      if (qIni > 0) {
        const r = await postMov({ produto_id: data.id, tipo: 'entrada', quantidade: qIni, custo_unit_num: Number(fCustoIni) || 0, motivo: 'Estoque inicial' });
        if (!r.ok) toast.info('Produto criado, mas a entrada inicial falhou — registre em Movimentações.');
      }
      setSaving(false);
      toast.success('Produto cadastrado!');
    }
    setModal(null);
    await recarregar();
  }

  async function excluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"? As movimentações ligadas a ele também serão removidas.`)) return;
    const { error } = await sb.from('produtos').delete().eq('id', p.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Produto removido.');
    await recarregar();
  }

  function exportar() {
    const header = ['SKU', 'Produto', 'Categoria', 'Local', 'Unidade', 'Saldo', 'Mínimo', 'Status', 'Custo médio', 'Valor'];
    const rows = filtrados.map((p) => [
      p.sku || '', p.nome, catLabel(p.categoria), localLabel(p.local), p.unidade,
      p.estoque_atual, p.estoque_minimo, NIVEL_LABEL[statusMinimo(p)], p.custo_medio_num, valorProduto(p),
    ]);
    exportCSV(`estoque-saldo-${new Date().toISOString().slice(0, 10)}.csv`, header, rows);
  }

  if (produtos.length === 0) {
    return (
      <EmptyState icon={<IcoBoxes />} title="Seu almoxarifado está vazio">
        Cadastre o primeiro produto (bebidas, descartáveis, limpeza…) para acompanhar saldo, mínimos e validade.
        <div className="mt-4"><button onClick={() => abrir()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Primeiro produto</button></div>
        {modal && <ProdutoModal />}
      </EmptyState>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={exportar} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03]"><IcoDownload /> Exportar</button>
        <button onClick={() => abrir()} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Produto</button>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Itens ativos" value={formatNumber(kpis.itens)} tone="azul" icon={<IcoBoxes />} />
        <Kpi label="Valor do estoque" value={formatMoneyShort(kpis.valor)} tone="verde" icon={<IcoBox />} hint="a custo médio" />
        <Kpi label="Abaixo do mínimo" value={formatNumber(kpis.abaixo)} tone={kpis.abaixo > 0 ? 'vermelho' : 'cinza'} icon={<IcoAlert />} hint="precisa repor" />
        <Kpi label="Lotes a vencer" value={formatNumber(kpis.lotesAVencer)} tone={kpis.lotesAVencer > 0 ? 'gold' : 'cinza'} icon={<IcoClock />} hint="≤ 30 dias" />
      </div>

      {/* Valor por categoria */}
      {porCategoria.arr.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-3 text-base font-bold text-ink">Valor por categoria</h3>
          <div className="space-y-2">
            {porCategoria.arr.map(({ cat, valor }) => (
              <div key={cat}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: catCor(cat) }} />{catLabel(cat)}</span>
                  <span className="font-semibold text-ink-soft">{formatMoneyShort(valor)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((valor / porCategoria.max) * 100)}%`, background: catCor(cat) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-bold text-ink">Produtos</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome/SKU…" className="w-40 rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none sm:w-48" />
            <select value={fCat} onChange={(e) => setFCat(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
              <option value="">Todas categorias</option>
              {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
            <select value={fLocal} onChange={(e) => setFLocal(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
              <option value="">Todos locais</option>
              {LOCAIS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
            </select>
            <button onClick={() => setSoAbaixo((v) => !v)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${soAbaixo ? 'bg-red-600 text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Abaixo do mínimo</button>
          </div>
        </div>

        {filtrados.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">Nenhum produto neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Produto</th>
                  <th className="hidden pb-2 font-semibold sm:table-cell">Local</th>
                  <th className="pb-2 text-right font-semibold">Saldo</th>
                  <th className="hidden pb-2 text-right font-semibold md:table-cell">Mínimo</th>
                  <th className="hidden pb-2 text-right font-semibold lg:table-cell">Custo médio</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                  <th className="w-24 pb-2" />
                </tr>
              </thead>
              <tbody>
                {filtrados.map((p) => {
                  const nivel: NivelEstoque = statusMinimo(p);
                  return (
                    <tr key={p.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${NIVEL_DOT[nivel]}`} title={NIVEL_LABEL[nivel]} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink-soft">{p.nome}{!p.ativo && <span className="ml-1.5 text-[0.65rem] uppercase text-ink-muted">(inativo)</span>}</p>
                            <p className="text-xs text-ink-muted">
                              <span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: catCor(p.categoria) }} />{catLabel(p.categoria)}</span>
                              {p.sku && <> · {p.sku}</>}{p.perecivel && <> · perecível</>}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="hidden py-2.5 text-ink-muted sm:table-cell">{localLabel(p.local)}</td>
                      <td className="py-2.5 text-right">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${NIVEL_CLS[nivel]}`}>{formatNumber(p.estoque_atual)} {p.unidade}</span>
                      </td>
                      <td className="hidden py-2.5 text-right text-ink-muted md:table-cell">{p.estoque_minimo ? `${formatNumber(p.estoque_minimo)} ${p.unidade}` : '—'}</td>
                      <td className="hidden py-2.5 text-right text-ink-muted lg:table-cell">{formatMoney(p.custo_medio_num)}</td>
                      <td className="py-2.5 text-right font-bold text-ink-soft">{formatMoney(valorProduto(p))}</td>
                      <td className="py-2.5 pl-2">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => onMover(p.id)} className="rounded-lg bg-ink px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-black">Movimentar</button>
                          <div className="flex opacity-0 transition group-hover:opacity-100">
                            <button onClick={() => abrir(p)} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                            <button onClick={() => excluir(p)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
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

      {modal && <ProdutoModal />}
    </div>
  );

  // ── Modal de produto (interno p/ acesso ao estado) ──
  function ProdutoModal() {
    return (
      <ModalShell onClose={() => setModal(null)} maxW="max-w-lg">
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{modal?.editando ? 'Editar produto' : 'Novo produto'}</h3>
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome</span>
            <input ref={nomeRef} value={fNome} onChange={(e) => setFNome(e.target.value)} className={inp} autoFocus placeholder="Ex: Refrigerante lata 350ml" />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">SKU <span className="font-normal text-ink-muted">(opcional)</span></span>
              <input value={fSku} onChange={(e) => setFSku(e.target.value)} className={inp} placeholder="Código interno" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Categoria</span>
              <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={inp}>
                {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Unidade</span>
              <select value={fUnidade} onChange={(e) => setFUnidade(e.target.value)} className={inp}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Local</span>
              <select value={fLocalProd} onChange={(e) => setFLocalProd(e.target.value)} className={inp}>
                {LOCAIS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Estoque mínimo</span>
              <input type="number" min={0} step="0.01" value={fMin} onChange={(e) => setFMin(e.target.value)} className={inp} placeholder="0" />
            </label>
          </div>

          {!modal?.editando && (
            <div className="grid grid-cols-2 gap-4 rounded-xl border border-black/[0.06] p-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-muted">Estoque inicial <span className="font-normal">(opcional)</span></span>
                <input type="number" min={0} step="0.01" value={fEstoqueIni} onChange={(e) => setFEstoqueIni(e.target.value)} className={inp} placeholder="0" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-ink-muted">Custo unitário inicial</span>
                <input type="number" min={0} step="0.01" value={fCustoIni} onChange={(e) => setFCustoIni(e.target.value)} className={inp} placeholder="0,00" />
              </label>
              <p className="col-span-2 text-[0.7rem] text-ink-muted">Gera a primeira entrada e define o custo médio.</p>
            </div>
          )}

          {modal?.editando && (
            <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-[0.72rem] text-ink-muted">
              Saldo atual: <b className="text-ink-soft">{formatNumber(modal.editando.estoque_atual)} {modal.editando.unidade}</b> · custo médio {formatMoney(modal.editando.custo_medio_num)}. Esses valores mudam só por movimentação.
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={fPerecivel} onChange={(e) => setFPerecivel(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
              <span className="text-sm text-ink-soft">Perecível (controla validade/lote)</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={fAtivo} onChange={(e) => setFAtivo(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
              <span className="text-sm text-ink-soft">Ativo</span>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Observação <span className="font-normal text-ink-muted">(opcional)</span></span>
            <textarea value={fObs} onChange={(e) => setFObs(e.target.value)} rows={2} className={inp} placeholder="Notas internas…" />
          </label>
        </div>
        <div className="mt-6 flex items-center gap-3">
          <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar produto'}</button>
          <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
        </div>
      </ModalShell>
    );
  }
}

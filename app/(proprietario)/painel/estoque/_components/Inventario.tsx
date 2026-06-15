'use client';

// Aba "Inventário" — contagem cíclica (contado × sistema → ajustes).
//   • Cria um inventário (rascunho) congelando o saldo do sistema por produto
//   • Conta fisicamente; a divergência (contado − sistema) fica visível
//   • Concluir gera uma movimentação de 'ajuste' por divergência (/api/estoque),
//     trazendo o saldo atual para o contado, com rastro e acuracidade
//   • Histórico com acuracidade por inventário
// Rascunho via RLS (tabela inventarios); ajustes via API autoritativa.

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatNumber, formatPercent, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { type Produto, type Inventario as Inv, type InvItem, LOCAIS, localLabel, inp, postMov, ymd } from '../_lib';
import { Kpi, EmptyState, ModalShell, IcoClipboard, IcoCheck, IcoList } from './ui';

export default function Inventario({ userId, produtos, inventarios, recarregar }: {
  userId: string;
  produtos: Produto[];
  inventarios: Inv[];
  recarregar: () => Promise<void>;
}) {
  const toast = useToast();
  const prodById = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);

  const [sel, setSel] = useState<Inv | null>(null);
  const [contagem, setContagem] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const [novo, setNovo] = useState(false);
  const [novoLocal, setNovoLocal] = useState('');

  // ── Criar inventário (rascunho) ──
  async function criar() {
    const alvo = produtos.filter((p) => p.ativo && (!novoLocal || p.local === novoLocal));
    if (alvo.length === 0) { toast.error('Nenhum produto ativo para inventariar neste local.'); return; }
    const itens: InvItem[] = alvo.map((p) => ({ produto_id: p.id, sistema: p.estoque_atual, contado: p.estoque_atual }));
    const { data, error } = await sb.from('inventarios').insert({
      usuario_id: userId, data: ymd(new Date()), local: novoLocal || null, status: 'aberto', itens, ajustes: 0,
    }).select('id,data,local,status,itens,ajustes,obs,criado_em').single();
    if (error) { toast.error('Erro ao criar o inventário.'); return; }
    setNovo(false); setNovoLocal('');
    await recarregar();
    abrir({ ...data, status: 'aberto', itens } as Inv);
  }

  function abrir(i: Inv) {
    setSel(i);
    const c: Record<string, string> = {};
    i.itens.forEach((it) => { c[it.produto_id] = String(it.contado); });
    setContagem(c);
  }

  const linhasSel = useMemo(() => {
    if (!sel) return [];
    return sel.itens
      .map((it) => {
        const p = prodById.get(it.produto_id);
        const contado = sel.status === 'aberto' ? Number(contagem[it.produto_id] ?? it.contado) : it.contado;
        const live = p ? p.estoque_atual : it.sistema; // saldo atual (p/ ajuste real)
        return { it, p, contado, live, divergencia: Math.round((contado - it.sistema) * 100) / 100 };
      })
      .filter((x) => x.p);
  }, [sel, contagem, prodById]);

  const acuraciaSel = useMemo(() => {
    if (linhasSel.length === 0) return 1;
    const ok = linhasSel.filter((x) => x.divergencia === 0).length;
    return ok / linhasSel.length;
  }, [linhasSel]);

  async function salvarRascunho() {
    if (!sel) return;
    setSalvando(true);
    const itens: InvItem[] = sel.itens.map((it) => ({ ...it, contado: Number(contagem[it.produto_id] ?? it.contado) }));
    const { error } = await sb.from('inventarios').update({ itens }).eq('id', sel.id);
    setSalvando(false);
    if (error) { toast.error('Erro ao salvar a contagem.'); return; }
    toast.success('Contagem salva.');
    setSel({ ...sel, itens });
    await recarregar();
  }

  async function concluir() {
    if (!sel) return;
    if (!confirm('Concluir o inventário? Os ajustes de divergência serão lançados no estoque.')) return;
    setSalvando(true);
    const itens: InvItem[] = sel.itens.map((it) => ({ ...it, contado: Number(contagem[it.produto_id] ?? it.contado) }));
    let ajustes = 0, falhas = 0;
    for (const it of itens) {
      const p = prodById.get(it.produto_id);
      const live = p ? p.estoque_atual : it.sistema;
      const delta = Math.round((it.contado - live) * 100) / 100;
      if (delta === 0) continue;
      const r = await postMov({ produto_id: it.produto_id, tipo: 'ajuste', quantidade: delta, motivo: `Inventário ${sel.data}` });
      if (r.ok) ajustes++; else falhas++;
    }
    const { error } = await sb.from('inventarios').update({ status: 'concluido', itens, ajustes }).eq('id', sel.id);
    setSalvando(false);
    if (error) { toast.error('Ajustes lançados, mas houve erro ao fechar o inventário.'); }
    else if (falhas > 0) toast.info(`Inventário concluído com ${ajustes} ajuste(s); ${falhas} falharam.`);
    else toast.success(`Inventário concluído — ${ajustes} ajuste(s) lançado(s).`);
    setSel(null);
    await recarregar();
  }

  async function cancelar(i: Inv) {
    if (!confirm('Cancelar este inventário? A contagem será descartada (nenhum ajuste é lançado).')) return;
    const { error } = await sb.from('inventarios').update({ status: 'cancelado' }).eq('id', i.id);
    if (error) { toast.error('Erro ao cancelar.'); return; }
    toast.info('Inventário cancelado.');
    if (sel?.id === i.id) setSel(null);
    await recarregar();
  }

  // ── Detalhe / contagem ──
  if (sel) {
    const aberto = sel.status === 'aberto';
    return (
      <div>
        <button onClick={() => setSel(null)} className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-muted hover:text-ink">← Voltar aos inventários</button>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">Inventário · {formatDate(sel.data)}{sel.local ? ` · ${localLabel(sel.local)}` : ''}</h3>
              <p className="text-xs text-ink-muted">{aberto ? 'Rascunho — informe a contagem física.' : `Concluído · ${sel.ajustes} ajuste(s)`} · acuracidade {formatPercent(acuraciaSel)}</p>
            </div>
            {aberto && (
              <div className="flex gap-2">
                <button onClick={salvarRascunho} disabled={salvando} className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50">Salvar contagem</button>
                <button onClick={concluir} disabled={salvando} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{salvando ? 'Processando…' : 'Concluir e ajustar'}</button>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Produto</th>
                  <th className="pb-2 text-right font-semibold">Sistema</th>
                  <th className="pb-2 text-right font-semibold">Contado</th>
                  <th className="pb-2 text-right font-semibold">Divergência</th>
                </tr>
              </thead>
              <tbody>
                {linhasSel.map(({ it, p, contado, divergencia }) => (
                  <tr key={it.produto_id} className="border-b border-black/[0.04] last:border-0">
                    <td className="py-2.5">
                      <p className="font-medium text-ink-soft">{p!.nome}</p>
                      <p className="text-xs text-ink-muted">{p!.unidade}</p>
                    </td>
                    <td className="py-2.5 text-right text-ink-muted">{formatNumber(it.sistema)}</td>
                    <td className="py-2.5 text-right">
                      {aberto ? (
                        <input type="number" step="0.01" value={contagem[it.produto_id] ?? ''} onChange={(e) => setContagem((c) => ({ ...c, [it.produto_id]: e.target.value }))}
                          className="w-24 rounded-lg border border-black/10 px-2 py-1 text-right text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                      ) : formatNumber(contado)}
                    </td>
                    <td className={`py-2.5 text-right font-bold ${divergencia === 0 ? 'text-ink-muted' : divergencia > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {divergencia > 0 ? '+' : ''}{formatNumber(divergencia)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {aberto && <p className="mt-3 text-[0.72rem] text-ink-muted">Ao concluir, cada divergência vira um ajuste que traz o saldo atual ao valor contado (rastro no Kardex).</p>}
        </div>
      </div>
    );
  }

  // ── Lista / histórico ──
  const abertos = inventarios.filter((i) => i.status === 'aberto');
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-ink-muted">{inventarios.length} inventário(s) · {abertos.length} em aberto</div>
        <button onClick={() => setNovo(true)} disabled={produtos.length === 0} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">+ Novo inventário</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label="Inventários" value={formatNumber(inventarios.length)} tone="azul" icon={<IcoClipboard />} />
        <Kpi label="Em aberto" value={formatNumber(abertos.length)} tone={abertos.length > 0 ? 'gold' : 'cinza'} icon={<IcoList />} />
        <Kpi label="Concluídos" value={formatNumber(inventarios.filter((i) => i.status === 'concluido').length)} tone="verde" icon={<IcoCheck />} />
      </div>

      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 text-base font-bold text-ink">Histórico</h3>
        {inventarios.length === 0 ? (
          <EmptyState icon={<IcoClipboard />} title="Nenhum inventário ainda">Faça a primeira contagem cíclica para medir a acuracidade do seu estoque e corrigir divergências com rastro.</EmptyState>
        ) : (
          <div className="divide-y divide-black/[0.04]">
            {inventarios.map((i) => {
              const total = i.itens.length;
              const ok = i.itens.filter((it) => Number(it.contado) === Number(it.sistema)).length;
              const acc = total > 0 ? ok / total : 1;
              const cls = i.status === 'concluido' ? 'bg-emerald-50 text-emerald-700' : i.status === 'cancelado' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-700';
              return (
                <div key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-ink-soft">{formatDate(i.data)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold uppercase ${cls}`}>{i.status}</span>
                      {i.local && <span className="text-xs text-ink-muted">{localLabel(i.local)}</span>}
                    </div>
                    <p className="text-xs text-ink-muted">{total} item(ns) · acuracidade {formatPercent(acc)}{i.status === 'concluido' ? ` · ${i.ajustes} ajuste(s)` : ''}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => abrir(i)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/[0.03]">{i.status === 'aberto' ? 'Continuar' : 'Ver'}</button>
                    {i.status === 'aberto' && <button onClick={() => cancelar(i)} className="rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-red-300 hover:text-red-600">Cancelar</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal novo inventário */}
      {novo && (
        <ModalShell onClose={() => setNovo(false)} maxW="max-w-sm">
          <h3 className="mb-4 font-display text-xl font-bold text-ink">Novo inventário</h3>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Local <span className="font-normal text-ink-muted">(opcional)</span></span>
            <select value={novoLocal} onChange={(e) => setNovoLocal(e.target.value)} className={inp}>
              <option value="">Todos os locais</option>
              {LOCAIS.map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
            </select>
          </label>
          <p className="mt-3 text-xs text-ink-muted">Congela o saldo atual de cada produto ativo{novoLocal ? ' do local escolhido' : ''} como "sistema" para você conferir a contagem física.</p>
          <div className="mt-6 flex items-center gap-3">
            <button onClick={criar} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600">Criar e contar</button>
            <button onClick={() => setNovo(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

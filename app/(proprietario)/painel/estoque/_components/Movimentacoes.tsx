'use client';

// Aba "Movimentações" — Kardex completo (entradas/saídas/ajustes/perdas/transf.).
//   • Filtros: produto, tipo, evento, período
//   • Kardex por produto: ao filtrar um produto, mostra o saldo acumulado (FEFO-agnóstico)
//   • Consumo por evento: custo direto somado por evento (alimenta a Contabilidade)
//   • Excluir movimentação reverte e recalcula o produto (/api/estoque)
// Criar movimentação usa o MovModal (controlado pela shell via onNovaMov).

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatMoney, formatMoneyShort, formatNumber, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { efeitoSaldo, kardex, consumoPorEvento } from '@/lib/estoque';
import {
  type Produto, type EstoqueMov, type EventoLite,
  MOV_TIPOS, MOV_BY, localLabel, deleteMov, exportCSV, ymd,
} from '../_lib';
import type { MovTipo } from '@/lib/estoque';
import { Kpi, EmptyState, IcoHistory, IcoArrowDown, IcoArrowUp, IcoTrash, IcoDownload, IcoCart } from './ui';

export default function Movimentacoes({ produtos, movs, eventos, recarregar, onNovaMov }: {
  produtos: Produto[];
  movs: EstoqueMov[];
  eventos: EventoLite[];
  recarregar: () => Promise<void>;
  onNovaMov: () => void;
}) {
  const toast = useToast();
  const [fProduto, setFProduto] = useState('');
  const [fTipo, setFTipo] = useState<'' | MovTipo>('');
  const [fEvento, setFEvento] = useState('');
  const [fDe, setFDe] = useState('');
  const [fAte, setFAte] = useState('');

  const prodById = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos]);
  const evById = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const prodNome = (id: string) => prodById.get(id)?.nome || '—';
  const prodUnid = (id: string) => prodById.get(id)?.unidade || '';
  const evNome = (id: string | null) => (id ? evById.get(id)?.nome_evento || 'Evento' : '');

  // filtro base (sem ordenação) — usado por KPIs/consumo/lista
  const filtrados = useMemo(() => {
    return movs.filter((m) => {
      if (fProduto && m.produto_id !== fProduto) return false;
      if (fTipo && m.tipo !== fTipo) return false;
      if (fEvento && m.evento_id !== fEvento) return false;
      const d = (m.criado_em || '').slice(0, 10);
      if (fDe && d < fDe) return false;
      if (fAte && d > fAte) return false;
      return true;
    });
  }, [movs, fProduto, fTipo, fEvento, fDe, fAte]);

  const kpis = useMemo(() => {
    let entradas = 0, saidas = 0;
    filtrados.forEach((m) => {
      if (m.tipo === 'entrada') entradas += Math.abs(m.custo_total_num);
      if (m.tipo === 'saida' || m.tipo === 'perda') saidas += Math.abs(m.custo_total_num);
    });
    return { entradas, saidas, n: filtrados.length };
  }, [filtrados]);

  const consumo = useMemo(() => consumoPorEvento(filtrados).slice(0, 6), [filtrados]);

  // modo Kardex (produto único) → cronológico asc com saldo acumulado
  const modoKardex = !!fProduto;
  const linhas = useMemo(() => {
    if (modoKardex) {
      const asc = [...filtrados].sort((a, b) => (a.criado_em || '').localeCompare(b.criado_em || ''));
      return kardex(asc).reverse(); // exibe do mais recente p/ o mais antigo, com saldo_apos correto
    }
    return [...filtrados].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).map((m) => ({ ...m, saldo_apos: null as number | null }));
  }, [filtrados, modoKardex]);

  async function excluir(m: EstoqueMov) {
    const meta = MOV_BY[m.tipo];
    if (!confirm(`Excluir esta ${meta.label.toLowerCase()} de ${prodNome(m.produto_id)}? O saldo e o custo médio serão recalculados.`)) return;
    const r = await deleteMov(m.id);
    if (!r.ok) { toast.error('Não foi possível excluir a movimentação.'); return; }
    toast.success('Movimentação excluída e saldo recalculado.');
    await recarregar();
  }

  function exportar() {
    const header = ['Data', 'Produto', 'Tipo', 'Quantidade', 'Unidade', 'Custo unit.', 'Custo total', 'Evento', 'Lote', 'Validade', 'Motivo'];
    const rows = [...filtrados].sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || '')).map((m) => [
      m.criado_em || '', prodNome(m.produto_id), MOV_BY[m.tipo].label, efeitoSaldo(m.tipo, m.quantidade), prodUnid(m.produto_id),
      m.custo_unit_num, m.custo_total_num, evNome(m.evento_id), m.lote || '', m.validade || '', m.motivo || '',
    ]);
    exportCSV(`estoque-movimentacoes-${ymd(new Date())}.csv`, header, rows);
  }

  if (produtos.length === 0) {
    return <EmptyState icon={<IcoHistory />} title="Cadastre um produto primeiro">As movimentações aparecem aqui assim que você tiver produtos no almoxarifado (aba Saldo).</EmptyState>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={exportar} disabled={filtrados.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoDownload /> Exportar</button>
        <button onClick={onNovaMov} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Movimentação</button>
      </div>

      {/* KPIs do período/filtro */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <Kpi label="Entradas (valor)" value={formatMoneyShort(kpis.entradas)} tone="verde" icon={<IcoArrowDown />} />
        <Kpi label="Saídas + perdas" value={formatMoneyShort(kpis.saidas)} tone="vermelho" icon={<IcoArrowUp />} />
        <Kpi label="Movimentações" value={formatNumber(kpis.n)} tone="azul" icon={<IcoHistory />} />
      </div>

      {/* Consumo por evento */}
      {consumo.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><IcoCart /></span>
            <h3 className="text-base font-bold text-ink">Consumo por evento</h3>
            <span className="text-xs text-ink-muted">— custo direto (alimenta a Contabilidade)</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {consumo.map((c) => (
              <Link key={c.evento_id} href={`/painel/clientes/${c.evento_id}`} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 hover:border-brand/30 hover:bg-brand-50/40">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-soft">{evNome(c.evento_id)}</p>
                  <p className="text-[0.7rem] text-ink-muted">{c.n} saída(s)</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-violet-600">{formatMoney(c.custo_total)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Filtros + tabela */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <select value={fProduto} onChange={(e) => setFProduto(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
            <option value="">Todos produtos</option>
            {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <div className="flex flex-wrap gap-1">
            <button onClick={() => setFTipo('')} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${fTipo === '' ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Todos</button>
            {MOV_TIPOS.map((m) => (
              <button key={m.v} onClick={() => setFTipo(m.v)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${fTipo === m.v ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>{m.label}</button>
            ))}
          </div>
          <select value={fEvento} onChange={(e) => setFEvento(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
            <option value="">Todos eventos</option>
            {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome_evento || 'Evento'}</option>)}
          </select>
          <input type="date" value={fDe} onChange={(e) => setFDe(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none" title="De" />
          <input type="date" value={fAte} onChange={(e) => setFAte(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none" title="Até" />
        </div>

        {modoKardex && <p className="mb-3 text-xs font-medium text-ink-muted">Kardex de <b className="text-ink-soft">{prodNome(fProduto)}</b> — saldo acumulado por linha.</p>}

        {linhas.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-muted">Nenhuma movimentação neste filtro.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Data</th>
                  {!modoKardex && <th className="pb-2 font-semibold">Produto</th>}
                  <th className="pb-2 font-semibold">Tipo</th>
                  <th className="pb-2 text-right font-semibold">Qtd</th>
                  {modoKardex && <th className="pb-2 text-right font-semibold">Saldo</th>}
                  <th className="hidden pb-2 text-right font-semibold md:table-cell">Custo total</th>
                  <th className="hidden pb-2 font-semibold lg:table-cell">Evento / Motivo</th>
                  <th className="w-10 pb-2" />
                </tr>
              </thead>
              <tbody>
                {linhas.map((m) => {
                  const meta = MOV_BY[m.tipo];
                  const delta = efeitoSaldo(m.tipo, m.quantidade);
                  const unidade = prodUnid(m.produto_id);
                  return (
                    <tr key={m.id} className="group border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5 text-ink-muted">{m.criado_em ? formatDateTime(m.criado_em) : '—'}</td>
                      {!modoKardex && (
                        <td className="py-2.5">
                          <p className="font-medium text-ink-soft">{prodNome(m.produto_id)}</p>
                          {m.lote && <p className="text-[0.7rem] text-ink-muted">Lote {m.lote}</p>}
                        </td>
                      )}
                      <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${meta.cls}`}>{meta.label}</span></td>
                      <td className={`py-2.5 text-right font-bold ${m.tipo === 'transferencia' ? 'text-violet-600' : delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-600' : 'text-ink-soft'}`}>
                        {m.tipo === 'transferencia' ? `↔ ${formatNumber(Math.abs(m.quantidade))}` : `${delta > 0 ? '+' : ''}${formatNumber(delta)}`} {unidade}
                      </td>
                      {modoKardex && <td className="py-2.5 text-right font-semibold text-ink-soft">{m.saldo_apos != null ? `${formatNumber(m.saldo_apos)} ${unidade}` : '—'}</td>}
                      <td className="hidden py-2.5 text-right text-ink-muted md:table-cell">{formatMoney(m.custo_total_num)}</td>
                      <td className="hidden py-2.5 text-ink-muted lg:table-cell">
                        {m.evento_id ? <span className="text-violet-600">{evNome(m.evento_id)}</span> : m.tipo === 'transferencia' && m.local_destino ? `${localLabel(m.local_origem)} → ${localLabel(m.local_destino)}` : (m.motivo || '—')}
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button onClick={() => excluir(m)} title="Excluir (recalcula)" className="rounded p-1.5 text-ink-muted opacity-0 transition hover:bg-black/[0.04] hover:text-red-600 group-hover:opacity-100"><IcoTrash /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

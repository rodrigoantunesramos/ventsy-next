'use client';

// Aba VENDAS — pedidos em tempo real (por status/canal), detalhe dos ingressos
// com QR, cortesia/venda no balcão, reembolso/cancelamento e export CSV/impressão.
// Sem "R$" hardcoded — valores via lib/format.

import { useMemo, useState } from 'react';
import { formatMoney, formatNumber, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type BilheteriaEvento, type Pedido, type Ingresso, type Categoria,
  pedidoStatusMeta, canalMeta, ingressoStatusMeta, tokenCurto,
} from '@/lib/bilheteria';
import { exportPedidosCSV, printIngressos } from '../_lib';
import { IcoSearch, IcoDownload, IcoPrint, IcoGift } from './Icons';

const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const PAGE_SIZE = 20;

export function Vendas({ bilheteria, pedidos, ingressos, categorias, onEmitir, onReembolsar, onCancelar, onSync }: {
  bilheteria: BilheteriaEvento; pedidos: Pedido[]; ingressos: Ingresso[]; categorias: Categoria[];
  onEmitir: () => void; onReembolsar: (p: Pedido) => void; onCancelar: (p: Pedido) => void; onSync: () => void;
}) {
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fCanal, setFCanal] = useState('');
  const [page, setPage] = useState(0);
  const [aberto, setAberto] = useState<string | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  const catNome = useMemo(() => new Map(categorias.map((c) => [c.id, c.nome])), [categorias]);
  const ingByPedido = useMemo(() => {
    const m = new Map<string, Ingresso[]>();
    for (const i of ingressos) { const arr = m.get(i.pedido_id) || []; arr.push(i); m.set(i.pedido_id, arr); }
    return m;
  }, [ingressos]);

  const filtrados = useMemo(() => {
    let arr = pedidos;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((p) => `${p.comprador_nome} ${p.comprador_email || ''} ${p.comprador_doc || ''} ${p.id}`.toLowerCase().includes(q));
    if (fStatus) arr = arr.filter((p) => p.status === fStatus);
    if (fCanal) arr = arr.filter((p) => p.canal === fCanal);
    return arr;
  }, [pedidos, busca, fStatus, fCanal]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const pageItems = filtrados.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function pedirConfirma(key: string, acao: () => void) {
    if (confirmKey !== key) {
      setConfirmKey(key);
      toast.info('Clique novamente para confirmar.');
      setTimeout(() => setConfirmKey((k) => (k === key ? null : k)), 3000);
      return;
    }
    setConfirmKey(null);
    acao();
  }

  return (
    <div className="mt-5 space-y-4">
      {/* Ações + filtros */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch size={16} /></span>
            <input value={busca} onChange={(e) => { setBusca(e.target.value); setPage(0); }} placeholder="Buscar comprador, e-mail, documento…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          <select value={fStatus} onChange={(e) => { setFStatus(e.target.value); setPage(0); }} className={selCls}>
            <option value="">Status</option>
            {['pago', 'pendente', 'cancelado', 'reembolsado', 'expirado'].map((s) => <option key={s} value={s}>{pedidoStatusMeta(s).label}</option>)}
          </select>
          <select value={fCanal} onChange={(e) => { setFCanal(e.target.value); setPage(0); }} className={selCls}>
            <option value="">Canal</option>
            {['online', 'manual', 'cortesia'].map((c) => <option key={c} value={c}>{canalMeta(c).label}</option>)}
          </select>
          <div className="ml-auto flex flex-wrap gap-2">
            <button onClick={onSync} className="rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand">Atualizar</button>
            {filtrados.length > 0 && <button onClick={() => exportPedidosCSV(filtrados)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload size={15} /> CSV</button>}
            {ingressos.some((i) => i.status === 'pago' || i.status === 'checkin') && (
              <button onClick={() => printIngressos(ingressos.filter((i) => i.status === 'pago' || i.status === 'checkin'), catNome, bilheteria.titulo)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoPrint size={15} /> Imprimir</button>
            )}
            <button onClick={onEmitir} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><IcoGift size={15} /> Emitir</button>
          </div>
        </div>
      </div>

      {/* Lista de pedidos */}
      {pedidos.length === 0 ? (
        <div className="rounded-2xl bg-white p-12 text-center text-sm text-ink-muted shadow-card">Nenhum pedido ainda. Compartilhe o link de venda ou emita cortesias.</div>
      ) : filtrados.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Nenhum pedido corresponde aos filtros.</p>
      ) : (
        <div className="space-y-2">
          {pageItems.map((p) => {
            const sm = pedidoStatusMeta(p.status);
            const cm = canalMeta(p.canal);
            const itens = ingByPedido.get(p.id) || [];
            const expandido = aberto === p.id;
            return (
              <div key={p.id} className="rounded-2xl bg-white shadow-card">
                <button onClick={() => setAberto(expandido ? null : p.id)} className="flex w-full flex-wrap items-center gap-3 p-4 text-left">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{p.comprador_nome}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${sm.chip}`}>{sm.label}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${cm.chip}`}>{cm.label}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-ink-muted">
                      {p.comprador_email || 'sem e-mail'} · {formatNumber(itens.length)} ingresso(s) · {formatDateTime(p.criado_em)}
                      {p.cupom_codigo ? ` · cupom ${p.cupom_codigo}` : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-ink">{formatMoney(p.total_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })}</div>
                    <div className="text-[0.7rem] text-ink-muted">#{p.id.slice(0, 8).toUpperCase()}</div>
                  </div>
                </button>

                {expandido && (
                  <div className="border-t border-black/[0.06] p-4">
                    {/* Resumo financeiro */}
                    <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Mini label="Subtotal" valor={formatMoney(p.subtotal_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })} />
                      <Mini label="Desconto" valor={formatMoney(p.desconto_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })} />
                      <Mini label="Taxa" valor={formatMoney(p.taxa_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })} />
                      <Mini label="Total" valor={formatMoney(p.total_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })} forte />
                    </div>
                    {/* Ingressos */}
                    <div className="space-y-1.5">
                      {itens.map((i) => {
                        const im = ingressoStatusMeta(i.status);
                        return (
                          <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.05] px-3 py-2 text-sm">
                            <span className="min-w-0 truncate"><span className="font-medium text-ink">{catNome.get(i.categoria_id) || '—'}</span>{i.meia ? ' · meia' : ''}{i.comprador_nome ? <span className="text-ink-muted"> · {i.comprador_nome}</span> : null}</span>
                            <span className="flex shrink-0 items-center gap-2">
                              <span className="font-mono text-[0.7rem] text-ink-muted">{tokenCurto(i.qr_token)}</span>
                              <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${im.chip}`}>{im.label}</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {/* Ações */}
                    {(p.status === 'pago' || p.status === 'pendente') && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.status === 'pago' && (
                          <button onClick={() => pedirConfirma(`reemb:${p.id}`, () => onReembolsar(p))} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${confirmKey === `reemb:${p.id}` ? 'border-red-400 bg-red-50 text-red-700' : 'border-black/10 text-ink-soft hover:border-red-200 hover:text-red-600'}`}>
                            {confirmKey === `reemb:${p.id}` ? 'Confirmar reembolso' : 'Reembolsar'}
                          </button>
                        )}
                        <button onClick={() => pedirConfirma(`canc:${p.id}`, () => onCancelar(p))} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${confirmKey === `canc:${p.id}` ? 'border-red-400 bg-red-50 text-red-700' : 'border-black/10 text-ink-soft hover:border-red-200 hover:text-red-600'}`}>
                          {confirmKey === `canc:${p.id}` ? 'Confirmar cancelamento' : 'Cancelar pedido'}
                        </button>
                        {p.mp_payment_id && <span className="self-center text-xs text-ink-muted">MP: {p.mp_payment_id}</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-1 text-xs text-ink-muted">
              <span>{formatNumber(filtrados.length)} pedido(s) · página {page + 1} de {totalPages}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Anterior</button>
                <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Próxima</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Mini({ label, valor, forte }: { label: string; valor: string; forte?: boolean }) {
  return (
    <div className="rounded-lg bg-black/[0.02] px-3 py-2">
      <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`text-sm ${forte ? 'font-bold text-ink' : 'font-medium text-ink-soft'}`}>{valor}</div>
    </div>
  );
}

'use client';

// Aba "Pedidos" — gera o pedido de compra (PO) a partir da cotação escolhida,
// emite PDF, envia ao fornecedor e acompanha status/previsão. O recebimento (que
// gera a conta a pagar e dá entrada no estoque) fica na aba Recebimentos.

import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate, getFormatPrefs } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ComprasBag, type Requisicao, type Cotacao, type CotacaoItem, type Pedido, type PedidoItem,
  PEDIDO_STATUS, inp, selCls, fornNomeDe, proximoNumero, ymd, waLink, mailLink, exportPedidosCSV,
} from '../_lib';
import { Kpi, ModalShell, Campo, Chip, Empty, IcoTruck, IcoTrash, IcoDownload, IcoWallet, IcoClock, IcoCheck, IcoAlert, IcoArrow, IcoPaperclip } from './ui';

type EmpresaInfo = { nome: string | null; contato: string | null; cnpj: string | null };

export default function Pedidos({ bag }: { bag: ComprasBag }) {
  const toast = useToast();
  const { userId, requisicoes, cotacoes, cotacaoItens, pedidos, recebimentos, fornecedores, recarregar } = bag;
  const hoje = ymd(new Date());

  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [gerar, setGerar] = useState<null | { req: Requisicao; cot: Cotacao }>(null);
  const [empresa, setEmpresa] = useState<EmpresaInfo>({ nome: null, contato: null, cnpj: null });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await sb.from('empresa_config').select('razao_social,fantasia,cnpj,contatos').eq('usuario_id', userId).maybeSingle();
      if (data) {
        const c = (data.contatos || {}) as { telefone?: string; whatsapp?: string; email?: string };
        setEmpresa({
          nome: data.fantasia || data.razao_social || null,
          contato: [c.telefone || c.whatsapp, c.email].filter(Boolean).join('  ·  ') || null,
          cnpj: data.cnpj || null,
        });
      }
    })();
  }, [userId]);

  const nomeForn = (id: string | null, snap: string | null) => fornNomeDe(fornecedores.find((f) => f.id === id)) || snap || 'Fornecedor';

  // Requisições com cotação escolhida e ainda SEM pedido → prontas para emitir.
  const prontas = useMemo(() => {
    const comPedido = new Set(pedidos.map((p) => p.requisicao_id).filter(Boolean) as string[]);
    return cotacoes
      .filter((c) => c.escolhida && !comPedido.has(c.requisicao_id))
      .map((c) => ({ cot: c, req: requisicoes.find((r) => r.id === c.requisicao_id) }))
      .filter((x): x is { cot: Cotacao; req: Requisicao } => !!x.req && x.req.status !== 'cancelada');
  }, [cotacoes, pedidos, requisicoes]);

  const kpis = useMemo(() => {
    const abertos = pedidos.filter((p) => p.status === 'emitido' || p.status === 'parcial');
    const atrasados = abertos.filter((p) => p.previsao_entrega && p.previsao_entrega < hoje);
    return {
      abertos: abertos.length,
      valorAberto: abertos.reduce((s, p) => s + p.valor_total, 0),
      recebidos: pedidos.filter((p) => p.status === 'recebido').length,
      atrasados: atrasados.length,
    };
  }, [pedidos, hoje]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (fStatus && p.status !== fStatus) return false;
      if (q && !`${p.numero || ''} ${nomeForn(p.fornecedor_id, p.fornecedor_nome)}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [pedidos, fStatus, busca]); // eslint-disable-line react-hooks/exhaustive-deps

  async function baixarPDF(p: Pedido) {
    try {
      const { buildPedidoPDF } = await import('../_pdf');
      const f = fornecedores.find((x) => x.id === p.fornecedor_id);
      const doc = await buildPedidoPDF({
        numero: p.numero, fornecedorNome: nomeForn(p.fornecedor_id, p.fornecedor_nome),
        fornecedorContato: f ? [f.whatsapp || '', f.email || ''].filter(Boolean).join(' · ') || null : null,
        condicao: p.condicao, previsao: p.previsao_entrega, criadoEm: p.criado_em, obs: p.obs,
        itens: p.itens.map((i) => ({ descricao: i.descricao, quantidade: i.quantidade, unidade: i.unidade, valor_unit_num: i.valor_unit_num })),
        total: p.valor_total, moeda: getFormatPrefs().currency,
        empresaNome: empresa.nome, empresaContato: empresa.contato, empresaCnpj: empresa.cnpj,
      });
      doc.save(`pedido-${p.numero || 'compra'}.pdf`);
    } catch { toast.error('Erro ao gerar o PDF.'); }
  }

  async function enviar(p: Pedido) {
    const { error } = await sb.from('pedidos_compra').update({ enviado_em: new Date().toISOString() }).eq('id', p.id);
    if (error) { toast.error('Erro ao marcar como enviado.'); return; }
    const f = fornecedores.find((x) => x.id === p.fornecedor_id);
    const msg = `Olá! Segue nosso pedido de compra ${p.numero} no valor de ${formatMoney(p.valor_total)}. Podemos confirmar?`;
    const link = waLink(f?.whatsapp, msg) || mailLink(f?.email, `Pedido de compra ${p.numero}`, msg);
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    toast.success('Pedido marcado como enviado.');
    await recarregar();
  }
  async function cancelar(p: Pedido) {
    if (!confirm(`Cancelar o pedido ${p.numero}?`)) return;
    const { error } = await sb.from('pedidos_compra').update({ status: 'cancelado' }).eq('id', p.id);
    if (error) { toast.error('Erro ao cancelar.'); return; }
    toast.info('Pedido cancelado.');
    await recarregar();
  }
  async function excluir(p: Pedido) {
    if (recebimentos.some((r) => r.pedido_id === p.id)) { toast.error('Há recebimentos vinculados — exclua-os antes.'); return; }
    if (!confirm(`Excluir o pedido ${p.numero}?`)) return;
    const { error } = await sb.from('pedidos_compra').delete().eq('id', p.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Pedido excluído.');
    await recarregar();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => exportPedidosCSV(filtrados, nomeForn, hoje)} disabled={pedidos.length === 0} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoDownload /> Exportar</button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pedidos abertos" value={String(kpis.abertos)} sub="emitidos/parciais" tone="azul" icon={<IcoTruck />} />
        <Kpi label="Valor em aberto" value={formatMoneyShort(kpis.valorAberto)} tone="roxo" icon={<IcoWallet />} />
        <Kpi label="Recebidos" value={String(kpis.recebidos)} tone="verde" icon={<IcoCheck />} />
        <Kpi label="Entrega atrasada" value={String(kpis.atrasados)} tone={kpis.atrasados ? 'vermelho' : 'ink'} icon={<IcoClock />} />
      </div>

      {/* Prontos para pedido */}
      {prontas.length > 0 && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-emerald-800"><IcoCheck /> Prontos para emitir pedido</h3>
          <div className="space-y-2">
            {prontas.map(({ req, cot }) => (
              <div key={cot.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{req.numero} · {nomeForn(cot.fornecedor_id, cot.fornecedor_nome)}</p>
                  <p className="text-xs text-ink-muted">Cotação escolhida · {formatMoney(cot.valor_total)}{cot.prazo_dias != null ? ` · ${cot.prazo_dias} dias` : ''}</p>
                </div>
                <button onClick={() => setGerar({ req, cot })} className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"><IcoArrow /> Gerar pedido</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {pedidos.length === 0 && prontas.length === 0 ? (
        <div className="mt-5">
          <Empty icon={<IcoTruck size={28} />} title="Nenhum pedido ainda">
            Escolha uma cotação na aba <strong>Cotações</strong> para liberar a emissão do pedido de compra aqui.
          </Empty>
        </div>
      ) : pedidos.length > 0 && (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-ink">Pedidos de compra</h3>
            <div className="flex items-center gap-2">
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nº/fornecedor…" className="w-40 rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none sm:w-48" />
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
                <option value="">Todos status</option>
                {Object.entries(PEDIDO_STATUS).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
              </select>
            </div>
          </div>

          {filtrados.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">Nenhum pedido neste filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Pedido</th>
                    <th className="hidden pb-2 font-semibold md:table-cell">Previsão</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Valor</th>
                    <th className="w-px pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((p) => {
                    const atrasado = (p.status === 'emitido' || p.status === 'parcial') && p.previsao_entrega && p.previsao_entrega < hoje;
                    return (
                      <tr key={p.id} className="group border-b border-black/[0.04] last:border-0">
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-ink">{p.numero || '—'}</span>
                            {p.enviado_em && <span title="Enviado ao fornecedor" className="text-emerald-500"><IcoPaperclip /></span>}
                          </div>
                          <p className="text-xs text-ink-muted">{nomeForn(p.fornecedor_id, p.fornecedor_nome)} · {p.itens.length} {p.itens.length === 1 ? 'item' : 'itens'}</p>
                        </td>
                        <td className="hidden py-2.5 md:table-cell">
                          {p.previsao_entrega ? <span className={atrasado ? 'font-semibold text-red-600' : 'text-ink-muted'}>{formatDate(p.previsao_entrega, { style: 'short' })}{atrasado && <IcoAlert />}</span> : <span className="text-ink-muted/60">—</span>}
                        </td>
                        <td className="py-2.5"><Chip meta={PEDIDO_STATUS[p.status]} /></td>
                        <td className="py-2.5 text-right font-bold text-ink">{formatMoney(p.valor_total)}</td>
                        <td className="py-2.5 pl-2">
                          <div className="flex items-center justify-end gap-1">
                            <button onClick={() => baixarPDF(p)} title="PDF do pedido" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">PDF</button>
                            {p.status !== 'cancelado' && p.status !== 'recebido' && <button onClick={() => enviar(p)} className="rounded-lg bg-brand px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-brand-600">Enviar</button>}
                            <div className="flex opacity-0 transition group-hover:opacity-100">
                              {p.status !== 'cancelado' && p.status !== 'recebido' && <button onClick={() => cancelar(p)} title="Cancelar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-amber-600"><IcoAlert /></button>}
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
      )}

      {gerar && userId && (
        <GerarPedidoModal bag={bag} req={gerar.req} cot={gerar.cot} cotItens={cotacaoItens.filter((ci) => ci.cotacao_id === gerar.cot.id)} onClose={() => setGerar(null)} onSaved={async () => { setGerar(null); await recarregar(); }} />
      )}
    </div>
  );
}

// ── Modal: gerar pedido a partir da cotação escolhida ─────────────────────────
function GerarPedidoModal({ bag, req, cot, cotItens, onClose, onSaved }: {
  bag: ComprasBag; req: Requisicao; cot: Cotacao; cotItens: CotacaoItem[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { userId, pedidos, reqItens, fornecedores } = bag;
  const nomeForn = fornNomeDe(fornecedores.find((f) => f.id === cot.fornecedor_id)) || cot.fornecedor_nome || 'Fornecedor';

  // Itens do pedido = itens da requisição com preço da cotação escolhida (só os disponíveis).
  const itens = useMemo<PedidoItem[]>(() => {
    const rItens = reqItens.filter((i) => i.requisicao_id === req.id);
    const byReqItem = new Map(cotItens.map((ci) => [ci.requisicao_item_id, ci]));
    return rItens.map((i) => {
      const ci = byReqItem.get(i.id);
      return {
        requisicao_item_id: i.id, produto_id: i.produto_id, descricao: i.descricao, quantidade: i.quantidade,
        unidade: i.unidade, valor_unit_num: ci?.valor_unit ?? 0, quantidade_recebida: 0,
      };
    }).filter((i) => i.valor_unit_num > 0 || !cotItens.length); // se cotação sem itens (total cheio), mantém todos
  }, [reqItens, cotItens, req.id]);

  const total = useMemo(() => itens.reduce((s, i) => s + i.valor_unit_num * i.quantidade, 0) || cot.valor_total, [itens, cot.valor_total]);
  const previsaoSugerida = useMemo(() => {
    if (cot.prazo_dias == null) return '';
    const d = new Date(); d.setDate(d.getDate() + cot.prazo_dias); return ymd(d);
  }, [cot.prazo_dias]);

  const [condicao, setCondicao] = useState(cot.condicao ?? '');
  const [previsao, setPrevisao] = useState(previsaoSugerida);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  async function gerar() {
    if (!userId) return;
    setSaving(true);
    const numero = proximoNumero('PC', pedidos.map((p) => p.numero));
    const { data, error } = await sb.from('pedidos_compra').insert({
      usuario_id: userId, requisicao_id: req.id, cotacao_id: cot.id, fornecedor_id: cot.fornecedor_id, fornecedor_nome: cot.fornecedor_nome || nomeForn,
      numero, valor_total_num: total, status: 'emitido', condicao: condicao.trim() || null, previsao_entrega: previsao || null,
      itens, obs: obs.trim() || null,
    }).select('id').single();
    if (error || !data) { setSaving(false); toast.error('Erro ao gerar o pedido.'); return; }
    await sb.from('requisicoes').update({ status: 'pedido' }).eq('id', req.id);
    setSaving(false);
    toast.success(`Pedido ${numero} gerado!`);
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-1 font-display text-xl font-bold text-ink">Gerar pedido de compra</h3>
      <p className="mb-4 text-xs text-ink-muted">{req.numero} · {nomeForn}</p>
      <div className="mb-4 max-h-44 overflow-y-auto rounded-xl border border-black/[0.06]">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-black/[0.02] text-ink-muted"><tr><th className="px-3 py-1.5 text-left font-semibold">Item</th><th className="px-3 py-1.5 text-right font-semibold">Qtd</th><th className="px-3 py-1.5 text-right font-semibold">Unit.</th><th className="px-3 py-1.5 text-right font-semibold">Total</th></tr></thead>
          <tbody>
            {itens.map((i, idx) => (
              <tr key={idx} className="border-t border-black/[0.04]">
                <td className="px-3 py-1.5 text-ink-soft">{i.descricao}</td>
                <td className="px-3 py-1.5 text-right text-ink-muted">{i.quantidade} {i.unidade}</td>
                <td className="px-3 py-1.5 text-right text-ink-muted">{formatMoney(i.valor_unit_num)}</td>
                <td className="px-3 py-1.5 text-right font-semibold text-ink">{formatMoney(i.valor_unit_num * i.quantidade)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mb-4 flex items-center justify-end gap-2 text-sm"><span className="text-ink-muted">Total do pedido</span><span className="font-bold text-ink">{formatMoney(total)}</span></div>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Condição de pagamento" hint="(opcional)"><input className={inp} value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="Ex.: 30 dias" /></Campo>
        <Campo label="Previsão de entrega" hint="(opcional)"><input type="date" className={inp} value={previsao} onChange={(e) => setPrevisao(e.target.value)} /></Campo>
      </div>
      <div className="mt-4"><Campo label="Observações" hint="(opcional)"><textarea className={inp} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo></div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={gerar} disabled={saving || itens.length === 0} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Gerando…' : 'Gerar pedido'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

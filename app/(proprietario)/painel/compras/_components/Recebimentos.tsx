'use client';

// Aba "Recebimentos" — conferência (qtd/qualidade) dos pedidos: registra o que
// chegou, marca divergências, ATUALIZA O ESTOQUE (entrada — degrada se o módulo
// Estoque ainda não existir) e GERA A CONTA A PAGAR no Financeiro (contas_pagar),
// fechando o rastro requisição → pedido → recebimento → pagamento.

import { useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ComprasBag, type Pedido, type PedidoItem,
  PEDIDO_STATUS, inp, fornNomeDe, ymd, statusPedidoPorItens, saldoAReceber,
} from '../_lib';
import { Kpi, ModalShell, Campo, Chip, IcoInbox, IcoCheck, IcoAlert, IcoWallet, IcoBox, IcoClock } from './ui';

type Conf = { recebida: string; conforme: boolean; obs: string };

export default function Recebimentos({ bag }: { bag: ComprasBag }) {
  const toast = useToast();
  const { userId, pedidos, recebimentos, fornecedores, recarregar } = bag;
  const hoje = ymd(new Date());
  const nomeForn = (id: string | null, snap: string | null) => fornNomeDe(fornecedores.find((f) => f.id === id)) || snap || 'Fornecedor';

  const [receber, setReceber] = useState<Pedido | null>(null);

  // Pedidos abertos para conferência (emitido/parcial).
  const aReceber = useMemo(() => pedidos.filter((p) => p.status === 'emitido' || p.status === 'parcial'), [pedidos]);
  const pedidoById = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);

  const kpis = useMemo(() => {
    const valorAReceber = aReceber.reduce((s, p) => s + p.itens.reduce((a, i) => a + saldoAReceber(i.quantidade, i.quantidade_recebida) * i.valor_unit_num, 0), 0);
    const mes = hoje.slice(0, 7);
    const recebidoMes = recebimentos.filter((r) => (r.data || '').slice(0, 7) === mes).reduce((s, r) => s + r.valor, 0);
    return {
      aReceber: aReceber.length,
      valorAReceber,
      recebidoMes,
      divergencias: recebimentos.filter((r) => r.divergencia).length,
    };
  }, [aReceber, recebimentos, hoje]);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pedidos a receber" value={String(kpis.aReceber)} tone="azul" icon={<IcoInbox />} />
        <Kpi label="Saldo a receber" value={formatMoneyShort(kpis.valorAReceber)} sub="itens pendentes" tone="roxo" icon={<IcoWallet />} />
        <Kpi label="Recebido no mês" value={formatMoneyShort(kpis.recebidoMes)} tone="verde" icon={<IcoCheck />} />
        <Kpi label="Divergências" value={String(kpis.divergencias)} tone={kpis.divergencias ? 'gold' : 'ink'} icon={<IcoAlert />} />
      </div>

      {/* Pedidos para conferência */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-3 text-base font-bold text-ink">Conferência de pedidos</h3>
        {aReceber.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum pedido aguardando recebimento. Emita um pedido na aba Pedidos.</p>
        ) : (
          <div className="space-y-2">
            {aReceber.map((p) => {
              const saldo = p.itens.reduce((a, i) => a + saldoAReceber(i.quantidade, i.quantidade_recebida), 0);
              const atrasado = p.previsao_entrega && p.previsao_entrega < hoje;
              return (
                <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-black/[0.06] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink">{p.numero}</span>
                      <Chip meta={PEDIDO_STATUS[p.status]} />
                      {atrasado && <span title="Entrega atrasada" className="rounded-full bg-red-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-red-600">atrasado</span>}
                    </div>
                    <p className="text-xs text-ink-muted">{nomeForn(p.fornecedor_id, p.fornecedor_nome)} · {saldo} item(ns) a receber{p.previsao_entrega ? ` · prev. ${formatDate(p.previsao_entrega, { style: 'short' })}` : ''}</p>
                  </div>
                  <button onClick={() => setReceber(p)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"><IcoInbox size={14} /> Conferir recebimento</button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Histórico de recebimentos */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-3 text-base font-bold text-ink">Histórico de recebimentos</h3>
        {recebimentos.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum recebimento registrado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Data</th>
                  <th className="pb-2 font-semibold">Pedido</th>
                  <th className="hidden pb-2 font-semibold md:table-cell">Nota</th>
                  <th className="pb-2 font-semibold">Situação</th>
                  <th className="pb-2 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {recebimentos.map((r) => {
                  const ped = pedidoById.get(r.pedido_id);
                  return (
                    <tr key={r.id} className="border-b border-black/[0.04] last:border-0">
                      <td className="py-2.5 text-ink-muted">{formatDate(r.data, { style: 'short' })}</td>
                      <td className="py-2.5">
                        <span className="font-semibold text-ink">{ped?.numero || '—'}</span>
                        <p className="text-xs text-ink-muted">{ped ? nomeForn(ped.fornecedor_id, ped.fornecedor_nome) : ''}</p>
                      </td>
                      <td className="hidden py-2.5 text-ink-muted md:table-cell">{r.nota_fornecedor || '—'}</td>
                      <td className="py-2.5">
                        <div className="flex flex-wrap items-center gap-1">
                          {r.divergencia ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Divergência</span> : <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Conforme</span>}
                          {r.conta_pagar_id && <span title="Conta a pagar gerada" className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[0.62rem] font-semibold text-violet-700"><IcoWallet /> A pagar</span>}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-bold text-ink">{formatMoney(r.valor)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {receber && userId && <ReceberModal bag={bag} pedido={receber} onClose={() => setReceber(null)} onSaved={async () => { setReceber(null); await recarregar(); }} />}
    </div>
  );
}

// ── Modal: conferência do recebimento ─────────────────────────────────────────
function ReceberModal({ bag, pedido, onClose, onSaved }: { bag: ComprasBag; pedido: Pedido; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { userId, fornecedores } = bag;

  const [data, setData] = useState(ymd(new Date()));
  const [nota, setNota] = useState('');
  const [conf, setConf] = useState<Conf[]>(() => pedido.itens.map((i) => ({ recebida: String(saldoAReceber(i.quantidade, i.quantidade_recebida)), conforme: true, obs: '' })));
  const [gerarConta, setGerarConta] = useState(true);
  const [vencimento, setVencimento] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 30); return ymd(d); });
  const [entrarEstoque, setEntrarEstoque] = useState(true);
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  function setC(idx: number, patch: Partial<Conf>) { setConf((arr) => arr.map((c, i) => i === idx ? { ...c, ...patch } : c)); }

  const valorRecebido = useMemo(() => pedido.itens.reduce((s, i, idx) => s + (Number(conf[idx]?.recebida) || 0) * i.valor_unit_num, 0), [pedido.itens, conf]);
  const temDivergencia = useMemo(() => pedido.itens.some((i, idx) => {
    const c = conf[idx]; if (!c) return false;
    return !c.conforme || (Number(c.recebida) || 0) !== saldoAReceber(i.quantidade, i.quantidade_recebida);
  }), [pedido.itens, conf]);

  const nomeForn = fornNomeDe(fornecedores.find((f) => f.id === pedido.fornecedor_id)) || pedido.fornecedor_nome || 'Fornecedor';

  async function confirmar() {
    if (!userId) return;
    const recebidos = pedido.itens.map((i, idx) => ({ item: i, qtd: Number(conf[idx]?.recebida) || 0, conforme: conf[idx]?.conforme !== false, obs: conf[idx]?.obs || null }));
    if (recebidos.every((r) => r.qtd <= 0)) { toast.error('Informe ao menos um item recebido.'); return; }
    setSaving(true);

    // itens do recebimento (snapshot jsonb)
    const itensReceb = recebidos.filter((r) => r.qtd > 0 || !r.conforme).map((r) => ({
      descricao: r.item.descricao, quantidade_pedida: saldoAReceber(r.item.quantidade, r.item.quantidade_recebida),
      quantidade_recebida: r.qtd, conforme: r.conforme, obs: r.obs,
    }));

    // 1) Conta a pagar (Financeiro) — best-effort; degrada se o módulo não existir.
    let contaId: string | null = null;
    let contaMsg = '';
    if (gerarConta && valorRecebido > 0) {
      const base = {
        usuario_id: userId, fornecedor_id: pedido.fornecedor_id, categoria: 'fornecedor',
        descricao: `Compra ${pedido.numero} — ${nomeForn}`, valor_num: valorRecebido, vencimento: vencimento || null,
        status: 'pendente', aprovado: true, obs: `Gerada pelo recebimento do pedido ${pedido.numero}`,
      };
      let r = await sb.from('contas_pagar').insert({ ...base, ordem_compra_id: pedido.id }).select('id').single();
      if (r.error && (r.error.code === 'PGRST204' || r.error.code === '42703' || /ordem_compra_id/i.test(r.error.message || ''))) {
        r = await sb.from('contas_pagar').insert(base).select('id').single(); // coluna ordem_compra_id ausente
      }
      if (r.error) contaMsg = ' (conta a pagar não gerada — ative Contas a pagar)';
      else contaId = String((r.data as { id: string }).id);
    }

    // 2) Recebimento
    const { data: recRow, error: eRec } = await sb.from('recebimentos').insert({
      usuario_id: userId, pedido_id: pedido.id, data, itens: itensReceb, nota_fornecedor: nota.trim() || null,
      divergencia: temDivergencia, divergencia_obs: temDivergencia ? (obs.trim() || null) : null, valor_num: valorRecebido,
      conta_pagar_id: contaId, obs: obs.trim() || null,
    }).select('id').single();
    if (eRec || !recRow) {
      if (contaId) await sb.from('contas_pagar').delete().eq('id', contaId); // rollback da conta
      setSaving(false); toast.error('Erro ao registrar o recebimento.'); return;
    }
    const recId = String(recRow.id);

    // 3) Atualiza quantidades/status do pedido
    const novosItens: PedidoItem[] = pedido.itens.map((i, idx) => ({ ...i, quantidade_recebida: i.quantidade_recebida + (Number(conf[idx]?.recebida) || 0) }));
    const novoStatus = statusPedidoPorItens(novosItens);
    await sb.from('pedidos_compra').update({ itens: novosItens, status: novoStatus }).eq('id', pedido.id);
    if (novoStatus === 'recebido' && pedido.requisicao_id) await sb.from('requisicoes').update({ status: 'recebida' }).eq('id', pedido.requisicao_id);

    // 4) Entrada no estoque — best-effort (degrada se a tabela não existir)
    let estoqueMsg = '';
    if (entrarEstoque) {
      const movs = recebidos.filter((r) => r.qtd > 0 && r.conforme).map((r) => ({
        usuario_id: userId, produto_id: r.item.produto_id, tipo: 'entrada', quantidade: r.qtd,
        custo_unit_num: r.item.valor_unit_num, motivo: `Recebimento ${pedido.numero}`, recebimento_id: recId,
      }));
      if (movs.length) {
        const r = await sb.from('estoque_mov').insert(movs);
        if (r.error) estoqueMsg = ''; // Estoque ainda não ativo — silencioso
        else estoqueMsg = ' Entrada no estoque registrada.';
      }
    }

    setSaving(false);
    toast.success(`Recebimento registrado.${contaId ? ' Conta a pagar gerada no Financeiro.' : contaMsg}${estoqueMsg}`);
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="mb-1 font-display text-xl font-bold text-ink">Conferir recebimento</h3>
      <p className="mb-4 text-xs text-ink-muted">{pedido.numero} · {nomeForn}</p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Data do recebimento"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo label="Nota / NF do fornecedor" hint="(opcional)"><input className={inp} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nº da nota" /></Campo>
        </div>

        {/* Conferência por item */}
        <div className="rounded-xl border border-black/[0.06] p-3">
          <div className="mb-2 grid grid-cols-[1fr_84px_64px] gap-2 text-[0.66rem] font-semibold uppercase tracking-wide text-ink-muted">
            <span>Item (saldo a receber)</span><span className="text-right">Recebido</span><span className="text-center">Conforme</span>
          </div>
          <div className="space-y-1.5">
            {pedido.itens.map((i, idx) => {
              const saldo = saldoAReceber(i.quantidade, i.quantidade_recebida);
              return (
                <div key={idx} className="grid grid-cols-[1fr_84px_64px] items-center gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink-soft">{i.descricao}</div>
                    <div className="text-[0.66rem] text-ink-muted">{saldo} {i.unidade} · {formatMoney(i.valor_unit_num)}/un</div>
                  </div>
                  <input type="number" min={0} step="any" className="rounded-lg border border-black/10 px-2 py-2 text-right text-sm focus:border-brand focus:outline-none" value={conf[idx]?.recebida ?? ''} onChange={(e) => setC(idx, { recebida: e.target.value })} />
                  <div className="flex justify-center"><input type="checkbox" checked={conf[idx]?.conforme !== false} onChange={(e) => setC(idx, { conforme: e.target.checked })} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" /></div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-2 text-sm">
            {temDivergencia ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600"><IcoAlert /> Há divergência (qtd/qualidade)</span> : <span className="text-xs text-ink-muted">Sem divergências</span>}
            <span><span className="text-ink-muted">Valor recebido</span> <span className="ml-1 font-bold text-ink">{formatMoney(valorRecebido)}</span></span>
          </div>
        </div>

        {/* Financeiro + Estoque */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-black/[0.06] p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={gerarConta} onChange={(e) => setGerarConta(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><IcoWallet /> Gerar conta a pagar</span>
            </label>
            {gerarConta && (
              <div className="mt-2">
                <span className="mb-1 block text-[0.7rem] font-semibold text-ink-muted">Vencimento</span>
                <input type="date" className="w-full rounded-lg border border-black/10 px-2.5 py-2 text-sm focus:border-brand focus:outline-none" value={vencimento} onChange={(e) => setVencimento(e.target.value)} />
                <p className="mt-1 text-[0.66rem] text-ink-muted">Lança em Contas a pagar (Financeiro), vinculada a este pedido.</p>
              </div>
            )}
          </div>
          <div className="rounded-xl border border-black/[0.06] p-3">
            <label className="flex cursor-pointer items-center gap-2">
              <input type="checkbox" checked={entrarEstoque} onChange={(e) => setEntrarEstoque(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><IcoBox /> Dar entrada no estoque</span>
            </label>
            <p className="mt-2 text-[0.66rem] text-ink-muted">Registra a entrada dos itens conformes no Estoque (quando o módulo estiver ativo e o item vinculado a um produto).</p>
          </div>
        </div>

        <Campo label={temDivergencia ? 'Observações / divergência' : 'Observações'} hint="(opcional)"><textarea className={inp} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder={temDivergencia ? 'Descreva a divergência…' : 'Notas do recebimento…'} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={confirmar} disabled={saving} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"><IcoClock /> {saving ? 'Registrando…' : 'Registrar recebimento'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

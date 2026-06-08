'use client';

// Aba FINANCEIRO — prestação de contas: receita da bilheteria (que cai em
// `lancamentos`, categoria "Bilheteria", automaticamente no pagamento aprovado),
// taxa de serviço arrecadada, descontos concedidos e CONCILIAÇÃO com o Mercado
// Pago (o que veio do gateway × o que foi manual/cortesia). Sem "R$" hardcoded.

import { useMemo } from 'react';
import Link from 'next/link';
import { formatMoney, formatMoneyShort, formatNumber, formatDateTime } from '@/lib/format';
import { type BilheteriaEvento, type Pedido, conciliacaoMP } from '@/lib/bilheteria';
import { IcoMoney, IcoWallet, IcoTag, IcoCheck } from './Icons';

export function Financeiro({ bilheteria, pedidos }: { bilheteria: BilheteriaEvento; pedidos: Pedido[] }) {
  const moeda = (bilheteria.moeda || 'BRL') as 'BRL' | 'USD' | 'EUR';

  const fin = useMemo(() => {
    let receita = 0, taxa = 0, desconto = 0, pagos = 0;
    for (const p of pedidos) {
      if (p.status !== 'pago') continue;
      pagos++;
      receita += Number(p.total_num) || 0;
      taxa += Number(p.taxa_num) || 0;
      desconto += Number(p.desconto_num) || 0;
    }
    return { receita, taxa, desconto, liquida: receita - taxa, pagos };
  }, [pedidos]);

  const conc = useMemo(() => conciliacaoMP(pedidos), [pedidos]);
  const pagosMp = useMemo(() => pedidos.filter((p) => p.status === 'pago' && p.mp_payment_id).slice(0, 50), [pedidos]);

  return (
    <div className="mt-5 space-y-5">
      {/* KPIs financeiros */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Receita bruta" value={formatMoney(fin.receita, { currency: moeda })} sub={`${formatNumber(fin.pagos)} pedidos pagos`} icon={<IcoMoney />} tone="verde" />
        <Card label="Receita líquida" value={formatMoney(fin.liquida, { currency: moeda })} sub="sem a taxa de serviço" icon={<IcoWallet />} tone="ink" />
        <Card label="Taxa de serviço" value={formatMoney(fin.taxa, { currency: moeda })} sub="arrecadada do comprador" icon={<IcoTag />} tone="azul" />
        <Card label="Descontos" value={formatMoney(fin.desconto, { currency: moeda })} sub="concedidos via cupom" icon={<IcoTag />} tone="gold" />
      </div>

      {/* Receita no financeiro */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><IcoCheck size={20} /></span>
          <div>
            <div className="text-sm font-bold text-emerald-900">Receita lançada no Financeiro</div>
            <div className="text-xs text-emerald-700">Cada pagamento aprovado entra em lançamentos (categoria “Bilheteria”) automaticamente.</div>
          </div>
        </div>
        <Link href="/painel/financeiro" className="rounded-xl border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Abrir Financeiro</Link>
      </div>

      {/* Conciliação Mercado Pago */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-1 text-base font-bold text-ink">Conciliação Mercado Pago</h3>
        <p className="mb-4 text-xs text-ink-muted">Pagamentos confirmados pelo gateway × emissões manuais (cortesia/balcão).</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Conciliados (MP)" valor={formatNumber(conc.conciliados)} />
          <Mini label="Valor conciliado" valor={formatMoneyShort(conc.valorConciliado, { currency: moeda })} />
          <Mini label="Manuais" valor={formatNumber(conc.manuais)} />
          <Mini label="Aguardando" valor={formatNumber(conc.pendentesMp)} />
        </div>

        {pagosMp.length > 0 && (
          <div className="mt-5">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Pagamentos do Mercado Pago</div>
            <div className="overflow-hidden rounded-xl border border-black/[0.06]">
              <table className="w-full text-sm">
                <thead className="bg-black/[0.02] text-left text-xs text-ink-muted">
                  <tr><th className="px-3 py-2 font-semibold">Pedido</th><th className="px-3 py-2 font-semibold">Comprador</th><th className="px-3 py-2 font-semibold">MP ID</th><th className="px-3 py-2 text-right font-semibold">Valor</th><th className="hidden px-3 py-2 font-semibold sm:table-cell">Pago em</th></tr>
                </thead>
                <tbody>
                  {pagosMp.map((p) => (
                    <tr key={p.id} className="border-t border-black/[0.05]">
                      <td className="px-3 py-2 font-mono text-xs text-ink-soft">#{p.id.slice(0, 8).toUpperCase()}</td>
                      <td className="px-3 py-2 text-ink">{p.comprador_nome}</td>
                      <td className="px-3 py-2 font-mono text-xs text-ink-muted">{p.mp_payment_id}</td>
                      <td className="px-3 py-2 text-right font-semibold text-ink">{formatMoney(p.total_num, { currency: p.moeda as 'BRL' | 'USD' | 'EUR' })}</td>
                      <td className="hidden px-3 py-2 text-xs text-ink-muted sm:table-cell">{p.pago_em ? formatDateTime(p.pago_em) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, icon, tone }: { label: string; value: string; sub: string; icon: React.ReactNode; tone: 'ink' | 'verde' | 'azul' | 'gold' }) {
  const tones: Record<string, string> = { ink: 'bg-ink/5 text-ink', verde: 'bg-emerald-50 text-emerald-600', azul: 'bg-sky-50 text-sky-600', gold: 'bg-amber-50 text-amber-600' };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones[tone]}`}>{icon}</span>
      </div>
      <div className="mt-1.5 text-xl font-bold text-ink">{value}</div>
      <div className="mt-0.5 truncate text-xs text-ink-muted">{sub}</div>
    </div>
  );
}
function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl bg-black/[0.02] p-3 text-center">
      <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-0.5 text-base font-bold text-ink">{valor}</div>
    </div>
  );
}

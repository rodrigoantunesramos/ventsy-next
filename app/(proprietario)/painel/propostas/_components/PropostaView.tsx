'use client';

// PropostaView — renderizador PURO do documento da proposta. Fonte única do
// visual, reutilizado pela pré-visualização ao vivo do Construtor E pela página
// pública (app/(public)/proposta/[token]). Os botões de aceite/recusa ficam
// FORA daqui (são adicionados por quem consome). Sem "R$" hardcoded — toda moeda
// passa por formatMoney com a moeda da proposta.

import { formatMoney, formatDate, type Currency } from '@/lib/format';
import { ITEM_TIPO_BY, numeroLabel, somaParcelas, type Empresa, type Evento, type Parcela, type PropostaItem } from '../_lib';

export type PropostaViewData = {
  numero: number;
  titulo: string;
  moeda: Currency;
  itens: PropostaItem[];
  subtotal_num: number;
  desconto_num: number;
  total_num: number;
  validade: string | null;
  condicoes_pagamento: { metodo?: string; parcelas: Parcela[] };
  observacoes: string | null;
  condicoes: string | null;
  criado_em?: string | null;
};

export function PropostaView({
  data, empresa, evento, propriedadeNome, compact,
}: {
  data: PropostaViewData;
  empresa: Empresa | null;
  evento: Evento | null;
  propriedadeNome?: string | null;
  compact?: boolean;
}) {
  const moeda = data.moeda;
  const m = (v: number | null | undefined) => formatMoney(v, { currency: moeda });
  const empresaNome = empresa?.fantasia || empresa?.razao_social || 'Sua empresa';
  const contatos = empresa?.contatos || {};
  const clienteNome = (evento?.quem_contratou || '').trim();
  const parcelas = data.condicoes_pagamento?.parcelas || [];

  return (
    <div className={`mx-auto w-full max-w-3xl bg-white text-ink ${compact ? '' : 'rounded-2xl shadow-card'}`}>
      {/* Faixa de marca */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-t-2xl border-b border-black/[0.06] bg-gradient-to-r from-brand-50/60 to-white px-6 py-5">
        <div className="flex items-center gap-3">
          {empresa?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={empresa.logo_url} alt={empresaNome} className="h-12 w-12 rounded-xl object-cover ring-1 ring-black/[0.06]" />
          ) : (
            <span className="font-display text-2xl font-bold italic text-brand">VENTSY</span>
          )}
          <div>
            <div className="text-sm font-bold text-ink">{empresaNome}</div>
            {empresa?.cnpj && <div className="text-xs text-ink-muted">CNPJ {empresa.cnpj}</div>}
            <div className="text-xs text-ink-muted">
              {[contatos.telefone || contatos.whatsapp, contatos.email].filter(Boolean).join(' · ')}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[0.65rem] font-bold uppercase tracking-wide text-brand">Proposta comercial</div>
          <div className="font-display text-xl font-bold text-ink">{numeroLabel(data.numero)}</div>
          {data.criado_em && <div className="text-xs text-ink-muted">{formatDate(data.criado_em)}</div>}
        </div>
      </div>

      <div className="px-6 py-5">
        {/* Título + partes */}
        <h1 className="font-display text-2xl font-bold text-ink">{data.titulo}</h1>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InfoCard titulo="Para">
            <div className="font-semibold text-ink">{clienteNome || 'Cliente'}</div>
            {evento?.email && <div className="text-ink-muted">{evento.email}</div>}
            {evento?.documento && <div className="text-ink-muted">{evento.documento}</div>}
          </InfoCard>
          <InfoCard titulo="Evento">
            {evento?.nome_evento && <div className="font-semibold text-ink">{evento.nome_evento}</div>}
            <div className="text-ink-muted">
              {[evento?.tipo_evento, propriedadeNome].filter(Boolean).join(' · ') || '—'}
            </div>
            {evento?.data_inicio && (
              <div className="text-ink-muted">
                {formatDate(evento.data_inicio)}{evento.data_fim && evento.data_fim !== evento.data_inicio ? ` → ${formatDate(evento.data_fim)}` : ''}
              </div>
            )}
          </InfoCard>
        </div>

        {/* Itens */}
        <div className="mt-6 overflow-hidden rounded-xl border border-black/[0.06]">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-black/[0.02] text-left text-[0.7rem] uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-semibold">Descrição</th>
                <th className="px-3 py-2 text-center font-semibold">Qtd</th>
                <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Valor unit.</th>
                <th className="px-3 py-2 text-right font-semibold">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.05]">
              {data.itens.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-6 text-center text-ink-muted">Nenhum item ainda.</td></tr>
              )}
              {data.itens.map((it) => (
                <tr key={it.id} className="align-top">
                  <td className="px-3 py-2.5">
                    <span className="mr-1.5">{ITEM_TIPO_BY[it.tipo]?.icon}</span>
                    <span className="text-ink-soft">{it.descricao}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-ink-muted tabular-nums">{it.qtd}</td>
                  <td className="hidden px-3 py-2.5 text-right text-ink-muted tabular-nums sm:table-cell">{m(it.valor_unit)}</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{m(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totais */}
        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1.5 text-sm">
            <Linha label="Subtotal" value={m(data.subtotal_num)} />
            {data.desconto_num > 0 && <Linha label="Desconto" value={`− ${m(data.desconto_num)}`} tone="emerald" />}
            <div className="flex items-center justify-between rounded-xl bg-ink px-4 py-3 text-white">
              <span className="text-sm font-semibold text-white/80">Total</span>
              <span className="font-display text-xl font-bold tabular-nums">{m(data.total_num)}</span>
            </div>
          </div>
        </div>

        {/* Pagamento */}
        {parcelas.length > 0 && (
          <div className="mt-6">
            <h3 className="mb-2 text-sm font-bold text-ink">Condições de pagamento{data.condicoes_pagamento?.metodo ? ` · ${data.condicoes_pagamento.metodo}` : ''}</h3>
            <div className="overflow-hidden rounded-xl border border-black/[0.06]">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-black/[0.05]">
                  {parcelas.map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 py-2 text-ink-soft">{p.descricao}</td>
                      <td className="px-3 py-2 text-ink-muted">{p.vencimento ? formatDate(p.vencimento) : 'A combinar'}</td>
                      <td className="px-3 py-2 text-right font-medium tabular-nums">{m(p.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {Math.abs(somaParcelas(parcelas) - data.total_num) > 0.01 && (
              <p className="mt-1 text-xs text-amber-600">A soma das parcelas ({m(somaParcelas(parcelas))}) difere do total ({m(data.total_num)}).</p>
            )}
          </div>
        )}

        {/* Observações / cláusulas */}
        {(data.observacoes || data.condicoes) && (
          <div className="mt-6 space-y-4">
            {data.observacoes && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-ink">Observações</h3>
                <p className="whitespace-pre-wrap text-sm text-ink-soft">{data.observacoes}</p>
              </div>
            )}
            {data.condicoes && (
              <div>
                <h3 className="mb-1 text-sm font-bold text-ink">Condições gerais</h3>
                <p className="whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">{data.condicoes}</p>
              </div>
            )}
          </div>
        )}

        {/* Validade */}
        <div className="mt-6 flex items-center justify-between rounded-xl bg-brand-50/60 px-4 py-3 text-sm">
          <span className="font-semibold text-ink-soft">Validade da proposta</span>
          <span className="font-bold text-brand">{data.validade ? formatDate(data.validade) : 'A combinar'}</span>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.01] px-4 py-3 text-sm">
      <div className="mb-1 text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted">{titulo}</div>
      {children}
    </div>
  );
}

function Linha({ label, value, tone }: { label: string; value: string; tone?: 'emerald' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-ink-muted">{label}</span>
      <span className={`tabular-nums ${tone === 'emerald' ? 'text-emerald-600' : 'text-ink-soft'}`}>{value}</span>
    </div>
  );
}

'use client';

// Aba INGRESSOS (configuração) — define a venda: resumo da bilheteria, categorias
// /lotes (preço, quantidade, meia, janela) e cupons. As edições abrem modais
// (mutação na page.tsx via RLS). Sem "R$" hardcoded — valores via lib/format.

import { formatMoney, formatNumber, formatDate, formatPercent } from '@/lib/format';
import {
  type BilheteriaEvento, type Categoria, type Cupom, type Ingresso,
} from '@/lib/bilheteria';
import { IcoEdit, IcoTrash, IcoPlus, IcoTag, IcoGift } from './Icons';

export function Config({
  bilheteria, categorias, cupons, onNovaCategoria, onEditarCategoria, onRemoverCategoria,
  onNovoCupom, onEditarCupom, onRemoverCupom, onEditarBilheteria,
}: {
  bilheteria: BilheteriaEvento; categorias: Categoria[]; cupons: Cupom[]; ingressos: Ingresso[];
  onNovaCategoria: () => void; onEditarCategoria: (c: Categoria) => void; onRemoverCategoria: (c: Categoria) => void;
  onNovoCupom: () => void; onEditarCupom: (c: Cupom) => void; onRemoverCupom: (c: Cupom) => void;
  onEditarBilheteria: () => void;
}) {
  const moeda = bilheteria.moeda || 'BRL';

  return (
    <div className="mt-5 space-y-5">
      {/* Resumo da bilheteria */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Configuração da venda</h3>
          <button onClick={onEditarBilheteria} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/[0.03]"><IcoEdit size={15} /> Editar</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Info label="Taxa de serviço" value={formatPercent(bilheteria.taxa_servico)} />
          <Info label="Capacidade total" value={(bilheteria.capacidade ?? 0) > 0 ? formatNumber(bilheteria.capacidade) : 'Soma dos lotes'} />
          <Info label="Abertura" value={bilheteria.venda_inicio ? formatDate(bilheteria.venda_inicio, { style: 'short' }) : '—'} />
          <Info label="Encerramento" value={bilheteria.venda_fim ? formatDate(bilheteria.venda_fim, { style: 'short' }) : '—'} />
        </div>
        {(bilheteria.campos_extras || []).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-xs text-ink-muted">Campos extras:</span>
            {(bilheteria.campos_extras || []).map((c) => <span key={c.chave} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-xs text-ink-soft">{c.label}</span>)}
          </div>
        )}
      </div>

      {/* Categorias / lotes */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><IcoTag size={18} /><h3 className="text-base font-bold text-ink">Categorias & lotes</h3></div>
          <button onClick={onNovaCategoria} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus size={15} /> Categoria</button>
        </div>
        {categorias.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhuma categoria ainda. Crie a primeira para abrir as vendas.</p>
        ) : (
          <div className="space-y-2">
            {categorias.map((c) => {
              const disp = c.quantidade > 0 ? Math.max(0, c.quantidade - c.vendido) : null;
              const esgotado = c.quantidade > 0 && disp === 0;
              return (
                <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-ink">{c.nome}</span>
                      {c.lote_nome && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold text-brand">{c.lote_nome}</span>}
                      {!c.ativo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.65rem] font-bold text-gray-500">Inativa</span>}
                      {esgotado && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[0.65rem] font-bold text-red-600">Esgotado</span>}
                      {c.meia && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[0.65rem] font-bold text-sky-600">Meia</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-ink-muted">
                      Lote {c.lote}
                      {c.max_por_pedido > 0 ? ` · máx ${c.max_por_pedido}/pedido` : ''}
                      {c.por_pessoa ? ' · titular por ingresso' : ''}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-ink">{formatMoney(c.preco_num, { currency: moeda as 'BRL' | 'USD' | 'EUR' })}</div>
                    <div className="text-xs text-ink-muted">{formatNumber(c.vendido)}{c.quantidade > 0 ? ` / ${formatNumber(c.quantidade)}` : ' vendidos'}</div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => onEditarCategoria(c)} aria-label="Editar" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit size={16} /></button>
                    <button onClick={() => onRemoverCategoria(c)} aria-label="Remover" className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash size={16} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cupons */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2"><IcoGift size={18} /><h3 className="text-base font-bold text-ink">Cupons de desconto</h3></div>
          <button onClick={onNovoCupom} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3.5 py-2 text-sm font-semibold hover:bg-black/[0.03]"><IcoPlus size={15} /> Cupom</button>
        </div>
        {cupons.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhum cupom. Crie códigos promocionais (percentual ou valor fixo).</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {cupons.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-ink">{c.codigo}</span>
                    {!c.ativo && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[0.6rem] font-bold text-gray-500">Inativo</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    {c.tipo === 'percentual' ? `${formatNumber(c.valor_num)}% off` : `${formatMoney(c.valor_num, { currency: moeda as 'BRL' | 'USD' | 'EUR' })} off`}
                    {c.limite > 0 ? ` · ${formatNumber(c.usados)}/${formatNumber(c.limite)}` : ` · ${formatNumber(c.usados)} usos`}
                    {c.validade ? ` · até ${formatDate(c.validade, { style: 'short' })}` : ''}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => onEditarCupom(c)} aria-label="Editar" className="rounded-lg p-2 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit size={16} /></button>
                  <button onClick={() => onRemoverCupom(c)} aria-label="Remover" className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[0.02] p-3">
      <div className="text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink">{value}</div>
    </div>
  );
}

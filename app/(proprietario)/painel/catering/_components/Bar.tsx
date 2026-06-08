'use client';

// Aba Bar — open bar × consumação × cash bar do evento. Cardápio de drinks com
// custo/preço/consumo por pessoa, lançamento do consumo REAL (servido + perdas)
// e o resultado (custo, receita, perdas, custo/pessoa, margem). Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoBag, type Drink, type ConsumoDrink, type BarTipo,
  BAR_TIPOS, DRINK_CATEGORIAS, resultadoBar, salvarBarEvento, cryptoId, inpSm, selCls,
} from '../_lib';
import {
  Kpi, EmptyState, btnPrimary, btnSecondary, btnGhost,
  IcoWine, IcoPlus, IcoTrash, IcoCheck,
} from './ui';

export default function Bar({ bag }: { bag: EventoBag }) {
  const toast = useToast();
  const { bar, catering } = bag;
  const convidados = catering.convidados;

  const [tipo, setTipo] = useState<BarTipo>(bar?.tipo || 'sem_bar');
  const [drinks, setDrinks] = useState<Drink[]>(bar?.drinks || []);
  const [consumo, setConsumo] = useState<Record<string, { quantidade: number; perda: number }>>(() => {
    const base: Record<string, { quantidade: number; perda: number }> = {};
    for (const c of bar?.consumo || []) base[c.drink_id] = { quantidade: c.quantidade, perda: c.perda };
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTipo(bar?.tipo || 'sem_bar');
    setDrinks(bar?.drinks || []);
    const base: Record<string, { quantidade: number; perda: number }> = {};
    for (const c of bar?.consumo || []) base[c.drink_id] = { quantidade: c.quantidade, perda: c.perda };
    setConsumo(base);
    setDirty(false);
  }, [bar?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const consumoLista = useMemo<ConsumoDrink[]>(
    () => drinks.map((d) => ({ drink_id: d.id, quantidade: Number(consumo[d.id]?.quantidade) || 0, perda: Number(consumo[d.id]?.perda) || 0 }))
      .filter((c) => c.quantidade > 0 || c.perda > 0),
    [drinks, consumo],
  );
  const temConsumo = consumoLista.length > 0;
  const resultado = useMemo(() => resultadoBar({ tipo, drinks, convidados, consumo: consumoLista }), [tipo, drinks, convidados, consumoLista]);

  const mark = () => setDirty(true);
  const novoDrink = () => { setDrinks((xs) => [...xs, { id: cryptoId(), nome: '', categoria: 'coquetel', custo_num: 0, preco_num: 0, por_pessoa: 0 }]); mark(); };
  const patchDrink = (id: string, patch: Partial<Drink>) => { setDrinks((xs) => xs.map((d) => (d.id === id ? { ...d, ...patch } : d))); mark(); };
  const removeDrink = (id: string) => { setDrinks((xs) => xs.filter((d) => d.id !== id)); setConsumo((c) => { const n = { ...c }; delete n[id]; return n; }); mark(); };
  const setCons = (id: string, key: 'quantidade' | 'perda', v: number) => {
    setConsumo((c) => { const prev = c[id] || { quantidade: 0, perda: 0 }; return { ...c, [id]: { ...prev, [key]: Math.max(0, v) } }; });
    mark();
  };

  const salvar = async () => {
    setSaving(true);
    const res = await salvarBarEvento(bar!.id, {
      tipo, drinks,
      consumo: consumoLista,
      custo_num: temConsumo ? resultado.custoReal : resultado.custoPrevisto,
      receita_num: temConsumo ? resultado.receitaReal : resultado.receitaPrevista,
      perdas_num: resultado.perdas,
    });
    setSaving(false);
    if (res.error) { toast.error('Não foi possível salvar o bar.'); return; }
    toast.success('Bar salvo.');
    setDirty(false);
    await bag.recarregar();
  };

  if (!bar) {
    return (
      <EmptyState icon={<IcoWine />} title="Bar indisponível">
        A tabela <code className="rounded bg-black/[0.06] px-1 text-xs">bar_evento</code> não foi encontrada. Rode <code className="rounded bg-black/[0.06] px-1 text-xs">docs/sql/catering.sql</code>.
      </EmptyState>
    );
  }

  const tipoMeta = BAR_TIPOS.find((t) => t.v === tipo);

  return (
    <div className="space-y-5">
      {/* Tipo de bar */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoWine /> Modelo do bar</h4>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {BAR_TIPOS.map((t) => (
            <button key={t.v} onClick={() => { setTipo(t.v); mark(); }}
              className={`rounded-xl border p-3 text-left transition ${tipo === t.v ? 'border-brand bg-brand-50' : 'border-black/10 hover:bg-black/[0.02]'}`}>
              <span className={`block text-sm font-bold ${tipo === t.v ? 'text-brand' : 'text-ink'}`}>{t.label}</span>
              <span className="mt-0.5 block text-[0.68rem] text-ink-muted">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {tipo === 'sem_bar' ? (
        <EmptyState icon={<IcoWine />} title="Evento sem serviço de bar">
          Selecione open bar, consumação ou cash bar acima para montar o cardápio de drinks e controlar consumo.
        </EmptyState>
      ) : (
        <>
          {/* KPIs do bar */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label={temConsumo ? 'Custo real' : 'Custo previsto'} value={formatMoney(temConsumo ? resultado.custoReal : resultado.custoPrevisto)} tone="ink" />
            <Kpi label={temConsumo ? 'Receita real' : 'Receita prevista'} value={formatMoney(temConsumo ? resultado.receitaReal : resultado.receitaPrevista)} tone="verde"
              sub={tipo === 'open_bar' ? 'inclusa no pacote' : undefined} />
            <Kpi label="Custo / pessoa" value={formatMoney(resultado.custoPorPessoa)} tone="azul" sub={`${formatNumber(convidados)} convidados`} />
            <Kpi label="Perdas" value={formatMoney(resultado.perdas)} tone={resultado.perdas > 0 ? 'vermelho' : 'cinza'} />
          </div>

          {/* Cardápio de drinks + consumo */}
          <div className="rounded-2xl bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] p-4">
              <div>
                <h4 className="text-sm font-bold text-ink">Cardápio de drinks</h4>
                <p className="text-[0.72rem] text-ink-muted">{tipoMeta?.desc} Consumo/pessoa dimensiona o previsto; lance o servido + perdas para o real.</p>
              </div>
              <button onClick={novoDrink} className={btnSecondary}><IcoPlus /> Drink</button>
            </div>

            {drinks.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">Nenhum drink. Adicione bebidas com custo, preço e consumo por pessoa.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/[0.06] text-left text-[0.68rem] uppercase tracking-wide text-ink-muted">
                      <th className="px-3 py-2 font-semibold">Drink</th>
                      <th className="px-2 py-2 font-semibold">Categoria</th>
                      <th className="px-2 py-2 text-right font-semibold">Custo</th>
                      <th className="px-2 py-2 text-right font-semibold">Preço</th>
                      <th className="px-2 py-2 text-right font-semibold">/pessoa</th>
                      <th className="px-2 py-2 text-right font-semibold">Servido</th>
                      <th className="px-2 py-2 text-right font-semibold">Perda</th>
                      <th className="px-2 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {drinks.map((d) => (
                      <tr key={d.id} className="border-b border-black/[0.04] last:border-0">
                        <td className="px-3 py-1.5"><input value={d.nome} onChange={(e) => patchDrink(d.id, { nome: e.target.value })} className={`${inpSm} min-w-[120px]`} placeholder="Caipirinha" /></td>
                        <td className="px-2 py-1.5">
                          <select value={d.categoria} onChange={(e) => patchDrink(d.id, { categoria: e.target.value })} className={`${selCls} py-1`}>
                            {DRINK_CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5"><input type="number" min={0} step="0.01" value={d.custo_num || ''} onChange={(e) => patchDrink(d.id, { custo_num: Number(e.target.value) })} className={`${inpSm} w-20 text-right`} placeholder="0" /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} step="0.01" value={d.preco_num || ''} onChange={(e) => patchDrink(d.id, { preco_num: Number(e.target.value) })} className={`${inpSm} w-20 text-right`} placeholder="0" /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} step="0.1" value={d.por_pessoa || ''} onChange={(e) => patchDrink(d.id, { por_pessoa: Number(e.target.value) })} className={`${inpSm} w-16 text-right`} placeholder="0" /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} value={consumo[d.id]?.quantidade || ''} onChange={(e) => setCons(d.id, 'quantidade', Number(e.target.value))} className={`${inpSm} w-16 text-right`} placeholder="0" /></td>
                        <td className="px-2 py-1.5"><input type="number" min={0} value={consumo[d.id]?.perda || ''} onChange={(e) => setCons(d.id, 'perda', Number(e.target.value))} className={`${inpSm} w-14 text-right`} placeholder="0" /></td>
                        <td className="px-2 py-1.5 text-right"><button onClick={() => removeDrink(d.id)} aria-label="Remover drink" className={`${btnGhost} text-red-400 hover:bg-red-50`}><IcoTrash /></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-black/[0.06] p-3">
              <div className="text-xs text-ink-muted">
                {tipo !== 'open_bar' && <span>Margem do bar: <strong className="text-emerald-600">{formatPercent(resultado.margem)}</strong> · </span>}
                Previsto: {formatMoney(resultado.custoPrevisto)}{tipo !== 'open_bar' ? ` → ${formatMoney(resultado.receitaPrevista)}` : ''}
              </div>
              <button onClick={salvar} disabled={saving} className={btnPrimary}>
                {dirty ? <><IcoCheck /> {saving ? 'Salvando…' : 'Salvar bar'}</> : <>{saving ? 'Salvando…' : 'Salvo'}</>}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

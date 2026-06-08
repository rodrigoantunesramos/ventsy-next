'use client';

// Aba A&B do evento — escolhe o cardápio, dimensiona por nº de convidados
// (gera a lista de compras/REQUISIÇÃO em Compras), agrega as restrições dos
// convidados e checa a cobertura do cardápio. A receita (preço/pessoa ×
// convidados) é o que alimenta a Proposta/Precificação. Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoBag, type RestricaoLinha,
  RESTRICOES, dimensionar, custoDimensionado, custoCardapioPorPessoa, precoCardapioPorPessoa,
  coberturaRestricoes, parseRestricoesTexto, restricaoLabel, restricaoCor,
  cardapioTipoLabel, salvarCateringEvento, gerarRequisicao, exportCSV, inp, selCls,
} from '../_lib';
import {
  Kpi, EmptyState, btnPrimary, btnSecondary,
  IcoUtensils, IcoUsers, IcoCart, IcoDownload, IcoCheck, IcoAlert, IcoLeaf, IcoLink, IcoArrowRight,
} from './ui';

export default function AeBEvento({ bag, onIrCardapios }: { bag: EventoBag; onIrCardapios: () => void }) {
  const toast = useToast();
  const { catering, evento, cardapios } = bag;

  const [cardapioId, setCardapioId] = useState<string | null>(catering.cardapio_id);
  const [convidados, setConvidados] = useState<number>(catering.convidados);
  const [fator, setFator] = useState<number>(catering.fator_ajuste || 1);
  const [restr, setRestr] = useState<Record<string, number>>(() => {
    const base: Record<string, number> = {};
    for (const l of catering.restricoes) if (l.restricao) base[l.restricao] = l.quantidade;
    return base;
  });
  const [gerando, setGerando] = useState(false);

  // Mantém o estado local em sincronia quando troca de evento.
  useEffect(() => {
    setCardapioId(catering.cardapio_id);
    setConvidados(catering.convidados);
    setFator(catering.fator_ajuste || 1);
    const base: Record<string, number> = {};
    for (const l of catering.restricoes) if (l.restricao) base[l.restricao] = l.quantidade;
    setRestr(base);
  }, [catering.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardapio = useMemo(() => cardapios.find((c) => c.id === cardapioId) || null, [cardapios, cardapioId]);
  const restrLinhas = useMemo<RestricaoLinha[]>(
    () => RESTRICOES.map((r) => ({ restricao: r.v, quantidade: Number(restr[r.v]) || 0 })).filter((l) => l.quantidade > 0),
    [restr],
  );

  const dimensionamento = useMemo(() => (cardapio ? dimensionar(cardapio, convidados, fator) : []), [cardapio, convidados, fator]);
  const custoMenuPessoa = cardapio ? custoCardapioPorPessoa(cardapio) : 0;
  const precoPessoa = cardapio ? precoCardapioPorPessoa(cardapio) : 0;
  const custoPrevisto = Math.round(custoMenuPessoa * convidados * fator * 100) / 100;
  const receita = Math.round(precoPessoa * convidados * 100) / 100;
  const cobertura = useMemo(() => coberturaRestricoes(cardapio, restrLinhas), [cardapio, restrLinhas]);
  const detectadas = useMemo(() => parseRestricoesTexto(evento.restricoes_alimentares), [evento.restricoes_alimentares]);

  // Persiste o estado do A&B no catering_evento (chamado nas mudanças).
  const persistir = useCallback(async (patch: Record<string, unknown>) => {
    const res = await salvarCateringEvento(catering.id, patch);
    if (res.error) toast.error('Não foi possível salvar.');
    else await bag.recarregar();
  }, [catering.id, bag, toast]);

  const onCardapio = (id: string) => {
    const v = id || null;
    setCardapioId(v);
    const c = cardapios.find((x) => x.id === v) || null;
    persistir({
      cardapio_id: v,
      custo_previsto_num: c ? Math.round(custoCardapioPorPessoa(c) * convidados * fator * 100) / 100 : 0,
      receita_num: c ? Math.round(precoCardapioPorPessoa(c) * convidados * 100) / 100 : 0,
    });
  };
  const onBlurNumeros = () => persistir({
    convidados: Math.max(0, Math.floor(convidados)), fator_ajuste: fator > 0 ? fator : 1,
    custo_previsto_num: custoPrevisto, receita_num: receita,
  });
  const onRestr = (r: string, q: number) => {
    const next = { ...restr, [r]: Math.max(0, Math.floor(q) || 0) };
    setRestr(next);
  };
  const salvarRestricoes = () => persistir({ restricoes: RESTRICOES.map((r) => ({ restricao: r.v, quantidade: Number(restr[r.v]) || 0 })).filter((l) => l.quantidade > 0) });

  const gerarReq = async () => {
    if (!cardapio) { toast.error('Selecione um cardápio.'); return; }
    if (dimensionamento.length === 0) { toast.error('O cardápio não tem ficha técnica para requisitar.'); return; }
    setGerando(true);
    const res = await gerarRequisicao(evento.id, dimensionamento, cardapio.nome);
    setGerando(false);
    if (!res.ok) {
      if (res.error === 'compras_indisponivel') toast.error('Módulo Compras não está ativo (rode docs/sql/compras.sql).');
      else toast.error(res.error || 'Falha ao gerar a requisição.');
      return;
    }
    toast.success(`Requisição ${res.data?.numero || ''} gerada em Compras.`);
    await bag.recarregar();
  };

  const exportarLista = () => {
    exportCSV(
      `lista-compras-${(evento.nome_evento || 'evento').toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Insumo', 'Unidade', 'Qtd/pessoa', 'Qtd total', 'Custo unit.', 'Custo total', 'Estoque'],
      dimensionamento.map((l) => [l.nome, l.unidade, l.qtd_por_pessoa, l.qtd_total, l.custo_unit_num, l.custo_total_num, l.produto_id ? 'sim' : 'avulso']),
    );
  };

  return (
    <div className="space-y-5">
      {/* Configuração do A&B */}
      <div className="grid gap-3 rounded-2xl bg-white p-4 shadow-card sm:grid-cols-[2fr_1fr_1fr]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-soft">Cardápio</span>
          <select value={cardapioId || ''} onChange={(e) => onCardapio(e.target.value)} className={`${selCls} w-full`}>
            <option value="">Selecione um cardápio…</option>
            {cardapios.map((c) => <option key={c.id} value={c.id}>{c.nome} · {cardapioTipoLabel(c.tipo)}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-soft">Convidados</span>
          <input type="number" min={0} value={convidados || ''} onChange={(e) => setConvidados(Number(e.target.value))} onBlur={onBlurNumeros} className={inp} placeholder="0" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-soft">Fator de folga</span>
          <input type="number" min={1} step="0.05" value={fator || ''} onChange={(e) => setFator(Number(e.target.value))} onBlur={onBlurNumeros} className={inp} placeholder="1.00" />
        </label>
      </div>

      {!cardapio ? (
        <EmptyState icon={<IcoUtensils />} title="Escolha um cardápio para o evento"
          cta={<button onClick={onIrCardapios} className={btnSecondary}>Ir para Cardápios <IcoArrowRight /></button>}>
          Selecione um cardápio acima. Com o nº de convidados, calculamos as quantidades de cada insumo e a lista de compras.
        </EmptyState>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Convidados" value={formatNumber(convidados)} tone="brand" icon={<IcoUsers />} />
            <Kpi label="Custo A&B previsto" value={formatMoney(custoPrevisto)} tone="ink" sub={`${formatMoney(custoMenuPessoa)} / pessoa`} />
            <Kpi label="Receita A&B" value={formatMoney(receita)} tone="verde" sub="alimenta a proposta" />
            <Kpi label="Food cost" value={receita > 0 ? formatPercent(custoPrevisto / receita) : '—'} tone={receita > 0 && custoPrevisto / receita > 0.4 ? 'vermelho' : 'gold'} />
          </div>

          {/* Restrições + cobertura */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoLeaf /> Restrições dos convidados</h4>
                <button onClick={salvarRestricoes} className="text-xs font-semibold text-brand hover:underline">Salvar</button>
              </div>
              {detectadas.length > 0 && (
                <p className="mt-1 text-[0.72rem] text-ink-muted">
                  Detectado no cadastro: {detectadas.map((r) => restricaoLabel(r)).join(', ')}.
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {RESTRICOES.map((r) => (
                  <label key={r.v} className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.06] px-2 py-1.5">
                    <span className="truncate text-[0.72rem] font-medium" style={{ color: r.cor }}>{r.label}</span>
                    <input type="number" min={0} value={restr[r.v] || ''} onChange={(e) => onRestr(r.v, Number(e.target.value))} onBlur={salvarRestricoes}
                      className="w-12 rounded-md border border-black/10 px-1.5 py-0.5 text-right text-sm focus:border-brand focus:outline-none" placeholder="0" />
                  </label>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-white p-4 shadow-card">
              <h4 className="text-sm font-bold text-ink">Cobertura do cardápio</h4>
              {cobertura.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">Sem restrições com convidados informados. Preencha ao lado para checar se o cardápio atende.</p>
              ) : (
                <ul className="mt-3 space-y-1.5">
                  {cobertura.map((c) => (
                    <li key={c.restricao} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: restricaoCor(c.restricao) }} />
                        <span className="font-medium" style={{ color: restricaoCor(c.restricao) }}>{restricaoLabel(c.restricao)}</span>
                        <span className="text-ink-muted">({formatNumber(c.quantidade)})</span>
                      </span>
                      {c.atendida ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600"><IcoCheck /> {c.itens.length} prato(s)</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><IcoAlert /> sem opção</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Dimensionamento → lista de compras / requisição */}
          <div className="rounded-2xl bg-white shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/[0.06] p-4">
              <div>
                <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoCart /> Dimensionamento & lista de compras</h4>
                <p className="text-[0.72rem] text-ink-muted">Quantidades para {formatNumber(convidados)} convidados (fator {formatNumber(fator, { maximumFractionDigits: 2 })}).</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {catering.requisicao_id && (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"><IcoLink /> Requisição gerada</span>
                )}
                <button onClick={exportarLista} disabled={dimensionamento.length === 0} className={btnSecondary}><IcoDownload /> CSV</button>
                <button onClick={gerarReq} disabled={gerando || dimensionamento.length === 0} className={btnPrimary}>
                  <IcoCart /> {gerando ? 'Gerando…' : 'Gerar requisição'}
                </button>
              </div>
            </div>

            {dimensionamento.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-muted">
                Este cardápio não tem ficha técnica. Edite o cardápio em <button onClick={onIrCardapios} className="font-semibold text-brand hover:underline">Cardápios</button> e adicione insumos por prato.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-black/[0.06] text-left text-[0.7rem] uppercase tracking-wide text-ink-muted">
                      <th className="px-4 py-2 font-semibold">Insumo</th>
                      <th className="px-3 py-2 text-right font-semibold">Qtd/pes.</th>
                      <th className="px-3 py-2 text-right font-semibold">Qtd total</th>
                      <th className="px-3 py-2 text-right font-semibold">Custo unit.</th>
                      <th className="px-4 py-2 text-right font-semibold">Custo total</th>
                      <th className="px-3 py-2 text-center font-semibold">Estoque</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensionamento.map((l, i) => (
                      <tr key={i} className="border-b border-black/[0.04] last:border-0">
                        <td className="px-4 py-2 font-medium text-ink">{l.nome}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatNumber(l.qtd_por_pessoa, { maximumFractionDigits: 3 })} {l.unidade}</td>
                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-ink">{formatNumber(l.qtd_total, { maximumFractionDigits: 2 })} {l.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-ink-soft">{formatMoney(l.custo_unit_num)}</td>
                        <td className="px-4 py-2 text-right font-semibold tabular-nums text-ink">{formatMoney(l.custo_total_num)}</td>
                        <td className="px-3 py-2 text-center">
                          {l.produto_id
                            ? <span className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-emerald-600"><IcoCheck /> liga</span>
                            : <span className="text-[0.68rem] text-ink-muted">avulso</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-black/[0.02] font-bold">
                      <td className="px-4 py-2.5" colSpan={4}>Total da ficha técnica</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-ink">{formatMoney(custoDimensionado(dimensionamento))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

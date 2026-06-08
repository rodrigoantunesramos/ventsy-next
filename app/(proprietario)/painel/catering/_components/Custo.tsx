'use client';

// Aba Custo (CMV) — custo de A&B por evento e por pessoa, food cost % e o
// comparativo PREVISTO × REAL: o previsto vem do dimensionamento do cardápio; o
// real vem do consumo BAIXADO no Estoque (saídas valoradas pelo custo médio).
// Registrar consumo baixa o Estoque via /api/catering. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatMoney, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type EventoBag,
  dimensionar, linhasComProduto, custoDimensionado, custoCardapioPorPessoa, precoCardapioPorPessoa,
  resultadoBar, compararCMV, custoPorPessoa, consumirEstoque, estornarConsumo, exportCSV,
} from '../_lib';
import {
  Kpi, EmptyState, Progress, btnPrimary, btnSecondary,
  IcoChart, IcoBox, IcoDownload, IcoCheckCircle, IcoArrowRight,
} from './ui';

export default function Custo({ bag, onIrCardapios }: { bag: EventoBag; onIrCardapios: () => void }) {
  const toast = useToast();
  const { catering, bar, cardapios, evento } = bag;
  const convidados = catering.convidados;
  const fator = catering.fator_ajuste || 1;

  const cardapio = useMemo(() => cardapios.find((c) => c.id === catering.cardapio_id) || null, [cardapios, catering.cardapio_id]);
  const [baixando, setBaixando] = useState(false);

  // Dimensionamento e a parte que baixa Estoque (insumos com produto_id).
  const dimensionamento = useMemo(() => (cardapio ? dimensionar(cardapio, convidados, fator) : []), [cardapio, convidados, fator]);
  const linhasProduto = useMemo(() => linhasComProduto(dimensionamento), [dimensionamento]);

  // Cardápio: previsto = ficha que liga ao Estoque; real = consumo já baixado.
  const cmvPrevistoCardapio = custoDimensionado(linhasProduto);
  const cmvRealCardapio = catering.custo_real_num;
  const baixado = !!catering.baixado_em;

  // Bar: previsto × real do resultado do bar.
  const barRes = useMemo(() => resultadoBar({
    tipo: bar?.tipo || 'sem_bar', drinks: bar?.drinks || [], convidados, consumo: bar?.consumo || [],
  }), [bar, convidados]);

  // Receita total (cardápio + bar) — base do food cost.
  const receitaCardapio = cardapio ? Math.round(precoCardapioPorPessoa(cardapio) * convidados * 100) / 100 : 0;
  const receitaBar = barRes.receitaReal || barRes.receitaPrevista;
  const receitaTotal = Math.round((receitaCardapio + receitaBar) * 100) / 100;

  // Custo total do A&B (cardápio cheio + bar) — orçamento do evento.
  const custoCardapioCheioPrevisto = cardapio ? Math.round(custoCardapioPorPessoa(cardapio) * convidados * fator * 100) / 100 : 0;
  const custoBarPrevisto = barRes.custoPrevisto;
  const custoBarReal = barRes.custoReal;

  const totalPrevisto = Math.round((custoCardapioCheioPrevisto + custoBarPrevisto) * 100) / 100;
  const totalReal = Math.round(((baixado ? cmvRealCardapio : custoCardapioCheioPrevisto) + (custoBarReal || custoBarPrevisto)) * 100) / 100;
  const temReal = baixado || custoBarReal > 0;

  const cmpCardapio = compararCMV({ custoPrevisto: cmvPrevistoCardapio, custoReal: cmvRealCardapio, receita: receitaCardapio });

  const baixar = async (force = false) => {
    if (linhasProduto.length === 0) { toast.error('Sem insumos controlados no Estoque para baixar.'); return; }
    setBaixando(true);
    const res = await consumirEstoque(evento.id, linhasProduto, cardapio?.nome || 'A&B', force);
    setBaixando(false);
    if (!res.ok) {
      if (res.error === 'estoque_indisponivel') toast.error('Estoque não está ativo (rode docs/sql/estoque.sql).');
      else if (res.error === 'consumo_ja_registrado') toast.info('Consumo já registrado. Estorne antes de refazer.');
      else if (res.error === 'saldo_insuficiente') {
        const faltam = (res.itens || []).map((i) => i.nome).slice(0, 3).join(', ');
        if (window.confirm(`Saldo insuficiente em: ${faltam}…\nBaixar mesmo assim (estoque pode ficar negativo)?`)) return baixar(true);
      } else toast.error(res.error || 'Falha ao baixar o consumo.');
      return;
    }
    toast.success('Consumo baixado no Estoque. CMV real atualizado.');
    await bag.recarregar();
  };
  const estornar = async () => {
    if (!window.confirm('Estornar o consumo baixado? As saídas no Estoque serão removidas.')) return;
    setBaixando(true);
    const res = await estornarConsumo(evento.id);
    setBaixando(false);
    if (!res.ok) { toast.error('Falha ao estornar.'); return; }
    toast.success('Consumo estornado.');
    await bag.recarregar();
  };

  const exportarCMV = () => {
    exportCSV(
      `cmv-${(evento.nome_evento || 'evento').toLowerCase().replace(/\s+/g, '-')}.csv`,
      ['Bloco', 'Previsto', 'Real'],
      [
        ['Cardápio (ficha → Estoque)', cmvPrevistoCardapio, cmvRealCardapio],
        ['Bar', custoBarPrevisto, custoBarReal],
        ['Total A&B', totalPrevisto, totalReal],
        ['Receita A&B', receitaTotal, receitaTotal],
      ],
    );
  };

  if (!cardapio && (!bar || bar.tipo === 'sem_bar')) {
    return (
      <EmptyState icon={<IcoChart />} title="Sem dados de custo ainda"
        cta={<button onClick={onIrCardapios} className={btnSecondary}>Ir para Cardápios <IcoArrowRight /></button>}>
        Escolha um cardápio na aba A&B do evento e/ou configure o bar para ver o custo previsto, o food cost e o comparativo com o consumo real do Estoque.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Custo A&B previsto" value={formatMoney(totalPrevisto)} tone="ink" icon={<IcoChart />} sub={`${formatMoney(custoPorPessoa(totalPrevisto, convidados))} / pessoa`} />
        <Kpi label="Custo A&B real" value={temReal ? formatMoney(totalReal) : '—'} tone={temReal ? 'brand' : 'cinza'} sub={temReal ? `${formatMoney(custoPorPessoa(totalReal, convidados))} / pessoa` : 'registre o consumo'} />
        <Kpi label="Receita A&B" value={formatMoney(receitaTotal)} tone="verde" sub="cardápio + bar" />
        <Kpi label="Food cost" value={receitaTotal > 0 ? formatPercent((temReal ? totalReal : totalPrevisto) / receitaTotal) : '—'}
          tone={receitaTotal > 0 && (temReal ? totalReal : totalPrevisto) / receitaTotal > 0.4 ? 'vermelho' : 'gold'} sub={temReal ? 'real' : 'previsto'} />
      </div>

      {/* Previsto × Real */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-ink">Previsto × Real</h4>
          <button onClick={exportarCMV} className={btnSecondary}><IcoDownload /> CSV</button>
        </div>
        <div className="mt-4 space-y-4">
          <LinhaPR label="Cardápio (ficha → Estoque)" previsto={cmvPrevistoCardapio} real={cmvRealCardapio} mostrarReal={baixado} />
          <LinhaPR label="Bar" previsto={custoBarPrevisto} real={custoBarReal} mostrarReal={custoBarReal > 0} />
          <div className="border-t border-black/[0.06] pt-3">
            <LinhaPR label="Total A&B" previsto={totalPrevisto} real={totalReal} mostrarReal={temReal} forte />
          </div>
        </div>
        {baixado && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">
            <IcoCheckCircle />
            <span>
              Variação do cardápio: <strong>{cmpCardapio.variacao_num >= 0 ? '+' : ''}{formatMoney(cmpCardapio.variacao_num)}</strong>
              {cmpCardapio.previsto_num > 0 && <> ({formatPercent(cmpCardapio.variacao_pct, { maximumFractionDigits: 1 })})</>} vs. previsto.
            </span>
          </div>
        )}
      </div>

      {/* Consumo do Estoque (baixa → CMV real) */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoBox /> Consumo real (Estoque)</h4>
            <p className="mt-0.5 text-[0.72rem] text-ink-muted">
              {linhasProduto.length > 0
                ? `${linhasProduto.length} insumo(s) controlado(s) baixam do Estoque e valoram o CMV real pelo custo médio.`
                : 'O cardápio atual não tem insumos ligados ao Estoque (defina produtos na ficha técnica).'}
            </p>
          </div>
          <div className="flex gap-2">
            {baixado
              ? <button onClick={estornar} disabled={baixando} className={btnSecondary}>Estornar</button>
              : <button onClick={() => baixar(false)} disabled={baixando || linhasProduto.length === 0} className={btnPrimary}><IcoBox /> {baixando ? 'Baixando…' : 'Registrar consumo'}</button>}
          </div>
        </div>

        {baixado && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-800">
            <IcoCheckCircle /> Consumo baixado · CMV real {formatMoney(cmvRealCardapio)} ({catering.consumo_movs.length} movimento(s) no Estoque).
          </div>
        )}

        {/* Itens mais caros (previstos) */}
        {linhasProduto.length > 0 && (
          <div className="mt-4">
            <div className="text-[0.7rem] font-bold uppercase tracking-wide text-ink-muted">Insumos de maior custo</div>
            <div className="mt-2 space-y-2">
              {linhasProduto.slice(0, 6).map((l, i) => {
                const max = linhasProduto[0]?.custo_total_num || 1;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-soft">{l.nome}</span>
                      <span className="tabular-nums text-ink-muted">{formatNumber(l.qtd_total, { maximumFractionDigits: 1 })} {l.unidade} · <strong className="text-ink">{formatMoney(l.custo_total_num)}</strong></span>
                    </div>
                    <Progress value={l.custo_total_num / max} className="mt-1" />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Linha do comparativo previsto × real (com variação colorida).
function LinhaPR({ label, previsto, real, mostrarReal, forte }: { label: string; previsto: number; real: number; mostrarReal: boolean; forte?: boolean }) {
  const variacao = Math.round((real - previsto) * 100) / 100;
  const estourou = variacao > 0.009;
  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
      <span className={`text-sm ${forte ? 'font-bold text-ink' : 'font-medium text-ink-soft'}`}>{label}</span>
      <div className="text-right">
        <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">Previsto</div>
        <div className={`tabular-nums ${forte ? 'text-base font-bold' : 'text-sm font-semibold'} text-ink`}>{formatMoney(previsto)}</div>
      </div>
      <div className="min-w-[92px] text-right">
        <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">Real</div>
        {mostrarReal ? (
          <div className={`tabular-nums ${forte ? 'text-base font-bold' : 'text-sm font-semibold'} ${estourou ? 'text-red-600' : 'text-emerald-600'}`}>{formatMoney(real)}</div>
        ) : (
          <div className="text-sm text-ink-muted">—</div>
        )}
      </div>
    </div>
  );
}

'use client'

// Os 5 dashboards prontos do BI (Comercial · Financeiro · Operacional · Clientes
// · Ocupação). Cada um consome o dataset JÁ FILTRADO (propriedade + tipo) e o
// período, calcula tudo pela engine pura lib/bi.ts e desenha com as primitivas
// SVG de ./ui. KPIs honram o período selecionado; gráficos de evolução usam uma
// janela de 12 meses (trailing) para o trend ficar legível.

import { type ReactNode } from 'react'
import { formatMoney, formatMoneyShort, formatPercent, formatNumber } from '@/lib/format'
import {
  type Range, noRange, variacao, serieMensal, mesesNoRange, stageRank,
  funilComercial, pipelinePonderado, ticketMedioPorTipo,
  dreResumido, margemPorTipo, agingParcelas,
  calcularOcupacao, revpas, receitaPorM2, receitaPorEvento,
  calcularNps, mediaAvaliacoes, csatFeedbacks, clientesResumo,
} from '@/lib/bi'
import { type DadosBI, blocosOcupacao } from '../_lib'
import {
  Card, KpiCard, Funnel, AreaMensal, ComboMensal, Donut, RankList,
  OcupacaoHeatmap, NpsGauge, EmptyChart,
} from './ui'

export type DashProps = { dados: DadosBI; range: Range; rangePrev: Range; range12: Range; hojeYMD: string }

const moneyShort = (n: number) => formatMoneyShort(n)
const nomeProp = (d: DadosBI, id: number | null) => (id != null && d.propriedades.find((p) => p.id === id)?.nome) || `Espaço #${id}`

// receita/despesa realizadas no caixa dentro de um range
function caixa(d: DadosBI, r: Range) {
  let receita = 0, despesa = 0
  for (const l of d.lancamentos) {
    if (!noRange(l.data, r)) continue
    if (l.tipo === 'receita') receita += l.valor
    else if (l.tipo === 'despesa') despesa += l.valor
  }
  return { receita, despesa, lucro: receita - despesa }
}

// ─────────────────────────────────────────────────────────────────────────────
// COMERCIAL — funil lead→proposta→contrato, conversão, ciclo, pipeline, ticket.
// ─────────────────────────────────────────────────────────────────────────────
export function Comercial({ dados, range, rangePrev, range12 }: DashProps) {
  const noP = (e: { criado_em?: string | null; data_inicio?: string | null }) => noRange(e.criado_em || e.data_inicio, range)
  const eventosP = dados.eventos.filter(noP)
  const eventosPrev = dados.eventos.filter((e) => noRange(e.criado_em || e.data_inicio, rangePrev))
  const f = funilComercial(eventosP, { comProposta: dados.comProposta, assinadoEm: dados.assinadoEm })
  const fPrev = funilComercial(eventosPrev, { comProposta: dados.comProposta, assinadoEm: dados.assinadoEm })
  const pipeline = pipelinePonderado(dados.eventos) // snapshot de todo o pipeline em aberto
  const ticketTipo = ticketMedioPorTipo(eventosP)
  const ticketMedio = f.contratos > 0 ? f.valorContratado / f.contratos : 0
  const serieLeads = serieMensal(dados.eventos, (e) => e.criado_em || e.data_inicio, () => 1, range12)

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Leads" value={formatNumber(f.leads)} delta={variacao(f.leads, fPrev.leads)} vs="ant." sub="oportunidades no período" tone="azul" />
        <KpiCard label="Propostas" value={formatNumber(f.propostas)} delta={variacao(f.propostas, fPrev.propostas)} vs="ant." sub={`conversão ${formatPercent(f.convProposta)}`} tone="roxo" />
        <KpiCard label="Contratos" value={formatNumber(f.contratos)} delta={variacao(f.contratos, fPrev.contratos)} vs="ant." sub={`fechamento ${formatPercent(f.convContrato)}`} tone="verde" />
        <KpiCard label="Conversão geral" value={formatPercent(f.convGeral)} sub={f.cicloMedioDias != null ? `ciclo médio ${f.cicloMedioDias} dias` : 'lead → contrato'} tone="gold" />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Funil comercial">
          <Funnel etapas={[
            { label: 'Leads', n: f.leads, cor: '#1a73e8' },
            { label: 'Propostas', n: f.propostas, cor: '#8b5cf6', taxa: f.convProposta },
            { label: 'Contratos', n: f.contratos, cor: '#10b981', taxa: f.convContrato },
          ]} />
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-black/[0.05] pt-4">
            <Mini label="Pipeline ponderado" value={moneyShort(pipeline)} hint="negociações em aberto × probabilidade" />
            <Mini label="Valor contratado" value={moneyShort(f.valorContratado)} hint="soma dos contratos no período" />
            <Mini label="Ticket médio contratado" value={moneyShort(ticketMedio)} />
            <Mini label="Perdidos" value={formatNumber(f.perdidos)} hint="leads descartados/perdidos" />
          </div>
        </Card>

        <Card title="Ticket médio por tipo de evento">
          {ticketTipo.length ? (
            <RankList itens={ticketTipo.map((t) => ({ label: t.chave, valor: t.media, n: t.n }))} fmt={moneyShort} cor="#8b5cf6" />
          ) : <EmptyChart h={150} msg="Sem eventos com valor no período." />}
        </Card>
      </div>

      <Card title="Novos leads por mês" action={<Legenda>últimos 12 meses</Legenda>}>
        <AreaMensal serie={serieLeads} fmt={(n) => formatNumber(Math.round(n))} color="#1a73e8" />
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FINANCEIRO — receita/despesa/lucro/margem, evolução, DRE, margem por tipo,
// inadimplência (aging das parcelas).
// ─────────────────────────────────────────────────────────────────────────────
export function Financeiro({ dados, range, rangePrev, range12, hojeYMD }: DashProps) {
  const k = caixa(dados, range), kp = caixa(dados, rangePrev)
  const margem = k.receita > 0 ? k.lucro / k.receita : 0
  const dre = dreResumido(dados.lancamentos.filter((l) => noRange(l.data, range)))
  const margemTipo = margemPorTipo(dados.lancamentos.filter((l) => noRange(l.data, range)))
  const aging = agingParcelas(dados.parcelas, hojeYMD)

  // série mensal receita/despesa (12 meses)
  const meses = mesesNoRange(range12.ini, range12.fim)
  const mapa = new Map(meses.map((m) => [m, { mes: m, receita: 0, despesa: 0 }]))
  for (const l of dados.lancamentos) {
    const m = (l.data || '').slice(0, 7); const slot = mapa.get(m); if (!slot) continue
    if (l.tipo === 'receita') slot.receita += l.valor; else if (l.tipo === 'despesa') slot.despesa += l.valor
  }
  const combo = [...mapa.values()]

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Receita" value={moneyShort(k.receita)} delta={variacao(k.receita, kp.receita)} vs="ant." tone="verde" />
        <KpiCard label="Despesas" value={moneyShort(k.despesa)} delta={variacao(k.despesa, kp.despesa)} vs="ant." invertDelta tone="vermelho" />
        <KpiCard label="Lucro líquido" value={moneyShort(k.lucro)} delta={variacao(k.lucro, kp.lucro)} vs="ant." sub={`margem ${formatPercent(margem)}`} tone="gold" />
        <KpiCard label="Inadimplência" value={formatPercent(aging.inadimplencia)} sub={`${formatNumber(aging.nAtraso)} parcela(s) vencida(s)`} tone={aging.inadimplencia > 0.1 ? 'vermelho' : 'azul'} />
      </KpiGrid>

      <Card title="Evolução de receita × despesa" action={<Legenda>últimos 12 meses</Legenda>}>
        <ComboMensal data={combo} fmt={moneyShort} />
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="DRE resumido (período)">
          <div className="space-y-2 text-sm">
            <Row k="Receita bruta" v={formatMoney(dre.receita)} cls="text-emerald-600 font-bold" />
            <div className="border-t border-black/[0.06] pt-2">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">(−) Despesas</p>
              {dre.despesas.length === 0 ? <p className="py-1 text-xs text-ink-muted">Sem despesas no período.</p> : dre.despesas.slice(0, 8).map(([cat, val]) => (
                <div key={cat} className="flex items-center justify-between py-0.5 text-xs"><span className="text-ink-muted">{cat}</span><span className="text-red-600">−{formatMoney(val)}</span></div>
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-black/[0.06] pt-2 text-xs"><span className="text-ink-muted">Total de despesas</span><span className="font-semibold text-red-600">−{formatMoney(dre.totalDespesa)}</span></div>
            <div className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2.5"><span className="font-bold text-ink">Resultado líquido</span><span className={`text-base font-bold ${dre.resultado >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(dre.resultado)} <span className="text-xs font-medium text-ink-muted">({formatPercent(dre.margem)})</span></span></div>
          </div>
        </Card>

        <Card title="Margem por tipo de evento">
          {margemTipo.length ? (
            <div className="space-y-3">
              {margemTipo.slice(0, 7).map((m) => (
                <div key={m.chave}>
                  <div className="mb-1 flex items-center justify-between text-xs"><span className="font-medium text-ink-soft">{m.chave}</span><span className={`font-bold ${m.margem >= 0.3 ? 'text-emerald-600' : m.margem >= 0 ? 'text-amber-600' : 'text-red-500'}`}>{formatPercent(m.margem)}</span></div>
                  <div className="flex items-center gap-2 text-[0.68rem] text-ink-muted"><span>{moneyShort(m.receita)} receita</span><span>·</span><span>{moneyShort(m.despesa)} custo</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, Math.round(m.margem * 100)))}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <EmptyChart h={150} msg="Classifique lançamentos por tipo de evento." />}
        </Card>
      </div>

      <Card title="Contas a receber — aging">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="A vencer" value={moneyShort(aging.aVencer)} />
          <Mini label="Vencido até 30d" value={moneyShort(aging.atraso30)} />
          <Mini label="Vencido +30d" value={moneyShort(aging.atraso30mais)} />
          <Mini label="Total a receber" value={moneyShort(aging.total)} strong />
        </div>
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERACIONAL — NPS, avaliação média, CSAT, eventos realizados, custo A&B/evento.
// ─────────────────────────────────────────────────────────────────────────────
export function Operacional({ dados, range }: DashProps) {
  const nps = calcularNps(dados.nps.filter((r: { nps?: number | null; criado_em?: string | null }) => noRange(r.criado_em, range)))
  const aval = mediaAvaliacoes(dados.avaliacoes.filter((a: { criado_em?: string | null }) => noRange(a.criado_em, range)))
  const csat = csatFeedbacks(dados.feedbacks.filter((f: { criado_em?: string | null }) => noRange(f.criado_em, range)))
  const realizados = dados.eventos.filter((e) => stageRank(e.status) === 3 && noRange(e.data_inicio, range))
  const custoAB = dados.lancamentos.filter((l) => l.tipo === 'despesa' && noRange(l.data, range) && /buffet|catering|a&b|aliment|bebida|bar/i.test(l.categoria || '')).reduce((s, l) => s + l.valor, 0)
  const custoABEvento = realizados.length ? custoAB / realizados.length : 0

  const semDados = nps.total === 0 && aval.n === 0 && csat.n === 0
  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="NPS" value={nps.total ? (nps.score > 0 ? `+${nps.score}` : String(nps.score)) : '—'} sub={`${nps.total} resposta(s)`} tone={nps.score >= 50 ? 'verde' : nps.score >= 0 ? 'gold' : 'vermelho'} />
        <KpiCard label="Avaliação média" value={aval.n ? `${aval.media.toFixed(1)} ★` : '—'} sub={`${aval.n} avaliação(ões)`} tone="gold" />
        <KpiCard label="CSAT" value={csat.n ? formatPercent(csat.satisfacao) : '—'} sub={csat.n ? `${csat.media.toFixed(1)}/5 médio` : 'pós-evento'} tone="azul" />
        <KpiCard label="Custo A&B / evento" value={realizados.length ? moneyShort(custoABEvento) : '—'} sub={`${realizados.length} evento(s) realizado(s)`} tone="roxo" />
      </KpiGrid>

      {semDados ? (
        <Card><EmptyChart h={160} msg="Sem respostas de NPS, avaliações ou feedbacks no período. Os indicadores de satisfação aparecem conforme as pesquisas e avaliações chegam." /></Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Net Promoter Score">
            <NpsGauge score={nps.score} />
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Pill label="Detratores" n={nps.detratores} cor="text-red-600 bg-red-50" />
              <Pill label="Neutros" n={nps.neutros} cor="text-amber-600 bg-amber-50" />
              <Pill label="Promotores" n={nps.promotores} cor="text-emerald-600 bg-emerald-50" />
            </div>
          </Card>
          <Card title="Satisfação & qualidade">
            <div className="space-y-4">
              <Barra label="Avaliação pública (★)" value={aval.media} max={5} fmt={(v) => `${v.toFixed(1)} / 5`} cor="#f59e0b" />
              <Barra label="CSAT pós-evento (★)" value={csat.media} max={5} fmt={(v) => `${v.toFixed(1)} / 5`} cor="#1a73e8" />
              <Barra label="Promotores" value={nps.total ? nps.promotores / nps.total : 0} max={1} fmt={(v) => formatPercent(v)} cor="#10b981" />
            </div>
            <p className="mt-4 border-t border-black/[0.05] pt-3 text-xs text-ink-muted">Avaliações vêm de <strong>/painel/avaliacoes</strong>; CSAT de <strong>/painel/feedbacks</strong>; NPS de <strong>/painel/pesquisas</strong>.</p>
          </Card>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CLIENTES — distintos, recorrência, origem (canal), top por valor.
// ─────────────────────────────────────────────────────────────────────────────
export function Clientes({ dados, range, range12 }: DashProps) {
  const eventosP = dados.eventos.filter((e) => noRange(e.criado_em || e.data_inicio, range))
  const c = clientesResumo(eventosP)
  const ticketCliente = c.distintos ? eventosP.reduce((s, e) => s + (Number(e.valor_total_num) || 0), 0) / c.distintos : 0
  const serieNovos = serieMensal(dados.eventos, (e) => e.criado_em || e.data_inicio, () => 1, range12)

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Clientes" value={formatNumber(c.distintos)} sub="distintos no período" tone="azul" />
        <KpiCard label="Recorrentes" value={formatNumber(c.recorrentes)} sub={`${formatPercent(c.taxaRecorrencia)} de recorrência`} tone="verde" />
        <KpiCard label="Ticket por cliente" value={moneyShort(ticketCliente)} sub="receita média/cliente" tone="gold" />
        <KpiCard label="Canais de origem" value={formatNumber(c.porOrigem.length)} sub="fontes de captação" tone="roxo" />
      </KpiGrid>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Top clientes por valor">
          <RankList itens={c.topClientes.map((t) => ({ label: t.chave, valor: t.soma, n: t.n }))} fmt={moneyShort} cor="#10b981" />
        </Card>
        <Card title="Origem dos clientes (canal)">
          {c.porOrigem.length ? <Donut data={c.porOrigem.map((o) => [o.chave, o.n] as [string, number])} fmt={(v) => formatNumber(v)} /> : <EmptyChart h={160} msg="Registre 'como conheceu' nos eventos para ver os canais." />}
        </Card>
      </div>

      <Card title="Novos clientes / eventos por mês" action={<Legenda>últimos 12 meses</Legenda>}>
        <AreaMensal serie={serieNovos} fmt={(n) => formatNumber(Math.round(n))} color="#8b5cf6" />
      </Card>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// OCUPAÇÃO — taxa de ocupação, RevPAS, receita por m², receita por evento, mapa
// de calor mensal e ocupação por espaço. Indicadores próprios do nicho.
// ─────────────────────────────────────────────────────────────────────────────
export function Ocupacao({ dados, range, range12 }: DashProps) {
  const { blocos, nEspacos, areaTotal } = blocosOcupacao(dados, null)
  const oc = calcularOcupacao(blocos, nEspacos, range)
  const dias = Math.max(1, oc.spaceDaysDisponiveis / Math.max(1, nEspacos))
  const receita = caixa(dados, range).receita
  const eventosNoPeriodo = dados.eventos.filter((e) => stageRank(e.status) >= 2 && noRange(e.data_inicio, range)).length
  const rPas = revpas(receita, nEspacos, dias)
  const rM2 = receitaPorM2(receita, areaTotal)
  const rEvento = receitaPorEvento(receita, eventosNoPeriodo)

  // mapa de calor: ocupação por mês (12 meses)
  const heat = mesesNoRange(range12.ini, range12.fim).map((m) => (
    { mes: m, taxa: calcularOcupacao(blocos, nEspacos, { ini: `${m}-01`, fim: fimDoMes(m) }).taxa }
  ))

  // ocupação por espaço (top)
  const porEspaco = Object.entries(oc.porEspaco)
    .map(([k, v]) => ({ label: rotuloEspaco(dados, k), valor: dias > 0 ? v / dias : 0, n: v }))
    .sort((a, b) => b.valor - a.valor).slice(0, 8)

  return (
    <div className="space-y-5">
      <KpiGrid>
        <KpiCard label="Taxa de ocupação" value={formatPercent(oc.taxa)} sub={`${formatNumber(oc.diasOcupados)} de ${formatNumber(oc.spaceDaysDisponiveis)} space-days`} tone={oc.taxa >= 0.5 ? 'verde' : oc.taxa >= 0.25 ? 'gold' : 'vermelho'} hint="space-days ocupados ÷ disponíveis" />
        <KpiCard label="RevPAS" value={moneyShort(rPas)} sub={`${nEspacos} espaço(s) × ${Math.round(dias)} dias`} tone="azul" hint="Revenue per Available Space-day = receita ÷ (espaços × dias)" />
        <KpiCard label="Receita por m²" value={rM2 != null ? moneyShort(rM2) : '—'} sub={areaTotal > 0 ? `${formatNumber(areaTotal)} m² cadastrados` : 'cadastre a área dos espaços'} tone="roxo" />
        <KpiCard label="Receita por evento" value={moneyShort(rEvento)} sub={`${eventosNoPeriodo} evento(s) no período`} tone="gold" />
      </KpiGrid>

      <Card title="Mapa de ocupação mensal" action={<Legenda>% de space-days ocupados · 12 meses</Legenda>}>
        {heat.some((h) => h.taxa > 0) ? <OcupacaoHeatmap data={heat} /> : <EmptyChart h={80} msg="Confirme reservas (ou contrate eventos) para medir a ocupação dos espaços." />}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Ocupação por espaço">
          {porEspaco.length ? <RankList itens={porEspaco} fmt={(v) => formatPercent(v)} cor="#10b981" /> : <EmptyChart h={150} msg="Sem ocupação registrada no período." />}
        </Card>
        <Card title="Disponibilidade do período">
          <div className="space-y-3 text-sm">
            <Row k="Espaços considerados" v={formatNumber(nEspacos)} />
            <Row k="Dias no período" v={formatNumber(Math.round(dias))} />
            <Row k="Space-days disponíveis" v={formatNumber(oc.spaceDaysDisponiveis)} />
            <Row k="Space-days ocupados" v={formatNumber(oc.diasOcupados)} cls="text-emerald-600 font-bold" />
            <Row k="Área total cadastrada" v={areaTotal > 0 ? `${formatNumber(areaTotal)} m²` : '—'} />
            <div className="rounded-xl bg-black/[0.02] px-3 py-2.5 text-xs text-ink-muted">A ocupação considera reservas confirmadas/bloqueios (e, sem espaços cadastrados, eventos contratados). Cadastre seus espaços em <strong>/painel/reservas</strong> para granularidade por espaço e área.</div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// ── Registry dos dashboards (ordem do seletor) ───────────────────────────────
export type DashKey = 'comercial' | 'financeiro' | 'operacional' | 'clientes' | 'ocupacao'
export const DASHBOARDS: { key: DashKey; label: string; Comp: (p: DashProps) => ReactNode }[] = [
  { key: 'comercial', label: 'Comercial', Comp: Comercial },
  { key: 'financeiro', label: 'Financeiro', Comp: Financeiro },
  { key: 'operacional', label: 'Operacional', Comp: Operacional },
  { key: 'clientes', label: 'Clientes', Comp: Clientes },
  { key: 'ocupacao', label: 'Ocupação', Comp: Ocupacao },
]

// ── Sub-componentes locais ───────────────────────────────────────────────────
function KpiGrid({ children }: { children: ReactNode }) { return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div> }
function Legenda({ children }: { children: ReactNode }) { return <span className="text-xs text-ink-muted">{children}</span> }
function Mini({ label, value, hint, strong }: { label: string; value: string; hint?: string; strong?: boolean }) {
  return <div className="rounded-xl bg-black/[0.02] p-3" title={hint}><div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">{label}</div><div className={`mt-1 font-bold ${strong ? 'text-lg text-emerald-600' : 'text-base text-ink'}`}>{value}</div></div>
}
function Row({ k, v, cls = '' }: { k: string; v: string; cls?: string }) {
  return <div className="flex items-center justify-between py-1"><span className="text-ink-soft">{k}</span><span className={cls || 'font-semibold text-ink'}>{v}</span></div>
}
function Pill({ label, n, cor }: { label: string; n: number; cor: string }) {
  return <div className={`rounded-lg px-2 py-1.5 ${cor}`}><div className="text-base font-bold">{formatNumber(n)}</div><div className="text-[0.6rem] uppercase tracking-wide opacity-80">{label}</div></div>
}
function Barra({ label, value, max, fmt, cor }: { label: string; value: number; max: number; fmt: (v: number) => string; cor: string }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  return <div><div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-soft">{label}</span><span className="font-semibold text-ink-muted">{fmt(value)}</span></div><div className="h-2.5 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cor }} /></div></div>
}

// helpers locais de data p/ o heatmap
function fimDoMes(yyyymm: string): string {
  const d = new Date(`${yyyymm}-01T12:00:00`)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
}
function rotuloEspaco(d: DadosBI, key: string): string {
  if (key.startsWith('esp:')) { const id = Number(key.slice(4)); return d.espacos.find((e) => e.id === id)?.nome || `Espaço #${id}` }
  if (key.startsWith('prop:')) { const id = Number(key.slice(5)); return nomeProp(d, id) }
  return key
}

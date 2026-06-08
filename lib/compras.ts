// Motor puro do módulo Compras (/painel/compras) — sem Supabase, sem React, sem
// formatação ("R$"/data ficam em lib/format). Concentra as regras do fluxo
// requisição → cotação → pedido → recebimento que valem a pena testar:
//   • alçada de aprovação (limite de valor)
//   • valor estimado da requisição (soma dos itens)
//   • mapa comparativo de cotações (melhor preço por item + recomendação)
//   • economia obtida (estimado × comprado)
//   • lead time (dias entre pedido e recebimento)
//   • status do pedido a partir das quantidades recebidas
// Reutilizado pela página e coberto por __tests__/lib/compras.test.ts.

// ── Alçada de aprovação ───────────────────────────────────────────────────────
// `limite <= 0` (ou nulo) significa "sem alçada definida" → nada é bloqueado.
// Acima do limite a requisição exige aprovação de alçada superior.
export function precisaAlcada(valor: number, limite: number | null | undefined): boolean {
  const lim = Number(limite) || 0;
  if (lim <= 0) return false;
  return (Number(valor) || 0) > lim;
}

// ── Valor estimado de uma requisição (Σ quantidade × valor_estimado_num) ──────
export type ItemEstimavel = { quantidade: number; valor_estimado_num?: number | null };
export function valorEstimado(itens: ItemEstimavel[]): number {
  return itens.reduce((s, it) => s + (Number(it.quantidade) || 0) * (Number(it.valor_estimado_num) || 0), 0);
}

// ── Mapa comparativo de cotações (item × fornecedor) ──────────────────────────
export type ReqItemRef = { id: string; descricao: string; quantidade: number; valor_estimado_num?: number | null };
export type CotacaoItemRef = {
  requisicao_item_id: string | null;
  valor_unit_num: number;
  prazo_dias?: number | null;
  disponivel?: boolean;
};
export type CotacaoRef = {
  id: string;
  rotulo: string;                 // fornecedor (nome) — só p/ exibição
  valor_total_num?: number | null; // total "cheio" quando não há detalhamento por item
  prazo_dias?: number | null;
  itens: CotacaoItemRef[];
};

export type CompCelula = {
  cotacaoId: string;
  valorUnit: number | null;       // null = fornecedor não cotou/indisponível
  total: number | null;           // valorUnit × quantidade do item
  disponivel: boolean;
  melhor: boolean;                // menor total da linha
};
export type CompLinha = { item: ReqItemRef; celulas: CompCelula[]; melhorCotacaoId: string | null };
export type CompTotal = {
  cotacaoId: string;
  total: number;                  // Σ itens cotados (ou valor_total_num se sem detalhamento)
  prazo: number | null;
  itensCotados: number;
  completa: boolean;              // cobre todos os itens da requisição
  detalhada: boolean;            // tem preço por item (vs. total cheio)
};
export type Comparativo = { linhas: CompLinha[]; totais: CompTotal[]; recomendadaId: string | null };

// Constrói o comparativo: melhor preço por item destacado + cotação recomendada
// (menor total entre as completas; desempate pelo menor prazo). Suporta cotações
// detalhadas por item OU com apenas um total cheio.
export function montarComparativo(itens: ReqItemRef[], cotacoes: CotacaoRef[]): Comparativo {
  // índice rápido: cotacaoId → (requisicao_item_id → item da cotação)
  const porCotacao = new Map<string, Map<string, CotacaoItemRef>>();
  for (const c of cotacoes) {
    const m = new Map<string, CotacaoItemRef>();
    for (const ci of c.itens) {
      if (ci.requisicao_item_id && !m.has(ci.requisicao_item_id)) m.set(ci.requisicao_item_id, ci);
    }
    porCotacao.set(c.id, m);
  }

  const linhas: CompLinha[] = itens.map((item) => {
    const qtd = Number(item.quantidade) || 0;
    const celulas: CompCelula[] = cotacoes.map((c) => {
      const ci = porCotacao.get(c.id)?.get(item.id);
      const disponivel = !!ci && ci.disponivel !== false;
      const valorUnit = disponivel ? Number(ci!.valor_unit_num) || 0 : null;
      const total = valorUnit != null ? valorUnit * qtd : null;
      return { cotacaoId: c.id, valorUnit, total, disponivel, melhor: false };
    });
    // melhor = menor total não-nulo da linha
    let melhorCotacaoId: string | null = null;
    let menor = Infinity;
    for (const cel of celulas) {
      if (cel.total != null && cel.total < menor) { menor = cel.total; melhorCotacaoId = cel.cotacaoId; }
    }
    if (melhorCotacaoId) {
      for (const cel of celulas) if (cel.cotacaoId === melhorCotacaoId && cel.total === menor) { cel.melhor = true; break; }
    }
    return { item, celulas, melhorCotacaoId };
  });

  const nItens = itens.length;
  const totais: CompTotal[] = cotacoes.map((c) => {
    const m = porCotacao.get(c.id)!;
    let soma = 0, cotados = 0;
    for (const item of itens) {
      const ci = m.get(item.id);
      if (ci && ci.disponivel !== false) { soma += (Number(ci.valor_unit_num) || 0) * (Number(item.quantidade) || 0); cotados++; }
    }
    const detalhada = c.itens.length > 0;
    const total = detalhada ? soma : (Number(c.valor_total_num) || 0);
    const completa = detalhada ? (nItens > 0 && cotados === nItens) : (Number(c.valor_total_num) || 0) > 0;
    return { cotacaoId: c.id, total, prazo: c.prazo_dias ?? null, itensCotados: cotados, completa, detalhada };
  });

  // recomendada: menor total entre as completas com total > 0; desempate por prazo.
  let recomendadaId: string | null = null;
  let melhorTotal = Infinity, melhorPrazo = Infinity;
  for (const t of totais) {
    if (!t.completa || t.total <= 0) continue;
    const prazo = t.prazo ?? Infinity;
    if (t.total < melhorTotal || (t.total === melhorTotal && prazo < melhorPrazo)) {
      melhorTotal = t.total; melhorPrazo = prazo; recomendadaId = t.cotacaoId;
    }
  }
  return { linhas, totais, recomendadaId };
}

// ── Economia (estimado × comprado) ────────────────────────────────────────────
// valor positivo = economia; negativo = estouro de orçamento.
export type Economia = { valor: number; pct: number };
export function calcularEconomia(estimado: number, comprado: number): Economia {
  const est = Number(estimado) || 0;
  const com = Number(comprado) || 0;
  const valor = est - com;
  return { valor, pct: est > 0 ? valor / est : 0 };
}

// ── Lead time (dias) ──────────────────────────────────────────────────────────
// Diferença em dias inteiros entre duas datas 'YYYY-MM-DD' (ou ISO). Ancorado ao
// meio-dia para evitar off-by-one por fuso. null se alguma data for inválida.
export function leadTimeDias(inicio: string | null | undefined, fim: string | null | undefined): number | null {
  if (!inicio || !fim) return null;
  const a = parseDia(inicio), b = parseDia(fim);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86400000);
}
export function mediaLeadTime(pares: { inicio: string | null; fim: string | null }[]): number | null {
  const dias = pares.map((p) => leadTimeDias(p.inicio, p.fim)).filter((d): d is number => d != null && d >= 0);
  if (!dias.length) return null;
  return Math.round(dias.reduce((s, d) => s + d, 0) / dias.length);
}
function parseDia(v: string): number | null {
  const s = /^\d{4}-\d{2}-\d{2}$/.test(v) ? v + 'T12:00:00' : v;
  const t = new Date(s).getTime();
  return Number.isNaN(t) ? null : t;
}

// ── Status do pedido a partir das quantidades recebidas ───────────────────────
export type ItemRecebivel = { quantidade: number; quantidade_recebida?: number | null };
export function statusPedidoPorItens(itens: ItemRecebivel[]): 'emitido' | 'parcial' | 'recebido' {
  if (!itens.length) return 'emitido';
  let algumRecebido = false, tudoRecebido = true;
  for (const it of itens) {
    const ped = Number(it.quantidade) || 0;
    const rec = Number(it.quantidade_recebida) || 0;
    if (rec > 0.0001) algumRecebido = true;
    if (rec + 0.0001 < ped) tudoRecebido = false;
  }
  if (tudoRecebido) return 'recebido';
  return algumRecebido ? 'parcial' : 'emitido';
}

// Quantidade ainda pendente de recebimento (não-negativa).
export function saldoAReceber(quantidade: number, recebida: number | null | undefined): number {
  return Math.max(0, (Number(quantidade) || 0) - (Number(recebida) || 0));
}

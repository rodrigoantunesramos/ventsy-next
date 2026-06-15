'use client';

// Equipamentos & Locação de itens — /painel/equipamentos.
// Itens ALOCADOS/LOCADOS por evento (mesa, cadeira, toalha, tenda, palco, som,
// gerador, banheiro químico…). Diferente de Ativos (patrimônio) e Estoque
// (consumível): aqui importa a QUANTIDADE DISPONÍVEL POR DATA e a RESERVA POR
// EVENTO (sai e volta). Próprio ou sublocado de fornecedor.
// PILARES (3 abas):
//   • Inventário     — itens locáveis, disponível por período, próprio×sublocado,
//                      KPIs, distribuição por categoria, itens mais rentáveis.
//   • Disponibilidade— timeline diária de uso por item (superalocação em vermelho)
//                      + verificador rápido (qtd × período → disponível/faltam).
//   • Romaneio       — monta a lista de itens de um evento, separação (picking),
//                      saída, devolução (com avaria) e custo×receita do evento.
// Disponibilidade/superalocação: lib/equipamentos.ts (pura) + /api/equipamentos
// (autoritativo). Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber, formatDate, formatDateRange } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Equipamento, type Alocacao, type EquipCategoria,
  CATEGORIAS_EQUIP, catEquipLabel, catEquipCor, alocStatusMeta,
  disponibilidade, checarDisponibilidade, serieDiaria, unidadesFora,
  custoSublocacao, receitaLocacao, margemLocacao, alocacaoEncerrada,
  startOfDayLocal, ymd, addDaysYmd, DIA,
} from '@/lib/equipamentos';
import {
  type EventoLite, type FornecedorLite, type LinhaInventario,
  eventoLabel, fornecedorLabel, iniciais, exportEquipamentosCSV,
} from './_lib';

// ── Constantes ────────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const PAGE_SIZE = 20;
type Tab = 'inventario' | 'disponibilidade' | 'romaneio';
type AddAlocState = { equipId?: string; eventoId?: string; inicio?: string; fim?: string } | null;

function isMissingTable(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  return err.code === '42P01' || err.code === 'PGRST205'
    || /could not find the table|schema cache|does not exist/i.test(err.message || '');
}
function num(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
// Datas só-dia → faixa ISO (início 00:00, fim 23:59 do dia escolhido — inclusivo).
function diaInicioISO(d: string): string { return `${d}T00:00:00`; }
function diaFimISO(d: string): string { return `${d}T23:59:00`; }

// ── Página ────────────────────────────────────────────────────────────────────
export default function EquipamentosPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('inventario');

  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);

  const hoje = useMemo(() => ymd(new Date()), []);
  // período de referência do inventário (disponível por data)
  const [pInicio, setPInicio] = useState(hoje);
  const [pFim, setPFim] = useState(addDaysYmd(hoje, 30));

  // filtros do inventário
  const [busca, setBusca] = useState('');
  const [fCat, setFCat] = useState('');
  const [fOrigem, setFOrigem] = useState<'' | 'proprio' | 'sublocado'>('');
  const [fDisp, setFDisp] = useState(false);     // só com disponibilidade no período
  const [fInativos, setFInativos] = useState(false);
  const [page, setPage] = useState(0);

  // modais
  const [itemEditor, setItemEditor] = useState<{ editing: Equipamento | null } | null>(null);
  const [addAloc, setAddAloc] = useState<AddAlocState>(null);
  const [devolver, setDevolver] = useState<Alocacao | null>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);

  // romaneio
  const [eventoSel, setEventoSel] = useState<string>('');

  // timeline (disponibilidade)
  const [tInicio, setTInicio] = useState(hoje);
  const [tDias, setTDias] = useState(14);

  const carregar = useCallback(async (uid: string) => {
    const eqRes = await sb.from('equipamentos').select('*').eq('usuario_id', uid).order('nome');
    if (isMissingTable(eqRes.error)) { setNeedsSetup(true); setEquipamentos([]); return; }
    setNeedsSetup(false);
    setEquipamentos(((eqRes.data || []) as Equipamento[]).map((e) => ({
      ...e,
      quantidade_total: num(e.quantidade_total),
      custo_locacao_num: num(e.custo_locacao_num),
      preco_locacao_num: num(e.preco_locacao_num),
      proprio: e.proprio !== false,
      ativo: e.ativo !== false,
    })));
    const [alRes, evRes, foRes] = await Promise.all([
      sb.from('equipamentos_alocacao').select('*').eq('usuario_id', uid),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,valor_total_num,propriedade_id').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('fornecedores').select('id,nome,fantasia,categoria').eq('usuario_id', uid).order('nome'),
    ]);
    setAlocacoes(alRes.error ? [] : ((alRes.data || []) as Alocacao[]).map((a) => ({
      ...a, quantidade: num(a.quantidade), qtd_avaria: num(a.qtd_avaria),
      custo_unit_num: num(a.custo_unit_num), preco_unit_num: num(a.preco_unit_num),
    })));
    setEventos(evRes.error ? [] : (evRes.data || []) as EventoLite[]);
    setFornecedores(foRes.error ? [] : (foRes.data || []) as FornecedorLite[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  useEffect(() => { setPage(0); }, [busca, fCat, fOrigem, fDisp, fInativos, pInicio, pFim]);

  const refetch = useCallback(() => { if (userId) carregar(userId); }, [userId, carregar]);

  // ── Janela de período (ms) ──
  const fromMs = useMemo(() => startOfDayLocal(pInicio), [pInicio]);
  const toMs = useMemo(() => startOfDayLocal(pFim) + DIA, [pFim]);

  // mapa de alocações por evento (romaneio) e por item
  const alocPorEvento = useMemo(() => {
    const m = new Map<string, Alocacao[]>();
    for (const a of alocacoes) { if (!a.evento_id) continue; const arr = m.get(a.evento_id) || []; arr.push(a); m.set(a.evento_id, arr); }
    return m;
  }, [alocacoes]);
  const equipById = useMemo(() => new Map(equipamentos.map((e) => [e.id, e])), [equipamentos]);
  const fornById = useMemo(() => new Map(fornecedores.map((f) => [f.id, f])), [fornecedores]);

  // ── Linhas do inventário (item + disponibilidade no período) ──
  const linhas = useMemo<LinhaInventario[]>(() => equipamentos.map((e) => {
    const doItem = alocacoes.filter((a) => a.equipamento_id === e.id);
    return {
      e,
      disp: disponibilidade(e, alocacoes, fromMs, toMs),
      reservadas: unidadesFora(doItem),
      receita: receitaLocacao(doItem),
      custo: custoSublocacao(doItem),
    };
  }), [equipamentos, alocacoes, fromMs, toMs]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const pecas = equipamentos.reduce((s, e) => s + num(e.quantidade_total), 0);
    return {
      itens: equipamentos.length,
      pecas,
      proprios: equipamentos.filter((e) => e.proprio).length,
      sublocados: equipamentos.filter((e) => !e.proprio).length,
      fora: unidadesFora(alocacoes),
      superalocados: linhas.filter((l) => l.disp.disponivel < 0).length,
      receita: receitaLocacao(alocacoes),
    };
  }, [equipamentos, alocacoes, linhas]);

  // ── Distribuição por categoria ──
  const catDist = useMemo(() => {
    const m = new Map<string, number>();
    equipamentos.forEach((e) => m.set(e.categoria, (m.get(e.categoria) || 0) + 1));
    return [...m.entries()].map(([v, n]) => ({ v, label: catEquipLabel(v), cor: catEquipCor(v), n })).sort((a, b) => b.n - a.n);
  }, [equipamentos]);

  // ── Itens mais rentáveis (receita de locação acumulada) ──
  const rentaveis = useMemo(() =>
    [...linhas].filter((l) => l.receita > 0).sort((a, b) => b.receita - a.receita).slice(0, 6),
  [linhas]);

  // ── Lista filtrada/paginada ──
  const filtradas = useMemo(() => {
    let arr = linhas;
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter(({ e }) => `${e.nome} ${e.sku || ''} ${e.descricao || ''}`.toLowerCase().includes(q));
    if (fCat) arr = arr.filter(({ e }) => e.categoria === fCat);
    if (fOrigem) arr = arr.filter(({ e }) => (fOrigem === 'proprio' ? e.proprio : !e.proprio));
    if (fDisp) arr = arr.filter(({ disp }) => disp.disponivel > 0);
    if (!fInativos) arr = arr.filter(({ e }) => e.ativo);
    return [...arr].sort((a, b) => a.e.nome.localeCompare(b.e.nome));
  }, [linhas, busca, fCat, fOrigem, fDisp, fInativos]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageItems = filtradas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const temFiltro = !!(busca || fCat || fOrigem || fDisp || fInativos);

  // ── Ações de alocação (via API autoritativa) ──
  async function patchAloc(body: Record<string, unknown>): Promise<boolean> {
    const res = await fetch('/api/equipamentos', { method: 'PATCH', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 409) toast.error(`Superalocação: só há ${json.disponivel ?? 0} disponível(is) — faltam ${json.faltam ?? 0}.`);
      else toast.error(json.error || 'Não foi possível atualizar a alocação.');
      return false;
    }
    return true;
  }
  async function mudarStatus(a: Alocacao, to: string) {
    if (await patchAloc({ id: a.id, status: to })) { toast.success(`Marcado como ${alocStatusMeta(to).label.toLowerCase()}.`); refetch(); }
  }
  async function confirmarDevolucao(a: Alocacao, qtdAvaria: number) {
    const ok = await patchAloc({ id: a.id, status: qtdAvaria > 0 ? 'avariado' : 'devolvido', qtd_avaria: qtdAvaria });
    if (ok) {
      setDevolver(null);
      toast.success(qtdAvaria > 0 ? `Devolvido com ${qtdAvaria} avaria(s) — registre a manutenção.` : 'Item devolvido.');
      refetch();
    }
  }
  async function cancelarAloc(a: Alocacao) {
    const key = `can:${a.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para cancelar a alocação.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const res = await fetch(`/api/equipamentos?id=${a.id}`, { method: 'DELETE', headers: await authHeaders() });
    if (!res.ok) { toast.error('Não foi possível cancelar.'); return; }
    toast.success('Alocação cancelada.'); refetch();
  }

  // ── Item (equipamento) CRUD via RLS ──
  async function toggleAtivo(e: Equipamento) {
    const { error } = await sb.from('equipamentos').update({ ativo: !e.ativo }).eq('id', e.id);
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    setEquipamentos((arr) => arr.map((x) => (x.id === e.id ? { ...x, ativo: !x.ativo } : x)));
  }
  async function removerItem(e: Equipamento) {
    const temAloc = alocacoes.some((a) => a.equipamento_id === e.id);
    if (temAloc) { toast.error('Há alocações vinculadas. Desative o item em vez de excluir.'); return; }
    const key = `del:${e.id}`;
    if (confirmKey !== key) { setConfirmKey(key); toast.info('Clique novamente para excluir o item.'); setTimeout(() => setConfirmKey((c) => (c === key ? null : c)), 3000); return; }
    setConfirmKey(null);
    const { error } = await sb.from('equipamentos').delete().eq('id', e.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Item removido.'); refetch();
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[260px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const itensAtivos = equipamentos.filter((e) => e.ativo);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Equipamentos & Locação</h1>
          <p className="mt-1 text-sm text-ink-muted">Mesas, cadeiras, tendas, som, palco e mais — disponibilidade por data e reserva por evento.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {filtradas.length > 0 && <button onClick={() => exportEquipamentosCSV(filtradas)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2.5 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
          <button onClick={() => setItemEditor({ editing: null })} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Novo item</button>
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O módulo de equipamentos ainda não foi ativado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/equipamentos.sql</code> no Supabase para criar as tabelas <code className="rounded bg-amber-100 px-1 py-0.5">equipamentos</code> e <code className="rounded bg-amber-100 px-1 py-0.5">equipamentos_alocacao</code>.
        </div>
      )}

      {!needsSetup && equipamentos.length === 0 ? (
        <EmptyEquipamentos onNovo={() => setItemEditor({ editing: null })} />
      ) : !needsSetup && (
        <>
          {/* Tabs */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {([['inventario', 'Inventário'], ['disponibilidade', 'Disponibilidade'], ['romaneio', 'Romaneio do evento']] as [Tab, string][]).map(([k, lab]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}>{lab}</button>
            ))}
          </div>

          {/* ───────────────────────── INVENTÁRIO ───────────────────────── */}
          {tab === 'inventario' && (
            <div className="mt-5 space-y-5">
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
                <Kpi label="Itens locáveis" value={formatNumber(kpis.itens)} sub={`${formatNumber(kpis.pecas)} peças`} tone="ink" icon={<IcoBox />} />
                <Kpi label="Próprios" value={formatNumber(kpis.proprios)} sub={`${kpis.sublocados} sublocados`} tone="brand" icon={<IcoTag />} />
                <Kpi label="Unidades fora" value={formatNumber(kpis.fora)} sub="alocadas agora" tone="azul" icon={<IcoTruck />} />
                <Kpi label="Categorias" value={formatNumber(catDist.length)} tone="verde" icon={<IcoGrid />} />
                <Kpi label="Superalocados" value={formatNumber(kpis.superalocados)} sub="no período" tone={kpis.superalocados ? 'vermelho' : 'ink'} icon={<IcoAlert />} />
                <Kpi label="Receita de locação" value={formatMoneyShort(kpis.receita)} sub="acumulada" tone="gold" icon={<IcoWallet />} />
              </div>

              {/* Categorias + Mais rentáveis */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-4 text-base font-bold text-ink">Por categoria</h3>
                  {catDist.length === 0 ? <div className="flex h-[180px] items-center justify-center text-center"><p className="text-sm text-ink-muted">Cadastre itens para ver a distribuição.</p></div>
                    : <Donut data={catDist.map((c) => ({ label: c.label, value: c.n, cor: c.cor }))} />}
                </div>
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="text-base font-bold text-ink">Itens mais rentáveis</h3>
                  <p className="mb-4 text-xs text-ink-muted">Maior receita de locação acumulada — itens com <code className="rounded bg-black/[0.04] px-1">preço</code> entram no orçamento da proposta.</p>
                  {rentaveis.length === 0 ? <p className="py-10 text-center text-sm text-ink-muted">Defina o preço de locação e aloque itens a eventos para ver o ranking.</p>
                    : (
                      <div className="space-y-2">
                        {rentaveis.map((l, i) => (
                          <button key={l.e.id} onClick={() => setItemEditor({ editing: l.e })} className="flex w-full items-center gap-3 rounded-xl border border-black/[0.06] p-2.5 text-left transition hover:border-brand/30 hover:bg-brand-50/30">
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-black/[0.05] text-ink-muted'}`}>{i + 1}</span>
                            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-ink">{l.e.nome}</p><p className="text-xs text-ink-muted">{catEquipLabel(l.e.categoria)} · margem {formatMoneyShort(margemLocacao(alocacoes.filter((a) => a.equipamento_id === l.e.id)))}</p></div>
                            <span className="shrink-0 text-right text-sm font-bold text-ink">{formatMoney(l.receita)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              </div>

              {/* Período de referência */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Disponível no período</span>
                    <div className="flex items-center gap-2">
                      <input type="date" value={pInicio} max={pFim} onChange={(e) => setPInicio(e.target.value)} className={selCls} />
                      <span className="text-ink-muted">→</span>
                      <input type="date" value={pFim} min={pInicio} onChange={(e) => setPFim(e.target.value)} className={selCls} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Chip onClick={() => { setPInicio(hoje); setPFim(addDaysYmd(hoje, 7)); }}>7 dias</Chip>
                    <Chip onClick={() => { setPInicio(hoje); setPFim(addDaysYmd(hoje, 30)); }}>30 dias</Chip>
                  </div>
                  {eventos.length > 0 && (
                    <select className={`${selCls} ml-auto`} value="" onChange={(e) => { const ev = eventos.find((x) => x.id === e.target.value); if (ev?.data_inicio) { setPInicio(ev.data_inicio.slice(0, 10)); setPFim((ev.data_fim || ev.data_inicio).slice(0, 10)); } }}>
                      <option value="">Usar datas de um evento…</option>
                      {eventos.filter((ev) => ev.data_inicio).map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)} · {formatDate(ev.data_inicio, { style: 'short' })}</option>)}
                    </select>
                  )}
                </div>
              </div>

              {/* Filtros + tabela */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar item, código…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                  <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={selCls}>
                    <option value="">Categoria</option>
                    {CATEGORIAS_EQUIP.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
                  </select>
                  <select value={fOrigem} onChange={(e) => setFOrigem(e.target.value as '' | 'proprio' | 'sublocado')} className={selCls}>
                    <option value="">Origem</option>
                    <option value="proprio">Próprio</option>
                    <option value="sublocado">Sublocado</option>
                  </select>
                  <button onClick={() => setFDisp((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${fDisp ? 'bg-emerald-600 text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Só disponíveis</button>
                  <button onClick={() => setFInativos((v) => !v)} className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${fInativos ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>Incluir inativos</button>
                </div>

                {filtradas.length === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-muted">{temFiltro ? 'Nenhum item corresponde aos filtros.' : 'Nenhum item locável ativo.'}</p>
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                            <th className="pb-2 font-semibold">Item</th>
                            <th className="pb-2 font-semibold">Categoria</th>
                            <th className="pb-2 font-semibold">Origem</th>
                            <th className="pb-2 text-right font-semibold">Total</th>
                            <th className="pb-2 text-right font-semibold">Alocado</th>
                            <th className="pb-2 text-right font-semibold">Disponível</th>
                            <th className="pb-2 text-right font-semibold">Preço/un</th>
                            <th className="w-24 pb-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map(({ e, disp }) => (
                            <tr key={e.id} className="group border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                              <td className="py-2.5">
                                <button onClick={() => setItemEditor({ editing: e })} className="flex items-center gap-2.5 text-left">
                                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ background: catEquipCor(e.categoria) }}>{iniciais(e.nome)}</span>
                                  <span className="min-w-0">
                                    <span className="flex items-center gap-1.5"><span className="truncate font-semibold text-ink">{e.nome}</span>{!e.ativo && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">inativo</span>}</span>
                                    {e.sku && <span className="block truncate text-xs text-ink-muted">{e.sku}</span>}
                                  </span>
                                </button>
                              </td>
                              <td className="py-2.5"><span className="inline-flex items-center gap-1.5 text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: catEquipCor(e.categoria) }} />{catEquipLabel(e.categoria)}</span></td>
                              <td className="py-2.5 text-ink-muted">{e.proprio ? 'Próprio' : <span title={fornecedorLabel(fornById.get(e.fornecedor_id || ''))}>Sublocado{e.fornecedor_id && fornById.get(e.fornecedor_id) ? ` · ${fornecedorLabel(fornById.get(e.fornecedor_id))}` : ''}</span>}</td>
                              <td className="py-2.5 text-right text-ink-soft">{formatNumber(disp.total)}</td>
                              <td className="py-2.5 text-right text-ink-muted">{formatNumber(disp.alocadoPico)}</td>
                              <td className="py-2.5 text-right"><Semaforo disp={disp.disponivel} /></td>
                              <td className="py-2.5 text-right text-ink-soft">{e.preco_locacao_num > 0 ? formatMoney(e.preco_locacao_num) : '—'}</td>
                              <td className="py-2.5 pl-2 text-right">
                                <button onClick={() => setAddAloc({ equipId: e.id, inicio: pInicio, fim: pFim })} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft opacity-0 transition hover:border-brand hover:text-brand group-hover:opacity-100">+ Alocar</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile */}
                    <div className="space-y-2.5 md:hidden">
                      {pageItems.map(({ e, disp }) => (
                        <div key={e.id} className="rounded-xl border border-black/[0.06] p-3">
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ background: catEquipCor(e.categoria) }}>{iniciais(e.nome)}</span>
                            <div className="min-w-0 flex-1">
                              <button onClick={() => setItemEditor({ editing: e })} className="truncate font-semibold text-ink">{e.nome}</button>
                              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted"><span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: catEquipCor(e.categoria) }} />{catEquipLabel(e.categoria)}</span><span>· {e.proprio ? 'próprio' : 'sublocado'}</span></div>
                            </div>
                            <div className="shrink-0 text-right"><Semaforo disp={disp.disponivel} /><div className="mt-0.5 text-[0.65rem] text-ink-muted">de {formatNumber(disp.total)}</div></div>
                          </div>
                          <button onClick={() => setAddAloc({ equipId: e.id, inicio: pInicio, fim: pFim })} className="mt-2 w-full rounded-lg border border-black/10 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">+ Alocar a um evento</button>
                        </div>
                      ))}
                    </div>

                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                        <span>{filtradas.length} item(ns) · página {page + 1} de {totalPages}</span>
                        <div className="flex gap-1">
                          <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Anterior</button>
                          <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-lg border border-black/10 px-3 py-1.5 font-semibold disabled:opacity-40 enabled:hover:border-brand/30 enabled:hover:text-brand">Próxima</button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ───────────────────────── DISPONIBILIDADE ───────────────────────── */}
          {tab === 'disponibilidade' && (
            <div className="mt-5 space-y-5">
              <Verificador equipamentos={itensAtivos} alocacoes={alocacoes} hoje={hoje} onAlocar={(equipId, ini, fim) => setAddAloc({ equipId, inicio: ini, fim })} />

              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-ink">Linha do tempo de uso</h3>
                    <p className="text-xs text-ink-muted">Unidades alocadas por dia. Vermelho = superalocado (precisa sublocar).</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="date" value={tInicio} onChange={(e) => setTInicio(e.target.value)} className={selCls} />
                    <select value={tDias} onChange={(e) => setTDias(Number(e.target.value))} className={selCls}>
                      <option value={7}>7 dias</option>
                      <option value={14}>14 dias</option>
                      <option value={30}>30 dias</option>
                    </select>
                  </div>
                </div>
                {itensAtivos.length === 0 ? <p className="py-10 text-center text-sm text-ink-muted">Sem itens ativos para exibir.</p>
                  : <Timeline equipamentos={itensAtivos} alocacoes={alocacoes} inicio={tInicio} dias={tDias} />}
              </div>
            </div>
          )}

          {/* ───────────────────────── ROMANEIO ───────────────────────── */}
          {tab === 'romaneio' && (
            <div className="mt-5 space-y-5">
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="min-w-[240px] flex-1">
                    <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Evento</span>
                    <select value={eventoSel} onChange={(e) => setEventoSel(e.target.value)} className={inp}>
                      <option value="">Selecione um evento…</option>
                      {eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
                    </select>
                  </div>
                  {eventoSel && (() => {
                    const ev = eventos.find((x) => x.id === eventoSel);
                    return (
                      <button onClick={() => setAddAloc({ eventoId: eventoSel, inicio: ev?.data_inicio?.slice(0, 10) || hoje, fim: (ev?.data_fim || ev?.data_inicio)?.slice(0, 10) || hoje })} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Adicionar item</button>
                    );
                  })()}
                </div>
              </div>

              {!eventoSel ? (
                <EmptyCard title="Monte o romaneio de um evento" msg="Escolha um evento para listar os itens reservados, fazer a separação (picking), registrar a saída e a devolução com conferência de avarias." />
              ) : (
                <Romaneio
                  evento={eventos.find((x) => x.id === eventoSel) || null}
                  alocacoes={alocPorEvento.get(eventoSel) || []}
                  equipById={equipById}
                  confirmKey={confirmKey}
                  onSeparar={(a) => mudarStatus(a, 'separado')}
                  onUso={(a) => mudarStatus(a, 'em_uso')}
                  onVoltar={(a) => mudarStatus(a, 'reservado')}
                  onDevolver={(a) => setDevolver(a)}
                  onCancelar={cancelarAloc}
                  onAdd={() => { const ev = eventos.find((x) => x.id === eventoSel); setAddAloc({ eventoId: eventoSel, inicio: ev?.data_inicio?.slice(0, 10) || hoje, fim: (ev?.data_fim || ev?.data_inicio)?.slice(0, 10) || hoje }); }}
                />
              )}
            </div>
          )}
        </>
      )}

      {/* Modais */}
      {itemEditor && userId && (
        <ItemEditorModal userId={userId} editing={itemEditor.editing} fornecedores={fornecedores}
          onClose={() => setItemEditor(null)}
          onSaved={() => { setItemEditor(null); refetch(); }}
          onAskRemove={itemEditor.editing ? () => { const e = itemEditor.editing!; setItemEditor(null); removerItem(e); } : undefined}
          onToggleAtivo={itemEditor.editing ? () => { toggleAtivo(itemEditor.editing!); setItemEditor(null); } : undefined}
        />
      )}
      {addAloc && userId && (
        <AddAlocacaoModal userId={userId} equipamentos={itensAtivos} eventos={eventos} alocacoes={alocacoes} preset={addAloc}
          onClose={() => setAddAloc(null)}
          onSaved={() => { setAddAloc(null); refetch(); }}
        />
      )}
      {devolver && (
        <DevolverModal aloc={devolver} equip={equipById.get(devolver.equipamento_id) || null} onClose={() => setDevolver(null)} onConfirm={confirmarDevolucao} />
      )}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyEquipamentos({ onNovo }: { onNovo: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoBox size={30} /></div>
      <h2 className="text-lg font-bold text-ink">Seu inventário locável começa aqui</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Cadastre mesas, cadeiras, tendas, som, palco, gerador, banheiro químico… defina a quantidade e veja a disponibilidade por data. Aloque itens a cada evento — o sistema bloqueia superalocação e sugere sublocação.</p>
      <button onClick={onNovo} className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Adicionar primeiro item</button>
    </div>
  );
}

function EmptyCard({ title, msg }: { title: string; msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
      <p className="font-display text-lg font-bold text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">{msg}</p>
    </div>
  );
}

// ── Verificador de disponibilidade (aba Disponibilidade) ──────────────────────
function Verificador({ equipamentos, alocacoes, hoje, onAlocar }: { equipamentos: Equipamento[]; alocacoes: Alocacao[]; hoje: string; onAlocar: (equipId: string, ini: string, fim: string) => void }) {
  const [equipId, setEquipId] = useState('');
  const [qtd, setQtd] = useState('10');
  const [ini, setIni] = useState(hoje);
  const [fim, setFim] = useState(hoje);

  const equip = equipamentos.find((e) => e.id === equipId);
  const resultado = useMemo(() => {
    if (!equip) return null;
    const start = startOfDayLocal(ini);
    const end = startOfDayLocal(fim) + DIA;
    if (!(end > start)) return null;
    return checarDisponibilidade(equip, alocacoes, { start, end, quantidade: Number(qtd) || 0 });
  }, [equip, alocacoes, qtd, ini, fim]);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <h3 className="text-base font-bold text-ink">Verificar disponibilidade</h3>
      <p className="mb-4 text-xs text-ink-muted">Quantas unidades estão livres num período? Confira antes de prometer ao cliente.</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <label className="col-span-2 block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Item</span>
          <select value={equipId} onChange={(e) => setEquipId(e.target.value)} className={inp}><option value="">Selecione…</option>{equipamentos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
        </label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Quantidade</span><input type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} className={inp} /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Início</span><input type="date" value={ini} max={fim} onChange={(e) => setIni(e.target.value)} className={inp} /></label>
        <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Fim</span><input type="date" value={fim} min={ini} onChange={(e) => setFim(e.target.value)} className={inp} /></label>
      </div>
      {resultado && (
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${resultado.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="text-sm">
            {resultado.ok ? (
              <span className="font-semibold text-emerald-800">✓ Disponível — {formatNumber(resultado.disponivel)} livre(s) de {formatNumber(resultado.total)} no período.</span>
            ) : (
              <span className="font-semibold text-amber-800">⚠ Só há {formatNumber(resultado.disponivel)} disponível(is). Faltam <b>{formatNumber(resultado.faltam)}</b> — seria preciso sublocar.</span>
            )}
          </div>
          {equip && <button onClick={() => onAlocar(equip.id, ini, fim)} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Alocar a um evento</button>}
        </div>
      )}
    </div>
  );
}

// ── Timeline diária (aba Disponibilidade) ─────────────────────────────────────
function Timeline({ equipamentos, alocacoes, inicio, dias }: { equipamentos: Equipamento[]; alocacoes: Alocacao[]; inicio: string; dias: number }) {
  const fromMs = startOfDayLocal(inicio);
  const colDays = useMemo(() => Array.from({ length: dias }, (_, i) => fromMs + i * DIA), [fromMs, dias]);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[640px]">
        {/* cabeçalho dos dias */}
        <div className="flex items-end gap-px pl-[160px]">
          {colDays.map((d) => { const dt = new Date(d); const dow = dt.getDay(); const fds = dow === 0 || dow === 6; return (
            <div key={d} className={`flex-1 pb-1 text-center text-[0.6rem] ${fds ? 'text-brand' : 'text-ink-muted'}`}>{dt.getDate()}</div>
          ); })}
        </div>
        {equipamentos.map((e) => {
          const serie = serieDiaria(e, alocacoes, fromMs, fromMs + dias * DIA, dias);
          return (
            <div key={e.id} className="flex items-center gap-px border-t border-black/[0.04] py-1.5">
              <div className="flex w-[160px] shrink-0 items-center gap-2 pr-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: catEquipCor(e.categoria) }} />
                <span className="truncate text-xs font-medium text-ink-soft" title={e.nome}>{e.nome}</span>
                <span className="ml-auto shrink-0 text-[0.6rem] text-ink-muted">{formatNumber(e.quantidade_total)}</span>
              </div>
              {serie.map((p) => {
                const frac = e.quantidade_total > 0 ? p.alocado / e.quantidade_total : (p.alocado > 0 ? 1 : 0);
                const cls = p.superalocado ? 'bg-red-500' : frac === 0 ? 'bg-black/[0.04]' : frac < 0.6 ? 'bg-emerald-400' : frac < 0.9 ? 'bg-amber-400' : 'bg-orange-500';
                return <div key={p.dia} title={`${formatDate(new Date(p.dia), { style: 'short' })} · ${formatNumber(p.alocado)} alocada(s) / ${formatNumber(e.quantidade_total)}${p.superalocado ? ' — superalocado!' : ''}`} className={`h-6 flex-1 rounded-sm ${cls}`} />;
              })}
            </div>
          );
        })}
        {/* legenda */}
        <div className="mt-3 flex flex-wrap items-center gap-3 pl-[160px] text-[0.65rem] text-ink-muted">
          <Legenda cls="bg-black/[0.04]" label="livre" />
          <Legenda cls="bg-emerald-400" label="baixa" />
          <Legenda cls="bg-amber-400" label="alta" />
          <Legenda cls="bg-orange-500" label="quase cheio" />
          <Legenda cls="bg-red-500" label="superalocado" />
        </div>
      </div>
    </div>
  );
}
function Legenda({ cls, label }: { cls: string; label: string }) {
  return <span className="inline-flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-sm ${cls}`} />{label}</span>;
}

// ── Romaneio do evento (aba Romaneio) ─────────────────────────────────────────
function Romaneio({ evento, alocacoes, equipById, confirmKey, onSeparar, onUso, onVoltar, onDevolver, onCancelar, onAdd }: {
  evento: EventoLite | null; alocacoes: Alocacao[]; equipById: Map<string, Equipamento>; confirmKey: string | null;
  onSeparar: (a: Alocacao) => void; onUso: (a: Alocacao) => void; onVoltar: (a: Alocacao) => void; onDevolver: (a: Alocacao) => void; onCancelar: (a: Alocacao) => void; onAdd: () => void;
}) {
  const vivos = alocacoes.filter((a) => a.status !== 'cancelado');
  const custo = custoSublocacao(alocacoes);
  const receita = receitaLocacao(alocacoes);
  const unidades = vivos.reduce((s, a) => s + a.quantidade, 0);
  const avarias = vivos.reduce((s, a) => s + (a.qtd_avaria || 0), 0);

  if (alocacoes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
        <p className="font-display text-lg font-bold text-ink">Romaneio vazio</p>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-soft">Nenhum item alocado a {eventoLabel(evento)} ainda.</p>
        <button onClick={onAdd} className="mt-4 inline-flex rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Adicionar item</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumo custo × receita */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Itens no romaneio" value={formatNumber(vivos.length)} sub={`${formatNumber(unidades)} unidades`} tone="ink" />
        <Kpi label="Custo de sublocação" value={formatMoney(custo)} sub="alimenta o custo do evento" tone="vermelho" />
        <Kpi label="Receita de locação" value={formatMoney(receita)} sub="entra no orçamento" tone="gold" />
        <Kpi label="Margem dos itens" value={formatMoney(receita - custo)} tone={receita - custo >= 0 ? 'verde' : 'vermelho'} />
      </div>
      {avarias > 0 && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{formatNumber(avarias)} unidade(s) devolvida(s) com avaria — registre a manutenção/baixa.</div>}

      <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-card">
        <table className="w-full text-sm">
          <thead className="hidden border-b border-black/[0.06] bg-black/[0.02] text-left text-xs font-bold uppercase tracking-wide text-ink-muted sm:table-header-group">
            <tr><th className="px-4 py-2.5">Item</th><th className="px-4 py-2.5 text-right">Qtd</th><th className="px-4 py-2.5">Período</th><th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-black/[0.04]">
            {[...alocacoes].sort((a, b) => alocStatusMeta(a.status).ordem - alocStatusMeta(b.status).ordem).map((a) => {
              const e = equipById.get(a.equipamento_id);
              const meta = alocStatusMeta(a.status);
              const terminal = alocacaoEncerrada(a.status);
              return (
                <tr key={a.id} className="block sm:table-row">
                  <td className="block px-4 pt-3 sm:table-cell sm:py-3">
                    <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: catEquipCor(e?.categoria || 'outro') }} /><span className="font-medium text-ink">{e?.nome || 'Item removido'}</span></span>
                    {a.qtd_avaria > 0 && <span className="ml-4 text-xs text-red-600">{formatNumber(a.qtd_avaria)} avariada(s)</span>}
                  </td>
                  <td className="block px-4 text-ink-soft sm:table-cell sm:py-3 sm:text-right">{formatNumber(a.quantidade)} {e?.unidade || ''}</td>
                  <td className="block px-4 text-ink-muted sm:table-cell sm:py-3">{a.inicio ? formatDateRange(a.inicio, a.fim) : '—'}</td>
                  <td className="block px-4 pt-1 sm:table-cell sm:py-3"><span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.chip}`}>{meta.label}</span></td>
                  <td className="block px-4 pb-3 pt-2 sm:table-cell sm:py-3 sm:text-right">
                    <div className="flex flex-wrap gap-1.5 sm:justify-end">
                      {a.status === 'reservado' && <button onClick={() => onSeparar(a)} className="rounded-lg bg-sky-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-sky-700">Separar</button>}
                      {a.status === 'separado' && <><button onClick={() => onUso(a)} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700">Pôr em uso</button><button onClick={() => onVoltar(a)} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand">Voltar</button></>}
                      {a.status === 'em_uso' && <button onClick={() => onDevolver(a)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700">Devolver</button>}
                      {!terminal && <button onClick={() => onCancelar(a)} className={`rounded-lg border px-2.5 py-1 text-xs font-semibold ${confirmKey === `can:${a.id}` ? 'border-red-500 bg-red-600 text-white' : 'border-red-200 text-red-600 hover:bg-red-50'}`}>{confirmKey === `can:${a.id}` ? 'Confirmar?' : 'Cancelar'}</button>}
                      {terminal && <span className="text-xs text-ink-muted">{meta.label}</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Modal: novo/editar item ────────────────────────────────────────────────────
function ItemEditorModal({ userId, editing, fornecedores, onClose, onSaved, onAskRemove, onToggleAtivo }: {
  userId: string; editing: Equipamento | null; fornecedores: FornecedorLite[];
  onClose: () => void; onSaved: () => void; onAskRemove?: () => void; onToggleAtivo?: () => void;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(editing?.nome || '');
  const [categoria, setCategoria] = useState<EquipCategoria | string>(editing?.categoria || 'mobiliario');
  const [sku, setSku] = useState(editing?.sku || '');
  const [unidade, setUnidade] = useState(editing?.unidade || 'un');
  const [quantidade, setQuantidade] = useState(String(editing?.quantidade_total ?? ''));
  const [proprio, setProprio] = useState(editing?.proprio ?? true);
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id || '');
  const [custo, setCusto] = useState(String(editing?.custo_locacao_num || ''));
  const [preco, setPreco] = useState(String(editing?.preco_locacao_num || ''));
  const [descricao, setDescricao] = useState(editing?.descricao || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  async function salvar() {
    if (!nome.trim()) return;
    setSaving(true);
    const payload = {
      usuario_id: userId, nome: nome.trim(), categoria, sku: sku.trim() || null, unidade: unidade.trim() || 'un',
      quantidade_total: Math.max(0, Math.floor(Number(quantidade) || 0)), proprio,
      fornecedor_id: !proprio && fornecedorId ? fornecedorId : null,
      custo_locacao_num: Number(custo) || 0, preco_locacao_num: Number(preco) || 0,
      descricao: descricao.trim() || null,
    };
    const res = editing
      ? await sb.from('equipamentos').update(payload).eq('id', editing.id)
      : await sb.from('equipamentos').insert(payload);
    setSaving(false);
    if (res.error) { toast.error('Erro ao salvar item.'); return; }
    toast.success(editing ? 'Item atualizado!' : 'Item cadastrado!'); onSaved();
  }

  return (
    <Modal onClose={onClose} title={editing ? 'Editar item' : 'Novo item locável'}>
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_120px] gap-4">
          <Campo label="Nome do item"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Cadeira Tiffany, Tenda 10×10, Caixa de som" /></Campo>
          <Campo label="Código (SKU)"><input className={inp} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="opcional" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Categoria"><select className={inp} value={categoria} onChange={(e) => setCategoria(e.target.value)}>{CATEGORIAS_EQUIP.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</select></Campo>
          <div className="grid grid-cols-[1fr_88px] gap-4">
            <Campo label="Quantidade total"><input type="number" min={0} className={inp} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="Ex: 200" /></Campo>
            <Campo label="Unidade"><input className={inp} value={unidade} onChange={(e) => setUnidade(e.target.value)} placeholder="un" /></Campo>
          </div>
        </div>
        <div className="rounded-xl border border-black/[0.06] p-3">
          <div className="flex gap-2">
            {([['proprio', 'Próprio'], ['sublocado', 'Sublocado de fornecedor']] as const).map(([k, lab]) => (
              <button key={k} type="button" onClick={() => setProprio(k === 'proprio')} className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition ${(k === 'proprio') === proprio ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-black/20'}`}>{lab}</button>
            ))}
          </div>
          {!proprio && (
            <div className="mt-3">
              <Campo label="Fornecedor (sublocação)">
                <select className={inp} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
                  <option value="">{fornecedores.length ? 'Selecione…' : 'Cadastre fornecedores em /painel/fornecedores'}</option>
                  {fornecedores.map((f) => <option key={f.id} value={f.id}>{fornecedorLabel(f)}</option>)}
                </select>
              </Campo>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label={proprio ? 'Custo de locação / unidade' : 'Custo de sublocação / unidade'}><input type="number" min={0} step="0.01" className={inp} value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" /></Campo>
          <Campo label="Preço de locação ao cliente / un"><input type="number" min={0} step="0.01" className={inp} value={preco} onChange={(e) => setPreco(e.target.value)} placeholder="0,00" /></Campo>
        </div>
        <Campo label="Descrição / observações"><textarea className={`${inp} min-h-[64px] resize-y`} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Cor, medidas, estado, acessórios…" /></Campo>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button onClick={salvar} disabled={saving || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar item'}</button>
        {editing && onToggleAtivo && <button onClick={onToggleAtivo} className="rounded-xl border border-black/10 px-4 py-3 text-sm font-medium text-ink-soft hover:bg-black/[0.03]">{editing.ativo ? 'Desativar' : 'Reativar'}</button>}
        {editing && onAskRemove && <button onClick={onAskRemove} className="rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50">Excluir</button>}
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: adicionar alocação (reserva de itens) ───────────────────────────────
function AddAlocacaoModal({ userId: _userId, equipamentos, eventos, alocacoes, preset, onClose, onSaved }: {
  userId: string; equipamentos: Equipamento[]; eventos: EventoLite[]; alocacoes: Alocacao[]; preset: NonNullable<AddAlocState>;
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [equipId, setEquipId] = useState(preset.equipId || '');
  const [eventoId, setEventoId] = useState(preset.eventoId || '');
  const [qtd, setQtd] = useState('1');
  const [ini, setIni] = useState(preset.inicio || '');
  const [fim, setFim] = useState(preset.fim || preset.inicio || '');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  const equip = equipamentos.find((e) => e.id === equipId);
  const check = useMemo(() => {
    if (!equip || !ini || !fim) return null;
    const start = startOfDayLocal(ini); const end = startOfDayLocal(fim) + DIA;
    if (!(end > start)) return null;
    return checarDisponibilidade(equip, alocacoes, { start, end, quantidade: Number(qtd) || 0 });
  }, [equip, alocacoes, qtd, ini, fim]);

  async function salvar(force: boolean) {
    if (!equipId || !ini || !fim) { toast.error('Escolha o item e o período.'); return; }
    setSaving(true);
    const body = {
      equipamento_id: equipId, evento_id: eventoId || null, quantidade: Number(qtd) || 0,
      inicio: diaInicioISO(ini), fim: diaFimISO(fim), obs: obs.trim() || null, force,
    };
    const res = await fetch('/api/equipamentos', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.status === 409) { toast.error(`Superalocação: ${json.disponivel ?? 0} disponível(is), faltam ${json.faltam ?? 0}.`); return; }
    if (!res.ok) { toast.error(json.error || 'Não foi possível alocar.'); return; }
    toast.success(json.faltam > 0 ? `Alocado. Sublocar ${json.faltam} unidade(s) faltante(s).` : 'Itens alocados ao evento.'); onSaved();
  }

  return (
    <Modal onClose={onClose} title="Alocar item a um evento">
      <div className="space-y-4">
        <Campo label="Item"><select className={inp} value={equipId} onChange={(e) => setEquipId(e.target.value)} autoFocus><option value="">Selecione…</option>{equipamentos.map((e) => <option key={e.id} value={e.id}>{e.nome} ({catEquipLabel(e.categoria)})</option>)}</select></Campo>
        <Campo label="Evento (opcional)"><select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}><option value="">Sem evento (uso interno)</option>{eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}</select></Campo>
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Quantidade"><input type="number" min={1} className={inp} value={qtd} onChange={(e) => setQtd(e.target.value)} /></Campo>
          <Campo label="Início"><input type="date" className={inp} value={ini} max={fim || undefined} onChange={(e) => setIni(e.target.value)} /></Campo>
          <Campo label="Fim"><input type="date" className={inp} value={fim} min={ini || undefined} onChange={(e) => setFim(e.target.value)} /></Campo>
        </div>
        <Campo label="Observação"><input className={inp} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex: entregar montado, retirar dia seguinte…" /></Campo>

        {check && (
          <div className={`rounded-xl border p-3 text-sm ${check.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
            {check.ok
              ? <>✓ {formatNumber(check.disponivel)} disponível(is) de {formatNumber(check.total)} no período.</>
              : <>⚠ Só {formatNumber(check.disponivel)} disponível(is). Faltam <b>{formatNumber(check.faltam)}</b> — alocar mesmo assim registra a necessidade de <b>sublocação</b>.</>}
          </div>
        )}
      </div>
      <div className="mt-6 flex items-center gap-3">
        {check && !check.ok
          ? <button onClick={() => salvar(true)} disabled={saving || !equipId} className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:opacity-60">{saving ? 'Alocando…' : 'Alocar e sublocar o que falta'}</button>
          : <button onClick={() => salvar(false)} disabled={saving || !equipId} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Alocando…' : 'Alocar ao evento'}</button>}
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: devolução com conferência de avaria ─────────────────────────────────
function DevolverModal({ aloc, equip, onClose, onConfirm }: { aloc: Alocacao; equip: Equipamento | null; onClose: () => void; onConfirm: (a: Alocacao, qtdAvaria: number) => void }) {
  const [avaria, setAvaria] = useState('0');
  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc); return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);
  const av = Math.min(Math.max(0, Math.floor(Number(avaria) || 0)), aloc.quantidade);
  return (
    <Modal onClose={onClose} title="Devolução & conferência">
      <p className="text-sm text-ink-soft">Conferindo a devolução de <b>{formatNumber(aloc.quantidade)} {equip?.unidade || 'un'}</b> de <b>{equip?.nome || 'item'}</b>. Informe quantas voltaram avariadas (se houver).</p>
      <div className="mt-4 max-w-[200px]">
        <Campo label="Unidades avariadas"><input type="number" min={0} max={aloc.quantidade} className={inp} value={avaria} onChange={(e) => setAvaria(e.target.value)} autoFocus /></Campo>
      </div>
      {av > 0 && <p className="mt-2 text-xs text-amber-700">{formatNumber(av)} unidade(s) marcada(s) como avariada(s) — sugerimos abrir manutenção/baixa.</p>}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => onConfirm(aloc, av)} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-emerald-700">{av > 0 ? 'Confirmar com avaria' : 'Confirmar devolução'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>{children}</label>;
}
function Chip({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="rounded-full border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted hover:border-brand/30 hover:text-brand">{children}</button>;
}
function Semaforo({ disp }: { disp: number }) {
  const cls = disp < 0 ? 'bg-red-50 text-red-700' : disp === 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700';
  return <span className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{disp < 0 ? `${formatNumber(disp)} ⚠` : formatNumber(disp)}</span>;
}
function Kpi({ label, value, sub, tone, icon }: { label: string; value: string; sub?: string; tone: 'ink' | 'brand' | 'azul' | 'gold' | 'verde' | 'vermelho'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', brand: 'text-brand', azul: 'text-blue-600', gold: 'text-amber-600', verde: 'text-emerald-600', vermelho: 'text-red-600' }[tone];
  const iconBg = { ink: 'bg-black/[0.05] text-ink-soft', brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', gold: 'bg-amber-50 text-amber-600', verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2"><span className="text-xs text-ink-muted">{label}</span>{icon && <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}
function Donut({ data }: { data: { label: string; value: number; cor: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1, top = data.slice(0, 9), r = 52, sw = 16, C = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="#f1f5f9" strokeWidth={sw} />
        {top.map((d, i) => { const len = (d.value / total) * C; const el = <circle key={i} cx="64" cy="64" r={r} fill="none" stroke={d.cor} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} />; offset += len; return el; })}
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {top.map((d, i) => <div key={i} className="flex items-center gap-2 text-xs"><span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.cor }} /><span className="min-w-0 flex-1 truncate text-ink-soft">{d.label}</span><span className="shrink-0 font-semibold text-ink-muted">{d.value}</span></div>)}
      </div>
    </div>
  );
}

// ── Ícones ──
const svg = (path: ReactNode, size = 15, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoBox = ({ size = 15 }: { size?: number }) => svg(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" /></>, size);
const IcoTag = () => svg(<path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01" />, 15);
const IcoTruck = () => svg(<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7M5.5 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm12 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />, 15);
const IcoGrid = () => svg(<path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z" />, 15);
const IcoAlert = () => svg(<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />, 15);
const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />, 15);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);

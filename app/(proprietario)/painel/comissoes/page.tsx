'use client';

// Comissões — /painel/comissoes.
// Calcula e gere comissões de quem traz/fecha negócio: vendedores internos
// (equipe), parceiros/cerimonialistas/agências e indicações de clientes
// (liga com /painel/indique). Quatro abas:
//   • Visão geral — KPIs, custo de comissão sobre receita, ranking de quem
//     gera receita, comissão por mês de competência (SVG puro).
//   • Apuração — atribui quem vendeu/trouxe/indicou cada evento, sincroniza as
//     comissões pela regra correta (prevista→apurada→aprovada→paga), estorna.
//     Pagar gera uma despesa em /painel/financeiro (categoria "Comissões").
//   • Regras — regras por beneficiário/condição (% do valor, % da margem,
//     valor fixo; faixa, tipo de evento, propriedade, vigência, prioridade).
//   • Parceiros — cadastro + extrato (a receber, histórico, comprovantes).
// Cálculo puro em lib/comissoes.ts (testado). needsSetup degrada sem a tabela.
// Sem "R$"/percentual hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatPercent, formatNumber, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Regra, type BeneficiarioTipo, type ComissaoStatus, type BaseCalculo, type CondicaoRegra,
  TIPOS_PARCEIRO, BASES, MARGEM_PADRAO_PCT,
  planejarApuracao, resumoPorStatus, totalAPagar, custoSobreReceita, recebidoDoEvento,
  eventoFechado, grupoEvento, ymd, round2,
} from '@/lib/comissoes';
import {
  type Parceiro, type RegraRow, type ComissaoRow, type EventoRow, type ParcelaRow,
  type EquipeLite, type ClienteLite,
  STATUS_META, BENEFICIARIO_META, TIPO_PARCEIRO_LABEL, tipoParceiroLabel, MEIOS,
  toEngineRegra, toEngineEvento, toEngineComissao, nomeBeneficiario, exportComissoesCSV,
  waLink, mailLink, iniciais,
} from './_lib';

// ── Constantes ────────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
const TIPOS_EVENTO = ['Casamento', 'Aniversário', 'Formatura', 'Corporativo', 'Confraternização', 'Outro'];
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const PAGE_SIZE = 20;
type Tab = 'visao' | 'apuracao' | 'regras' | 'parceiros';
type Prop = { id: number; nome: string | null };

// ── Página ────────────────────────────────────────────────────────────────────
export default function ComissoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('visao');

  const [parceiros, setParceiros] = useState<Parceiro[]>([]);
  const [regras, setRegras] = useState<RegraRow[]>([]);
  const [comissoes, setComissoes] = useState<ComissaoRow[]>([]);
  const [eventos, setEventos] = useState<EventoRow[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaRow[]>([]);
  const [equipe, setEquipe] = useState<EquipeLite[]>([]);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [props, setProps] = useState<Prop[]>([]);

  // filtros (aba Apuração)
  const [fStatus, setFStatus] = useState<ComissaoStatus | ''>('');
  const [fBenef, setFBenef] = useState<BeneficiarioTipo | ''>('');
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);

  // modais
  const [regraModal, setRegraModal] = useState<RegraRow | 'novo' | null>(null);
  const [parceiroModal, setParceiroModal] = useState<Parceiro | 'novo' | null>(null);
  const [atribuirEvento, setAtribuirEvento] = useState<EventoRow | null>(null);
  const [pagarComissao, setPagarComissao] = useState<ComissaoRow | null>(null);
  const [manualModal, setManualModal] = useState(false);
  const [extratoParceiro, setExtratoParceiro] = useState<Parceiro | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    // A tabela-âncora `comissoes` define o needsSetup (migration ainda não rodada).
    const cRes = await sb.from('comissoes').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false });
    if (cRes.error && (cRes.error.code === '42P01' || cRes.error.code === 'PGRST205')) { setNeedsSetup(true); setComissoes([]); return; }
    setNeedsSetup(false);
    setComissoes((cRes.data || []) as ComissaoRow[]);

    const [pRes, rRes, evRes, parcRes, eqRes, clRes, prRes] = await Promise.all([
      sb.from('parceiros').select('*').eq('usuario_id', uid).order('nome'),
      sb.from('comissoes_regras').select('*').eq('usuario_id', uid).order('prioridade', { ascending: false }),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,valor_total_num,propriedade_id,vendedor_equipe_id,parceiro_id,indicado_por_id').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('parcelas').select('evento_id,valor,status').eq('usuario_id', uid),
      sb.from('equipe').select('id,nome,cargo').eq('usuario_id', uid).order('nome'),
      sb.from('clientes').select('id,nome').eq('usuario_id', uid).order('nome'),
      sb.from('propriedades').select('id,nome').eq('usuario_id', uid).order('id'),
    ]);
    setParceiros(pRes.error ? [] : ((pRes.data || []) as Parceiro[]).map((p) => ({ ...p, banco: p.banco && typeof p.banco === 'object' ? p.banco : {}, percentual_padrao: p.percentual_padrao != null ? Number(p.percentual_padrao) : null })));
    setRegras(rRes.error ? [] : ((rRes.data || []) as RegraRow[]).map((r) => ({ ...r, condicao: r.condicao && typeof r.condicao === 'object' ? r.condicao : {} })));
    setEventos(evRes.error ? [] : ((evRes.data || []) as EventoRow[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null })));
    setParcelas(parcRes.error ? [] : ((parcRes.data || []) as ParcelaRow[]).map((p) => ({ ...p, valor: Number(p.valor) || 0 })));
    setEquipe(eqRes.error ? [] : (eqRes.data || []) as EquipeLite[]);
    setClientes(clRes.error ? [] : (clRes.data || []) as ClienteLite[]);
    setProps(prRes.error ? [] : (prRes.data || []) as Prop[]);
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

  useEffect(() => { setPage(0); }, [fStatus, fBenef, busca, tab]);

  // ── Mapas de nome ──
  const nameMaps = useMemo(() => ({
    equipe: new Map(equipe.map((e) => [String(e.id), e.nome])),
    parceiros: new Map(parceiros.map((p) => [p.id, p.nome])),
    clientes: new Map(clientes.map((c) => [c.id, c.nome])),
  }), [equipe, parceiros, clientes]);
  const eventosMap = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const propMap = useMemo(() => new Map(props.map((p) => [p.id, p.nome || `#${p.id}`])), [props]);
  const eventoNome = useCallback((id: string | null) => {
    if (!id) return null;
    const e = eventosMap.get(id);
    return e ? (e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento') : 'Evento removido';
  }, [eventosMap]);

  // ── Comissões enriquecidas ──
  const comissoesView = useMemo(() => comissoes.map((c) => ({
    c,
    beneficiario: c.beneficiario_nome || nomeBeneficiario(c.beneficiario_tipo, c.beneficiario_id, nameMaps),
    evento: eventoNome(c.evento_id),
  })), [comissoes, nameMaps, eventoNome]);

  // ── KPIs / relatórios ──
  const ativas = useMemo(() => comissoes.filter((c) => c.status !== 'cancelada'), [comissoes]);
  const resumo = useMemo(() => resumoPorStatus(ativas), [ativas]);
  const receitaRecebida = useMemo(() => round2(parcelas.filter((p) => p.status === 'pago').reduce((s, p) => s + p.valor, 0)), [parcelas]);
  const custoPct = useMemo(() => custoSobreReceita(resumo.paga, receitaRecebida), [resumo.paga, receitaRecebida]);

  // Ranking: receita gerada (Σ valor dos eventos atribuídos) × comissão.
  const ranking = useMemo(() => {
    const m = new Map<string, { tipo: BeneficiarioTipo; id: string; nome: string; receita: number; comissao: number; n: number }>();
    const bump = (tipo: BeneficiarioTipo, id: string | null, receita: number, comissao: number) => {
      const key = `${tipo}|${id ?? ''}`;
      const e = m.get(key) || { tipo, id: id ?? '', nome: nomeBeneficiario(tipo, id, nameMaps), receita: 0, comissao: 0, n: 0 };
      e.receita += receita; e.comissao += comissao; if (receita > 0) e.n++;
      m.set(key, e);
    };
    // receita gerada vem das atribuições nos eventos fechados
    eventos.filter((e) => eventoFechado(e.status)).forEach((e) => {
      const v = Number(e.valor_total_num) || 0;
      if (e.vendedor_equipe_id != null) bump('equipe', String(e.vendedor_equipe_id), v, 0);
      if (e.parceiro_id) bump('parceiro', e.parceiro_id, v, 0);
      if (e.indicado_por_id) bump('cliente', e.indicado_por_id, v, 0);
    });
    // comissão vem das comissões ativas
    ativas.forEach((c) => bump(c.beneficiario_tipo, c.beneficiario_id, 0, Number(c.valor_num) || 0));
    return [...m.values()].filter((e) => e.receita > 0 || e.comissao > 0).sort((a, b) => b.receita - a.receita || b.comissao - a.comissao).slice(0, 8);
  }, [eventos, ativas, nameMaps]);

  // Comissão por mês de competência (últimos 8 meses) — barras empilhadas.
  const porMes = useMemo(() => {
    const now = new Date();
    const base = Array.from({ length: 8 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 7 + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_PT[d.getMonth()], prevista: 0, apurada: 0, aprovada: 0, paga: 0 };
    });
    ativas.forEach((c) => {
      const k = (c.competencia || '').slice(0, 7);
      const slot = base.find((b) => b.key === k);
      if (slot && c.status !== 'cancelada') slot[c.status] += Number(c.valor_num) || 0;
    });
    return base;
  }, [ativas]);

  // ── Preview do plano de apuração (diff entre regras+atribuições e o salvo) ──
  const plano = useMemo(() => {
    const regrasAtivas = regras.filter((r) => r.ativo).map(toEngineRegra);
    return planejarApuracao({
      eventos: eventos.map(toEngineEvento),
      parcelas: parcelas.map((p) => ({ evento_id: p.evento_id, valor: p.valor, status: p.status })),
      regras: regrasAtivas,
      existentes: comissoes.map(toEngineComissao),
      nowMs: Date.now(),
    });
  }, [eventos, parcelas, regras, comissoes]);
  const pendentesApuracao = plano.inserir.length + plano.atualizar.length;

  // ── Handlers: apuração ──
  async function sincronizar() {
    if (!userId) return;
    if (pendentesApuracao === 0) { toast.info('Nada a apurar — tudo em dia.'); return; }
    setSincronizando(true);
    try {
      if (plano.inserir.length) {
        const rows = plano.inserir.map((n) => ({
          usuario_id: userId, regra_id: n.regra_id, beneficiario_tipo: n.beneficiario_tipo,
          beneficiario_id: n.beneficiario_id, beneficiario_nome: nomeBeneficiario(n.beneficiario_tipo, n.beneficiario_id, nameMaps),
          evento_id: n.evento_id, base_num: n.base_num, percentual: n.percentual, valor_num: n.valor_num,
          status: n.status, competencia: n.competencia, origem: 'auto',
          apurada_em: n.status === 'apurada' ? new Date().toISOString() : null,
        }));
        const { error } = await sb.from('comissoes').insert(rows);
        if (error) throw error;
      }
      for (const u of plano.atualizar) {
        const patch: Record<string, unknown> = {};
        if (u.status !== undefined) { patch.status = u.status; if (u.status === 'apurada') patch.apurada_em = new Date().toISOString(); }
        if (u.valor_num !== undefined) patch.valor_num = u.valor_num;
        if (u.base_num !== undefined) patch.base_num = u.base_num;
        if (u.percentual !== undefined) patch.percentual = u.percentual;
        const { error } = await sb.from('comissoes').update(patch).eq('id', u.id).eq('usuario_id', userId);
        if (error) throw error;
      }
      toast.success(`Apuração concluída: ${plano.inserir.length} criada(s), ${plano.atualizar.length} atualizada(s).`);
      await carregar(userId);
    } catch {
      toast.error('Erro ao apurar comissões.');
    } finally {
      setSincronizando(false);
    }
  }

  async function mudarStatus(c: ComissaoRow, status: ComissaoStatus) {
    if (!userId) return;
    const patch: Record<string, unknown> = { status };
    if (status === 'aprovada') patch.aprovada_em = new Date().toISOString();
    if (status === 'apurada') patch.apurada_em = c.apurada_em || new Date().toISOString();
    const { error } = await sb.from('comissoes').update(patch).eq('id', c.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    setComissoes((arr) => arr.map((x) => (x.id === c.id ? { ...x, ...patch } as ComissaoRow : x)));
    toast.success(`Comissão ${STATUS_META[status].label.toLowerCase()}.`);
  }

  // Pagar = gera despesa em lançamentos (categoria Comissões) e marca paga.
  async function pagar(c: ComissaoRow, meio: string) {
    if (!userId) return;
    const benef = c.beneficiario_nome || nomeBeneficiario(c.beneficiario_tipo, c.beneficiario_id, nameMaps);
    const ev = c.evento_id ? eventosMap.get(c.evento_id) : null;
    const { data: lanc, error: e1 } = await sb.from('lancamentos').insert({
      usuario_id: userId, tipo: 'despesa', categoria: 'Comissões',
      descricao: `Comissão — ${benef}${ev ? ` (${ev.nome_evento || ev.tipo_evento || 'evento'})` : ''}`,
      tipo_evento: ev?.tipo_evento || null, valor: c.valor_num, status: 'pago', data: ymd(new Date()),
      metodo_pagamento: meio || null, comissao_id: c.id,
    }).select('id').single();
    if (e1) { toast.error('Erro ao lançar o pagamento no Financeiro.'); return; }
    const patch = { status: 'paga' as ComissaoStatus, pago_em: new Date().toISOString(), meio: meio || null, lancamento_id: lanc?.id ?? null };
    const { error: e2 } = await sb.from('comissoes').update(patch).eq('id', c.id).eq('usuario_id', userId);
    if (e2) { toast.error('Pagamento lançado, mas houve erro ao marcar a comissão.'); }
    setComissoes((arr) => arr.map((x) => (x.id === c.id ? { ...x, ...patch } as ComissaoRow : x)));
    setPagarComissao(null);
    toast.success('Comissão paga e lançada no Financeiro.');
  }

  async function estornarPagamento(c: ComissaoRow) {
    if (!userId) return;
    if (c.lancamento_id) await sb.from('lancamentos').delete().eq('id', c.lancamento_id).eq('usuario_id', userId);
    else await sb.from('lancamentos').delete().eq('comissao_id', c.id).eq('usuario_id', userId);
    const patch = { status: 'aprovada' as ComissaoStatus, pago_em: null, lancamento_id: null };
    const { error } = await sb.from('comissoes').update(patch).eq('id', c.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao estornar.'); return; }
    setComissoes((arr) => arr.map((x) => (x.id === c.id ? { ...x, ...patch } as ComissaoRow : x)));
    toast.success('Pagamento estornado (despesa removida do Financeiro).');
  }

  async function removerComissao(c: ComissaoRow) {
    if (!userId) return;
    if (c.lancamento_id) await sb.from('lancamentos').delete().eq('id', c.lancamento_id).eq('usuario_id', userId);
    const { error } = await sb.from('comissoes').delete().eq('id', c.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setComissoes((arr) => arr.filter((x) => x.id !== c.id));
    toast.success('Comissão removida.');
  }

  // ── Handlers: atribuição de evento ──
  async function salvarAtribuicao(ev: EventoRow, attr: { vendedor_equipe_id: number | null; parceiro_id: string | null; indicado_por_id: string | null }) {
    if (!userId) return;
    const { error } = await sb.from('clientes_eventos').update(attr).eq('id', ev.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao salvar atribuição.'); return; }
    setEventos((arr) => arr.map((x) => (x.id === ev.id ? { ...x, ...attr } : x)));
    setAtribuirEvento(null);
    toast.success('Atribuição salva. Sincronize para apurar a comissão.');
  }

  // ── Handlers: regras ──
  async function salvarRegra(payload: Partial<RegraRow>, id?: string) {
    if (!userId) return;
    let error;
    if (id) ({ error } = await sb.from('comissoes_regras').update(payload).eq('id', id).eq('usuario_id', userId));
    else ({ error } = await sb.from('comissoes_regras').insert({ ...payload, usuario_id: userId }));
    if (error) { toast.error('Erro ao salvar regra.'); return; }
    setRegraModal(null); toast.success(id ? 'Regra atualizada!' : 'Regra criada!'); await carregar(userId);
  }
  async function toggleRegra(r: RegraRow) {
    if (!userId) return;
    const novo = !r.ativo;
    setRegras((arr) => arr.map((x) => (x.id === r.id ? { ...x, ativo: novo } : x)));
    const { error } = await sb.from('comissoes_regras').update({ ativo: novo }).eq('id', r.id).eq('usuario_id', userId);
    if (error) { setRegras((arr) => arr.map((x) => (x.id === r.id ? { ...x, ativo: r.ativo } : x))); toast.error('Erro ao alterar a regra.'); }
  }
  async function removerRegra(r: RegraRow) {
    if (!userId || !confirm(`Excluir a regra "${r.nome}"? Comissões já apuradas não são afetadas.`)) return;
    const { error } = await sb.from('comissoes_regras').delete().eq('id', r.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao excluir.'); return; }
    setRegras((arr) => arr.filter((x) => x.id !== r.id)); toast.success('Regra excluída.');
  }

  // ── Handlers: parceiros ──
  async function salvarParceiro(payload: Partial<Parceiro>, id?: string) {
    if (!userId) return;
    let error;
    if (id) ({ error } = await sb.from('parceiros').update(payload).eq('id', id).eq('usuario_id', userId));
    else ({ error } = await sb.from('parceiros').insert({ ...payload, usuario_id: userId }));
    if (error) { toast.error('Erro ao salvar parceiro.'); return; }
    setParceiroModal(null); toast.success(id ? 'Parceiro atualizado!' : 'Parceiro cadastrado!'); await carregar(userId);
  }
  async function removerParceiro(p: Parceiro) {
    if (!userId || !confirm(`Excluir o parceiro "${p.nome}"? As comissões e atribuições ficam, mas sem vínculo.`)) return;
    const { error } = await sb.from('parceiros').delete().eq('id', p.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao excluir.'); return; }
    setParceiros((arr) => arr.filter((x) => x.id !== p.id)); toast.success('Parceiro excluído.');
  }

  // ── Handler: comissão manual ──
  async function salvarManual(payload: { beneficiario_tipo: BeneficiarioTipo; beneficiario_id: string | null; evento_id: string | null; valor_num: number; competencia: string; status: ComissaoStatus; obs: string }) {
    if (!userId) return;
    const { error } = await sb.from('comissoes').insert({
      usuario_id: userId, beneficiario_tipo: payload.beneficiario_tipo, beneficiario_id: payload.beneficiario_id,
      beneficiario_nome: nomeBeneficiario(payload.beneficiario_tipo, payload.beneficiario_id, nameMaps),
      evento_id: payload.evento_id, base_num: 0, valor_num: payload.valor_num, status: payload.status,
      competencia: payload.competencia, origem: 'manual', obs: payload.obs || null,
    });
    if (error) { toast.error('Erro ao lançar comissão.'); return; }
    setManualModal(false); toast.success('Comissão lançada.'); await carregar(userId);
  }

  // ── Lista filtrada (aba Apuração) ──
  const filtradas = useMemo(() => {
    let arr = comissoesView;
    if (fStatus) arr = arr.filter((x) => x.c.status === fStatus);
    if (fBenef) arr = arr.filter((x) => x.c.beneficiario_tipo === fBenef);
    const q = busca.trim().toLowerCase();
    if (q) arr = arr.filter((x) => `${x.beneficiario} ${x.evento || ''}`.toLowerCase().includes(q));
    return [...arr].sort((a, b) => (b.c.competencia || '').localeCompare(a.c.competencia || '') || b.c.valor_num - a.c.valor_num);
  }, [comissoesView, fStatus, fBenef, busca]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const pageItems = filtradas.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // Eventos fechados sem nenhuma atribuição (oportunidade de apuração).
  const fechadosSemAtrib = useMemo(
    () => eventos.filter((e) => eventoFechado(e.status) && e.vendedor_equipe_id == null && !e.parceiro_id && !e.indicado_por_id),
    [eventos],
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[104px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const totalComissoes = comissoes.length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Comissões</h1>
          <p className="mt-1 text-sm text-ink-muted">Vendedores, parceiros e indicações — da regra ao pagamento. Indique parceiros em <Link href="/painel/indique" className="font-semibold text-brand underline">Indique &amp; Ganhe</Link>.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!needsSetup && tab === 'regras' && <button onClick={() => setRegraModal('novo')} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Nova regra</button>}
          {!needsSetup && tab === 'parceiros' && <button onClick={() => setParceiroModal('novo')} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Novo parceiro</button>}
          {!needsSetup && tab === 'apuracao' && (
            <>
              <button onClick={() => setManualModal(true)} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Lançar manual</button>
              <button onClick={sincronizar} disabled={sincronizando} className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
                {sincronizando ? 'Apurando…' : 'Sincronizar apuração'}{pendentesApuracao > 0 && !sincronizando && <span className="rounded-full bg-white/25 px-1.5 text-[0.7rem] font-bold">{pendentesApuracao}</span>}
              </button>
            </>
          )}
        </div>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O módulo de comissões ainda não foi ativado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/comissoes.sql</code> no Supabase para criar as tabelas (parceiros, regras e comissões) e os campos de atribuição em <code className="rounded bg-amber-100 px-1 py-0.5">clientes_eventos</code>.
        </div>
      )}

      {!needsSetup && (
        <>
          {/* Abas */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {([['visao', 'Visão geral'], ['apuracao', 'Apuração'], ['regras', 'Regras'], ['parceiros', 'Parceiros']] as [Tab, string][]).map(([v, label]) => {
              const n = v === 'apuracao' ? totalComissoes : v === 'regras' ? regras.length : v === 'parceiros' ? parceiros.length : 0;
              return (
                <button key={v} onClick={() => setTab(v)} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}>
                  {label}{n > 0 && <span className="ml-1.5 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[0.6rem] text-ink-muted">{n}</span>}
                </button>
              );
            })}
          </div>

          {/* ─────────────── VISÃO GERAL ─────────────── */}
          {tab === 'visao' && (
            <div className="mt-5 space-y-5">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi label="A pagar" value={formatMoneyShort(totalAPagar(resumo))} sub="prevista + apurada + aprovada" tone="azul" icon={<IcoClock />} />
                <Kpi label="Paga (período)" value={formatMoneyShort(resumo.paga)} sub="comissões liquidadas" tone="verde" icon={<IcoCheck />} />
                <Kpi label="Custo s/ receita" value={formatPercent(custoPct, { maximumFractionDigits: 1 })} sub={`sobre ${formatMoneyShort(receitaRecebida)} recebidos`} tone="gold" icon={<IcoPercent />} />
                <Kpi label="Apurada" value={formatMoneyShort(resumo.apurada)} sub="pronta para aprovar" tone="brand" icon={<IcoBolt />} />
              </div>

              {totalComissoes === 0 && fechadosSemAtrib.length === 0 ? (
                <EmptyComissoes hasRegras={regras.length > 0} onRegra={() => { setTab('regras'); setRegraModal('novo'); }} onApurar={() => setTab('apuracao')} />
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
                  {/* Comissão por mês */}
                  <div className="rounded-2xl bg-white p-5 shadow-card">
                    <h3 className="mb-1 text-base font-bold text-ink">Comissão por mês</h3>
                    <p className="mb-4 text-xs text-ink-muted">Por competência · empilhado por status</p>
                    <StackedBars dados={porMes} />
                  </div>
                  {/* Ranking */}
                  <div className="rounded-2xl bg-white p-5 shadow-card">
                    <h3 className="mb-1 text-base font-bold text-ink">Quem gera receita</h3>
                    <p className="mb-4 text-xs text-ink-muted">Ranking por receita trazida × comissão</p>
                    {ranking.length === 0 ? (
                      <p className="py-8 text-center text-sm text-ink-muted">Atribua vendedores/parceiros aos eventos para ver o ranking.</p>
                    ) : (
                      <div className="space-y-2.5">
                        {ranking.map((r, i) => {
                          const max = ranking[0].receita || 1;
                          return (
                            <div key={`${r.tipo}-${r.id}`}>
                              <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                                <span className="flex min-w-0 items-center gap-1.5"><span className="text-sm">{BENEFICIARIO_META[r.tipo].icon}</span><span className="truncate font-semibold text-ink-soft">{r.nome}</span></span>
                                <span className="shrink-0 font-bold text-ink">{formatMoneyShort(r.receita)}</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full" style={{ width: `${Math.round((r.receita / max) * 100)}%`, background: BENEFICIARIO_META[r.tipo].cor }} /></div>
                              {r.comissao > 0 && <div className="mt-0.5 text-[0.68rem] text-ink-muted">comissão {formatMoneyShort(r.comissao)}{r.receita > 0 ? ` · ${formatPercent(r.comissao / r.receita, { maximumFractionDigits: 1 })}` : ''}</div>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Distribuição por tipo de beneficiário */}
              {totalComissoes > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <h3 className="mb-4 text-base font-bold text-ink">Comissões por beneficiário</h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {(['equipe', 'parceiro', 'cliente'] as BeneficiarioTipo[]).map((t) => {
                      const itens = ativas.filter((c) => c.beneficiario_tipo === t);
                      const total = round2(itens.reduce((s, c) => s + (Number(c.valor_num) || 0), 0));
                      const meta = BENEFICIARIO_META[t];
                      return (
                        <div key={t} className="rounded-xl border border-black/[0.06] p-4">
                          <div className="flex items-center gap-2"><span className="text-lg">{meta.icon}</span><span className="font-semibold text-ink-soft">{meta.plural}</span></div>
                          <div className="mt-2 text-xl font-bold text-ink">{formatMoneyShort(total)}</div>
                          <div className="text-xs text-ink-muted">{itens.length} comissão(ões)</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────────── APURAÇÃO ─────────────── */}
          {tab === 'apuracao' && (
            <div className="mt-5 space-y-5">
              {/* Banner de sincronização */}
              {pendentesApuracao > 0 && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand-50/60 px-4 py-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand"><IcoBolt /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{pendentesApuracao} ajuste(s) de apuração pendente(s)</p>
                    <p className="text-xs text-ink-muted">{plano.inserir.length} comissão(ões) a criar · {plano.atualizar.length} a atualizar/estornar pelas regras ativas.</p>
                  </div>
                  <button onClick={sincronizar} disabled={sincronizando} className="shrink-0 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">{sincronizando ? 'Apurando…' : 'Sincronizar agora'}</button>
                </div>
              )}

              {/* Eventos fechados sem atribuição */}
              {fechadosSemAtrib.length > 0 && (
                <div className="rounded-2xl bg-white p-5 shadow-card">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-base font-bold text-ink">Eventos fechados sem atribuição</h3>
                    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">{fechadosSemAtrib.length}</span>
                  </div>
                  <p className="mb-3 text-xs text-ink-muted">Defina quem vendeu, trouxe ou indicou para gerar a comissão.</p>
                  <div className="space-y-2">
                    {fechadosSemAtrib.slice(0, 6).map((e) => (
                      <div key={e.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{e.nome_evento || e.quem_contratou || 'Evento'}</p>
                          <p className="text-xs text-ink-muted">{e.tipo_evento || '—'}{e.data_inicio ? ` · ${formatDate(e.data_inicio, { style: 'short' })}` : ''}{e.valor_total_num ? ` · ${formatMoneyShort(e.valor_total_num)}` : ''}</p>
                        </div>
                        <button onClick={() => setAtribuirEvento(e)} className="shrink-0 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Atribuir</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de comissões */}
              <div className="rounded-2xl bg-white p-5 shadow-card">
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[180px] flex-1">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
                    <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar beneficiário ou evento…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                  <select value={fBenef} onChange={(e) => setFBenef(e.target.value as BeneficiarioTipo | '')} className={selCls}>
                    <option value="">Beneficiário</option>
                    {(['equipe', 'parceiro', 'cliente'] as BeneficiarioTipo[]).map((t) => <option key={t} value={t}>{BENEFICIARIO_META[t].plural}</option>)}
                  </select>
                  <select value={fStatus} onChange={(e) => setFStatus(e.target.value as ComissaoStatus | '')} className={selCls}>
                    <option value="">Status</option>
                    {(Object.keys(STATUS_META) as ComissaoStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
                  </select>
                  {filtradas.length > 0 && <button onClick={() => exportComissoesCSV(filtradas)} className="flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
                </div>

                {filtradas.length === 0 ? (
                  <p className="py-12 text-center text-sm text-ink-muted">{comissoes.length === 0 ? 'Nenhuma comissão ainda. Crie regras, atribua eventos e clique em “Sincronizar apuração”.' : 'Nenhuma comissão corresponde aos filtros.'}</p>
                ) : (
                  <>
                    {/* Desktop */}
                    <div className="hidden overflow-x-auto md:block">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                            <th className="pb-2 font-semibold">Beneficiário</th>
                            <th className="pb-2 font-semibold">Evento</th>
                            <th className="pb-2 font-semibold">Competência</th>
                            <th className="pb-2 text-right font-semibold">Valor</th>
                            <th className="pb-2 font-semibold">Status</th>
                            <th className="w-px pb-2 text-right font-semibold">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map(({ c, beneficiario, evento }) => (
                            <tr key={c.id} className="group border-b border-black/[0.04] last:border-0">
                              <td className="py-2.5">
                                <div className="flex items-center gap-1.5">
                                  <span title={BENEFICIARIO_META[c.beneficiario_tipo].label}>{BENEFICIARIO_META[c.beneficiario_tipo].icon}</span>
                                  <span className="font-medium text-ink">{beneficiario}</span>
                                  {c.origem === 'manual' && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-ink-muted">manual</span>}
                                </div>
                              </td>
                              <td className="py-2.5 text-ink-muted">{evento || '—'}</td>
                              <td className="py-2.5 text-ink-muted">{c.competencia ? formatDate(c.competencia, { style: 'short' }) : '—'}</td>
                              <td className="py-2.5 text-right font-bold text-ink">{formatMoney(c.valor_num)}{c.percentual != null && c.base_num > 0 && <span className="block text-[0.65rem] font-normal text-ink-muted">{formatPercent(c.percentual / 100, { maximumFractionDigits: 1 })} de {formatMoneyShort(c.base_num)}</span>}</td>
                              <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[c.status].cls}`}>{STATUS_META[c.status].label}</span></td>
                              <td className="py-2.5 pl-2 text-right"><RowActions c={c} onAprovar={() => mudarStatus(c, 'aprovada')} onPagar={() => setPagarComissao(c)} onCancelar={() => mudarStatus(c, 'cancelada')} onEstornar={() => estornarPagamento(c)} onRemover={() => removerComissao(c)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {/* Mobile */}
                    <div className="space-y-2.5 md:hidden">
                      {pageItems.map(({ c, beneficiario, evento }) => (
                        <div key={c.id} className="rounded-xl border border-black/[0.06] p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5"><span>{BENEFICIARIO_META[c.beneficiario_tipo].icon}</span><span className="truncate font-semibold text-ink">{beneficiario}</span></div>
                              <p className="truncate text-xs text-ink-muted">{evento || '—'}{c.competencia ? ` · ${formatDate(c.competencia, { style: 'short' })}` : ''}</p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[c.status].cls}`}>{STATUS_META[c.status].label}</span>
                          </div>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-base font-bold text-ink">{formatMoney(c.valor_num)}</span>
                            <RowActions c={c} onAprovar={() => mudarStatus(c, 'aprovada')} onPagar={() => setPagarComissao(c)} onCancelar={() => mudarStatus(c, 'cancelada')} onEstornar={() => estornarPagamento(c)} onRemover={() => removerComissao(c)} />
                          </div>
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                        <span>{filtradas.length} comissão(ões) · página {page + 1} de {totalPages}</span>
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

          {/* ─────────────── REGRAS ─────────────── */}
          {tab === 'regras' && (
            <div className="mt-5">
              {regras.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-card">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoPercent size={28} /></div>
                  <h2 className="text-lg font-bold text-ink">Crie sua primeira regra de comissão</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Ex.: vendedor 3% do valor, cerimonialista 10% sobre casamentos, indicação valor fixo. A apuração aplica a regra certa para cada evento.</p>
                  <button onClick={() => setRegraModal('novo')} className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Nova regra</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {regras.map((r) => (
                    <RegraCard key={r.id} r={r} nameMaps={nameMaps} propMap={propMap} onEdit={() => setRegraModal(r)} onToggle={() => toggleRegra(r)} onDelete={() => removerRegra(r)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────────── PARCEIROS ─────────────── */}
          {tab === 'parceiros' && (
            <div className="mt-5">
              {parceiros.length === 0 ? (
                <div className="rounded-2xl bg-white p-10 text-center shadow-card">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoHandshake /></div>
                  <h2 className="text-lg font-bold text-ink">Cadastre quem traz negócio</h2>
                  <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Cerimonialistas, agências, promotores e afiliados. Defina um percentual padrão e acompanhe o extrato de cada parceiro.</p>
                  <button onClick={() => setParceiroModal('novo')} className="mt-6 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Novo parceiro</button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {parceiros.map((p) => {
                    const doParc = ativas.filter((c) => c.beneficiario_tipo === 'parceiro' && c.beneficiario_id === p.id);
                    const aPagar = round2(doParc.filter((c) => c.status !== 'paga').reduce((s, c) => s + (Number(c.valor_num) || 0), 0));
                    const pago = round2(doParc.filter((c) => c.status === 'paga').reduce((s, c) => s + (Number(c.valor_num) || 0), 0));
                    return <ParceiroCard key={p.id} p={p} aPagar={aPagar} pago={pago} onExtrato={() => setExtratoParceiro(p)} onEdit={() => setParceiroModal(p)} onDelete={() => removerParceiro(p)} />;
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ─────────────── MODAIS ─────────────── */}
      {regraModal && userId && (
        <RegraModal
          regra={regraModal === 'novo' ? null : regraModal}
          equipe={equipe} parceiros={parceiros} clientes={clientes} props={props}
          onClose={() => setRegraModal(null)}
          onSave={(payload, id) => salvarRegra(payload, id)}
        />
      )}
      {parceiroModal && userId && (
        <ParceiroModal parceiro={parceiroModal === 'novo' ? null : parceiroModal} onClose={() => setParceiroModal(null)} onSave={(payload, id) => salvarParceiro(payload, id)} />
      )}
      {atribuirEvento && (
        <AtribuirModal evento={atribuirEvento} equipe={equipe} parceiros={parceiros} clientes={clientes} onClose={() => setAtribuirEvento(null)} onSave={(attr) => salvarAtribuicao(atribuirEvento, attr)} />
      )}
      {pagarComissao && (
        <PagarModal comissao={pagarComissao} beneficiario={pagarComissao.beneficiario_nome || nomeBeneficiario(pagarComissao.beneficiario_tipo, pagarComissao.beneficiario_id, nameMaps)} onClose={() => setPagarComissao(null)} onPay={(meio) => pagar(pagarComissao, meio)} />
      )}
      {manualModal && (
        <ManualModal equipe={equipe} parceiros={parceiros} clientes={clientes} eventos={eventos} onClose={() => setManualModal(false)} onSave={salvarManual} />
      )}
      {extratoParceiro && (
        <ExtratoModal parceiro={extratoParceiro} comissoes={comissoesView.filter((x) => x.c.beneficiario_tipo === 'parceiro' && x.c.beneficiario_id === extratoParceiro.id)} onClose={() => setExtratoParceiro(null)} />
      )}
    </div>
  );
}

// ── Ações por linha (aprovar/pagar/cancelar/estornar) ────────────────────────
function RowActions({ c, onAprovar, onPagar, onCancelar, onEstornar, onRemover }: {
  c: ComissaoRow; onAprovar: () => void; onPagar: () => void; onCancelar: () => void; onEstornar: () => void; onRemover: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex items-center justify-end gap-1.5">
      {c.status === 'apurada' && <button onClick={onAprovar} className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100">Aprovar</button>}
      {c.status === 'aprovada' && <button onClick={onPagar} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Pagar</button>}
      {c.status === 'prevista' && <button onClick={onAprovar} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Aprovar</button>}
      {c.status === 'paga' && <button onClick={onEstornar} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-muted hover:border-red-300 hover:text-red-600">Estornar</button>}
      <div className="relative">
        <button onClick={() => setOpen((v) => !v)} onBlur={() => setTimeout(() => setOpen(false), 150)} aria-label="Mais ações" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]">⋯</button>
        {open && (
          <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-xl border border-black/[0.06] bg-white py-1 text-sm shadow-pop">
            {c.status !== 'cancelada' && c.status !== 'paga' && <button onMouseDown={onCancelar} className="block w-full px-3 py-1.5 text-left text-ink-soft hover:bg-black/[0.03]">Cancelar</button>}
            <button onMouseDown={onRemover} className="block w-full px-3 py-1.5 text-left text-red-600 hover:bg-red-50">Excluir</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Empty state (visão) ───────────────────────────────────────────────────────
function EmptyComissoes({ hasRegras, onRegra, onApurar }: { hasRegras: boolean; onRegra: () => void; onApurar: () => void }) {
  return (
    <div className="rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoHandshake /></div>
      <h2 className="text-lg font-bold text-ink">Comissões, do zero ao pagamento</h2>
      <p className="mx-auto mt-1 max-w-lg text-sm text-ink-muted">Crie regras (vendedor, parceiro, indicação), atribua quem trouxe cada evento e a Ventsy calcula, apura e prepara o pagamento — refletindo no Financeiro.</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <button onClick={onRegra} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">{hasRegras ? '+ Nova regra' : '+ Criar primeira regra'}</button>
        <button onClick={onApurar} className="rounded-xl border border-black/10 px-5 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Ir para apuração</button>
      </div>
    </div>
  );
}

// ── Card de regra ───────────────────────────────────────────────────────────
function RegraCard({ r, nameMaps, propMap, onEdit, onToggle, onDelete }: {
  r: RegraRow; nameMaps: { equipe: Map<string, string>; parceiros: Map<string, string>; clientes: Map<string, string> };
  propMap: Map<number, string>; onEdit: () => void; onToggle: () => void; onDelete: () => void;
}) {
  const meta = BENEFICIARIO_META[r.beneficiario_tipo];
  const alvo = r.beneficiario_id ? nomeBeneficiario(r.beneficiario_tipo, r.beneficiario_id, nameMaps) : `Todos os ${meta.plural.toLowerCase()}`;
  const baseLabel = BASES.find((b) => b.v === r.base)?.label || r.base;
  const valor = r.base === 'fixo' ? formatMoney(r.valor_fixo_num || 0) : formatPercent((r.percentual || 0) / 100, { maximumFractionDigits: 2 });
  const c = r.condicao || {};
  const condTags: string[] = [];
  if (c.tipo_evento) condTags.push(c.tipo_evento);
  if (c.propriedade_id != null) condTags.push(propMap.get(Number(c.propriedade_id)) || `Propriedade #${c.propriedade_id}`);
  if (c.faixa_min != null || c.faixa_max != null) condTags.push(`${c.faixa_min != null ? formatMoneyShort(c.faixa_min) : '—'}–${c.faixa_max != null ? formatMoneyShort(c.faixa_max) : '∞'}`);
  if (r.base === 'margem') condTags.push(`margem ${c.margem_pct ?? MARGEM_PADRAO_PCT}%`);
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-card transition ${r.ativo ? 'border-black/[0.06]' : 'border-black/[0.06] opacity-60'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5"><span>{meta.icon}</span><h4 className="truncate font-bold text-ink">{r.nome}</h4></div>
          <p className="mt-0.5 text-xs text-ink-muted">{alvo}</p>
        </div>
        <label className="relative inline-flex shrink-0 cursor-pointer items-center" title={r.ativo ? 'Ativa' : 'Inativa'}>
          <input type="checkbox" checked={r.ativo} onChange={onToggle} className="peer sr-only" />
          <div className="h-5 w-9 rounded-full bg-black/15 after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:bg-brand peer-checked:after:translate-x-4" />
        </label>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl font-bold text-brand">{valor}</span>
        <span className="text-xs text-ink-muted">{baseLabel.replace('% ', '').replace('Valor fixo', 'por evento')}</span>
      </div>
      {condTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {condTags.map((t, i) => <span key={i} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.65rem] text-ink-muted">{t}</span>)}
        </div>
      )}
      <div className="mt-4 flex items-center gap-3 border-t border-black/[0.06] pt-3 text-xs">
        {r.prioridade > 0 && <span className="text-ink-muted">prioridade {r.prioridade}</span>}
        <button onClick={onEdit} className="ml-auto font-semibold text-ink-soft hover:text-brand">Editar</button>
        <button onClick={onDelete} className="font-semibold text-red-600 hover:text-red-700">Excluir</button>
      </div>
    </div>
  );
}

// ── Card de parceiro ──────────────────────────────────────────────────────────
function ParceiroCard({ p, aPagar, pago, onExtrato, onEdit, onDelete }: { p: Parceiro; aPagar: number; pago: number; onExtrato: () => void; onEdit: () => void; onDelete: () => void }) {
  const wa = waLink(p.whatsapp || p.telefone);
  const mail = mailLink(p.email);
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: BENEFICIARIO_META.parceiro.cor }}>{iniciais(p.nome)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5"><span className="truncate font-bold text-ink">{p.nome}</span>{!p.ativo && <span className="rounded bg-black/[0.05] px-1 py-0.5 text-[0.55rem] font-bold uppercase text-ink-muted">inativo</span>}</div>
          <p className="text-xs text-ink-muted">{tipoParceiroLabel(p.tipo)}{p.cidade ? ` · ${p.cidade}` : ''}{p.percentual_padrao != null ? ` · ${formatPercent(p.percentual_padrao / 100, { maximumFractionDigits: 1 })} padrão` : ''}</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-black/[0.02] px-3 py-2"><div className="text-ink-muted">A receber</div><div className="font-bold text-ink">{formatMoneyShort(aPagar)}</div></div>
        <div className="rounded-xl bg-black/[0.02] px-3 py-2"><div className="text-ink-muted">Já pago</div><div className="font-bold text-emerald-600">{formatMoneyShort(pago)}</div></div>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-black/[0.06] pt-3 text-xs">
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">💬</a>}
        {mail && <a href={mail} className="rounded-lg border border-black/10 px-2 py-1 text-ink-soft">✉️</a>}
        <button onClick={onExtrato} className="ml-auto font-semibold text-brand hover:underline">Extrato</button>
        <button onClick={onEdit} className="font-semibold text-ink-soft hover:text-brand">Editar</button>
        <button onClick={onDelete} className="font-semibold text-red-600 hover:text-red-700">Excluir</button>
      </div>
    </div>
  );
}

// ── Modal base ───────────────────────────────────────────────────────────────
function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [onClose]);
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className={`relative my-8 w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} rounded-2xl bg-white p-6 shadow-pop`} onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}
function Campo({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-ink-muted">{hint}</span>}</label>;
}

// ── Modal: regra ───────────────────────────────────────────────────────────────
function RegraModal({ regra, equipe, parceiros, clientes, props, onClose, onSave }: {
  regra: RegraRow | null; equipe: EquipeLite[]; parceiros: Parceiro[]; clientes: ClienteLite[]; props: Prop[];
  onClose: () => void; onSave: (payload: Partial<RegraRow>, id?: string) => void;
}) {
  const [nome, setNome] = useState(regra?.nome || '');
  const [benefTipo, setBenefTipo] = useState<BeneficiarioTipo>(regra?.beneficiario_tipo || 'parceiro');
  const [benefId, setBenefId] = useState<string>(regra?.beneficiario_id || '');
  const [base, setBase] = useState<BaseCalculo>(regra?.base || 'valor_evento');
  const [percentual, setPercentual] = useState(regra?.percentual != null ? String(regra.percentual) : '');
  const [valorFixo, setValorFixo] = useState(regra?.valor_fixo_num != null ? String(regra.valor_fixo_num) : '');
  const [margemPct, setMargemPct] = useState(regra?.condicao?.margem_pct != null ? String(regra.condicao.margem_pct) : String(MARGEM_PADRAO_PCT));
  const [tipoEvento, setTipoEvento] = useState(regra?.condicao?.tipo_evento || '');
  const [propId, setPropId] = useState(regra?.condicao?.propriedade_id != null ? String(regra.condicao.propriedade_id) : '');
  const [faixaMin, setFaixaMin] = useState(regra?.condicao?.faixa_min != null ? String(regra.condicao.faixa_min) : '');
  const [faixaMax, setFaixaMax] = useState(regra?.condicao?.faixa_max != null ? String(regra.condicao.faixa_max) : '');
  const [vigIni, setVigIni] = useState(regra?.vigencia_inicio || '');
  const [vigFim, setVigFim] = useState(regra?.vigencia_fim || '');
  const [prioridade, setPrioridade] = useState(String(regra?.prioridade ?? 0));
  const [saving, setSaving] = useState(false);

  // sugere nome ao trocar beneficiário
  useEffect(() => { if (!regra && !nome) { /* deixa o usuário nomear */ } }, [benefTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const beneficiarios = benefTipo === 'equipe' ? equipe.map((e) => ({ v: String(e.id), label: e.nome })) : benefTipo === 'parceiro' ? parceiros.map((p) => ({ v: p.id, label: p.nome })) : clientes.map((c) => ({ v: c.id, label: c.nome }));

  function salvar() {
    const condicao: CondicaoRegra = {};
    if (tipoEvento) condicao.tipo_evento = tipoEvento;
    if (propId) condicao.propriedade_id = Number(propId);
    if (faixaMin) condicao.faixa_min = Number(faixaMin);
    if (faixaMax) condicao.faixa_max = Number(faixaMax);
    if (base === 'margem') condicao.margem_pct = margemPct ? Number(margemPct) : MARGEM_PADRAO_PCT;
    const payload: Partial<RegraRow> = {
      nome: nome.trim() || `Comissão ${BENEFICIARIO_META[benefTipo].label.toLowerCase()}`,
      beneficiario_tipo: benefTipo, beneficiario_id: benefId || null, base,
      percentual: base === 'fixo' ? null : (percentual ? Number(percentual) : 0),
      valor_fixo_num: base === 'fixo' ? (valorFixo ? Number(valorFixo) : 0) : null,
      condicao, vigencia_inicio: vigIni || null, vigencia_fim: vigFim || null,
      prioridade: Number(prioridade) || 0, ativo: regra ? regra.ativo : true,
    };
    setSaving(true); onSave(payload, regra?.id);
  }

  return (
    <Modal title={regra ? 'Editar regra' : 'Nova regra de comissão'} onClose={onClose} wide>
      <div className="space-y-4">
        <Campo label="Nome da regra"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Cerimonialista — casamentos" /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo de beneficiário">
            <select className={inp} value={benefTipo} onChange={(e) => { setBenefTipo(e.target.value as BeneficiarioTipo); setBenefId(''); }}>
              <option value="equipe">Vendedor (equipe)</option><option value="parceiro">Parceiro</option><option value="cliente">Indicação (cliente)</option>
            </select>
          </Campo>
          <Campo label="Beneficiário" hint="Vazio = vale para todos desse tipo">
            <select className={inp} value={benefId} onChange={(e) => setBenefId(e.target.value)}>
              <option value="">Todos os {BENEFICIARIO_META[benefTipo].plural.toLowerCase()}</option>
              {beneficiarios.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Base de cálculo">
            <select className={inp} value={base} onChange={(e) => setBase(e.target.value as BaseCalculo)}>
              {BASES.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}
            </select>
          </Campo>
          {base === 'fixo' ? (
            <Campo label="Valor fixo"><input type="number" min={0} step="0.01" className={inp} value={valorFixo} onChange={(e) => setValorFixo(e.target.value)} placeholder="Ex: 500" /></Campo>
          ) : (
            <Campo label="Percentual (%)"><input type="number" min={0} step="0.1" className={inp} value={percentual} onChange={(e) => setPercentual(e.target.value)} placeholder="Ex: 10" /></Campo>
          )}
        </div>
        {base === 'margem' && (
          <Campo label="Margem considerada (%)" hint="% do valor do evento tratado como margem"><input type="number" min={0} max={100} step="1" className={inp} value={margemPct} onChange={(e) => setMargemPct(e.target.value)} /></Campo>
        )}
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-4">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-ink-muted">Condições (opcional)</p>
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Tipo de evento">
              <select className={inp} value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)}>
                <option value="">Qualquer</option>{TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Campo>
            <Campo label="Propriedade">
              <select className={inp} value={propId} onChange={(e) => setPropId(e.target.value)}>
                <option value="">Qualquer</option>{props.map((p) => <option key={p.id} value={p.id}>{p.nome || `#${p.id}`}</option>)}
              </select>
            </Campo>
            <Campo label="Valor mínimo do evento"><input type="number" min={0} className={inp} value={faixaMin} onChange={(e) => setFaixaMin(e.target.value)} placeholder="—" /></Campo>
            <Campo label="Valor máximo do evento"><input type="number" min={0} className={inp} value={faixaMax} onChange={(e) => setFaixaMax(e.target.value)} placeholder="—" /></Campo>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Vigência (início)"><input type="date" className={inp} value={vigIni} onChange={(e) => setVigIni(e.target.value)} /></Campo>
          <Campo label="Vigência (fim)"><input type="date" className={inp} value={vigFim} onChange={(e) => setVigFim(e.target.value)} /></Campo>
          <Campo label="Prioridade" hint="Maior vence empate"><input type="number" min={0} className={inp} value={prioridade} onChange={(e) => setPrioridade(e.target.value)} /></Campo>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : regra ? 'Salvar regra' : 'Criar regra'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: parceiro ──────────────────────────────────────────────────────────
function ParceiroModal({ parceiro, onClose, onSave }: { parceiro: Parceiro | null; onClose: () => void; onSave: (payload: Partial<Parceiro>, id?: string) => void }) {
  const [nome, setNome] = useState(parceiro?.nome || '');
  const [tipo, setTipo] = useState(parceiro?.tipo || 'cerimonial');
  const [doc, setDoc] = useState(parceiro?.doc || '');
  const [contato, setContato] = useState(parceiro?.contato || '');
  const [email, setEmail] = useState(parceiro?.email || '');
  const [telefone, setTelefone] = useState(parceiro?.telefone || '');
  const [whatsapp, setWhatsapp] = useState(parceiro?.whatsapp || '');
  const [cidade, setCidade] = useState(parceiro?.cidade || '');
  const [estado, setEstado] = useState(parceiro?.estado || '');
  const [pctPadrao, setPctPadrao] = useState(parceiro?.percentual_padrao != null ? String(parceiro.percentual_padrao) : '');
  const [pix, setPix] = useState(parceiro?.chave_pix || '');
  const [ativo, setAtivo] = useState(parceiro ? parceiro.ativo : true);
  const [saving, setSaving] = useState(false);

  function salvar() {
    if (!nome.trim()) return;
    const payload: Partial<Parceiro> = {
      nome: nome.trim(), tipo, doc: doc.trim() || null, contato: contato.trim() || null, email: email.trim() || null,
      telefone: telefone.trim() || null, whatsapp: whatsapp.trim() || null, cidade: cidade.trim() || null,
      estado: estado.trim().toUpperCase().slice(0, 2) || null, percentual_padrao: pctPadrao ? Number(pctPadrao) : null,
      chave_pix: pix.trim() || null, ativo,
    };
    setSaving(true); onSave(payload, parceiro?.id);
  }

  return (
    <Modal title={parceiro ? 'Editar parceiro' : 'Novo parceiro'} onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nome / Razão social"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: Maria Assessoria" /></Campo>
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{TIPOS_PARCEIRO.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Documento (CPF/CNPJ)"><input className={inp} value={doc} onChange={(e) => setDoc(e.target.value)} /></Campo>
          <Campo label="% padrão" hint="Sugestão ao criar regra"><input type="number" min={0} step="0.1" className={inp} value={pctPadrao} onChange={(e) => setPctPadrao(e.target.value)} placeholder="Ex: 10" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Pessoa de contato"><input className={inp} value={contato} onChange={(e) => setContato(e.target.value)} /></Campo>
          <Campo label="E-mail"><input type="email" className={inp} value={email} onChange={(e) => setEmail(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Telefone"><input type="tel" className={inp} value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Campo>
          <Campo label="WhatsApp"><input type="tel" className={inp} value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-[1fr_88px_1fr] gap-4">
          <Campo label="Cidade"><input className={inp} value={cidade} onChange={(e) => setCidade(e.target.value)} /></Campo>
          <Campo label="UF"><input className={inp} maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value)} /></Campo>
          <Campo label="Chave Pix"><input className={inp} value={pix} onChange={(e) => setPix(e.target.value)} /></Campo>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink-soft"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-brand" /> Parceiro ativo</label>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : parceiro ? 'Salvar' : 'Cadastrar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: atribuir evento ───────────────────────────────────────────────────
function AtribuirModal({ evento, equipe, parceiros, clientes, onClose, onSave }: {
  evento: EventoRow; equipe: EquipeLite[]; parceiros: Parceiro[]; clientes: ClienteLite[];
  onClose: () => void; onSave: (attr: { vendedor_equipe_id: number | null; parceiro_id: string | null; indicado_por_id: string | null }) => void;
}) {
  const [vendedor, setVendedor] = useState(evento.vendedor_equipe_id != null ? String(evento.vendedor_equipe_id) : '');
  const [parceiro, setParceiro] = useState(evento.parceiro_id || '');
  const [indicado, setIndicado] = useState(evento.indicado_por_id || '');
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Atribuir evento" onClose={onClose}>
      <div className="mb-4 rounded-xl bg-black/[0.02] px-4 py-3">
        <p className="text-sm font-semibold text-ink">{evento.nome_evento || evento.quem_contratou || 'Evento'}</p>
        <p className="text-xs text-ink-muted">{evento.tipo_evento || '—'}{evento.data_inicio ? ` · ${formatDate(evento.data_inicio, { style: 'short' })}` : ''}{evento.valor_total_num ? ` · ${formatMoney(evento.valor_total_num)}` : ''}</p>
      </div>
      <div className="space-y-4">
        <Campo label="🧑‍💼 Vendedor (equipe)">
          <select className={inp} value={vendedor} onChange={(e) => setVendedor(e.target.value)}>
            <option value="">— ninguém —</option>{equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` (${e.cargo})` : ''}</option>)}
          </select>
        </Campo>
        <Campo label="🤝 Parceiro que trouxe">
          <select className={inp} value={parceiro} onChange={(e) => setParceiro(e.target.value)}>
            <option value="">— ninguém —</option>{parceiros.filter((p) => p.ativo || p.id === parceiro).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        </Campo>
        <Campo label="💌 Indicado por (cliente)">
          <select className={inp} value={indicado} onChange={(e) => setIndicado(e.target.value)}>
            <option value="">— ninguém —</option>{clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </Campo>
        {parceiros.length === 0 && <p className="text-xs text-ink-muted">Cadastre parceiros na aba Parceiros para atribuí-los aqui.</p>}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => { setSaving(true); onSave({ vendedor_equipe_id: vendedor ? Number(vendedor) : null, parceiro_id: parceiro || null, indicado_por_id: indicado || null }); }} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar atribuição'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: pagar ─────────────────────────────────────────────────────────────
function PagarModal({ comissao, beneficiario, onClose, onPay }: { comissao: ComissaoRow; beneficiario: string; onClose: () => void; onPay: (meio: string) => void }) {
  const [meio, setMeio] = useState(comissao.meio || 'Pix');
  const [paying, setPaying] = useState(false);
  return (
    <Modal title="Pagar comissão" onClose={onClose}>
      <div className="rounded-xl bg-black/[0.02] px-4 py-3">
        <div className="flex items-center justify-between"><span className="text-sm text-ink-muted">Beneficiário</span><span className="font-semibold text-ink">{beneficiario}</span></div>
        <div className="mt-1 flex items-center justify-between"><span className="text-sm text-ink-muted">Valor</span><span className="text-lg font-bold text-ink">{formatMoney(comissao.valor_num)}</span></div>
      </div>
      <p className="mt-3 text-xs text-ink-muted">Ao confirmar, geramos uma despesa em <strong>Financeiro</strong> (categoria “Comissões”) e marcamos a comissão como paga.</p>
      <div className="mt-4"><Campo label="Meio de pagamento"><select className={inp} value={meio} onChange={(e) => setMeio(e.target.value)}>{MEIOS.map((m) => <option key={m} value={m}>{m}</option>)}</select></Campo></div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => { setPaying(true); onPay(meio); }} disabled={paying} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{paying ? 'Pagando…' : 'Confirmar pagamento'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: comissão manual ───────────────────────────────────────────────────
function ManualModal({ equipe, parceiros, clientes, eventos, onClose, onSave }: {
  equipe: EquipeLite[]; parceiros: Parceiro[]; clientes: ClienteLite[]; eventos: EventoRow[];
  onClose: () => void; onSave: (p: { beneficiario_tipo: BeneficiarioTipo; beneficiario_id: string | null; evento_id: string | null; valor_num: number; competencia: string; status: ComissaoStatus; obs: string }) => void;
}) {
  const [tipo, setTipo] = useState<BeneficiarioTipo>('parceiro');
  const [benefId, setBenefId] = useState('');
  const [eventoId, setEventoId] = useState('');
  const [valor, setValor] = useState('');
  const [comp, setComp] = useState(ymd(new Date()).slice(0, 7) + '-01');
  const [status, setStatus] = useState<ComissaoStatus>('apurada');
  const [obs, setObs] = useState('');
  const [saving, setSaving] = useState(false);
  const beneficiarios = tipo === 'equipe' ? equipe.map((e) => ({ v: String(e.id), label: e.nome })) : tipo === 'parceiro' ? parceiros.map((p) => ({ v: p.id, label: p.nome })) : clientes.map((c) => ({ v: c.id, label: c.nome }));
  const eventosFechados = eventos.filter((e) => eventoFechado(e.status) || grupoEvento(e.status) === 'negociando');
  const n = Number(valor);
  return (
    <Modal title="Lançar comissão manual" onClose={onClose}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => { setTipo(e.target.value as BeneficiarioTipo); setBenefId(''); }}><option value="equipe">Vendedor</option><option value="parceiro">Parceiro</option><option value="cliente">Indicação</option></select></Campo>
          <Campo label="Beneficiário"><select className={inp} value={benefId} onChange={(e) => setBenefId(e.target.value)}><option value="">Selecione…</option>{beneficiarios.map((b) => <option key={b.v} value={b.v}>{b.label}</option>)}</select></Campo>
        </div>
        <Campo label="Evento (opcional)"><select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}><option value="">— nenhum —</option>{eventosFechados.slice(0, 200).map((e) => <option key={e.id} value={e.id}>{e.nome_evento || e.quem_contratou || 'Evento'}{e.data_inicio ? ` · ${e.data_inicio}` : ''}</option>)}</select></Campo>
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Valor"><input type="number" min={0} step="0.01" className={inp} value={valor} onChange={(e) => setValor(e.target.value)} /></Campo>
          <Campo label="Competência"><input type="date" className={inp} value={comp} onChange={(e) => setComp(e.target.value)} /></Campo>
          <Campo label="Status"><select className={inp} value={status} onChange={(e) => setStatus(e.target.value as ComissaoStatus)}>{(['prevista', 'apurada', 'aprovada'] as ComissaoStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}</select></Campo>
        </div>
        <Campo label="Observação"><input className={inp} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Opcional" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => { if (!benefId || !(n > 0)) return; setSaving(true); onSave({ beneficiario_tipo: tipo, beneficiario_id: benefId, evento_id: eventoId || null, valor_num: round2(n), competencia: comp, status, obs }); }} disabled={saving || !benefId || !(n > 0)} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Lançando…' : 'Lançar comissão'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── Modal: extrato do parceiro ───────────────────────────────────────────────
function ExtratoModal({ parceiro, comissoes, onClose }: { parceiro: Parceiro; comissoes: { c: ComissaoRow; beneficiario: string; evento: string | null }[]; onClose: () => void }) {
  const ativas = comissoes.filter((x) => x.c.status !== 'cancelada');
  const aReceber = round2(ativas.filter((x) => x.c.status !== 'paga').reduce((s, x) => s + (Number(x.c.valor_num) || 0), 0));
  const pago = round2(ativas.filter((x) => x.c.status === 'paga').reduce((s, x) => s + (Number(x.c.valor_num) || 0), 0));
  return (
    <Modal title={`Extrato — ${parceiro.nome}`} onClose={onClose} wide>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-black/[0.06] p-4"><div className="text-xs text-ink-muted">A receber</div><div className="mt-1 text-xl font-bold text-ink">{formatMoney(aReceber)}</div></div>
        <div className="rounded-xl border border-black/[0.06] p-4"><div className="text-xs text-ink-muted">Já pago</div><div className="mt-1 text-xl font-bold text-emerald-600">{formatMoney(pago)}</div></div>
      </div>
      {parceiro.chave_pix && <p className="mt-3 text-sm text-ink-muted">Pix: <span className="font-semibold text-ink-soft">{parceiro.chave_pix}</span></p>}
      <div className="mt-4 max-h-72 overflow-y-auto">
        {comissoes.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Sem comissões para este parceiro ainda.</p>
        ) : (
          <div className="space-y-2">
            {[...comissoes].sort((a, b) => (b.c.competencia || '').localeCompare(a.c.competencia || '')).map(({ c, evento }) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{evento || 'Comissão avulsa'}</p>
                  <p className="text-xs text-ink-muted">{c.competencia ? formatDate(c.competencia, { style: 'short' }) : '—'}{c.pago_em ? ` · pago ${formatDate(c.pago_em, { style: 'short' })}` : ''}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_META[c.status].cls}`}>{STATUS_META[c.status].label}</span>
                <span className="shrink-0 font-bold text-ink">{formatMoney(c.valor_num)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 flex items-center gap-3">
        {comissoes.length > 0 && <button onClick={() => exportComissoesCSV(comissoes)} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Exportar CSV</button>}
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Fechar</button>
      </div>
    </Modal>
  );
}

// ── KPI ──────────────────────────────────────────────────────────────────────
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

// ── Barras empilhadas por mês (SVG puro) ──────────────────────────────────────
function StackedBars({ dados }: { dados: { label: string; prevista: number; apurada: number; aprovada: number; paga: number }[] }) {
  const max = Math.max(1, ...dados.map((d) => d.prevista + d.apurada + d.aprovada + d.paga));
  const segs: { k: 'prevista' | 'apurada' | 'aprovada' | 'paga'; cor: string }[] = [
    { k: 'paga', cor: STATUS_META.paga.cor }, { k: 'aprovada', cor: STATUS_META.aprovada.cor },
    { k: 'apurada', cor: STATUS_META.apurada.cor }, { k: 'prevista', cor: STATUS_META.prevista.cor },
  ];
  const H = 160;
  return (
    <div>
      <div className="flex items-end justify-between gap-1.5" style={{ height: H }}>
        {dados.map((d, i) => {
          const total = d.prevista + d.apurada + d.aprovada + d.paga;
          return (
            <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: '100%' }}>
              <div className="flex w-full max-w-[34px] flex-col-reverse overflow-hidden rounded-md" style={{ height: `${(total / max) * (H - 24)}px` }} title={`${d.label}: ${formatMoney(total)}`}>
                {segs.map((s) => { const v = d[s.k]; if (!v) return null; return <div key={s.k} style={{ height: `${(v / (total || 1)) * 100}%`, background: s.cor }} />; })}
              </div>
              <span className="text-[0.6rem] text-ink-muted">{d.label}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
        {segs.slice().reverse().map((s) => <span key={s.k} className="flex items-center gap-1 text-[0.65rem] text-ink-muted"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.cor }} />{STATUS_META[s.k].label}</span>)}
      </div>
    </div>
  );
}

// ── Ícones (SVG inline) ──────────────────────────────────────────────────────
const svg = (path: ReactNode, size = 15, sw = 1.8) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>;
const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>, 15);
const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15);
const IcoPercent = ({ size = 15 }: { size?: number }) => svg(<><path d="M19 5 5 19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></>, size);
const IcoBolt = () => svg(<path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />, 15);
const IcoHandshake = () => svg(<path d="m11 17 2 2a1 1 0 1 0 3-3M11 17l-3.5-3.5a1.5 1.5 0 0 1 0-2.1l3-3a2 2 0 0 1 2.8 0l3.7 3.6M3 13l3 3M21 13l-3 3M7 8 4 11M2 8l4-4 3 1 5 1" />, 22);
const IcoSearch = () => svg(<path d="M21 21l-4.3-4.3M11 19a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z" />, 14);
const IcoDownload = () => svg(<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />, 13);

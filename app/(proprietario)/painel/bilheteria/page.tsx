'use client';

// Ingressos & Bilheteria — /painel/bilheteria.
// Vende ingressos para eventos que o espaço promove/hospeda: corrida de rua
// (inscrição + kit), exposição de carros, vaquejada/rodeio, air show, show,
// festa de igreja com convite pago, feira (ingresso + credencial). Lotes,
// categorias, cupons, meia-entrada, venda online (Mercado Pago), QR para
// check-in (integra /painel/acesso) e prestação de contas no Financeiro.
// PILARES (5 abas):
//   • Painel    — KPIs (receita, vendidos, ticket médio, lotação), curva, mapa.
//   • Ingressos — configurar a venda: dados, categorias/lotes, cupons, link.
//   • Vendas    — pedidos em tempo real, cortesia, reembolso/cancelamento, CSV.
//   • Check-in  — leitura de QR (coletor/câmera) → /api/bilheteria/checkin.
//   • Financeiro— receita → lançamentos (auto no pagamento) + conciliação MP.
// Engine pura: lib/bilheteria.ts + lib/qrcode.ts. Checkout/webhook/check-in
// autoritativos: /api/bilheteria. Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import type { TablesInsert, TablesUpdate } from '@/types/supabase';
import { formatDate, getFormatPrefs } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type BilheteriaEvento, type Categoria, type Cupom, type Pedido, type Ingresso,
} from '@/lib/bilheteria';
import {
  type EventoLite, eventoLabel, isMissingTable, gerarToken, linkPublico,
} from './_lib';
import { Painel } from './_components/Painel';
import { Config } from './_components/Config';
import { Vendas } from './_components/Vendas';
import { Checkin } from './_components/Checkin';
import { Financeiro } from './_components/Financeiro';
import { BilheteriaModal, CategoriaModal, CupomModal, EmitirModal } from './_components/Modals';
import { IcoLink, IcoCopy, IcoEdit, IcoTicket } from './_components/Icons';

const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';
type Tab = 'painel' | 'config' | 'vendas' | 'checkin' | 'financeiro';
const STATUS_LABEL: Record<string, string> = { rascunho: 'Rascunho', publicado: 'Publicada', encerrado: 'Encerrada' };
const STATUS_CHIP: Record<string, string> = {
  rascunho: 'bg-gray-100 text-gray-600', publicado: 'bg-emerald-50 text-emerald-700', encerrado: 'bg-red-50 text-red-700',
};

export default function BilheteriaPage() {
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('painel');

  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [bilheterias, setBilheterias] = useState<BilheteriaEvento[]>([]);
  const [bilhSel, setBilhSel] = useState<string>('');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [ingressos, setIngressos] = useState<Ingresso[]>([]);

  // modais
  const [bilhModal, setBilhModal] = useState<{ editing: BilheteriaEvento | null } | null>(null);
  const [catModal, setCatModal] = useState<{ editing: Categoria | null } | null>(null);
  const [cupomModal, setCupomModal] = useState<{ editing: Cupom | null } | null>(null);
  const [emitirModal, setEmitirModal] = useState(false);
  const [copiado, setCopiado] = useState(false);

  const bilheteria = useMemo(() => bilheterias.find((b) => b.id === bilhSel) || null, [bilheterias, bilhSel]);

  // ── Carregamento ──
  const carregarBase = useCallback(async (uid: string) => {
    const [evRes, bRes] = await Promise.all([
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,propriedade_id').eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('bilheteria_eventos').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
    ]);
    setEventos(evRes.error ? [] : (evRes.data || []) as EventoLite[]);
    if (isMissingTable(bRes.error)) { setNeedsSetup(true); return []; }
    setNeedsSetup(false);
    const bs = (bRes.data || []) as BilheteriaEvento[];
    setBilheterias(bs);
    return bs;
  }, []);

  const carregarDados = useCallback(async (bilheteriaId: string) => {
    if (!bilheteriaId) { setCategorias([]); setCupons([]); setPedidos([]); setIngressos([]); return; }
    const [catRes, cupRes, pedRes, ingRes] = await Promise.all([
      sb.from('ingressos_categorias').select('*').eq('bilheteria_id', bilheteriaId).order('ordem', { ascending: true }),
      sb.from('bilheteria_cupons').select('*').eq('bilheteria_id', bilheteriaId).order('criado_em', { ascending: false }),
      sb.from('pedidos_ingresso').select('*').eq('bilheteria_id', bilheteriaId).order('criado_em', { ascending: false }).limit(5000),
      sb.from('ingressos').select('*').eq('bilheteria_id', bilheteriaId).order('criado_em', { ascending: false }).limit(20000),
    ]);
    setCategorias(catRes.error ? [] : (catRes.data || []) as Categoria[]);
    setCupons(cupRes.error ? [] : (cupRes.data || []) as Cupom[]);
    setPedidos(pedRes.error ? [] : (pedRes.data || []) as Pedido[]);
    setIngressos(ingRes.error ? [] : (ingRes.data || []) as Ingresso[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);
      const bs = await carregarBase(uid);
      const first = bs[0]?.id || '';
      setBilhSel(first);
      if (first) await carregarDados(first);
      setLoading(false);
    })();
  }, [carregarBase, carregarDados]);

  const trocarBilheteria = useCallback(async (id: string) => {
    setBilhSel(id);
    setLoading(true); await carregarDados(id); setLoading(false);
  }, [carregarDados]);

  const refetch = useCallback(() => { if (bilhSel) carregarDados(bilhSel); }, [bilhSel, carregarDados]);
  const refetchBase = useCallback(async () => { if (userId) await carregarBase(userId); }, [userId, carregarBase]);

  // ── Mutações: bilheteria ──
  async function salvarBilheteria(payload: Partial<BilheteriaEvento>, editing: BilheteriaEvento | null): Promise<boolean> {
    if (!userId) return false;
    if (editing) {
      const { error } = await sb.from('bilheteria_eventos').update(payload as TablesUpdate<'bilheteria_eventos'>).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar a bilheteria.'); return false; }
      toast.success('Bilheteria atualizada.');
      await refetchBase();
    } else {
      const row = { ...payload, usuario_id: userId, pagina_token: gerarToken(), status: payload.status || 'rascunho' };
      const { data, error } = await sb.from('bilheteria_eventos').insert(row as TablesInsert<'bilheteria_eventos'>).select('*').single();
      if (error) { toast.error('Não foi possível criar a bilheteria.'); return false; }
      toast.success('Bilheteria criada. Configure as categorias de ingresso.');
      const bs = await carregarBase(userId);
      const novo = (data as BilheteriaEvento)?.id || bs[0]?.id || '';
      setBilhSel(novo); await carregarDados(novo); setTab('config');
    }
    return true;
  }

  async function mudarStatus(b: BilheteriaEvento, status: string) {
    if (status === 'publicado' && categorias.length === 0) {
      toast.info('Adicione ao menos uma categoria de ingresso antes de publicar.');
      return;
    }
    const { error } = await sb.from('bilheteria_eventos').update({ status }).eq('id', b.id);
    if (error) { toast.error('Não foi possível alterar o status.'); return; }
    setBilheterias((arr) => arr.map((x) => (x.id === b.id ? { ...x, status } : x)));
    toast.success(status === 'publicado' ? 'Bilheteria publicada — vendas abertas!' : status === 'encerrado' ? 'Vendas encerradas.' : 'Bilheteria em rascunho.');
  }

  // ── Mutações: categorias ──
  async function salvarCategoria(payload: Partial<Categoria>, editing: Categoria | null): Promise<boolean> {
    if (!userId || !bilhSel) return false;
    if (editing) {
      const { error } = await sb.from('ingressos_categorias').update(payload as TablesUpdate<'ingressos_categorias'>).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar a categoria.'); return false; }
      toast.success('Categoria salva.');
    } else {
      const { error } = await sb.from('ingressos_categorias').insert({ ...payload, usuario_id: userId, bilheteria_id: bilhSel, ordem: payload.ordem ?? categorias.length } as TablesInsert<'ingressos_categorias'>);
      if (error) { toast.error('Não foi possível criar a categoria.'); return false; }
      toast.success('Categoria criada.');
    }
    refetch();
    return true;
  }
  async function removerCategoria(c: Categoria) {
    const { error } = await sb.from('ingressos_categorias').delete().eq('id', c.id);
    if (error) { toast.error('Não foi possível remover (há ingressos vendidos? desative em vez de excluir).'); return; }
    toast.success('Categoria removida.'); refetch();
  }

  // ── Mutações: cupons ──
  async function salvarCupom(payload: Partial<Cupom>, editing: Cupom | null): Promise<boolean> {
    if (!userId || !bilhSel) return false;
    if (editing) {
      const { error } = await sb.from('bilheteria_cupons').update(payload).eq('id', editing.id);
      if (error) { toast.error('Não foi possível salvar o cupom.'); return false; }
      toast.success('Cupom salvo.');
    } else {
      const { error } = await sb.from('bilheteria_cupons').insert({ ...payload, usuario_id: userId, bilheteria_id: bilhSel } as TablesInsert<'bilheteria_cupons'>);
      if (error) { toast.error(error.message?.includes('duplicate') ? 'Já existe um cupom com esse código.' : 'Não foi possível criar o cupom.'); return false; }
      toast.success('Cupom criado.');
    }
    refetch();
    return true;
  }
  async function removerCupom(c: Cupom) {
    const { error } = await sb.from('bilheteria_cupons').delete().eq('id', c.id);
    if (error) { toast.error('Não foi possível remover o cupom.'); return; }
    refetch();
  }

  // ── Emissão manual (cortesia / venda no balcão) — client-side via RLS ──
  async function emitir(args: { categoria_id: string; qtd: number; comprador: { nome: string; email: string; doc: string }; canal: 'cortesia' | 'manual' }): Promise<boolean> {
    if (!userId || !bilhSel) return false;
    const cat = categorias.find((c) => c.id === args.categoria_id);
    if (!cat) return false;
    const valorUnit = args.canal === 'cortesia' ? 0 : Number(cat.preco_num) || 0;
    const qtd = Math.max(1, Math.floor(args.qtd));
    const total = valorUnit * qtd;
    const { data: pedido, error } = await sb.from('pedidos_ingresso').insert({
      usuario_id: userId, bilheteria_id: bilhSel, comprador_nome: args.comprador.nome || 'Cortesia',
      comprador_email: args.comprador.email || null, comprador_doc: args.comprador.doc || null,
      subtotal_num: total, desconto_num: 0, taxa_num: 0, total_num: total, moeda: bilheteria?.moeda || 'BRL',
      status: 'pago', canal: args.canal, pago_em: new Date().toISOString(),
    }).select('*').single();
    if (error || !pedido) { toast.error('Não foi possível emitir.'); return false; }

    const linhas = Array.from({ length: qtd }, () => ({
      usuario_id: userId, bilheteria_id: bilhSel, pedido_id: pedido.id, categoria_id: cat.id,
      comprador_nome: args.comprador.nome || null, comprador_doc: args.comprador.doc || null, email: args.comprador.email || null,
      qr_token: gerarToken(), valor_num: valorUnit, meia: false, status: 'pago',
    }));
    const { error: ingErr } = await sb.from('ingressos').insert(linhas);
    if (ingErr) { await sb.from('pedidos_ingresso').delete().eq('id', pedido.id); toast.error('Falha ao emitir os ingressos.'); return false; }

    // Receita no financeiro (só venda manual com valor) — best-effort.
    if (total > 0) {
      try {
        await sb.from('lancamentos').insert({
          usuario_id: userId, tipo: 'receita', categoria: 'Bilheteria',
          descricao: `Ingressos (balcão) — ${bilheteria?.titulo || 'evento'}`,
          valor: total, status: 'pago', data: new Date().toISOString().slice(0, 10),
          metodo_pagamento: 'Manual', pedido_ingresso_id: pedido.id,
        });
      } catch { /* schema divergente — ignora */ }
    }
    toast.success(`${qtd} ingresso(s) emitido(s).`);
    setEmitirModal(false);
    refetch();
    return true;
  }

  // ── Reembolso / cancelamento de um pedido ──
  async function alterarPedido(p: Pedido, novo: 'reembolsado' | 'cancelado'): Promise<void> {
    const { error } = await sb.from('pedidos_ingresso').update({ status: novo }).eq('id', p.id);
    if (error) { toast.error('Não foi possível atualizar o pedido.'); return; }
    await sb.from('ingressos').update({ status: 'cancelado' }).eq('pedido_id', p.id).neq('status', 'cancelado');
    // Estorna a receita no financeiro.
    try { await sb.from('lancamentos').delete().eq('pedido_ingresso_id', p.id); } catch { /* ignora */ }
    setPedidos((arr) => arr.map((x) => (x.id === p.id ? { ...x, status: novo } : x)));
    setIngressos((arr) => arr.map((x) => (x.pedido_id === p.id ? { ...x, status: 'cancelado' } : x)));
    toast.success(novo === 'reembolsado' ? 'Pedido marcado como reembolsado.' : 'Pedido cancelado.');
  }

  function copiarLink() {
    if (!bilheteria) return;
    const url = linkPublico(bilheteria.pagina_token);
    navigator.clipboard?.writeText(url).then(() => { setCopiado(true); toast.success('Link copiado!'); setTimeout(() => setCopiado(false), 2000); }).catch(() => toast.error('Não foi possível copiar.'));
  }

  // ── Loading ──
  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-[92px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Ingressos & Bilheteria</h1>
          <p className="mt-1 text-sm text-ink-muted">Venda online com lotes, cupons e meia-entrada; QR para check-in e receita no Financeiro.</p>
        </div>
        {!needsSetup && bilheterias.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <select value={bilhSel} onChange={(e) => trocarBilheteria(e.target.value)} className={`${selCls} min-w-[200px]`}>
              {bilheterias.map((b) => <option key={b.id} value={b.id}>{b.titulo}</option>)}
            </select>
            <button onClick={() => setBilhModal({ editing: null })} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium hover:bg-black/[0.03]">+ Nova</button>
          </div>
        )}
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          O módulo de bilheteria ainda não foi ativado. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/bilheteria.sql</code> no Supabase para criar <code className="rounded bg-amber-100 px-1 py-0.5">bilheteria_eventos</code>, <code className="rounded bg-amber-100 px-1 py-0.5">ingressos_categorias</code>, <code className="rounded bg-amber-100 px-1 py-0.5">bilheteria_cupons</code>, <code className="rounded bg-amber-100 px-1 py-0.5">pedidos_ingresso</code> e <code className="rounded bg-amber-100 px-1 py-0.5">ingressos</code>.
        </div>
      )}

      {!needsSetup && bilheterias.length === 0 ? (
        <EmptyBilheteria onCriar={() => setBilhModal({ editing: null })} />
      ) : !needsSetup && bilheteria && (
        <>
          {/* Faixa da bilheteria (status + link público) */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand"><IcoTicket size={22} /></span>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-ink">{bilheteria.titulo}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${STATUS_CHIP[bilheteria.status] || 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[bilheteria.status] || bilheteria.status}</span>
                </div>
                <div className="text-xs text-ink-muted">
                  {bilheteria.evento_id ? (eventoLabel(eventos.find((e) => e.id === bilheteria.evento_id)) + ' · ') : ''}
                  {bilheteria.venda_fim ? `vendas até ${formatDate(bilheteria.venda_fim, { style: 'short' })}` : 'sem data de encerramento'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={copiarLink} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium hover:bg-black/[0.03]">
                {copiado ? <IcoCopy size={15} /> : <IcoLink size={15} />}{copiado ? 'Copiado' : 'Link de venda'}
              </button>
              <a href={linkPublico(bilheteria.pagina_token)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium hover:bg-black/[0.03]">Abrir página</a>
              <button onClick={() => setBilhModal({ editing: bilheteria })} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm font-medium hover:bg-black/[0.03]"><IcoEdit size={15} /> Editar</button>
              {bilheteria.status !== 'publicado'
                ? <button onClick={() => mudarStatus(bilheteria, 'publicado')} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Publicar</button>
                : <button onClick={() => mudarStatus(bilheteria, 'encerrado')} className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Encerrar</button>}
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
            {([['painel', 'Painel'], ['config', 'Ingressos'], ['vendas', 'Vendas'], ['checkin', 'Check-in'], ['financeiro', 'Financeiro']] as [Tab, string][]).map(([k, lab]) => (
              <button key={k} onClick={() => setTab(k)} className={`shrink-0 border-b-2 px-4 py-2.5 text-sm font-semibold transition ${tab === k ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink-soft'}`}>{lab}</button>
            ))}
          </div>

          {tab === 'painel' && <Painel bilheteria={bilheteria} categorias={categorias} pedidos={pedidos} ingressos={ingressos} onIrConfig={() => setTab('config')} />}
          {tab === 'config' && (
            <Config
              bilheteria={bilheteria} categorias={categorias} cupons={cupons} ingressos={ingressos}
              onNovaCategoria={() => setCatModal({ editing: null })} onEditarCategoria={(c) => setCatModal({ editing: c })} onRemoverCategoria={removerCategoria}
              onNovoCupom={() => setCupomModal({ editing: null })} onEditarCupom={(c) => setCupomModal({ editing: c })} onRemoverCupom={removerCupom}
              onEditarBilheteria={() => setBilhModal({ editing: bilheteria })}
            />
          )}
          {tab === 'vendas' && (
            <Vendas bilheteria={bilheteria} pedidos={pedidos} ingressos={ingressos} categorias={categorias}
              onEmitir={() => setEmitirModal(true)} onReembolsar={(p) => alterarPedido(p, 'reembolsado')} onCancelar={(p) => alterarPedido(p, 'cancelado')} onSync={refetch} />
          )}
          {tab === 'checkin' && <Checkin ingressos={ingressos} categorias={categorias} onSync={refetch} />}
          {tab === 'financeiro' && <Financeiro bilheteria={bilheteria} pedidos={pedidos} />}
        </>
      )}

      {/* Modais */}
      {bilhModal && (
        <BilheteriaModal editing={bilhModal.editing} eventos={eventos} defaultMoeda={getFormatPrefs().currency}
          onClose={() => setBilhModal(null)} onSave={(p) => salvarBilheteria(p, bilhModal.editing).then((ok) => { if (ok) setBilhModal(null); })} />
      )}
      {catModal && (
        <CategoriaModal editing={catModal.editing} moeda={bilheteria?.moeda || 'BRL'}
          onClose={() => setCatModal(null)} onSave={(p) => salvarCategoria(p, catModal.editing).then((ok) => { if (ok) setCatModal(null); })} />
      )}
      {cupomModal && (
        <CupomModal editing={cupomModal.editing} moeda={bilheteria?.moeda || 'BRL'}
          onClose={() => setCupomModal(null)} onSave={(p) => salvarCupom(p, cupomModal.editing).then((ok) => { if (ok) setCupomModal(null); })} />
      )}
      {emitirModal && (
        <EmitirModal categorias={categorias} onClose={() => setEmitirModal(false)} onEmitir={emitir} />
      )}
    </div>
  );
}

// ── Empty state ──
function EmptyBilheteria({ onCriar }: { onCriar: () => void }) {
  return (
    <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white px-6 py-16 text-center">
      <span className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoTicket size={34} /></span>
      <h2 className="text-lg font-bold text-ink">Crie sua primeira bilheteria</h2>
      <p className="mt-1 max-w-md text-sm text-ink-muted">Monte a página de venda de ingressos do seu evento: defina categorias e lotes, cupons, meia-entrada e venda online com Mercado Pago. O QR de cada ingresso já integra o check-in.</p>
      <button onClick={onCriar} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">+ Nova bilheteria</button>
    </div>
  );
}

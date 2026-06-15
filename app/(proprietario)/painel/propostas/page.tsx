'use client';

// Orçamentos & Propostas — /painel/propostas
// Transforma um lead (clientes_eventos) em proposta comercial profissional:
// construtor que puxa preço da MESMA engine (lib/pricing.ts) → PDF (jspdf) +
// link público (/proposta/[token]) → cliente aceita/recusa sem login → o aceite
// vira CONTRATO + parcelas + move o funil (função SQL aceitar_proposta, atômica).
// Pilares: funil/KPIs de conversão · construtor · envio · conversão.
// Fonte: propostas (RLS por dono) + clientes_eventos, precos_*, empresa_config.
// Sem "R$" hardcoded — tudo via lib/format (moeda por proposta).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate, formatPercent, getFormatPrefs, type Currency } from '@/lib/format';
import { useToast } from '@/components/Toast';
import type { PrecoTabela, PrecoRegra, Taxa } from '@/lib/pricing';
import type { Pacote } from '../precificacao/_lib';
import {
  ABERTAS, STATUS, STATUS_BY, clienteDoEvento, estaVencida, isMissingTable, numeroLabel,
  type Empresa, type Evento, type Proposta, type PropostaStatus, type Propriedade,
} from './_lib';
import { Icon } from './_components/ui';
import { Construtor } from './_components/Construtor';
import { PropostaView } from './_components/PropostaView';
import { buildPropostaPDF } from './_pdf';

const numOrNull = (v: unknown) => (v == null || v === '' ? null : Number(v));
const propId = (v: unknown) => (v == null ? null : Number(v));

// Normaliza uma linha crua de `propostas` (jsonb + numéricos) para o tipo Proposta.
function mapProposta(r: Record<string, unknown>): Proposta {
  const cp = r.condicoes_pagamento as { metodo?: string; parcelas?: unknown } | null;
  return {
    ...(r as unknown as Proposta),
    itens: Array.isArray(r.itens) ? (r.itens as Proposta['itens']) : [],
    condicoes_pagamento: cp && typeof cp === 'object'
      ? { metodo: cp.metodo, parcelas: Array.isArray(cp.parcelas) ? (cp.parcelas as Proposta['condicoes_pagamento']['parcelas']) : [] }
      : { parcelas: [] },
    subtotal_num: Number(r.subtotal_num) || 0,
    desconto_num: Number(r.desconto_num) || 0,
    total_num: Number(r.total_num) || 0,
    numero: Number(r.numero) || 0,
    moeda: (r.moeda as Currency) || getFormatPrefs().currency,
    propriedade_id: propId(r.propriedade_id),
  };
}

export default function PropostasPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [plano, setPlano] = useState('basico');

  const [propostas, setPropostas] = useState<Proposta[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [tabelas, setTabelas] = useState<PrecoTabela[]>([]);
  const [regras, setRegras] = useState<PrecoRegra[]>([]);
  const [taxas, setTaxas] = useState<Taxa[]>([]);
  const [pacotes, setPacotes] = useState<Pacote[]>([]);
  const [empresa, setEmpresa] = useState<Empresa | null>(null);

  const [construtor, setConstrutor] = useState<{ editando: Proposta | null } | null>(null);
  const [detalhe, setDetalhe] = useState<Proposta | null>(null);
  const [fStatus, setFStatus] = useState<'all' | PropostaStatus>('all');
  const [busca, setBusca] = useState('');
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const [origin, setOrigin] = useState('');

  useEffect(() => { setOrigin(window.location.origin); }, []);

  const eventoById = useMemo(() => new Map(eventos.map((e) => [e.id, e])), [eventos]);
  const propById = useMemo(() => new Map(propriedades.map((p) => [p.id, p])), [propriedades]);

  const carregar = useCallback(async (uid: string) => {
    const [pRes, evRes, prRes, tRes, rRes, xRes, pkRes, cfgRes, assinRes] = await Promise.all([
      sb.from('propostas').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,documento,email,telefones,tipo_evento,status,data_inicio,data_fim,qtd_adultos,qtd_criancas,valor_total_num,propriedade_id,cliente_id').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('propriedades').select('id,nome,cidade,estado').eq('usuario_id', uid).order('id'),
      sb.from('precos_tabela').select('*').eq('usuario_id', uid),
      sb.from('precos_regras').select('*').eq('usuario_id', uid),
      sb.from('taxas').select('*').eq('usuario_id', uid),
      sb.from('pacotes').select('*').eq('usuario_id', uid),
      sb.from('empresa_config').select('razao_social,fantasia,cnpj,logo_url,contatos,endereco').eq('usuario_id', uid).maybeSingle(),
      sb.from('assinaturas').select('*').eq('usuario_id', uid).maybeSingle(),
    ]);

    if (isMissingTable(pRes.error)) {
      setNeedsSetup(true);
      setPropostas([]);
    } else {
      setNeedsSetup(false);
      setPropostas(((pRes.data || []) as Record<string, unknown>[]).map(mapProposta));
    }

    setEventos((evRes.data || []) as Evento[]);
    setPropriedades((prRes.data || []) as Propriedade[]);
    setTabelas(((tRes.data || []) as PrecoTabela[]).map((r) => ({ ...r, valor_base_num: Number(r.valor_base_num) || 0, custo_num: numOrNull(r.custo_num), concorrencia_num: numOrNull(r.concorrencia_num), propriedade_id: propId(r.propriedade_id), espaco_id: propId(r.espaco_id) })));
    setRegras(((rRes.data || []) as PrecoRegra[]).map((r) => ({ ...r, ajuste_valor: Number(r.ajuste_valor) || 0, prioridade: Number(r.prioridade) || 0, condicao: r.condicao || {} })));
    setTaxas(((xRes.data || []) as Taxa[]).map((r) => ({ ...r, valor: Number(r.valor) || 0, propriedade_id: propId(r.propriedade_id) })));
    setPacotes(((pkRes.data || []) as Pacote[]).map((r) => ({ ...r, valor_num: Number(r.valor_num) || 0, itens: Array.isArray(r.itens) ? r.itens : [], propriedade_id: propId(r.propriedade_id) })));
    setEmpresa((cfgRes.data as Empresa) || null);
    const a = assinRes.data as { plano_ativo?: string; plano?: string } | null;
    if (a) setPlano((a.plano_ativo || a.plano || 'basico').toString().toLowerCase());
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

  const refetch = useCallback(() => { if (userId) carregar(userId); }, [userId, carregar]);

  // ── KPIs / funil ──
  const kpis = useMemo(() => {
    const aceitas = propostas.filter((p) => p.status === 'aceita');
    const recusadas = propostas.filter((p) => p.status === 'recusada');
    const enviadasOuMais = propostas.filter((p) => p.status !== 'rascunho');
    const emNegociacao = propostas.filter((p) => ABERTAS.has(p.status) && !estaVencida(p));
    const valorNeg = emNegociacao.reduce((s, p) => s + p.total_num, 0);
    const valorGanho = aceitas.reduce((s, p) => s + p.total_num, 0);
    const decididas = aceitas.length + recusadas.length;
    const conversao = decididas > 0 ? aceitas.length / decididas : 0;
    const ticket = aceitas.length > 0 ? valorGanho / aceitas.length : 0;
    // tempo médio até aceite (dias)
    const tempos = aceitas
      .filter((p) => p.aceita_em && p.criado_em)
      .map((p) => (new Date(p.aceita_em as string).getTime() - new Date(p.criado_em).getTime()) / 86400000)
      .filter((d) => d >= 0);
    const tempoMedio = tempos.length ? tempos.reduce((s, d) => s + d, 0) / tempos.length : null;
    const porStatus = Object.fromEntries(STATUS.map((s) => [s.v, propostas.filter((p) => p.status === s.v).length])) as Record<PropostaStatus, number>;
    return { total: propostas.length, abertas: emNegociacao.length, valorNeg, valorGanho, conversao, ticket, tempoMedio, porStatus, enviadas: enviadasOuMais.length };
  }, [propostas]);

  // ── Lista filtrada ──
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return propostas.filter((p) => {
      if (fStatus !== 'all' && p.status !== fStatus) return false;
      if (!q) return true;
      const ev = p.evento_id ? eventoById.get(p.evento_id) : null;
      return [p.titulo, numeroLabel(p.numero), clienteDoEvento(ev), ev?.nome_evento].filter(Boolean).join(' ').toLowerCase().includes(q);
    });
  }, [propostas, fStatus, busca, eventoById]);

  const moedaConta = getFormatPrefs().currency;
  const linkPublico = (p: Proposta) => `${origin}/proposta/${p.link_token}`;

  // ── Ações ──
  async function copiarLink(p: Proposta) {
    try { await navigator.clipboard.writeText(linkPublico(p)); toast.success('Link copiado para a área de transferência.'); }
    catch { toast.error('Não foi possível copiar o link.'); }
    if (p.status === 'rascunho') await marcarEnviada(p);
  }
  async function marcarEnviada(p: Proposta) {
    const { error } = await sb.from('propostas').update({ status: 'enviada', enviada_em: new Date().toISOString() }).eq('id', p.id);
    if (error) { toast.error('Não foi possível atualizar o status.'); return; }
    setPropostas((arr) => arr.map((x) => (x.id === p.id ? { ...x, status: 'enviada' } : x)));
  }
  async function baixarPDF(p: Proposta) {
    const ev = p.evento_id ? eventoById.get(p.evento_id) ?? null : null;
    const propNome = p.propriedade_id ? propById.get(p.propriedade_id)?.nome ?? null : null;
    const doc = await buildPropostaPDF({
      data: { numero: p.numero, titulo: p.titulo, moeda: p.moeda, itens: p.itens, subtotal_num: p.subtotal_num, desconto_num: p.desconto_num, total_num: p.total_num, validade: p.validade, condicoes_pagamento: p.condicoes_pagamento, observacoes: p.observacoes, condicoes: p.condicoes, criado_em: p.criado_em },
      empresa, evento: ev, propriedadeNome: propNome, publicUrl: linkPublico(p),
    });
    doc.save(`proposta-${String(p.numero).padStart(4, '0')}.pdf`);
  }
  async function aceitarManual(p: Proposta) {
    const res = await fetch('/api/propostas/publica', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ token: p.link_token, action: 'aceitar' }),
    }).then((r) => r.json()).catch(() => null);
    if (!res?.ok) { toast.error(res?.error === 'expirada' ? 'Proposta expirada.' : 'Não foi possível aceitar.'); return; }
    toast.success('Proposta aceita — contrato e parcelas gerados.');
    setDetalhe(null);
    refetch();
  }
  async function recusarManual(p: Proposta) {
    const { error } = await sb.from('propostas').update({ status: 'recusada', recusada_em: new Date().toISOString() }).eq('id', p.id);
    if (error) { toast.error('Não foi possível recusar.'); return; }
    toast.info('Proposta marcada como recusada.');
    setDetalhe(null);
    refetch();
  }
  async function excluir(p: Proposta) {
    if (confirmDel !== p.id) { setConfirmDel(p.id); setTimeout(() => setConfirmDel((c) => (c === p.id ? null : c)), 3000); return; }
    const { error } = await sb.from('propostas').delete().eq('id', p.id);
    setConfirmDel(null);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    setPropostas((arr) => arr.filter((x) => x.id !== p.id));
    toast.success('Proposta excluída.');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[52px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-[280px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const vazio = propostas.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Propostas</h1>
          <p className="mt-1 text-sm text-ink-muted">Orçamento profissional com a <Link href="/painel/precificacao" className="font-semibold text-brand underline">mesma engine de preço</Link> → PDF/link → aceite vira contrato.</p>
        </div>
        <button onClick={() => setConstrutor({ editando: null })} disabled={needsSetup} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
          <Icon name="plus" size={14} /> Nova proposta
        </button>
      </div>

      {needsSetup && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          As tabelas de propostas ainda não foram criadas. Rode a migration <code className="rounded bg-amber-100 px-1 py-0.5">docs/sql/propostas.sql</code> no Supabase para ativar este módulo.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Em negociação" value={formatMoneyShort(kpis.valorNeg, { currency: moedaConta })} sub={`${kpis.abertas} proposta${kpis.abertas === 1 ? '' : 's'} aberta${kpis.abertas === 1 ? '' : 's'}`} icon={<Icon name="funnel" size={15} />} tone="azul" />
        <Kpi label="Taxa de conversão" value={formatPercent(kpis.conversao, { maximumFractionDigits: 0 })} sub={`${kpis.porStatus.aceita} aceita${kpis.porStatus.aceita === 1 ? '' : 's'} · ${kpis.porStatus.recusada} recusada${kpis.porStatus.recusada === 1 ? '' : 's'}`} icon={<Icon name="trending" size={15} />} tone="verde" />
        <Kpi label="Ticket médio" value={formatMoneyShort(kpis.ticket, { currency: moedaConta })} sub={`${formatMoneyShort(kpis.valorGanho, { currency: moedaConta })} ganho`} icon={<Icon name="coins" size={15} />} tone="brand" />
        <Kpi label="Tempo até aceite" value={kpis.tempoMedio == null ? '—' : `${Math.round(kpis.tempoMedio)} d`} sub="média desde a criação" icon={<Icon name="clock" size={15} />} tone="ambar" />
      </div>

      {/* Funil */}
      {!vazio && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-card">
          {STATUS.map((s) => {
            const n = kpis.porStatus[s.v];
            const active = fStatus === s.v;
            return (
              <button key={s.v} onClick={() => setFStatus(active ? 'all' : s.v)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${active ? 'bg-ink text-white' : s.cls + ' hover:opacity-80'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-white' : s.dot}`} /> {s.label}
                <span className={`rounded-full px-1.5 text-[0.6rem] font-bold ${active ? 'bg-white/20' : 'bg-black/[0.06]'}`}>{n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Busca */}
      {!vazio && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="eye" size={14} /></span>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, evento ou número…" className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
          </div>
          {fStatus !== 'all' && <button onClick={() => setFStatus('all')} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm font-medium text-ink-muted hover:text-ink">Limpar filtro</button>}
        </div>
      )}

      {/* Lista */}
      <div className="mt-4">
        {vazio ? (
          <EmptyState onNew={() => setConstrutor({ editando: null })} disabled={needsSetup} />
        ) : lista.length === 0 ? (
          <div className="rounded-2xl bg-white py-12 text-center text-sm text-ink-muted shadow-card">Nenhuma proposta para o filtro atual.</div>
        ) : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="divide-y divide-black/[0.05]">
              {lista.map((p) => {
                const ev = p.evento_id ? eventoById.get(p.evento_id) ?? null : null;
                const vencida = estaVencida(p);
                const st = vencida ? STATUS_BY.expirada : STATUS_BY[p.status];
                return (
                  <div key={p.id} className="group flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-black/[0.01]">
                    <button onClick={() => setDetalhe(p)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-xs font-bold text-brand">{String(p.numero).padStart(3, '0')}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-ink">{clienteDoEvento(ev)}</span>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${st.cls}`}>{st.label}</span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-ink-muted">{p.titulo}{ev?.data_inicio ? ` · ${formatDate(ev.data_inicio)}` : ''}{p.validade ? ` · vence ${formatDate(p.validade)}` : ''}</div>
                      </div>
                    </button>
                    <div className="text-right">
                      <div className="text-sm font-bold tabular-nums text-ink">{formatMoney(p.total_num, { currency: p.moeda })}</div>
                      {p.condicoes_pagamento.parcelas.length > 0 && <div className="text-[0.62rem] text-ink-muted">{p.condicoes_pagamento.parcelas.length}x</div>}
                    </div>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <RowBtn label="Copiar link" onClick={() => copiarLink(p)}><Icon name="link" size={14} /></RowBtn>
                      <RowBtn label="Baixar PDF" onClick={() => baixarPDF(p)}><Icon name="download" size={14} /></RowBtn>
                      <RowBtn label="Editar" onClick={() => setConstrutor({ editando: p })}><Icon name="edit" size={14} /></RowBtn>
                      <button onClick={() => excluir(p)} title={confirmDel === p.id ? 'Confirmar exclusão' : 'Excluir'} aria-label="Excluir" className={`rounded-lg px-1.5 py-1.5 text-xs font-bold transition ${confirmDel === p.id ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}>{confirmDel === p.id ? 'Confirmar?' : <Icon name="trash" size={14} />}</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Construtor */}
      {userId && construtor && (
        <Construtor
          userId={userId} plano={plano} editando={construtor.editando}
          eventos={eventos} propriedades={propriedades}
          tabelas={tabelas} regras={regras} taxas={taxas} pacotes={pacotes} empresa={empresa}
          onClose={() => setConstrutor(null)}
          onSaved={(acao) => { setConstrutor(null); toast.success(acao === 'enviar' ? 'Proposta salva — copie o link para enviar.' : 'Rascunho salvo.'); refetch(); }}
        />
      )}

      {/* Detalhe */}
      {detalhe && (
        <DetalheModal
          proposta={detalhe}
          evento={detalhe.evento_id ? eventoById.get(detalhe.evento_id) ?? null : null}
          propriedadeNome={detalhe.propriedade_id ? propById.get(detalhe.propriedade_id)?.nome ?? null : null}
          empresa={empresa}
          link={linkPublico(detalhe)}
          onClose={() => setDetalhe(null)}
          onCopiar={() => copiarLink(detalhe)}
          onPDF={() => baixarPDF(detalhe)}
          onEditar={() => { setConstrutor({ editando: detalhe }); setDetalhe(null); }}
          onAceitar={() => aceitarManual(detalhe)}
          onRecusar={() => recusarManual(detalhe)}
        />
      )}
    </div>
  );
}

// ── Detalhe (preview + ações) ────────────────────────────────────────────────
function DetalheModal({
  proposta, evento, propriedadeNome, empresa, link, onClose, onCopiar, onPDF, onEditar, onAceitar, onRecusar,
}: {
  proposta: Proposta; evento: Evento | null; propriedadeNome: string | null; empresa: Empresa | null; link: string;
  onClose: () => void; onCopiar: () => void; onPDF: () => void; onEditar: () => void; onAceitar: () => void; onRecusar: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  const podeDecidir = proposta.status !== 'aceita' && proposta.status !== 'recusada';
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="my-6 w-full max-w-3xl">
        {/* Barra de ações */}
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-white p-2.5 shadow-pop">
          <span className="ml-1 mr-auto text-sm font-bold text-ink">{numeroLabel(proposta.numero)} · {STATUS_BY[proposta.status].label}</span>
          <a href={link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold hover:text-brand"><Icon name="eye" size={13} /> Abrir link</a>
          <button onClick={onCopiar} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold hover:text-brand"><Icon name="link" size={13} /> Copiar link</button>
          <button onClick={onPDF} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold hover:text-brand"><Icon name="download" size={13} /> PDF</button>
          <button onClick={onEditar} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold hover:text-brand"><Icon name="edit" size={13} /> Editar</button>
          {podeDecidir && <button onClick={onAceitar} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><Icon name="check" size={13} /> Marcar aceita</button>}
          {podeDecidir && <button onClick={onRecusar} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><Icon name="x" size={13} /> Recusar</button>}
          <button onClick={onClose} aria-label="Fechar" className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        </div>
        <PropostaView
          data={{ numero: proposta.numero, titulo: proposta.titulo, moeda: proposta.moeda, itens: proposta.itens, subtotal_num: proposta.subtotal_num, desconto_num: proposta.desconto_num, total_num: proposta.total_num, validade: proposta.validade, condicoes_pagamento: proposta.condicoes_pagamento, observacoes: proposta.observacoes, condicoes: proposta.condicoes, criado_em: proposta.criado_em }}
          empresa={empresa} evento={evento} propriedadeNome={propriedadeNome}
        />
      </div>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────────────────────
function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: ReactNode; tone: 'brand' | 'azul' | 'ambar' | 'verde' }) {
  const bg = { brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', ambar: 'bg-amber-50 text-amber-600', verde: 'bg-emerald-50 text-emerald-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bg}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

function RowBtn({ children, label, onClick }: { children: ReactNode; label: string; onClick: () => void }) {
  return <button onClick={onClick} title={label} aria-label={label} className="rounded-lg p-1.5 text-ink-muted transition hover:bg-black/[0.04] hover:text-brand">{children}</button>;
}

function EmptyState({ onNew, disabled }: { onNew: () => void; disabled?: boolean }) {
  return (
    <div className="rounded-2xl bg-white py-14 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name="fileText" size={26} /></div>
      <p className="mb-1 text-sm font-semibold text-ink">Nenhuma proposta ainda</p>
      <p className="mx-auto mb-5 max-w-md px-6 text-xs text-ink-muted">Crie sua primeira proposta comercial: puxe o preço do seu catálogo, gere o PDF e envie um link para o cliente aceitar.</p>
      {!disabled && <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="plus" size={14} /> Criar primeira proposta</button>}
    </div>
  );
}

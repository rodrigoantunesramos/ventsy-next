'use client';

// Recebíveis — /painel/recebiveis  (Contas a Receber / controle de parcelamento).
// Subledger real sobre a tabela `parcelas` (evento_id -> clientes_eventos).
// Núcleo do controle financeiro de casa de eventos:
//   • Parcelas por evento, com status real (pendente/pago/atrasado derivado/cancelado)
//   • Baixa de parcela → gera lançamento de receita no caixa (e estorno)
//   • REGRA DOS 30 DIAS: alerta de evento cujo saldo não estará quitado 30 dias antes
//   • Aging, previsão de recebimento por mês e dunning (WhatsApp)
// i18n-ready via lib/format. Toast pelo ToastProvider do layout do painel.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';

// ── Types ─────────────────────────────────────────────────────────────────────
type ParcelaStatus = 'pendente' | 'pago' | 'cancelado';
type Parcela = {
  id: number;
  evento_id: string;
  numero: number | null;
  descricao: string | null;
  valor: number;
  vencimento: string | null;
  status: ParcelaStatus;
  pago_em: string | null;
  metodo_pagamento: string | null;
  lancamento_id: number | null;
};
type Evento = {
  id: string;
  nome_evento: string | null;
  quem_contratou: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  valor_total_num: number | null;
  propriedade_id: number | null;
  telefones: string[];
};
type Efetivo = 'pendente' | 'pago' | 'atrasado' | 'cancelado';
type Filtro = 'todos' | 'aberto' | 'atrasado' | 'pago';

const METODOS = ['Pix', 'Cartão de crédito', 'Cartão de débito', 'Transferência', 'Dinheiro', 'Boleto', 'Outro'];
const DIAS_REGRA = 30;
const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

// ── Helpers ─────────────────────────────────────────────────────────────────
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function diffDias(dateStr: string, base: Date) {
  return Math.floor((new Date(dateStr + 'T12:00:00').getTime() - base.getTime()) / 86400000);
}
function efetivo(p: Parcela, hoje: string): Efetivo {
  if (p.status === 'pago') return 'pago';
  if (p.status === 'cancelado') return 'cancelado';
  if (p.vencimento && p.vencimento < hoje) return 'atrasado';
  return 'pendente';
}
function soDigitos(s: string) { return (s || '').replace(/\D/g, ''); }
function waLink(fone: string, msg: string) {
  const d = soDigitos(fone);
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}?text=${encodeURIComponent(msg)}`;
}

const ST_CLS: Record<Efetivo, string> = {
  pendente: 'bg-amber-50 text-amber-700',
  pago: 'bg-emerald-50 text-emerald-700',
  atrasado: 'bg-red-50 text-red-700',
  cancelado: 'bg-gray-100 text-gray-500',
};
const ST_LABEL: Record<Efetivo, string> = { pendente: 'A vencer', pago: 'Pago', atrasado: 'Atrasado', cancelado: 'Cancelado' };

// ── Page ─────────────────────────────────────────────────────────────────────
export default function RecebiveisPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [fEvento, setFEvento] = useState('');
  const [busca, setBusca] = useState('');

  // baixa
  const [pagar, setPagar] = useState<Parcela | null>(null);
  const [pgData, setPgData] = useState('');
  const [pgMetodo, setPgMetodo] = useState('Pix');
  const [pgSaving, setPgSaving] = useState(false);

  // nova/editar parcela
  const [modal, setModal] = useState<null | { editando?: Parcela }>(null);
  const [fEv, setFEv] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fValor, setFValor] = useState('');
  const [fVenc, setFVenc] = useState('');
  const [saving, setSaving] = useState(false);

  const hoje = ymd(new Date());

  const carregar = useCallback(async (uid: string) => {
    const [pRes, eRes] = await Promise.all([
      sb.from('parcelas').select('id,evento_id,numero,descricao,valor,vencimento,status,pago_em,metodo_pagamento,lancamento_id').eq('usuario_id', uid).order('vencimento', { nullsFirst: false }),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,valor_total_num,propriedade_id,telefones').eq('usuario_id', uid).order('data_inicio', { nullsFirst: false }),
    ]);
    setParcelas(((pRes.data || []) as Parcela[]).map((p) => ({ ...p, id: Number(p.id), valor: Number(p.valor), lancamento_id: p.lancamento_id != null ? Number(p.lancamento_id) : null })));
    setEventos(((eRes.data || []) as Evento[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null, telefones: Array.isArray(e.telefones) ? e.telefones : [] })));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const ev = new URLSearchParams(window.location.search).get('evento');
      if (ev) setFEvento(ev);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const eventoById = useCallback((id: string) => eventos.find((e) => e.id === id), [eventos]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    let aReceber = 0, vencido = 0, aVencer30 = 0, recebido = 0;
    parcelas.forEach((p) => {
      const ef = efetivo(p, hoje);
      if (ef === 'pago') { recebido += p.valor; return; }
      if (ef === 'cancelado') return;
      aReceber += p.valor;
      if (ef === 'atrasado') vencido += p.valor;
      else if (p.vencimento && diffDias(p.vencimento, new Date()) <= 30) aVencer30 += p.valor;
    });
    return { aReceber, vencido, aVencer30, recebido };
  }, [parcelas, hoje]);

  // ── Regra dos 30 dias: eventos em risco ──
  const riscos = useMemo(() => {
    const now = new Date();
    return eventos
      .map((e) => {
        if (!e.data_inicio) return null;
        const saldo = parcelas
          .filter((p) => p.evento_id === e.id && p.status !== 'pago' && p.status !== 'cancelado')
          .reduce((s, p) => s + p.valor, 0);
        if (saldo <= 0) return null;
        const diasEvento = diffDias(e.data_inicio, now);
        if (diasEvento < 0) return null; // evento já passou
        const folga = diasEvento - DIAS_REGRA; // dias até o limite dos 30d
        let nivel: 'critico' | 'atencao' | null = null;
        if (folga <= 0) nivel = 'critico';      // dentro/depois da janela dos 30 dias com saldo
        else if (folga <= 15) nivel = 'atencao'; // limite chegando
        if (!nivel) return null;
        return { evento: e, saldo, diasEvento, folga, nivel };
      })
      .filter(Boolean)
      .sort((a, b) => a!.diasEvento - b!.diasEvento) as { evento: Evento; saldo: number; diasEvento: number; folga: number; nivel: 'critico' | 'atencao' }[];
  }, [eventos, parcelas]);

  // ── Previsão por mês (6 meses) ──
  const previsao = useMemo(() => {
    const now = new Date();
    const base = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return { key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: MESES_PT[d.getMonth()], valor: 0 };
    });
    parcelas.forEach((p) => {
      if (p.status === 'pago' || p.status === 'cancelado' || !p.vencimento) return;
      const slot = base.find((b) => b.key === p.vencimento!.slice(0, 7));
      if (slot) slot.valor += p.valor;
    });
    const max = Math.max(...base.map((b) => b.valor), 1);
    return { base, max };
  }, [parcelas]);

  // ── Filtro da tabela ──
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return parcelas
      .filter((p) => {
        const ef = efetivo(p, hoje);
        if (filtro === 'aberto' && (ef === 'pago' || ef === 'cancelado')) return false;
        if (filtro === 'atrasado' && ef !== 'atrasado') return false;
        if (filtro === 'pago' && ef !== 'pago') return false;
        if (fEvento && p.evento_id !== fEvento) return false;
        if (q) {
          const ev = eventoById(p.evento_id);
          const hay = `${ev?.nome_evento || ''} ${ev?.quem_contratou || ''} ${p.descricao || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.vencimento || '9999').localeCompare(b.vencimento || '9999'));
  }, [parcelas, filtro, fEvento, busca, hoje, eventoById]);

  // ── Ações ──
  function abrirBaixa(p: Parcela) {
    setPagar(p); setPgData(ymd(new Date())); setPgMetodo(p.metodo_pagamento || 'Pix');
  }
  async function confirmarBaixa() {
    if (!userId || !pagar) return;
    setPgSaving(true);
    const ev = eventoById(pagar.evento_id);
    const { data: lanc, error: e1 } = await sb.from('lancamentos').insert({
      usuario_id: userId, tipo: 'receita', categoria: 'Aluguel de Espaço',
      descricao: `${ev?.nome_evento || 'Evento'} — ${pagar.descricao || `Parcela ${pagar.numero ?? ''}`.trim()}`,
      tipo_evento: ev?.tipo_evento || null, valor: pagar.valor, status: 'pago',
      data: pgData, metodo_pagamento: pgMetodo, prop_id: ev?.propriedade_id ?? null,
      observacao: 'Baixa de parcela (Recebíveis)',
    }).select('id').single();
    if (e1 || !lanc) { setPgSaving(false); toast.error('Erro ao registrar o recebimento.'); return; }
    const { error: e2 } = await sb.from('parcelas').update({ status: 'pago', pago_em: pgData, metodo_pagamento: pgMetodo, lancamento_id: lanc.id }).eq('id', pagar.id);
    setPgSaving(false);
    if (e2) { await sb.from('lancamentos').delete().eq('id', lanc.id); toast.error('Erro ao baixar a parcela.'); return; }
    toast.success('Recebimento registrado e lançado no caixa!');
    setPagar(null);
    if (userId) await carregar(userId);
  }
  async function estornar(p: Parcela) {
    if (!userId) return;
    if (p.lancamento_id) await sb.from('lancamentos').delete().eq('id', p.lancamento_id);
    const { error } = await sb.from('parcelas').update({ status: 'pendente', pago_em: null, lancamento_id: null }).eq('id', p.id);
    if (error) { toast.error('Erro ao estornar.'); return; }
    toast.info('Pagamento estornado.');
    await carregar(userId);
  }

  function abrirModal(editando?: Parcela) {
    setModal({ editando });
    setFEv(editando?.evento_id ?? (eventos[0]?.id || ''));
    setFDesc(editando?.descricao ?? '');
    setFValor(editando ? String(editando.valor) : '');
    setFVenc(editando?.vencimento ?? '');
  }
  async function salvarParcela() {
    if (!userId || !fEv) return;
    const valor = Number(fValor);
    if (!valor || valor <= 0) return;
    setSaving(true);
    const payload = { usuario_id: userId, evento_id: fEv, descricao: fDesc || null, valor, vencimento: fVenc || null };
    const { error } = modal?.editando
      ? await sb.from('parcelas').update(payload).eq('id', modal.editando.id)
      : await sb.from('parcelas').insert(payload);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar a parcela.'); return; }
    toast.success(modal?.editando ? 'Parcela atualizada!' : 'Parcela adicionada!');
    setModal(null);
    await carregar(userId);
  }
  async function excluirParcela(p: Parcela) {
    if (!userId) return;
    if (p.status === 'pago') { toast.error('Estorne o pagamento antes de excluir.'); return; }
    const { error } = await sb.from('parcelas').delete().eq('id', p.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    setParcelas((arr) => arr.filter((x) => x.id !== p.id));
    toast.success('Parcela removida.');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  const semEventos = eventos.length === 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Recebíveis</h1>
          <p className="mt-1 text-sm text-ink-muted">Parcelamento por evento, baixa de pagamentos e a regra dos 30 dias.</p>
        </div>
        <button onClick={() => abrirModal()} disabled={semEventos}
          className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">+ Parcela</button>
      </div>

      {semEventos && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Você ainda não tem eventos. Crie um evento em <Link href="/painel/leads" className="font-semibold underline">Leads</Link> para registrar o parcelamento.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="A receber" value={formatMoneyShort(kpis.aReceber)} tone="azul" icon={<IcoWallet />} />
        <Kpi label="Vencido" value={formatMoneyShort(kpis.vencido)} tone="vermelho" icon={<IcoAlert />} />
        <Kpi label="Vence em 30 dias" value={formatMoneyShort(kpis.aVencer30)} tone="gold" icon={<IcoClock />} />
        <Kpi label="Recebido" value={formatMoneyShort(kpis.recebido)} tone="verde" icon={<IcoCheck />} />
      </div>

      {/* Regra dos 30 dias */}
      {riscos.length > 0 && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-white p-5 shadow-card">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 text-red-600"><IcoAlert /></span>
            <div>
              <h3 className="text-base font-bold text-ink">Eventos em risco — regra dos {DIAS_REGRA} dias</h3>
              <p className="text-xs text-ink-muted">O saldo deve estar quitado até {DIAS_REGRA} dias antes do evento.</p>
            </div>
          </div>
          <div className="space-y-2">
            {riscos.map(({ evento, saldo, diasEvento, folga, nivel }) => {
              const fone = evento.telefones[0];
              const msg = `Olá! Sobre o ${evento.nome_evento || 'seu evento'} em ${evento.data_inicio ? formatDate(evento.data_inicio, { style: 'short' }) : ''}: consta um saldo de ${formatMoney(saldo)} a quitar. Podemos acertar?`;
              const wa = fone ? waLink(fone, msg) : null;
              return (
                <div key={evento.id} className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${nivel === 'critico' ? 'border-red-200 bg-red-50/50' : 'border-amber-200 bg-amber-50/40'}`}>
                  <span className={`rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${nivel === 'critico' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                    {nivel === 'critico' ? 'Crítico' : 'Atenção'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{evento.nome_evento || 'Evento'}</p>
                    <p className="text-xs text-ink-muted">
                      {evento.data_inicio ? formatDate(evento.data_inicio, { style: 'medium' }) : '—'} · faltam {diasEvento} dias ·{' '}
                      {folga <= 0 ? <span className="font-semibold text-red-600">passou do limite dos {DIAS_REGRA} dias</span> : <>limite em {folga} dia(s)</>}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold text-red-600">{formatMoney(saldo)}</span>
                  <div className="flex shrink-0 gap-1.5">
                    <button onClick={() => setFEvento(evento.id)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Ver parcelas</button>
                    {wa && <a href={wa} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">Cobrar no WhatsApp</a>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_300px]">
        {/* Tabela de parcelas */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-base font-bold text-ink">Parcelas</h3>
            <div className="flex flex-wrap items-center gap-2">
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar evento/cliente…" className="w-40 rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none sm:w-48" />
              {eventos.length > 0 && (
                <select value={fEvento} onChange={(e) => setFEvento(e.target.value)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs focus:border-brand focus:outline-none">
                  <option value="">Todos os eventos</option>
                  {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome_evento || 'Evento'}</option>)}
                </select>
              )}
              <div className="flex gap-1">
                {(['todos', 'aberto', 'atrasado', 'pago'] as Filtro[]).map((f) => (
                  <button key={f} onClick={() => setFiltro(f)} className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize transition ${filtro === f ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>
                    {f === 'aberto' ? 'Em aberto' : f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {filtradas.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">
              {parcelas.length === 0 ? 'Nenhuma parcela ainda. Use + Parcela para montar um plano de pagamento.' : 'Nenhuma parcela neste filtro.'}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Evento</th>
                    <th className="hidden pb-2 font-semibold sm:table-cell">Parcela</th>
                    <th className="pb-2 font-semibold">Vencimento</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Valor</th>
                    <th className="w-24 pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((p) => {
                    const ev = eventoById(p.evento_id);
                    const varef = efetivo(p, hoje);
                    return (
                      <tr key={p.id} className="group border-b border-black/[0.04] last:border-0">
                        <td className="py-2.5">
                          <p className="font-medium text-ink-soft">{ev?.nome_evento || 'Evento'}</p>
                          <p className="text-xs text-ink-muted">{ev?.quem_contratou || ''}</p>
                        </td>
                        <td className="hidden py-2.5 text-ink-muted sm:table-cell">{p.descricao || (p.numero ? `Parcela ${p.numero}` : '—')}</td>
                        <td className="py-2.5 text-ink-muted">{p.vencimento ? formatDate(p.vencimento, { style: 'short' }) : '—'}</td>
                        <td className="py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ST_CLS[varef]}`}>{ST_LABEL[varef]}</span></td>
                        <td className="py-2.5 text-right font-bold text-ink-soft">{formatMoney(p.valor)}</td>
                        <td className="py-2.5 pl-2">
                          <div className="flex items-center justify-end gap-1">
                            {varef === 'pago' ? (
                              <button onClick={() => estornar(p)} title="Estornar" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-amber-300 hover:text-amber-700">Estornar</button>
                            ) : (
                              <button onClick={() => abrirBaixa(p)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-emerald-700">Receber</button>
                            )}
                            <div className="flex opacity-0 transition group-hover:opacity-100">
                              <button onClick={() => abrirModal(p)} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                              <button onClick={() => excluirParcela(p)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Previsão de recebimento */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-1 text-base font-bold text-ink">Previsão de recebimento</h3>
          <p className="mb-4 text-xs text-ink-muted">A receber por mês (em aberto).</p>
          {previsao.base.every((b) => b.valor === 0) ? (
            <p className="py-8 text-center text-sm text-ink-muted">Sem parcelas a vencer.</p>
          ) : (
            <div className="space-y-3">
              {previsao.base.map((b) => (
                <div key={b.key}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-ink-soft">{b.label}</span>
                    <span className="font-semibold text-ink-muted">{formatMoneyShort(b.valor)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                    <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${Math.round((b.valor / previsao.max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal baixa */}
      {pagar && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setPagar(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><IcoCheck /></span>
              <div>
                <h3 className="font-display text-xl font-bold text-ink">Registrar recebimento</h3>
                <p className="text-xs text-ink-muted">{eventoById(pagar.evento_id)?.nome_evento || 'Evento'} · {formatMoney(pagar.valor)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Data do recebimento</span>
                <input type="date" value={pgData} onChange={(e) => setPgData(e.target.value)} className={inp} />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Método</span>
                <select value={pgMetodo} onChange={(e) => setPgMetodo(e.target.value)} className={inp}>
                  {METODOS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Isto gera automaticamente um lançamento de receita no Financeiro.</p>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={confirmarBaixa} disabled={pgSaving} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{pgSaving ? 'Registrando…' : 'Confirmar recebimento'}</button>
              <button onClick={() => setPagar(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal nova/editar parcela */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(null)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{modal.editando ? 'Editar parcela' : 'Nova parcela'}</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Evento</span>
                <select value={fEv} onChange={(e) => setFEv(e.target.value)} className={inp} disabled={!!modal.editando}>
                  {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome_evento || 'Evento'} — {e.quem_contratou || ''}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Descrição</span>
                <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} className={inp} placeholder="Ex: 1ª parcela / Sinal" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Valor (R$)</span>
                  <input type="number" min={0} step="0.01" value={fValor} onChange={(e) => setFValor(e.target.value)} className={inp} autoFocus placeholder="0,00" />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Vencimento</span>
                  <input type="date" value={fVenc} onChange={(e) => setFVenc(e.target.value)} className={inp} />
                </label>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvarParcela} disabled={saving || !fValor || !fEv} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar parcela'}</button>
              <button onClick={() => setModal(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──
function Kpi({ label, value, tone, icon }: { label: string; value: string; tone: 'verde' | 'vermelho' | 'gold' | 'azul'; icon: ReactNode }) {
  const color = { verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', azul: 'text-blue-600' }[tone];
  const iconBg = { verde: 'bg-emerald-50 text-emerald-600', vermelho: 'bg-red-50 text-red-600', gold: 'bg-amber-50 text-amber-600', azul: 'bg-blue-50 text-blue-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
      </div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

const svg = (path: ReactNode, size = 15, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{path}</svg>
);
const IcoWallet = () => svg(<path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01" />);
const IcoAlert = () => svg(<path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />, 16);
const IcoClock = () => svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
const IcoCheck = () => svg(<path d="M20 6 9 17l-5-5" />, 15, 2.4);
const IcoEdit = () => svg(<><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4Z" /></>, 13);
const IcoTrash = () => svg(<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />, 13);

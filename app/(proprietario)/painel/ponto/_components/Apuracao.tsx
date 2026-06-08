'use client';

// Aba "Apuração" — fecha o ciclo de pessoas: horas/extras/adicional noturno e
// BANCO DE HORAS por pessoa, o CUSTO DE MÃO DE OBRA por evento (freelancers +
// fixos → alimenta o custo direto do evento) e o FECHAMENTO DE DIÁRIAS de
// freelancers, que gera contas a pagar no Financeiro (`contas_pagar`, via RLS —
// degrada se o módulo não existir). Sem "R$" hardcoded — tudo via lib/format.

import { useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  custoHoraDe, custoRegistroFixo, custoRealizadoEvento, somaDiarias, saldoBancoMin, minToHHMM, devePagar,
  type EscalaAlocacao, type PontoRegistro,
} from '@/lib/ponto';
import {
  type PontoBag, pessoaDaAloc, eventoLabel, exportCSV, ymd,
} from '../_lib';
import { Kpi, EmptyState, IcoWallet, IcoClock, IcoUsers, IcoDownload, IcoCheck } from './ui';

export default function Apuracao({ bag }: { bag: PontoBag }) {
  const toast = useToast();
  const { userId, registros, alocacoes, escalas, eventos, equipe, equipeById, freelaById, recarregar } = bag;

  const [eventoSel, setEventoSel] = useState<string>('');
  const [fechando, setFechando] = useState(false);

  const escalaById = useMemo(() => new Map(escalas.map((s) => [s.id, s])), [escalas]);
  // custo/hora por colaborador fixo (derivado do salário).
  const custoHoraById = useMemo(() => {
    const m = new Map<number, number>();
    for (const e of equipe) m.set(e.id, custoHoraDe(e.salario));
    return m;
  }, [equipe]);

  // ── Custo de mão de obra por evento ──
  const custoPorEvento = useMemo(() => {
    return eventos.map((ev) => {
      const alocsEv = alocacoes.filter((a) => escalaById.get(a.escala_id)?.evento_id === ev.id);
      const regsEv = registros.filter((r) => r.evento_id === ev.id);
      const diariasFreela = alocsEv.filter((a) => a.freelancer_id && a.status === 'presente').map((a) => a.valor_diaria_num);
      const regsFixos = regsEv.filter((r) => r.equipe_id != null);
      const custosFixos = regsFixos.map((r) => custoRegistroFixo(
        { trabalhadoMin: r.trabalhado_min, extrasMin: r.extras_min, noturnoMin: r.noturno_min },
        custoHoraById.get(Number(r.equipe_id)) || 0,
      ));
      const horasFixosMin = regsFixos.map((r) => r.trabalhado_min);
      const c = custoRealizadoEvento({ diariasFreela, custosFixos, horasFixosMin });
      const aPagar = somaDiarias(alocsEv.filter((a) => a.freelancer_id != null && devePagar(a)), () => true);
      return { ev, ...c, aPagar, pessoas: c.pessoas };
    }).filter((x) => x.total > 0 || x.aPagar > 0).sort((a, b) => b.total - a.total);
  }, [eventos, alocacoes, registros, escalaById, custoHoraById]);

  const totalGeral = useMemo(() => custoPorEvento.reduce((s, x) => s + x.total, 0), [custoPorEvento]);
  const totalAPagar = useMemo(() => custoPorEvento.reduce((s, x) => s + x.aPagar, 0), [custoPorEvento]);

  // ── Banco de horas por pessoa ──
  const bancoHoras = useMemo(() => {
    const m = new Map<string, { nome: string; tipo: 'fixo' | 'freelancer'; trabalhado: number; extras: number; noturno: number; saldo: number; avaliacao: number | null }>();
    for (const r of registros) {
      const p = pessoaDaAloc(r, equipeById, freelaById);
      const key = `${p.tipo}:${p.id}`;
      const cur = m.get(key) || { nome: p.nome, tipo: p.tipo, trabalhado: 0, extras: 0, noturno: 0, saldo: 0, avaliacao: r.freelancer_id ? (freelaById.get(r.freelancer_id)?.avaliacao ?? null) : null };
      cur.trabalhado += r.trabalhado_min; cur.extras += r.extras_min; cur.noturno += r.noturno_min; cur.saldo += r.saldo_min;
      m.set(key, cur);
    }
    return [...m.values()].sort((a, b) => b.trabalhado - a.trabalhado);
  }, [registros, equipeById, freelaById]);

  const bancoTotalMin = useMemo(() => saldoBancoMin(registros), [registros]);

  // ── Fechar diárias de freelancers de um evento → contas_pagar ──
  async function fecharDiarias(eventoId: string) {
    const ev = eventos.find((e) => e.id === eventoId);
    const alocsEv = alocacoes.filter((a) => a.freelancer_id && escalaById.get(a.escala_id)?.evento_id === eventoId && devePagar(a));
    if (alocsEv.length === 0) { toast.info('Nenhuma diária pendente para este evento.'); return; }

    // Agrupa por freelancer (uma conta a pagar por pessoa).
    const porFreela = new Map<string, EscalaAlocacao[]>();
    for (const a of alocsEv) { const arr = porFreela.get(a.freelancer_id!) || []; arr.push(a); porFreela.set(a.freelancer_id!, arr); }

    setFechando(true);
    let geradas = 0, falhou = false;
    for (const [freelaId, arr] of porFreela) {
      const f = freelaById.get(freelaId);
      const valor = arr.reduce((s, a) => s + a.valor_diaria_num, 0);
      const venc = ev?.data_fim?.slice(0, 10) || ev?.data_inicio?.slice(0, 10) || ymd(new Date());
      const base = {
        usuario_id: userId, categoria: 'folha',
        descricao: `Diárias ${f?.nome || 'freelancer'} — ${eventoLabel(ev)}`,
        valor_num: valor, vencimento: venc, status: 'pendente', aprovado: true,
        obs: `${arr.length} diária(s) · ${f?.chave_pix ? `PIX: ${f.chave_pix}` : 'sem PIX'} · gerado pelo fechamento de ${eventoLabel(ev)}`,
      };
      const { data, error } = await sb.from('contas_pagar').insert(base).select('id').single();
      if (error) { falhou = true; continue; }
      const contaId = String((data as { id: string }).id);
      // Marca as alocações como pagas (vínculo à conta).
      await sb.from('escalas_alocacao').update({ pago: true, conta_pagar_id: contaId }).in('id', arr.map((a) => a.id)).eq('usuario_id', userId);
      geradas++;
    }
    setFechando(false);
    if (falhou && geradas === 0) { toast.error('Não foi possível gerar contas a pagar — ative o módulo Contas a pagar.'); return; }
    toast.success(`${geradas} conta(s) a pagar gerada(s) no Financeiro.`);
    await recarregar();
  }

  function exportarBanco() {
    exportCSV('banco-de-horas.csv', ['Pessoa', 'Tipo', 'Trabalhado', 'Extras', 'Noturno', 'Saldo (min)'],
      bancoHoras.map((p) => [p.nome, p.tipo, minToHHMM(p.trabalhado), minToHHMM(p.extras), minToHHMM(p.noturno), p.saldo]));
  }

  const evDetalhe = useMemo(() => custoPorEvento.find((x) => x.ev.id === eventoSel) || null, [custoPorEvento, eventoSel]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Custo de pessoal" value={formatMoneyShort(totalGeral)} sub="mão de obra realizada" tone="roxo" icon={<IcoWallet />} />
        <Kpi label="Diárias a pagar" value={formatMoneyShort(totalAPagar)} sub="freelancers presentes" tone={totalAPagar > 0 ? 'gold' : 'verde'} icon={<IcoWallet />} />
        <Kpi label="Banco de horas" value={`${bancoTotalMin >= 0 ? '+' : ''}${minToHHMM(Math.abs(bancoTotalMin))}`} tone={bancoTotalMin >= 0 ? 'verde' : 'vermelho'} icon={<IcoClock />} />
        <Kpi label="Pessoas com ponto" value={String(bancoHoras.length)} tone="azul" icon={<IcoUsers />} />
      </div>

      {/* Custo de mão de obra por evento */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-ink">Custo de mão de obra por evento</h3>
            <p className="text-xs text-ink-muted">Freelancers (diárias dos presentes) + fixos (horas × custo/hora). Entra no custo direto do evento.</p>
          </div>
        </div>

        {custoPorEvento.length === 0 ? (
          <EmptyState icon={<IcoWallet />} title="Sem custo de pessoal ainda">
            Marque presença na escala e registre o ponto para apurar o custo de mão de obra por evento.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Evento</th>
                  <th className="pb-2 text-right font-semibold">Pessoas</th>
                  <th className="pb-2 text-right font-semibold">Freelancers</th>
                  <th className="pb-2 text-right font-semibold">Fixos</th>
                  <th className="pb-2 text-right font-semibold text-ink">Total</th>
                  <th className="pb-2 text-right font-semibold">A pagar</th>
                  <th className="w-28 pb-2" />
                </tr>
              </thead>
              <tbody>
                {custoPorEvento.map((x) => (
                  <tr key={x.ev.id} className="border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                    <td className="py-2.5">
                      <div className="font-semibold text-ink">{eventoLabel(x.ev)}</div>
                      {x.ev.data_inicio && <div className="text-xs text-ink-muted">{formatDate(x.ev.data_inicio, { style: 'short' })}</div>}
                    </td>
                    <td className="py-2.5 text-right text-ink-soft">{x.pessoas}</td>
                    <td className="py-2.5 text-right text-ink-soft">{formatMoney(x.freelancers)}</td>
                    <td className="py-2.5 text-right text-ink-soft">{formatMoney(x.fixos)}</td>
                    <td className="py-2.5 text-right font-bold text-ink">{formatMoney(x.total)}</td>
                    <td className="py-2.5 text-right">{x.aPagar > 0 ? <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-700">{formatMoney(x.aPagar)}</span> : <span className="text-emerald-600">✓</span>}</td>
                    <td className="py-2.5 text-right">
                      {x.aPagar > 0 && (
                        <button onClick={() => fecharDiarias(x.ev.id)} disabled={fechando} className="inline-flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-xs font-bold text-white hover:bg-brand-600 disabled:opacity-50"><IcoCheck /> Fechar diárias</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Banco de horas por pessoa */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-ink">Banco de horas & horas por pessoa</h3>
            <p className="text-xs text-ink-muted">Saldo = trabalhado − jornada. Positivo é crédito; negativo, débito.</p>
          </div>
          {bancoHoras.length > 0 && <button onClick={exportarBanco} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 px-3 py-2 text-sm text-ink-muted hover:border-brand/30 hover:text-brand"><IcoDownload /> Exportar</button>}
        </div>

        {bancoHoras.length === 0 ? (
          <EmptyState icon={<IcoClock />} title="Sem horas apuradas">Registre pontos na aba Ponto para montar o banco de horas.</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 font-semibold">Pessoa</th>
                  <th className="pb-2 text-right font-semibold">Trabalhado</th>
                  <th className="pb-2 text-right font-semibold">Extras</th>
                  <th className="pb-2 text-right font-semibold">Noturno</th>
                  <th className="pb-2 text-right font-semibold">Saldo banco</th>
                </tr>
              </thead>
              <tbody>
                {bancoHoras.map((p, i) => (
                  <tr key={i} className="border-b border-black/[0.04] last:border-0">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.6rem] font-bold text-white" style={{ background: p.tipo === 'freelancer' ? '#8b5cf6' : '#0ca678' }}>{p.nome.slice(0, 2).toUpperCase()}</span>
                        <div>
                          <div className="font-semibold text-ink">{p.nome}</div>
                          <div className="text-xs text-ink-muted">{p.tipo === 'freelancer' ? 'Freelancer' : 'Equipe fixa'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-ink-soft">{minToHHMM(p.trabalhado)}</td>
                    <td className="py-2.5 text-right text-amber-600">{p.extras > 0 ? minToHHMM(p.extras) : '—'}</td>
                    <td className="py-2.5 text-right text-violet-600">{p.noturno > 0 ? minToHHMM(p.noturno) : '—'}</td>
                    <td className={`py-2.5 text-right font-bold ${p.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{p.saldo >= 0 ? '+' : '−'}{minToHHMM(Math.abs(p.saldo))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

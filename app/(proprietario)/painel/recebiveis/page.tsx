'use client';

// Contas a Pagar/Receber — /painel/recebiveis.
// AP/AR num só lugar: "A receber" (parcelas de eventos, já existia) + "A pagar"
// (contas_pagar: fornecedores, folha, recorrências), com Visão geral consolidada
// (posição, fluxo, aging) e Agenda (calendário de vencimentos).
//
// Fontes: `parcelas`+`clientes_eventos` (receber), `contas_pagar`+`fornecedores`
// (pagar). Baixas geram lançamento no caixa (`lancamentos`). A aba "A pagar"
// degrada para um setup-card até docs/sql/contas-pagar.sql ser aplicado.
// i18n via lib/format; toast pelo ToastProvider do layout. Sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import {
  type Parcela, type Evento, type ContaPagar, type FornecedorLite,
  mapContaPagar, isMissingTable,
} from './_lib';
import { IcoScale, IcoArrowDown, IcoArrowUp, IcoCalendar } from './_components/ui';
import VisaoGeral from './_components/VisaoGeral';
import Receber from './_components/Receber';
import Pagar from './_components/Pagar';
import Agenda from './_components/Agenda';

type Tab = 'visao' | 'receber' | 'pagar' | 'agenda';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'visao', label: 'Visão geral', icon: IcoScale },
  { v: 'receber', label: 'A receber', icon: IcoArrowDown },
  { v: 'pagar', label: 'A pagar', icon: IcoArrowUp },
  { v: 'agenda', label: 'Agenda', icon: IcoCalendar },
];

export default function RecebiveisPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [contas, setContas] = useState<ContaPagar[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [pagarNeedsSetup, setPagarNeedsSetup] = useState(false);
  const [tab, setTab] = useState<Tab>('visao');
  const [fEventoInicial, setFEventoInicial] = useState('');

  const carregar = useCallback(async (uid: string) => {
    // A receber (parcelas + eventos)
    const [pRes, eRes] = await Promise.all([
      sb.from('parcelas').select('id,evento_id,numero,descricao,valor,vencimento,status,pago_em,metodo_pagamento,lancamento_id').eq('usuario_id', uid).order('vencimento', { nullsFirst: false }),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,valor_total_num,propriedade_id,telefones').eq('usuario_id', uid).order('data_inicio', { nullsFirst: false }),
    ]);
    setParcelas(((pRes.data || []) as Parcela[]).map((p) => ({ ...p, id: Number(p.id), valor: Number(p.valor), lancamento_id: p.lancamento_id != null ? Number(p.lancamento_id) : null })));
    setEventos(((eRes.data || []) as Evento[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null, telefones: Array.isArray(e.telefones) ? e.telefones : [] })));

    // A pagar (contas_pagar) — degrada se a tabela ainda não existir
    const cRes = await sb.from('contas_pagar').select('id,fornecedor_id,categoria,plano_conta,descricao,valor_num,vencimento,status,pago_em,metodo,recorrente,recorrencia,recorrencia_pai,aprovado,anexo_url,anexo_nome,lancamento_id,obs').eq('usuario_id', uid).order('vencimento', { nullsFirst: false });
    if (cRes.error) {
      setPagarNeedsSetup(isMissingTable(cRes.error));
      setContas([]);
    } else {
      setPagarNeedsSetup(false);
      setContas((cRes.data || []).map(mapContaPagar));
    }

    // Fornecedores (para vincular contas) — opcional
    const fRes = await sb.from('fornecedores').select('id,nome,fantasia,categoria').eq('usuario_id', uid).eq('ativo', true).order('nome');
    setFornecedores(fRes.error ? [] : (fRes.data || []) as FornecedorLite[]);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const qs = new URLSearchParams(window.location.search);
      const ev = qs.get('evento');
      const t = qs.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      else if (ev) setTab('receber');
      if (ev) setFEventoInicial(ev);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const recarregar = useCallback(async () => { if (userId) await carregar(userId); }, [userId, carregar]);

  const subtitulo = useMemo(() => ({
    visao: 'Posição consolidada de tudo a receber e a pagar.',
    receber: 'Parcelamento por evento, baixa de pagamentos e a regra dos 30 dias.',
    pagar: 'Fornecedores, folha e recorrências — com aging, recorrência e baixa.',
    agenda: 'Calendário de vencimentos (entradas e saídas).',
  } as Record<Tab, string>)[tab], [tab]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Contas a Pagar / Receber</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitulo}</p>
      </div>

      {/* Abas */}
      <div className="mt-4 flex flex-wrap gap-1.5 border-b border-black/[0.06] pb-px">
        {TABS.map(({ v, label, icon: Ico }) => (
          <button key={v} onClick={() => setTab(v)}
            className={`inline-flex items-center gap-2 rounded-t-xl px-3.5 py-2.5 text-sm font-semibold transition ${tab === v ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>
            <Ico /> {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'visao' && <VisaoGeral parcelas={parcelas} contas={contas} onGoTab={setTab} />}
        {tab === 'receber' && userId && <Receber userId={userId} parcelas={parcelas} eventos={eventos} recarregar={recarregar} fEventoInicial={fEventoInicial} />}
        {tab === 'pagar' && userId && (
          pagarNeedsSetup
            ? <SetupCard />
            : <Pagar userId={userId} contas={contas} fornecedores={fornecedores} recarregar={recarregar} />
        )}
        {tab === 'agenda' && <Agenda parcelas={parcelas} eventos={eventos} contas={contas} />}
      </div>
    </div>
  );
}

// Empty-state quando a tabela contas_pagar ainda não foi criada.
function SetupCard() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoArrowUp /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Contas a Pagar</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/contas-pagar.sql</code> no Supabase (SQL Editor) para criar a tabela <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">contas_pagar</code> e liberar o cadastro, aging, recorrências e baixa de despesas.
      </p>
    </div>
  );
}

'use client';

// Manutenção & Ordens de Serviço — /painel/manutencao.
// Mantém espaços e ativos funcionando: OS corretivas (quebrou) e preventivas
// (plano periódico — ar, gerador, elétrica, jardim, piscina, estrutura), com
// custo (mão de obra + peças), responsável (equipe interna ou fornecedor),
// checklist (inspeção/pré-evento) e histórico. Crítico para grandes estruturas.
//
// Abas: Ordens (Kanban/Lista) · Preventiva (planos + agenda + pré-evento) ·
// Custos (por mês/ativo, MTTR, peças). Fontes: manutencao_os, manutencao_planos
// + propriedades/espacos/fornecedores/equipe/clientes_eventos para vínculos. A
// conclusão de OS lança a despesa em `lancamentos`. Degrada para setup-card até
// docs/sql/manutencao.sql ser aplicado. i18n via lib/format; sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import {
  type OS, type Plano, type PropriedadeLite, type EspacoLite, type FornecedorLite, type EquipeLite, type EventoLite,
  SEL_OS, SEL_PLANO, mapOS, mapPlano, isMissingTable,
} from './_lib';
import { IcoBoard, IcoRepeat, IcoWallet, IcoWrench } from './_components/ui';
import Ordens from './_components/Ordens';
import Preventiva from './_components/Preventiva';
import Custos from './_components/Custos';

type Tab = 'ordens' | 'preventiva' | 'custos';
const TABS: { v: Tab; label: string; icon: () => JSX.Element }[] = [
  { v: 'ordens', label: 'Ordens de serviço', icon: IcoBoard },
  { v: 'preventiva', label: 'Preventiva', icon: IcoRepeat },
  { v: 'custos', label: 'Custos', icon: IcoWallet },
];

export default function ManutencaoPage() {
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [os, setOS] = useState<OS[]>([]);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [props, setProps] = useState<PropriedadeLite[]>([]);
  const [espacos, setEspacos] = useState<EspacoLite[]>([]);
  const [fornecedores, setFornecedores] = useState<FornecedorLite[]>([]);
  const [equipe, setEquipe] = useState<EquipeLite[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);

  const [tab, setTab] = useState<Tab>('ordens');

  const carregar = useCallback(async (uid: string) => {
    // OS + planos (fonte do módulo). Se a tabela não existir → setup-card.
    const [osRes, plRes] = await Promise.all([
      sb.from('manutencao_os').select(SEL_OS).eq('usuario_id', uid).order('abertura', { ascending: false }),
      sb.from('manutencao_planos').select(SEL_PLANO).eq('usuario_id', uid).order('proxima_data', { nullsFirst: false }),
    ]);
    if (isMissingTable(osRes.error) || isMissingTable(plRes.error)) {
      setNeedsSetup(true); setOS([]); setPlanos([]);
      return;
    }
    setNeedsSetup(false);
    setOS((osRes.data || []).map(mapOS));
    setPlanos((plRes.data || []).map(mapPlano));

    // Vínculos (todos opcionais — degradam para lista vazia).
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const [prRes, espRes, foRes, eqRes, evRes] = await Promise.all([
      sb.from('propriedades').select('id,nome').eq('usuario_id', uid).order('id'),
      sb.from('espacos').select('id,propriedade_id,nome').eq('usuario_id', uid).order('ordem'),
      sb.from('fornecedores').select('id,nome,fantasia').eq('usuario_id', uid).eq('ativo', true).order('nome'),
      sb.from('equipe').select('id,nome,cargo').eq('usuario_id', uid).order('nome'),
      sb.from('clientes_eventos').select('id,nome_evento,quem_contratou,data_inicio,propriedade_id').eq('usuario_id', uid).order('data_inicio', { ascending: false, nullsFirst: false }).limit(500),
    ]);
    setProps(prRes.error ? [] : (prRes.data || []).map((p: any) => ({ id: Number(p.id), nome: p.nome || `#${p.id}` })));
    setEspacos(espRes.error ? [] : (espRes.data || []).map((e: any) => ({ id: Number(e.id), propriedade_id: Number(e.propriedade_id), nome: e.nome || `#${e.id}` })));
    setFornecedores(foRes.error ? [] : (foRes.data || []) as FornecedorLite[]);
    setEquipe(eqRes.error ? [] : (eqRes.data || []).map((m: any) => ({ id: String(m.id), nome: m.nome || '—', cargo: m.cargo ?? null })));
    setEventos(evRes.error ? [] : (evRes.data || []).map((e: any) => ({ id: String(e.id), nome_evento: e.nome_evento ?? null, quem_contratou: e.quem_contratou ?? null, data_inicio: e.data_inicio ?? null, propriedade_id: e.propriedade_id != null ? Number(e.propriedade_id) : null })));
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const qs = new URLSearchParams(window.location.search);
      const t = qs.get('tab') as Tab | null;
      if (t && TABS.some((x) => x.v === t)) setTab(t);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const recarregar = useCallback(async () => { if (userId) await carregar(userId); }, [userId, carregar]);

  const shared = useMemo(() => ({ userId: userId || '', os, planos, props, espacos, fornecedores, equipe, eventos, recarregar }), [userId, os, planos, props, espacos, fornecedores, equipe, eventos, recarregar]);

  const subtitulo = useMemo(() => ({
    ordens: 'Quadro de OS corretivas, preventivas e inspeções — abertura, prazo, custo e responsável.',
    preventiva: 'Planos periódicos com checklist que viram OS na data — e a vistoria pré-evento.',
    custos: 'Onde a manutenção gasta: por mês, por ativo, peças e tempo médio de reparo.',
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
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Manutenção & Ordens de Serviço</h1>
        <p className="mt-1 text-sm text-ink-muted">{subtitulo}</p>
      </div>

      {needsSetup ? (
        <SetupCard />
      ) : (
        <>
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
            {userId && tab === 'ordens' && <Ordens {...shared} />}
            {userId && tab === 'preventiva' && <Preventiva {...shared} />}
            {tab === 'custos' && <Custos os={os} props={props} espacos={espacos} />}
          </div>
        </>
      )}
    </div>
  );
}

// Empty-state quando as tabelas de manutenção ainda não foram criadas.
function SetupCard() {
  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600"><IcoWrench /></div>
      <h3 className="text-base font-bold text-ink">Ative o módulo Manutenção</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
        Rode <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">docs/sql/manutencao.sql</code> no Supabase (SQL Editor) para criar as tabelas <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">manutencao_os</code> e <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">manutencao_planos</code> e liberar o quadro de OS, planos preventivos e custos.
      </p>
    </div>
  );
}

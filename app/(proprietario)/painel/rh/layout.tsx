'use client';

// Shell do hub de RH — /painel/rh/*.
// Centraliza sessão, gate premium (Pro+), detecção de setup (docs/sql/rh.sql) e o
// carregamento ÚNICO do quadro de funcionários (`equipe`), expondo tudo via
// RhContext para as sub-rotas. Também desenha a navegação por abas entre as
// sub-rotas. Assim cada página filha já recebe userId/equipe prontos e só
// carrega os seus dados específicos (vagas, ausências, documentos…).

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import {
  RhContext, isMissingTable, isPremium, mapFunc, SEL_FUNC, type Funcionario,
} from './_lib';
import {
  PremiumOverlay, SetupNotice,
  IcoHome, IcoUsers, IcoBriefcase, IcoUserPlus, IcoPalm, IcoClock, IcoFolder, IcoUserX,
} from './_components/ui';

const SUBNAV: { href: string; label: string; icon: () => JSX.Element }[] = [
  { href: '/painel/rh', label: 'Visão geral', icon: IcoHome },
  { href: '/painel/rh/funcionarios', label: 'Funcionários', icon: IcoUsers },
  { href: '/painel/rh/recrutamento', label: 'Recrutamento', icon: IcoBriefcase },
  { href: '/painel/rh/admissao', label: 'Admissão', icon: IcoUserPlus },
  { href: '/painel/rh/ferias', label: 'Férias & Ausências', icon: IcoPalm },
  { href: '/painel/rh/ponto', label: 'Ponto', icon: IcoClock },
  { href: '/painel/rh/documentos', label: 'Documentos', icon: IcoFolder },
  { href: '/painel/rh/desligamento', label: 'Desligamento', icon: IcoUserX },
];

function ymdHoje(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function RhLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [premium, setPremium] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [equipe, setEquipe] = useState<Funcionario[]>([]);
  const hoje = ymdHoje();

  const loadEquipe = useCallback(async (uid: string) => {
    const { data, error } = await sb.from('equipe').select(SEL_FUNC).eq('usuario_id', uid).order('nome');
    if (error) { setEquipe([]); return; }
    setEquipe((data || []).map(mapFunc));
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;
      setUserId(uid);

      try {
        const { data: a } = await sb.from('assinaturas').select('plano_ativo').eq('usuario_id', uid).maybeSingle();
        setPremium(isPremium(a?.plano_ativo));
      } catch { setPremium(false); }

      // Sonda: as tabelas de RH existem? (todas vêm da mesma migration).
      const probe = await sb.from('rh_vagas').select('id').limit(1);
      if (isMissingTable(probe.error)) { setNeedsSetup(true); setLoading(false); return; }

      await loadEquipe(uid);
      setLoading(false);
    })();
  }, [loadEquipe]);

  const reloadEquipe = useCallback(async () => { if (userId) await loadEquipe(userId); }, [userId, loadEquipe]);

  const header = (
    <div>
      <h1 className="text-xl font-bold text-ink sm:text-2xl">RH · Pessoas</h1>
      <p className="mt-1 text-sm text-ink-muted">
        Ciclo completo de pessoas para operação de eventos — CLT fixo e freelancers. A folha continua no motor de <Link href="/painel/equipe" className="font-semibold text-brand underline">Equipe</Link>.
      </p>
    </div>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-[44px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
      </div>
    );
  }

  // Gate premium (Pro+): mostra o hub borrado + CTA.
  if (!premium) {
    return (
      <div className="mx-auto max-w-6xl space-y-5">
        {header}
        <div className="relative">
          <div className="pointer-events-none select-none blur-sm">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[96px] rounded-2xl bg-black/[0.05]" />)}</div>
          </div>
          <PremiumOverlay />
        </div>
      </div>
    );
  }

  if (needsSetup || !userId) {
    return <div className="mx-auto max-w-6xl space-y-5">{header}<SetupNotice /></div>;
  }

  return (
    <RhContext.Provider value={{ userId, hoje, equipe, reloadEquipe }}>
      <div className="mx-auto max-w-6xl space-y-5">
        {header}

        {/* Sub-navegação (abas → sub-rotas reais) */}
        <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
          {SUBNAV.map(({ href, label, icon: Ico }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
                  active ? 'bg-ink text-white' : 'bg-white text-ink-muted shadow-card hover:text-ink'
                }`}
              >
                <Ico /> {label}
              </Link>
            );
          })}
        </div>

        {children}
      </div>
    </RhContext.Provider>
  );
}

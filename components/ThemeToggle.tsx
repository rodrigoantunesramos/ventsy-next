'use client';

// Toggle de tema do painel — cicla Automático(sistema) → Claro → Escuro.
// Persiste via lib/prefs (localStorage + classe `dark` no <html>), em sincronia
// com o bootstrap anti-FOUC do RootHtml. Quando em 'sistema', reaplica ao vivo
// se o SO trocar de tema. Reage ao evento `ventsy:prefs` (mudou em outro lugar).

import { useEffect, useState } from 'react';
import { applyPrefs, applyTema, loadStoredPrefs, type Tema } from '@/lib/prefs';

const ORDEM: Tema[] = ['sistema', 'claro', 'escuro'];
const LABEL: Record<Tema, string> = {
  sistema: 'Tema: automático',
  claro: 'Tema: claro',
  escuro: 'Tema: escuro',
};

function Icone({ tema }: { tema: Tema }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (tema === 'claro') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
    );
  }
  if (tema === 'escuro') {
    return (
      <svg {...common}>
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
    );
  }
  // sistema — monitor
  return (
    <svg {...common}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export default function ThemeToggle() {
  const [tema, setTema] = useState<Tema | null>(null);

  // Inicializa do localStorage só no cliente (evita mismatch de hidratação).
  useEffect(() => {
    setTema(loadStoredPrefs()?.tema ?? 'sistema');
    const onPrefs = (e: Event) => {
      const t = (e as CustomEvent).detail?.tema as Tema | undefined;
      if (t) setTema(t);
    };
    window.addEventListener('ventsy:prefs', onPrefs as EventListener);
    return () => window.removeEventListener('ventsy:prefs', onPrefs as EventListener);
  }, []);

  // Em 'sistema', acompanha a troca de tema do SO em tempo real.
  useEffect(() => {
    if (tema !== 'sistema' || typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTema('sistema');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [tema]);

  if (!tema) return null;

  // Lê a preferência PERSISTIDA no momento do clique (não o estado React, que
  // pode estar defasado entre dois cliques rápidos no mesmo frame).
  const ciclar = () => {
    const atual = loadStoredPrefs()?.tema ?? tema;
    const proximo = ORDEM[(ORDEM.indexOf(atual) + 1) % ORDEM.length];
    applyPrefs({ tema: proximo });
    setTema(proximo);
  };

  return (
    <button
      onClick={ciclar}
      aria-label={`${LABEL[tema]} — clique para alternar`}
      title={LABEL[tema]}
      className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-black/[0.04]"
    >
      <Icone tema={tema} />
    </button>
  );
}

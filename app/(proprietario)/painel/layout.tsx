'use client';

// Shell único do painel do proprietário (/painel/*).
// Substitui o dashboard legado em JS-puro de app/(dashboard)/dashboard.
// Namespaced em /painel para não colidir com as rotas de (public) (/calendario, /planos…).

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';

type Profile = {
  nome: string;
  email: string;
  usuario: string;
  inicial: string;
  plano: string;
  validade: string | null;
};

type NavItem = { href: string; label: string; icon: keyof typeof ICONS; enabled?: boolean };
type NavGroup = { group: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: 'Geral',
    items: [
      { href: '/painel', label: 'Painel', icon: 'home', enabled: true },
      { href: '/painel/minha-propriedade', label: 'Minha Propriedade', icon: 'building', enabled: true },
      { href: '/painel/fotos', label: 'Fotos', icon: 'image', enabled: true },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { href: '/painel/calendario', label: 'Calendário', icon: 'calendar', enabled: true },
      { href: '/painel/financeiro', label: 'Financeiro', icon: 'wallet', enabled: true },
      { href: '/painel/leads', label: 'Leads', icon: 'target', enabled: true },
      { href: '/painel/relatorios', label: 'Relatórios', icon: 'chart' },
      { href: '/painel/documentos', label: 'Documentos', icon: 'doc', enabled: true },
      { href: '/painel/equipe', label: 'Equipe', icon: 'users' },
      { href: '/painel/diario', label: 'Diário', icon: 'book' },
    ],
  },
  {
    group: 'Conta',
    items: [
      { href: '/painel/indique', label: 'Indique & Ganhe', icon: 'gift' },
      { href: '/painel/configuracoes', label: 'Configurações', icon: 'cog', enabled: true },
      { href: '/painel/planos', label: 'Planos', icon: 'card', enabled: true },
    ],
  },
];

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const avatarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) {
        router.replace('/login');
        return;
      }

      const user = session.user;
      let nome = user.email ?? '';
      let usuario = '';
      let plano = 'basico';
      let validade: string | null = null;

      try {
        const { data: perfil } = await sb.from('usuarios').select('*').eq('id', user.id).single();
        if (perfil) {
          nome = perfil.nome || nome;
          usuario = perfil.usuario || '';
        }
      } catch { /* perfil opcional */ }

      try {
        const { data: assin } = await sb.from('assinaturas').select('*').eq('usuario_id', user.id).maybeSingle();
        if (assin) {
          plano = (assin.plano_ativo || assin.plano || 'basico').toString().toLowerCase();
          validade = assin.fim_periodo || assin.validade || null;
        }
      } catch { /* assinatura opcional */ }

      const inicial = (nome.split(' ')[0]?.[0] ?? '?').toUpperCase();
      setProfile({ nome, email: user.email ?? '', usuario, inicial, plano, validade });
      setLoading(false);
    })();
  }, [router]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) setAvatarOpen(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  const handleSair = async () => {
    await sb.auth.signOut();
    router.replace('/login');
  };

  const planoEmoji = profile?.plano === 'ultra' ? '🚀' : profile?.plano === 'pro' ? '⭐' : '🏷️';

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white">
        <div className="font-display text-[2rem] italic text-brand">VENTSY</div>
        <div className="mt-4 flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-brand"
              style={{ animation: `bounce-dot 1s ${i * 0.15}s infinite` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] text-ink">
      {/* Topbar */}
      <header className="sticky top-0 z-[100] flex h-[60px] items-center justify-between border-b border-black/[0.06] bg-white px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Menu"
            className="flex flex-col gap-[5px] p-2 md:hidden"
          >
            <span className="block h-[2px] w-[22px] rounded-sm bg-ink-soft" />
            <span className="block h-[2px] w-[22px] rounded-sm bg-ink-soft" />
            <span className="block h-[2px] w-[22px] rounded-sm bg-ink-soft" />
          </button>
          <Link href="/" className="font-display text-[1.4rem] font-bold italic text-brand">
            VENTSY
          </Link>
        </div>

        <div ref={avatarRef} className="relative">
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-brand text-base font-bold text-white"
          >
            {profile?.inicial ?? '?'}
          </button>
          {avatarOpen && (
            <div className="absolute right-0 top-[46px] z-[200] min-w-[220px] rounded-xl border border-black/[0.06] bg-white py-2 shadow-pop">
              <div className="border-b border-black/[0.06] px-4 py-2.5">
                <div className="text-sm font-bold">{profile?.nome}</div>
                <div className="mt-0.5 text-xs text-ink-muted">{profile?.email}</div>
              </div>
              <Link href="/painel" className="block px-4 py-2.5 text-sm hover:bg-[#f7f7f7]" onClick={() => setAvatarOpen(false)}>
                Painel
              </Link>
              <Link href="/" className="block px-4 py-2.5 text-sm hover:bg-[#f7f7f7]" onClick={() => setAvatarOpen(false)}>
                Ver o site
              </Link>
              <button
                onClick={handleSair}
                className="mt-1 w-full border-t border-black/[0.06] px-4 py-2.5 text-left text-sm text-brand"
              >
                Sair da conta
              </button>
            </div>
          )}
        </div>
      </header>

      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-[149] bg-black/40 md:hidden" />
      )}

      <div className="flex min-h-[calc(100vh-60px)]">
        {/* Sidebar */}
        <aside
          className={`fixed top-[60px] z-[150] h-[calc(100vh-60px)] w-[260px] flex-shrink-0 overflow-y-auto border-r border-black/[0.06] bg-white transition-[left] duration-300 md:sticky md:left-0 ${
            sidebarOpen ? 'left-0' : '-left-[280px]'
          }`}
        >
          {/* Perfil */}
          <div className="border-b border-black/[0.04] px-5 pb-4 pt-6">
            <div className="mb-2.5 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-xl font-bold text-white">
              {profile?.inicial ?? '?'}
            </div>
            <div className="text-[0.95rem] font-bold text-ink">{profile?.nome}</div>
            {profile?.usuario && <div className="mt-0.5 text-xs text-ink-muted">@{profile.usuario}</div>}
            <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand-50 px-2.5 py-[3px] text-xs font-semibold text-brand">
              {planoEmoji} {profile?.plano}
            </div>
            {profile?.validade && (
              <div className="mt-1 text-[0.72rem] text-ink-muted">Válido até {formatDate(profile.validade)}</div>
            )}
          </div>

          {/* Menu */}
          <nav className="py-3">
            {NAV.map((grupo) => (
              <div key={grupo.group}>
                <div className="px-5 pb-1 pt-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ink-muted/70">
                  {grupo.group}
                </div>
                {grupo.items.map((item) => {
                  const active = pathname === item.href;
                  if (item.enabled) {
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`flex items-center gap-3 border-l-[3px] px-5 py-2.5 text-sm transition-colors ${
                          active
                            ? 'border-brand bg-brand-50 font-semibold text-brand'
                            : 'border-transparent text-ink-soft hover:bg-brand-50 hover:text-brand'
                        }`}
                      >
                        <Icon name={item.icon} />
                        {item.label}
                      </Link>
                    );
                  }
                  return (
                    <div
                      key={item.href}
                      className="flex cursor-not-allowed items-center gap-3 border-l-[3px] border-transparent px-5 py-2.5 text-sm text-ink-muted/50"
                      title="Em breve"
                    >
                      <Icon name={item.icon} />
                      <span className="flex-1">{item.label}</span>
                      <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted">
                        Em breve
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

// ── Ícones (stroke, estilo premium) ────────────────────────────────────────
const ICONS = {
  home: 'M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  building: 'M3 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M15 21V9h4a2 2 0 0 1 2 2v10M7 7h2M7 11h2M7 15h2',
  image: 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 13 5-5 4 4 4-4 5 5M9 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
  calendar: 'M3 9h18M7 3v4M17 3v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  wallet: 'M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H3Zm0 0v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H5M16 13h.01',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0-4a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  doc: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8M8 17h6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm13 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5Z',
  gift: 'M20 12v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9M2 7h20v5H2zM12 22V7M12 7S8 7 8 4.5 12 7 12 7Zm0 0s4 0 4-2.5S12 7 12 7Z',
  cog: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a8 8 0 0 0-.13-1.4l2-1.55-2-3.46-2.36.95a8 8 0 0 0-2.42-1.4L14.7 2h-4l-.39 2.74a8 8 0 0 0-2.42 1.4L5.53 5.2l-2 3.46 2 1.55A8 8 0 0 0 5.4 12a8 8 0 0 0 .13 1.4l-2 1.55 2 3.46 2.36-.95a8 8 0 0 0 2.42 1.4L10.7 22h4l.39-2.74a8 8 0 0 0 2.42-1.4l2.36.95 2-3.46-2-1.55A8 8 0 0 0 20 12Z',
  card: 'M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Zm0 4h18',
} as const;

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

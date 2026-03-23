'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import '@/styles/dashboard.css';

// ── Interfaces ────────────────────────────────────────────────────────────────
interface UserProfile {
  nome: string;
  email: string;
  usuario: string;
  inicial: string;
  plano: string;
  validade: string | null;
}

interface LayoutProps {
  children: React.ReactNode;
}

// ── Menu items ────────────────────────────────────────────────────────────────
const MENU_ITEMS = [
  { rota: 'dashboard',        label: '🏠 Dashboard',          group: 'Geral'  },
  { rota: 'minhapropriedade', label: '🏡 Minha Propriedade',  group: 'Geral'  },
  { rota: 'fotos',            label: '📸 Fotos',              group: 'Geral'  },
  { rota: 'calendario',       label: '📅 Calendário',         group: 'Gestão' },
  { rota: 'financeiro',       label: '💰 Financeiro',         group: 'Gestão' },
  { rota: 'leads',            label: '🎯 Leads',              group: 'Gestão' },
  { rota: 'relatorio',        label: '📋 Relatório',          group: 'Gestão' },
  { rota: 'documentos',       label: '📄 Documentos',         group: 'Gestão' },
  { rota: 'equipe',           label: '👥 Equipe',             group: 'Gestão' },
  { rota: 'diario',           label: '📒 Diário Inteligente', group: 'Gestão', href: '/dashboard/diario' },
  { rota: 'indique',          label: '🎁 Indique & Ganhe',    group: 'Conta'  },
  { rota: 'configuracoes',    label: '⚙️ Configurações',      group: 'Conta'  },
  { rota: 'planos',           label: '💳 Planos Ventsy',      group: 'Conta'  },
];

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout({ children }: LayoutProps) {
  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [sidebarOpen, setSidebar] = useState(false);
  const [avatarOpen, setAvatar]   = useState(false);
  const [loading, setLoading]     = useState(true);

  const router    = useRouter();
  const avatarRef = useRef<HTMLDivElement>(null);

  // ── Carrega sessão e perfil ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      const user = session.user;
      let nome     = user.email ?? '';
      let usuario  = '';
      let plano    = 'basico';
      let validade: string | null = null;

      // Busca perfil
      try {
        const { data: perfil } = await sb
          .from('usuarios')
          .select('*')
          .eq('id', user.id)
          .single();
        if (perfil) {
          nome    = perfil.nome    || nome;
          usuario = perfil.usuario || '';
        }
      } catch (e) { console.error('Erro perfil:', e); }

      // Busca assinatura — inclui todos os campos necessários
      try {
        const { data: assin } = await sb
          .from('assinaturas')
          .select('plano, validade, plano_ativo, fim_periodo')
          .eq('usuario_id', user.id)
          .maybeSingle();

        if (assin) {
          plano    = (assin.plano_ativo || assin.plano || 'basico').toLowerCase();
          validade = assin.fim_periodo  || assin.validade || null;
        }
      } catch (e) { console.error('Erro assinatura:', e); }

      const inicial = (nome.split(' ')[0]?.[0] ?? '?').toUpperCase();

      setProfile({ nome, email: user.email ?? '', usuario, inicial, plano, validade });
      setLoading(false);
    })();
  }, [router]);

  // ── Fecha avatar ao clicar fora ───────────────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!avatarRef.current?.contains(e.target as Node)) setAvatar(false);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ── Sign out ──────────────────────────────────────────────────────────────
  const handleSair = async () => {
    await sb.auth.signOut();
    router.push('/login');
  };

  const planoEmoji = profile?.plano === 'ultra' ? '🚀'
                   : profile?.plano === 'pro'   ? '⭐'
                   : '🏷️';

  // ── Layout principal ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#f7f7f8]">

      {/* ── LOADING OVERLAY ─────────────────────────────────────────────── */}
      {loading && (
        <div className="fixed inset-0 bg-white flex flex-col items-center justify-center z-[9999]">
          <div className="font-serif italic text-[2rem] text-[#ff385c]">VENTSY</div>
          <div className="flex gap-[6px] mt-4">
            {[0, 1, 2].map(i => (
              <span
                key={i}
                className="w-2 h-2 rounded-full bg-[#ff385c]"
                style={{ animation: `bounce-dot 1s ${i * 0.15}s infinite` }}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-[100] bg-white border-b border-[#f0f0f0] flex items-center justify-between px-5 h-[60px]">
        <div className="flex items-center gap-3">
          {/* Hambúrguer mobile */}
          <button
            onClick={() => setSidebar(!sidebarOpen)}
            aria-label="Menu"
            className="hidden max-md:flex bg-transparent border-none cursor-pointer p-2 flex-col gap-[5px]"
          >
            <span className="block w-[22px] h-[2px] bg-[#333] rounded-sm" />
            <span className="block w-[22px] h-[2px] bg-[#333] rounded-sm" />
            <span className="block w-[22px] h-[2px] bg-[#333] rounded-sm" />
          </button>

          <Link href="/">
            <span className="font-serif italic text-[1.4rem] text-[#ff385c] font-bold">
              VENTSY
            </span>
          </Link>
        </div>

        {/* Avatar dropdown */}
        <div ref={avatarRef} className="relative">
          <button
            onClick={() => setAvatar(!avatarOpen)}
            className="w-[38px] h-[38px] rounded-full bg-[#ff385c] text-white border-none cursor-pointer text-[1rem] font-bold"
          >
            {profile?.inicial ?? '?'}
          </button>

          {avatarOpen && (
            <div className="absolute top-[46px] right-0 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-[#f0f0f0] min-w-[220px] py-2 z-[200]">
              <div className="px-4 py-[10px] border-b border-[#f0f0f0]">
                <div className="font-bold text-[.9rem]">{profile?.nome}</div>
                <div className="text-[.78rem] text-[#999] mt-0.5">{profile?.email}</div>
              </div>
              {[
                { href: '/dashboard',                    label: '🏠 Dashboard' },
                { href: '/dashboard#minhapropriedade',   label: '🏡 Minha Propriedade' },
                { href: '/dashboard#configuracoes',      label: '⚙️ Configurações' },
                { href: '/dashboard#planos',             label: '💳 Planos Ventsy' },
              ].map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block px-4 py-[9px] text-[.88rem] text-[#333] no-underline hover:bg-[#f7f7f7]"
                  onClick={() => setAvatar(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSair}
                className="w-full text-left px-4 py-[9px] border-none bg-transparent cursor-pointer text-[.88rem] text-[#ff385c] border-t border-[#f0f0f0] mt-1"
              >
                🚪 Sair da conta
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── OVERLAY MOBILE ──────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebar(false)}
          className="fixed inset-0 bg-black/40 z-[149]"
        />
      )}

      {/* ── LAYOUT ──────────────────────────────────────────────────────── */}
      <div className="flex min-h-[calc(100vh-60px)]">

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside
          className={`dash-sidebar w-[260px] flex-shrink-0 bg-white border-r border-[#f0f0f0] flex flex-col sticky top-[60px] overflow-y-auto
            max-md:fixed max-md:top-[60px] max-md:z-[150] max-md:transition-[left_.28s_ease]
            ${sidebarOpen ? 'max-md:left-0' : 'max-md:-left-[280px]'}`}
          style={{ height: 'calc(100vh - 60px)' }}
        >
          {/* Perfil */}
          <div className="px-5 pt-6 pb-4 border-b border-[#f5f5f5]">
            <div className="w-12 h-12 rounded-full bg-[#ff385c] text-white flex items-center justify-center font-bold text-[1.2rem] mb-2.5">
              {profile?.inicial ?? '?'}
            </div>
            <div className="font-bold text-[.95rem] text-[#111]">
              {profile?.nome}
            </div>
            {profile?.usuario && (
              <div className="text-[.78rem] text-[#aaa] mt-0.5">
                @{profile.usuario}
              </div>
            )}
            <div className="mt-2 inline-flex items-center gap-1 bg-[#fff5f6] text-[#ff385c] border border-[rgba(255,56,92,.2)] rounded-[20px] px-2.5 py-[3px] text-[.75rem] font-semibold">
              {planoEmoji} {profile?.plano}
            </div>
            {profile?.validade && (
              <div className="text-[.72rem] text-[#bbb] mt-1">
                Válido até {new Date(profile.validade).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>

          {/* Menu */}
          <nav className="py-3 flex-1">
            {(() => {
              let lastGroup: string | null = null;
              return MENU_ITEMS.map(item => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={item.rota}>
                    {showGroup && (
                      <div className="px-5 pt-[10px] pb-1 text-[.68rem] font-bold text-[#bbb] tracking-[.08em] uppercase">
                        {item.group}
                      </div>
                    )}
                    {(item as any).href ? (
                      <Link
                        href={(item as any).href}
                        onClick={() => setSidebar(false)}
                        className="dash-menu-link block px-5 py-[9px] text-[.88rem] text-[#444] no-underline border-l-[3px] border-transparent transition-all duration-150"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        href={`#${item.rota}`}
                        data-rota={item.rota}
                        onClick={(e) => {
                          e.preventDefault();
                          setSidebar(false);
                          (window as any).navegar?.(item.rota);
                        }}
                        className="dash-menu-link block px-5 py-[9px] text-[.88rem] text-[#444] no-underline border-l-[3px] border-transparent transition-all duration-150"
                      >
                        {item.label}
                      </a>
                    )}
                  </div>
                );
              });
            })()}
          </nav>
        </aside>

        {/* ── CONTEÚDO ────────────────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

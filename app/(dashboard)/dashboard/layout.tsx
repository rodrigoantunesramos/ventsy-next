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

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div id="loading-screen" style={{
        position: 'fixed', inset: 0, background: '#fff',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', zIndex: 9999,
      }}>
        <div style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '2rem', color: '#ff385c' }}>
          VENTSY
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 8, height: 8, borderRadius: '50%', background: '#ff385c',
              animation: `bounce 1s ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>
        <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
      </div>
    );
  }

  // ── Layout principal ──────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f7f7f8' }}>

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #f0f0f0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 60,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Hambúrguer mobile */}
          <button
            onClick={() => setSidebar(!sidebarOpen)}
            aria-label="Menu"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 8,
              flexDirection: 'column', gap: 5,
            }}
            className="btn-sidebar-toggle"
          >
            <span style={{ display: 'block', width: 22, height: 2, background: '#333', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#333', borderRadius: 2 }} />
            <span style={{ display: 'block', width: 22, height: 2, background: '#333', borderRadius: 2 }} />
          </button>

          <Link href="/">
            <span style={{ fontFamily: 'Georgia,serif', fontStyle: 'italic', fontSize: '1.4rem', color: '#ff385c', fontWeight: 700 }}>
              VENTSY
            </span>
          </Link>
        </div>

        {/* Avatar dropdown */}
        <div ref={avatarRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setAvatar(!avatarOpen)}
            style={{
              width: 38, height: 38, borderRadius: '50%',
              background: '#ff385c', color: '#fff',
              border: 'none', cursor: 'pointer',
              fontSize: '1rem', fontWeight: 700,
            }}
          >
            {profile?.inicial ?? '?'}
          </button>

          {avatarOpen && (
            <div style={{
              position: 'absolute', top: 46, right: 0,
              background: '#fff', borderRadius: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
              border: '1px solid #f0f0f0',
              minWidth: 220, padding: '8px 0', zIndex: 200,
            }}>
              <div style={{ padding: '10px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{profile?.nome}</div>
                <div style={{ fontSize: '.78rem', color: '#999', marginTop: 2 }}>{profile?.email}</div>
              </div>
              {[
                { href: '/dashboard',                    label: '🏠 Dashboard' },
                { href: '/dashboard#minhapropriedade',   label: '🏡 Minha Propriedade' },
                { href: '/dashboard#configuracoes',      label: '⚙️ Configurações' },
                { href: '/dashboard#planos',             label: '💳 Planos Ventsy' },
              ].map(item => (
                <Link key={item.href} href={item.href} style={{
                  display: 'block', padding: '9px 16px',
                  fontSize: '.88rem', color: '#333', textDecoration: 'none',
                }}
                  onClick={() => setAvatar(false)}
                >
                  {item.label}
                </Link>
              ))}
              <button
                onClick={handleSair}
                style={{
                  width: '100%', textAlign: 'left', padding: '9px 16px',
                  border: 'none', background: 'none', cursor: 'pointer',
                  fontSize: '.88rem', color: '#ff385c', borderTop: '1px solid #f0f0f0',
                  marginTop: 4,
                }}
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
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            zIndex: 149,
          }}
        />
      )}

      {/* ── LAYOUT ──────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', minHeight: 'calc(100vh - 60px)' }}>

        {/* ── SIDEBAR ─────────────────────────────────────────────────── */}
        <aside
          className="dash-sidebar"
          style={{
            width: 260, flexShrink: 0,
            background: '#fff', borderRight: '1px solid #f0f0f0',
            display: 'flex', flexDirection: 'column',
            position: 'sticky', top: 60, height: 'calc(100vh - 60px)',
            overflowY: 'auto',
          }}
        >
          {/* Perfil */}
          <div style={{ padding: '24px 20px 16px', borderBottom: '1px solid #f5f5f5' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%',
              background: '#ff385c', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '1.2rem', marginBottom: 10,
            }}>
              {profile?.inicial ?? '?'}
            </div>
            <div style={{ fontWeight: 700, fontSize: '.95rem', color: '#111' }}>
              {profile?.nome}
            </div>
            {profile?.usuario && (
              <div style={{ fontSize: '.78rem', color: '#aaa', marginTop: 2 }}>
                @{profile.usuario}
              </div>
            )}
            <div style={{
              marginTop: 8, display: 'inline-flex', alignItems: 'center', gap: 4,
              background: '#fff5f6', color: '#ff385c',
              border: '1px solid rgba(255,56,92,.2)',
              borderRadius: 20, padding: '3px 10px', fontSize: '.75rem', fontWeight: 600,
            }}>
              {planoEmoji} {profile?.plano}
            </div>
            {profile?.validade && (
              <div style={{ fontSize: '.72rem', color: '#bbb', marginTop: 4 }}>
                Válido até {new Date(profile.validade).toLocaleDateString('pt-BR')}
              </div>
            )}
          </div>

          {/* Menu */}
          <nav style={{ padding: '12px 0', flex: 1 }}>
            {(() => {
              let lastGroup: string | null = null;
              return MENU_ITEMS.map(item => {
                const showGroup = item.group !== lastGroup;
                lastGroup = item.group;
                return (
                  <div key={item.rota}>
                    {showGroup && (
                      <div style={{
                        padding: '10px 20px 4px',
                        fontSize: '.68rem', fontWeight: 700,
                        color: '#bbb', letterSpacing: '.08em',
                        textTransform: 'uppercase',
                      }}>
                        {item.group}
                      </div>
                    )}
                    {(item as any).href ? (
                      <Link
                        href={(item as any).href}
                        onClick={() => setSidebar(false)}
                        style={{
                          display: 'block',
                          padding: '9px 20px',
                          fontSize: '.88rem', color: '#444',
                          textDecoration: 'none',
                          borderLeft: '3px solid transparent',
                          transition: 'all .15s',
                        }}
                        className="dash-menu-link"
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
                        style={{
                          display: 'block',
                          padding: '9px 20px',
                          fontSize: '.88rem', color: '#444',
                          textDecoration: 'none',
                          borderLeft: '3px solid transparent',
                          transition: 'all .15s',
                        }}
                        className="dash-menu-link"
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
        <main style={{ flex: 1, minWidth: 0, overflowX: 'hidden' }}>
          {children}
        </main>
      </div>

      {/* CSS global específico do admin */}
      <style>{`
        .btn-sidebar-toggle { display: none; }
        @media (max-width: 768px) {
          .btn-sidebar-toggle { display: flex !important; }
          .dash-sidebar {
            position: fixed !important;
            top: 60px !important;
            left: ${sidebarOpen ? '0' : '-280px'} !important;
            z-index: 150 !important;
            height: calc(100vh - 60px) !important;
            transition: left .28s ease !important;
          }
        }
        .dash-menu-link:hover {
          background: #fff5f6;
          color: #ff385c !important;
          border-left-color: #ff385c !important;
        }
        .dash-menu-link.active {
          background: #fff5f6;
          color: #ff385c !important;
          border-left-color: #ff385c !important;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

'use client';

// Shell único do painel do proprietário (/painel/*).
// Substitui o dashboard legado em JS-puro de app/(dashboard)/dashboard.
// Namespaced em /painel para não colidir com as rotas de (public) (/calendario, /planos…).

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { applyPrefs, type Idioma, type FormatoData } from '@/lib/prefs';
import type { Currency } from '@/lib/format';
import { ToastProvider } from '@/components/Toast';
import NotificationBell from '@/components/NotificationBell';
import ThemeToggle from '@/components/ThemeToggle';
import { useT } from '@/components/i18n/I18nProvider';
import UpgradeGate from '@/components/UpgradeGate';
import CommandPalette from '@/components/CommandPalette';
import { NAV, Icon } from '@/components/painel/nav';
import {
  MODULOS_PAINEL, moduloDaRota, moduloDef, planoMinimoParaModulo,
  modulosDefaultDoPlano, resolverEntitlement, PLANO_LABEL,
} from '@/lib/modulos';

// Cliente sem tipos para colunas/tabelas novas (planos_config.modulos,
// modulos_config, usuarios_modulos) até types/supabase.ts ser regenerado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sbAny = sb as any;

type Profile = {
  nome: string;
  email: string;
  usuario: string;
  inicial: string;
  plano: string;
  validade: string | null;
};

export default function PainelLayout({ children }: { children: React.ReactNode }) {
  const { dict } = useT();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  // Entitlement por plano (módulos liberados) + add-ons + config global de módulos.
  const [entitled, setEntitled] = useState<Set<string> | null>(null);
  const [planosModulos, setPlanosModulos] = useState<Record<string, string[]>>({});
  const [modCfg, setModCfg] = useState<Record<string, { ativo: boolean; vendavel: boolean; preco: number }>>({});

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
          plano = (assin.plano_ativo || 'basico').toString().toLowerCase();
          validade = assin.fim_periodo || null;
        }
      } catch { /* assinatura opcional */ }

      // Aplica idioma/moeda/fuso (empresa_config) ao painel inteiro via lib/format.
      try {
        const { data: cfg } = await sb.from('empresa_config').select('idioma, moeda, fuso, preferencias').eq('usuario_id', user.id).maybeSingle();
        if (cfg) applyPrefs({ idioma: cfg.idioma as Idioma, moeda: cfg.moeda as Currency, fuso: cfg.fuso, formato_data: (cfg.preferencias as { formato_data?: FormatoData } | null)?.formato_data });
      } catch { /* sem config — usa defaults/localStorage */ }

      // Resolve o que o plano + add-ons liberam. Falha-aberto: nunca tranca por erro.
      try {
        const [{ data: planosRows }, { data: extrasRows }, { data: modRows }] = await Promise.all([
          sbAny.from('planos_config').select('id, modulos'),
          sbAny.from('usuarios_modulos').select('modulo_key, fim').eq('usuario_id', user.id).eq('status', 'ativo'),
          sbAny.from('modulos_config').select('key, ativo, vendavel, preco_avulso'),
        ]);
        const pm: Record<string, string[]> = {};
        for (const r of (planosRows ?? []) as Array<{ id: string; modulos: string[] | null }>) {
          pm[r.id] = Array.isArray(r.modulos) && r.modulos.length ? r.modulos : modulosDefaultDoPlano(r.id);
        }
        for (const id of ['basico', 'pro', 'ultra']) if (!pm[id]) pm[id] = modulosDefaultDoPlano(id);
        const mc: Record<string, { ativo: boolean; vendavel: boolean; preco: number }> = {};
        for (const r of (modRows ?? []) as Array<{ key: string; ativo: boolean | null; vendavel: boolean | null; preco_avulso: number | null }>) {
          mc[r.key] = { ativo: r.ativo !== false, vendavel: r.vendavel === true, preco: Number(r.preco_avulso) || 0 };
        }
        const hoje = new Date().toISOString().slice(0, 10);
        const extras = ((extrasRows ?? []) as Array<{ modulo_key: string; fim: string | null }>)
          .filter((r) => !r.fim || r.fim >= hoje)
          .map((r) => r.modulo_key);
        setPlanosModulos(pm);
        setModCfg(mc);
        setEntitled(resolverEntitlement(pm[plano] ?? modulosDefaultDoPlano(plano), extras));
      } catch {
        setEntitled(new Set(MODULOS_PAINEL.map((m) => m.key)));
      }

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

  if (loading || !entitled) {
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
    <ToastProvider>
    <div className="min-h-screen bg-[#f7f7f8] text-ink">
      {/* Topbar */}
      <header className="sticky top-0 z-[100] flex h-[60px] items-center justify-between border-b border-black/[0.06] bg-white px-4 sm:px-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label={dict.painel.shell.menu}
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

        <CommandPalette entitled={entitled} modCfg={modCfg} planosModulos={planosModulos} />

        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <NotificationBell />
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
                {dict.painel.nav.itens.painel}
              </Link>
              <Link href="/client" className="flex items-center gap-2 border-t border-black/[0.06] px-4 py-2.5 text-sm hover:bg-[#f7f7f7]" onClick={() => setAvatarOpen(false)}>
                🎉 {dict.painel.shell.minhaArea}
              </Link>
              <Link href="/" className="block px-4 py-2.5 text-sm hover:bg-[#f7f7f7]" onClick={() => setAvatarOpen(false)}>
                {dict.painel.shell.verSite}
              </Link>
              <button
                onClick={handleSair}
                className="mt-1 w-full border-t border-black/[0.06] px-4 py-2.5 text-left text-sm text-brand"
              >
                {dict.painel.shell.sairConta}
              </button>
            </div>
          )}
          </div>
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
              <div className="mt-1 text-[0.72rem] text-ink-muted">{dict.painel.shell.validoAte} {formatDate(profile.validade)}</div>
            )}
          </div>

          {/* Menu */}
          <nav className="py-3">
            {NAV.map((grupo) => (
              <div key={grupo.gkey}>
                <div className="px-5 pb-1 pt-2.5 text-[0.68rem] font-bold uppercase tracking-[0.08em] text-ink-muted/70">
                  {dict.painel.nav.grupos[grupo.gkey]}
                </div>
                {grupo.items.map((item) => {
                  const active = pathname === item.href || (item.href !== '/painel' && pathname.startsWith(item.href + '/'));
                  const modKey = moduloDaRota(item.href);
                  const def = modKey ? moduloDef(modKey) : undefined;
                  // Módulo desligado globalmente pelo admin some do menu (núcleo nunca some).
                  if (def && !def.core && modKey && modCfg[modKey]?.ativo === false) return null;
                  // Travado: existe no catálogo, não é núcleo e o plano/add-ons não liberam.
                  const locked = !!def && !def.core && !!modKey && !!entitled && !entitled.has(modKey);

                  if (item.enabled !== false && !locked) {
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
                        {dict.painel.nav.itens[item.key]}
                      </Link>
                    );
                  }

                  if (locked) {
                    const planoMin = planoMinimoParaModulo(modKey!, planosModulos);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center gap-3 border-l-[3px] border-transparent px-5 py-2.5 text-sm text-ink-muted/60 transition-colors hover:bg-black/[0.02]"
                        title={planoMin ? `Disponível no plano ${PLANO_LABEL[planoMin]}` : 'Plano superior'}
                      >
                        <Icon name={item.icon} />
                        <span className="flex-1">{dict.painel.nav.itens[item.key]}</span>
                        {planoMin && (
                          <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wide text-amber-700">
                            {PLANO_LABEL[planoMin]}
                          </span>
                        )}
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted/70">
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </Link>
                    );
                  }

                  return (
                    <div
                      key={item.href}
                      className="flex cursor-not-allowed items-center gap-3 border-l-[3px] border-transparent px-5 py-2.5 text-sm text-ink-muted/50"
                      title={dict.painel.shell.emBreve}
                    >
                      <Icon name={item.icon} />
                      <span className="flex-1">{dict.painel.nav.itens[item.key]}</span>
                      <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted">
                        {dict.painel.shell.emBreve}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 overflow-x-hidden p-4 sm:p-6 lg:p-8">
          {(() => {
            const curKey = moduloDaRota(pathname);
            const curDef = curKey ? moduloDef(curKey) : undefined;
            const curLocked = !!curDef && !curDef.core && !!curKey && !!entitled && !entitled.has(curKey);
            if (!curLocked) return children;
            const planoMin = planoMinimoParaModulo(curKey!, planosModulos);
            return (
              <UpgradeGate
                moduloKey={curKey!}
                label={curDef!.label}
                grupo={curDef!.grupo}
                planoMinLabel={planoMin ? PLANO_LABEL[planoMin] : null}
                vendavel={modCfg[curKey!]?.vendavel}
                precoAvulso={modCfg[curKey!]?.preco}
                email={profile?.email}
              />
            );
          })()}
        </main>
      </div>
    </div>
    </ToastProvider>
  );
}


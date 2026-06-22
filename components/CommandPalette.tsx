'use client';

// Command Palette (⌘K / Ctrl+K) do painel do proprietário.
// Dois superpoderes num só lugar, essencial com ~60 módulos:
//   1) NAVEGAR — pula para qualquer módulo (fonte única em components/painel/nav).
//      Respeita o entitlement por plano já resolvido pelo shell: módulos travados
//      aparecem com cadeado + selo do plano (e o gate da página cuida do resto).
//   2) BUSCAR — busca federada (debounced) em clientes, eventos, reservas,
//      propostas e documentos via /api/busca (server, RLS + filtro por dono).
// Teclado: ⌘K/Ctrl+K abre/fecha · ↑/↓ navega · Enter abre · Esc fecha.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/components/i18n/I18nProvider';
import { NAV, Icon, type IconName, type GroupKey } from '@/components/painel/nav';
import {
  moduloDaRota, moduloDef, planoMinimoParaModulo, PLANO_LABEL, type PlanoTier,
} from '@/lib/modulos';

type ModCfg = Record<string, { ativo: boolean; vendavel: boolean; preco: number }>;

type Props = {
  entitled: Set<string> | null;
  modCfg: ModCfg;
  planosModulos: Record<string, string[]>;
};

type NavRow = {
  kind: 'nav'; id: string; href: string; label: string;
  gkey: GroupKey; gLabel: string; icon: IconName;
  locked: boolean; planoMin: PlanoTier | null;
};
type RecRow = {
  kind: 'rec'; id: string; href: string; titulo: string; sub: string;
  group: string; icon: IconName;
};
type Row = NavRow | RecRow;

type FedItem = { id: string; titulo: string; sub: string; href: string };
type FedGroup = { key: string; items: FedItem[] };

// Metadados de exibição dos grupos federados (rótulo + ícone reaproveitado do NAV).
const FED_META: Record<string, { label: string; icon: IconName }> = {
  clientes: { label: 'Clientes', icon: 'contacts' },
  eventos: { label: 'Eventos', icon: 'calendar' },
  reservas: { label: 'Reservas', icon: 'ticket' },
  propostas: { label: 'Propostas', icon: 'proposal' },
  documentos: { label: 'Documentos', icon: 'doc' },
};

const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export default function CommandPalette({ entitled, modCfg, planosModulos }: Props) {
  const { dict } = useT();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [fed, setFed] = useState<FedGroup[] | null>(null);
  const [loadingFed, setLoadingFed] = useState(false);
  const [active, setActive] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ── Abrir/fechar global (⌘K / Ctrl+K) ────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Foco + reset ao abrir; trava o scroll do body enquanto aberto.
  useEffect(() => {
    if (!open) return;
    setQ('');
    setFed(null);
    setActive(0);
    const t = setTimeout(() => inputRef.current?.focus(), 20);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { clearTimeout(t); document.body.style.overflow = prev; };
  }, [open]);

  // ── Busca federada (debounce 220ms) ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) { setFed(null); setLoadingFed(false); return; }
    setLoadingFed(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/painel/busca?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const j = r.ok ? await r.json() : { grupos: [] };
        setFed(Array.isArray(j.grupos) ? j.grupos : []);
      } catch {
        if (!ctrl.signal.aborted) setFed([]);
      } finally {
        if (!ctrl.signal.aborted) setLoadingFed(false);
      }
    }, 220);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [q, open]);

  // ── Linhas de NAVEGAÇÃO (filtradas, respeitando módulos desligados/travados) ─
  const navRows = useMemo<NavRow[]>(() => {
    const term = norm(q.trim());
    const rows: NavRow[] = [];
    for (const grupo of NAV) {
      const gLabel = dict.painel.nav.grupos[grupo.gkey];
      for (const item of grupo.items) {
        const modKey = moduloDaRota(item.href);
        const def = modKey ? moduloDef(modKey) : undefined;
        // Módulo desligado globalmente pelo admin (núcleo nunca some) — esconde.
        if (def && !def.core && modKey && modCfg[modKey]?.ativo === false) continue;
        const locked = !!def && !def.core && !!modKey && !!entitled && !entitled.has(modKey);
        const label = dict.painel.nav.itens[item.key];
        if (term && !norm(`${label} ${gLabel}`).includes(term)) continue;
        rows.push({
          kind: 'nav', id: item.href, href: item.href, label,
          gkey: grupo.gkey, gLabel, icon: item.icon, locked,
          planoMin: locked && modKey ? planoMinimoParaModulo(modKey, planosModulos) : null,
        });
      }
    }
    return rows;
  }, [q, dict, entitled, modCfg, planosModulos]);

  // ── Linhas de REGISTROS (resultado federado) ─────────────────────────────
  const recRows = useMemo<RecRow[]>(() => {
    if (!fed) return [];
    const rows: RecRow[] = [];
    for (const g of fed) {
      const meta = FED_META[g.key];
      if (!meta) continue;
      for (const it of g.items) {
        rows.push({
          kind: 'rec', id: `${g.key}:${it.id}`, href: it.href,
          titulo: it.titulo, sub: it.sub, group: meta.label, icon: meta.icon,
        });
      }
    }
    return rows;
  }, [fed]);

  // Lista achatada para navegação por teclado (ordem = visual).
  const flat = useMemo<Row[]>(() => [...navRows, ...recRows], [navRows, recRows]);

  useEffect(() => { if (active >= flat.length) setActive(0); }, [flat.length, active]);

  // Mantém o item ativo visível.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = useCallback((href: string) => {
    setOpen(false);
    router.push(href);
  }, [router]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (flat.length ? (i + 1) % flat.length : 0)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); return; }
    if (e.key === 'Enter') { e.preventDefault(); const t = flat[active]; if (t) go(t.href); return; }
  };

  const term = q.trim();
  const showGrouped = !term; // sem busca: navegação agrupada por seção
  const nothing = term.length >= 2 && !loadingFed && flat.length === 0;

  // Renderiza uma linha de navegação (com índice global p/ teclado).
  const renderNav = (row: NavRow, idx: number) => (
    <button
      key={row.id}
      data-idx={idx}
      onMouseEnter={() => setActive(idx)}
      onClick={() => go(row.href)}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        idx === active ? 'bg-brand-50 text-brand' : 'text-ink-soft hover:bg-black/[0.03]'
      }`}
    >
      <span className={idx === active ? 'text-brand' : 'text-ink-muted'}><Icon name={row.icon} size={17} /></span>
      <span className="flex-1 truncate">{row.label}</span>
      {row.locked ? (
        <span className="flex items-center gap-1.5">
          {row.planoMin && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.56rem] font-bold uppercase tracking-wide text-amber-700">
              {PLANO_LABEL[row.planoMin]}
            </span>
          )}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-ink-muted/70">
            <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </span>
      ) : (
        <span className="text-[0.62rem] uppercase tracking-wide text-ink-muted/50">{row.gLabel}</span>
      )}
    </button>
  );

  return (
    <>
      {/* Gatilho no topbar — pseudo-campo de busca (sm+) e ícone (mobile) */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar ou ir para (atalho Ctrl+K)"
        className="mx-3 hidden h-[38px] flex-1 items-center gap-2 rounded-full border border-black/[0.08] bg-[#f7f7f8] px-3.5 text-sm text-ink-muted transition-colors hover:border-black/[0.16] hover:bg-black/[0.02] sm:flex md:max-w-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 truncate text-left">Buscar ou ir para…</span>
        <kbd className="hidden rounded border border-black/[0.1] bg-white px-1.5 py-0.5 font-sans text-[0.66rem] font-semibold text-ink-muted md:inline">⌘K</kbd>
      </button>
      <button
        onClick={() => setOpen(true)}
        aria-label="Buscar"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full text-ink-soft hover:bg-black/[0.04] sm:hidden"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[300] flex justify-center px-4" role="dialog" aria-modal="true" aria-label="Busca e navegação">
          <div onClick={() => setOpen(false)} className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" />
          <div className="relative mt-[10vh] flex max-h-[72vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-pop">
            {/* Campo de busca */}
            <div className="flex items-center gap-3 border-b border-black/[0.06] px-4">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-ink-muted">
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => { setQ(e.target.value); setActive(0); }}
                onKeyDown={onKeyDown}
                placeholder="Buscar clientes, eventos, reservas… ou ir para um módulo"
                aria-label="Buscar ou ir para"
                className="h-[52px] flex-1 bg-transparent text-[0.95rem] text-ink outline-none placeholder:text-ink-muted/70"
              />
              {loadingFed && (
                <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-brand/30 border-t-brand" />
              )}
              <kbd className="hidden shrink-0 rounded border border-black/[0.1] px-1.5 py-0.5 font-sans text-[0.64rem] font-semibold text-ink-muted sm:inline">Esc</kbd>
            </div>

            {/* Resultados */}
            <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-2">
              {showGrouped ? (
                NAV.map((grupo) => {
                  const rows = navRows.filter((r) => r.gkey === grupo.gkey);
                  if (!rows.length) return null;
                  return (
                    <div key={grupo.gkey} className="mb-1">
                      <div className="px-3 pb-1 pt-2 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-ink-muted/60">
                        {dict.painel.nav.grupos[grupo.gkey]}
                      </div>
                      {rows.map((r) => renderNav(r, navRows.indexOf(r)))}
                    </div>
                  );
                })
              ) : (
                <>
                  {navRows.length > 0 && (
                    <div className="mb-1">
                      <div className="px-3 pb-1 pt-2 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-ink-muted/60">Ir para</div>
                      {navRows.map((r, i) => renderNav(r, i))}
                    </div>
                  )}
                  {recRows.length > 0 && Object.keys(FED_META).map((gkey) => {
                    const rows = recRows.filter((r) => r.id.startsWith(`${gkey}:`));
                    if (!rows.length) return null;
                    return (
                      <div key={gkey} className="mb-1">
                        <div className="px-3 pb-1 pt-2 text-[0.64rem] font-bold uppercase tracking-[0.08em] text-ink-muted/60">{FED_META[gkey].label}</div>
                        {rows.map((r) => {
                          const idx = navRows.length + recRows.indexOf(r);
                          return (
                            <button
                              key={r.id}
                              data-idx={idx}
                              onMouseEnter={() => setActive(idx)}
                              onClick={() => go(r.href)}
                              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                                idx === active ? 'bg-brand-50 text-brand' : 'text-ink-soft hover:bg-black/[0.03]'
                              }`}
                            >
                              <span className={idx === active ? 'text-brand' : 'text-ink-muted'}><Icon name={r.icon} size={17} /></span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-medium text-ink">{r.titulo}</span>
                                {r.sub && <span className="block truncate text-xs text-ink-muted">{r.sub}</span>}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                  {term.length === 1 && (
                    <div className="px-3 py-6 text-center text-xs text-ink-muted">Digite ao menos 2 letras para buscar registros.</div>
                  )}
                  {nothing && (
                    <div className="px-3 py-8 text-center">
                      <p className="text-sm font-semibold text-ink">Nada encontrado para “{term}”.</p>
                      <p className="mt-0.5 text-xs text-ink-muted">Tente outro termo ou o nome de um módulo.</p>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Rodapé com dicas de teclado */}
            <div className="flex items-center gap-4 border-t border-black/[0.06] px-4 py-2 text-[0.68rem] text-ink-muted">
              <span className="flex items-center gap-1"><kbd className="rounded border border-black/[0.1] px-1 font-sans">↑</kbd><kbd className="rounded border border-black/[0.1] px-1 font-sans">↓</kbd> navegar</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-black/[0.1] px-1 font-sans">↵</kbd> abrir</span>
              <span className="flex items-center gap-1"><kbd className="rounded border border-black/[0.1] px-1 font-sans">esc</kbd> fechar</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

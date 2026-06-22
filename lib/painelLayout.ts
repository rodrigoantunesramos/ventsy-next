// Estado PURO do layout do dashboard da home (/painel) — quais widgets aparecem
// e em que ordem. Persistido por DISPOSITIVO no localStorage (como lib/prefs);
// sincronização cross-device fica para depois. Importado só por client comps.

export type WidgetId = 'seu-dia' | 'kpis' | 'acoes' | 'checklist' | 'resumo';

export type PainelLayout = {
  ordem: WidgetId[];
  ocultos: WidgetId[];
};

export const WIDGETS_META: { id: WidgetId; nome: string }[] = [
  { id: 'seu-dia', nome: 'Seu dia' },
  { id: 'kpis', nome: 'Indicadores' },
  { id: 'acoes', nome: 'Ações rápidas' },
  { id: 'checklist', nome: 'Complete seu perfil' },
  { id: 'resumo', nome: 'Resumo da propriedade' },
];

export const ORDEM_PADRAO: WidgetId[] = WIDGETS_META.map((w) => w.id);
const IDS = new Set<WidgetId>(ORDEM_PADRAO);

const KEY = 'ventsy_painel_layout';

/**
 * Saneia um layout salvo: descarta ids desconhecidos e ANEXA ao fim quaisquer
 * widgets novos que ainda não estavam no layout salvo (assim adicionar um widget
 * no código nunca o esconde de quem já personalizou). Ordem sempre completa.
 */
export function sanearLayout(p: Partial<PainelLayout> | null | undefined): PainelLayout {
  const ordem = (Array.isArray(p?.ordem) ? p!.ordem : []).filter((x): x is WidgetId => IDS.has(x as WidgetId));
  for (const id of ORDEM_PADRAO) if (!ordem.includes(id)) ordem.push(id);
  const ocultos = (Array.isArray(p?.ocultos) ? p!.ocultos : []).filter((x): x is WidgetId => IDS.has(x as WidgetId));
  return { ordem, ocultos };
}

export function loadLayout(): PainelLayout {
  if (typeof window === 'undefined') return { ordem: [...ORDEM_PADRAO], ocultos: [] };
  try {
    const raw = window.localStorage.getItem(KEY);
    return sanearLayout(raw ? (JSON.parse(raw) as Partial<PainelLayout>) : null);
  } catch {
    return { ordem: [...ORDEM_PADRAO], ocultos: [] };
  }
}

export function saveLayout(l: PainelLayout): void {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* ignore */ }
}

/** Troca um widget de posição com o vizinho (dir -1 = sobe, +1 = desce). */
export function moverWidget(ordem: WidgetId[], id: WidgetId, dir: -1 | 1): WidgetId[] {
  const i = ordem.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ordem.length) return ordem;
  const next = ordem.slice();
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** Move `arrastado` para a posição de `alvo` (drag-and-drop). */
export function reordenar(ordem: WidgetId[], arrastado: WidgetId, alvo: WidgetId): WidgetId[] {
  if (arrastado === alvo) return ordem;
  const next = ordem.filter((x) => x !== arrastado);
  const idx = next.indexOf(alvo);
  if (idx < 0) return ordem;
  next.splice(idx, 0, arrastado);
  return next;
}

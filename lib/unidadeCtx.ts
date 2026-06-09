// Contexto de UNIDADE ativa do painel (troca de contexto multi-unidades).
// ─────────────────────────────────────────────────────────────────────────────
// Mantém qual unidade (propriedade) está "em foco": `null` = todas as unidades.
// Espelha o padrão de lib/prefs.ts — holder em memória + espelho no localStorage
// + evento de janela — para que QUALQUER página do painel possa, opcionalmente,
// honrar a escolha feita no seletor de /painel/unidades sem prop-drilling.
//
// Uso típico numa página:
//   import { getUnidadeCtx, onUnidadeCtx } from '@/lib/unidadeCtx'
//   const [pid, setPid] = useState(getUnidadeCtx());
//   useEffect(() => onUnidadeCtx(setPid), []);     // reage à troca
//   // ...filtra queries por `pid` quando != null (senão, todas).
//
// Importado apenas por componentes client.

const STORAGE_KEY = 'ventsy_unidade_ctx'
const EVENT = 'ventsy:unidade'

// `null` = todas as unidades; número = id da propriedade em foco.
let _ctx: number | null = null

// Hidratação no import (client) — antes do primeiro paint já usa o salvo.
if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw != null && raw !== '' && raw !== 'null') {
      const n = Number(raw)
      _ctx = Number.isFinite(n) ? n : null
    }
  } catch {
    /* localStorage indisponível — segue em "todas" */
  }
}

/** Lê a unidade em foco (null = todas as unidades). */
export function getUnidadeCtx(): number | null {
  return _ctx
}

/**
 * Define a unidade em foco e propaga: atualiza o holder, persiste no localStorage
 * e dispara o evento para componentes que queiram reagir na hora. Passe `null`
 * para voltar a "todas as unidades".
 */
export function setUnidadeCtx(propriedadeId: number | null): void {
  _ctx = propriedadeId ?? null
  if (typeof window !== 'undefined') {
    try {
      if (_ctx == null) window.localStorage.removeItem(STORAGE_KEY)
      else window.localStorage.setItem(STORAGE_KEY, String(_ctx))
      window.dispatchEvent(new CustomEvent<number | null>(EVENT, { detail: _ctx }))
    } catch {
      /* ignore */
    }
  }
}

/**
 * Assina mudanças do contexto de unidade. Retorna uma função de cleanup.
 * Reage tanto ao evento da mesma aba quanto ao `storage` de outras abas.
 */
export function onUnidadeCtx(cb: (propriedadeId: number | null) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: Event) => cb((e as CustomEvent<number | null>).detail ?? null)
  const storage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    const n = e.newValue == null ? NaN : Number(e.newValue)
    _ctx = Number.isFinite(n) ? n : null
    cb(_ctx)
  }
  window.addEventListener(EVENT, handler as EventListener)
  window.addEventListener('storage', storage)
  return () => {
    window.removeEventListener(EVENT, handler as EventListener)
    window.removeEventListener('storage', storage)
  }
}

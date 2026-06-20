import { useEffect, type RefObject } from 'react'

// Acessibilidade de diálogo: ao ativar, move o foco para dentro do container,
// prende o Tab dentro dele e devolve o foco ao elemento anterior ao desativar.
// O Escape fica a cargo de quem usa (cada modal já trata o seu fechamento) para
// não duplicar/concorrer com handlers existentes.
export function useFocusTrap(ref: RefObject<HTMLElement>, active: boolean) {
  useEffect(() => {
    if (!active) return
    const prev = document.activeElement as HTMLElement | null
    const focaveis = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button, [href], input:not([type="hidden"]), select, textarea, video, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)

    focaveis()[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const f = focaveis()
      if (!f.length) return
      const first = f[0]
      const last = f[f.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      prev?.focus?.()
    }
  }, [ref, active])
}

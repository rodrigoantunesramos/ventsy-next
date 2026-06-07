'use client';

import { useEffect } from 'react';

// Aviso de alterações não salvas. O App Router não expõe eventos de rota, então:
//  • `beforeunload` cobre reload / fechar a aba;
//  • intercepta cliques em <a href> na fase de captura e pede confirmação antes
//    de deixar a navegação do Next Link prosseguir.
export function useUnsavedChanges(isDirty: boolean): void {
  useEffect(() => {
    if (!isDirty) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const onClickCapture = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || a.target === '_blank') return;
      const dest = new URL(a.href, window.location.href);
      if (dest.pathname === window.location.pathname) return;
      if (!window.confirm('Você tem alterações não salvas. Deseja sair mesmo assim?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    document.addEventListener('click', onClickCapture, true);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      document.removeEventListener('click', onClickCapture, true);
    };
  }, [isDirty]);
}

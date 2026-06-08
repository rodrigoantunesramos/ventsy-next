// Ícones SVG inline do módulo Bilheteria (sem libs novas — padrão do projeto).
import type { ReactNode } from 'react';

function S({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IcoTicket = ({ size }: { size?: number }) => <S size={size}><path d="M4 7h16a1 1 0 0 1 1 1v2a2 2 0 0 0 0 4v2a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-2a2 2 0 0 0 0-4V8a1 1 0 0 1 1-1Z" /><path d="M15 7v12" strokeDasharray="2 2" /></S>;
export const IcoMoney = ({ size }: { size?: number }) => <S size={size}><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10a2 2 0 0 1 2-1.5h1a1.5 1.5 0 0 1 0 3h-1a1.5 1.5 0 0 0 0 3h1a2 2 0 0 0 2-1.5" /></S>;
export const IcoUsers = ({ size }: { size?: number }) => <S size={size}><circle cx="9" cy="8" r="3" /><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.8M18 19a5.5 5.5 0 0 0-3-4.9" /></S>;
export const IcoChart = ({ size }: { size?: number }) => <S size={size}><path d="M4 19V5M4 19h16M8 16v-4M12 16V8M16 16v-6" /></S>;
export const IcoCheck = ({ size }: { size?: number }) => <S size={size}><path d="M20 6 9 17l-5-5" /></S>;
export const IcoX = ({ size }: { size?: number }) => <S size={size}><path d="M18 6 6 18M6 6l12 12" /></S>;
export const IcoAlert = ({ size }: { size?: number }) => <S size={size}><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /></S>;
export const IcoSearch = ({ size }: { size?: number }) => <S size={size}><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></S>;
export const IcoDownload = ({ size }: { size?: number }) => <S size={size}><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" /></S>;
export const IcoPrint = ({ size }: { size?: number }) => <S size={size}><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v5a1 1 0 0 1-1 1h-2M6 14h12v7H6z" /></S>;
export const IcoLink = ({ size }: { size?: number }) => <S size={size}><path d="M9 15 15 9M10 6l1-1a4 4 0 0 1 6 6l-1 1M14 18l-1 1a4 4 0 0 1-6-6l1-1" /></S>;
export const IcoTag = ({ size }: { size?: number }) => <S size={size}><path d="M3 11.5 11 3.5a2 2 0 0 1 1.4-.6H19a2 2 0 0 1 2 2v6.6a2 2 0 0 1-.6 1.4l-8 8a2 2 0 0 1-2.8 0l-6.6-6.6a2 2 0 0 1 0-2.8Z" /><circle cx="16.5" cy="7.5" r="1.2" /></S>;
export const IcoCam = ({ size }: { size?: number }) => <S size={size}><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /><circle cx="12" cy="12.5" r="3.2" /></S>;
export const IcoCog = ({ size }: { size?: number }) => <S size={size}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15H4.5a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-2.7l-.1-.1A2 2 0 1 1 8.8 5.4l.1.1A1.6 1.6 0 0 0 11 4.6V4.5a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 19.4 11h.1a2 2 0 1 1 0 4Z" /></S>;
export const IcoPlus = ({ size }: { size?: number }) => <S size={size}><path d="M12 5v14M5 12h14" /></S>;
export const IcoTrash = ({ size }: { size?: number }) => <S size={size}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></S>;
export const IcoEdit = ({ size }: { size?: number }) => <S size={size}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></S>;
export const IcoGift = ({ size }: { size?: number }) => <S size={size}><path d="M20 12v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-8M2 8h20v4H2zM12 8v13M12 8S10.5 4 8 4a2 2 0 0 0 0 4M12 8s1.5-4 4-4a2 2 0 0 1 0 4" /></S>;
export const IcoCopy = ({ size }: { size?: number }) => <S size={size}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h8" /></S>;
export const IcoEye = ({ size }: { size?: number }) => <S size={size}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></S>;
export const IcoWallet = ({ size }: { size?: number }) => <S size={size}><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2H4a1 1 0 0 0-1 1Z" /><path d="M3 8v9a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M21 11v4h-4a2 2 0 0 1 0-4Z" /></S>;

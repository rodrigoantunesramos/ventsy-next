'use client';

// Renderizador de QR Code em SVG (puro, sem libs externas). Usa o encoder
// dependency-free lib/qrcode.ts. `value` é a string já embutida no QR
// (use gerarQrPayload(token) de lib/acesso). Crisp em qualquer tamanho.

import { useMemo } from 'react';
import { qrMatrix, withQuietZone, modulesToSvgPath } from '@/lib/qrcode';

export function QrCode({
  value, size = 160, quiet = 4, className, title = 'QR da credencial',
}: { value: string; size?: number; quiet?: number; className?: string; title?: string }) {
  const r = useMemo(() => {
    try {
      const qr = qrMatrix(value, { ecLevel: 'M' });
      const mods = withQuietZone(qr, quiet);
      return { path: modulesToSvgPath(mods), dim: mods.length };
    } catch {
      return { path: '', dim: 0 };
    }
  }, [value, quiet]);

  if (!r.dim) {
    return (
      <div
        className={`flex items-center justify-center bg-black/[0.03] text-[0.6rem] text-ink-muted ${className || ''}`}
        style={{ width: size, height: size }}
      >
        sem QR
      </div>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${r.dim} ${r.dim}`}
      shapeRendering="crispEdges"
      role="img"
      aria-label={title}
      className={className}
    >
      <rect width={r.dim} height={r.dim} fill="#fff" />
      <path d={r.path} fill="#000" />
    </svg>
  );
}

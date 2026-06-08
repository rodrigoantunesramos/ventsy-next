'use client';

// Renderizador SVG da planta — usado em 3 lugares (miniatura na Biblioteca,
// canvas do Editor com arraste, e prévia do Mapa de mesas com ocupação). É
// "burro": desenha o que recebe e emite eventos; toda a regra (capacidade,
// ocupação) vem da engine lib/layouts. SVG puro, sem libs de chart.

import { useRef, type PointerEvent as RPointerEvent } from 'react';
import { type Elemento, type Planta, elementoMeta, isAssento } from '@/lib/layouts';

export type OcupacaoMap = Record<string, { ocupados: number; lugares: number; excedido: boolean }>;

type Props = {
  planta: Planta;
  plantaUrl?: string | null;
  selectedId?: string | null;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, x: number, y: number) => void;   // habilita arraste se presente
  ocupacao?: OcupacaoMap;                                 // colore mesas por ocupação (mapa de mesas)
  thumbnail?: boolean;                                    // sem assentos/labels detalhados (miniatura)
  className?: string;
};

// Posições dos assentos ao redor de uma mesa (coords locais ao elemento).
function assentosCirculo(w: number, h: number, n: number): { x: number; y: number }[] {
  const cx = w / 2, cy = h / 2, rx = w / 2 + 9, ry = h / 2 + 9;
  return Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}
function assentosRetangulo(w: number, h: number, n: number): { x: number; y: number }[] {
  // distribui ao longo das duas bordas longas (topo/baixo)
  const out: { x: number; y: number }[] = [];
  const porLado = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) {
    const lado = i < porLado ? 0 : 1;
    const idx = lado === 0 ? i : i - porLado;
    const tot = lado === 0 ? Math.min(porLado, n) : n - porLado;
    const fx = tot > 1 ? idx / (tot - 1) : 0.5;
    out.push({ x: 12 + fx * (w - 24), y: lado === 0 ? -9 : h + 9 });
  }
  return out;
}

export default function PlantaCanvas({
  planta, plantaUrl, selectedId, onSelect, onMove, ocupacao, thumbnail, className = '',
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const editable = !!onMove;

  // Converte coords de tela → coords lógicas do canvas.
  function toLogical(clientX: number, clientY: number) {
    const r = svgRef.current?.getBoundingClientRect();
    if (!r || r.width === 0) return { x: 0, y: 0 };
    return { x: ((clientX - r.left) / r.width) * planta.largura, y: ((clientY - r.top) / r.height) * planta.altura };
  }

  function onPointerDownEl(e: RPointerEvent, el: Elemento) {
    if (!editable) { onSelect?.(el.id); return; }
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toLogical(e.clientX, e.clientY);
    drag.current = { id: el.id, dx: p.x - el.x, dy: p.y - el.y };
    onSelect?.(el.id);
  }
  function onPointerMove(e: RPointerEvent) {
    if (!drag.current || !editable) return;
    const el = planta.itens.find((i) => i.id === drag.current!.id);
    if (!el) return;
    const p = toLogical(e.clientX, e.clientY);
    const x = Math.max(0, Math.min(planta.largura - el.w, p.x - drag.current.dx));
    const y = Math.max(0, Math.min(planta.altura - el.h, p.y - drag.current.dy));
    onMove!(el.id, x, y);
  }
  function endDrag() { drag.current = null; }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${planta.largura} ${planta.altura}`}
      className={`w-full select-none ${className}`}
      style={{ aspectRatio: `${planta.largura} / ${planta.altura}`, touchAction: editable ? 'none' : undefined }}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      onPointerDown={() => { if (editable) onSelect?.(null); }}
    >
      {/* fundo */}
      <rect x={0} y={0} width={planta.largura} height={planta.altura} fill="#f8fafc" stroke="#e5e7eb" strokeWidth={2} rx={8} />
      {plantaUrl && <image href={plantaUrl} x={0} y={0} width={planta.largura} height={planta.altura} preserveAspectRatio="xMidYMid meet" opacity={0.5} />}
      {/* grade leve (só no editor) */}
      {editable && !thumbnail && (
        <g stroke="#e5e7eb" strokeWidth={1} opacity={0.6}>
          {Array.from({ length: Math.floor(planta.largura / 50) }, (_, i) => <line key={`v${i}`} x1={(i + 1) * 50} y1={0} x2={(i + 1) * 50} y2={planta.altura} />)}
          {Array.from({ length: Math.floor(planta.altura / 50) }, (_, i) => <line key={`h${i}`} x1={0} y1={(i + 1) * 50} x2={planta.largura} y2={(i + 1) * 50} />)}
        </g>
      )}

      {planta.itens.map((el) => (
        <ElementoView
          key={el.id} el={el} thumbnail={thumbnail}
          selected={el.id === selectedId} editable={editable}
          ocup={ocupacao?.[el.id]}
          onPointerDown={(e) => onPointerDownEl(e, el)}
        />
      ))}
    </svg>
  );
}

function ElementoView({
  el, selected, editable, thumbnail, ocup, onPointerDown,
}: {
  el: Elemento; selected: boolean; editable: boolean; thumbnail?: boolean;
  ocup?: { ocupados: number; lugares: number; excedido: boolean };
  onPointerDown: (e: RPointerEvent) => void;
}) {
  const meta = elementoMeta(el.tipo);
  // Cor da mesa varia com a ocupação quando há mapa de mesas.
  let fill = `${meta.cor}22`, stroke = meta.cor;
  if (ocup) {
    if (ocup.excedido) { fill = '#fee2e2'; stroke = '#ef4444'; }
    else if (ocup.lugares > 0 && ocup.ocupados >= ocup.lugares) { fill = '#dcfce7'; stroke = '#22c55e'; }
    else if (ocup.ocupados > 0) { fill = '#fef9c3'; stroke = '#eab308'; }
  }
  const seats = !thumbnail && isAssento(el) && el.lugares > 0
    ? (meta.forma === 'circulo' ? assentosCirculo(el.w, el.h, el.lugares) : assentosRetangulo(el.w, el.h, el.lugares))
    : [];

  return (
    <g
      transform={`translate(${el.x} ${el.y}) rotate(${el.rotacao} ${el.w / 2} ${el.h / 2})`}
      onPointerDown={onPointerDown}
      style={{ cursor: editable ? 'move' : 'pointer' }}
    >
      {/* assentos */}
      {seats.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={6} fill="#fff" stroke={stroke} strokeWidth={1.5} />)}
      {/* corpo */}
      {meta.forma === 'circulo'
        ? <ellipse cx={el.w / 2} cy={el.h / 2} rx={el.w / 2} ry={el.h / 2} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />
        : <rect x={0} y={0} width={el.w} height={el.h} rx={8} fill={fill} stroke={stroke} strokeWidth={selected ? 3 : 2} />}
      {/* rótulo */}
      {!thumbnail && (
        <text x={el.w / 2} y={el.h / 2} textAnchor="middle" dominantBaseline="central"
          fontSize={Math.max(11, Math.min(16, el.h / 4))} fontWeight={600} fill="#0d0d0d" style={{ pointerEvents: 'none' }}>
          {el.rotulo}{ocup ? ` ${ocup.ocupados}/${ocup.lugares}` : (isAssento(el) && el.lugares ? ` · ${el.lugares}` : '')}
        </text>
      )}
      {/* anel de seleção */}
      {selected && <rect x={-4} y={-4} width={el.w + 8} height={el.h + 8} rx={10} fill="none" stroke="#ff385c" strokeWidth={2} strokeDasharray="6 4" />}
    </g>
  );
}

'use client';

// Timeline por espaço (estilo Gantt) — eixo Y = sub-espaços, eixo X = dias do
// mês. Cada barra é uma reserva/hold/bloqueio posicionada por dia, colorida por
// status (lib/reservas.statusMeta). Permite enxergar simultaneidade entre
// espaços e conflitos dentro de um mesmo espaço. Clicar numa barra edita;
// clicar num dia vazio cria naquele espaço/dia.

import { useMemo } from 'react';
import { toRange, statusMeta, ESPACO_TIPO_LABEL, DIA, type Reserva, type Espaco } from '@/lib/reservas';

type Row = { espaco: Espaco | null; key: string; nome: string; sub: string };

function ymd(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function Timeline({
  espacos, reservas, year, month, onSlotClick, onBarClick,
}: {
  espacos: Espaco[];
  reservas: Reserva[];
  year: number;
  month: number;
  onSlotClick: (espacoId: number | null, dateStr: string) => void;
  onBarClick: (r: Reserva) => void;
}) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthStart = new Date(year, month, 1).getTime();
  const monthEnd = new Date(year, month + 1, 1).getTime();
  const todayStr = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  // Linhas: "Espaço inteiro" (espaco_id null) + cada sub-espaço ativo.
  const rows: Row[] = useMemo(() => {
    const subs = [...espacos].filter((e) => e.ativo).sort((a, b) => a.ordem - b.ordem)
      .map((e) => ({ espaco: e, key: `e${e.id}`, nome: e.nome, sub: ESPACO_TIPO_LABEL[e.tipo] }));
    return [{ espaco: null, key: 'inteiro', nome: 'Espaço inteiro', sub: 'propriedade toda' }, ...subs];
  }, [espacos]);

  // Agrupa reservas por linha (whole-property → "inteiro"; demais por espaco_id).
  const porLinha = useMemo(() => {
    const map = new Map<string, Reserva[]>();
    rows.forEach((r) => map.set(r.key, []));
    for (const r of reservas) {
      if (r.status === 'cancelada' || r.status === 'recusada') continue;
      const range = toRange(r);
      if (!range || range.end <= monthStart || range.start >= monthEnd) continue;
      const key = r.espaco_id == null ? 'inteiro' : `e${r.espaco_id}`;
      if (!map.has(key)) continue; // espaço de outra propriedade/inativo
      map.get(key)!.push(r);
    }
    return map;
  }, [rows, reservas, monthStart, monthEnd]);

  function geometria(r: Reserva): { left: number; width: number } | null {
    const range = toRange(r);
    if (!range) return null;
    const start = Math.max(range.start, monthStart);
    const end = Math.min(range.end, monthEnd);
    if (end <= start) return null;
    const startDay = Math.floor((start - monthStart) / DIA);            // 0-based
    const spanDays = Math.max(1, Math.ceil((end - start) / DIA));
    return { left: (startDay / daysInMonth) * 100, width: (Math.min(spanDays, daysInMonth - startDay) / daysInMonth) * 100 };
  }

  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[680px]">
        {/* Cabeçalho de dias */}
        <div className="flex border-b border-black/[0.06]">
          <div className="w-36 shrink-0 px-2 py-2 text-[0.68rem] font-bold uppercase tracking-wide text-ink-muted/70">Espaço</div>
          <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
            {dayNums.map((d) => {
              const wd = new Date(year, month, d).getDay();
              const isToday = ymd(year, month, d) === todayStr;
              return (
                <div key={d} className={`py-1 text-center text-[0.6rem] font-semibold ${wd === 0 || wd === 6 ? 'text-ink-muted/50' : 'text-ink-muted'} ${isToday ? 'text-brand' : ''}`}>
                  {d}
                </div>
              );
            })}
          </div>
        </div>

        {/* Linhas por espaço */}
        {rows.map((row) => {
          const list = porLinha.get(row.key) || [];
          return (
            <div key={row.key} className="flex border-b border-black/[0.04] last:border-0">
              <div className="flex w-36 shrink-0 flex-col justify-center px-2 py-2">
                <span className="truncate text-xs font-bold text-ink-soft">{row.nome}</span>
                <span className="truncate text-[0.62rem] text-ink-muted">{row.sub}</span>
              </div>

              <div className="relative flex-1" style={{ minHeight: 46 }}>
                {/* camada de clique por dia */}
                <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${daysInMonth}, minmax(0, 1fr))` }}>
                  {dayNums.map((d) => {
                    const wd = new Date(year, month, d).getDay();
                    const ds = ymd(year, month, d);
                    return (
                      <button
                        key={d}
                        onClick={() => onSlotClick(row.espaco?.id ?? null, ds)}
                        title={`Novo em ${row.nome} · dia ${d}`}
                        className={`border-l border-black/[0.04] transition hover:bg-brand/5 ${wd === 0 || wd === 6 ? 'bg-black/[0.015]' : ''}`}
                      />
                    );
                  })}
                </div>

                {/* camada de barras */}
                <div className="pointer-events-none absolute inset-0">
                  {list.map((r, i) => {
                    const g = geometria(r);
                    if (!g) return null;
                    const meta = statusMeta(r.status);
                    const top = 4 + (i % 2) * 20; // empilha levemente p/ reduzir colisão visual
                    return (
                      <button
                        key={r.id}
                        onClick={(e) => { e.stopPropagation(); onBarClick(r); }}
                        title={`${meta.label}${r.titulo ? ' · ' + r.titulo : ''}`}
                        style={{ left: `${g.left}%`, width: `calc(${g.width}% - 2px)`, top }}
                        className={`pointer-events-auto absolute flex h-[18px] items-center overflow-hidden rounded-md border px-1.5 text-[0.6rem] font-bold text-white shadow-sm transition hover:brightness-105 ${meta.bar}`}
                      >
                        <span className="truncate drop-shadow-sm">{r.titulo || meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

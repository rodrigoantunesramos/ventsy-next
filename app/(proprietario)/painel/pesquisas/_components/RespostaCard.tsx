'use client';

// Card de uma resposta de pesquisa (/painel/pesquisas, aba Respostas).
// Mostra autor, categoria NPS, evento/propriedade, comentário e (expansível) todas
// as respostas. AÇÃO: detrator → abrir tratativa (Feedbacks); promotor → convidar
// para avaliar publicamente. Sem "R$" (lib/format).

import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import { type RespostaPesquisa, type Pergunta } from '@/lib/pesquisas';
import { CategoriaChip, IcoChevron, IcoTrash, IcoThumbUp, IcoAlert, IcoLink } from './ui';

export type RespostaCallbacks = {
  onAbrirTratativa: (r: RespostaPesquisa) => void;
  onConvidarAvaliacao: (r: RespostaPesquisa) => void;
  onDelete: (r: RespostaPesquisa) => void;
};

function valorLabel(q: Pergunta, v: unknown): string {
  if (v == null || v === '') return '—';
  if (q.tipo === 'nps') return `${v}/10`;
  if (q.tipo === 'csat' || q.tipo === 'escala') return `${v}/5 ★`;
  return String(v);
}

export function RespostaCard({
  r, perguntas, pesquisaTitulo, propNome, eventoNome, podeTratativa, podeAvaliar, cb,
}: {
  r: RespostaPesquisa;
  perguntas: Pergunta[];                 // modelo da pesquisa respondida (p/ rotular respostas)
  pesquisaTitulo: string;
  propNome: string;
  eventoNome: string;
  podeTratativa: boolean;                // detrator + módulo Feedbacks disponível
  podeAvaliar: boolean;                  // promotor + propriedade pública conhecida
  cb: RespostaCallbacks;
}) {
  const [open, setOpen] = useState(false);
  const respondidas = useMemo(
    () => perguntas.filter((q) => { const v = r.respostas?.[q.id]; return v != null && v !== ''; }),
    [perguntas, r.respostas],
  );

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-ink">{r.autor_nome || 'Anônimo'}</span>
            <CategoriaChip categoria={r.categoria} nps={r.nps} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
            {r.criado_em && <span>{formatDate(r.criado_em, { style: 'medium' })}</span>}
            {eventoNome && <span>· {eventoNome}</span>}
            {propNome && <span>· {propNome}</span>}
            {pesquisaTitulo && <span className="rounded bg-black/[0.05] px-1.5 py-0.5">{pesquisaTitulo}</span>}
          </div>
        </div>
        <button onClick={() => cb.onDelete(r)} className="shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="Excluir resposta"><IcoTrash /></button>
      </div>

      {r.comentario && (
        <p className="mt-2.5 rounded-xl bg-black/[0.02] px-3 py-2 text-sm leading-relaxed text-ink-soft">“{r.comentario}”</p>
      )}

      {respondidas.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-brand">
            {open ? 'Ocultar respostas' : `Ver ${respondidas.length} resposta(s)`} <IcoChevron open={open} />
          </button>
          {open && (
            <div className="mt-2 space-y-1.5 border-t border-black/[0.05] pt-2">
              {respondidas.map((q) => (
                <div key={q.id} className="flex items-start justify-between gap-3 text-sm">
                  <span className="min-w-0 flex-1 text-ink-muted">{q.titulo}</span>
                  <span className="shrink-0 font-medium text-ink-soft">{valorLabel(q, r.respostas[q.id])}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(podeTratativa || podeAvaliar) && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-black/[0.05] pt-3">
          {podeTratativa && (
            <button onClick={() => cb.onAbrirTratativa(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100">
              <IcoAlert /> Abrir tratativa
            </button>
          )}
          {podeAvaliar && (
            <button onClick={() => cb.onConvidarAvaliacao(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">
              <IcoThumbUp /> Convidar p/ avaliar
            </button>
          )}
          {r.autor_contato && (
            <span className="inline-flex items-center gap-1 text-xs text-ink-muted"><IcoLink /> {r.autor_contato}</span>
          )}
        </div>
      )}
    </div>
  );
}

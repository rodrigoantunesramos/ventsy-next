'use client';

// Construtor de pesquisas (/painel/pesquisas) — criar/editar uma pesquisa:
// título, tipo, gatilho de disparo, e o editor de perguntas (NPS · CSAT · escala ·
// múltipla · texto) com reordenação, modelos prontos, geração por IA (Pro+) e
// prévia. Sem "R$" (lib/format). Fecha com Esc e clique no backdrop.

import { useEffect, useMemo, useState } from 'react';
import {
  type Pesquisa, type Pergunta, type TipoPergunta, type TipoPesquisa, type Gatilho,
  TIPOS_PESQUISA, TIPOS_PERGUNTA, GATILHOS, TIPO_PERGUNTA_BY,
  templatePerguntas, novaPergunta, tituloPesquisaPadrao, validarPesquisa, GATILHO_PADRAO_DIAS,
} from '@/lib/pesquisas';
import { IcoPlus, IcoTrash, IcoSparkles, IcoChevron } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const lbl = 'mb-1.5 block text-sm font-semibold text-ink-soft';

function uid(): string {
  try { if (typeof crypto !== 'undefined' && crypto.randomUUID) return 'q_' + crypto.randomUUID().slice(0, 8); } catch { /* fallback */ }
  return 'q_' + Math.random().toString(36).slice(2, 10);
}

export type SavePayload = {
  id?: string;
  titulo: string; descricao: string | null; tipo: TipoPesquisa;
  perguntas: Pergunta[]; gatilho: Gatilho; dias_apos: number | null; ativo: boolean;
};

export function PesquisaBuilder({
  pesquisa, isPro, onClose, onSave, onGerarPerguntasIA,
}: {
  pesquisa: Pesquisa | null;
  isPro: boolean;
  onClose: () => void;
  onSave: (p: SavePayload) => Promise<boolean>;
  onGerarPerguntasIA: (objetivo: string, tipo: TipoPesquisa) => Promise<Omit<Pergunta, 'id'>[] | null>;
}) {
  const editar = !!pesquisa;
  const [titulo, setTitulo] = useState(pesquisa?.titulo || tituloPesquisaPadrao('nps'));
  const [descricao, setDescricao] = useState(pesquisa?.descricao || '');
  const [tipo, setTipo] = useState<TipoPesquisa>(pesquisa?.tipo || 'nps');
  const [gatilho, setGatilho] = useState<Gatilho>(pesquisa?.gatilho || 'manual');
  const [diasApos, setDiasApos] = useState<number>(pesquisa?.dias_apos || GATILHO_PADRAO_DIAS);
  const [ativo, setAtivo] = useState(pesquisa?.ativo ?? true);
  const [perguntas, setPerguntas] = useState<Pergunta[]>(
    pesquisa?.perguntas?.length ? pesquisa.perguntas : templatePerguntas('nps'),
  );
  const [erro, setErro] = useState('');
  const [busy, setBusy] = useState(false);
  const [previa, setPrevia] = useState(false);

  // IA
  const [iaObjetivo, setIaObjetivo] = useState('');
  const [iaBusy, setIaBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  function trocarTipo(t: TipoPesquisa) {
    setTipo(t);
    if (!editar && titulo === tituloPesquisaPadrao(tipo)) setTitulo(tituloPesquisaPadrao(t));
  }
  function carregarModelo() {
    setPerguntas(templatePerguntas(tipo));
    setErro('');
  }

  // ── Perguntas ──
  const upd = (id: string, patch: Partial<Pergunta>) => setPerguntas((arr) => arr.map((q) => (q.id === id ? { ...q, ...patch } : q)));
  const add = (t: TipoPergunta) => setPerguntas((arr) => [...arr, novaPergunta(t, uid())]);
  const remove = (id: string) => setPerguntas((arr) => arr.filter((q) => q.id !== id));
  const mover = (id: string, dir: -1 | 1) => setPerguntas((arr) => {
    const i = arr.findIndex((q) => q.id === id); const j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return arr;
    const c = [...arr]; [c[i], c[j]] = [c[j], c[i]]; return c;
  });

  async function gerarIA() {
    setIaBusy(true); setErro('');
    const out = await onGerarPerguntasIA(iaObjetivo, tipo);
    setIaBusy(false);
    if (out && out.length) setPerguntas(out.map((q) => ({ ...q, id: uid() })));
  }

  async function salvar() {
    const v = validarPesquisa({ titulo, perguntas, gatilho, dias_apos: diasApos });
    if (v) { setErro(v); return; }
    setBusy(true);
    const ok = await onSave({
      id: pesquisa?.id, titulo: titulo.trim(), descricao: descricao.trim() || null, tipo,
      perguntas, gatilho, dias_apos: gatilho === 'dias_apos' ? diasApos : null, ativo,
    });
    setBusy(false);
    if (ok) onClose();
  }

  const npsCount = useMemo(() => perguntas.filter((q) => q.tipo === 'nps').length, [perguntas]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-5 shadow-pop sm:rounded-3xl sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{editar ? 'Editar pesquisa' : 'Nova pesquisa'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-black/[0.04] hover:text-ink">✕</button>
        </div>

        {/* Básico */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className={lbl}>Título *</span>
            <input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Pesquisa de recomendação (NPS)" />
          </label>
          <label className="block sm:col-span-2">
            <span className={lbl}>Descrição (opcional)</span>
            <input className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Aparece no topo do formulário público" />
          </label>
          <label className="block">
            <span className={lbl}>Tipo</span>
            <select className={inp} value={tipo} onChange={(e) => trocarTipo(e.target.value as TipoPesquisa)}>
              {TIPOS_PESQUISA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={carregarModelo} className="rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Carregar modelo {TIPOS_PESQUISA.find((t) => t.v === tipo)?.label}</button>
          </div>
        </div>

        {/* Disparo */}
        <div className="mt-3 rounded-2xl border border-black/[0.06] bg-black/[0.015] p-4">
          <span className={lbl}>Quando disparar</span>
          <div className="flex flex-wrap gap-2">
            {GATILHOS.map((g) => (
              <button
                key={g.v} onClick={() => setGatilho(g.v)}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition ${gatilho === g.v ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-black/10 hover:border-brand/30'}`}
                title={g.desc}
              >
                {g.label}
              </button>
            ))}
            {gatilho === 'dias_apos' && (
              <label className="inline-flex items-center gap-2 text-sm text-ink-soft">
                <input type="number" min={1} max={90} value={diasApos} onChange={(e) => setDiasApos(Math.max(1, Number(e.target.value) || 1))} className="w-16 rounded-xl border border-black/10 px-2.5 py-2 text-sm focus:border-brand focus:outline-none" />
                dias após o evento
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-ink-muted">{GATILHOS.find((g) => g.v === gatilho)?.desc} {gatilho !== 'manual' && 'O envio automático é por e-mail (quando configurado) e via cron.'}</p>
        </div>

        {/* IA */}
        <div className="mt-3 rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50/50 to-white p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-bold text-ink"><IcoSparkles /> Gerar perguntas com IA</span>
            {!isPro && <span className="rounded-lg bg-gradient-to-r from-amber-500 to-brand px-2 py-0.5 text-[11px] font-semibold text-white">Pro+</span>}
          </div>
          {isPro ? (
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input className={`${inp} flex-1`} value={iaObjetivo} onChange={(e) => setIaObjetivo(e.target.value)} placeholder="Objetivo (ex.: medir NPS e descobrir o que melhorar no buffet)" />
              <button onClick={gerarIA} disabled={iaBusy} className="shrink-0 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{iaBusy ? 'Gerando…' : 'Gerar'}</button>
            </div>
          ) : (
            <p className="mt-1 text-xs text-ink-muted">Descreva o objetivo e a IA monta as perguntas (inclui NPS). Disponível no Pro+.</p>
          )}
        </div>

        {/* Perguntas */}
        <div className="mt-4 flex items-center justify-between">
          <h3 className="text-sm font-bold text-ink">Perguntas ({perguntas.length})</h3>
          <button onClick={() => setPrevia((p) => !p)} className="flex items-center gap-1 text-xs font-semibold text-ink-muted hover:text-brand">Prévia <IcoChevron open={previa} /></button>
        </div>

        {previa ? (
          <div className="mt-2 space-y-2 rounded-2xl border border-black/[0.06] bg-black/[0.015] p-4">
            {perguntas.map((q, i) => (
              <div key={q.id} className="text-sm text-ink-soft"><span className="text-ink-muted">{i + 1}.</span> {q.titulo} <span className="ml-1 rounded bg-black/[0.06] px-1.5 py-0.5 text-[11px] text-ink-muted">{TIPO_PERGUNTA_BY[q.tipo]?.label}</span></div>
            ))}
            {!perguntas.length && <p className="text-sm text-ink-muted">Sem perguntas.</p>}
          </div>
        ) : (
          <div className="mt-2 space-y-2">
            {perguntas.map((q, i) => (
              <PerguntaEditor key={q.id} q={q} idx={i} total={perguntas.length} onUpd={upd} onRemove={remove} onMover={mover} />
            ))}
            {!perguntas.length && <p className="rounded-xl border border-dashed border-black/10 p-4 text-center text-sm text-ink-muted">Nenhuma pergunta. Adicione abaixo ou carregue um modelo.</p>}
          </div>
        )}

        {/* Add pergunta */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Adicionar:</span>
          {TIPOS_PERGUNTA.map((t) => (
            <button key={t.v} onClick={() => add(t.v)} className="inline-flex items-center gap-1 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs font-medium hover:border-brand/30 hover:text-brand" title={t.hint}>
              <IcoPlus /> {t.label}
            </button>
          ))}
        </div>

        {npsCount === 0 && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">Sem uma pergunta NPS (0–10), esta pesquisa não calcula o score. Adicione uma para acompanhar o NPS.</p>
        )}
        {erro && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p>}

        <div className="mt-5 flex items-center justify-between gap-2 border-t border-black/[0.06] pt-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 accent-brand" />
            Ativa (aceita respostas)
          </label>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            <button onClick={salvar} disabled={busy} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{busy ? 'Salvando…' : editar ? 'Salvar alterações' : 'Criar pesquisa'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Editor de uma pergunta ────────────────────────────────────────────────────
function PerguntaEditor({
  q, idx, total, onUpd, onRemove, onMover,
}: {
  q: Pergunta; idx: number; total: number;
  onUpd: (id: string, patch: Partial<Pergunta>) => void;
  onRemove: (id: string) => void;
  onMover: (id: string, dir: -1 | 1) => void;
}) {
  const setOpcao = (i: number, v: string) => onUpd(q.id, { opcoes: (q.opcoes || []).map((o, k) => (k === i ? v : o)) });
  const addOpcao = () => onUpd(q.id, { opcoes: [...(q.opcoes || []), `Opção ${(q.opcoes?.length || 0) + 1}`] });
  const delOpcao = (i: number) => onUpd(q.id, { opcoes: (q.opcoes || []).filter((_, k) => k !== i) });

  return (
    <div className="rounded-2xl border border-black/[0.08] bg-white p-3.5">
      <div className="flex items-start gap-2">
        <div className="flex flex-col">
          <button onClick={() => onMover(q.id, -1)} disabled={idx === 0} className="text-ink-muted hover:text-brand disabled:opacity-30" aria-label="Mover para cima">▲</button>
          <button onClick={() => onMover(q.id, 1)} disabled={idx === total - 1} className="text-ink-muted hover:text-brand disabled:opacity-30" aria-label="Mover para baixo">▼</button>
        </div>
        <div className="min-w-0 flex-1">
          <input className={inp} value={q.titulo} onChange={(e) => onUpd(q.id, { titulo: e.target.value })} placeholder="Enunciado da pergunta" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <select className="rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-xs focus:border-brand focus:outline-none" value={q.tipo} onChange={(e) => onUpd(q.id, { tipo: e.target.value as TipoPergunta, opcoes: e.target.value === 'multipla' ? (q.opcoes?.length ? q.opcoes : ['Opção 1', 'Opção 2']) : undefined })}>
              {TIPOS_PERGUNTA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <label className="inline-flex items-center gap-1.5 text-xs text-ink-soft">
              <input type="checkbox" checked={!!q.obrigatoria} onChange={(e) => onUpd(q.id, { obrigatoria: e.target.checked })} className="h-3.5 w-3.5 accent-brand" />
              Obrigatória
            </label>
          </div>

          {q.tipo === 'multipla' && (
            <div className="mt-2 space-y-1.5">
              {(q.opcoes || []).map((op, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input className="flex-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" value={op} onChange={(e) => setOpcao(i, e.target.value)} placeholder={`Opção ${i + 1}`} />
                  <button onClick={() => delOpcao(i)} disabled={(q.opcoes?.length || 0) <= 2} className="text-ink-muted hover:text-red-600 disabled:opacity-30" aria-label="Remover opção"><IcoTrash /></button>
                </div>
              ))}
              <button onClick={addOpcao} className="text-xs font-semibold text-brand hover:underline">+ opção</button>
            </div>
          )}
        </div>
        <button onClick={() => onRemove(q.id)} className="shrink-0 rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600" aria-label="Remover pergunta"><IcoTrash /></button>
      </div>
    </div>
  );
}

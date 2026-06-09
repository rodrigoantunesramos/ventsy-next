'use client';

// Card de um feedback privado + TRATATIVA (/painel/feedbacks).
// Cabeçalho (autor, canal, status, nota), critérios, comentário/pontos, e um painel
// expansível de tratativa: plano de ação (responsável/prazo/status), resposta privada
// ao cliente (com sugestão de IA no Pro+ e atalhos WhatsApp/e-mail) e "promover a
// avaliação pública" quando o cliente autorizou e a nota é alta. Sem "R$" (lib/format).

import { useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import {
  type Feedback, type FeedbackAcao, type StatusFeedback, type StatusAcao,
  CRITERIOS, CANAL_BY, STATUS_FEEDBACK, STATUS_FB_BY, STATUS_ACAO, STATUS_ACAO_BY,
  podePromover, acaoAtrasada,
} from '@/lib/feedback';
import { Stars, IcoClock, IcoSparkles, IcoShare, IcoThumbUp, IcoPlus, IcoCheck } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const soDigitos = (s: string) => (s || '').replace(/\D/g, '');
function contatoLinks(contato: string | null, texto: string): { wa: string | null; mail: string | null } {
  if (!contato) return { wa: null, mail: null };
  const c = contato.trim();
  if (c.includes('@')) return { wa: null, mail: `mailto:${c}?body=${encodeURIComponent(texto)}` };
  const d = soDigitos(c);
  if (!d) return { wa: null, mail: null };
  return { wa: `https://wa.me/${d.length <= 11 ? '55' + d : d}?text=${encodeURIComponent(texto)}`, mail: null };
}

export type CardCallbacks = {
  onSetStatus: (f: Feedback, status: StatusFeedback) => void;
  onPromover: (f: Feedback) => Promise<void>;
  onSalvarResposta: (f: Feedback, texto: string) => Promise<boolean>;
  onSugerirResposta: (f: Feedback) => Promise<string | null>;
  onAddAcao: (feedbackId: string, a: { descricao: string; responsavel: string; prazo: string }) => Promise<boolean>;
  onSetAcaoStatus: (a: FeedbackAcao, status: StatusAcao) => void;
  onDelAcao: (a: FeedbackAcao) => void;
  onDelete: (f: Feedback) => void;
};

export function FeedbackCard({
  f, acoes, propNome, eventoNome, isPro, now, cb,
}: {
  f: Feedback; acoes: FeedbackAcao[]; propNome: string; eventoNome: string;
  isPro: boolean; now: Date; cb: CardCallbacks;
}) {
  const [open, setOpen] = useState(false);
  const st = STATUS_FB_BY[f.status];
  const canal = CANAL_BY[f.canal];
  const critPreenchidos = CRITERIOS.filter((c) => f.criterios?.[c.v]);
  const atrasadas = acoes.filter((a) => acaoAtrasada(a, now)).length;
  const dataLabel = f.criado_em ? formatDate(f.criado_em, { style: 'medium' }) : '';

  return (
    <div className={`rounded-2xl border bg-white shadow-card transition ${f.status === 'resolvido' ? 'border-black/[0.06]' : atrasadas ? 'border-red-200' : 'border-black/[0.06]'}`}>
      <div className="p-4 sm:p-5">
        {/* Cabeçalho */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold text-ink">{f.autor_nome || 'Cliente'}</span>
              <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${st?.cls || ''}`}>{st?.label || f.status}</span>
              {f.promovida_avaliacao_id && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[0.65rem] font-semibold text-emerald-700">★ Publicado</span>}
              {f.permite_publicar && !f.promovida_avaliacao_id && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700">Autoriza publicar</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
              <Stars value={f.nota_geral || 0} size={14} />
              <span>·</span>
              <span title="Canal">{canal?.icon} {canal?.label}</span>
              {eventoNome && <><span>·</span><span className="truncate">{eventoNome}</span></>}
              {propNome && <><span>·</span><span className="truncate">{propNome}</span></>}
              <span>·</span><span>{dataLabel}</span>
            </div>
          </div>
          {atrasadas > 0 && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600"><IcoClock /> {atrasadas} ação(ões) atrasada(s)</span>}
        </div>

        {/* Critérios */}
        {critPreenchidos.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {critPreenchidos.map((c) => (
              <span key={c.v} className="inline-flex items-center gap-1 rounded-lg bg-black/[0.03] px-2 py-1 text-xs text-ink-soft">
                {c.label} <span className="font-semibold text-amber-500">{f.criterios[c.v]}★</span>
              </span>
            ))}
          </div>
        )}

        {/* Comentário e pontos */}
        {f.comentario && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-soft">{f.comentario}</p>}
        {(f.pontos_positivos || f.pontos_negativos) && (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {f.pontos_positivos && <div className="rounded-xl border-l-2 border-emerald-300 bg-emerald-50/50 px-3 py-2 text-sm text-ink-soft"><span className="mb-0.5 block text-xs font-semibold text-emerald-700">👍 Gostou</span>{f.pontos_positivos}</div>}
            {f.pontos_negativos && <div className="rounded-xl border-l-2 border-amber-300 bg-amber-50/50 px-3 py-2 text-sm text-ink-soft"><span className="mb-0.5 block text-xs font-semibold text-amber-700">🛠 Melhorar</span>{f.pontos_negativos}</div>}
          </div>
        )}

        {/* Barra de ações */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-black/[0.05] pt-3">
          <select
            value={f.status} onChange={(e) => cb.onSetStatus(f, e.target.value as StatusFeedback)}
            className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs font-semibold focus:border-brand focus:outline-none" aria-label="Status do feedback"
          >
            {STATUS_FEEDBACK.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
          <button onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/[0.03] hover:text-brand">
            🔧 Tratativa{acoes.length ? ` (${acoes.length})` : ''}
          </button>
          {podePromover(f) && (
            <button onClick={() => cb.onPromover(f)} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">
              <IcoShare /> Publicar como avaliação
            </button>
          )}
          {f.promovida_avaliacao_id && (
            <Link href="/painel/avaliacoes" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/[0.03] hover:text-brand">
              <IcoThumbUp /> Ver no público
            </Link>
          )}
          <button onClick={() => cb.onDelete(f)} className="ml-auto rounded-lg px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-red-600">Excluir</button>
        </div>
      </div>

      {/* Painel de tratativa */}
      {open && <Tratativa f={f} acoes={acoes} isPro={isPro} now={now} cb={cb} />}
    </div>
  );
}

// ── Painel de tratativa (ações + resposta privada) ────────────────────────────
function Tratativa({ f, acoes, isPro, now, cb }: { f: Feedback; acoes: FeedbackAcao[]; isPro: boolean; now: Date; cb: CardCallbacks }) {
  const [nova, setNova] = useState({ descricao: '', responsavel: '', prazo: '' });
  const [savingAcao, setSavingAcao] = useState(false);
  const [resposta, setResposta] = useState(f.resposta_privada || '');
  const [savingResp, setSavingResp] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const links = contatoLinks(f.autor_contato, resposta);

  async function addAcao() {
    if (!nova.descricao.trim()) return;
    setSavingAcao(true);
    const ok = await cb.onAddAcao(f.id, nova);
    setSavingAcao(false);
    if (ok) setNova({ descricao: '', responsavel: '', prazo: '' });
  }
  async function salvarResposta() {
    setSavingResp(true);
    await cb.onSalvarResposta(f, resposta.trim());
    setSavingResp(false);
  }
  async function sugerir() {
    setAiBusy(true);
    const txt = await cb.onSugerirResposta(f);
    setAiBusy(false);
    if (txt) setResposta(txt);
  }

  return (
    <div className="space-y-4 border-t border-black/[0.06] bg-black/[0.015] p-4 sm:p-5">
      {/* Plano de ação */}
      <div>
        <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">Plano de ação</h4>
        {acoes.length > 0 && (
          <ul className="mb-2 space-y-1.5">
            {acoes.map((a) => {
              const sa = STATUS_ACAO_BY[a.status];
              const late = acaoAtrasada(a, now);
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] bg-white px-3 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className={a.status === 'concluida' ? 'text-ink-muted line-through' : 'text-ink-soft'}>{a.descricao}</span>
                    <span className="ml-2 text-xs text-ink-muted">
                      {a.responsavel ? `· ${a.responsavel}` : ''}
                      {a.prazo ? <span className={late ? 'font-semibold text-red-600' : ''}> · {formatDate(a.prazo, { style: 'short' })}{late ? ' (atrasada)' : ''}</span> : ''}
                    </span>
                  </span>
                  <select value={a.status} onChange={(e) => cb.onSetAcaoStatus(a, e.target.value as StatusAcao)} className={`rounded-lg px-2 py-1 text-xs font-semibold ${sa?.cls || ''}`} aria-label="Status da ação">
                    {STATUS_ACAO.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </select>
                  <button onClick={() => cb.onDelAcao(a)} aria-label="Remover ação" className="text-ink-muted hover:text-red-600">✕</button>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <input value={nova.descricao} onChange={(e) => setNova((s) => ({ ...s, descricao: e.target.value }))} placeholder="Nova ação…" className={`${inp} min-w-[160px] flex-1`} />
          <input value={nova.responsavel} onChange={(e) => setNova((s) => ({ ...s, responsavel: e.target.value }))} placeholder="Responsável" className={`${inp} w-32`} />
          <input type="date" value={nova.prazo} onChange={(e) => setNova((s) => ({ ...s, prazo: e.target.value }))} className={`${inp} w-40`} aria-label="Prazo" />
          <button onClick={addAcao} disabled={savingAcao || !nova.descricao.trim()} className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><IcoPlus /> Adicionar</button>
        </div>
      </div>

      {/* Resposta privada */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wide text-ink-muted">Resposta privada ao cliente</h4>
          {f.respondido_em && <span className="text-[0.7rem] text-ink-muted">Respondido {formatDate(f.respondido_em, { style: 'short' })}</span>}
        </div>
        <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} placeholder="Escreva uma resposta privada e cordial ao cliente…" className={`${inp} resize-y`} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {isPro ? (
            <button onClick={sugerir} disabled={aiBusy} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">
              <IcoSparkles /> {aiBusy ? 'Gerando…' : 'Sugerir com IA'}
            </button>
          ) : (
            <Link href="/painel/planos" className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-amber-500 to-brand px-2.5 py-1.5 text-xs font-semibold text-white hover:opacity-90" title="Sugestão com IA é exclusiva do Pro+"><IcoSparkles /> Sugerir com IA (Pro+)</Link>
          )}
          {links.wa && <a href={links.wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50">💬 WhatsApp</a>}
          {links.mail && <a href={links.mail} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-soft hover:bg-black/[0.03]">✉️ E-mail</a>}
          <button onClick={salvarResposta} disabled={savingResp} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><IcoCheck /> {savingResp ? 'Salvando…' : 'Salvar resposta'}</button>
        </div>
      </div>
    </div>
  );
}

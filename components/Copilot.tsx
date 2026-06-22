'use client';

// Ventsy Copilot — assistente GLOBAL do painel (chat flutuante).
// Conversa com /api/painel/copilot, que responde de forma HÍBRIDA: perguntas
// comuns vêm prontas do PANORAMA (deterministas, com deep-links, funcionam até
// sem chave de IA); o resto vai pro LLM ancorado nos mesmos dados. Dark-aware
// (tokens da Onda 2). Sem dependências novas.

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/Primitives';

type Chip = { label: string; href: string };
type Msg = {
  role: 'user' | 'assistant';
  content: string;
  chips?: Chip[];
  sugestoes?: string[];
  aviso?: boolean;
  fonte?: 'local' | 'ia';
};

const SUGESTOES = [
  'Como está meu mês?',
  'O que precisa da minha atenção hoje?',
  'Quais são meus próximos eventos?',
  'Quem está com contrato pendente?',
];

export default function Copilot() {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { if (open) fimRef.current?.scrollIntoView({ block: 'end' }); }, [msgs, loading, open]);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 40); }, [open]);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || loading) return;
    const novas: Msg[] = [...msgs, { role: 'user', content: t }];
    setMsgs(novas);
    setInput('');
    setLoading(true);
    try {
      const r = await fetch('/api/painel/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: novas.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const ct = r.headers.get('content-type') || '';

      if (ct.includes('application/json')) {
        // Resposta DIRETA (local/aviso): JSON com chips + sugestões.
        const j = await r.json().catch(() => ({}));
        const text = (typeof j?.text === 'string' && j.text) || j?.error || 'Não consegui responder agora. Tente de novo em instantes.';
        const aviso = !r.ok || j?.code === 'NO_KEY' || typeof j?.text !== 'string';
        setMsgs((m) => [...m, {
          role: 'assistant',
          content: text,
          chips: Array.isArray(j?.chips) ? j.chips : undefined,
          sugestoes: Array.isArray(j?.sugestoes) ? j.sugestoes : undefined,
          aviso,
          fonte: j?.fonte,
        }]);
      } else if (r.body) {
        // Resposta ABERTA (LLM): stream de texto, token a token.
        setMsgs((m) => [...m, { role: 'assistant', content: '', fonte: 'ia' }]);
        setLoading(false);
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let acc = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          acc += dec.decode(value, { stream: true });
          setMsgs((m) => {
            const c = [...m];
            const i = c.length - 1;
            if (c[i]?.role === 'assistant') c[i] = { ...c[i], content: acc };
            return c;
          });
        }
        setMsgs((m) => {
          const c = [...m];
          const i = c.length - 1;
          if (c[i]?.role === 'assistant') {
            c[i] = acc.trim()
              ? { ...c[i], sugestoes: SUGESTOES }
              : { role: 'assistant', content: 'Não consegui responder agora — mas pergunte direto sobre o seu painel.', aviso: true, sugestoes: SUGESTOES };
          }
          return c;
        });
      } else {
        setMsgs((m) => [...m, { role: 'assistant', content: 'Não consegui responder agora.', aviso: true, sugestoes: SUGESTOES }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: 'Sem conexão com o Copilot. Tente de novo em instantes.', aviso: true }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Fechar o Ventsy Copilot' : 'Abrir o Ventsy Copilot'}
        className="fixed bottom-5 right-5 z-[200] flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-pop transition hover:bg-brand-600"
      >
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" />
            <path d="M19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2Z" />
          </svg>
        )}
      </button>

      {/* Painel */}
      {open && (
        <div className="fixed bottom-[88px] right-5 z-[200] flex max-h-[min(72vh,600px)] w-[380px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          {/* Cabeçalho */}
          <div className="flex items-center gap-2 bg-brand px-4 py-3 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3Z" /></svg>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight">Ventsy Copilot</div>
              <div className="text-[0.68rem] text-white/80">Pergunte sobre o seu negócio</div>
            </div>
            {msgs.length > 0 && (
              <button onClick={() => setMsgs([])} className="rounded-full px-2 py-1 text-[0.66rem] font-semibold text-white/90 hover:bg-white/15">Limpar</button>
            )}
            <button onClick={() => setOpen(false)} aria-label="Fechar" className="rounded-full p-1 hover:bg-white/15">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>

          {/* Mensagens */}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {msgs.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-ink-soft">
                  Oi! Eu cruzo os dados do seu painel — financeiro, agenda, contratos, licenças — pra responder rápido. Experimente:
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGESTOES.map((s) => (
                    <button key={s} onClick={() => enviar(s)} className="rounded-full border border-line bg-surface-alt px-3 py-1.5 text-xs font-medium text-ink-soft transition hover:border-brand hover:text-brand">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m, i) => {
              const ultimaAssistente = m.role === 'assistant' && i === msgs.length - 1 && !loading;
              if (m.role === 'user') {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-brand px-3 py-2 text-sm text-white">{m.content}</div>
                  </div>
                );
              }
              return (
                <div key={i} className="flex flex-col items-start gap-1.5">
                  <div
                    className={
                      m.aviso
                        ? 'max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300'
                        : 'max-w-[92%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-surface-alt px-3 py-2 text-sm text-ink'
                    }
                  >
                    {m.content}
                  </div>

                  {!m.aviso && m.fonte && (
                    <span className="px-1 text-[0.6rem] text-ink-muted/70">{m.fonte === 'ia' ? '✦ Resposta da IA' : 'Direto do seu painel'}</span>
                  )}

                  {m.chips && m.chips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {m.chips.map((c) => (
                        <Link key={c.href} href={c.href} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft transition hover:border-brand hover:text-brand">
                          {c.label}
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
                        </Link>
                      ))}
                    </div>
                  )}

                  {ultimaAssistente && m.sugestoes && m.sugestoes.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {m.sugestoes.map((s) => (
                        <button key={s} onClick={() => enviar(s)} className="rounded-full border border-dashed border-line px-2.5 py-1 text-xs text-ink-muted transition hover:border-brand hover:text-brand">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-surface-alt px-3 py-2 text-sm text-ink-muted">
                  <Spinner size={14} /> pensando…
                </div>
              </div>
            )}

            <div ref={fimRef} />
          </div>

          {/* Entrada */}
          <div className="flex items-end gap-2 border-t border-line p-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(input); } }}
              rows={1}
              placeholder="Pergunte ao Copilot…"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted/70 focus:border-brand"
            />
            <button
              onClick={() => enviar(input)}
              disabled={!input.trim() || loading}
              aria-label="Enviar"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition hover:bg-brand-600 disabled:opacity-40"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

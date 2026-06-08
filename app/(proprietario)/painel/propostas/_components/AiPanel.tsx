'use client';

// Painel de IA da proposta (Pro+). Redige o texto/observações, sugere upsell
// (pacotes/serviços) e propõe condição de pagamento — via /api/propostas/ai
// (Vercel AI Gateway). Degrada com elegância: sem plano Pro+ mostra upsell;
// sem AI_GATEWAY_API_KEY a rota responde NO_KEY e exibimos um aviso amigável.

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import { formatMoney, type Currency } from '@/lib/format';
import { Icon } from './ui';
import { clienteDoEvento, type Evento, type PropostaItem } from '../_lib';

type Acao = 'texto' | 'upsell' | 'pagamento';
const ACOES: { v: Acao; label: string; icon: Parameters<typeof Icon>[0]['name'] }[] = [
  { v: 'texto', label: 'Texto da proposta', icon: 'sparkles' },
  { v: 'upsell', label: 'Sugerir upsell', icon: 'trending' },
  { v: 'pagamento', label: 'Condições', icon: 'coins' },
];

export function AiPanel({
  plano, authHeaders, contexto, onTexto,
}: {
  plano: string;
  authHeaders: () => Promise<Record<string, string>>;
  contexto: { evento: Evento | null; itens: PropostaItem[]; total: number; moeda: Currency };
  onTexto: (t: string) => void;
}) {
  const toast = useToast();
  const [loading, setLoading] = useState<Acao | null>(null);
  const [resultado, setResultado] = useState<{ acao: Acao; texto: string } | null>(null);

  const isPro = plano === 'pro' || plano === 'ultra';

  async function rodar(acao: Acao) {
    setLoading(acao);
    setResultado(null);
    try {
      const payload = {
        action: acao,
        cliente: clienteDoEvento(contexto.evento),
        tipo_evento: contexto.evento?.tipo_evento || null,
        data: contexto.evento?.data_inicio || null,
        moeda: contexto.moeda,
        total: contexto.total,
        itens: contexto.itens.map((it) => ({ descricao: it.descricao, total: it.total })),
      };
      const res = await fetch('/api/propostas/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.code === 'NO_KEY') { toast.info('IA não configurada (defina AI_GATEWAY_API_KEY).'); return; }
      if (json.error) { toast.error(json.error); return; }
      setResultado({ acao, texto: (json.text || '').trim() });
    } catch {
      toast.error('Falha ao chamar a IA.');
    } finally {
      setLoading(null);
    }
  }

  if (!isPro) {
    return (
      <div className="mt-3 flex items-center gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-brand-50/40 px-3.5 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-brand text-white"><Icon name="sparkles" size={15} /></span>
        <div className="flex-1 text-xs text-ink-soft">
          <span className="font-bold text-ink">IA da proposta</span> — redige o texto, sugere upsell e a melhor condição de pagamento.
          <a href="/painel/planos" className="ml-1 font-semibold text-brand hover:underline">Disponível no Pro+</a>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-brand/15 bg-brand-50/30 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 flex items-center gap-1.5 text-xs font-bold text-brand"><Icon name="sparkles" size={13} /> IA</span>
        {ACOES.map((a) => (
          <button key={a.v} onClick={() => rodar(a.v)} disabled={!!loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-black/10 transition hover:text-brand hover:ring-brand/30 disabled:opacity-50">
            <Icon name={a.icon} size={12} /> {loading === a.v ? 'Gerando…' : a.label}
          </button>
        ))}
      </div>

      {resultado && (
        <div className="mt-2.5 rounded-lg bg-white p-3 ring-1 ring-black/[0.06]">
          <p className="whitespace-pre-wrap text-sm text-ink-soft">{resultado.texto}</p>
          <div className="mt-2 flex items-center gap-3 border-t border-black/[0.05] pt-2">
            <button onClick={() => { onTexto(resultado.texto); setResultado(null); toast.success('Texto aplicado às observações.'); }}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-brand hover:underline">
              <Icon name="check" size={13} /> Aplicar às observações
            </button>
            <button onClick={() => { navigator.clipboard?.writeText(resultado.texto); toast.success('Copiado.'); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink">
              <Icon name="copy" size={13} /> Copiar
            </button>
            <span className="ml-auto text-[0.6rem] text-ink-muted">{formatMoney(contexto.total, { currency: contexto.moeda })} · revise antes de enviar</span>
          </div>
        </div>
      )}
    </div>
  );
}

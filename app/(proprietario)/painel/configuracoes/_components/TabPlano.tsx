'use client';

// Aba Plano & Cobrança — plano atual (assinaturas), uso vs. limites, atalho de
// upgrade (/painel/planos) e faturas da assinatura (historico_assinaturas).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/format';
import type { Currency } from '@/lib/format';
import { Section } from './ui';

type PlanoId = 'basico' | 'pro' | 'ultra';
const META: Record<PlanoId, { nome: string; emoji: string }> = {
  basico: { nome: 'Básico', emoji: '🏷️' }, pro: { nome: 'Pro', emoji: '⭐' }, ultra: { nome: 'Ultra', emoji: '🚀' },
};
const LIMITES: Record<PlanoId, { espacos: number; colaboradores: number }> = {
  basico: { espacos: 1, colaboradores: 2 },
  pro: { espacos: 10, colaboradores: 15 },
  ultra: { espacos: Infinity, colaboradores: Infinity },
};

type Fatura = { id: string; criado_em: string; plano_novo: string; tipo_evento: string; valor_cobrado: number | null; metodo_pagamento: string | null };

export default function TabPlano({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [plano, setPlano] = useState<PlanoId>('basico');
  const [status, setStatus] = useState('');
  const [validade, setValidade] = useState<string | null>(null);
  const [moeda, setMoeda] = useState<Currency>('BRL');
  const [uso, setUso] = useState({ espacos: 0, leads: 0, colaboradores: 0 });
  const [faturas, setFaturas] = useState<Fatura[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const { data: a } = await sb.from('assinaturas').select('*').eq('usuario_id', userId).maybeSingle();
        if (a) {
          const p = (a.plano_ativo || 'basico').toLowerCase();
          if (['basico', 'pro', 'ultra'].includes(p)) setPlano(p as PlanoId);
          setStatus(a.status || ''); setValidade(a.fim_periodo || null);
          if (a.moeda) setMoeda(a.moeda as Currency);
        }
      } catch { /* default basico */ }

      const [props, leads, eq] = await Promise.all([
        sb.from('propriedades').select('id', { count: 'exact', head: true }).eq('usuario_id', userId),
        sb.from('clientes_eventos').select('id', { count: 'exact', head: true }).eq('usuario_id', userId),
        sb.from('equipe').select('id', { count: 'exact', head: true }).eq('usuario_id', userId),
      ]);
      setUso({ espacos: props.count ?? 0, leads: leads.count ?? 0, colaboradores: eq.count ?? 0 });

      try {
        const { data: h } = await sb.from('historico_assinaturas').select('*').eq('usuario_id', userId).order('criado_em', { ascending: false }).limit(12);
        if (h) setFaturas(h as Fatura[]);
      } catch { /* sem histórico */ }

      setLoading(false);
    })();
  }, [userId]);

  if (loading) return <div className="h-72 animate-pulse rounded-2xl bg-black/[0.05]" />;

  const lim = LIMITES[plano];
  const money = (v: number | null | undefined) => formatMoney(v, { currency: moeda });

  return (
    <div className="space-y-5">
      <Section
        title="Plano atual"
        action={<Link href="/painel/planos" className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">Ver planos / Upgrade</Link>}
      >
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{META[plano].emoji}</span>
            <div>
              <div className="font-display text-xl font-bold text-ink">{META[plano].nome}</div>
              <div className="text-sm text-ink-muted">
                {status === 'ativa' ? 'Assinatura ativa' : plano === 'basico' ? 'Plano gratuito' : status || '—'}
                {validade && plano !== 'basico' ? ` · válido até ${formatDate(validade)}` : ''}
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Uso vs. limites" desc="Acompanhe o consumo do seu plano.">
        <div className="space-y-4">
          <Barra label="Espaços / propriedades" usado={uso.espacos} limite={lim.espacos} />
          <Barra label="Colaboradores" usado={uso.colaboradores} limite={lim.colaboradores} />
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-soft">Leads no CRM</span>
            <span className="font-semibold text-ink">{uso.leads} <span className="font-normal text-ink-muted">· sem limite</span></span>
          </div>
        </div>
      </Section>

      <Section title="Faturas da assinatura" desc="Histórico de cobranças e mudanças de plano.">
        {faturas.length === 0 ? (
          <div className="rounded-xl bg-black/[0.03] px-4 py-6 text-center text-sm text-ink-muted">Nenhuma cobrança registrada ainda.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2.5 font-semibold">Data</th>
                  <th className="pb-2.5 font-semibold">Evento</th>
                  <th className="pb-2.5 font-semibold">Plano</th>
                  <th className="pb-2.5 font-semibold">Método</th>
                  <th className="pb-2.5 text-right font-semibold">Valor</th>
                </tr>
              </thead>
              <tbody>
                {faturas.map((f) => (
                  <tr key={f.id} className="border-b border-black/[0.04]">
                    <td className="py-3 text-ink-soft">{formatDate(f.criado_em)}</td>
                    <td className="py-3 text-ink-soft">{f.tipo_evento}</td>
                    <td className="py-3 text-ink-soft">{META[(f.plano_novo as PlanoId)]?.nome ?? f.plano_novo}</td>
                    <td className="py-3 text-ink-muted">{f.metodo_pagamento || '—'}</td>
                    <td className="py-3 text-right font-semibold text-ink">{f.valor_cobrado != null ? money(f.valor_cobrado) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}

function Barra({ label, usado, limite }: { label: string; usado: number; limite: number }) {
  const ilimitado = !Number.isFinite(limite);
  const pct = ilimitado ? 0 : Math.min(100, Math.round((usado / Math.max(1, limite)) * 100));
  const cheio = !ilimitado && usado >= limite;
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="font-semibold text-ink">{usado}{ilimitado ? ' · ilimitado' : ` / ${limite}`}</span>
      </div>
      {!ilimitado && (
        <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
          <div className={`h-full rounded-full ${cheio ? 'bg-red-500' : 'bg-brand'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

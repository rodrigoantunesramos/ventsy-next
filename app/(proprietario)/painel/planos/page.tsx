'use client';

// Planos — /painel/planos.
// Catálogo de planos (de planos_config, com fallback) + destaque do plano atual
// (assinaturas) + upgrade reaproveitando o CheckoutPlano (Mercado Pago) existente.

import { useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoneyShort, formatDate } from '@/lib/format';
import CheckoutPlano from '@/components/CheckoutPlano';

type PlanoId = 'basico' | 'pro' | 'ultra';

const PRECOS_DEFAULT: Record<'pro' | 'ultra', { mensal: number; anual: number }> = {
  pro: { mensal: 79, anual: 63 },
  ultra: { mensal: 149, anual: 119 },
};
const FEATURES_DEFAULT: Record<PlanoId, string[]> = {
  basico: ['Cadastro de 1 propriedade', 'Até 5 fotos na galeria', 'Calendário de disponibilidade'],
  pro: ['Tudo do Básico', 'Fotos ilimitadas', 'Botão de WhatsApp direto', 'Relatórios detalhados', 'Suporte prioritário'],
  ultra: ['Tudo do Pro', 'Upload de vídeos', 'Topo das buscas', 'Selo de Verificação Premium', 'Destaque na Home', 'Gerador de contratos PDF'],
};
const META: Record<PlanoId, { nome: string; tagline: string; emoji: string }> = {
  basico: { nome: 'Básico', tagline: 'Para começar a divulgar seu espaço', emoji: '🏷️' },
  pro: { nome: 'Pro', tagline: 'Ideal para espaços profissionais', emoji: '⭐' },
  ultra: { nome: 'Ultra', tagline: 'Máximo alcance e leads', emoji: '🚀' },
};
const PESO: Record<PlanoId, number> = { basico: 0, pro: 1, ultra: 2 };

export default function PlanosPage() {
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [planoAtual, setPlanoAtual] = useState<PlanoId>('basico');
  const [validade, setValidade] = useState<string | null>(null);
  const [anual, setAnual] = useState(false);
  const [precos, setPrecos] = useState(PRECOS_DEFAULT);
  const [features, setFeatures] = useState(FEATURES_DEFAULT);
  const [checkout, setCheckout] = useState<{ plano: string; valor: number; periodo: string } | null>(null);
  const [paidMsg, setPaidMsg] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (session) {
        setEmail(session.user.email || '');
        try {
          const { data: a } = await sb.from('assinaturas').select('plano_ativo,fim_periodo').eq('usuario_id', session.user.id).maybeSingle();
          if (a) {
            const p = (a.plano_ativo || 'basico').toLowerCase();
            if (['basico', 'pro', 'ultra'].includes(p)) setPlanoAtual(p as PlanoId);
            setValidade(a.fim_periodo || null);
          }
        } catch { /* default basico */ }
      }
      try {
        const { data } = await sb.from('planos_config').select('*');
        if (data?.length) {
          const cfg: Record<string, { preco?: number; items?: string[] }> = {};
          data.forEach((r: { id: string; preco?: number; items?: string[] }) => { cfg[r.id] = r; });
          const np = { ...PRECOS_DEFAULT };
          if (cfg.pro?.preco) np.pro = { mensal: cfg.pro.preco, anual: Math.round(cfg.pro.preco * 0.8) };
          if (cfg.ultra?.preco) np.ultra = { mensal: cfg.ultra.preco, anual: Math.round(cfg.ultra.preco * 0.8) };
          setPrecos(np);
          const nf = { ...FEATURES_DEFAULT };
          (['basico', 'pro', 'ultra'] as PlanoId[]).forEach((id) => { if (cfg[id]?.items?.length) nf[id] = cfg[id].items!; });
          setFeatures(nf);
        }
      } catch { /* fallback */ }
      setLoading(false);
    })();
  }, []);

  const precoDe = (id: PlanoId) => (id === 'basico' ? 0 : anual ? precos[id].anual : precos[id].mensal);

  function assinar(id: PlanoId) {
    if (id === 'basico') return;
    const base = anual ? precos[id].anual : precos[id].mensal;
    setCheckout({ plano: id, valor: anual ? base * 12 : base, periodo: anual ? 'anual' : 'mensal' });
  }

  const cards = useMemo(() => (['basico', 'pro', 'ultra'] as PlanoId[]), []);

  if (loading) return <div className="mx-auto h-[520px] max-w-5xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Planos Ventsy</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Seu plano atual: <strong className="text-brand">{META[planoAtual].nome}</strong>
            {validade && planoAtual !== 'basico' ? ` · válido até ${formatDate(validade)}` : ''}
          </p>
        </div>
        {/* Toggle */}
        <div className="flex items-center gap-2 rounded-full border border-black/10 bg-white p-1 text-sm">
          <button onClick={() => setAnual(false)} className={`rounded-full px-3 py-1.5 font-semibold transition ${!anual ? 'bg-ink text-white' : 'text-ink-muted'}`}>Mensal</button>
          <button onClick={() => setAnual(true)} className={`rounded-full px-3 py-1.5 font-semibold transition ${anual ? 'bg-ink text-white' : 'text-ink-muted'}`}>Anual <span className="text-emerald-500">−20%</span></button>
        </div>
      </div>

      {paidMsg && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          ✅ Pagamento aprovado! Seu plano será ativado em instantes.
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        {cards.map((id) => {
          const atual = id === planoAtual;
          const destaque = id === 'pro';
          const preco = precoDe(id);
          const ehUpgrade = PESO[id] > PESO[planoAtual];
          return (
            <div
              key={id}
              className={`relative flex flex-col rounded-2xl bg-white p-6 shadow-card ${destaque ? 'ring-2 ring-brand' : 'border border-black/[0.06]'}`}
            >
              {destaque && !atual && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">Mais popular</span>}
              {atual && <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-ink px-3 py-1 text-xs font-bold text-white">Seu plano atual</span>}

              <div className="text-2xl">{META[id].emoji}</div>
              <h3 className="mt-2 font-display text-lg font-bold text-ink">{META[id].nome}</h3>
              <p className="mt-1 text-sm text-ink-muted">{META[id].tagline}</p>

              <div className="mt-4 flex items-end gap-1">
                {preco === 0 ? (
                  <span className="text-3xl font-black text-ink">Grátis</span>
                ) : (
                  <>
                    <span className="text-3xl font-black text-ink">{formatMoneyShort(preco)}</span>
                    <span className="mb-1 text-sm text-ink-muted">/mês</span>
                  </>
                )}
              </div>
              {anual && preco > 0 && <p className="text-xs text-ink-muted">cobrança anual de {formatMoneyShort(preco * 12)}</p>}

              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {features[id].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-ink-soft">
                    <span className="mt-0.5 text-emerald-500">✔</span>{f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => assinar(id)}
                disabled={atual || id === 'basico'}
                className={`mt-6 rounded-xl px-5 py-3 text-sm font-bold transition ${
                  atual
                    ? 'cursor-default bg-black/[0.05] text-ink-muted'
                    : id === 'basico'
                      ? 'cursor-default border border-black/10 text-ink-muted'
                      : destaque
                        ? 'bg-brand text-white hover:bg-brand-600'
                        : 'border border-ink text-ink hover:bg-ink hover:text-white'
                }`}
              >
                {atual ? 'Plano atual' : id === 'basico' ? 'Plano gratuito' : ehUpgrade ? `Fazer upgrade para ${META[id].nome}` : `Assinar ${META[id].nome}`}
              </button>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-xs text-ink-muted">Pagamento seguro via Pix ou cartão. Cancele quando quiser.</p>

      {checkout && (
        <CheckoutPlano
          plano={checkout.plano}
          periodo={checkout.periodo}
          valor={checkout.valor}
          email={email}
          onClose={() => setCheckout(null)}
          onPaid={() => { setCheckout(null); setPaidMsg(true); }}
        />
      )}
    </div>
  );
}

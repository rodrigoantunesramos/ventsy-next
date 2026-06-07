'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatNumber } from '@/lib/format';

type Propriedade = {
  id: number;
  nome: string | null;
  cidade: string | null;
  estado: string | null;
  categoria: string | null;
  capacidade: number | null;
  descricao: string | null;
  imagem_url: string | null;
  publicada: boolean | null;
  status_publicacao: string | null;
  avaliacao: number | null;
  valor_base: number | null;
  valor_hora: number | null;
  valor_periodo: number | null;
  cep: string | null;
  endereco: string | null;
  whatsapp: string | null;
  email_contato: string | null;
  telefone: string | null;
  tipo_evento: string | null;
};

type ChecklistItem = { label: string; done: boolean; href?: string };

type KpiData = {
  avaliacao: string;
  favoritos: number | null;
  conversas: number | null;
  visualizacoes: number;
  visualizacoesDelta: number | null;
};

const QUICK_ACTIONS = [
  { label: 'Editar Propriedade', emoji: '✏️', href: '/painel/minha-propriedade', desc: 'Dados, descrição e preços' },
  { label: 'Ver Leads', emoji: '👥', href: '/painel/leads', desc: 'Contatos e solicitações' },
  { label: 'Financeiro', emoji: '💰', href: '/painel/financeiro', desc: 'Receita e pagamentos' },
  { label: 'Relatórios', emoji: '📊', href: '/painel/relatorios', desc: 'Métricas do anúncio' },
];

export default function PainelPage() {
  const [loading, setLoading] = useState(true);
  const [prop, setProp] = useState<Propriedade | null>(null);
  const [nome, setNome] = useState('');
  const [kpis, setKpis] = useState<KpiData>({
    avaliacao: '—',
    favoritos: null,
    conversas: null,
    visualizacoes: 0,
    visualizacoesDelta: null,
  });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      const user = session?.user;
      if (!user) { setLoading(false); return; }

      if (user.email) setNome(user.email.split('@')[0]);

      try {
        const { data: perfil } = await sb.from('usuarios').select('nome').eq('id', user.id).single();
        if (perfil?.nome) setNome(perfil.nome);
      } catch { /* perfil opcional */ }

      try {
        const { data } = await sb
          .from('propriedades')
          .select('*')
          .eq('usuario_id', user.id)
          .order('criadoem', { ascending: true })
          .limit(1);
        const p: Propriedade | null = data?.[0] ?? null;
        setProp(p);

        if (p) {
          const now = Date.now();
          const d30 = now - 30 * 24 * 60 * 60 * 1000;
          const d60 = now - 60 * 24 * 60 * 60 * 1000;

          const [favRes, convRes, analyticsRes] = await Promise.allSettled([
            sb.from('favoritos').select('*', { count: 'exact', head: true }).eq('propriedade_id', p.id),
            sb.from('conversas').select('*', { count: 'exact', head: true }).eq('propriedade_id', p.id),
            sb.from('analytics_eventos')
              .select('evento_tipo,created_at')
              .eq('propriedade_id', String(p.id))
              .eq('evento_tipo', 'view')
              .gte('created_at', new Date(d60).toISOString()),
          ]);

          const favoritos = favRes.status === 'fulfilled' ? (favRes.value.count ?? 0) : null;
          const conversas = convRes.status === 'fulfilled' ? (convRes.value.count ?? 0) : null;

          let visualizacoes = 0;
          let visualizacoesDelta: number | null = null;

          if (analyticsRes.status === 'fulfilled' && analyticsRes.value.data) {
            const events = analyticsRes.value.data as { created_at: string | null }[];
            const current = events.filter((e) => e.created_at && new Date(e.created_at).getTime() >= d30).length;
            const previous = events.filter((e) => e.created_at && new Date(e.created_at).getTime() < d30).length;
            visualizacoes = current;
            if (previous > 0) {
              visualizacoesDelta = Math.round(((current - previous) / previous) * 100);
            }
          }

          setKpis({
            avaliacao: p.avaliacao ? p.avaliacao.toFixed(1) : '—',
            favoritos,
            conversas,
            visualizacoes,
            visualizacoesDelta,
          });
        }
      } catch { /* sem propriedade */ }

      setLoading(false);
    })();
  }, []);

  const handleCopy = async () => {
    if (!prop) return;
    const url = `${window.location.origin}/propriedade/${prop.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback silencioso */ }
  };

  const primeiroNome = (nome || '').split(' ')[0] || '';

  if (loading) return <PainelSkeleton />;

  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl">
        <h1 className="text-xl font-bold text-ink sm:text-2xl">
          Bem-vindo(a){primeiroNome ? ', ' : ''}<span className="text-brand">{primeiroNome}</span>!
        </h1>
        <div className="mt-6 rounded-2xl border border-dashed border-brand/30 bg-white p-8 text-center shadow-card">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-2xl">🏡</div>
          <h2 className="text-lg font-bold text-ink">Cadastre sua propriedade</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Você ainda não tem um espaço cadastrado. Crie seu anúncio para começar a receber reservas na Ventsy.
          </p>
          <Link
            href="/anunciar"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Anunciar meu espaço →
          </Link>
        </div>
      </div>
    );
  }

  const checklist: ChecklistItem[] = [
    { label: 'Conta criada', done: true },
    { label: 'Foto de capa', done: !!prop.imagem_url, href: '/painel/fotos' },
    { label: 'Descrição do espaço', done: !!(prop.descricao && prop.descricao.trim().length > 20), href: '/painel/minha-propriedade' },
    { label: 'Endereço completo', done: !!(prop.cep && prop.cidade) || !!prop.endereco, href: '/painel/minha-propriedade' },
    { label: 'Contato (WhatsApp/e-mail)', done: !!(prop.whatsapp || prop.email_contato || prop.telefone), href: '/painel/minha-propriedade' },
    { label: 'Valores do evento', done: !!(prop.valor_base || prop.valor_hora || prop.valor_periodo), href: '/painel/minha-propriedade' },
    { label: 'Tipos de evento', done: !!prop.tipo_evento, href: '/painel/minha-propriedade' },
  ];
  const feitos = checklist.filter((c) => c.done).length;
  const pct = Math.round((feitos / checklist.length) * 100);
  const publicada = prop.publicada === true;
  const valorRef = prop.valor_base || prop.valor_periodo || prop.valor_hora || 0;

  return (
    <div className="mx-auto max-w-6xl space-y-5">

      {/* Hero ─────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">
            Bem-vindo(a){primeiroNome ? ', ' : ''}<span className="text-brand">{primeiroNome}</span>!
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {prop.nome || 'Sua propriedade'}
            {prop.cidade ? ` · ${prop.cidade}${prop.estado ? `/${prop.estado}` : ''}` : ''}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              publicada ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${publicada ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {publicada ? 'Publicada' : prop.status_publicacao || 'Em preparação'}
            </span>
            {!publicada && (
              <Link href="/painel/minha-propriedade" className="text-xs font-semibold text-brand underline-offset-2 hover:underline">
                Completar cadastro →
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-shrink-0 flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            {copied ? '✓ Copiado!' : '🔗 Compartilhar'}
          </button>
          <Link
            href={`/propriedade/${prop.id}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Ver no site →
          </Link>
        </div>
      </div>

      {/* KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          label="Visualizações"
          value={formatNumber(kpis.visualizacoes)}
          icon="👁️"
          delta={kpis.visualizacoesDelta}
          sub="últimos 30 dias"
        />
        <KpiCard label="Favoritos" value={kpis.favoritos == null ? '—' : formatNumber(kpis.favoritos)} icon="❤️" />
        <KpiCard label="Conversas" value={kpis.conversas == null ? '—' : formatNumber(kpis.conversas)} icon="💬" />
        <KpiCard label="Avaliação média" value={kpis.avaliacao} icon="⭐" />
      </div>

      {/* Ações rápidas ───────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="group rounded-2xl border border-transparent bg-white p-4 shadow-card transition hover:border-brand/30 hover:shadow-md"
          >
            <div className="text-xl">{a.emoji}</div>
            <div className="mt-2 text-sm font-bold text-ink transition group-hover:text-brand">{a.label}</div>
            <div className="mt-0.5 text-xs text-ink-muted">{a.desc}</div>
          </Link>
        ))}
      </div>

      {/* Checklist + Resumo ─────────────────────────────── */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-ink">Complete seu perfil</h3>
            <span className="text-sm font-semibold text-ink-muted">{feitos} de {checklist.length}</span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
            <div className="h-full rounded-full bg-brand transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <ul className="mt-5 space-y-1">
            {checklist.map((c) => {
              const inner = (
                <>
                  <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[0.7rem] ${
                    c.done ? 'bg-emerald-500 text-white' : 'border border-black/15 bg-white text-transparent'
                  }`}>
                    ✓
                  </span>
                  <span className={`flex-1 text-sm ${c.done ? 'text-ink-soft line-through decoration-black/20' : 'font-medium text-ink'}`}>
                    {c.label}
                  </span>
                  {!c.done && c.href && (
                    <span className="text-xs font-semibold text-brand">Completar →</span>
                  )}
                </>
              );

              if (!c.done && c.href) {
                return (
                  <li key={c.label}>
                    <Link
                      href={c.href}
                      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-brand-50"
                    >
                      {inner}
                    </Link>
                  </li>
                );
              }
              return (
                <li key={c.label} className="flex items-center gap-3 px-2 py-2">
                  {inner}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h3 className="text-base font-bold text-ink">Resumo</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Linha termo="Categoria" valor={prop.categoria || '—'} />
            <Linha termo="Valor de referência" valor={valorRef ? formatMoney(valorRef) : 'Sob consulta'} />
            <Linha termo="Tipos de evento" valor={prop.tipo_evento || '—'} />
            <Linha termo="Capacidade" valor={prop.capacidade ? `${formatNumber(prop.capacidade)} pessoas` : '—'} />
          </dl>
          <div className="mt-5 border-t border-black/[0.05] pt-4">
            <Link
              href="/painel/minha-propriedade"
              className="block w-full rounded-full border border-black/10 py-2 text-center text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
            >
              Editar propriedade
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}

// ── Componentes ──────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, delta, sub,
}: {
  label: string; value: string; icon: string; delta?: number | null; sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between">
        <div className="text-lg">{icon}</div>
        {delta != null && delta !== 0 && (
          <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${
            delta > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
          }`}>
            {delta > 0 ? '↑' : '↓'} {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-2 text-xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
      {sub && <div className="mt-0.5 text-[0.65rem] text-ink-muted/60">{sub}</div>}
    </div>
  );
}

function Linha({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-ink-muted">{termo}</dt>
      <dd className="text-right font-semibold text-ink-soft">{valor}</dd>
    </div>
  );
}

function PainelSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse space-y-5">
      <div className="h-28 rounded-2xl bg-black/[0.05]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />)}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-black/[0.05]" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-black/[0.05] lg:col-span-2" />
        <div className="h-64 rounded-2xl bg-black/[0.05]" />
      </div>
    </div>
  );
}

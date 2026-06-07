'use client';

// Painel do proprietário — home (/painel).
// Primeira página real da árvore consolidada: liga a dados do Supabase
// (tabela propriedades, auto-contida) e usa lib/format (sem hardcode de R$).

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

type Checklist = { label: string; done: boolean }[];

export default function PainelPage() {
  const [loading, setLoading] = useState(true);
  const [prop, setProp] = useState<Propriedade | null>(null);
  const [nome, setNome] = useState('');
  const [favoritos, setFavoritos] = useState<number | null>(null);
  const [conversas, setConversas] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      const user = session?.user;
      if (user) setNome((user.email ?? '').split('@')[0]);

      if (!user) { setLoading(false); return; }

      try {
        const { data: perfil } = await sb.from('usuarios').select('nome').eq('id', user.id).single();
        if (perfil?.nome) setNome(perfil.nome);
      } catch { /* opcional */ }

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
          // Contagens (defensivas — tabelas/FKs podem variar)
          try {
            const { count } = await sb
              .from('favoritos')
              .select('*', { count: 'exact', head: true })
              .eq('propriedade_id', p.id);
            setFavoritos(count ?? 0);
          } catch { setFavoritos(null); }
          try {
            const { count } = await sb
              .from('conversas')
              .select('*', { count: 'exact', head: true })
              .eq('propriedade_id', p.id);
            setConversas(count ?? 0);
          } catch { setConversas(null); }
        }
      } catch { /* sem propriedade */ }

      setLoading(false);
    })();
  }, []);

  const primeiroNome = (nome || '').split(' ')[0] || '';

  if (loading) return <PainelSkeleton />;

  // Onboarding — ainda sem propriedade
  if (!prop) {
    return (
      <div className="mx-auto max-w-3xl">
        <Saudacao nome={primeiroNome} />
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

  // Checklist de conclusão — calculada dos campos reais da propriedade
  const checklist: Checklist = [
    { label: 'Conta criada', done: true },
    { label: 'Foto de capa', done: !!prop.imagem_url },
    { label: 'Descrição do espaço', done: !!(prop.descricao && prop.descricao.trim().length > 20) },
    { label: 'Endereço completo', done: !!(prop.cep && prop.cidade) || !!prop.endereco },
    { label: 'Contato (WhatsApp/e-mail)', done: !!(prop.whatsapp || prop.email_contato || prop.telefone) },
    { label: 'Valores do evento', done: !!(prop.valor_base || prop.valor_hora || prop.valor_periodo) },
    { label: 'Tipos de evento', done: !!prop.tipo_evento },
  ];
  const feitos = checklist.filter((c) => c.done).length;
  const pct = Math.round((feitos / checklist.length) * 100);

  const publicada = prop.publicada === true;
  const valorRef = prop.valor_base || prop.valor_periodo || prop.valor_hora || 0;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Hero */}
      <div className="flex flex-col gap-4 rounded-2xl bg-white p-6 shadow-card sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Saudacao nome={primeiroNome} />
          <p className="mt-1 text-sm text-ink-muted">
            {prop.nome || 'Sua propriedade'}
            {prop.cidade ? ` · ${prop.cidade}${prop.estado ? `/${prop.estado}` : ''}` : ''}
          </p>
          <span
            className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              publicada ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${publicada ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {publicada ? 'Publicada' : prop.status_publicacao || 'Em preparação'}
          </span>
        </div>
        <div className="flex flex-shrink-0 gap-2">
          <Link
            href={`/propriedade/${prop.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand"
          >
            Ver no site
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Avaliação média" value={prop.avaliacao ? prop.avaliacao.toFixed(1) : '—'} icon="⭐" />
        <Kpi label="Favoritos" value={favoritos == null ? '—' : formatNumber(favoritos)} icon="❤️" />
        <Kpi label="Conversas" value={conversas == null ? '—' : formatNumber(conversas)} icon="💬" />
        <Kpi label="Capacidade" value={prop.capacidade ? `${formatNumber(prop.capacidade)} pessoas` : '—'} icon="👥" />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Checklist */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-white p-6 shadow-card">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Complete seu perfil</h3>
              <span className="text-sm font-semibold text-ink-muted">{feitos} de {checklist.length}</span>
            </div>
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-black/[0.06]">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
            </div>
            <ul className="mt-5 space-y-2.5">
              {checklist.map((c) => (
                <li key={c.label} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[0.7rem] ${
                      c.done ? 'bg-emerald-500 text-white' : 'border border-black/15 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <span className={c.done ? 'text-ink-soft' : 'text-ink-muted'}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Resumo da propriedade */}
        <div className="rounded-2xl bg-white p-6 shadow-card">
          <h3 className="text-base font-bold text-ink">Resumo</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <Linha termo="Categoria" valor={prop.categoria || '—'} />
            <Linha termo="Valor de referência" valor={valorRef ? formatMoney(valorRef) : 'Sob consulta'} />
            <Linha termo="Tipos de evento" valor={prop.tipo_evento || '—'} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Saudacao({ nome }: { nome: string }) {
  return (
    <h1 className="text-xl font-bold text-ink sm:text-2xl">
      Bem-vindo(a){nome ? ', ' : ''}
      <span className="text-brand">{nome}</span>!
    </h1>
  );
}

function Kpi({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-lg">{icon}</div>
      <div className="mt-2 text-xl font-bold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{label}</div>
    </div>
  );
}

function Linha({ termo, valor }: { termo: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-muted">{termo}</dt>
      <dd className="text-right font-semibold text-ink-soft">{valor}</dd>
    </div>
  );
}

function PainelSkeleton() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="h-28 rounded-2xl bg-black/[0.05]" />
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-black/[0.05]" />)}
      </div>
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="h-64 rounded-2xl bg-black/[0.05] lg:col-span-2" />
        <div className="h-64 rounded-2xl bg-black/[0.05]" />
      </div>
    </div>
  );
}

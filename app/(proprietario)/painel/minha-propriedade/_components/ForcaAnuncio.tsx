'use client';

// "Força do Anúncio" — medidor gamificado de completude. Cada critério é
// clicável e leva para a aba (ou para a página de Fotos) que resolve a pendência.

import Link from 'next/link';

export type AnuncioStats = {
  numFotos: number;
  descricaoLen: number;
  temCapacidade: boolean;
  enderecoCompleto: boolean;
  geolocalizado: boolean;
  temPreco: boolean;
  temWhatsapp: boolean;
  numComodidades: number;
  numEventos: number;
  numFaq: number;
  temAnfitriao: boolean;
};

type Crit = { nome: string; ok: boolean; pts: number; dica: string; aba?: string; href?: string };

export default function ForcaAnuncio({ stats, onJump }: { stats: AnuncioStats; onJump: (aba: string) => void }) {
  const criterios: Crit[] = [
    { nome: 'Pelo menos 5 fotos', ok: stats.numFotos >= 5, pts: 20, href: '/painel/fotos',
      dica: stats.numFotos === 0 ? 'Anúncios com fotos recebem muito mais contatos.' : `Você tem ${stats.numFotos}. Chegue a 5+.` },
    { nome: 'Descrição completa', ok: stats.descricaoLen >= 120, pts: 15, aba: 'sobre',
      dica: stats.descricaoLen === 0 ? 'Descreva o espaço e seus diferenciais.' : `Está com ${stats.descricaoLen} caracteres — tente 120+.` },
    { nome: 'Endereço e mapa', ok: stats.enderecoCompleto && stats.geolocalizado, pts: 15, aba: 'endereco',
      dica: !stats.enderecoCompleto ? 'Preencha CEP, cidade e estado.' : 'Clique em “Localizar no mapa” para fixar a posição.' },
    { nome: 'Preço informado', ok: stats.temPreco, pts: 10, aba: 'valores', dica: 'Defina ao menos um valor (diária ou hora).' },
    { nome: 'WhatsApp de contato', ok: stats.temWhatsapp, pts: 10, aba: 'contato', dica: 'Clientes contatam direto pelo WhatsApp.' },
    { nome: '3+ comodidades', ok: stats.numComodidades >= 3, pts: 10, aba: 'comodidades', dica: `Selecionadas: ${stats.numComodidades}. Marque pelo menos 3.` },
    { nome: 'Capacidade', ok: stats.temCapacidade, pts: 5, aba: 'sobre', dica: 'Informe quantas pessoas o espaço comporta.' },
    { nome: '1+ tipo de evento', ok: stats.numEventos >= 1, pts: 5, aba: 'eventos', dica: 'Diga quais eventos seu espaço atende.' },
    { nome: '1+ pergunta no FAQ', ok: stats.numFaq >= 1, pts: 5, aba: 'faq', dica: 'Responda dúvidas comuns e ganhe confiança.' },
    { nome: 'Perfil do anfitrião', ok: stats.temAnfitriao, pts: 5, aba: 'anfitriao', dica: 'Adicione foto e uma breve apresentação.' },
  ];

  const score = criterios.reduce((acc, c) => acc + (c.ok ? c.pts : 0), 0);
  const cor = score >= 80 ? '#16a34a' : score >= 50 ? '#d97706' : '#ff385c';
  const msg =
    score >= 100 ? '🏆 Anúncio completo e com a máxima visibilidade.'
    : score >= 80 ? '🎉 Muito bom! Pequenos ajustes destravam ainda mais contatos.'
    : score >= 50 ? '🚀 Bom começo! Complete os itens abaixo para aparecer mais.'
    : '⚡ Seu anúncio precisa de atenção. Complete os itens abaixo.';

  const R = 34;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - score / 100);
  const pendentes = criterios.filter((c) => !c.ok);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="flex items-center gap-4">
        <svg width="88" height="88" viewBox="0 0 88 88" className="shrink-0">
          <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="8" />
          <circle
            cx="44" cy="44" r={R} fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={offset} transform="rotate(-90 44 44)"
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
          <text x="44" y="44" textAnchor="middle" dominantBaseline="central" fontSize="20" fontWeight="700" fill={cor}>
            {score}%
          </text>
        </svg>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-ink">Força do anúncio</h2>
          <p className="mt-0.5 text-sm text-ink-soft">{msg}</p>
        </div>
      </div>

      {pendentes.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {pendentes.map((c) => {
            const inner = (
              <>
                <span className="mt-0.5 text-amber-500">⚠️</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{c.nome}</span>
                  <span className="block text-xs text-ink-muted">{c.dica}</span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-brand">+{c.pts} →</span>
              </>
            );
            const cls = 'flex items-start gap-2 rounded-xl border border-black/[0.06] px-3 py-2.5 text-left transition hover:border-brand/40 hover:bg-brand-50/40';
            return c.href ? (
              <Link key={c.nome} href={c.href} className={cls}>{inner}</Link>
            ) : (
              <button key={c.nome} type="button" onClick={() => c.aba && onJump(c.aba)} className={cls}>{inner}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

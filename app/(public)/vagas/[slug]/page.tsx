'use client';

// Página PÚBLICA de vaga — /vagas/[slug].
// Mostra a vaga aberta (lida via /api/rh/vaga, service-role) e recebe candidaturas
// (POST /api/rh/candidatura), que caem direto no funil do dono em /painel/rh. Sem
// autenticação; honeypot anti-bot. Sem "R$" hardcoded (lib/format).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatMoneyShort } from '@/lib/format';

type Vaga = {
  id: string; titulo: string; departamento: string | null; tipo_contrato: string;
  salario_min: number | null; salario_max: number | null; descricao: string | null;
  requisitos: string | null; beneficios: string | null; local: string | null;
};
const CONTRATO_LABEL: Record<string, string> = { clt: 'CLT', horista: 'Horista', mei: 'MEI/PJ', estagio: 'Estágio', freelancer: 'Freelancer' };

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function VagaPublicaPage({ params }: { params: { slug: string } }) {
  const [vaga, setVaga] = useState<Vaga | null>(null);
  const [estado, setEstado] = useState<'loading' | 'ok' | 'notfound'>('loading');
  const [f, setF] = useState({ nome: '', email: '', telefone: '', curriculo_url: '', mensagem: '', website: '' });
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/rh/vaga?slug=${encodeURIComponent(params.slug)}`);
        const json = await res.json();
        if (res.ok && json.vaga) { setVaga(json.vaga); setEstado('ok'); }
        else setEstado('notfound');
      } catch { setEstado('notfound'); }
    })();
  }, [params.slug]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro('');
    if (!f.nome.trim()) { setErro('Informe seu nome.'); return; }
    setEnviando(true);
    try {
      const res = await fetch('/api/rh/candidatura', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...f, slug: params.slug }),
      });
      const json = await res.json();
      setEnviando(false);
      if (res.ok && json.ok) setEnviado(true);
      else setErro(json.error || 'Não foi possível enviar. Tente novamente.');
    } catch { setEnviando(false); setErro('Falha de rede. Tente novamente.'); }
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8]">
      <header className="border-b border-black/[0.06] bg-white">
        <div className="mx-auto flex h-[60px] max-w-3xl items-center px-4">
          <Link href="/" className="font-display text-[1.4rem] font-bold italic text-brand">VENTSY</Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        {estado === 'loading' && <div className="h-[360px] animate-pulse rounded-2xl bg-black/[0.05]" />}

        {estado === 'notfound' && (
          <div className="rounded-2xl bg-white p-10 text-center shadow-card">
            <h1 className="font-display text-xl font-bold text-ink">Vaga não encontrada</h1>
            <p className="mt-2 text-sm text-ink-muted">Esta vaga pode ter sido encerrada ou o link está incorreto.</p>
            <Link href="/" className="mt-4 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Voltar ao site</Link>
          </div>
        )}

        {estado === 'ok' && vaga && (
          <div className="space-y-5">
            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{vaga.titulo}</h1>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {vaga.departamento && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{vaga.departamento}</span>}
                <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{CONTRATO_LABEL[vaga.tipo_contrato] ?? vaga.tipo_contrato}</span>
                {vaga.local && <span className="rounded-full bg-black/[0.05] px-2.5 py-1 font-semibold text-ink-soft">{vaga.local}</span>}
                {(vaga.salario_min || vaga.salario_max) && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700">{[vaga.salario_min, vaga.salario_max].filter(Boolean).map((x) => formatMoneyShort(x!)).join(' – ')}</span>
                )}
              </div>
              {vaga.descricao && <Secao titulo="Descrição">{vaga.descricao}</Secao>}
              {vaga.requisitos && <Secao titulo="Requisitos">{vaga.requisitos}</Secao>}
              {vaga.beneficios && <Secao titulo="Benefícios">{vaga.beneficios}</Secao>}
            </div>

            <div className="rounded-2xl bg-white p-6 shadow-card sm:p-8">
              <h2 className="font-display text-lg font-bold text-ink">Candidate-se</h2>
              {enviado ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-center">
                  <div className="text-2xl">🎉</div>
                  <p className="mt-1 font-semibold text-emerald-800">Candidatura enviada!</p>
                  <p className="mt-0.5 text-sm text-emerald-700">Obrigado pelo interesse. Entraremos em contato se houver um match.</p>
                </div>
              ) : (
                <form onSubmit={enviar} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome completo *</span><input className={inp} value={f.nome} onChange={set('nome')} required /></label>
                  <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">E-mail</span><input type="email" className={inp} value={f.email} onChange={set('email')} /></label>
                  <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Telefone</span><input className={inp} value={f.telefone} onChange={set('telefone')} /></label>
                  <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Link do currículo</span><input className={inp} value={f.curriculo_url} onChange={set('curriculo_url')} placeholder="https://" /></label>
                  <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">Mensagem</span><textarea className={`${inp} min-h-[88px]`} value={f.mensagem} onChange={set('mensagem')} placeholder="Conte por que você é um bom match para a vaga." /></label>
                  {/* honeypot (oculto) */}
                  <input type="text" tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} className="hidden" aria-hidden />
                  {erro && <p className="text-sm text-red-600 sm:col-span-2">{erro}</p>}
                  <div className="sm:col-span-2">
                    <button type="submit" disabled={enviando} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{enviando ? 'Enviando…' : 'Enviar candidatura'}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="mt-5">
      <h3 className="mb-1 text-sm font-bold uppercase tracking-wide text-ink-muted">{titulo}</h3>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}

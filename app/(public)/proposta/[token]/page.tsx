'use client';

// Página PÚBLICA da proposta — /proposta/[token]. O cliente abre SEM login, vê o
// documento (mesma PropostaView do painel/PDF) e clica Aceitar/Recusar. Os dados
// vêm da rota service-role /api/propostas/publica (resolvida pelo token). O aceite
// dispara a conversão atômica (contrato + parcelas + funil) no servidor.
// Sem "R$" hardcoded — moeda da própria proposta via lib/format.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { setFormatPrefs, type Currency, type Locale } from '@/lib/format';
import { PropostaView, type PropostaViewData } from '../../../(proprietario)/painel/propostas/_components/PropostaView';
import { buildPropostaPDF } from '../../../(proprietario)/painel/propostas/_pdf';
import type { Empresa, Evento } from '../../../(proprietario)/painel/propostas/_lib';

type PropostaPub = PropostaViewData & { id: string; status: string; link_token: string; propriedade_id: number | null };
type Payload = { proposta: PropostaPub; empresa: Empresa | null; evento: Evento | null; propriedadeNome: string | null };

const LOCALE_BY_MOEDA: Record<string, Locale> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'es-ES' };

export default function PropostaPublicaPage() {
  const params = useParams();
  const token = String(params?.token || '');
  const [estado, setEstado] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [data, setData] = useState<Payload | null>(null);
  const [acting, setActing] = useState(false);
  const [override, setOverride] = useState<'aceita' | 'recusada' | null>(null);
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/propostas/publica?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (!res.ok) { setEstado('notfound'); return; }
      const json = (await res.json()) as Payload;
      if (!json?.proposta) { setEstado('notfound'); return; }
      const moeda = (json.proposta.moeda as Currency) || 'BRL';
      setFormatPrefs({ currency: moeda, locale: LOCALE_BY_MOEDA[moeda] || 'pt-BR' });
      setData(json);
      setEstado('ready');
    } catch {
      setEstado('notfound');
    }
  }, [token]);

  useEffect(() => { if (token) carregar(); }, [token, carregar]);

  const statusEfetivo = override || data?.proposta.status || '';
  const podeDecidir = statusEfetivo === 'enviada' || statusEfetivo === 'vista';

  async function decidir(action: 'aceitar' | 'recusar') {
    if (acting) return;
    setActing(true);
    try {
      const res = await fetch('/api/propostas/publica', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action, ...(action === 'recusar' ? { motivo } : {}) }),
      });
      const json = await res.json();
      if (json?.ok) { setOverride(action === 'aceitar' ? 'aceita' : 'recusada'); setRecusando(false); }
      else if (json?.error === 'expirada') { await carregar(); }
      else { alert('Não foi possível processar. Tente novamente ou fale com a empresa.'); }
    } catch {
      alert('Falha de conexão. Tente novamente.');
    } finally {
      setActing(false);
    }
  }

  async function baixarPDF() {
    if (!data) return;
    const doc = await buildPropostaPDF({
      data: data.proposta, empresa: data.empresa, evento: data.evento, propriedadeNome: data.propriedadeNome,
    });
    doc.save(`proposta-${String(data.proposta.numero).padStart(4, '0')}.pdf`);
  }

  const empresaNome = useMemo(
    () => data?.empresa?.fantasia || data?.empresa?.razao_social || 'VENTSY',
    [data],
  );

  if (estado === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f8]">
        <div className="font-display text-[2rem] italic text-brand">VENTSY</div>
        <div className="mt-4 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand" style={{ animation: `bounce-dot 1s ${i * 0.15}s infinite` }} />)}</div>
      </div>
    );
  }

  if (estado === 'notfound' || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f8] px-6 text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-card">🔍</div>
        <h1 className="text-lg font-bold text-ink">Proposta não encontrada</h1>
        <p className="mt-1 max-w-sm text-sm text-ink-muted">O link pode ter expirado ou estar incorreto. Verifique com a empresa que enviou a proposta.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f8] pb-32">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/90 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-2">
            {data.empresa?.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.empresa.logo_url} alt={empresaNome} className="h-8 w-8 rounded-lg object-cover" />
            ) : (
              <span className="font-display text-lg font-bold italic text-brand">VENTSY</span>
            )}
            <span className="text-sm font-semibold text-ink">{empresaNome}</span>
          </div>
          <button onClick={baixarPDF} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-ink-soft hover:text-brand">
            ↓ Baixar PDF
          </button>
        </div>
      </header>

      {/* Banner de status */}
      {statusEfetivo === 'aceita' && (
        <Banner tone="emerald" titulo="Proposta aceita! 🎉" texto="Obrigado! A empresa foi notificada e dará sequência. Você pode baixar o PDF para seus registros." />
      )}
      {statusEfetivo === 'recusada' && (
        <Banner tone="red" titulo="Proposta recusada" texto="Tudo bem! Se mudar de ideia ou quiser ajustar algo, fale com a empresa." />
      )}
      {statusEfetivo === 'expirada' && (
        <Banner tone="amber" titulo="Proposta expirada" texto="A validade desta proposta passou. Solicite uma atualização à empresa." />
      )}

      {/* Documento */}
      <main className="mx-auto mt-4 max-w-3xl px-4">
        <PropostaView data={data.proposta} empresa={data.empresa} evento={data.evento} propriedadeNome={data.propriedadeNome} />
      </main>

      {/* Barra de ação fixa */}
      {podeDecidir && !override && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center gap-3">
            <button onClick={() => setRecusando(true)} disabled={acting}
              className="flex-1 rounded-xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-red-200 hover:text-red-600 disabled:opacity-50 sm:flex-none sm:px-6">
              Recusar
            </button>
            <button onClick={() => decidir('aceitar')} disabled={acting}
              className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-50">
              {acting ? 'Processando…' : 'Aceitar proposta'}
            </button>
          </div>
        </div>
      )}

      {/* Modal de recusa */}
      {recusando && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={(e) => { if (e.target === e.currentTarget) setRecusando(false); }}>
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <h3 className="font-display text-xl font-bold text-ink">Recusar proposta</h3>
            <p className="mt-1 text-sm text-ink-muted">Quer contar o motivo? (opcional) — ajuda a empresa a melhorar a oferta.</p>
            <textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3}
              className="mt-3 w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
              placeholder="Ex.: valor acima do orçamento, data indisponível…" />
            <div className="mt-4 flex items-center gap-3">
              <button onClick={() => decidir('recusar')} disabled={acting} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">{acting ? 'Enviando…' : 'Confirmar recusa'}</button>
              <button onClick={() => setRecusando(false)} className="text-sm font-medium text-ink-muted hover:text-ink">Voltar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Banner({ tone, titulo, texto }: { tone: 'emerald' | 'red' | 'amber'; titulo: string; texto: string }) {
  const cls = {
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    red: 'border-red-200 bg-red-50 text-red-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
  }[tone];
  return (
    <div className="mx-auto mt-4 max-w-3xl px-4">
      <div className={`rounded-2xl border px-4 py-3 ${cls}`}>
        <div className="text-sm font-bold">{titulo}</div>
        <div className="mt-0.5 text-sm">{texto}</div>
      </div>
    </div>
  );
}

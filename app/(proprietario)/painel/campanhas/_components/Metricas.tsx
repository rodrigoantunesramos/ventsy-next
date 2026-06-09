'use client';

// Modal de métricas de uma campanha (/painel/campanhas). Carrega as linhas de
// envio (campanhas_envios via RLS) e calcula o funil EXATO (lib/campanhas.contarEnvios),
// taxas, melhor horário e a lista de destinatários. Para WhatsApp sem API, gera os
// links wa.me em lote (degrade) e permite marcar como enviados. Sem "R$".

import { useEffect, useMemo, useState } from 'react';
import { formatNumber, formatPercent, formatDateTime } from '@/lib/format';
import {
  type Campanha, type Envio, type StatusEnvio,
  contarEnvios, funilCampanha, melhorHorario, taxaAbertura, taxaClique, taxaEntrega,
  waLink, interpolar,
} from '@/lib/campanhas';
import { CanalBadge, StatusChip, Funil, IcoX, IcoUsers, IcoClock, IcoCheck } from './ui';

const ENVIO_STATUS: Record<StatusEnvio, { label: string; cls: string }> = {
  fila: { label: 'Na fila', cls: 'bg-black/[0.05] text-ink-muted' },
  enviado: { label: 'Enviado', cls: 'bg-sky-50 text-sky-700' },
  entregue: { label: 'Entregue', cls: 'bg-blue-50 text-blue-700' },
  aberto: { label: 'Aberto', cls: 'bg-amber-50 text-amber-700' },
  clicado: { label: 'Clicou', cls: 'bg-emerald-50 text-emerald-700' },
  falha: { label: 'Falha', cls: 'bg-red-50 text-red-700' },
  descadastrado: { label: 'Descadastrou', cls: 'bg-black/[0.06] text-ink-muted' },
};

type Props = {
  campanha: Campanha;
  onClose: () => void;
  loadEnvios: (campanhaId: string) => Promise<Envio[]>;
  onMarcarEnviados: (campanhaId: string) => Promise<boolean>;
};

export function Metricas({ campanha, onClose, loadEnvios, onMarcarEnviados }: Props) {
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  useEffect(() => {
    (async () => { setLoading(true); setEnvios(await loadEnvios(campanha.id)); setLoading(false); })();
  }, [campanha.id, loadEnvios]);

  const cont = useMemo(() => contarEnvios(envios), [envios]);
  const sintetica = useMemo<Campanha>(() => ({
    ...campanha, n_enviados: cont.enviados, n_entregues: cont.entregues, n_abertos: cont.abertos, n_clicados: cont.clicados,
  }), [campanha, cont]);
  const funil = useMemo(() => funilCampanha(sintetica), [sintetica]);
  const horario = useMemo(() => melhorHorario(envios), [envios]);
  const isWhats = campanha.canal === 'whatsapp';

  async function marcarEnviados() {
    setBusy(true);
    const ok = await onMarcarEnviados(campanha.id);
    if (ok) setEnvios((prev) => prev.map((e) => (e.status === 'fila' ? { ...e, status: 'enviado', enviado_em: new Date().toISOString() } : e)));
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-black/[0.06] px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-ink">{campanha.nome}</h2>
            <div className="mt-1 flex items-center gap-3"><CanalBadge canal={campanha.canal} /><StatusChip status={campanha.status} /></div>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {loading ? (
            <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
          ) : (
            <>
              {/* KPIs */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Público" valor={formatNumber(cont.total)} />
                {isWhats ? (
                  <>
                    <Mini label="Enviados" valor={formatNumber(cont.enviados)} />
                    <Mini label="Na fila" valor={formatNumber(cont.fila)} />
                    <Mini label="Descadastros" valor={formatNumber(cont.descadastros)} />
                  </>
                ) : (
                  <>
                    <Mini label="Entrega" valor={formatPercent(taxaEntrega(sintetica))} />
                    <Mini label="Abertura" valor={formatPercent(taxaAbertura(sintetica))} />
                    <Mini label="Cliques" valor={formatPercent(taxaClique(sintetica))} />
                  </>
                )}
              </div>

              {/* Funil (e-mail) */}
              {!isWhats && (
                <div className="mt-5 rounded-2xl bg-white p-4 shadow-card">
                  <h3 className="mb-3 text-sm font-bold text-ink">Funil de engajamento</h3>
                  <Funil etapas={funil} />
                  <div className="mt-3 flex flex-wrap gap-4 border-t border-black/[0.05] pt-3 text-xs text-ink-muted">
                    <span>Falhas: <strong className="text-red-600">{formatNumber(cont.falhas)}</strong></span>
                    <span>Descadastros: <strong className="text-ink-soft">{formatNumber(cont.descadastros)}</strong></span>
                    {horario && <span className="flex items-center gap-1"><IcoClock /> Melhor horário de abertura: <strong className="text-ink-soft">{horario.hora}h</strong></span>}
                  </div>
                </div>
              )}

              {/* WhatsApp: links em lote (degrade) */}
              {isWhats && (
                <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-ink">Links de WhatsApp ({formatNumber(envios.length)})</h3>
                    {cont.fila > 0 && <button onClick={marcarEnviados} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"><IcoCheck /> Marcar {formatNumber(cont.fila)} como enviados</button>}
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">Sem API conectada, abra cada conversa já com a mensagem personalizada pronta para enviar.</p>
                  <div className="mt-3 max-h-44 space-y-1.5 overflow-y-auto">
                    {envios.slice(0, 100).map((e) => {
                      const link = waLink(e.contato, interpolar(campanha.corpo, e.vars || {}));
                      return (
                        <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-ink-soft">{e.nome || e.contato}</span>
                          {link
                            ? <a href={link} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700">Abrir 💬</a>
                            : <span className="text-xs text-ink-muted">sem número</span>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Lista de destinatários */}
              <div className="mt-5">
                <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-ink"><IcoUsers /> Destinatários</h3>
                {envios.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-black/10 bg-white py-8 text-center text-sm text-ink-muted">Nenhum destinatário na fila.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border border-black/[0.06]">
                    {envios.slice(0, 200).map((e, i) => (
                      <div key={e.id} className={`flex items-center justify-between gap-3 px-3 py-2 text-sm ${i % 2 ? 'bg-black/[0.015]' : 'bg-white'}`}>
                        <div className="min-w-0">
                          <div className="truncate font-medium text-ink">{e.nome || '—'}</div>
                          <div className="truncate text-xs text-ink-muted">{e.contato}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          {e.enviado_em && <span className="hidden text-xs text-ink-muted sm:block">{formatDateTime(e.enviado_em)}</span>}
                          <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${ENVIO_STATUS[e.status]?.cls || ''}`}>{ENVIO_STATUS[e.status]?.label || e.status}</span>
                        </div>
                      </div>
                    ))}
                    {envios.length > 200 && <div className="bg-white px-3 py-2 text-center text-xs text-ink-muted">+{formatNumber(envios.length - 200)} destinatários</div>}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl bg-black/[0.02] p-3 text-center">
      <div className="text-xl font-bold text-ink">{valor}</div>
      <div className="mt-0.5 text-xs text-ink-muted">{label}</div>
    </div>
  );
}

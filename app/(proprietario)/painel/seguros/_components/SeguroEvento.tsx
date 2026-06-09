'use client';

// Aba "Por evento" — vincula apólices de RC/acidentes a um evento, checa as
// exigências de seguro pelo tipo de evento (semáforo coberto/descoberto) e
// calcula o custo de seguro que recai sobre o evento (prêmio dedicado + rateio
// das apólices gerais). A checagem de exigências é uma biblioteca local
// (degrade) enquanto o módulo Licenças não existe.

import { useMemo, useState } from 'react';
import { formatMoney, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Seguro,
  escopoLabel, escopoCor, ESCOPO_BY, SITUACAO_META,
  situacao, checarExigenciasEvento, rateioPremioEvento, eventoLabel,
  salvarSeguro, selCls,
} from '../_lib';
import type { SegurosBag } from './shared';
import {
  EmptyState, Chip, btnPrimary, btnSecondary,
  IcoCalendar, IcoShield, IcoCheck, IcoAlert, IcoLink, IcoMoney, IcoBuilding,
} from './ui';

export default function SeguroEvento({ bag }: { bag: SegurosBag }) {
  const toast = useToast();
  const { eventos, seguros, hoje } = bag;
  const [eventoId, setEventoId] = useState<string>(eventos[0]?.id ?? '');

  const evento = useMemo(() => eventos.find((e) => e.id === eventoId) ?? null, [eventos, eventoId]);

  // Apólices dedicadas ao evento (vínculo direto).
  const dedicadas = useMemo(() => seguros.filter((s) => s.evento_id === eventoId), [seguros, eventoId]);
  // Apólices gerais (patrimonial/rc/frota/equipamento) que se sobrepõem ao período.
  const gerais = useMemo(() => {
    if (!evento) return [] as { seguro: Seguro; rateio: number }[];
    return seguros
      .filter((s) => !s.evento_id && (s.escopo === 'patrimonial' || s.escopo === 'rc' || s.escopo === 'frota' || s.escopo === 'equipamento'))
      .map((s) => ({ seguro: s, rateio: rateioPremioEvento(s, evento.data_inicio, evento.data_fim) ?? 0 }))
      .filter((x) => x.rateio > 0);
  }, [seguros, evento]);

  const exigencias = useMemo(() => {
    if (!evento) return [];
    const lista = dedicadas.map((s) => ({ ...s, id: s.id }));
    return checarExigenciasEvento(evento.tipo_evento, lista, hoje);
  }, [evento, dedicadas, hoje]);

  const custoDedicado = useMemo(() => dedicadas.reduce((a, s) => a + s.premio_num, 0), [dedicadas]);
  const custoRateio = useMemo(() => gerais.reduce((a, x) => a + x.rateio, 0), [gerais]);
  const custoTotal = custoDedicado + custoRateio;

  if (eventos.length === 0) {
    return (
      <EmptyState icon={<IcoCalendar />} title="Nenhum evento para segurar ainda"
        cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
        Cadastre um evento em <strong>Clientes</strong> ou <strong>Leads</strong> (com tipo e data) e ele aparece aqui para receber apólices de RC, acidentes e o rateio do seguro patrimonial.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Seletor de evento */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoCalendar /></span>
        <div className="min-w-0 flex-1">
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none">
            {eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>
            ))}
          </select>
        </div>
        {evento?.tipo_evento && (
          <div className="hidden shrink-0 text-right sm:block">
            <div className="text-[0.7rem] text-ink-muted">Tipo</div>
            <div className="text-sm font-bold text-ink">{evento.tipo_evento}</div>
          </div>
        )}
      </div>

      {evento && (
        <>
          {/* Exigências (semáforo) */}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-1 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">Exigências de seguro</h3>
              <span className="text-[0.7rem] text-ink-muted">estimadas pelo tipo de evento</span>
            </div>
            <p className="mb-3 text-xs text-ink-muted">Enquanto o módulo Licenças não refina por porte, usamos uma biblioteca por tipo de evento. Confira com o órgão e o contratante.</p>
            <div className="space-y-2">
              {exigencias.map((x, i) => {
                const ok = x.cobertaPor != null && x.vigente;
                const parcial = x.cobertaPor != null && !x.vigente;
                const c = ok
                  ? { box: 'border-emerald-200 bg-emerald-50/50', icon: 'text-emerald-600', label: 'text-emerald-700', texto: 'Coberto' }
                  : parcial
                    ? { box: 'border-amber-200 bg-amber-50/50', icon: 'text-amber-600', label: 'text-amber-700', texto: 'Apólice vencida' }
                    : { box: 'border-red-200 bg-red-50/40', icon: 'text-red-600', label: 'text-red-700', texto: 'Descoberto' };
                return (
                  <div key={i} className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${c.box}`}>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={c.icon}>{ok ? <IcoCheck /> : <IcoAlert />}</span>
                        <span className="font-semibold text-ink">{x.exigencia.label}</span>
                        {x.exigencia.obrigatorio ? <Chip className="bg-red-50 text-red-700">obrigatório</Chip> : <Chip className="bg-black/[0.04] text-ink-soft">recomendado</Chip>}
                      </div>
                      <div className="mt-0.5 text-xs text-ink-muted">{x.exigencia.motivo}</div>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${c.label}`}>{c.texto}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custo de seguro do evento */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs text-ink-muted"><IcoShield /> Apólices dedicadas</div>
              <div className="mt-1.5 text-lg font-bold text-ink">{formatMoney(custoDedicado)}</div>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs text-ink-muted"><IcoBuilding /> Rateio das gerais</div>
              <div className="mt-1.5 text-lg font-bold text-ink">{formatMoney(custoRateio)}</div>
            </div>
            <div className="rounded-2xl bg-brand-50 p-4 shadow-card">
              <div className="flex items-center gap-2 text-xs font-semibold text-brand"><IcoMoney /> Custo de seguro do evento</div>
              <div className="mt-1.5 text-lg font-bold text-brand">{formatMoney(custoTotal)}</div>
            </div>
          </div>

          {/* Apólices vinculadas + vincular */}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-ink">Apólices do evento</h3>
              <VincularApolice bag={bag} eventoId={eventoId}
                onVinculado={async () => { await bag.recarregar(); toast.success('Apólice vinculada ao evento.'); }}
                onErro={() => toast.error('Não foi possível vincular.')} />
            </div>
            {dedicadas.length === 0 ? (
              <p className="text-sm text-ink-muted">Nenhuma apólice dedicada a este evento. Vincule uma existente ou crie em <strong>Carteira</strong>.</p>
            ) : (
              <div className="space-y-2">
                {dedicadas.map((s) => {
                  const sit = situacao(s, hoje);
                  return (
                    <div key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-black/[0.06] px-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: escopoCor(s.escopo) }} />
                        <span className="truncate font-medium text-ink">{s.seguradora || escopoLabel(s.escopo)}</span>
                        <Chip className={ESCOPO_BY[s.escopo]?.chip || 'bg-black/[0.04] text-ink-soft'}>{escopoLabel(s.escopo)}</Chip>
                        <Chip className={SITUACAO_META[sit].chip}>{SITUACAO_META[sit].label}</Chip>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="text-sm font-semibold text-ink">{formatMoney(s.premio_num)}</span>
                        <button onClick={async () => { const r = await salvarSeguro(s.id, { evento_id: null }); if (r.error) toast.error('Falha ao desvincular.'); else { await bag.recarregar(); toast.success('Apólice desvinculada.'); } }}
                          className="text-xs font-medium text-ink-muted hover:text-red-600">Desvincular</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {gerais.length > 0 && (
              <div className="mt-3 border-t border-black/[0.06] pt-3">
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-muted">Cobertura geral rateada</div>
                <div className="space-y-1.5">
                  {gerais.map(({ seguro: s, rateio }) => (
                    <div key={s.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2 text-ink-soft">
                        <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: escopoCor(s.escopo) }} />
                        <span className="truncate">{s.seguradora || escopoLabel(s.escopo)} · {escopoLabel(s.escopo)}</span>
                      </span>
                      <span className="shrink-0 font-medium text-ink">{formatMoney(rateio)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Vincular apólice existente ao evento ────────────────────────────────────
function VincularApolice({ bag, eventoId, onVinculado, onErro }: {
  bag: SegurosBag; eventoId: string; onVinculado: () => Promise<void>; onErro: () => void;
}) {
  const { seguros } = bag;
  const [aberto, setAberto] = useState(false);
  const [sel, setSel] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Candidatas: apólices de escopo de evento ainda sem vínculo (ou de outro evento).
  const candidatas = seguros.filter((s) => (s.escopo === 'evento' || s.escopo === 'acidentes') && s.evento_id !== eventoId);

  if (!aberto) {
    return <button onClick={() => setAberto(true)} className={btnSecondary}><IcoLink /> Vincular apólice</button>;
  }
  return (
    <div className="flex items-center gap-2">
      <select value={sel} onChange={(e) => setSel(e.target.value)} className={selCls}>
        <option value="">Selecione…</option>
        {candidatas.map((s) => <option key={s.id} value={s.id}>{s.seguradora || 'Apólice'} · {escopoLabel(s.escopo)}{s.apolice ? ` · ${s.apolice}` : ''}</option>)}
      </select>
      <button disabled={!sel || salvando} onClick={async () => {
        setSalvando(true);
        const r = await salvarSeguro(sel, { evento_id: eventoId });
        setSalvando(false);
        if (r.error) onErro(); else { setAberto(false); setSel(''); await onVinculado(); }
      }} className={btnPrimary}>{salvando ? '…' : 'Vincular'}</button>
      <button onClick={() => setAberto(false)} className="text-sm text-ink-muted hover:text-ink">Cancelar</button>
    </div>
  );
}

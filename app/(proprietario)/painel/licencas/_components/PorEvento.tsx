'use client';

// Licenças por evento — ao planejar um evento, aplica o CHECKLIST por tipo/porte
// (filtrado pelo público estimado), acompanha cada exigência (status, prazo,
// protocolo, documento) e calcula a PRONTIDÃO: exigência obrigatória pendente
// bloqueia o "evento pronto" (liga com /painel/producao). CRUD via RLS; aplicar
// checklist via /api/licencas (autoritativo). Sem "R$" cru.

import { useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Licenca, type ExigenciaTemplate,
  listarTemplates, templateKeyParaTipo, exigenciasParaEvento, faixaDePublico,
  prontidaoLicencasEvento, custoLicencasEvento, statusEfetivo, STATUS_META, tipoMeta,
} from '@/lib/licencas';
import {
  type LicencasCtx, type EventoLite, type ChecklistRow,
  apiAplicarChecklist, apiLancarCusto, apiEstornarCusto, removeDocumento,
  eventoLabel, publicoEvento,
} from '../_lib';
import {
  inp, btnPrimary, btnSecondary, btnGhost, Progress, Chip, EmptyState,
  IcoPlus, IcoCalendar, IcoCheckCircle, IcoAlert, IcoExternal, IcoSparkle, IcoShield,
} from './ui';
import LicencaCard from './LicencaCard';
import LicencaModal from './LicencaModal';

type TplOpt = { id: string; nome: string; itens: ExigenciaTemplate[]; custom: boolean };

export default function PorEvento({ ctx }: { ctx: LicencasCtx }) {
  const toast = useToast();
  const { hoje } = ctx;
  const [eventoId, setEventoId] = useState<string | null>(ctx.eventos[0]?.id ?? null);
  const [modal, setModal] = useState<{ editar: Licenca | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);
  const [mostrarAplicar, setMostrarAplicar] = useState(false);

  const evento = useMemo<EventoLite | null>(() => ctx.eventos.find((e) => e.id === eventoId) || null, [ctx.eventos, eventoId]);
  const [publico, setPublico] = useState<string>('');
  const publicoNum = publico.trim() !== '' ? Math.max(0, Number(publico) || 0) : publicoEvento(evento);

  // Templates: embutidos (engine) + customizados do dono (compliance_checklists).
  const tplOpts = useMemo<TplOpt[]>(() => {
    const builtin: TplOpt[] = listarTemplates().map((t) => ({ id: `builtin:${t.key}`, nome: t.nome, itens: t.itens, custom: false }));
    const custom: TplOpt[] = ctx.checklists.map((c: ChecklistRow) => ({ id: `custom:${c.id}`, nome: `${c.nome} (meu)`, itens: c.itens, custom: true }));
    return [...builtin, ...custom];
  }, [ctx.checklists]);

  const [tplId, setTplId] = useState<string | null>(null);
  const tplSelId = tplId ?? `builtin:${templateKeyParaTipo(evento?.tipo_evento)}`;
  const tplSel = useMemo(() => tplOpts.find((t) => t.id === tplSelId) || tplOpts[0], [tplOpts, tplSelId]);
  const preview = useMemo(() => (tplSel ? exigenciasParaEvento(tplSel.itens, publicoNum) : []), [tplSel, publicoNum]);

  const eventLicencas = useMemo(
    () => ctx.licencas.filter((l) => l.escopo === 'evento' && l.evento_id === eventoId),
    [ctx.licencas, eventoId],
  );
  const pront = useMemo(() => prontidaoLicencasEvento(eventLicencas, hoje), [eventLicencas, hoje]);
  const custoEvento = useMemo(() => custoLicencasEvento(eventLicencas), [eventLicencas]);

  const aplicar = async (force: boolean) => {
    if (!evento || !tplSel) return;
    setAplicando(true);
    const r = await apiAplicarChecklist(evento.id, tplSel.itens, publicoNum, force);
    setAplicando(false);
    if (r.ok) {
      const n = (r.extra?.geradas as number) ?? 0;
      toast.success(n > 0 ? `${n} exigência(s) adicionada(s).` : 'Checklist já estava aplicado.');
      setMostrarAplicar(false);
      await ctx.reload();
    } else if (r.status === 409) {
      // Já aplicado — oferece reaplicar (aditivo).
      await aplicar(true);
    } else {
      toast.error(r.error || 'Falha ao aplicar o checklist.');
    }
  };

  const lancar = async (l: Licenca) => {
    setBusyId(l.id);
    const r = await apiLancarCusto(l.id);
    setBusyId(null);
    if (r.ok) { toast.success('Custo lançado no caixa.'); await ctx.reload(); }
    else toast.error(r.error || 'Falha ao lançar.');
  };
  const estornar = async (l: Licenca) => {
    setBusyId(l.id);
    const r = await apiEstornarCusto(l.id);
    setBusyId(null);
    if (r.ok) { toast.success('Estornado.'); await ctx.reload(); }
    else toast.error(r.error || 'Falha ao estornar.');
  };
  const excluir = async (l: Licenca) => {
    if (!window.confirm(`Excluir "${l.titulo || l.tipo}"?`)) return;
    setBusyId(l.id);
    try {
      if (l.lancamento_id) await apiEstornarCusto(l.id);
      if (l.documento_url) await removeDocumento(l.documento_url).catch(() => {});
      const { error } = await sb.from('licencas').delete().eq('id', l.id);
      if (error) throw error;
      toast.success('Exigência removida.');
      await ctx.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.');
    } finally {
      setBusyId(null);
    }
  };

  if (ctx.eventos.length === 0) {
    return (
      <EmptyState icon={<IcoCalendar />} title="Nenhum evento para licenciar ainda"
        cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
        As licenças por evento partem de um evento do CRM. Cadastre um lead/evento em <strong>Clientes</strong> ou <strong>Leads</strong> e ele aparece aqui.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor de evento + público */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoCalendar /></span>
        <div className="min-w-0 flex-1">
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
          <select value={eventoId || ''} onChange={(e) => { setEventoId(e.target.value); setPublico(''); setTplId(null); setMostrarAplicar(false); }}
            className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none">
            {ctx.eventos.map((ev) => (
              <option key={ev.id} value={ev.id}>{eventoLabel(ev)}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>
            ))}
          </select>
        </div>
        <div className="shrink-0">
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Público estimado</label>
          <input type="number" min={0} value={publico} onChange={(e) => setPublico(e.target.value)} placeholder={String(publicoEvento(evento))}
            className="mt-0.5 w-28 rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none" />
          <div className="mt-0.5 text-[0.66rem] text-ink-muted">{faixaDePublico(publicoNum)}</div>
        </div>
      </div>

      {/* Prontidão (liga com Produção) */}
      {eventLicencas.length > 0 && (
        <div className={`rounded-2xl border p-4 ${pront.bloqueia ? 'border-red-200 bg-red-50/60' : 'border-emerald-200 bg-emerald-50/60'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className={pront.bloqueia ? 'text-red-600' : 'text-emerald-600'}>{pront.bloqueia ? <IcoAlert /> : <IcoCheckCircle />}</span>
              <div>
                <div className={`text-sm font-bold ${pront.bloqueia ? 'text-red-700' : 'text-emerald-700'}`}>
                  {pront.bloqueia
                    ? `${pront.pendentes.length} exigência(s) obrigatória(s) pendente(s) — bloqueia o "evento pronto"`
                    : 'Licenciamento em ordem — evento liberado'}
                </div>
                <div className="mt-0.5 text-[0.78rem] text-ink-muted">
                  {pront.atendidas} de {pront.obrigatorias} obrigatórias atendidas
                  {custoEvento > 0 && <> · custo das licenças {formatMoney(custoEvento)}</>}
                </div>
                {pront.bloqueia && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {pront.pendentes.map((l) => (
                      <Chip key={l.id} className="bg-white text-red-700 ring-1 ring-red-200">{l.titulo || tipoMeta(l.tipo).label}</Chip>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <a href={`/painel/producao?evento=${eventoId}`} className={btnSecondary}><IcoExternal /> Abrir na Produção</a>
          </div>
          <div className="mt-3">
            <Progress value={pront.fracao} tone={pront.bloqueia ? 'vermelho' : 'verde'} />
          </div>
        </div>
      )}

      {/* Painel: aplicar checklist (sempre que vazio; senão sob demanda) */}
      {(eventLicencas.length === 0 || mostrarAplicar) && (
        <div className="rounded-2xl border border-brand/20 bg-brand-50/40 p-4">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><IcoSparkle /> Aplicar checklist por tipo/porte</div>
          <p className="mt-0.5 text-[0.8rem] text-ink-muted">
            Gera as exigências legais deste evento conforme o tipo e o público ({faixaDePublico(publicoNum)}). Você acompanha cada uma como uma licença.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select className={`${inp} w-auto`} value={tplSelId} onChange={(e) => setTplId(e.target.value)}>
              {tplOpts.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <button onClick={() => aplicar(eventLicencas.length > 0)} disabled={aplicando || preview.length === 0} className={btnPrimary}>
              {aplicando ? 'Aplicando…' : `Aplicar ${preview.length} exigência(s)`}
            </button>
            {eventLicencas.length > 0 && <button onClick={() => setMostrarAplicar(false)} className={btnGhost}>Cancelar</button>}
          </div>
          {/* Preview das exigências que serão criadas */}
          {preview.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {preview.map((i, idx) => (
                <Chip key={idx} className={i.obrigatorio ? 'bg-white text-ink-soft ring-1 ring-brand/20' : 'bg-white text-ink-muted ring-1 ring-black/10'}>
                  {i.obrigatorio && <span className="text-brand">•</span>} {i.titulo}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lista das exigências do evento */}
      {eventLicencas.length === 0 ? (
        !mostrarAplicar && (
          <EmptyState icon={<IcoShield />} title="Este evento ainda não tem licenças">
            Aplique o checklist acima para gerar as exigências, ou adicione uma licença manualmente.
          </EmptyState>
        )
      ) : (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-soft">Exigências do evento ({eventLicencas.length})</h3>
            <div className="flex items-center gap-1">
              <button onClick={() => setMostrarAplicar(true)} className={btnGhost}><IcoSparkle /> Do checklist</button>
              <button onClick={() => setModal({ editar: null })} className={btnGhost}><IcoPlus /> Manual</button>
            </div>
          </div>
          <div className="space-y-2.5">
            {[...eventLicencas]
              .sort((a, b) => Number(b.obrigatorio) - Number(a.obrigatorio) || STATUS_META[statusEfetivo(a, hoje)].ordem - STATUS_META[statusEfetivo(b, hoje)].ordem)
              .map((l) => (
                <LicencaCard
                  key={l.id} licenca={l} hoje={hoje}
                  onEdit={() => setModal({ editar: l })}
                  onDelete={() => excluir(l)}
                  onLancar={() => lancar(l)}
                  onEstornar={() => estornar(l)}
                  busy={busyId === l.id}
                />
              ))}
          </div>
        </>
      )}

      {modal && evento && (
        <LicencaModal
          userId={ctx.userId}
          escopo="evento"
          evento={evento}
          propriedades={ctx.propriedades}
          editar={modal.editar}
          onClose={() => setModal(null)}
          onSaved={ctx.reload}
        />
      )}
    </div>
  );
}

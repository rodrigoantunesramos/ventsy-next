'use client';

// Aba Dimensionamento — /painel/sst (por evento).
// Público × exigências → recursos de saúde/incêndio/segurança. O cálculo é puro
// (lib/sst.dimensionarPorPublico); aplicar persiste as linhas exigidas via
// /api/sst (idempotente). A cobertura (garantido vs. exigido) bloqueia a prontidão
// quando falta recurso OBRIGATÓRIO. O usuário ajusta status/quantidade/fornecedor
// por linha e pode adicionar recursos manuais.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatPercent } from '@/lib/format';
import {
  type SstCtx, type Toast, type RecursoRow, type RecursoTipo, type Risco,
  RECURSO_TIPOS, recursoMeta, RECURSO_STATUS_META, recursoStatusMeta,
  dimensionarPorPublico, coberturaRecursos, prontidaoEvento,
  listarRecursos, salvarRecurso, criarRecurso, excluirRecurso, aplicarDimensionamento,
  mapRecurso, eventoLabel, RISCOS, inp, selCls, exportCSV,
} from '../_lib';
import {
  Ico, Chip, Barra, EmptyState, SectionCard, Modal, Field,
  btnPrimary, btnGhost, btnSm,
} from './ui';

export default function Dimensionamento({ ctx, toast }: { ctx: SstCtx; toast: Toast }) {
  const [eventoId, setEventoId] = useState<string | null>(ctx.eventos[0]?.id ?? null);
  const evento = useMemo(() => ctx.eventos.find((e) => e.id === eventoId) || null, [ctx.eventos, eventoId]);
  const prop = useMemo(() => ctx.propriedades.find((p) => p.id === evento?.propriedade_id) || null, [ctx.propriedades, evento]);

  // Parâmetros do dimensionamento (prefill do evento/propriedade).
  const [publico, setPublico] = useState<number>(0);
  const [areaM2, setAreaM2] = useState<number | ''>('');
  const [risco, setRisco] = useState<Risco>('medio');
  const [alcool, setAlcool] = useState(false);
  const [palco, setPalco] = useState(false);

  const [rows, setRows] = useState<RecursoRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  // Reidrata parâmetros quando troca de evento.
  useEffect(() => {
    setPublico(evento?.publico || prop?.capacidade || 0);
    setAreaM2('');
    setAlcool(false); setPalco(false); setRisco('medio');
  }, [eventoId]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregar = useCallback(async (evId: string) => {
    setLoading(true);
    const { data, error } = await listarRecursos(ctx.userId, evId);
    setRows(error ? [] : (data || []).map(mapRecurso));
    setLoading(false);
  }, [ctx.userId]);

  useEffect(() => { if (eventoId) carregar(eventoId); }, [eventoId, carregar]);

  // Prévia do cálculo (antes de aplicar).
  const previa = useMemo(
    () => dimensionarPorPublico({ publico, areaM2: areaM2 === '' ? null : Number(areaM2), risco, alcool, palco }),
    [publico, areaM2, risco, alcool, palco],
  );

  // Cobertura a partir das linhas salvas (cada linha carrega exigido/obrigatório).
  const cobertura = useMemo(
    () => coberturaRecursos(rows.map((r) => ({ tipo: r.tipo, quantidade: r.exigido, obrigatorio: r.obrigatorio })), rows),
    [rows],
  );
  const prontidao = useMemo(() => prontidaoEvento(cobertura), [cobertura]);

  const aplicar = useCallback(async () => {
    if (!eventoId) return;
    if (!publico || publico <= 0) { toast.error('Informe o público estimado (> 0).'); return; }
    setAplicando(true);
    const res = await aplicarDimensionamento({
      evento_id: eventoId, publico, area_m2: areaM2 === '' ? null : Number(areaM2), risco, alcool, palco,
    });
    setAplicando(false);
    if (!res.ok) { toast.error(res.error || 'Falha ao aplicar o dimensionamento.'); return; }
    setRows(res.recursos || []);
    toast.success('Dimensionamento aplicado aos recursos do evento.');
  }, [eventoId, publico, areaM2, risco, alcool, palco, toast]);

  const patchRow = useCallback(async (id: string, patch: Partial<RecursoRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r))); // otimista
    const { error } = await salvarRecurso(id, patch as Record<string, unknown>);
    if (error) { toast.error('Não foi possível salvar a alteração.'); if (eventoId) carregar(eventoId); }
  }, [eventoId, carregar, toast]);

  const remover = useCallback(async (id: string) => {
    const { error } = await excluirRecurso(id);
    if (error) { toast.error('Não foi possível remover.'); return; }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }, [toast]);

  const adicionarManual = useCallback(async (tipo: RecursoTipo, quantidade: number, exigido: number) => {
    if (!eventoId) return;
    const { data, error } = await criarRecurso({
      usuario_id: ctx.userId, evento_id: eventoId, tipo, exigido, quantidade,
      obrigatorio: false, status: quantidade > 0 ? 'confirmado' : 'previsto', origem: 'manual',
    });
    if (error || !data) { toast.error('Não foi possível adicionar.'); return; }
    setRows((rs) => [...rs, mapRecurso(data)]);
    setAddOpen(false);
    toast.success('Recurso adicionado.');
  }, [eventoId, ctx.userId, toast]);

  const onExport = () => {
    if (!cobertura.itens.length) return;
    exportCSV(`sst-recursos-${eventoLabel(evento).slice(0, 20)}.csv`,
      ['Recurso', 'Exigido', 'Garantido', 'Falta', 'Obrigatório', 'Cobertura'],
      cobertura.itens.map((i) => [recursoMeta(i.tipo).label, i.exigido, i.garantido, i.falta, i.obrigatorio ? 'sim' : 'não', `${Math.round(i.ratio * 100)}%`]));
  };

  if (ctx.eventos.length === 0) {
    return (
      <EmptyState icon={<Ico name="calendar" size={22} />} title="Nenhum evento para dimensionar"
        cta={<a href="/painel/leads" className={btnPrimary}>Ir para Leads</a>}>
        O dimensionamento parte de um evento e do seu público. Cadastre um evento em <strong>Clientes</strong> ou <strong>Leads</strong> e ele aparece aqui.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletor de evento */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand"><Ico name="calendar" size={18} /></span>
        <div className="min-w-0 flex-1">
          <label className="block text-[0.7rem] font-semibold uppercase tracking-wide text-ink-muted">Evento</label>
          <select value={eventoId || ''} onChange={(e) => setEventoId(e.target.value)}
            className="mt-0.5 w-full max-w-md truncate rounded-lg border border-black/10 bg-white px-2.5 py-1.5 text-sm font-semibold focus:border-brand focus:outline-none">
            {ctx.eventos.map((ev) => <option key={ev.id} value={ev.id}>{eventoLabel(ev)}</option>)}
          </select>
        </div>
        {prop && <div className="hidden text-right sm:block"><div className="text-[0.7rem] text-ink-muted">Espaço</div><div className="text-sm font-bold text-ink">{prop.nome}</div></div>}
      </div>

      {/* Parâmetros + prévia */}
      <SectionCard title="Parâmetros" desc="O cálculo é uma estimativa de planejamento — confirme as exigências com o Corpo de Bombeiros/vigilância do município." icon="spark"
        actions={<button onClick={aplicar} disabled={aplicando} className={btnPrimary}><Ico name="check" size={16} />{aplicando ? 'Aplicando…' : 'Aplicar aos recursos'}</button>}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="Público">
            <input type="number" min={0} value={publico || ''} onChange={(e) => setPublico(Math.max(0, Number(e.target.value) || 0))} className={inp} />
          </Field>
          <Field label="Área (m²)" hint="opcional">
            <input type="number" min={0} value={areaM2} onChange={(e) => setAreaM2(e.target.value === '' ? '' : Math.max(0, Number(e.target.value) || 0))} className={inp} placeholder="estimar" />
          </Field>
          <Field label="Risco">
            <select value={risco} onChange={(e) => setRisco(e.target.value as Risco)} className={selCls + ' w-full'}>
              {RISCOS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </Field>
          <label className="flex items-end gap-2 pb-2.5 text-sm"><input type="checkbox" checked={alcool} onChange={(e) => setAlcool(e.target.checked)} className="h-4 w-4 rounded accent-brand" /> Bebida</label>
          <label className="flex items-end gap-2 pb-2.5 text-sm"><input type="checkbox" checked={palco} onChange={(e) => setPalco(e.target.checked)} className="h-4 w-4 rounded accent-brand" /> Palco/estrutura</label>
        </div>

        {/* Prévia das exigências calculadas */}
        {publico > 0 && (
          <div className="mt-3 rounded-xl border border-black/[0.06] bg-[#f7f7f8] p-3">
            <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-wide text-ink-muted">Exigências calculadas (prévia)</div>
            <div className="flex flex-wrap gap-1.5">
              {previa.map((e) => {
                const m = recursoMeta(e.tipo);
                return (
                  <Chip key={e.tipo} className={m.chip}>
                    <Ico name={m.icone || 'shield'} size={13} /> {e.quantidade}× {m.label}{e.obrigatorio && <span className="text-red-500">*</span>}
                  </Chip>
                );
              })}
              {previa.length === 0 && <span className="text-sm text-ink-muted">Informe o público para ver as exigências.</span>}
            </div>
            <p className="mt-2 text-[0.7rem] text-ink-muted"><span className="text-red-500">*</span> obrigatório (bloqueia a prontidão se faltar). Aplique para gravar como recursos do evento.</p>
          </div>
        )}
      </SectionCard>

      {/* Prontidão + cobertura */}
      <ProntidaoBanner prontidao={prontidao} total={cobertura.itens.length} />

      <SectionCard title="Recursos do evento" desc="Marque cada recurso como contratado/confirmado conforme garante a contratação (Compras/Logística) e a alocação (Escala)." icon="shield"
        actions={<>
          {cobertura.itens.length > 0 && <button onClick={onExport} className={btnSm}><Ico name="download" size={14} /> CSV</button>}
          <button onClick={() => setAddOpen(true)} className={btnGhost}><Ico name="plus" size={16} /> Adicionar</button>
        </>}>
        {loading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-black/[0.05]" />)}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={<Ico name="shield" size={22} />} title="Nenhum recurso ainda">
            Defina o público e clique em <strong>Aplicar aos recursos</strong> para gerar as exigências, ou adicione manualmente.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {cobertura.itens.map((item) => {
              const linhas = rows.filter((r) => r.tipo === item.tipo);
              return <RecursoLinha key={item.tipo} item={item} linhas={linhas} fornecedores={ctx.fornecedores} onPatch={patchRow} onRemove={remover} />;
            })}
          </div>
        )}
      </SectionCard>

      {addOpen && <AddRecursoModal onClose={() => setAddOpen(false)} onAdd={adicionarManual} />}
    </div>
  );
}

// ── Banner de prontidão ───────────────────────────────────────────────────────
function ProntidaoBanner({ prontidao, total }: { prontidao: ReturnType<typeof prontidaoEvento>; total: number }) {
  const pronto = prontidao.pronto;
  const ring = total === 0 ? 'border-black/10 bg-black/[0.02]' : pronto ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50';
  const dot = total === 0 ? 'bg-slate-300' : pronto ? 'bg-emerald-500' : 'bg-red-500';
  return (
    <div className={`rounded-2xl border p-4 ${ring}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${dot} text-white`}>
            <Ico name={pronto && total > 0 ? 'check' : 'shield'} size={22} />
          </span>
          <div>
            <div className="text-base font-bold text-ink">
              {total === 0 ? 'Sem recursos definidos' : pronto ? 'Pronto quanto à SST' : 'Recursos obrigatórios pendentes'}
            </div>
            <div className="mt-0.5 text-[0.78rem] text-ink-muted">
              {total === 0
                ? 'Aplique o dimensionamento para avaliar a prontidão.'
                : `Cobertura ${formatPercent(prontidao.coberturaPct)} · ${prontidao.bloqueios.length} bloqueio(s) · ${prontidao.avisos.length} aviso(s).`}
            </div>
          </div>
        </div>
        {prontidao.bloqueios.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {prontidao.bloqueios.slice(0, 4).map((b) => (
              <Chip key={b.tipo} className="bg-red-100 text-red-700">faltam {b.falta} {recursoMeta(b.tipo).label}</Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Linha de cobertura por tipo (pode agregar várias linhas do mesmo tipo) ─────
function RecursoLinha({ item, linhas, fornecedores, onPatch, onRemove }: {
  item: ReturnType<typeof coberturaRecursos>['itens'][number];
  linhas: RecursoRow[];
  fornecedores: { id: string; nome: string }[];
  onPatch: (id: string, patch: Partial<RecursoRow>) => void;
  onRemove: (id: string) => void;
}) {
  const m = recursoMeta(item.tipo);
  const tone = item.ok ? 'ok' : item.obrigatorio ? 'bad' : 'warn';
  return (
    <div className={`rounded-xl border p-3 ${item.ok ? 'border-black/[0.06]' : item.obrigatorio ? 'border-red-200 bg-red-50/40' : 'border-amber-200 bg-amber-50/40'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: m.hex + '1a', color: m.hex }}><Ico name={m.icone || 'shield'} size={16} /></span>
          <div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {m.label}{item.obrigatorio && <span className="rounded bg-red-100 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-red-700">obrigatório</span>}
            </div>
            <div className="text-[0.72rem] text-ink-muted">{item.garantido}/{item.exigido} garantidos · {m.unidade}</div>
          </div>
        </div>
        <div className="min-w-[120px] flex-1 sm:max-w-[200px]">
          <Barra ratio={item.exigido > 0 ? item.ratio : 1} tone={tone} />
        </div>
      </div>

      {/* Linhas editáveis (origem dimensionamento + manuais do mesmo tipo) */}
      <div className="mt-2.5 space-y-1.5">
        {linhas.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-white/70 px-2 py-1.5">
            <Chip className={r.origem === 'dimensionamento' ? 'bg-brand-50 text-brand' : 'bg-slate-100 text-slate-600'}>
              {r.origem === 'dimensionamento' ? 'auto' : 'manual'}
            </Chip>
            <label className="flex items-center gap-1 text-xs text-ink-muted">
              qtd
              <input type="number" min={0} value={r.quantidade}
                onChange={(e) => onPatch(r.id, { quantidade: Math.max(0, Number(e.target.value) || 0) })}
                className="w-16 rounded-lg border border-black/10 px-2 py-1 text-sm" />
            </label>
            <select value={r.status} onChange={(e) => onPatch(r.id, { status: e.target.value })}
              className="rounded-lg border border-black/10 bg-white px-2 py-1 text-xs">
              {(Object.keys(RECURSO_STATUS_META) as (keyof typeof RECURSO_STATUS_META)[]).map((s) => (
                <option key={s} value={s}>{recursoStatusMeta(s).label}</option>
              ))}
            </select>
            {fornecedores.length > 0 && (
              <select value={r.fornecedor_id || ''} onChange={(e) => onPatch(r.id, { fornecedor_id: e.target.value || null })}
                className="max-w-[140px] truncate rounded-lg border border-black/10 bg-white px-2 py-1 text-xs">
                <option value="">Fornecedor…</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
              </select>
            )}
            <button onClick={() => onRemove(r.id)} aria-label="Remover recurso" className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600">
              <Ico name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
      {linhas.some((r) => r.base) && <p className="mt-1.5 text-[0.68rem] italic text-ink-muted">{linhas.find((r) => r.base)?.base}</p>}
    </div>
  );
}

// ── Modal: adicionar recurso manual ───────────────────────────────────────────
function AddRecursoModal({ onClose, onAdd }: { onClose: () => void; onAdd: (tipo: RecursoTipo, quantidade: number, exigido: number) => void }) {
  const [tipo, setTipo] = useState<RecursoTipo>('brigadista');
  const [quantidade, setQuantidade] = useState(1);
  const [exigido, setExigido] = useState(0);
  return (
    <Modal open onClose={onClose} title="Adicionar recurso"
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={() => onAdd(tipo, quantidade, exigido)} className={btnPrimary}>Adicionar</button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Recurso" className="col-span-2">
          <select value={tipo} onChange={(e) => setTipo(e.target.value as RecursoTipo)} className={selCls + ' w-full'}>
            {RECURSO_TIPOS.map((r) => <option key={r.v} value={r.v}>{recursoMeta(r.v).label}</option>)}
          </select>
        </Field>
        <Field label="Quantidade (garantida)"><input type="number" min={0} value={quantidade} onChange={(e) => setQuantidade(Math.max(0, Number(e.target.value) || 0))} className={inp} /></Field>
        <Field label="Exigido" hint="0 = extra"><input type="number" min={0} value={exigido} onChange={(e) => setExigido(Math.max(0, Number(e.target.value) || 0))} className={inp} /></Field>
      </div>
    </Modal>
  );
}

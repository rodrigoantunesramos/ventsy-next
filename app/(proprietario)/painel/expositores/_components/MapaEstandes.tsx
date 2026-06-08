'use client';

// Aba "Mapa de estandes" — a planta comercial visual e clicável da feira.
// Cada estande é um retângulo posicionado no grid (posicao x,y,w,h), colorido
// pelo status. Clique seleciona → painel lateral vende/reserva/bloqueia/libera
// (via /api/expositores, autoritativo). No "modo layout" arrasta-se o estande
// para reposicionar (snap no grid, persiste via RLS). Sem "R$" hardcoded.

import { useCallback, useMemo, useRef, useState } from 'react';
import { formatMoneyShort, formatNumber, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ExpoBag, type Estande, type Expositor,
  ESTANDE_STATUS_META, estandeStatusMeta, ESTANDE_TIPOS, estandeTipoLabel,
  expositorStatusMeta, precoEstande, resumoMapa, normalizarPosicao, boundsDosEstandes, autoLayout,
  podeTransicionarEstande,
  comercializarEstande, criarEstande, salvarEstande, excluirEstande, criarExpositor, salvarPrecoM2,
  inp, selCls,
} from '../_lib';
import {
  Kpi, Progress, ModalShell, Campo, EmptyState, Chip, btnPrimary, btnSecondary,
  IcoMap, IcoBooth, IcoMoney, IcoPlus, IcoEdit, IcoTrash, IcoMove, IcoCheck, IcoX,
} from './ui';

const CELL = 76;     // px por célula do grid (1 unidade lógica = CELL px)
const GAP = 6;       // recuo interno do retângulo para "respiro" visual

export default function MapaEstandes({ bag }: { bag: ExpoBag }) {
  const toast = useToast();
  const { estandes, expositores, precoM2 } = bag;
  const expositorById = useMemo(() => new Map(expositores.map((e) => [e.id, e])), [expositores]);

  const [editMode, setEditMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editEstande, setEditEstande] = useState<Estande | null>(null);
  const [sellFor, setSellFor] = useState<{ estande: Estande; status: 'vendido' | 'reservado' } | null>(null);
  const [busy, setBusy] = useState(false);

  const resumo = useMemo(() => resumoMapa(estandes, precoM2), [estandes, precoM2]);
  const bounds = useMemo(() => boundsDosEstandes(estandes), [estandes]);
  const selected = useMemo(() => estandes.find((e) => e.id === selectedId) || null, [estandes, selectedId]);

  // ── Drag-to-reposition (modo layout) ───────────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null);

  const cellFromEvent = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.round((clientX - rect.left) / CELL - 0.5)),
      y: Math.max(0, Math.round((clientY - rect.top) / CELL - 0.5)),
    };
  }, []);

  const onPointerDownStand = (e: React.PointerEvent, est: Estande) => {
    setSelectedId(est.id);
    if (!editMode) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = normalizarPosicao(est.posicao);
    setDrag({ id: est.id, x: p.x, y: p.y });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const c = cellFromEvent(e.clientX, e.clientY);
    if (c.x !== drag.x || c.y !== drag.y) setDrag({ ...drag, x: c.x, y: c.y });
  };
  const onPointerUp = async () => {
    if (!drag) return;
    const est = estandes.find((e) => e.id === drag.id);
    const cur = drag;
    setDrag(null);
    if (!est) return;
    const p = normalizarPosicao(est.posicao);
    if (p.x === cur.x && p.y === cur.y) return;       // não moveu
    const novo = { ...p, x: cur.x, y: cur.y };
    const { error } = await salvarEstande(est.id, { posicao: novo });
    if (error) toast.error('Não foi possível salvar a posição.');
    else await bag.recarregar();
  };

  // ── Ações comerciais ───────────────────────────────────────────────────────
  const aplicarStatus = useCallback(async (est: Estande, status: string, expositorId?: string | null) => {
    setBusy(true);
    try {
      const r = await comercializarEstande(est.id, status, expositorId);
      if (!r.ok) {
        if (r.error === 'transicao_invalida') toast.error(`Libere o estande antes (está ${estandeStatusMeta(est.status).label.toLowerCase()}).`);
        else toast.error(r.error || 'Não foi possível atualizar o estande.');
        return false;
      }
      await bag.recarregar();
      return true;
    } finally { setBusy(false); }
  }, [bag, toast]);

  const onVenderOuReservar = (est: Estande, status: 'vendido' | 'reservado') => {
    // Já tem expositor vinculado? aplica direto; senão, abre o seletor.
    if (est.expositor_id) aplicarStatus(est, status, est.expositor_id);
    else setSellFor({ estande: est, status });
  };

  const onExcluir = async (est: Estande) => {
    if (!window.confirm(`Excluir o estande ${est.codigo}?`)) return;
    const { error } = await excluirEstande(est.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    setSelectedId(null);
    await bag.recarregar();
    toast.success('Estande excluído.');
  };

  const onPosicionarSoltos = async () => {
    const faltam = autoLayout(estandes, Math.max(4, bounds.cols));
    if (!faltam.length) { toast.info('Todos os estandes já estão posicionados.'); return; }
    await Promise.all(faltam.map((f) => salvarEstande(f.id, { posicao: f.posicao })));
    await bag.recarregar();
    toast.success(`${faltam.length} estande(s) posicionado(s).`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const W = bounds.cols * CELL;
  const H = bounds.rows * CELL;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Estandes" value={formatNumber(resumo.total)} tone="ink" icon={<IcoBooth />}
          sub={`${formatNumber(resumo.disponiveis)} disponíveis · ${formatNumber(resumo.bloqueados)} bloqueados`} />
        <Kpi label="Vendidos" value={formatNumber(resumo.vendidos)} tone="brand" icon={<IcoCheck />}
          sub={`${formatNumber(resumo.reservados)} reservados`} />
        <Kpi label="Mapa comercializado" value={formatPercent(resumo.pctVendidoArea)} tone="roxo" icon={<IcoMap />}
          sub={`${formatPercent(resumo.pctVendidoContagem)} por contagem`} />
        <Kpi label="Receita de estandes" value={formatMoneyShort(resumo.receitaVendida)} tone="verde" icon={<IcoMoney />}
          sub={`+ ${formatMoneyShort(resumo.receitaReservada)} reservado`} />
      </div>

      {/* Barra de ferramentas */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-3 shadow-card">
        <button onClick={() => setShowAdd(true)} className={btnPrimary}><IcoPlus /> Novo estande</button>
        <button onClick={() => setEditMode((v) => !v)} className={`${btnSecondary} ${editMode ? 'border-brand text-brand' : ''}`}>
          <IcoMove /> {editMode ? 'Concluir layout' : 'Editar layout'}
        </button>
        {editMode && <button onClick={onPosicionarSoltos} className={btnSecondary}>Posicionar soltos</button>}
        <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">
          Preço por m²
          <input type="number" min={0} defaultValue={precoM2 || ''} placeholder="0"
            onChange={(e) => { const v = Math.max(0, Number(e.target.value) || 0); bag.setPrecoM2(v); salvarPrecoM2(bag.evento.id, v); }}
            className="w-28 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
        </label>
      </div>

      {estandes.length === 0 ? (
        <EmptyState icon={<IcoBooth />} title="Monte o mapa da feira"
          cta={<button onClick={() => setShowAdd(true)} className={btnPrimary}><IcoPlus /> Adicionar primeiro estande</button>}>
          Cadastre os estandes (código, metragem e preço). Eles aparecem aqui no mapa para você vender, reservar ou bloquear visualmente.
        </EmptyState>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          {/* Planta SVG */}
          <div className="overflow-auto rounded-2xl border border-black/[0.06] bg-[#fafafa] p-3 shadow-card">
            <svg
              ref={svgRef} width={W} height={H} className="touch-none select-none"
              onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
              role="group" aria-label="Mapa de estandes"
            >
              {/* grade */}
              {Array.from({ length: bounds.cols + 1 }).map((_, i) => (
                <line key={`v${i}`} x1={i * CELL} y1={0} x2={i * CELL} y2={H} stroke="#00000010" strokeWidth={1} />
              ))}
              {Array.from({ length: bounds.rows + 1 }).map((_, i) => (
                <line key={`h${i}`} x1={0} y1={i * CELL} x2={W} y2={i * CELL} stroke="#00000010" strokeWidth={1} />
              ))}
              {/* estandes */}
              {estandes.map((est) => {
                const isDragging = drag?.id === est.id;
                const p = normalizarPosicao(est.posicao);
                const px = (isDragging ? drag!.x : p.x) * CELL + GAP;
                const py = (isDragging ? drag!.y : p.y) * CELL + GAP;
                const w = p.w * CELL - GAP * 2;
                const h = p.h * CELL - GAP * 2;
                const meta = estandeStatusMeta(est.status);
                const fill = est.cor || meta.hex;
                const sel = est.id === selectedId;
                const exp = est.expositor_id ? expositorById.get(est.expositor_id) : null;
                return (
                  <g key={est.id} onPointerDown={(e) => onPointerDownStand(e, est)}
                    className={editMode ? 'cursor-move' : 'cursor-pointer'} opacity={isDragging ? 0.85 : 1}>
                    <rect x={px} y={py} width={w} height={h} rx={10}
                      fill={fill} fillOpacity={est.status === 'disponivel' ? 0.16 : 0.9}
                      stroke={sel ? '#0d0d0d' : fill} strokeWidth={sel ? 2.5 : 1.5} />
                    <text x={px + 8} y={py + 18} fontSize={12} fontWeight={700}
                      fill={est.status === 'disponivel' ? '#0d0d0d' : '#fff'}>{est.codigo}</text>
                    {est.area_m2 != null && (
                      <text x={px + 8} y={py + 33} fontSize={10}
                        fill={est.status === 'disponivel' ? '#6b7280' : '#ffffffcc'}>{formatNumber(est.area_m2)} m²</text>
                    )}
                    {exp && h > 50 && (
                      <text x={px + 8} y={py + h - 8} fontSize={9.5} fill={est.status === 'disponivel' ? '#6b7280' : '#ffffffdd'}>
                        {exp.empresa.length > 16 ? exp.empresa.slice(0, 15) + '…' : exp.empresa}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Painel lateral / legenda */}
          <div className="space-y-3">
            {selected ? (
              <StandPanel
                est={selected} exp={selected.expositor_id ? expositorById.get(selected.expositor_id) || null : null}
                precoM2={precoM2} busy={busy}
                onVender={() => onVenderOuReservar(selected, 'vendido')}
                onReservar={() => onVenderOuReservar(selected, 'reservado')}
                onBloquear={() => aplicarStatus(selected, 'bloqueado')}
                onLiberar={() => aplicarStatus(selected, 'disponivel')}
                onEditar={() => setEditEstande(selected)}
                onExcluir={() => onExcluir(selected)}
                onFechar={() => setSelectedId(null)}
              />
            ) : (
              <div className="rounded-2xl bg-white p-4 text-sm text-ink-muted shadow-card">
                Clique em um estande no mapa para vender, reservar ou bloquear.
              </div>
            )}
            <Legenda />
          </div>
        </div>
      )}

      {showAdd && <StandFormModal bag={bag} onClose={() => setShowAdd(false)} />}
      {editEstande && <StandFormModal bag={bag} est={editEstande} onClose={() => setEditEstande(null)} />}
      {sellFor && (
        <SellModal
          bag={bag} estande={sellFor.estande} status={sellFor.status}
          onClose={() => setSellFor(null)}
          onConfirm={async (expositorId) => {
            const ok = await aplicarStatus(sellFor.estande, sellFor.status, expositorId);
            if (ok) setSellFor(null);
          }}
        />
      )}
    </div>
  );
}

// ── Painel do estande selecionado ──────────────────────────────────────────────
function StandPanel({ est, exp, precoM2, busy, onVender, onReservar, onBloquear, onLiberar, onEditar, onExcluir, onFechar }: {
  est: Estande; exp: Expositor | null; precoM2: number; busy: boolean;
  onVender: () => void; onReservar: () => void; onBloquear: () => void; onLiberar: () => void;
  onEditar: () => void; onExcluir: () => void; onFechar: () => void;
}) {
  const meta = estandeStatusMeta(est.status);
  const preco = precoEstande(est, precoM2);
  const can = (to: string) => podeTransicionarEstande(est.status, to);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-lg font-bold text-ink">{est.codigo}</div>
          <div className="text-xs text-ink-muted">{estandeTipoLabel(est.tipo)}{est.area_m2 != null ? ` · ${formatNumber(est.area_m2)} m²` : ''}</div>
        </div>
        <Chip className={meta.chip}>{meta.label}</Chip>
      </div>
      <div className="mt-3 rounded-xl bg-black/[0.03] px-3 py-2">
        <div className="text-[0.7rem] text-ink-muted">Preço do ponto</div>
        <div className="text-base font-bold text-ink">{formatMoneyShort(preco)}</div>
      </div>
      {exp && (
        <div className="mt-3 rounded-xl border border-black/[0.06] px-3 py-2">
          <div className="text-[0.7rem] text-ink-muted">Expositor</div>
          <div className="text-sm font-semibold text-ink">{exp.empresa}</div>
          <Chip className={`mt-1 ${expositorStatusMeta(exp.status).chip}`}>{expositorStatusMeta(exp.status).label}</Chip>
        </div>
      )}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {can('vendido') && <button disabled={busy} onClick={onVender} className={btnPrimary}>Vender</button>}
        {can('reservado') && <button disabled={busy} onClick={onReservar} className={btnSecondary}>Reservar</button>}
        {can('disponivel') && est.status !== 'disponivel' && <button disabled={busy} onClick={onLiberar} className={btnSecondary}>Liberar</button>}
        {can('bloqueado') && <button disabled={busy} onClick={onBloquear} className={btnSecondary}>Bloquear</button>}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-black/[0.06] pt-3">
        <button onClick={onEditar} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-soft hover:text-brand"><IcoEdit /> Editar</button>
        <button onClick={onExcluir} className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-700"><IcoTrash /> Excluir</button>
        <button onClick={onFechar} className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-ink"><IcoX /> Fechar</button>
      </div>
    </div>
  );
}

function Legenda() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Legenda</div>
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(ESTANDE_STATUS_META).map(([k, m]) => (
          <div key={k} className="flex items-center gap-2 text-sm">
            <span className="h-3.5 w-3.5 rounded" style={{ background: m.hex, opacity: k === 'disponivel' ? 0.3 : 1 }} />
            <span className="text-ink-soft">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Modal: criar/editar estande ────────────────────────────────────────────────
function StandFormModal({ bag, est, onClose }: { bag: ExpoBag; est?: Estande; onClose: () => void }) {
  const toast = useToast();
  const editing = !!est;
  const [codigo, setCodigo] = useState(est?.codigo || '');
  const [tipo, setTipo] = useState(String(est?.tipo || 'standard'));
  const [area, setArea] = useState(est?.area_m2 != null ? String(est.area_m2) : '');
  const [preco, setPreco] = useState(est?.preco_num != null ? String(est.preco_num) : '');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!codigo.trim()) { toast.error('Informe o código do estande.'); return; }
    setSaving(true);
    try {
      const payload = {
        codigo: codigo.trim(), tipo,
        area_m2: area ? Number(area) : null,
        preco_num: preco ? Number(preco) : null,
      };
      if (editing && est) {
        const { error } = await salvarEstande(est.id, payload);
        if (error) throw error;
      } else {
        // posição: próxima célula livre num grid de ~6 colunas
        const place = autoLayout([...bag.estandes, { ...emptyEstande(), id: '__new__' }], 6).find((p) => p.id === '__new__');
        const { error } = await criarEstande({
          ...payload, usuario_id: bag.userId, evento_id: bag.evento.id, status: 'disponivel',
          posicao: place?.posicao || { x: 0, y: 0, w: 1, h: 1 },
        });
        if (error) throw error;
      }
      await bag.recarregar();
      toast.success(editing ? 'Estande atualizado.' : 'Estande criado.');
      onClose();
    } catch (e) {
      toast.error(extractMsg(e) || 'Não foi possível salvar.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-ink">{editing ? 'Editar estande' : 'Novo estande'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Código"><input value={codigo} onChange={(e) => setCodigo(e.target.value)} className={inp} placeholder="A1, Ilha 3…" /></Campo>
        <Campo label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={`${selCls} w-full`}>
            {ESTANDE_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Área (m²)"><input type="number" min={0} value={area} onChange={(e) => setArea(e.target.value)} className={inp} placeholder="9" /></Campo>
        <Campo label="Preço do ponto" hint="Deixe vazio para calcular por m²."><input type="number" min={0} value={preco} onChange={(e) => setPreco(e.target.value)} className={inp} placeholder="—" /></Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button disabled={saving} onClick={submit} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

// ── Modal: vender/reservar — escolher ou criar o expositor ─────────────────────
function SellModal({ bag, estande, status, onClose, onConfirm }: {
  bag: ExpoBag; estande: Estande; status: 'vendido' | 'reservado';
  onClose: () => void; onConfirm: (expositorId: string) => void;
}) {
  const toast = useToast();
  const livres = useMemo(() => bag.expositores.filter((e) => e.status !== 'cancelado'), [bag.expositores]);
  const [expositorId, setExpositorId] = useState<string>(livres[0]?.id || '');
  const [novoNome, setNovoNome] = useState('');
  const [criando, setCriando] = useState(livres.length === 0);
  const [saving, setSaving] = useState(false);
  const verbo = status === 'vendido' ? 'Vender' : 'Reservar';

  const confirmar = async () => {
    setSaving(true);
    try {
      let id = expositorId;
      if (criando) {
        if (!novoNome.trim()) { toast.error('Informe o nome da empresa.'); setSaving(false); return; }
        const { data, error } = await criarExpositor({
          usuario_id: bag.userId, evento_id: bag.evento.id, empresa: novoNome.trim(), status: 'proposta',
        });
        if (error || !data) { toast.error('Não foi possível criar o expositor.'); setSaving(false); return; }
        id = data.id;
        await bag.recarregar();
      }
      if (!id) { toast.error('Selecione um expositor.'); setSaving(false); return; }
      onConfirm(id);
    } finally { setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-md">
      <h3 className="mb-1 text-lg font-bold text-ink">{verbo} estande {estande.codigo}</h3>
      <p className="mb-4 text-sm text-ink-muted">Vincule a marca/empresa que vai ocupar o ponto.</p>
      {livres.length > 0 && !criando && (
        <Campo label="Expositor">
          <select value={expositorId} onChange={(e) => setExpositorId(e.target.value)} className={`${selCls} w-full`}>
            {livres.map((e) => <option key={e.id} value={e.id}>{e.empresa}</option>)}
          </select>
        </Campo>
      )}
      {criando && (
        <Campo label="Nova empresa"><input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} className={inp} placeholder="Nome da marca/empresa" autoFocus /></Campo>
      )}
      <button onClick={() => setCriando((v) => !v)} className="mt-2 text-xs font-semibold text-brand hover:underline">
        {criando ? (livres.length ? '← Escolher um expositor existente' : '') : '+ Cadastrar novo expositor'}
      </button>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button disabled={saving} onClick={confirmar} className={btnPrimary}>{saving ? '…' : verbo}</button>
      </div>
    </ModalShell>
  );
}

// ── helpers locais ─────────────────────────────────────────────────────────────
function emptyEstande(): Estande {
  return { id: '', evento_id: null, codigo: '', tipo: 'standard', area_m2: null, preco_num: null, status: 'disponivel', expositor_id: null, posicao: null, cor: null };
}
function extractMsg(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message || '');
  return '';
}

'use client';

// Aba "Editor" — canvas SVG para desenhar um arranjo: paleta de elementos
// (mesas/palco/bar/pista/estande…), arraste para posicionar, geração automática
// por setup e CÁLCULO DE CAPACIDADE ao vivo (lugares × área × autorizada). Salva
// o layout (via RLS). Critério de aceite: capacidade por setup correta + o editor
// salva os elementos. Sem "R$" hardcoded.

import { useMemo, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Layout, type Elemento, type ElementoTipo, type PropLite, type EspacoLite,
  SETUPS, paletaElementos, elementoMeta, ELEMENTOS,
  gerarArranjo, checarCapacidade, lugaresDaPlanta, clampElemento,
  layoutParaRow, criarLayout, salvarLayout, mapLayout, isMissingTable,
} from '../_lib';
import {
  Campo, Kpi, Progress, btnPrimary, btnSecondary, inp, selCls,
  NIVEL_CAP, NIVEL_DENS,
  IcoTrash, IcoSparkle, IcoChevron, IcoTable, IcoRuler, IcoExpand,
} from './ui';
import PlantaCanvas from './PlantaCanvas';

type Props = {
  userId: string;
  propriedades: PropLite[];
  espacos: EspacoLite[];
  layout: Layout;                         // rascunho (novo) ou existente
  onSaved: (l: Layout) => void;
  onVoltar: () => void;
  onSetupMissing: () => void;
};

function nextElId(itens: Elemento[]): string {
  let max = 0;
  for (const el of itens) { const m = /(\d+)$/.exec(el.id); if (m) max = Math.max(max, Number(m[1])); }
  return `el_${max + 1}`;
}

export default function Editor({ userId, propriedades, espacos, layout, onSaved, onVoltar, onSetupMissing }: Props) {
  const toast = useToast();
  const [draft, setDraft] = useState<Layout>(layout);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const sujo = useRef(false);
  const setDraftDirty = (fn: (d: Layout) => Layout) => { sujo.current = true; setDraft(fn); };

  const espacosDaProp = useMemo(
    () => espacos.filter((e) => draft.propriedade_id == null || e.propriedade_id === draft.propriedade_id),
    [espacos, draft.propriedade_id],
  );
  const selecionado = draft.planta.itens.find((e) => e.id === selectedId) || null;

  const cap = useMemo(
    () => checarCapacidade({ lugares: lugaresDaPlanta(draft.planta), capacidade: draft.capacidade, areaM2: draft.area_m2, setup: draft.tipo_setup }),
    [draft.planta, draft.capacidade, draft.area_m2, draft.tipo_setup],
  );

  // ── Mutações da planta ──────────────────────────────────────────────────────
  function setItens(fn: (itens: Elemento[]) => Elemento[]) {
    setDraftDirty((d) => ({ ...d, planta: { ...d.planta, itens: fn(d.planta.itens) } }));
  }
  function addElemento(tipo: ElementoTipo) {
    const m = ELEMENTOS[tipo];
    const id = nextElId(draft.planta.itens);
    const el: Elemento = clampElemento({
      id, tipo, w: m.w, h: m.h, rotacao: 0, rotulo: m.assento ? `Mesa ${draft.planta.itens.filter((i) => i.tipo === tipo).length + 1}` : m.label,
      lugares: m.assento ? m.lugaresPadrao : 0,
      x: draft.planta.largura / 2 - m.w / 2, y: draft.planta.altura / 2 - m.h / 2,
    }, draft.planta);
    setItens((itens) => [...itens, el]);
    setSelectedId(id);
  }
  function updateEl(id: string, patch: Partial<Elemento>) {
    setItens((itens) => itens.map((e) => (e.id === id ? clampElemento({ ...e, ...patch }, draft.planta) : e)));
  }
  function removeEl(id: string) {
    setItens((itens) => itens.filter((e) => e.id !== id));
    if (selectedId === id) setSelectedId(null);
  }
  function duplicarEl(id: string) {
    const el = draft.planta.itens.find((e) => e.id === id);
    if (!el) return;
    const novo = clampElemento({ ...el, id: nextElId(draft.planta.itens), x: el.x + 30, y: el.y + 30 }, draft.planta);
    setItens((itens) => [...itens, novo]);
    setSelectedId(novo.id);
  }
  function gerar() {
    const planta = gerarArranjo(draft.tipo_setup, { areaM2: draft.area_m2, capacidade: draft.capacidade, canvas: { largura: draft.planta.largura, altura: draft.planta.altura } });
    setDraftDirty((d) => ({ ...d, planta }));
    setSelectedId(null);
    toast.info(`Arranjo ${SETUPS.find((s) => s.key === draft.tipo_setup)?.label || ''} gerado com ${formatNumber(lugaresDaPlanta(planta))} lugares.`);
  }

  function onTrocarEspaco(id: number | null) {
    setDraftDirty((d) => {
      const esp = espacos.find((e) => e.id === id);
      return {
        ...d, espaco_id: id,
        area_m2: d.area_m2 ?? esp?.area_m2 ?? null,
        capacidade: d.capacidade ?? esp?.capacidade ?? null,
      };
    });
  }

  async function salvar() {
    if (!draft.nome.trim()) { toast.error('Dê um nome ao layout.'); return; }
    setSalvando(true);
    const row = layoutParaRow({ ...draft, usuario_id: draft.id ? undefined : userId });
    const res = draft.id ? await salvarLayout(draft.id, row) : await criarLayout({ ...row, usuario_id: userId });
    setSalvando(false);
    if (res.error) {
      if (isMissingTable(res.error)) { onSetupMissing(); return; }
      toast.error(res.error.message || 'Não foi possível salvar o layout.');
      return;
    }
    sujo.current = false;
    const salvo = mapLayout(res.data);
    setDraft(salvo);
    toast.success('Layout salvo.');
    onSaved(salvo);
  }

  function voltar() {
    if (sujo.current && !window.confirm('Há alterações não salvas. Sair mesmo assim?')) return;
    onVoltar();
  }

  return (
    <div className="space-y-4">
      {/* Barra superior */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
        <button onClick={voltar} className="inline-flex items-center gap-1 text-sm font-medium text-ink-muted hover:text-ink">
          <span className="rotate-180"><IcoChevron /></span> Biblioteca
        </button>
        <input
          value={draft.nome}
          onChange={(e) => setDraftDirty((d) => ({ ...d, nome: e.target.value }))}
          placeholder="Nome do layout (ex.: Salão — Banquete 120)"
          className="min-w-0 flex-1 rounded-xl border border-black/10 px-3.5 py-2.5 text-sm font-semibold focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : 'Salvar layout'}</button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Painel esquerdo */}
        <div className="space-y-4">
          {/* Meta do layout */}
          <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
            <Campo label="Propriedade">
              <select value={draft.propriedade_id ?? ''} onChange={(e) => setDraftDirty((d) => ({ ...d, propriedade_id: e.target.value ? Number(e.target.value) : null, espaco_id: null }))} className={`${selCls} w-full`}>
                <option value="">— Selecione —</option>
                {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Propriedade #${p.id}`}</option>)}
              </select>
            </Campo>
            {espacosDaProp.length > 0 && (
              <Campo label="Sub-espaço" hint="Puxa área/capacidade do espaço (Reservas).">
                <select value={draft.espaco_id ?? ''} onChange={(e) => onTrocarEspaco(e.target.value ? Number(e.target.value) : null)} className={`${selCls} w-full`}>
                  <option value="">— Espaço inteiro —</option>
                  {espacosDaProp.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </Campo>
            )}
            <Campo label="Tipo de setup">
              <select value={draft.tipo_setup} onChange={(e) => setDraftDirty((d) => ({ ...d, tipo_setup: e.target.value }))} className={`${selCls} w-full`}>
                {SETUPS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </Campo>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Área (m²)">
                <input type="number" min={0} value={draft.area_m2 ?? ''} onChange={(e) => setDraftDirty((d) => ({ ...d, area_m2: e.target.value ? Number(e.target.value) : null }))} placeholder="m²" className={inp} />
              </Campo>
              <Campo label="Capacidade aut." hint="Licença/segurança.">
                <input type="number" min={0} value={draft.capacidade ?? ''} onChange={(e) => setDraftDirty((d) => ({ ...d, capacidade: e.target.value ? Number(e.target.value) : null }))} placeholder="pessoas" className={inp} />
              </Campo>
            </div>
            <Campo label="Planta de fundo (URL)" hint="Imagem da planta baixa por trás do arranjo (opcional).">
              <input value={draft.planta_url ?? ''} onChange={(e) => setDraftDirty((d) => ({ ...d, planta_url: e.target.value || null }))} placeholder="https://…" className={inp} />
            </Campo>
            <button onClick={gerar} className={`${btnSecondary} w-full`}><IcoSparkle /> Gerar arranjo automático</button>
          </div>

          {/* Paleta */}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-2 text-[0.7rem] font-bold uppercase tracking-wide text-ink-muted">Adicionar elemento</div>
            <div className="grid grid-cols-2 gap-2">
              {paletaElementos().map(({ tipo, meta }) => (
                <button key={tipo} onClick={() => addElemento(tipo)} className="flex items-center gap-2 rounded-xl border border-black/10 px-2.5 py-2 text-left text-xs font-medium hover:bg-black/[0.03]">
                  <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: meta.cor }} />
                  <span className="truncate">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Canvas + capacidade + inspetor */}
        <div className="space-y-4">
          {/* Capacidade ao vivo */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi label="Lugares (arranjo)" value={formatNumber(cap.lugares)} tone="brand" icon={<IcoTable />} />
            <Kpi label="Capacidade aut." value={cap.capacidade != null ? formatNumber(cap.capacidade) : '—'} tone={cap.nivel === 'excedido' ? 'vermelho' : 'ink'} sub={cap.folga != null ? `${cap.folga >= 0 ? 'folga ' : 'excede '}${formatNumber(Math.abs(cap.folga))}` : 'defina o limite'} />
            <Kpi label="Recom. pela área" value={cap.recomendadoArea ? formatNumber(cap.recomendadoArea) : '—'} tone="azul" icon={<IcoRuler />} sub={draft.area_m2 ? `${formatNumber(draft.area_m2)} m²` : 'informe a área'} />
            <Kpi label="Densidade" value={cap.densidadeReal ? `${formatNumber(cap.densidadeReal, { maximumFractionDigits: 1 })} m²` : '—'} tone={cap.nivelDensidade === 'critico' ? 'vermelho' : cap.nivelDensidade === 'apertado' ? 'gold' : 'verde'} sub={NIVEL_DENS[cap.nivelDensidade]} />
          </div>
          <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-card">
            <span className={`rounded-full px-2.5 py-1 text-[0.7rem] font-semibold ${NIVEL_CAP[cap.nivel].chip}`}>{NIVEL_CAP[cap.nivel].label}</span>
            <Progress value={cap.capacidade ? cap.lugares / cap.capacidade : (cap.recomendadoArea ? cap.lugares / cap.recomendadoArea : 0)} tone={NIVEL_CAP[cap.nivel].bar} className="flex-1" />
          </div>

          {/* Canvas */}
          <div className="rounded-2xl bg-white p-3 shadow-card">
            {draft.planta.itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 py-16 text-center text-sm text-ink-muted">
                <IcoExpand />
                <p>Adicione elementos pela paleta ou clique em <strong>Gerar arranjo automático</strong>.</p>
              </div>
            ) : (
              <PlantaCanvas planta={draft.planta} plantaUrl={draft.planta_url} selectedId={selectedId} onSelect={setSelectedId} onMove={(id, x, y) => updateEl(id, { x, y })} />
            )}
          </div>

          {/* Inspetor do elemento selecionado */}
          {selecionado && (
            <div className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-bold text-ink">
                  <span className="h-3 w-3 rounded-sm" style={{ background: elementoMeta(selecionado.tipo).cor }} />
                  {elementoMeta(selecionado.tipo).label}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => duplicarEl(selecionado.id)} className="rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium hover:bg-black/[0.03]">Duplicar</button>
                  <button onClick={() => removeEl(selecionado.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"><IcoTrash /> Remover</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Campo label="Rótulo"><input value={selecionado.rotulo} onChange={(e) => updateEl(selecionado.id, { rotulo: e.target.value })} className={inp} /></Campo>
                {elementoMeta(selecionado.tipo).assento && (
                  <Campo label="Lugares"><input type="number" min={0} value={selecionado.lugares} onChange={(e) => updateEl(selecionado.id, { lugares: Math.max(0, Number(e.target.value) || 0) })} className={inp} /></Campo>
                )}
                <Campo label="Largura"><input type="number" min={8} value={Math.round(selecionado.w)} onChange={(e) => updateEl(selecionado.id, { w: Math.max(8, Number(e.target.value) || 8) })} className={inp} /></Campo>
                <Campo label="Altura"><input type="number" min={8} value={Math.round(selecionado.h)} onChange={(e) => updateEl(selecionado.id, { h: Math.max(8, Number(e.target.value) || 8) })} className={inp} /></Campo>
                <Campo label="Rotação°"><input type="number" value={selecionado.rotacao} onChange={(e) => updateEl(selecionado.id, { rotacao: Number(e.target.value) || 0 })} className={inp} /></Campo>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

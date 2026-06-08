'use client';

// Aba "Biblioteca" — todas as plantas/arranjos salvos, por espaço. KPIs, filtros,
// uma calculadora de "mesma sala em vários setups" (capacidade por arranjo) e o
// grid de cards com miniatura da planta. Criar/editar abre o Editor. Sem "R$".

import { useMemo, useState } from 'react';
import { formatNumber } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Layout, type PropLite, type EspacoLite,
  SETUPS, setupLabel, capacidadesPorArea, checarCapacidade, lugaresDaPlanta, densidade,
  propLabel, espacoLabel, excluirLayout,
} from '../_lib';
import {
  Kpi, Chip, EmptyState, btnPrimary, selCls, inp, NIVEL_CAP,
  IcoLayout, IcoPlus, IcoEdit, IcoTrash, IcoTable, IcoBuilding, IcoAlert, IcoRuler,
} from './ui';
import PlantaCanvas from './PlantaCanvas';

type Props = {
  propriedades: PropLite[];
  espacos: EspacoLite[];
  layouts: Layout[];
  onNovo: () => void;
  onEditar: (l: Layout) => void;
  onExcluido: (id: string) => void;
};

export default function Biblioteca({ propriedades, espacos, layouts, onNovo, onEditar, onExcluido }: Props) {
  const toast = useToast();
  const [fProp, setFProp] = useState<number | ''>('');
  const [fSetup, setFSetup] = useState<string>('');
  const [busca, setBusca] = useState('');
  const [areaCalc, setAreaCalc] = useState<string>(() => {
    const comArea = layouts.find((l) => l.area_m2);
    return comArea?.area_m2 ? String(comArea.area_m2) : '200';
  });
  const [excluindo, setExcluindo] = useState<string | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return layouts.filter((l) =>
      (fProp === '' || l.propriedade_id === fProp) &&
      (fSetup === '' || l.tipo_setup === fSetup) &&
      (!q || l.nome.toLowerCase().includes(q)),
    );
  }, [layouts, fProp, fSetup, busca]);

  const kpis = useMemo(() => {
    const props = new Set(layouts.map((l) => l.propriedade_id).filter((x) => x != null));
    let maior = 0, excedidos = 0;
    for (const l of layouts) {
      const lug = lugaresDaPlanta(l.planta);
      maior = Math.max(maior, lug);
      if (checarCapacidade({ lugares: lug, capacidade: l.capacidade, areaM2: l.area_m2, setup: l.tipo_setup }).nivel === 'excedido') excedidos++;
    }
    return { total: layouts.length, props: props.size, maior, excedidos };
  }, [layouts]);

  const capPorArea = useMemo(() => capacidadesPorArea(Number(areaCalc) || 0), [areaCalc]);

  async function excluir(l: Layout) {
    if (!window.confirm(`Excluir o layout "${l.nome}"?`)) return;
    setExcluindo(l.id);
    const { error } = await excluirLayout(l.id);
    setExcluindo(null);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    onExcluido(l.id);
    toast.success('Layout excluído.');
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Layouts" value={formatNumber(kpis.total)} tone="brand" icon={<IcoLayout />} />
        <Kpi label="Propriedades cobertas" value={formatNumber(kpis.props)} tone="azul" icon={<IcoBuilding />} />
        <Kpi label="Maior arranjo" value={formatNumber(kpis.maior)} tone="verde" icon={<IcoTable />} sub="lugares" />
        <Kpi label="Acima da capacidade" value={formatNumber(kpis.excedidos)} tone={kpis.excedidos ? 'vermelho' : 'cinza'} icon={<IcoAlert />} sub="revisar" />
      </div>

      {/* Calculadora de capacidade por arranjo */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><IcoRuler /> Capacidade por arranjo</div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-ink-muted">Área útil</span>
            <input type="number" min={0} value={areaCalc} onChange={(e) => setAreaCalc(e.target.value)} className="w-24 rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
            <span className="text-ink-muted">m²</span>
          </label>
        </div>
        <p className="mt-1 text-xs text-ink-muted">A mesma sala comporta públicos diferentes conforme o setup — densidade (m²/pessoa) padrão por arranjo.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {capPorArea.map((c) => (
            <div key={c.key} className="rounded-xl border border-black/[0.06] bg-[#f7f7f8] p-2.5">
              <div className="truncate text-[0.7rem] font-medium text-ink-muted" title={c.label}>{c.label}</div>
              <div className="mt-0.5 text-lg font-bold text-ink">{formatNumber(c.capacidade)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Filtros + novo */}
      <div className="flex flex-wrap items-center gap-2">
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar layout…" className={`${inp} max-w-xs`} />
        <select value={fProp} onChange={(e) => setFProp(e.target.value ? Number(e.target.value) : '')} className={selCls}>
          <option value="">Todas as propriedades</option>
          {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Propriedade #${p.id}`}</option>)}
        </select>
        <select value={fSetup} onChange={(e) => setFSetup(e.target.value)} className={selCls}>
          <option value="">Todos os setups</option>
          {SETUPS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button onClick={onNovo} className={`${btnPrimary} ml-auto`}><IcoPlus /> Novo layout</button>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <EmptyState icon={<IcoLayout />} title={layouts.length === 0 ? 'Nenhuma planta ainda' : 'Nada com esses filtros'} cta={<button onClick={onNovo} className={btnPrimary}><IcoPlus /> Criar primeiro layout</button>}>
          {layouts.length === 0
            ? 'Documente os arranjos dos seus espaços (banquete, auditório, coquetel…), com capacidade por setup e mapa de mesas — para vender e para a equipe montar.'
            : 'Ajuste a busca ou os filtros para encontrar o layout.'}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((l) => {
            const lug = lugaresDaPlanta(l.planta);
            const chk = checarCapacidade({ lugares: lug, capacidade: l.capacidade, areaM2: l.area_m2, setup: l.tipo_setup });
            const dens = densidade(l.area_m2, lug);
            return (
              <div key={l.id} className="group overflow-hidden rounded-2xl bg-white shadow-card">
                <button onClick={() => onEditar(l)} className="block w-full bg-[#f7f7f8] p-3 text-left">
                  {l.planta.itens.length > 0
                    ? <PlantaCanvas planta={l.planta} plantaUrl={l.planta_url} thumbnail className="max-h-44" />
                    : <div className="flex h-36 items-center justify-center text-sm text-ink-muted">Sem elementos — clique para desenhar</div>}
                </button>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-ink">{l.nome}</h3>
                      <p className="truncate text-xs text-ink-muted">
                        {propLabel(propriedades, l.propriedade_id)}{espacoLabel(espacos, l.espaco_id) ? ` · ${espacoLabel(espacos, l.espaco_id)}` : ''}
                      </p>
                    </div>
                    <Chip className="shrink-0 bg-brand-50 text-brand">{setupLabel(l.tipo_setup)}</Chip>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <Chip className="bg-black/[0.04] text-ink-soft"><IcoTable /> {formatNumber(lug)} lugares</Chip>
                    {l.capacidade != null && <Chip className={NIVEL_CAP[chk.nivel].chip}>aut. {formatNumber(l.capacidade)}</Chip>}
                    {dens > 0 && <Chip className="bg-black/[0.04] text-ink-soft">{formatNumber(dens, { maximumFractionDigits: 1 })} m²/pess.</Chip>}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => onEditar(l)} className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-black/10 py-2 text-xs font-semibold hover:bg-black/[0.03]"><IcoEdit /> Editar</button>
                    <button onClick={() => excluir(l)} disabled={excluindo === l.id} className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"><IcoTrash /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

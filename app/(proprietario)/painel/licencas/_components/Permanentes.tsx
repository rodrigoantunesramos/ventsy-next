'use client';

// Alvarás permanentes — licenças do ESPAÇO (escopo='permanente'): funcionamento,
// AVCB/bombeiros, sanitário, ambiental… Lista com busca/filtro, CRUD via
// LicencaModal (RLS), documento, e lançar/estornar o custo no caixa (/api/licencas).

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  type Licenca, statusEfetivo, STATUS_META, type LicencaStatus,
} from '@/lib/licencas';
import {
  type LicencasCtx, apiLancarCusto, apiEstornarCusto, removeDocumento, exportLicencasCSV,
} from '../_lib';
import {
  inp, btnPrimary, btnSecondary, EmptyState, IcoPlus, IcoSearch, IcoDownload, IcoBuilding,
} from './ui';
import LicencaCard from './LicencaCard';
import LicencaModal from './LicencaModal';

const STATUS_FILTRO: (LicencaStatus | 'todos')[] = ['todos', 'vigente', 'a_vencer', 'vencida', 'em_processo', 'nao_aplicavel'];

export default function Permanentes({ ctx }: { ctx: LicencasCtx }) {
  const toast = useToast();
  const { hoje } = ctx;
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState<LicencaStatus | 'todos'>('todos');
  const [fProp, setFProp] = useState<string>('todas');
  const [modal, setModal] = useState<{ editar: Licenca | null } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const permanentes = useMemo(() => ctx.licencas.filter((l) => l.escopo === 'permanente'), [ctx.licencas]);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return permanentes
      .filter((l) => fStatus === 'todos' || statusEfetivo(l, hoje) === fStatus)
      .filter((l) => fProp === 'todas' || String(l.propriedade_id ?? '') === fProp)
      .filter((l) => !q || `${l.titulo || ''} ${l.orgao || ''} ${l.numero || ''} ${l.tipo}`.toLowerCase().includes(q))
      .sort((a, b) => {
        const oa = STATUS_META[statusEfetivo(a, hoje)].ordem;
        const ob = STATUS_META[statusEfetivo(b, hoje)].ordem;
        return oa - ob || (a.validade || '9999').localeCompare(b.validade || '9999');
      });
  }, [permanentes, busca, fStatus, fProp, hoje]);

  const lancar = async (l: Licenca) => {
    setBusyId(l.id);
    const r = await apiLancarCusto(l.id);
    setBusyId(null);
    if (r.ok) { toast.success('Custo lançado no caixa.'); await ctx.reload(); }
    else toast.error(r.error || 'Falha ao lançar o custo.');
  };
  const estornar = async (l: Licenca) => {
    setBusyId(l.id);
    const r = await apiEstornarCusto(l.id);
    setBusyId(null);
    if (r.ok) { toast.success('Lançamento estornado.'); await ctx.reload(); }
    else toast.error(r.error || 'Falha ao estornar.');
  };
  const excluir = async (l: Licenca) => {
    if (!window.confirm(`Excluir "${l.titulo || l.tipo}"? Esta ação não pode ser desfeita.`)) return;
    setBusyId(l.id);
    try {
      if (l.lancamento_id) await apiEstornarCusto(l.id);
      if (l.documento_url) await removeDocumento(l.documento_url).catch(() => {});
      const { error } = await sb.from('licencas').delete().eq('id', l.id);
      if (error) throw error;
      toast.success('Licença excluída.');
      await ctx.reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao excluir.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
          <input className={`${inp} pl-9`} placeholder="Buscar por nome, órgão, número…" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select className={`${inp} w-auto`} value={fStatus} onChange={(e) => setFStatus(e.target.value as LicencaStatus | 'todos')}>
          {STATUS_FILTRO.map((s) => <option key={s} value={s}>{s === 'todos' ? 'Todos os status' : STATUS_META[s].label}</option>)}
        </select>
        {ctx.propriedades.length > 1 && (
          <select className={`${inp} w-auto`} value={fProp} onChange={(e) => setFProp(e.target.value)}>
            <option value="todas">Todas as propriedades</option>
            {ctx.propriedades.map((p) => <option key={p.id} value={p.id}>{ctx.propNome(p.id)}</option>)}
          </select>
        )}
        <button onClick={() => exportLicencasCSV(lista, ctx.propNome, ctx.eventoNome)} className={btnSecondary} disabled={lista.length === 0}><IcoDownload /> CSV</button>
        <button onClick={() => setModal({ editar: null })} className={btnPrimary}><IcoPlus /> Adicionar alvará</button>
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <EmptyState
          icon={<IcoBuilding />}
          title={permanentes.length === 0 ? 'Sem alvarás permanentes' : 'Nenhum resultado para o filtro'}
          cta={permanentes.length === 0 ? <button onClick={() => setModal({ editar: null })} className={btnPrimary}><IcoPlus /> Adicionar alvará</button> : undefined}
        >
          {permanentes.length === 0
            ? 'Cadastre o alvará de funcionamento, o AVCB dos bombeiros, a licença sanitária e a ambiental — com vencimento, órgão e documento.'
            : 'Ajuste a busca ou os filtros para ver as licenças.'}
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {lista.map((l) => (
            <LicencaCard
              key={l.id}
              licenca={l}
              hoje={hoje}
              propNome={ctx.propriedades.length > 1 ? ctx.propNome(l.propriedade_id) : undefined}
              onEdit={() => setModal({ editar: l })}
              onDelete={() => excluir(l)}
              onLancar={() => lancar(l)}
              onEstornar={() => estornar(l)}
              busy={busyId === l.id}
            />
          ))}
        </div>
      )}

      {modal && (
        <LicencaModal
          userId={ctx.userId}
          escopo="permanente"
          propriedades={ctx.propriedades}
          editar={modal.editar}
          onClose={() => setModal(null)}
          onSaved={ctx.reload}
        />
      )}
    </div>
  );
}

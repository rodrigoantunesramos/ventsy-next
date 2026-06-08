'use client';

// Funcionários — /painel/rh/funcionarios.
// Quadro completo (CLT fixos + freelancers) com ficha 360º e a folha reaproveitada
// do motor lib/folha (NÃO duplica a folha de /painel/equipe). Filtros, KPIs de
// custo, cards responsivos, ficha em drawer e CRUD via RLS. Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { formatMoneyShort } from '@/lib/format';
import { calcCusto, DEFAULT_CHARGES, CONTRATOS, CONTRATO_MAP, STATUS_LIST, STATUS_MAP } from '@/lib/folha';
import { tempoCasaLabel } from '@/lib/rh';
import { useRh, exportCSV, inicial, avatarCor, inp, type Funcionario } from '../_lib';
import { Kpi, Card, Chip, EmptyState, btnPrimary, btnSecondary, IcoUsers, IcoPlus, IcoDownload, IcoSearch } from '../_components/ui';
import FuncionarioForm from '../_components/FuncionarioForm';
import Ficha from '../_components/Ficha';

export default function FuncionariosPage() {
  const { userId, hoje, equipe, reloadEquipe } = useRh();
  const [fStatus, setFStatus] = useState('todos');
  const [fContrato, setFContrato] = useState('todos');
  const [fDepto, setFDepto] = useState('todos');
  const [busca, setBusca] = useState('');
  const [incluirDeslig, setIncluirDeslig] = useState(false);

  const [form, setForm] = useState<{ open: boolean; initial?: Partial<Funcionario> }>({ open: false });
  const [fichaId, setFichaId] = useState<number | null>(null);

  // Deep-link ?id= abre a ficha (usado pelos alertas/abas).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (id) setFichaId(Number(id));
  }, []);

  const departamentos = useMemo(() => [...new Set(equipe.map((e) => e.departamento).filter(Boolean))] as string[], [equipe]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return equipe.filter((e) => {
      if (!incluirDeslig && e.desligado_em) return false;
      if (fStatus !== 'todos' && e.status !== fStatus) return false;
      if (fContrato !== 'todos' && e.contrato !== fContrato) return false;
      if (fDepto !== 'todos' && e.departamento !== fDepto) return false;
      if (q && !(`${e.nome} ${e.cargo ?? ''} ${e.departamento ?? ''}`).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [equipe, incluirDeslig, fStatus, fContrato, fDepto, busca]);

  const ativos = useMemo(() => equipe.filter((e) => !e.desligado_em), [equipe]);
  const kpis = useMemo(() => {
    const folha = ativos.filter((e) => e.contrato !== 'mei').reduce((s, e) => s + e.salario, 0);
    const { encargos, custo } = ativos.reduce(
      (acc, e) => { const c = calcCusto(e.salario, e.contrato, DEFAULT_CHARGES); return { encargos: acc.encargos + c.encargos, custo: acc.custo + c.total }; },
      { encargos: 0, custo: 0 },
    );
    return { total: ativos.length, freelas: ativos.filter((e) => e.contrato === 'mei' || e.contrato === 'horista').length, folha, encargos, custo };
  }, [ativos]);

  const fichaFunc = useMemo(() => equipe.find((e) => e.id === fichaId) ?? null, [equipe, fichaId]);

  function exportar() {
    exportCSV(
      'funcionarios.csv',
      ['Nome', 'Cargo', 'Departamento', 'Contrato', 'Status', 'Admissao', 'Salario', 'Custo total'],
      filtrados.map((e) => [
        e.nome, e.cargo ?? '', e.departamento ?? '', CONTRATO_MAP[e.contrato] ?? e.contrato,
        e.desligado_em ? 'desligado' : e.status, e.admissao ?? '', e.salario, calcCusto(e.salario, e.contrato, DEFAULT_CHARGES).total,
      ]),
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Colaboradores" value={String(kpis.total)} tone="azul" icon={<IcoUsers />} />
        <Kpi label="Freelancers/horistas" value={String(kpis.freelas)} tone="roxo" />
        <Kpi label="Folha bruta" value={formatMoneyShort(kpis.folha)} tone="cinza" />
        <Kpi label="Encargos est." value={formatMoneyShort(kpis.encargos)} tone="gold" />
        <Kpi label="Custo total" value={formatMoneyShort(kpis.custo)} tone="vermelho" />
      </div>

      {/* Barra de ações */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
          <option value="todos">Status: Todos</option>
          {STATUS_LIST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>
        <select value={fContrato} onChange={(e) => setFContrato(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
          <option value="todos">Contrato: Todos</option>
          {CONTRATOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
        </select>
        {departamentos.length > 0 && (
          <select value={fDepto} onChange={(e) => setFDepto(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="todos">Depto: Todos</option>
            {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, cargo, depto…" className={`${inp} pl-9`} />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-ink-soft"><input type="checkbox" checked={incluirDeslig} onChange={(e) => setIncluirDeslig(e.target.checked)} /> desligados</label>
        <button onClick={exportar} className={btnSecondary}><IcoDownload /> CSV</button>
        <button onClick={() => setForm({ open: true })} className={btnPrimary}><IcoPlus /> Novo funcionário</button>
      </div>

      {/* Grid */}
      {filtrados.length === 0 ? (
        <EmptyState icon={<IcoUsers />} title="Nenhum funcionário com esse filtro"
          action={<button onClick={() => setForm({ open: true })} className={btnPrimary}><IcoPlus /> Novo funcionário</button>}>
          Cadastre colaboradores e freelancers da operação. A folha, os encargos e o custo real são calculados automaticamente.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtrados.map((e) => {
            const st = STATUS_MAP[e.status] ?? STATUS_LIST[0];
            const { total: custo, encargos } = calcCusto(e.salario, e.contrato, DEFAULT_CHARGES);
            return (
              <Card key={e.id} className={e.desligado_em ? 'opacity-60' : ''}>
                <button onClick={() => setFichaId(e.id)} className="flex w-full items-start gap-3 text-left">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: avatarCor(e.id) }}>{inicial(e.nome)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-ink">{e.nome}</div>
                    <div className="truncate text-xs text-ink-muted">{e.cargo ?? '—'}{e.departamento ? ` · ${e.departamento}` : ''}</div>
                  </div>
                  {e.desligado_em ? <Chip cls="bg-black/[0.06] text-ink-soft">Desligado</Chip> : <Chip cls={st.c}>{st.l}</Chip>}
                </button>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <Cel t="Contrato" v={CONTRATO_MAP[e.contrato] ?? e.contrato} />
                  <Cel t="Salário" v={e.contrato === 'mei' ? 'por evento' : formatMoneyShort(e.salario)} />
                  {e.contrato !== 'mei' && encargos > 0
                    ? <Cel t="Custo real" v={formatMoneyShort(custo)} highlight />
                    : <Cel t="Na empresa" v={tempoCasaLabel(e.admissao, hoje)} />}
                  <Cel t="Admissão" v={e.admissao ? e.admissao.split('-').reverse().join('/') : '—'} />
                </div>

                <div className="mt-3 flex border-t border-black/[0.06] pt-2 text-xs">
                  <button onClick={() => setFichaId(e.id)} className="flex-1 py-1.5 font-semibold text-ink-soft hover:text-brand">Ver ficha</button>
                  <div className="w-px bg-black/[0.06]" />
                  <button onClick={() => setForm({ open: true, initial: e })} className="flex-1 py-1.5 font-semibold text-ink-soft hover:text-brand">Editar</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {form.open && (
        <FuncionarioForm
          userId={userId}
          initial={form.initial}
          gestores={equipe}
          onClose={() => setForm({ open: false })}
          onSaved={async () => { setForm({ open: false }); await reloadEquipe(); }}
        />
      )}

      {fichaFunc && (
        <Ficha
          funcionario={fichaFunc}
          hoje={hoje}
          userId={userId}
          onClose={() => setFichaId(null)}
          onEdit={() => { setForm({ open: true, initial: fichaFunc }); setFichaId(null); }}
        />
      )}
    </div>
  );
}

function Cel({ t, v, highlight }: { t: string; v: string; highlight?: boolean }) {
  return (
    <div>
      <div className="text-ink-muted">{t}</div>
      <div className={`font-semibold ${highlight ? 'text-amber-700' : 'text-ink-soft'}`}>{v}</div>
    </div>
  );
}

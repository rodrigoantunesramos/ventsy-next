'use client';

// Ponto (visão de RH) — /painel/rh/ponto.
// Consolida JORNADA e BANCO DE HORAS por funcionário (saldo com sinal, a partir
// de rh_ausencias tipo 'banco_horas'), que integra Férias/Ausências. O registro
// de ponto ao vivo e a escala de turnos por evento (com freelancers e custo de
// mão de obra) vivem no módulo dedicado Ponto & Escala. Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/format';
import { useRh, mapAus, SEL_AUS, inp, inicial, avatarCor, type Ausencia, type Funcionario } from '../_lib';
import { Kpi, Card, EmptyState, ModalShell, Campo, btnPrimary, IcoClock, IcoPlus } from '../_components/ui';

export default function PontoPage() {
  const { userId, equipe } = useRh();
  const toast = useToast();
  const [lancamentos, setLancamentos] = useState<Ausencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<{ open: boolean; equipeId?: number }>({ open: false });

  const ativos = useMemo(() => equipe.filter((e) => !e.desligado_em), [equipe]);

  async function carregar() {
    const { data, error } = await sb.from('rh_ausencias').select(SEL_AUS).eq('usuario_id', userId).eq('tipo', 'banco_horas').order('criado_em', { ascending: false });
    setLancamentos(error ? [] : (data || []).map(mapAus));
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  // Saldo de banco de horas por funcionário.
  const saldoByFunc = useMemo(() => {
    const m = new Map<number, number>();
    for (const l of lancamentos) m.set(l.equipe_id, (m.get(l.equipe_id) ?? 0) + l.saldo);
    return m;
  }, [lancamentos]);

  const kpis = useMemo(() => {
    let aFavor = 0, devendo = 0, negativos = 0;
    for (const e of ativos) {
      const s = saldoByFunc.get(e.id) ?? 0;
      if (s > 0) aFavor += s; else if (s < 0) { devendo += s; negativos += 1; }
    }
    return { total: aFavor + devendo, aFavor, devendo: Math.abs(devendo), negativos, comJornada: ativos.filter((e) => e.jornada).length };
  }, [ativos, saldoByFunc]);

  const nomeFunc = (id: number) => equipe.find((e) => e.id === id)?.nome ?? '—';

  async function excluir(l: Ausencia) {
    if (!confirm('Remover este lançamento de banco de horas?')) return;
    await sb.from('rh_ausencias').delete().eq('id', l.id).eq('usuario_id', userId);
    setLancamentos((arr) => arr.filter((x) => x.id !== l.id));
  }

  if (loading) return <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />;
  if (ativos.length === 0) {
    return <EmptyState icon={<IcoClock />} title="Sem funcionários para apurar ponto">Cadastre colaboradores em <a href="/painel/rh/funcionarios" className="font-semibold text-brand underline">Funcionários</a> para acompanhar jornada e banco de horas.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      {/* Aviso do módulo dedicado */}
      <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
        <strong>Ponto & Escala dedicado:</strong> o registro de ponto ao vivo (check-in/out por QR), a escala de turnos por evento e o custo de mão de obra por evento ficam no módulo <span className="font-semibold">Ponto & Escala</span> (Pessoas). Aqui o RH consolida <strong>jornada</strong> e <strong>banco de horas</strong>, que alimentam Férias & Ausências.
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Banco de horas (líquido)" value={`${kpis.total > 0 ? '+' : ''}${kpis.total}h`} tone={kpis.total >= 0 ? 'verde' : 'vermelho'} icon={<IcoClock />} />
        <Kpi label="Horas a favor" value={`+${kpis.aFavor}h`} tone="verde" />
        <Kpi label="Horas devendo" value={`-${kpis.devendo}h`} tone="vermelho" hint={`${kpis.negativos} pessoa(s)`} />
        <Kpi label="Com jornada definida" value={`${kpis.comJornada}/${ativos.length}`} tone="azul" />
      </div>

      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-ink">Jornada & banco de horas</h3>
          <button onClick={() => setModal({ open: true })} className={btnPrimary}><IcoPlus /> Lançar horas</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                <th className="pb-2 font-semibold">Funcionário</th>
                <th className="pb-2 font-semibold">Jornada</th>
                <th className="pb-2 text-right font-semibold text-ink">Banco de horas</th>
                <th className="pb-2 text-right font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {ativos.map((e) => {
                const s = saldoByFunc.get(e.id) ?? 0;
                return (
                  <tr key={e.id} className="border-b border-black/[0.04]">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: avatarCor(e.id) }}>{inicial(e.nome)}</span>
                        <span className="font-semibold text-ink">{e.nome}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-ink-soft">{e.jornada || <span className="text-ink-muted">—</span>}</td>
                    <td className={`py-2.5 text-right font-bold ${s > 0 ? 'text-emerald-600' : s < 0 ? 'text-red-600' : 'text-ink'}`}>{s > 0 ? '+' : ''}{s}h</td>
                    <td className="py-2.5 text-right">
                      <button onClick={() => setModal({ open: true, equipeId: e.id })} className="text-xs font-semibold text-brand hover:underline">Lançar</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h3 className="mb-3 font-bold text-ink">Lançamentos recentes</h3>
        {lancamentos.length === 0 ? <p className="py-6 text-center text-sm text-ink-muted">Nenhum lançamento de banco de horas ainda.</p> : (
          <div className="space-y-2">
            {lancamentos.slice(0, 12).map((l) => (
              <div key={l.id} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
                <div>
                  <span className="font-medium text-ink-soft">{nomeFunc(l.equipe_id)}</span>
                  <span className="ml-2 text-xs text-ink-muted">{l.inicio ? formatDate(l.inicio, { style: 'short' }) : (l.criado_em ? formatDate(l.criado_em, { style: 'short' }) : '')}{l.obs ? ` · ${l.obs}` : ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`font-bold ${l.saldo >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{l.saldo > 0 ? '+' : ''}{l.saldo}h</span>
                  <button onClick={() => excluir(l)} aria-label="Remover" className="text-ink-muted hover:text-red-600">✕</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal.open && <BancoHorasModal userId={userId} ativos={ativos} preselect={modal.equipeId} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); carregar(); }} />}
    </div>
  );
}

function BancoHorasModal({ userId, ativos, preselect, onClose, onSaved }: { userId: string; ativos: Funcionario[]; preselect?: number; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ equipe_id: preselect ? String(preselect) : (ativos[0]?.id ? String(ativos[0].id) : ''), data: new Date().toISOString().slice(0, 10), saldo: '', obs: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function salvar() {
    if (!f.equipe_id || !f.saldo) { toast.error('Informe funcionário e horas.'); return; }
    setSaving(true);
    const { error } = await sb.from('rh_ausencias').insert({
      usuario_id: userId, equipe_id: Number(f.equipe_id), tipo: 'banco_horas',
      inicio: f.data || null, fim: f.data || null, dias: 0, status: 'aprovada', saldo: Number(f.saldo), obs: f.obs || null,
      decidido_em: new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error('Não foi possível lançar.'); return; }
    toast.success('Horas lançadas.');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-md" title="Lançar banco de horas">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Funcionário" full><select className={inp} value={f.equipe_id} onChange={set('equipe_id')}>{ativos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Campo>
        <Campo label="Data"><input type="date" className={inp} value={f.data} onChange={set('data')} /></Campo>
        <Campo label="Horas (±)" hint="Ex.: +2 (extra) ou -1 (devendo)"><input type="number" step="0.5" className={inp} value={f.saldo} onChange={set('saldo')} /></Campo>
        <Campo label="Observação" full><input className={inp} value={f.obs} onChange={set('obs')} placeholder="Ex.: hora extra no evento X" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Lançar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

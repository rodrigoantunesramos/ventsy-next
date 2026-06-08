'use client';

// Férias & Ausências — /painel/rh/ferias.
// Saldo e VENCIMENTO de férias por funcionário (passivo trabalhista!), fluxo
// solicitação→aprovação, atestados/licenças/faltas e banco de horas. Toda a
// matemática vem do motor lib/rh (direito/saldo/vencimento). Dados: rh_ausencias
// (RLS) + equipe (contexto). Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/format';
import {
  saldoFeriasDias, direitoFeriasDias, diasFeriasGozados, diasFeriasAgendados,
  vencimentoFerias, feriasVencidas, diffDays, type AusenciaLite,
} from '@/lib/rh';
import {
  useRh, mapAus, SEL_AUS, exportCSV, inp, inicial, avatarCor,
  TIPOS_AUSENCIA, AUS_BY, STATUS_AUS_BY, type Ausencia, type Funcionario,
} from '../_lib';
import { Kpi, Card, Chip, EmptyState, ModalShell, Campo, btnPrimary, btnSecondary, IcoPalm, IcoPlus, IcoCheck, IcoX, IcoDownload, IcoAlert } from '../_components/ui';

export default function FeriasPage() {
  const { userId, hoje, equipe } = useRh();
  const toast = useToast();
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [loading, setLoading] = useState(true);
  const [fTipo, setFTipo] = useState('todos');
  const [fStatus, setFStatus] = useState('todos');
  const [modal, setModal] = useState(false);

  const ativos = useMemo(() => equipe.filter((e) => !e.desligado_em), [equipe]);

  async function carregar() {
    const { data, error } = await sb.from('rh_ausencias').select(SEL_AUS).eq('usuario_id', userId).order('inicio', { ascending: false, nullsFirst: false });
    setAusencias(error ? [] : (data || []).map(mapAus));
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const ausByFunc = useMemo(() => {
    const m = new Map<number, AusenciaLite[]>();
    for (const a of ausencias) {
      const arr = m.get(a.equipe_id) ?? [];
      arr.push({ tipo: a.tipo, inicio: a.inicio, fim: a.fim, dias: a.dias, status: a.status });
      m.set(a.equipe_id, arr);
    }
    return m;
  }, [ausencias]);

  const saldos = useMemo(() => ativos.map((e) => {
    const aus = ausByFunc.get(e.id) ?? [];
    return {
      e,
      direito: direitoFeriasDias(e.admissao, hoje),
      gozados: diasFeriasGozados(aus),
      saldo: saldoFeriasDias(e.admissao, hoje, aus),
      venc: vencimentoFerias(e.admissao, hoje, aus),
      vencida: feriasVencidas(e.admissao, hoje, aus),
    };
  }).sort((a, b) => (a.vencida === b.vencida ? b.saldo - a.saldo : a.vencida ? -1 : 1)), [ativos, ausByFunc, hoje]);

  const kpis = useMemo(() => ({
    passivo: saldos.filter((s) => s.vencida).length,
    saldoDias: saldos.reduce((s, x) => s + x.saldo, 0),
    aprovar: ausencias.filter((a) => a.status === 'solicitada').length,
    agendadas: ausencias.filter((a) => a.tipo === 'ferias' && (a.status === 'solicitada' || a.status === 'aprovada')).reduce((s, a) => s + a.dias, 0),
  }), [saldos, ausencias]);

  const ausFiltradas = useMemo(() => ausencias.filter((a) => {
    if (fTipo !== 'todos' && a.tipo !== fTipo) return false;
    if (fStatus !== 'todos' && a.status !== fStatus) return false;
    return true;
  }), [ausencias, fTipo, fStatus]);

  const nomeFunc = (id: number) => equipe.find((e) => e.id === id)?.nome ?? '—';

  async function decidir(a: Ausencia, status: Ausencia['status']) {
    setAusencias((arr) => arr.map((x) => (x.id === a.id ? { ...x, status } : x)));
    const { error } = await sb.from('rh_ausencias').update({ status, decidido_em: new Date().toISOString() }).eq('id', a.id).eq('usuario_id', userId);
    if (error) { toast.error('Não foi possível atualizar.'); carregar(); return; }
    toast.success('Ausência atualizada.');
  }
  async function excluir(a: Ausencia) {
    if (!confirm('Remover esta ausência?')) return;
    await sb.from('rh_ausencias').delete().eq('id', a.id).eq('usuario_id', userId);
    setAusencias((arr) => arr.filter((x) => x.id !== a.id));
  }

  if (loading) return <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />;

  if (ativos.length === 0) {
    return <EmptyState icon={<IcoPalm />} title="Cadastre funcionários para gerir férias">Sem colaboradores ativos ainda. Comece em <a href="/painel/rh/funcionarios" className="font-semibold text-brand underline">Funcionários</a>.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Férias vencidas" value={String(kpis.passivo)} tone={kpis.passivo ? 'vermelho' : 'verde'} icon={<IcoAlert />} hint="passivo trabalhista" />
        <Kpi label="Saldo de férias" value={`${kpis.saldoDias} dia(s)`} tone="azul" />
        <Kpi label="A aprovar" value={String(kpis.aprovar)} tone={kpis.aprovar ? 'gold' : 'cinza'} />
        <Kpi label="Férias agendadas" value={`${kpis.agendadas} dia(s)`} tone="roxo" />
      </div>

      {/* Saldo de férias por funcionário */}
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-bold text-ink">Saldo de férias</h3>
          <button onClick={() => exportCSV('saldo-ferias.csv', ['Funcionario', 'Admissao', 'Direito', 'Gozados', 'Saldo', 'Vencimento', 'Vencida'],
            saldos.map((s) => [s.e.nome, s.e.admissao ?? '', s.direito, s.gozados, s.saldo, s.venc ?? '', s.vencida ? 'sim' : 'nao']))} className={btnSecondary}><IcoDownload /> CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                <th className="pb-2 font-semibold">Funcionário</th>
                <th className="pb-2 text-right font-semibold">Direito</th>
                <th className="pb-2 text-right font-semibold">Gozados</th>
                <th className="pb-2 text-right font-semibold text-ink">Saldo</th>
                <th className="pb-2 text-right font-semibold">Vencimento</th>
              </tr>
            </thead>
            <tbody>
              {saldos.map(({ e, direito, gozados, saldo, venc, vencida }) => (
                <tr key={e.id} className="border-b border-black/[0.04]">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: avatarCor(e.id) }}>{inicial(e.nome)}</span>
                      <div><div className="font-semibold text-ink">{e.nome}</div><div className="text-xs text-ink-muted">{e.admissao ? `desde ${formatDate(e.admissao, { style: 'short' })}` : '—'}</div></div>
                    </div>
                  </td>
                  <td className="py-2.5 text-right text-ink-soft">{direito}</td>
                  <td className="py-2.5 text-right text-ink-soft">{gozados}</td>
                  <td className="py-2.5 text-right font-bold text-ink">{saldo}</td>
                  <td className="py-2.5 text-right">
                    {venc ? <span className={vencida ? 'font-semibold text-red-600' : 'text-ink-soft'}>{formatDate(venc, { style: 'short' })}{vencida ? ' ⚠' : ''}</span> : <span className="text-ink-muted">em dia</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Ausências */}
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h3 className="mr-auto font-bold text-ink">Ausências</h3>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="todos">Tipo: Todos</option>{TIPOS_AUSENCIA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="todos">Status: Todos</option><option value="solicitada">Solicitada</option><option value="aprovada">Aprovada</option><option value="gozada">Gozada</option><option value="reprovada">Reprovada</option>
          </select>
          <button onClick={() => setModal(true)} className={btnPrimary}><IcoPlus /> Registrar</button>
        </div>

        {ausFiltradas.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Nenhuma ausência {fTipo !== 'todos' || fStatus !== 'todos' ? 'com esse filtro' : 'registrada'}.</p>
        ) : (
          <div className="space-y-2">
            {ausFiltradas.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-black/[0.06] px-3 py-2.5 text-sm">
                <span className="font-semibold text-ink">{nomeFunc(a.equipe_id)}</span>
                <Chip cls={AUS_BY[a.tipo]?.cls ?? ''}>{AUS_BY[a.tipo]?.label ?? a.tipo}</Chip>
                <span className="text-xs text-ink-muted">
                  {a.inicio ? formatDate(a.inicio, { style: 'short' }) : '—'}{a.fim ? ` → ${formatDate(a.fim, { style: 'short' })}` : ''}
                  {a.tipo === 'banco_horas' ? ` · ${a.saldo > 0 ? '+' : ''}${a.saldo}h` : ` · ${a.dias} dia(s)`}
                </span>
                <Chip cls={STATUS_AUS_BY[a.status]?.cls ?? ''}>{STATUS_AUS_BY[a.status]?.label ?? a.status}</Chip>
                <div className="ml-auto flex items-center gap-1">
                  {a.status === 'solicitada' && (
                    <>
                      <button onClick={() => decidir(a, 'aprovada')} className="flex h-7 items-center gap-1 rounded-lg bg-emerald-50 px-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"><IcoCheck /> Aprovar</button>
                      <button onClick={() => decidir(a, 'reprovada')} className="flex h-7 items-center gap-1 rounded-lg bg-red-50 px-2 text-xs font-semibold text-red-700 hover:bg-red-100"><IcoX /> Reprovar</button>
                    </>
                  )}
                  {a.status === 'aprovada' && a.tipo === 'ferias' && (
                    <button onClick={() => decidir(a, 'gozada')} className="flex h-7 items-center gap-1 rounded-lg bg-black/[0.04] px-2 text-xs font-semibold text-ink-soft hover:bg-black/[0.08]">Marcar gozada</button>
                  )}
                  <button onClick={() => excluir(a)} aria-label="Remover" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoX /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal && <AusenciaModal userId={userId} ativos={ativos} onClose={() => setModal(false)} onSaved={() => { setModal(false); carregar(); }} />}
    </div>
  );
}

// ── Modal de ausência ───────────────────────────────────────────────────────────
function AusenciaModal({ userId, ativos, onClose, onSaved }: { userId: string; ativos: Funcionario[]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({ equipe_id: ativos[0]?.id ? String(ativos[0].id) : '', tipo: 'ferias', inicio: '', fim: '', dias: '', status: 'solicitada', saldo: '', obs: '' });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  // Dias automáticos pelo intervalo (inclusivo), salvo banco de horas.
  const diasAuto = useMemo(() => (f.inicio && f.fim ? Math.max(0, diffDays(f.inicio, f.fim) + 1) : 0), [f.inicio, f.fim]);
  const isBanco = f.tipo === 'banco_horas';

  async function salvar() {
    if (!f.equipe_id) { toast.error('Selecione o funcionário.'); return; }
    setSaving(true);
    const dias = isBanco ? 0 : (f.dias ? Number(f.dias) : diasAuto);
    const { error } = await sb.from('rh_ausencias').insert({
      usuario_id: userId, equipe_id: Number(f.equipe_id), tipo: f.tipo,
      inicio: f.inicio || null, fim: f.fim || null, dias, status: f.status,
      saldo: isBanco ? (f.saldo ? Number(f.saldo) : 0) : 0, obs: f.obs || null,
      decidido_em: f.status === 'solicitada' ? null : new Date().toISOString(),
    });
    setSaving(false);
    if (error) { toast.error('Não foi possível registrar.'); return; }
    toast.success('Ausência registrada.');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg" title="Registrar ausência">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Funcionário" full>
          <select className={inp} value={f.equipe_id} onChange={set('equipe_id')}>{ativos.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select>
        </Campo>
        <Campo label="Tipo"><select className={inp} value={f.tipo} onChange={set('tipo')}>{TIPOS_AUSENCIA.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Campo>
        <Campo label="Status"><select className={inp} value={f.status} onChange={set('status')}><option value="solicitada">Solicitada</option><option value="aprovada">Aprovada</option><option value="gozada">Gozada</option></select></Campo>
        {isBanco ? (
          <Campo label="Saldo (horas, ±)" full hint="Positivo = a favor; negativo = devendo."><input type="number" step="0.5" className={inp} value={f.saldo} onChange={set('saldo')} /></Campo>
        ) : (
          <>
            <Campo label="Início"><input type="date" className={inp} value={f.inicio} onChange={set('inicio')} /></Campo>
            <Campo label="Fim"><input type="date" className={inp} value={f.fim} onChange={set('fim')} /></Campo>
            <Campo label="Dias" full hint={diasAuto ? `Sugerido pelo intervalo: ${diasAuto}` : 'Preencha as datas para calcular'}>
              <input type="number" min={0} className={inp} value={f.dias} onChange={set('dias')} placeholder={String(diasAuto)} />
            </Campo>
          </>
        )}
        <Campo label="Observações" full><textarea className={`${inp} min-h-[56px]`} value={f.obs} onChange={set('obs')} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Registrar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

'use client';

// Desligamento — /painel/rh/desligamento.
// Checklist (aviso, exame demissional, devolução de ativos/uniforme/EPI, acerto,
// entrevista) + cálculo ESTIMADO da rescisão por motivo (motor lib/rh) e baixa do
// funcionário (equipe.desligado_em + timeline). A folha/rescisão reaproveita o
// motor — não duplica nada. Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatMoney, formatDate } from '@/lib/format';
import {
  calcularRescisao, diasAvisoPrevio, MOTIVOS_DESLIGAMENTO, saldoFeriasDias,
  periodosAquisitivos, diasFeriasGozados, addMonths, diffDays,
  type AusenciaLite, type MotivoDesligamento,
} from '@/lib/rh';
import { useRh, mapAus, SEL_AUS, exportCSV, inp, inicial, avatarCor, type Ausencia } from '../_lib';
import { Card, Chip, EmptyState, Campo, btnPrimary, btnSecondary, IcoUserX, IcoCheck, IcoDownload } from '../_components/ui';

const CHECK_PADRAO = [
  'Comunicação / aviso prévio',
  'Exame demissional',
  'Devolução de uniforme / EPI',
  'Devolução de ativos (crachá, chaves, equipamentos)',
  'Acerto financeiro (rescisão)',
  'Entrevista de desligamento',
  'Baixa em sistemas e acessos',
];

// Dias de férias VENCIDAS (períodos cujo concessivo já passou) — refina a rescisão.
function diasFeriasVencidas(adm: string | null, hoje: string, aus: AusenciaLite[]): number {
  if (!adm) return 0;
  const completos = periodosAquisitivos(adm, hoje);
  const gozadosPeriodos = Math.floor(diasFeriasGozados(aus) / 30);
  let venc = 0;
  for (let i = 0; i < completos - gozadosPeriodos; i++) {
    const concEnd = addMonths(adm, 12 * (gozadosPeriodos + i + 1) + 12);
    if (diffDays(concEnd, hoje) > 0) venc += 30;
  }
  return venc;
}

export default function DesligamentoPage() {
  const { userId, hoje, equipe, reloadEquipe } = useRh();
  const toast = useToast();
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [motivo, setMotivo] = useState<MotivoDesligamento>('sem_justa_causa');
  const [dataDeslig, setDataDeslig] = useState(hoje);
  const [fgts, setFgts] = useState('');
  const [check, setCheck] = useState<boolean[]>(() => CHECK_PADRAO.map(() => false));
  const [entrevista, setEntrevista] = useState('');
  const [saving, setSaving] = useState(false);

  const ativos = useMemo(() => equipe.filter((e) => !e.desligado_em), [equipe]);

  useEffect(() => {
    (async () => {
      const { data } = await sb.from('rh_ausencias').select(SEL_AUS).eq('usuario_id', userId);
      setAusencias((data || []).map(mapAus));
    })();
  }, [userId]);

  const sel = useMemo(() => ativos.find((e) => e.id === selId) ?? null, [ativos, selId]);
  const ausDoSel: AusenciaLite[] = useMemo(
    () => (selId ? ausencias.filter((a) => a.equipe_id === selId).map((a) => ({ tipo: a.tipo, inicio: a.inicio, fim: a.fim, dias: a.dias, status: a.status })) : []),
    [ausencias, selId],
  );

  const rescisao = useMemo(() => {
    if (!sel || !sel.admissao) return null;
    return calcularRescisao({
      salario: sel.salario, admissao: sel.admissao, desligamento: dataDeslig, motivo,
      saldoFeriasVencidasDias: diasFeriasVencidas(sel.admissao, dataDeslig, ausDoSel),
      fgtsDepositado: fgts ? Number(fgts) : undefined,
    });
  }, [sel, dataDeslig, motivo, ausDoSel, fgts]);

  const checklistFeito = check.filter(Boolean).length;

  async function concluir() {
    if (!sel) { toast.error('Selecione o funcionário.'); return; }
    if (!confirm(`Confirmar desligamento de ${sel.nome}? Isso marca a saída e registra a rescisão.`)) return;
    setSaving(true);
    const motivoLabel = MOTIVOS_DESLIGAMENTO.find((m) => m.v === motivo)?.label ?? motivo;
    const { error } = await sb.from('equipe').update({ desligado_em: dataDeslig, motivo_desligamento: motivoLabel, status: 'afastado' }).eq('id', sel.id).eq('usuario_id', userId);
    if (!error) {
      await sb.from('rh_eventos_funcionario').insert({
        usuario_id: userId, equipe_id: sel.id, tipo: 'desligamento', titulo: 'Desligamento',
        descricao: motivoLabel, data: dataDeslig,
        dados: { motivo, rescisao: rescisao ? { verbas: rescisao.verbas, total: rescisao.total, avisoDias: rescisao.avisoDias } : null, checklist: CHECK_PADRAO.map((item, i) => ({ item, ok: check[i] })), entrevista: entrevista || null },
      });
    }
    setSaving(false);
    if (error) { toast.error('Não foi possível concluir.'); return; }
    await reloadEquipe();
    toast.success('Desligamento concluído e registrado na timeline.');
    setSelId(null); setCheck(CHECK_PADRAO.map(() => false)); setEntrevista(''); setFgts('');
  }

  function exportar() {
    if (!rescisao || !sel) return;
    exportCSV(`rescisao-${sel.nome}.csv`, ['Verba', 'Valor'], rescisao.verbas.map((v): [string, number] => [v.label, v.valor]).concat([['Total', rescisao.total]]));
  }

  if (ativos.length === 0) {
    return <EmptyState icon={<IcoUserX />} title="Nenhum funcionário ativo para desligar">Quando houver colaboradores ativos, o desligamento (checklist + rescisão estimada) aparece aqui.</EmptyState>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Configuração */}
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <h3 className="mb-3 font-bold text-ink">Dados do desligamento</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Funcionário" full>
              <select className={inp} value={selId ?? ''} onChange={(e) => setSelId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Selecione…</option>
                {ativos.map((e) => <option key={e.id} value={e.id}>{e.nome}{e.cargo ? ` · ${e.cargo}` : ''}</option>)}
              </select>
            </Campo>
            <Campo label="Motivo"><select className={inp} value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoDesligamento)}>{MOTIVOS_DESLIGAMENTO.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></Campo>
            <Campo label="Data do desligamento"><input type="date" className={inp} value={dataDeslig} onChange={(e) => setDataDeslig(e.target.value)} /></Campo>
            <Campo label="Saldo FGTS (opcional)" full hint="Refina a multa rescisória; se vazio, é estimado em 8%/mês."><input type="number" min={0} className={inp} value={fgts} onChange={(e) => setFgts(e.target.value)} /></Campo>
          </div>
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 font-bold text-ink"><IcoCheck /> Checklist de desligamento</h3>
            <span className="text-sm font-semibold text-ink-soft">{checklistFeito}/{CHECK_PADRAO.length}</span>
          </div>
          <div className="space-y-2">
            {CHECK_PADRAO.map((item, i) => (
              <button key={i} onClick={() => setCheck((arr) => arr.map((x, j) => (j === i ? !x : x)))} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${check[i] ? 'border-emerald-200 bg-emerald-50' : 'border-black/[0.06] hover:bg-black/[0.02]'}`}>
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${check[i] ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/20'}`}>{check[i] && <IcoCheck />}</span>
                <span className={check[i] ? 'text-ink-soft line-through' : 'text-ink-soft'}>{item}</span>
              </button>
            ))}
          </div>
          <Campo label="Entrevista de desligamento (anotações)" full>
            <textarea className={`${inp} mt-3 min-h-[72px]`} value={entrevista} onChange={(e) => setEntrevista(e.target.value)} placeholder="Motivos, feedbacks, clima…" />
          </Campo>
        </Card>
      </div>

      {/* Rescisão estimada */}
      <div className="space-y-4">
        <Card>
          {!sel ? (
            <div className="py-10 text-center text-sm text-ink-muted">Selecione um funcionário para calcular a rescisão.</div>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: avatarCor(sel.id) }}>{inicial(sel.nome)}</span>
                <div>
                  <div className="font-bold text-ink">{sel.nome}</div>
                  <div className="text-xs text-ink-muted">{sel.admissao ? `admissão ${formatDate(sel.admissao, { style: 'short' })}` : 'sem data de admissão'}</div>
                </div>
              </div>

              {!sel.admissao ? (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Defina a data de admissão na ficha para estimar a rescisão.</p>
              ) : rescisao && (
                <>
                  <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
                    <Chip cls="bg-black/[0.05] text-ink-soft">Aviso: {diasAvisoPrevio(sel.admissao, dataDeslig)} dias</Chip>
                    <Chip cls="bg-blue-50 text-blue-700">Saldo férias: {saldoFeriasDias(sel.admissao, dataDeslig, ausDoSel)}d</Chip>
                  </div>
                  <table className="w-full text-sm">
                    <tbody>
                      {rescisao.verbas.map((v, i) => (
                        <tr key={i} className="border-b border-black/[0.04]">
                          <td className="py-2 text-ink-soft">{v.label}</td>
                          <td className="py-2 text-right font-medium text-ink-soft">{formatMoney(v.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-black/[0.08]"><td className="pt-2 font-bold text-ink">Total estimado</td><td className="pt-2 text-right font-bold text-ink">{formatMoney(rescisao.total)}</td></tr>
                    </tfoot>
                  </table>
                  <button onClick={exportar} className={`${btnSecondary} mt-3 w-full`}><IcoDownload /> Exportar rescisão (CSV)</button>
                  <p className="mt-2 text-[0.7rem] text-ink-muted">Estimativa — o TRCT oficial deve ser feito pelo seu contador.</p>
                </>
              )}

              <button onClick={concluir} disabled={saving} className={`${btnPrimary} mt-4 w-full`}><IcoUserX /> {saving ? 'Concluindo…' : 'Concluir desligamento'}</button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

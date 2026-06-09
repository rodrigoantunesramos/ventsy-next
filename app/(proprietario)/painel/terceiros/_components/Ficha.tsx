'use client';

// Aba "Custo × Retorno" — a ficha de UM terceiro: o quanto custa × o que devolve.
// KPIs do período (custo, retorno, ROI, eventos, economia, SLA, satisfação),
// evolução por competência (gráfico custo×retorno em SVG puro), a comparação com
// a alternativa de INTERNALIZAR (what-if) e o CRUD das medições periódicas.

import { useMemo, useState } from 'react';
import { formatMoney, formatMoneyShort, formatPercent, formatNumber, formatMonth } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ResultadoTerceiro, type TerceiroAgg, type FornecedorLite,
  categoriaLabel, decisaoMeta, recomendarDecisao, compararInternalizar, serieEvolucao,
  competenciaAtual, ehCompetencia, fornecedorLabel,
  salvarResultado, excluirResultado, inp,
} from '../_lib';
import type { TerceirosBag } from './shared';
import {
  Kpi, ModalShell, Campo, EmptyState, Chip, Progress, btnPrimary, btnSecondary,
  IcoScale, IcoMoney, IcoTrend, IcoStar, IcoCalendar, IcoPlus, IcoEdit, IcoTrash,
  IcoCheck, IcoExchange, IcoArrowUp, IcoArrowDown, IcoChart,
} from './ui';

const numOrZero = (s: string): number => { const x = Number(String(s).replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const numOrNullStr = (s: string): number | null => (s.trim() === '' ? null : numOrZero(s));

export default function Ficha({ bag, fichaId, setFichaId }: {
  bag: TerceirosBag; fichaId: string | null; setFichaId: (id: string | null) => void;
}) {
  const { aggs, aggById, resultadosByTerceiro, fornecedoresMap } = bag;

  // Seleção (default: o primeiro da carteira).
  const selId = fichaId && aggById.has(fichaId) ? fichaId : (aggs[0]?.terceiro.id ?? null);
  const agg = selId ? aggById.get(selId) ?? null : null;

  if (aggs.length === 0) {
    return (
      <EmptyState icon={<IcoScale />} title="Sem terceiros para analisar">
        Cadastre um terceirizado na aba <strong>Carteira</strong> para medir custo × retorno, ROI e a alternativa de internalizar.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* Seletor */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink-soft">Terceiro</span>
        <select value={selId ?? ''} onChange={(e) => setFichaId(e.target.value)} className="min-w-[220px] flex-1 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none sm:max-w-md">
          {aggs.map((a) => <option key={a.terceiro.id} value={a.terceiro.id}>{a.terceiro.servico} · {categoriaLabel(a.terceiro.categoria)}</option>)}
        </select>
      </div>

      {agg && <FichaTerceiro bag={bag} agg={agg} resultados={resultadosByTerceiro.get(agg.terceiro.id) || []} forn={fornecedorNome(agg, fornecedoresMap)} />}
    </div>
  );
}

function fornecedorNome(agg: TerceiroAgg, map: Map<string, FornecedorLite>): string | null {
  const id = agg.terceiro.fornecedor_id;
  if (!id) return null;
  const f = map.get(id);
  return f ? fornecedorLabel(f) : null;
}

function FichaTerceiro({ bag, agg, resultados, forn }: {
  bag: TerceirosBag; agg: TerceiroAgg; resultados: ResultadoTerceiro[]; forn: string | null;
}) {
  const toast = useToast();
  const t = agg.terceiro;
  const [edit, setEdit] = useState<ResultadoTerceiro | 'novo' | null>(null);
  // What-if de internalização (default: o cadastrado).
  const [internoStr, setInternoStr] = useState(t.custo_interno_mensal_num != null ? String(t.custo_interno_mensal_num) : '');

  const serie = useMemo(() => serieEvolucao(resultados), [resultados]);
  const dec = decisaoMeta(agg.recomendacao.decisao);

  // Comparação internalizar + recomendação what-if.
  const interno = internoStr.trim() === '' ? null : numOrZero(internoStr);
  const comp = (agg.custoMensal != null && interno != null) ? compararInternalizar(agg.custoMensal, interno) : null;
  const recWhatIf = (interno != null && interno !== (t.custo_interno_mensal_num ?? null))
    ? recomendarDecisao({ indiceValor: agg.indiceValor, slaCumpridoPct: agg.slaCumpridoPct, slaAlvoPct: agg.slaAlvoPct, tendencia: agg.tendencia, custoMensal: agg.custoMensal, custoInternoMensal: interno })
    : null;

  return (
    <div className="space-y-5">
      {/* Cabeçalho do terceiro */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-4 shadow-card">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{t.servico}</h3>
            <Chip className="bg-black/[0.04] text-ink-soft">{categoriaLabel(t.categoria)}</Chip>
            <Chip className={dec.chip}>Decisão: {dec.label}</Chip>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">
            {forn ? `Fornecedor: ${forn} · ` : ''}{agg.meses > 0 ? `${agg.meses} mês(es) medidos` : 'Sem medições ainda'}
            {t.responsavel ? ` · resp. ${t.responsavel}` : ''}
          </p>
        </div>
        <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Medir competência</button>
      </div>

      {/* KPIs do período */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Custo no período" value={formatMoneyShort(agg.custoMedido)} tone="brand" icon={<IcoMoney />} sub={agg.custoMensal != null ? `${formatMoneyShort(agg.custoMensal)}/mês` : undefined} />
        <Kpi label="Retorno no período" value={formatMoneyShort(agg.retorno)} tone="verde" icon={<IcoTrend />} sub="receita + economia" />
        <Kpi label="Índice de valor" value={agg.indiceValor == null ? '—' : `${formatNumber(agg.indiceValor, { maximumFractionDigits: 2 })}×`} tone={agg.indiceValor == null ? 'ink' : agg.indiceValor >= 1 ? 'verde' : 'vermelho'} icon={<IcoScale />} sub={agg.roi == null ? 'retorno ÷ custo' : `ROI ${formatPercent(agg.roi, { maximumFractionDigits: 0 })}`} />
        <Kpi label="Eventos atendidos" value={formatNumber(agg.eventos)} tone="azul" icon={<IcoCalendar />} sub={agg.satisfacao == null ? undefined : `satisfação ${formatNumber(agg.satisfacao, { maximumFractionDigits: 1 })}/5`} />
      </div>

      {/* SLA + tendência */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h4 className="mb-2 text-sm font-bold text-ink">SLA & satisfação</h4>
          {agg.slaCumpridoPct == null && agg.satisfacao == null ? (
            <p className="text-sm text-ink-muted">Registre medições para acompanhar o cumprimento de SLA e a satisfação interna.</p>
          ) : (
            <div className="space-y-3">
              {agg.slaCumpridoPct != null && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-soft">SLA cumprido {agg.slaAlvoPct != null && <span className="text-ink-muted">· meta {formatPercent(agg.slaAlvoPct / 100, { maximumFractionDigits: 0 })}</span>}</span>
                    <span className={`font-semibold ${agg.slaNivel === 'verde' ? 'text-emerald-600' : agg.slaNivel === 'amarelo' ? 'text-amber-600' : 'text-red-600'}`}>{formatPercent(agg.slaCumpridoPct / 100, { maximumFractionDigits: 0 })}</span>
                  </div>
                  <Progress value={agg.slaCumpridoPct / 100} tone={agg.slaNivel === 'verde' ? 'verde' : agg.slaNivel === 'amarelo' ? 'gold' : 'vermelho'} />
                </div>
              )}
              {agg.satisfacao != null && (
                <div>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-soft">Satisfação interna</span>
                    <span className="font-semibold text-ink">{formatNumber(agg.satisfacao, { maximumFractionDigits: 1 })}/5</span>
                  </div>
                  <Progress value={agg.satisfacao / 5} tone="brand" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Comparação internalizar */}
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h4 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><IcoExchange /> Terceirizar × internalizar</h4>
          <p className="mb-3 text-xs text-ink-muted">Quanto custaria fazer isso internamente (por mês)? Comparamos com o custo terceirizado atual.</p>
          <div className="flex items-center gap-2">
            <input value={internoStr} onChange={(e) => setInternoStr(e.target.value)} inputMode="decimal" className={`${inp} max-w-[180px]`} placeholder="Custo interno /mês" />
            <span className="text-xs text-ink-muted">vs {agg.custoMensal == null ? '—' : `${formatMoneyShort(agg.custoMensal)}/mês`} terceirizado</span>
          </div>
          {comp ? (
            <div className={`mt-3 rounded-xl p-3 text-sm ${comp.favoravel ? 'bg-violet-50 text-violet-800' : 'bg-emerald-50 text-emerald-800'}`}>
              {comp.favoravel ? (
                <span className="flex items-center gap-1.5"><IcoArrowDown /> Internalizar economizaria <strong>{formatMoney(Math.abs(comp.economiaMensal))}/mês</strong> ({comp.fracao != null ? formatPercent(1 - comp.fracao, { maximumFractionDigits: 0 }) : ''} menos).</span>
              ) : (
                <span className="flex items-center gap-1.5"><IcoCheck /> Terceirizar sai <strong>{formatMoney(Math.abs(comp.economiaMensal))}/mês</strong> mais barato — mantenha fora.</span>
              )}
              {recWhatIf && (
                <div className="mt-1.5 text-xs">Com esse custo interno, a recomendação seria <Chip className={decisaoMeta(recWhatIf.decisao).chip}>{decisaoMeta(recWhatIf.decisao).label}</Chip></div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-xs text-ink-muted">Informe o custo interno e tenha o custo mensal medido/estimado para comparar.</p>
          )}
        </div>
      </div>

      {/* Evolução custo × retorno */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><IcoChart /> Evolução · custo × retorno</h4>
        {serie.length === 0 ? (
          <div className="py-6 text-center text-sm text-ink-muted">Sem medições ainda. Use “Medir competência” para registrar custo, receita atribuída, eventos, economia e SLA do mês.</div>
        ) : (
          <EvolucaoChart serie={serie} />
        )}
      </div>

      {/* Medições */}
      <div className="rounded-2xl bg-white p-4 shadow-card">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-sm font-bold text-ink">Medições por competência</h4>
        </div>
        {resultados.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Nenhuma medição registrada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="pb-2 pr-3 font-semibold">Competência</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Custo</th>
                  <th className="pb-2 pr-3 text-right font-semibold">Retorno</th>
                  <th className="hidden pb-2 pr-3 text-right font-semibold sm:table-cell">Eventos</th>
                  <th className="hidden pb-2 pr-3 text-right font-semibold sm:table-cell">SLA</th>
                  <th className="pb-2 text-right font-semibold">ROI</th>
                  <th className="pb-2 pl-3"></th>
                </tr>
              </thead>
              <tbody>
                {[...resultados].sort((a, b) => b.competencia.localeCompare(a.competencia)).map((r) => {
                  const ret = r.receita_atribuida_num + r.economia_num;
                  const roiP = r.custo_num > 0 ? (ret - r.custo_num) / r.custo_num : null;
                  return (
                    <tr key={r.id} className="border-b border-black/[0.04]">
                      <td className="py-2 pr-3 font-medium text-ink">{formatMonth(r.competencia)}</td>
                      <td className="py-2 pr-3 text-right text-ink-soft">{formatMoney(r.custo_num)}</td>
                      <td className="py-2 pr-3 text-right text-ink-soft">{formatMoney(ret)}</td>
                      <td className="hidden py-2 pr-3 text-right text-ink-soft sm:table-cell">{r.eventos_atendidos || '—'}</td>
                      <td className="hidden py-2 pr-3 text-right text-ink-soft sm:table-cell">{r.sla_cumprido_pct == null ? '—' : formatPercent(r.sla_cumprido_pct / 100, { maximumFractionDigits: 0 })}</td>
                      <td className={`py-2 text-right font-semibold ${roiP == null ? 'text-ink-muted' : roiP >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{roiP == null ? '—' : formatPercent(roiP, { maximumFractionDigits: 0 })}</td>
                      <td className="py-2 pl-3 text-right">
                        <button onClick={() => setEdit(r)} aria-label="Editar medição" className="text-ink-muted hover:text-ink"><IcoEdit /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <ResultadoModal bag={bag} terceiroId={t.id} editing={edit === 'novo' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={async () => { setEdit(null); await bag.recarregarResultados(); }}
          onDeleted={async () => { setEdit(null); await bag.recarregarResultados(); }}
          toastError={(m) => toast.error(m)} toastOk={(m) => toast.success(m)} />
      )}
    </div>
  );
}

// ── Gráfico de evolução (barras agrupadas custo × retorno, SVG puro) ─────────
function EvolucaoChart({ serie }: { serie: ReturnType<typeof serieEvolucao> }) {
  const max = Math.max(1, ...serie.map((p) => Math.max(p.custo, p.retorno)));
  const W = Math.max(280, serie.length * 64);
  const H = 160, pad = 24, gw = (W - pad * 2) / serie.length;
  return (
    <div className="space-y-2">
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-44 w-full" style={{ minWidth: W }}>
          <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#0000000d" />
          {serie.map((p, i) => {
            const x = pad + i * gw;
            const bw = Math.min(16, gw / 3);
            const hC = ((H - pad * 2) * p.custo) / max;
            const hR = ((H - pad * 2) * p.retorno) / max;
            return (
              <g key={p.competencia}>
                <rect x={x + gw / 2 - bw - 2} y={H - pad - hC} width={bw} height={hC} rx={2} fill="#ff385c">
                  <title>{`${p.competencia} · custo ${p.custo}`}</title>
                </rect>
                <rect x={x + gw / 2 + 2} y={H - pad - hR} width={bw} height={hR} rx={2} fill="#16a34a">
                  <title>{`${p.competencia} · retorno ${p.retorno}`}</title>
                </rect>
                <text x={x + gw / 2} y={H - pad + 12} textAnchor="middle" className="fill-ink-muted" style={{ fontSize: 9 }}>{formatMonth(p.competencia, { withYear: false })}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex items-center gap-4 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand" /> Custo</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Retorno</span>
      </div>
    </div>
  );
}

// ── Modal de medição (resultado por competência) ─────────────────────────────
function ResultadoModal({ bag, terceiroId, editing, onClose, onSaved, onDeleted, toastError, toastOk }: {
  bag: TerceirosBag; terceiroId: string; editing: ResultadoTerceiro | null;
  onClose: () => void; onSaved: () => Promise<void>; onDeleted: () => Promise<void>;
  toastError: (m: string) => void; toastOk: (m: string) => void;
}) {
  const { userId } = bag;
  const [competencia, setCompetencia] = useState(editing?.competencia ?? competenciaAtual());
  const [custo, setCusto] = useState(editing?.custo_num ? String(editing.custo_num) : '');
  const [receita, setReceita] = useState(editing?.receita_atribuida_num ? String(editing.receita_atribuida_num) : '');
  const [eventos, setEventos] = useState(editing?.eventos_atendidos ? String(editing.eventos_atendidos) : '');
  const [economia, setEconomia] = useState(editing?.economia_num ? String(editing.economia_num) : '');
  const [sla, setSla] = useState(editing?.sla_cumprido_pct != null ? String(editing.sla_cumprido_pct) : '');
  const [satisfacao, setSatisfacao] = useState(editing?.satisfacao != null ? String(editing.satisfacao) : '');
  const [obs, setObs] = useState(editing?.obs ?? '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!ehCompetencia(competencia)) { toastError('Informe a competência (mês).'); return; }
    setSalvando(true);
    const row = {
      ...(editing ? { id: editing.id } : {}),
      usuario_id: userId,
      terceiro_id: terceiroId,
      competencia,
      custo_num: numOrZero(custo),
      receita_atribuida_num: numOrZero(receita),
      eventos_atendidos: Math.max(0, Math.round(numOrZero(eventos))),
      economia_num: numOrZero(economia),
      sla_cumprido_pct: numOrNullStr(sla),
      satisfacao: numOrNullStr(satisfacao),
      obs: obs.trim() || null,
    };
    const res = await salvarResultado(row);
    setSalvando(false);
    if (res.error) {
      toastError(res.error.code === '23505' ? 'Já existe medição para essa competência.' : 'Não foi possível salvar a medição.');
      return;
    }
    toastOk('Medição salva.');
    await onSaved();
  };

  const excluir = async () => {
    if (!editing) return;
    if (!confirm('Excluir esta medição?')) return;
    setSalvando(true);
    const res = await excluirResultado(editing.id);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível excluir.'); return; }
    toastOk('Medição excluída.');
    await onDeleted();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-1 text-lg font-bold text-ink">{editing ? 'Editar medição' : 'Medir competência'}</h3>
      <p className="mb-4 text-sm text-ink-muted">Custo realizado × o que o terceiro devolveu no mês. O ROI e a decisão saem daqui.</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Competência (mês)"><input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} className={inp} /></Campo>
        <Campo label="Custo realizado"><input value={custo} onChange={(e) => setCusto(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <Campo label="Receita atribuída" hint="Receita que o terceiro ajudou a gerar."><input value={receita} onChange={(e) => setReceita(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <Campo label="Economia gerada" hint="Ganho/economia que não é receita direta."><input value={economia} onChange={(e) => setEconomia(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <Campo label="Eventos atendidos"><input value={eventos} onChange={(e) => setEventos(e.target.value)} inputMode="numeric" className={inp} placeholder="0" /></Campo>
        <Campo label="SLA cumprido (%)"><input value={sla} onChange={(e) => setSla(e.target.value)} inputMode="decimal" className={inp} placeholder="0–100" /></Campo>
        <Campo label="Satisfação interna (1–5)"><input value={satisfacao} onChange={(e) => setSatisfacao(e.target.value)} inputMode="decimal" className={inp} placeholder="1–5" /></Campo>
      </div>
      <div className="mt-4"><Campo label="Observações" full><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} placeholder="Notas do mês…" /></Campo></div>
      <div className="mt-6 flex items-center justify-between gap-2">
        {editing ? (
          <button onClick={excluir} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"><IcoTrash /> Excluir</button>
        ) : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className={btnPrimary}><IcoCheck /> {salvando ? 'Salvando…' : 'Salvar medição'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

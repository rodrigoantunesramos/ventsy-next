'use client';

// Aba "Carteira" — visão geral dos terceirizados como investimento: KPIs (custo
// mensal/anual, % sobre a receita, ativos, índice de valor médio), custo por
// categoria, filtros e a lista de terceiros com o modal de cadastro/edição
// (vínculo a fornecedor, modelo de custo, contrato/vigência, SLA, internalizar).

import { useMemo, useState } from 'react';
import { formatMoney, formatMoneyShort, formatPercent, formatNumber, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Terceiro, type MetaSLA, type ModeloCusto, type CategoriaTerceiro, type StatusTerceiro,
  CATEGORIAS, categoriaLabel, categoriaCor, MODELOS_CUSTO, modeloUnidade,
  STATUS_TERCEIRO, statusMeta, decisaoMeta, slaNivel, diasAte, diasLabel,
  criarTerceiro, salvarTerceiro, excluirTerceiro,
  uploadContrato, signedUrl, removeArquivo, fornecedorLabel, inp, selCls,
} from '../_lib';
import type { TerceirosBag } from './shared';
import {
  Kpi, ModalShell, Campo, EmptyState, Chip, Farol, btnPrimary, btnSecondary,
  IcoExchange, IcoMoney, IcoWallet, IcoChart, IcoScale, IcoPlus, IcoEdit, IcoTrash,
  IcoCheck, IcoX, IcoSearch, IcoDoc, IcoDownload, IcoTruck, IcoSignature,
} from './ui';

const numOrZero = (s: string): number => { const x = Number(String(s).replace(',', '.')); return Number.isFinite(x) ? x : 0; };

/** Rótulo do custo unitário conforme o modelo (sem hardcode de "R$"). */
export function custoUnitario(t: Terceiro): string {
  if (t.modelo_custo === 'percentual') return `${formatNumber(t.custo_num, { maximumFractionDigits: 2 })}% da receita`;
  return `${formatMoney(t.custo_num)}${modeloUnidade(t.modelo_custo)}`;
}

export default function Carteira({ bag, onAbrirFicha }: { bag: TerceirosBag; onAbrirFicha: (id: string) => void }) {
  const toast = useToast();
  const { aggs, resumo, fornecedoresMap, hoje } = bag;
  const [busca, setBusca] = useState('');
  const [fCat, setFCat] = useState<'todas' | CategoriaTerceiro>('todas');
  const [fStatus, setFStatus] = useState<'todos' | StatusTerceiro>('todos');
  const [edit, setEdit] = useState<Terceiro | 'novo' | null>(null);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return aggs.filter((a) => {
      const t = a.terceiro;
      if (fCat !== 'todas' && t.categoria !== fCat) return false;
      if (fStatus !== 'todos' && t.status !== fStatus) return false;
      if (q) {
        const forn = fornecedoresMap.get(t.fornecedor_id || '');
        const hay = `${t.servico} ${categoriaLabel(t.categoria)} ${t.responsavel || ''} ${forn ? fornecedorLabel(forn) : ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [aggs, busca, fCat, fStatus, fornecedoresMap]);

  const pctReceita = resumo.percentualReceita;

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Custo mensal terceirizado" value={formatMoneyShort(resumo.custoMensal)} tone="brand" icon={<IcoMoney />} sub={`${resumo.ativos} ativo(s)`} />
        <Kpi label="Custo anual" value={formatMoneyShort(resumo.custoAnual)} tone="azul" icon={<IcoWallet />} sub="projeção 12 meses" />
        <Kpi label="% da receita" value={pctReceita == null ? '—' : formatPercent(pctReceita, { maximumFractionDigits: 1 })} tone={pctReceita != null && pctReceita > 0.25 ? 'gold' : 'ink'} icon={<IcoChart />} sub="terceirizado / receita" />
        <Kpi label="Índice de valor médio" value={resumo.indiceValorMedio == null ? '—' : `${formatNumber(resumo.indiceValorMedio, { maximumFractionDigits: 2 })}×`} tone={resumo.indiceValorMedio != null && resumo.indiceValorMedio >= 1 ? 'verde' : resumo.indiceValorMedio != null ? 'vermelho' : 'ink'} icon={<IcoScale />} sub="retorno ÷ custo" />
        <Kpi label="SLA médio" value={resumo.slaMedio == null ? '—' : formatPercent(resumo.slaMedio / 100, { maximumFractionDigits: 0 })} tone={resumo.slaMedio == null ? 'ink' : resumo.slaMedio >= 90 ? 'verde' : 'gold'} icon={<IcoCheckBadge />} sub="cumprimento médio" />
      </div>

      {/* Custo por categoria */}
      {resumo.porCategoria.length > 0 && (
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-ink">Custo mensal por categoria</h3>
          <div className="space-y-2.5">
            {resumo.porCategoria.map((c) => {
              const pct = resumo.custoMensal > 0 ? c.custoMensal / resumo.custoMensal : 0;
              return (
                <div key={c.categoria}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-soft">{categoriaLabel(c.categoria)} <span className="text-ink-muted">· {c.quantidade}</span></span>
                    <span className="font-semibold text-ink">{formatMoney(c.custoMensal)}<span className="text-ink-muted">/mês</span></span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct * 100)}%`, background: categoriaCor(c.categoria) }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filtros + ação */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar serviço, fornecedor, responsável…" className={`${inp} pl-9`} />
        </div>
        <select value={fCat} onChange={(e) => setFCat(e.target.value as typeof fCat)} className={selCls}>
          <option value="todas">Todas as categorias</option>
          {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as typeof fStatus)} className={selCls}>
          <option value="todos">Todos os status</option>
          {STATUS_TERCEIRO.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
        <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Novo terceiro</button>
      </div>

      {/* Lista */}
      {aggs.length === 0 ? (
        <EmptyState icon={<IcoExchange />} title="Nenhum terceirizado cadastrado"
          cta={<button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Adicionar primeiro terceiro</button>}>
          Cadastre segurança, limpeza, contabilidade, marketing, TI, manutenção, jurídico, buffet… Veja quanto cada um custa e o que devolve (receita, eventos, economia, SLA) para decidir manter, renegociar, trocar ou internalizar.
        </EmptyState>
      ) : filtrados.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-ink-muted shadow-card">Nenhum terceiro para os filtros atuais.</div>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map((a) => (
            <TerceiroCard key={a.terceiro.id} agg={a} hoje={hoje} forn={fornecedorLabelDe(a.terceiro, fornecedoresMap)}
              onEdit={() => setEdit(a.terceiro)} onFicha={() => onAbrirFicha(a.terceiro.id)} />
          ))}
        </div>
      )}

      {edit && (
        <TerceiroModal bag={bag} editing={edit === 'novo' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={async () => { setEdit(null); await bag.recarregar(); }}
          onDeleted={async () => { setEdit(null); await bag.recarregar(); }}
          toastError={(m) => toast.error(m)} toastOk={(m) => toast.success(m)} />
      )}
    </div>
  );
}

function fornecedorLabelDe(t: Terceiro, map: Map<string, { nome: string; fantasia: string | null }>): string | null {
  if (!t.fornecedor_id) return null;
  const f = map.get(t.fornecedor_id);
  return f ? (f.fantasia || f.nome) : null;
}

// ── Card de terceiro ────────────────────────────────────────────────────────
function TerceiroCard({ agg, hoje, forn, onEdit, onFicha }: {
  agg: TerceirosBag['aggs'][number]; hoje: string; forn: string | null; onEdit: () => void; onFicha: () => void;
}) {
  const t = agg.terceiro;
  const st = statusMeta(t.status);
  const dec = decisaoMeta(agg.recomendacao.decisao);
  const fimDias = diasAte(t.vigencia_fim, hoje);
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card transition hover:shadow-pop">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button onClick={onFicha} className="flex min-w-0 items-start gap-3 text-left">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: categoriaCor(t.categoria) + '1a', color: categoriaCor(t.categoria) }}>
            <IcoExchange />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-ink">{t.servico}</span>
              <Chip className="bg-black/[0.04] text-ink-soft">{categoriaLabel(t.categoria)}</Chip>
              <Chip className={st.chip}>{st.label}</Chip>
            </div>
            <div className="mt-0.5 truncate text-xs text-ink-muted">
              {custoUnitario(t)}
              {forn && <> · <span className="inline-flex items-center gap-1"><IcoTruck /> {forn}</span></>}
              {t.vigencia_fim && <> · vence {formatDate(t.vigencia_fim, { style: 'short' })}{fimDias != null && fimDias <= (t.aviso_previo_dias || 30) && !t.renovacao_automatica ? ` (${diasLabel(fimDias).toLowerCase()})` : ''}</>}
            </div>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-4 pl-12 sm:pl-0">
          <div className="text-right">
            <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">Custo/mês</div>
            <div className="text-sm font-bold text-ink">{agg.custoMensal == null ? '—' : formatMoneyShort(agg.custoMensal)}</div>
          </div>
          <div className="hidden text-right sm:block">
            <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">Valor</div>
            <div className="text-sm font-semibold text-ink-soft">{agg.indiceValor == null ? '—' : `${formatNumber(agg.indiceValor, { maximumFractionDigits: 1 })}×`}</div>
          </div>
          <div className="flex items-center gap-1.5" title={`SLA: ${agg.slaCumpridoPct == null ? 'sem medição' : formatPercent(agg.slaCumpridoPct / 100, { maximumFractionDigits: 0 })}`}>
            <Farol nivel={agg.slaNivel} />
          </div>
          <Chip className={dec.chip}>{dec.label}</Chip>
          <button onClick={onEdit} aria-label="Editar" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
        </div>
      </div>
    </div>
  );
}

// ── Ícone local (selo de check) ─────────────────────────────────────────────
function IcoCheckBadge() {
  return <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4M12 3l2.5 1.8 3 .2.2 3L19.5 12 17.7 14.5l-.2 3-3 .2L12 21l-2.5-1.8-3-.2-.2-3L4.5 12 6.3 9.5l.2-3 3-.2L12 3Z" /></svg>;
}

// ── Modal de cadastro/edição de terceiro ─────────────────────────────────────
export function TerceiroModal({ bag, editing, onClose, onSaved, onDeleted, toastError, toastOk }: {
  bag: TerceirosBag; editing: Terceiro | null;
  onClose: () => void; onSaved: () => Promise<void>; onDeleted: () => Promise<void>;
  toastError: (m: string) => void; toastOk: (m: string) => void;
}) {
  const { userId, fornecedores } = bag;
  const [servico, setServico] = useState(editing?.servico ?? '');
  const [categoria, setCategoria] = useState<CategoriaTerceiro | string>(editing?.categoria ?? 'seguranca');
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id ?? '');
  const [modelo, setModelo] = useState<ModeloCusto | string>(editing?.modelo_custo ?? 'mensal');
  const [custo, setCusto] = useState(editing?.custo_num ? String(editing.custo_num) : '');
  const [custoInterno, setCustoInterno] = useState(editing?.custo_interno_mensal_num != null ? String(editing.custo_interno_mensal_num) : '');
  const [responsavel, setResponsavel] = useState(editing?.responsavel ?? '');
  const [vigIni, setVigIni] = useState(editing?.vigencia_inicio ?? '');
  const [vigFim, setVigFim] = useState(editing?.vigencia_fim ?? '');
  const [renovAuto, setRenovAuto] = useState(editing?.renovacao_automatica ?? false);
  const [aviso, setAviso] = useState(editing ? String(editing.aviso_previo_dias) : '30');
  const [multa, setMulta] = useState(editing?.multa_rescisao ?? '');
  const [slaAlvoPct, setSlaAlvoPct] = useState(editing?.sla?.alvo_pct != null ? String(editing.sla.alvo_pct) : '');
  const [metas, setMetas] = useState<MetaSLA[]>(editing?.sla?.metas?.length ? editing.sla.metas : []);
  const [status, setStatus] = useState<StatusTerceiro | string>(editing?.status ?? 'ativo');
  const [obs, setObs] = useState(editing?.obs ?? '');
  const [docUrl, setDocUrl] = useState<string | null>(editing?.documento_url ?? null);
  const [docNome, setDocNome] = useState<string | null>(editing?.documento_nome ?? null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const ehPercentual = modelo === 'percentual';
  const addMeta = () => setMetas((m) => [...m, { nome: '', alvo: '' }]);
  const setMeta = (i: number, patch: Partial<MetaSLA>) => setMetas((m) => m.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const delMeta = (i: number) => setMetas((m) => m.filter((_, idx) => idx !== i));

  const enviarDoc = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    try { const a = await uploadContrato(userId, file); setDocUrl(a.url); setDocNome(a.nome); toastOk('Contrato anexado.'); }
    catch { toastError('Falha ao enviar o documento.'); }
    setEnviando(false);
  };
  const abrirDoc = async () => {
    const url = await signedUrl(docUrl);
    if (url) window.open(url, '_blank'); else toastError('Não foi possível abrir o documento.');
  };

  const salvar = async () => {
    if (!servico.trim()) { toastError('Informe o serviço terceirizado.'); return; }
    setSalvando(true);
    const metasLimpas = metas.map((m) => ({ nome: m.nome.trim(), alvo: m.alvo.trim() })).filter((m) => m.nome || m.alvo);
    const row = {
      usuario_id: userId,
      fornecedor_id: fornecedorId || null,
      servico: servico.trim(),
      categoria,
      modelo_custo: modelo,
      custo_num: numOrZero(custo),
      custo_interno_mensal_num: custoInterno.trim() === '' ? null : numOrZero(custoInterno),
      responsavel: responsavel.trim() || null,
      vigencia_inicio: vigIni || null,
      vigencia_fim: vigFim || null,
      renovacao_automatica: renovAuto,
      aviso_previo_dias: Math.max(0, Math.round(numOrZero(aviso))),
      multa_rescisao: multa.trim() || null,
      sla: { alvo_pct: slaAlvoPct.trim() === '' ? null : numOrZero(slaAlvoPct), metas: metasLimpas },
      status,
      documento_url: docUrl,
      documento_nome: docNome,
      obs: obs.trim() || null,
    };
    const res = editing ? await salvarTerceiro(editing.id, row) : await criarTerceiro(row);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível salvar o terceiro.'); return; }
    toastOk(editing ? 'Terceiro atualizado.' : 'Terceiro cadastrado.');
    await onSaved();
  };

  const excluir = async () => {
    if (!editing) return;
    if (!confirm('Excluir este terceiro? As medições de custo×retorno também serão removidas.')) return;
    setSalvando(true);
    if (editing.documento_url) await removeArquivo(editing.documento_url);
    const res = await excluirTerceiro(editing.id);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível excluir.'); return; }
    toastOk('Terceiro excluído.');
    await onDeleted();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="mb-1 text-lg font-bold text-ink">{editing ? 'Editar terceiro' : 'Novo terceiro'}</h3>
      <p className="mb-4 text-sm text-ink-muted">Serviço, modelo de custo, contrato e SLA. O retorno (receita, eventos, economia) é medido na aba Custo × Retorno.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Serviço" full><input value={servico} onChange={(e) => setServico(e.target.value)} className={inp} placeholder="Ex.: Segurança patrimonial, Contabilidade…" /></Campo>
        <Campo label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inp}>
            {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inp}>
            {STATUS_TERCEIRO.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </Campo>
        <Campo label="Fornecedor vinculado" full hint="Opcional — reaproveita o cadastro de Fornecedores e puxa o custo realizado de Contas a pagar.">
          <select value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)} className={inp}>
            <option value="">— Sem vínculo —</option>
            {fornecedores.map((f) => <option key={f.id} value={f.id}>{fornecedorLabel(f)}</option>)}
          </select>
        </Campo>

        <Campo label="Modelo de custo">
          <select value={modelo} onChange={(e) => setModelo(e.target.value)} className={inp}>
            {MODELOS_CUSTO.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}
          </select>
        </Campo>
        <Campo label={ehPercentual ? 'Percentual da receita (%)' : `Valor ${modeloUnidade(modelo)}`}>
          <input value={custo} onChange={(e) => setCusto(e.target.value)} inputMode="decimal" className={inp} placeholder={ehPercentual ? 'Ex.: 5' : '0,00'} />
        </Campo>

        <Campo label="Responsável interno"><input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inp} placeholder="Quem gerencia a relação" /></Campo>
        <Campo label="Custo p/ internalizar (/mês)" hint="Estimativa de trazer p/ dentro — alimenta a decisão.">
          <input value={custoInterno} onChange={(e) => setCustoInterno(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00 (opcional)" />
        </Campo>
      </div>

      {/* Contrato */}
      <div className="mt-5 rounded-xl border border-black/[0.06] bg-black/[0.015] p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink-soft"><IcoSignature /> Contrato</div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Vigência — início"><input type="date" value={vigIni} onChange={(e) => setVigIni(e.target.value)} className={inp} /></Campo>
          <Campo label="Vigência — fim"><input type="date" value={vigFim} onChange={(e) => setVigFim(e.target.value)} className={inp} /></Campo>
          <Campo label="Aviso prévio (dias)" hint="Antecedência para renovar ou rescindir."><input value={aviso} onChange={(e) => setAviso(e.target.value)} inputMode="numeric" className={inp} placeholder="30" /></Campo>
          <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-soft">
            <input type="checkbox" checked={renovAuto} onChange={(e) => setRenovAuto(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
            Renovação automática
          </label>
          <Campo label="Multa / glosa de rescisão" full><input value={multa} onChange={(e) => setMulta(e.target.value)} className={inp} placeholder="Ex.: 3 mensalidades, multa de 20%…" /></Campo>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {docUrl ? (
            <>
              <button onClick={abrirDoc} className={btnSecondary}><IcoDoc /> {docNome || 'Ver contrato'}</button>
              <button onClick={() => { setDocUrl(null); setDocNome(null); }} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><IcoTrash /> Remover</button>
            </>
          ) : (
            <label className={`${btnSecondary} cursor-pointer`}>
              <IcoDownload /> {enviando ? 'Enviando…' : 'Anexar contrato'}
              <input type="file" className="hidden" onChange={(e) => enviarDoc(e.target.files?.[0])} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" />
            </label>
          )}
        </div>
      </div>

      {/* SLA */}
      <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.015] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-bold text-ink-soft"><IcoCheckBadge /> SLA (nível de serviço)</span>
          <button onClick={addMeta} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><IcoPlus /> Meta</button>
        </div>
        <Campo label="Alvo agregado de cumprimento (%)" hint="Meta global de SLA — ex.: 95% das ocorrências dentro do prazo.">
          <input value={slaAlvoPct} onChange={(e) => setSlaAlvoPct(e.target.value)} inputMode="decimal" className={`${inp} max-w-[160px]`} placeholder="95" />
        </Campo>
        {metas.length > 0 && (
          <div className="mt-3 space-y-2">
            {metas.map((m, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-center gap-2">
                <input value={m.nome} onChange={(e) => setMeta(i, { nome: e.target.value })} className={inp} placeholder="Métrica (ex.: Tempo de resposta)" />
                <input value={m.alvo} onChange={(e) => setMeta(i, { alvo: e.target.value })} className={inp} placeholder="Alvo (ex.: ≤ 2h)" />
                <button onClick={() => delMeta(i)} aria-label="Remover meta" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <Campo label="Observações" full><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} placeholder="Escopo, contatos, condições especiais…" /></Campo>
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {editing ? (
          <button onClick={excluir} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"><IcoTrash /> Excluir</button>
        ) : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className={btnPrimary}><IcoCheck /> {salvando ? 'Salvando…' : 'Salvar terceiro'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

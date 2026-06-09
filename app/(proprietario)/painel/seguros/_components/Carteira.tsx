'use client';

// Aba "Carteira" — visão geral das apólices: KPIs, alertas de renovação,
// distribuição por escopo, filtros e a lista de apólices com o modal de
// cadastro/edição (coberturas, upload do documento e baixa do prêmio).

import { useMemo, useState } from 'react';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Seguro, type Cobertura, type Escopo, type StatusAdmin,
  ESCOPOS, ESCOPO_BY, escopoLabel, escopoCor, STATUS_ADMIN, SITUACAO_META,
  situacao, diasAte, resumoCarteira, aVencer, coberturaTotal,
  criarSeguro, salvarSeguro, excluirSeguro,
  uploadArquivo, signedUrl, removeArquivo, lancarDespesa, estornarDespesa,
  alvoLabel, inp, selCls,
} from '../_lib';
import type { SegurosBag } from './shared';
import {
  Kpi, ModalShell, Campo, EmptyState, Chip, btnPrimary, btnSecondary,
  IcoShield, IcoAlert, IcoPlus, IcoEdit, IcoTrash, IcoMoney, IcoUmbrella,
  IcoDoc, IcoDownload, IcoCheck, IcoX, IcoSearch,
} from './ui';

const numOrZero = (s: string): number => { const x = Number(String(s).replace(',', '.')); return Number.isFinite(x) ? x : 0; };

export default function Carteira({ bag }: { bag: SegurosBag }) {
  const toast = useToast();
  const { seguros, hoje, propsMap, eventosMap } = bag;
  const [busca, setBusca] = useState('');
  const [fEscopo, setFEscopo] = useState<'todos' | Escopo>('todos');
  const [fSituacao, setFSituacao] = useState<'todas' | 'vigentes' | 'a_vencer' | 'vencidas'>('todas');
  const [edit, setEdit] = useState<Seguro | 'novo' | null>(null);

  const resumo = useMemo(() => resumoCarteira(seguros, hoje), [seguros, hoje]);
  const renovacoes = useMemo(() => aVencer(seguros, hoje, 90), [seguros, hoje]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return seguros.filter((s) => {
      if (fEscopo !== 'todos' && s.escopo !== fEscopo) return false;
      const sit = situacao(s, hoje);
      if (fSituacao === 'vigentes' && !(sit === 'vigente' || sit === 'a_vencer')) return false;
      if (fSituacao === 'a_vencer' && sit !== 'a_vencer') return false;
      if (fSituacao === 'vencidas' && sit !== 'vencida') return false;
      if (q) {
        const hay = `${s.seguradora || ''} ${s.corretor || ''} ${s.apolice || ''} ${escopoLabel(s.escopo)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [seguros, busca, fEscopo, fSituacao, hoje]);

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Apólices vigentes" value={String(resumo.vigentes)} tone="verde" icon={<IcoShield />} sub={`de ${resumo.total} no total`} />
        <Kpi label="A vencer (30d)" value={String(resumo.aVencer)} tone={resumo.aVencer > 0 ? 'gold' : 'ink'} icon={<IcoAlert />} sub={`${renovacoes.filter((s) => { const d = diasAte(s.vigencia_fim, hoje); return d != null && d >= 0; }).length} em 90d`} />
        <Kpi label="Vencidas" value={String(resumo.vencidas)} tone={resumo.vencidas > 0 ? 'vermelho' : 'ink'} icon={<IcoAlert />} sub={resumo.vencidas > 0 ? 'renove com urgência' : 'tudo em dia'} />
        <Kpi label="Prêmio vigente" value={formatMoneyShort(resumo.premioVigente)} tone="brand" icon={<IcoMoney />} sub="custo das apólices ativas" />
        <Kpi label="Cobertura contratada" value={formatMoneyShort(resumo.coberturaVigente)} tone="azul" icon={<IcoUmbrella />} sub="soma dos limites vigentes" />
      </div>

      {/* Alertas de renovação */}
      {renovacoes.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800"><IcoAlert /> Renovações a acompanhar</div>
          <div className="space-y-1.5">
            {renovacoes.slice(0, 6).map((s) => {
              const d = diasAte(s.vigencia_fim, hoje);
              const vencida = d != null && d < 0;
              return (
                <button key={s.id} onClick={() => setEdit(s)} className="flex w-full items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2 text-left text-sm hover:bg-white">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: escopoCor(s.escopo) }} />
                    <span className="truncate font-medium text-ink">{s.seguradora || escopoLabel(s.escopo)}</span>
                    <span className="hidden truncate text-ink-muted sm:inline">· {escopoLabel(s.escopo)}</span>
                  </span>
                  <span className={`shrink-0 text-xs font-semibold ${vencida ? 'text-red-600' : 'text-amber-700'}`}>
                    {s.vigencia_fim ? formatDate(s.vigencia_fim, { style: 'short' }) : '—'}
                    {d != null && <> · {vencida ? `vencida há ${Math.abs(d)}d` : d === 0 ? 'vence hoje' : `${d}d`}</>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Distribuição por escopo */}
      {resumo.porEscopo.some((e) => e.premio > 0) && (
        <div className="rounded-2xl bg-white p-4 shadow-card">
          <h3 className="mb-3 text-sm font-bold text-ink">Prêmio por escopo</h3>
          <div className="space-y-2.5">
            {resumo.porEscopo.filter((e) => e.quantidade > 0).map((e) => {
              const pct = resumo.premioVigente > 0 ? e.premio / resumo.premioVigente : 0;
              return (
                <div key={e.escopo}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-ink-soft">{escopoLabel(e.escopo)} <span className="text-ink-muted">· {e.quantidade}</span></span>
                    <span className="font-semibold text-ink">{formatMoney(e.premio)}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct * 100)}%`, background: escopoCor(e.escopo) }} />
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
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar seguradora, corretor, nº da apólice…" className={`${inp} pl-9`} />
        </div>
        <select value={fEscopo} onChange={(e) => setFEscopo(e.target.value as typeof fEscopo)} className={selCls}>
          <option value="todos">Todos os escopos</option>
          {ESCOPOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
        </select>
        <select value={fSituacao} onChange={(e) => setFSituacao(e.target.value as typeof fSituacao)} className={selCls}>
          <option value="todas">Todas as situações</option>
          <option value="vigentes">Vigentes</option>
          <option value="a_vencer">A vencer</option>
          <option value="vencidas">Vencidas</option>
        </select>
        <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Nova apólice</button>
      </div>

      {/* Lista de apólices */}
      {seguros.length === 0 ? (
        <EmptyState icon={<IcoShield />} title="Nenhuma apólice cadastrada"
          cta={<button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Adicionar primeira apólice</button>}>
          Cadastre as apólices patrimoniais do espaço, de responsabilidade civil, por evento, de frota e equipamentos — com coberturas, vigência, prêmio e o documento. Os alertas de renovação e a sinistralidade aparecem aqui.
        </EmptyState>
      ) : filtradas.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center text-sm text-ink-muted shadow-card">Nenhuma apólice para os filtros atuais.</div>
      ) : (
        <div className="space-y-2.5">
          {filtradas.map((s) => (
            <ApoliceCard key={s.id} s={s} hoje={hoje} alvo={alvoLabel(s, propsMap, eventosMap)} onEdit={() => setEdit(s)} />
          ))}
        </div>
      )}

      {edit && (
        <SeguroModal
          bag={bag}
          editing={edit === 'novo' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={async () => { setEdit(null); await bag.recarregar(); }}
          onDeleted={async () => { setEdit(null); await bag.recarregar(); }}
          toastError={(m) => toast.error(m)}
          toastOk={(m) => toast.success(m)}
        />
      )}
    </div>
  );
}

// ── Card de apólice ─────────────────────────────────────────────────────────
function ApoliceCard({ s, hoje, alvo, onEdit }: { s: Seguro; hoje: string; alvo: string; onEdit: () => void }) {
  const sit = situacao(s, hoje);
  const meta = SITUACAO_META[sit];
  const cob = coberturaTotal(s.coberturas);
  return (
    <button onClick={onEdit} className="flex w-full flex-col gap-3 rounded-2xl bg-white p-4 text-left shadow-card transition hover:shadow-pop sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ background: escopoCor(s.escopo) + '1a', color: escopoCor(s.escopo) }}>
          <IcoShield />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-ink">{s.seguradora || 'Sem seguradora'}</span>
            <Chip className={ESCOPO_BY[s.escopo]?.chip || 'bg-black/[0.04] text-ink-soft'}>{escopoLabel(s.escopo)}</Chip>
            <Chip className={meta.chip}>{meta.label}</Chip>
          </div>
          <div className="mt-0.5 truncate text-xs text-ink-muted">
            {s.apolice ? `Apólice ${s.apolice}` : 'Sem nº'} · {alvo}
            {s.vigencia_fim && <> · vence {formatDate(s.vigencia_fim, { style: 'short' })}</>}
          </div>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 pl-12 sm:pl-0">
        <div className="text-right">
          <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">Prêmio</div>
          <div className="text-sm font-bold text-ink">{formatMoney(s.premio_num)}</div>
        </div>
        <div className="hidden text-right sm:block">
          <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">Cobertura</div>
          <div className="text-sm font-semibold text-ink-soft">{cob > 0 ? formatMoneyShort(cob) : '—'}</div>
        </div>
        <span className="text-ink-muted"><IcoEdit /></span>
      </div>
    </button>
  );
}

// ── Modal de cadastro/edição de apólice ─────────────────────────────────────
function SeguroModal({ bag, editing, onClose, onSaved, onDeleted, toastError, toastOk }: {
  bag: SegurosBag;
  editing: Seguro | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => Promise<void>;
  toastError: (m: string) => void;
  toastOk: (m: string) => void;
}) {
  const { userId, props, eventos, eventosMap, hoje } = bag;
  const [escopo, setEscopo] = useState<Escopo>(editing?.escopo ?? 'patrimonial');
  const [propriedadeId, setPropriedadeId] = useState<string>(editing?.propriedade_id != null ? String(editing.propriedade_id) : '');
  const [eventoId, setEventoId] = useState<string>(editing?.evento_id ?? '');
  const [seguradora, setSeguradora] = useState(editing?.seguradora ?? '');
  const [corretor, setCorretor] = useState(editing?.corretor ?? '');
  const [apolice, setApolice] = useState(editing?.apolice ?? '');
  const [cobs, setCobs] = useState<Cobertura[]>(editing?.coberturas?.length ? editing.coberturas : [{ item: '', limite_num: 0, franquia_num: null }]);
  const [franquia, setFranquia] = useState(editing?.franquia_num ? String(editing.franquia_num) : '');
  const [premio, setPremio] = useState(editing?.premio_num ? String(editing.premio_num) : '');
  const [vigIni, setVigIni] = useState(editing?.vigencia_inicio ?? '');
  const [vigFim, setVigFim] = useState(editing?.vigencia_fim ?? '');
  const [status, setStatus] = useState<StatusAdmin>(editing?.status ?? 'ativa');
  const [obs, setObs] = useState(editing?.obs ?? '');
  const [docUrl, setDocUrl] = useState<string | null>(editing?.documento_url ?? null);
  const [lancar, setLancar] = useState(editing ? editing.lancamento_id != null : true);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const ehEvento = escopo === 'evento' || escopo === 'acidentes';

  const setCob = (i: number, patch: Partial<Cobertura>) => setCobs((cs) => cs.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addCob = () => setCobs((cs) => [...cs, { item: '', limite_num: 0, franquia_num: null }]);
  const delCob = (i: number) => setCobs((cs) => cs.filter((_, idx) => idx !== i));

  const enviarDoc = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    try {
      const a = await uploadArquivo(userId, file, 'apolices/');
      setDocUrl(a.url);
      toastOk('Documento anexado.');
    } catch { toastError('Falha ao enviar o documento.'); }
    setEnviando(false);
  };
  const abrirDoc = async () => {
    const url = await signedUrl(docUrl);
    if (url) window.open(url, '_blank'); else toastError('Não foi possível abrir o documento.');
  };

  const salvar = async () => {
    const premioNum = numOrZero(premio);
    const coberturasLimpas = cobs.map((c) => ({ item: c.item.trim(), limite_num: numOrZero(String(c.limite_num)), franquia_num: c.franquia_num })).filter((c) => c.item || c.limite_num > 0);
    setSalvando(true);

    // Reconcilia o lançamento da despesa do prêmio (idempotente via lancamento_id).
    let lancamentoId = editing?.lancamento_id ?? null;
    const querLancar = lancar && premioNum > 0;
    const premioMudou = !!editing && editing.premio_num !== premioNum;
    if (lancamentoId != null && (!querLancar || premioMudou)) {
      await estornarDespesa(lancamentoId);
      lancamentoId = null;
    }
    if (querLancar && lancamentoId == null) {
      const ev = eventoId ? eventosMap.get(eventoId) : null;
      const desc = `Seguro ${escopoLabel(escopo)}${seguradora ? ` — ${seguradora}` : ''}${apolice ? ` (apólice ${apolice})` : ''}`;
      const propParaLanc = propriedadeId ? Number(propriedadeId) : ev?.propriedade_id ?? null;
      const lanc = await lancarDespesa({
        usuario_id: userId, descricao: desc, valor: premioNum,
        data: vigIni || hoje, prop_id: propParaLanc, tipo_evento: ev?.tipo_evento ?? null,
        observacao: 'Prêmio de seguro',
      });
      if (lanc) lancamentoId = lanc.id;
      else toastError('Apólice salva, mas não foi possível lançar o prêmio no Financeiro.');
    }

    const row = {
      usuario_id: userId,
      escopo,
      propriedade_id: propriedadeId ? Number(propriedadeId) : null,
      evento_id: eventoId || null,
      seguradora: seguradora.trim() || null,
      corretor: corretor.trim() || null,
      apolice: apolice.trim() || null,
      coberturas: coberturasLimpas,
      franquia_num: numOrZero(franquia),
      premio_num: premioNum,
      vigencia_inicio: vigIni || null,
      vigencia_fim: vigFim || null,
      status,
      documento_url: docUrl,
      lancamento_id: lancamentoId,
      obs: obs.trim() || null,
    };

    const res = editing ? await salvarSeguro(editing.id, row) : await criarSeguro(row);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível salvar a apólice.'); return; }
    toastOk(editing ? 'Apólice atualizada.' : 'Apólice cadastrada.');
    await onSaved();
  };

  const excluir = async () => {
    if (!editing) return;
    if (!confirm('Excluir esta apólice? Os sinistros vinculados também serão removidos.')) return;
    setSalvando(true);
    if (editing.lancamento_id != null) await estornarDespesa(editing.lancamento_id);
    if (editing.documento_url) await removeArquivo(editing.documento_url);
    const res = await excluirSeguro(editing.id);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível excluir.'); return; }
    toastOk('Apólice excluída.');
    await onDeleted();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="mb-1 text-lg font-bold text-ink">{editing ? 'Editar apólice' : 'Nova apólice'}</h3>
      <p className="mb-4 text-sm text-ink-muted">Coberturas, vigência e prêmio. A situação (vigente/a vencer/vencida) é calculada pela vigência.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Escopo">
          <select value={escopo} onChange={(e) => setEscopo(e.target.value as Escopo)} className={inp}>
            {ESCOPOS.map((e) => <option key={e.v} value={e.v}>{e.label}</option>)}
          </select>
        </Campo>
        <Campo label="Situação administrativa">
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusAdmin)} className={inp}>
            {STATUS_ADMIN.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </Campo>

        {ehEvento ? (
          <Campo label="Evento" full hint="A que evento esta apólice se refere.">
            <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className={inp}>
              <option value="">— Sem evento —</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome_evento || ev.quem_contratou || 'Evento'}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </Campo>
        ) : (
          <Campo label="Propriedade" full hint="O espaço coberto por esta apólice.">
            <select value={propriedadeId} onChange={(e) => setPropriedadeId(e.target.value)} className={inp}>
              <option value="">— Sem propriedade —</option>
              {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome}</option>)}
            </select>
          </Campo>
        )}

        <Campo label="Seguradora"><input value={seguradora} onChange={(e) => setSeguradora(e.target.value)} className={inp} placeholder="Ex.: Porto, Allianz…" /></Campo>
        <Campo label="Corretor"><input value={corretor} onChange={(e) => setCorretor(e.target.value)} className={inp} placeholder="Nome / corretora" /></Campo>
        <Campo label="Nº da apólice"><input value={apolice} onChange={(e) => setApolice(e.target.value)} className={inp} placeholder="Número" /></Campo>
        <Campo label="Franquia"><input value={franquia} onChange={(e) => setFranquia(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <Campo label="Vigência — início"><input type="date" value={vigIni} onChange={(e) => setVigIni(e.target.value)} className={inp} /></Campo>
        <Campo label="Vigência — fim"><input type="date" value={vigFim} onChange={(e) => setVigFim(e.target.value)} className={inp} /></Campo>
      </div>

      {/* Coberturas */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-soft">Coberturas e limites</span>
          <button onClick={addCob} className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"><IcoPlus /> Adicionar</button>
        </div>
        <div className="space-y-2">
          {cobs.map((c, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
              <input value={c.item} onChange={(e) => setCob(i, { item: e.target.value })} className={inp} placeholder="Item coberto (ex.: Incêndio, RC, Roubo)" />
              <input value={c.limite_num || ''} onChange={(e) => setCob(i, { limite_num: numOrZero(e.target.value) })} inputMode="decimal" className={`${inp} w-28`} placeholder="Limite" />
              <button onClick={() => delCob(i)} aria-label="Remover cobertura" className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Prêmio + lançamento */}
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Prêmio (custo da apólice)"><input value={premio} onChange={(e) => setPremio(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <label className="flex items-center gap-2 self-end pb-2.5 text-sm text-ink-soft">
          <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
          Lançar prêmio como despesa no Financeiro
        </label>
      </div>

      <Campo label="Observações" full><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} placeholder="Notas, condições, contato do sinistro…" /></Campo>

      {/* Documento */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {docUrl ? (
          <>
            <button onClick={abrirDoc} className={btnSecondary}><IcoDoc /> Ver documento</button>
            <button onClick={() => setDocUrl(null)} className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"><IcoTrash /> Remover</button>
          </>
        ) : (
          <label className={`${btnSecondary} cursor-pointer`}>
            <IcoDownload /> {enviando ? 'Enviando…' : 'Anexar documento da apólice'}
            <input type="file" className="hidden" onChange={(e) => enviarDoc(e.target.files?.[0])} accept=".pdf,.jpg,.jpeg,.png,.webp" />
          </label>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {editing ? (
          <button onClick={excluir} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"><IcoTrash /> Excluir</button>
        ) : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className={btnPrimary}><IcoCheck /> {salvando ? 'Salvando…' : 'Salvar apólice'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

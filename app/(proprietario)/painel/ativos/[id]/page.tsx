'use client';

// Ficha do ativo (patrimônio 360º) — /painel/ativos/[id].
// Raio-x de um bem: cabeçalho (foto, código, categoria, estado + badges de
// garantia/seguro/manutenção), métricas (aquisição, depreciação acumulada,
// valor contábil, custo de manutenção) e abas:
//   Visão geral  — dados editáveis com auto-save (geral, aquisição/depreciação,
//                  localização/responsável, garantia/seguro, veículo, baixa)
//   Depreciação  — cronograma linear anual + curva do valor contábil
//   Manutenção   — ordens de serviço (custo, status) + decisão repor×consertar
//   Movimentação — transferir entre propriedades/locais + baixa, com rastro
//   Documentos   — nota, manual, garantia, apólice (upload bucket `documentos`)
//   Etiqueta     — QR imprimível p/ colar no bem e conferir no inventário físico
// Sem "R$" hardcoded — tudo via lib/format.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatNumber, formatDate, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Ativo, type AtivoMov, type AtivoManutencao, type AtivoDoc, type PropriedadeLite, type FornecedorLite,
  type Categoria, type Estado, type ManutTipo, type ManutStatus, type ManutPrioridade, type MetodoDeprec,
  type Depreciacao, type LinhaAno, type VencStatus,
  CATEGORIAS, catLabel, catCor, catIcon, ESTADOS, ESTADO_BY, MOTIVOS_BAIXA,
  MANUT_TIPOS, MANUT_TIPO_BY, MANUT_STATUS, MANUT_STATUS_BY, MANUT_PRIORIDADES, MANUT_PRIORIDADE_BY,
  DOC_TIPOS, DOC_TIPO_LABEL, VENC_META, diasLabel,
  iniciais, ymd, formatBytes, isImagem, isPdf, uploadDoc, uploadFoto, signedUrl, removeArquivo,
  depreciar, cronogramaAnual, statusVencimento, diasAte, custoManutencao, manutencaoAbertas, indiceManutencao, sugereSubstituir,
} from '../_lib';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
type Tab = 'visao' | 'depreciacao' | 'manutencao' | 'movimentacao' | 'documentos' | 'etiqueta';
const TABS: { v: Tab; label: string }[] = [
  { v: 'visao', label: 'Visão geral' }, { v: 'depreciacao', label: 'Depreciação' },
  { v: 'manutencao', label: 'Manutenção' }, { v: 'movimentacao', label: 'Movimentação' },
  { v: 'documentos', label: 'Documentos' }, { v: 'etiqueta', label: 'Etiqueta QR' },
];

export default function AtivoFichaPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const nowMs = useMemo(() => Date.now(), []);

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [movs, setMovs] = useState<AtivoMov[]>([]);
  const [manuts, setManuts] = useState<AtivoManutencao[]>([]);
  const [docs, setDocs] = useState<AtivoDoc[]>([]);
  const [props, setProps] = useState<PropriedadeLite[]>([]);
  const [forns, setForns] = useState<FornecedorLite[]>([]);
  const [tab, setTab] = useState<Tab>('visao');

  // draft + auto-save
  const [draft, setDraft] = useState<Ativo | null>(null);
  const draftRef = useRef<Ativo | null>(null);
  const [saude, setSaude] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // modais
  const [manutModal, setManutModal] = useState(false);
  const [docModal, setDocModal] = useState(false);
  const [transfModal, setTransfModal] = useState(false);
  const [baixaModal, setBaixaModal] = useState(false);

  const carregar = useCallback(async (uid: string) => {
    const { data: a } = await sb.from('ativos').select('*').eq('id', id).eq('usuario_id', uid).maybeSingle();
    if (!a) { setNotFound(true); return; }
    const ativo = normalizaAtivo(a as Ativo);
    draftRef.current = ativo; setDraft(ativo);
    const [mvRes, mnRes, dcRes, pRes, fRes] = await Promise.all([
      sb.from('ativos_mov').select('*').eq('usuario_id', uid).eq('ativo_id', id).order('data', { ascending: false }),
      sb.from('ativos_manutencao').select('*').eq('usuario_id', uid).eq('ativo_id', id).order('data_abertura', { ascending: false }),
      sb.from('ativos_docs').select('*').eq('usuario_id', uid).eq('ativo_id', id).order('criado_em', { ascending: false }),
      sb.from('propriedades').select('id,nome,cidade').eq('usuario_id', uid),
      sb.from('fornecedores').select('id,nome,fantasia').eq('usuario_id', uid).order('nome', { ascending: true }),
    ]);
    setMovs(mvRes.error ? [] : (mvRes.data || []) as AtivoMov[]);
    setManuts(mnRes.error ? [] : ((mnRes.data || []) as AtivoManutencao[]).map((m) => ({ ...m, custo_num: Number(m.custo_num) || 0 })));
    setDocs(dcRes.error ? [] : (dcRes.data || []) as AtivoDoc[]);
    setProps(pRes.error ? [] : (pRes.data || []) as PropriedadeLite[]);
    setForns(fRes.error ? [] : (fRes.data || []) as FornecedorLite[]);
  }, [id]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  // ── Derivados ──
  const dep = useMemo<Depreciacao>(() => draft ? depreciar(draft, nowMs) : ({} as Depreciacao), [draft, nowMs]);
  const cronograma = useMemo<LinhaAno[]>(() => draft ? cronogramaAnual(draft) : [], [draft]);
  const custoManut = useMemo(() => custoManutencao(manuts), [manuts]);
  const osAbertas = useMemo(() => manutencaoAbertas(manuts), [manuts]);
  const propMap = useMemo(() => new Map(props.map((p) => [Number(p.id), p])), [props]);
  const propNome = (pid: number | null) => pid != null ? (propMap.get(Number(pid))?.nome || `Propriedade #${pid}`) : '';
  const fornNome = (fid: string | null) => fid ? (forns.find((f) => f.id === fid)?.fantasia || forns.find((f) => f.id === fid)?.nome || '') : '';

  // ── Auto-save ──
  function montar(d: Ativo) {
    return {
      nome: d.nome.trim() || 'Sem nome', codigo: d.codigo || null, categoria: d.categoria, descricao: d.descricao || null,
      marca: d.marca || null, modelo: d.modelo || null, num_serie: d.num_serie || null,
      propriedade_id: d.propriedade_id ?? null, localizacao: d.localizacao || null, responsavel: d.responsavel || null,
      fornecedor_id: d.fornecedor_id || null, data_aquisicao: d.data_aquisicao || null,
      valor_aquisicao_num: Number(d.valor_aquisicao_num) || 0, vida_util_meses: d.vida_util_meses ?? null,
      metodo_deprec: d.metodo_deprec, valor_residual_num: Number(d.valor_residual_num) || 0, estado: d.estado,
      placa: d.placa || null, renavam: d.renavam || null, ano_fabricacao: d.ano_fabricacao ?? null,
      garantia_ate: d.garantia_ate || null, seguradora: d.seguradora || null, apolice: d.apolice || null, seguro_ate: d.seguro_ate || null,
      baixado_em: d.baixado_em || null, motivo_baixa: d.motivo_baixa || null, valor_baixa_num: d.valor_baixa_num ?? null,
      foto_url: d.foto_url || null, obs: d.obs || null,
    };
  }
  const persist = useCallback(async () => {
    const d = draftRef.current; if (!d || !userId) return;
    const { error } = await sb.from('ativos').update(montar(d)).eq('id', d.id).eq('usuario_id', userId);
    if (error) { setSaude('idle'); toast.error('Erro ao salvar.'); return; }
    setSaude('saved'); setTimeout(() => setSaude((s) => (s === 'saved' ? 'idle' : s)), 1400);
  }, [userId, toast]);
  function scheduleSave() { if (saveTimer.current) clearTimeout(saveTimer.current); setSaude('saving'); saveTimer.current = setTimeout(() => void persist(), 700); }
  function updateDraft(patch: Partial<Ativo>) { const nd = { ...(draftRef.current as Ativo), ...patch }; draftRef.current = nd; setDraft(nd); scheduleSave(); }
  // Aplica no estado local SEM auto-save (a ação já persistiu diretamente no DB).
  function aplicarLocal(patch: Partial<Ativo>) { const nd = { ...(draftRef.current as Ativo), ...patch }; draftRef.current = nd; setDraft(nd); }

  async function excluir() {
    if (!userId || !draft) return;
    if (!confirm(`Excluir o ativo "${draft.nome}"? Manutenções, movimentações e documentos serão removidos.`)) return;
    if (draft.foto_url) await removeArquivo(draft.foto_url);
    const { error } = await sb.from('ativos').delete().eq('id', draft.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Ativo removido.'); router.push('/painel/ativos');
  }

  // ── Foto ──
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  useEffect(() => { (async () => { setFotoUrl(draft?.foto_url ? await signedUrl(draft.foto_url) : null); })(); }, [draft?.foto_url]);
  async function trocarFoto(file: File) {
    if (!userId || !draft) return;
    try {
      const up = await uploadFoto(userId, file);
      if (draft.foto_url) await removeArquivo(draft.foto_url);
      await sb.from('ativos').update({ foto_url: up.arquivo_url }).eq('id', draft.id).eq('usuario_id', userId);
      aplicarLocal({ foto_url: up.arquivo_url });
      toast.success('Foto atualizada.');
    } catch { toast.error('Erro ao enviar a foto.'); }
  }

  // ── Manutenção ──
  async function addManut(row: Omit<AtivoManutencao, 'id' | 'ativo_id' | 'usuario_id' | 'criado_em'>) {
    if (!userId || !draft) return;
    const { data, error } = await sb.from('ativos_manutencao').insert({ ...row, usuario_id: userId, ativo_id: draft.id }).select().single();
    if (error || !data) { toast.error('Erro ao registrar a OS.'); return; }
    setManuts((arr) => [{ ...(data as AtivoManutencao), custo_num: Number(data.custo_num) || 0 }, ...arr]);
    setManutModal(false); toast.success('Ordem de serviço registrada.');
  }
  async function updManutStatus(m: AtivoManutencao, status: ManutStatus) {
    if (!userId) return;
    const patch: Partial<AtivoManutencao> = { status };
    if (status === 'concluida' && !m.data_conclusao) patch.data_conclusao = ymd(new Date());
    const { error } = await sb.from('ativos_manutencao').update(patch).eq('id', m.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    setManuts((arr) => arr.map((x) => x.id === m.id ? { ...x, ...patch } : x));
  }
  async function rmManut(mid: string) {
    if (!userId) return;
    const { error } = await sb.from('ativos_manutencao').delete().eq('id', mid).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setManuts((arr) => arr.filter((m) => m.id !== mid));
  }

  // ── Documentos ──
  async function addDoc(row: Omit<AtivoDoc, 'id' | 'ativo_id' | 'usuario_id' | 'criado_em'>) {
    if (!userId || !draft) return;
    const { data, error } = await sb.from('ativos_docs').insert({ ...row, usuario_id: userId, ativo_id: draft.id }).select().single();
    if (error || !data) { toast.error('Erro ao salvar o documento.'); return; }
    setDocs((arr) => [data as AtivoDoc, ...arr]);
    setDocModal(false); toast.success('Documento adicionado.');
  }
  async function rmDoc(d: AtivoDoc) {
    if (!userId) return;
    if (d.arquivo_url) await removeArquivo(d.arquivo_url);
    const { error } = await sb.from('ativos_docs').delete().eq('id', d.id).eq('usuario_id', userId);
    if (error) { toast.error('Erro ao remover.'); return; }
    setDocs((arr) => arr.filter((x) => x.id !== d.id));
  }

  // ── Movimentação: transferência ──
  async function transferir(p: { propriedade_id: number | null; localizacao: string; responsavel: string; data: string; descricao: string }) {
    if (!userId || !draft) return;
    const movRow = {
      usuario_id: userId, ativo_id: draft.id, tipo: 'transferencia' as const, data: p.data,
      de_propriedade_id: draft.propriedade_id ?? null, para_propriedade_id: p.propriedade_id,
      de_local: draft.localizacao || null, para_local: p.localizacao || null,
      de_responsavel: draft.responsavel || null, para_responsavel: p.responsavel || null,
      valor_num: null, descricao: p.descricao || null,
    };
    const { data, error } = await sb.from('ativos_mov').insert(movRow).select().single();
    if (error || !data) { toast.error('Erro ao transferir.'); return; }
    await sb.from('ativos').update({ propriedade_id: p.propriedade_id, localizacao: p.localizacao || null, responsavel: p.responsavel || null }).eq('id', draft.id).eq('usuario_id', userId);
    aplicarLocal({ propriedade_id: p.propriedade_id, localizacao: p.localizacao || null, responsavel: p.responsavel || null });
    setMovs((arr) => [data as AtivoMov, ...arr]);
    setTransfModal(false); toast.success('Transferência registrada.');
  }

  // ── Movimentação: baixa / reativação ──
  async function baixar(p: { motivo: string; valor: number | null; data: string; descricao: string }) {
    if (!userId || !draft) return;
    const movRow = {
      usuario_id: userId, ativo_id: draft.id, tipo: 'baixa' as const, data: p.data,
      de_propriedade_id: draft.propriedade_id ?? null, para_propriedade_id: null,
      valor_num: p.valor, descricao: `${MOTIVOS_BAIXA.find((m) => m.v === p.motivo)?.label || p.motivo}${p.descricao ? ' · ' + p.descricao : ''}`,
    };
    const { data, error } = await sb.from('ativos_mov').insert(movRow).select().single();
    if (error || !data) { toast.error('Erro ao registrar a baixa.'); return; }
    await sb.from('ativos').update({ baixado_em: p.data, motivo_baixa: p.motivo, valor_baixa_num: p.valor }).eq('id', draft.id).eq('usuario_id', userId);
    aplicarLocal({ baixado_em: p.data, motivo_baixa: p.motivo, valor_baixa_num: p.valor });
    setMovs((arr) => [data as AtivoMov, ...arr]);
    setBaixaModal(false); toast.success('Ativo baixado.');
  }
  async function reativar() {
    if (!userId || !draft || !confirm('Reativar este ativo? A baixa será desfeita.')) return;
    await sb.from('ativos').update({ baixado_em: null, motivo_baixa: null, valor_baixa_num: null }).eq('id', draft.id).eq('usuario_id', userId);
    aplicarLocal({ baixado_em: null, motivo_baixa: null, valor_baixa_num: null });
    toast.success('Ativo reativado.');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-[120px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[88px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[300px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }
  if (notFound || !draft) {
    return (
      <div className="mx-auto max-w-5xl">
        <Link href="/painel/ativos" className="text-sm font-semibold text-brand hover:underline">← Voltar para Ativos</Link>
        <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
          <p className="text-base font-semibold text-ink">Ativo não encontrado</p>
          <p className="mt-1 text-sm text-ink-muted">Ele pode ter sido removido ou pertence a outra conta.</p>
        </div>
      </div>
    );
  }

  const cor = catCor(draft.categoria);
  const vencG = statusVencimento(draft.garantia_ate, nowMs);
  const vencS = statusVencimento(draft.seguro_ate, nowMs);
  const idadeMeses = draft.data_aquisicao ? Math.max(0, Math.round((nowMs - new Date(draft.data_aquisicao + 'T12:00:00Z').getTime()) / 2629800000)) : null;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Breadcrumb + status de salvamento */}
      <div className="flex items-center justify-between gap-3">
        <Link href="/painel/ativos" className="text-sm font-semibold text-brand hover:underline">← Ativos</Link>
        <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${saude === 'saving' ? 'bg-amber-50 text-amber-700' : saude === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'text-ink-muted'}`}>
          {saude === 'saving' ? 'Salvando…' : saude === 'saved' ? 'Salvo ✓' : ''}
        </span>
      </div>

      {/* Cabeçalho */}
      <div className="mt-3 rounded-2xl bg-white p-5 shadow-card">
        <div className="flex flex-wrap items-start gap-4">
          {fotoUrl ? (
            <img src={fotoUrl} alt={draft.nome} className="h-16 w-16 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: cor + '22' }}>{catIcon(draft.categoria)}</span>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-ink sm:text-2xl">{draft.nome}</h1>
              {draft.codigo && <span className="rounded bg-black/[0.05] px-1.5 py-0.5 font-mono text-[0.7rem] font-bold text-ink-muted">#{draft.codigo}</span>}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-black/[0.04] px-2.5 py-0.5 text-xs font-semibold text-ink-soft"><span className="h-2 w-2 rounded-full" style={{ background: cor }} />{catLabel(draft.categoria)}</span>
              {draft.baixado_em && <span className="rounded-full bg-black/[0.06] px-2.5 py-0.5 text-xs font-semibold text-ink-muted">Baixado {formatDate(draft.baixado_em, { style: 'short' })}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
              {[draft.marca, draft.modelo].filter(Boolean).join(' ') && <span>{[draft.marca, draft.modelo].filter(Boolean).join(' ')}</span>}
              {(propNome(draft.propriedade_id) || draft.localizacao) && <span>· 📍 {[propNome(draft.propriedade_id), draft.localizacao].filter(Boolean).join(' · ')}</span>}
              {draft.responsavel && <span>· 👤 {draft.responsavel}</span>}
            </div>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {/* Estado (editável) */}
              <select value={draft.estado} onChange={(e) => updateDraft({ estado: e.target.value as Estado })} className={`cursor-pointer rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30 ${ESTADO_BY[draft.estado]?.cls}`}>
                {ESTADOS.map((es) => <option key={es.v} value={es.v}>{es.label}</option>)}
              </select>
              {osAbertas > 0 && <button onClick={() => setTab('manutencao')} className="rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-semibold text-sky-700">🔧 {osAbertas} OS aberta(s)</button>}
              {draft.garantia_ate && vencG !== 'emdia' && <VencChip label="Garantia" status={vencG} dias={diasAte(draft.garantia_ate, nowMs)} onClick={() => setTab('visao')} />}
              {draft.seguro_ate && vencS !== 'emdia' && <VencChip label="Seguro" status={vencS} dias={diasAte(draft.seguro_ate, nowMs)} onClick={() => setTab('visao')} />}
            </div>
          </div>
          {/* Ações rápidas */}
          <div className="flex shrink-0 flex-wrap gap-2">
            <button onClick={() => setTab('etiqueta')} className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium hover:bg-black/[0.03]"><IcoQr /> Etiqueta</button>
            {!draft.baixado_em
              ? <button onClick={() => setBaixaModal(true)} className="flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">Dar baixa</button>
              : <button onClick={reativar} className="flex items-center gap-1.5 rounded-xl border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">Reativar</button>}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Valor de aquisição" value={formatMoneyShort(draft.valor_aquisicao_num)} sub={draft.data_aquisicao ? formatDate(draft.data_aquisicao, { style: 'short' }) : 'sem data'} tone="ink" />
        <Metric label="Depreciação acum." value={formatMoneyShort(dep.acumulada)} sub={dep.deprecia ? formatPercent(dep.percentual) : 'não deprecia'} tone="vermelho" />
        <Metric label="Valor contábil" value={formatMoney(dep.valorContabil)} sub={dep.deprecia ? `${dep.mesesDecorridos}/${dep.mesesVida} meses` : 'valor mantido'} tone="gold" />
        <Metric label="Custo manutenção" value={formatMoneyShort(custoManut)} sub={`${manuts.length} OS · ${osAbertas} aberta(s)`} tone={custoManut > 0 ? 'azul' : 'verde'} />
      </div>

      {/* Abas */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06]">
        {TABS.map((t) => {
          const n = t.v === 'manutencao' ? manuts.length : t.v === 'movimentacao' ? movs.length : t.v === 'documentos' ? docs.length : 0;
          return (
            <button key={t.v} onClick={() => setTab(t.v)} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-sm font-semibold transition ${tab === t.v ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink'}`}>
              {t.label}{n > 0 && <span className="ml-1.5 rounded-full bg-black/[0.05] px-1.5 py-0.5 text-[0.6rem] text-ink-muted">{n}</span>}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        {tab === 'visao' && (
          <VisaoTab draft={draft} props={props} forns={forns} nowMs={nowMs} onUpdate={updateDraft} onFoto={trocarFoto} onExcluir={excluir} />
        )}
        {tab === 'depreciacao' && <DepreciacaoTab draft={draft} dep={dep} cronograma={cronograma} onUpdate={updateDraft} />}
        {tab === 'manutencao' && <ManutencaoTab manuts={manuts} custoManut={custoManut} valorContabil={dep.valorContabil} forns={forns} onNew={() => setManutModal(true)} onStatus={updManutStatus} onRemove={rmManut} />}
        {tab === 'movimentacao' && <MovimentacaoTab movs={movs} propNome={propNome} baixado={!!draft.baixado_em} onTransfer={() => setTransfModal(true)} onBaixar={() => setBaixaModal(true)} />}
        {tab === 'documentos' && <DocumentosTab docs={docs} nowMs={nowMs} onNew={() => setDocModal(true)} onRemove={rmDoc} />}
        {tab === 'etiqueta' && <EtiquetaTab ativo={draft} propNome={propNome(draft.propriedade_id)} />}
      </div>

      {manutModal && <ManutModal forns={forns} onClose={() => setManutModal(false)} onSave={addManut} />}
      {docModal && userId && <DocModal userId={userId} onClose={() => setDocModal(false)} onSave={addDoc} />}
      {transfModal && <TransferModal atual={draft} props={props} onClose={() => setTransfModal(false)} onSave={transferir} />}
      {baixaModal && <BaixaModal valorContabil={dep.valorContabil} onClose={() => setBaixaModal(false)} onSave={baixar} />}
    </div>
  );
}

function normalizaAtivo(a: Ativo): Ativo {
  return {
    ...a,
    valor_aquisicao_num: Number(a.valor_aquisicao_num) || 0,
    valor_residual_num: Number(a.valor_residual_num) || 0,
    vida_util_meses: a.vida_util_meses == null ? null : Number(a.vida_util_meses),
    valor_baixa_num: a.valor_baixa_num == null ? null : Number(a.valor_baixa_num),
    propriedade_id: a.propriedade_id == null ? null : Number(a.propriedade_id),
    ano_fabricacao: a.ano_fabricacao == null ? null : Number(a.ano_fabricacao),
  };
}

// ── Aba: Visão geral (dados editáveis) ───────────────────────────────────────────
function VisaoTab({ draft, props, forns, nowMs, onUpdate, onFoto, onExcluir }: {
  draft: Ativo; props: PropriedadeLite[]; forns: FornecedorLite[]; nowMs: number;
  onUpdate: (p: Partial<Ativo>) => void; onFoto: (f: File) => void; onExcluir: () => void;
}) {
  const ehVeiculo = draft.categoria === 'veiculo';
  const vencG = statusVencimento(draft.garantia_ate, nowMs);
  const vencS = statusVencimento(draft.seguro_ate, nowMs);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        {/* Identificação */}
        <Card title="Identificação">
          <div className="space-y-3">
            <div className="grid grid-cols-[1fr_150px] gap-3">
              <Campo label="Nome do bem"><input className={inp} value={draft.nome} onChange={(e) => onUpdate({ nome: e.target.value })} /></Campo>
              <Campo label="Código / Patrimônio"><input className={inp} value={draft.codigo || ''} onChange={(e) => onUpdate({ codigo: e.target.value })} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Categoria"><select className={inp} value={draft.categoria} onChange={(e) => onUpdate({ categoria: e.target.value as Categoria })}>{CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.icon} {c.label}</option>)}</select></Campo>
              <Campo label="Estado"><select className={inp} value={draft.estado} onChange={(e) => onUpdate({ estado: e.target.value as Estado })}>{ESTADOS.map((es) => <option key={es.v} value={es.v}>{es.label}</option>)}</select></Campo>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Campo label="Marca"><input className={inp} value={draft.marca || ''} onChange={(e) => onUpdate({ marca: e.target.value })} /></Campo>
              <Campo label="Modelo"><input className={inp} value={draft.modelo || ''} onChange={(e) => onUpdate({ modelo: e.target.value })} /></Campo>
              <Campo label="Nº de série"><input className={inp} value={draft.num_serie || ''} onChange={(e) => onUpdate({ num_serie: e.target.value })} /></Campo>
            </div>
            {ehVeiculo && (
              <div className="grid grid-cols-3 gap-3 rounded-xl bg-black/[0.015] p-3">
                <Campo label="Placa"><input className={inp} value={draft.placa || ''} onChange={(e) => onUpdate({ placa: e.target.value.toUpperCase() })} placeholder="ABC1D23" /></Campo>
                <Campo label="RENAVAM"><input className={inp} value={draft.renavam || ''} onChange={(e) => onUpdate({ renavam: e.target.value })} /></Campo>
                <Campo label="Ano fabricação"><input type="number" className={inp} value={draft.ano_fabricacao ?? ''} onChange={(e) => onUpdate({ ano_fabricacao: e.target.value ? Number(e.target.value) : null })} /></Campo>
              </div>
            )}
            <Campo label="Descrição"><textarea rows={2} className={inp} value={draft.descricao || ''} onChange={(e) => onUpdate({ descricao: e.target.value })} placeholder="Detalhes do bem…" /></Campo>
          </div>
        </Card>

        {/* Aquisição & depreciação */}
        <Card title="Aquisição & depreciação">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Data de aquisição"><input type="date" className={inp} value={draft.data_aquisicao || ''} onChange={(e) => onUpdate({ data_aquisicao: e.target.value })} /></Campo>
              <Campo label="Fornecedor (onde comprou)">
                <select className={inp} value={draft.fornecedor_id || ''} onChange={(e) => onUpdate({ fornecedor_id: e.target.value || null })}>
                  <option value="">— Não informado —</option>
                  {forns.map((f) => <option key={f.id} value={f.id}>{f.fantasia || f.nome}</option>)}
                </select>
              </Campo>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Campo label="Valor de aquisição"><input type="number" min={0} step="0.01" className={inp} value={draft.valor_aquisicao_num || ''} onChange={(e) => onUpdate({ valor_aquisicao_num: Number(e.target.value) || 0 })} /></Campo>
              <Campo label="Valor residual"><input type="number" min={0} step="0.01" className={inp} value={draft.valor_residual_num || ''} onChange={(e) => onUpdate({ valor_residual_num: Number(e.target.value) || 0 })} placeholder="0,00" /></Campo>
              <Campo label="Vida útil (meses)"><input type="number" min={0} className={inp} value={draft.vida_util_meses ?? ''} onChange={(e) => onUpdate({ vida_util_meses: e.target.value ? Number(e.target.value) : null })} /></Campo>
            </div>
            <Campo label="Método de depreciação">
              <div className="flex gap-2">
                {(['linear', 'nenhum'] as MetodoDeprec[]).map((m) => (
                  <button key={m} onClick={() => onUpdate({ metodo_deprec: m })} className={`flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition ${draft.metodo_deprec === m ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-black/20'}`}>{m === 'linear' ? 'Linear (mensal)' : 'Não deprecia'}</button>
                ))}
              </div>
            </Campo>
          </div>
        </Card>

        {/* Garantia & seguro */}
        <Card title="Garantia & seguro">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Garantia até"><input type="date" className={inp} value={draft.garantia_ate || ''} onChange={(e) => onUpdate({ garantia_ate: e.target.value })} /></Campo>
              <div className="flex items-end pb-2.5">{draft.garantia_ate && <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${VENC_META[vencG].cls}`}>{VENC_META[vencG].label} · {diasLabel(diasAte(draft.garantia_ate, nowMs))}</span>}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Seguradora"><input className={inp} value={draft.seguradora || ''} onChange={(e) => onUpdate({ seguradora: e.target.value })} /></Campo>
              <Campo label="Apólice"><input className={inp} value={draft.apolice || ''} onChange={(e) => onUpdate({ apolice: e.target.value })} /></Campo>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Campo label="Seguro até"><input type="date" className={inp} value={draft.seguro_ate || ''} onChange={(e) => onUpdate({ seguro_ate: e.target.value })} /></Campo>
              <div className="flex items-end pb-2.5">{draft.seguro_ate && <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${VENC_META[vencS].cls}`}>{VENC_META[vencS].label} · {diasLabel(diasAte(draft.seguro_ate, nowMs))}</span>}</div>
            </div>
          </div>
        </Card>

        <Card title="Observações">
          <textarea rows={3} className={inp} value={draft.obs || ''} onChange={(e) => onUpdate({ obs: e.target.value })} placeholder="Anotações internas sobre o bem…" />
          <div className="mt-4 flex border-t border-black/[0.06] pt-4">
            <button onClick={onExcluir} className="ml-auto rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">Excluir ativo</button>
          </div>
        </Card>
      </div>

      {/* Sidebar: foto + localização */}
      <div className="space-y-5">
        <Card title="Foto">
          <FotoBox draft={draft} onFoto={onFoto} />
        </Card>
        <Card title="Localização & responsável">
          <div className="space-y-3">
            <Campo label="Propriedade (onde fica)">
              <select className={inp} value={draft.propriedade_id ?? ''} onChange={(e) => onUpdate({ propriedade_id: e.target.value ? Number(e.target.value) : null })}>
                <option value="">— Sem propriedade —</option>
                {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome || `Propriedade #${p.id}`}</option>)}
              </select>
            </Campo>
            <Campo label="Localização (local)"><input className={inp} value={draft.localizacao || ''} onChange={(e) => onUpdate({ localizacao: e.target.value })} placeholder="Galpão A · prateleira 3" /></Campo>
            <Campo label="Responsável"><input className={inp} value={draft.responsavel || ''} onChange={(e) => onUpdate({ responsavel: e.target.value })} /></Campo>
            <p className="text-xs text-ink-muted">Para mudar de lugar mantendo o histórico, use <strong>Movimentação → Transferir</strong>.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function FotoBox({ draft, onFoto }: { draft: Ativo; onFoto: (f: File) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { (async () => { setUrl(draft.foto_url ? await signedUrl(draft.foto_url) : null); })(); }, [draft.foto_url]);
  return (
    <label className="block cursor-pointer">
      {url ? (
        <img src={url} alt={draft.nome} className="h-40 w-full rounded-xl object-cover" />
      ) : (
        <div className="flex h-40 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 text-center transition hover:border-brand/40">
          <span className="text-3xl">{catIcon(draft.categoria)}</span>
          <span className="text-sm font-semibold text-ink-soft">{busy ? 'Enviando…' : 'Adicionar foto'}</span>
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setBusy(true); await onFoto(f); setBusy(false); } }} />
      {url && <span className="mt-2 block text-center text-xs font-semibold text-brand">Trocar foto</span>}
    </label>
  );
}

// ── Aba: Depreciação ─────────────────────────────────────────────────────────────
function DepreciacaoTab({ draft, dep, cronograma, onUpdate }: { draft: Ativo; dep: Depreciacao; cronograma: LinhaAno[]; onUpdate: (p: Partial<Ativo>) => void }) {
  const anoAtual = dep.deprecia ? Math.min(cronograma.length, Math.floor(dep.mesesDecorridos / 12) + (dep.mesesDecorridos % 12 ? 1 : 0) || 1) : 0;
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <div className="space-y-5">
        <Card title="Resumo da depreciação">
          {!dep.deprecia ? (
            <div className="text-sm text-ink-muted">
              <p>Este ativo <strong>não deprecia</strong> (método &quot;Não deprecia&quot; ou sem vida útil). Comum para terrenos.</p>
              <p className="mt-2">Defina vida útil e método linear na aba <strong>Visão geral</strong> para projetar a depreciação.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <Cell label="Valor depreciável" value={formatMoney(dep.base)} tone="text-ink" />
              <Cell label="Depreciação mensal" value={formatMoney(dep.mensal)} tone="text-blue-600" />
              <Cell label="Acumulada até hoje" value={formatMoney(dep.acumulada)} tone="text-red-600" />
              <Cell label="Valor contábil" value={formatMoney(dep.valorContabil)} tone="text-amber-600" />
              <div>
                <div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-soft">Progresso</span><span className="font-semibold text-ink-muted">{formatPercent(dep.percentual)} · {dep.mesesDecorridos}/{dep.mesesVida}m</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round(dep.percentual * 100)}%` }} /></div>
              </div>
              {dep.fimVidaUtil && <p className="text-xs text-ink-muted">Fim da vida útil: <strong>{formatDate(dep.fimVidaUtil)}</strong>{dep.totalmenteDepreciado ? ' · totalmente depreciado' : ''}</p>}
            </div>
          )}
        </Card>
      </div>

      <Card title="Cronograma de depreciação (linear)">
        {!dep.deprecia || cronograma.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Sem cronograma — configure vida útil e método linear.</p>
        ) : (
          <>
            <LineDeprec aquisicao={draft.valor_aquisicao_num} cronograma={cronograma} />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Ano</th>
                    <th className="pb-2 text-right font-semibold">Depreciação</th>
                    <th className="pb-2 text-right font-semibold">Acumulada</th>
                    <th className="pb-2 text-right font-semibold">Valor contábil</th>
                  </tr>
                </thead>
                <tbody>
                  {cronograma.map((l) => (
                    <tr key={l.ano} className={`border-b border-black/[0.04] last:border-0 ${l.ano === anoAtual ? 'bg-amber-50/40' : ''}`}>
                      <td className="py-2 font-semibold text-ink">Ano {l.ano}{l.ano === anoAtual && <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-700">atual</span>}{l.meses < 12 && <span className="ml-1 text-[0.65rem] font-normal text-ink-muted">({l.meses}m)</span>}</td>
                      <td className="py-2 text-right text-red-600">−{formatMoney(l.depreciacao)}</td>
                      <td className="py-2 text-right text-ink-muted">{formatMoney(l.acumulada)}</td>
                      <td className="py-2 text-right font-semibold text-ink">{formatMoney(l.valorContabil)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-ink-muted">A depreciação mensal pode ser lançada como despesa na Contabilidade (despesa de depreciação) via vínculo ativo↔lançamento.</p>
          </>
        )}
      </Card>
    </div>
  );
}

function LineDeprec({ aquisicao, cronograma }: { aquisicao: number; cronograma: LinhaAno[] }) {
  const W = 520, H = 140, pad = 8;
  const pts = [aquisicao, ...cronograma.map((l) => l.valorContabil)];
  const max = Math.max(...pts, 1), n = pts.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / max) * (H - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const area = `${d} L ${x(n - 1).toFixed(1)} ${H - pad} L ${x(0).toFixed(1)} ${H - pad} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 140 }}>
      <path d={area} fill="#f59e0b" opacity={0.08} />
      <path d={d} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.5} fill="#f59e0b" />)}
    </svg>
  );
}

// ── Aba: Manutenção ──────────────────────────────────────────────────────────────
function ManutencaoTab({ manuts, custoManut, valorContabil, forns, onNew, onStatus, onRemove }: {
  manuts: AtivoManutencao[]; custoManut: number; valorContabil: number; forns: FornecedorLite[];
  onNew: () => void; onStatus: (m: AtivoManutencao, s: ManutStatus) => void; onRemove: (id: string) => void;
}) {
  const indice = indiceManutencao(custoManut, valorContabil);
  const repor = sugereSubstituir(custoManut, valorContabil);
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[300px_1fr]">
      <div className="space-y-5">
        <Card title="Custos & decisão">
          <div className="space-y-3">
            <Cell label="Custo de manutenção (total)" value={formatMoney(custoManut)} tone="text-blue-600" />
            <Cell label="Valor contábil atual" value={formatMoney(valorContabil)} tone="text-amber-600" />
            <Cell label="Índice manutenção/valor" value={Number.isFinite(indice) ? formatPercent(indice) : '∞'} tone={repor ? 'text-red-600' : 'text-ink'} />
          </div>
          {custoManut > 0 && (
            <div className={`mt-3 rounded-xl border p-3 text-xs ${repor ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
              {repor ? '⚠️ A manutenção já consome boa parte do valor do bem. Avalie substituir em vez de consertar.' : '✅ Custo de manutenção sob controle frente ao valor do bem.'}
            </div>
          )}
          <button onClick={onNew} className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Nova ordem de serviço</button>
        </Card>
      </div>
      <Card title="Ordens de serviço">
        {manuts.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Sem manutenções. Registre OS preventivas (plano periódico) e corretivas (quando quebra) para acompanhar custo e histórico.</p>
        ) : (
          <div className="space-y-2.5">
            {manuts.map((m) => {
              const fName = m.fornecedor_id ? (forns.find((f) => f.id === m.fornecedor_id)?.fantasia || forns.find((f) => f.id === m.fornecedor_id)?.nome) : null;
              return (
                <div key={m.id} className="group rounded-xl border border-black/[0.06] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-sm">{MANUT_TIPO_BY[m.tipo]?.icon}</span>
                        <span className="truncate font-semibold text-ink">{m.titulo}</span>
                        <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-semibold ${MANUT_PRIORIDADE_BY[m.prioridade]?.cls}`}>{MANUT_PRIORIDADE_BY[m.prioridade]?.label}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {MANUT_TIPO_BY[m.tipo]?.label} · {formatDate(m.data_abertura, { style: 'short' })}
                        {m.prazo ? ` · prazo ${formatDate(m.prazo, { style: 'short' })}` : ''}
                        {m.responsavel ? ` · ${m.responsavel}` : ''}{fName ? ` · ${fName}` : ''}
                      </p>
                      {m.descricao && <p className="mt-1 text-sm text-ink-soft">{m.descricao}</p>}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-bold text-ink">{m.custo_num > 0 ? formatMoney(m.custo_num) : '—'}</span>
                      <button onClick={() => onRemove(m.id)} className="text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>
                    </div>
                  </div>
                  <div className="mt-2">
                    <select value={m.status} onChange={(e) => onStatus(m, e.target.value as ManutStatus)} className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-brand/30 ${MANUT_STATUS_BY[m.status]?.cls}`}>
                      {MANUT_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                    </select>
                    {m.data_conclusao && <span className="ml-2 text-xs text-ink-muted">Concluída em {formatDate(m.data_conclusao, { style: 'short' })}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Aba: Movimentação ────────────────────────────────────────────────────────────
function MovimentacaoTab({ movs, propNome, baixado, onTransfer, onBaixar }: {
  movs: AtivoMov[]; propNome: (id: number | null) => string; baixado: boolean; onTransfer: () => void; onBaixar: () => void;
}) {
  const MOV_META: Record<string, { label: string; icon: string; cls: string }> = {
    aquisicao: { label: 'Aquisição', icon: '🛒', cls: 'bg-emerald-50 text-emerald-700' },
    transferencia: { label: 'Transferência', icon: '🔄', cls: 'bg-blue-50 text-blue-700' },
    manutencao: { label: 'Manutenção', icon: '🔧', cls: 'bg-sky-50 text-sky-700' },
    baixa: { label: 'Baixa', icon: '📤', cls: 'bg-red-50 text-red-700' },
    reavaliacao: { label: 'Reavaliação', icon: '⚖️', cls: 'bg-amber-50 text-amber-700' },
    depreciacao: { label: 'Depreciação', icon: '📉', cls: 'bg-black/[0.04] text-ink-muted' },
  };
  return (
    <Card title="Histórico de movimentação">
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={onTransfer} disabled={baixado} className="rounded-xl border border-black/10 px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand disabled:opacity-50">🔄 Transferir</button>
        <button onClick={onBaixar} disabled={baixado} className="rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50">📤 Dar baixa</button>
        {baixado && <span className="self-center text-xs text-ink-muted">Ativo baixado — reative na aba Visão geral para movimentar.</span>}
      </div>
      {movs.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Sem movimentações. Transferências entre propriedades/locais e baixas (venda/perda/sucateamento) aparecem aqui com rastro completo.</p>
      ) : (
        <div className="space-y-2">
          {movs.map((mv) => {
            const meta = MOV_META[mv.tipo] || MOV_META.transferencia;
            const de = [propNome(mv.de_propriedade_id), mv.de_local].filter(Boolean).join(' · ');
            const para = [propNome(mv.para_propriedade_id), mv.para_local].filter(Boolean).join(' · ');
            return (
              <div key={mv.id} className="flex items-start gap-3 rounded-xl border border-black/[0.06] p-3">
                <span className="text-lg">{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${meta.cls}`}>{meta.label}</span>
                    <span className="text-xs text-ink-muted">{formatDate(mv.data, { style: 'short' })}</span>
                  </div>
                  {mv.tipo === 'transferencia' && (de || para) && <p className="mt-1 text-sm text-ink-soft">{de || '—'} → <strong>{para || '—'}</strong></p>}
                  {mv.descricao && <p className="mt-1 text-sm text-ink-soft">{mv.descricao}</p>}
                </div>
                {mv.valor_num != null && <span className="shrink-0 text-sm font-bold text-ink">{formatMoney(mv.valor_num)}</span>}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ── Aba: Documentos ──────────────────────────────────────────────────────────────
function DocumentosTab({ docs, nowMs, onNew, onRemove }: { docs: AtivoDoc[]; nowMs: number; onNew: () => void; onRemove: (d: AtivoDoc) => void }) {
  return (
    <Card title="Documentos do ativo" action={<button onClick={onNew} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">+ Adicionar documento</button>}>
      {docs.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">Anexe nota fiscal, manual, termo de garantia e apólice de seguro. Documentos com validade avisam quando estão perto de vencer.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {docs.map((d) => <DocCard key={d.id} doc={d} nowMs={nowMs} onRemove={() => onRemove(d)} />)}
        </div>
      )}
    </Card>
  );
}

function DocCard({ doc, nowMs, onRemove }: { doc: AtivoDoc; nowMs: number; onRemove: () => void }) {
  const toast = useToast();
  const status = statusVencimento(doc.validade, nowMs);
  const meta = VENC_META[status];
  const [baixando, setBaixando] = useState(false);
  async function baixar() {
    if (!doc.arquivo_url) return;
    setBaixando(true);
    const url = await signedUrl(doc.arquivo_url);
    setBaixando(false);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Não foi possível abrir o arquivo.');
  }
  return (
    <div className="group rounded-xl border border-black/[0.06] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">{doc.arquivo_tipo ? (isImagem(doc.arquivo_tipo) ? '🖼️' : isPdf(doc.arquivo_tipo) ? '📄' : '📎') : '📄'}</span>
            <span className="truncate font-semibold text-ink">{doc.nome}</span>
          </div>
          <p className="mt-0.5 text-xs text-ink-muted">{DOC_TIPO_LABEL[doc.tipo] || doc.tipo}</p>
        </div>
        {doc.validade && <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${meta.cls}`}>{meta.label}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 text-xs">
        <span className="text-ink-muted">{doc.validade ? <>Vence {formatDate(doc.validade, { style: 'short' })} · <span style={{ color: meta.cor }}>{diasLabel(diasAte(doc.validade, nowMs))}</span></> : 'Sem vencimento'}</span>
        <div className="flex items-center gap-2">
          {doc.arquivo_url && <button onClick={baixar} disabled={baixando} className="font-semibold text-brand hover:underline disabled:opacity-50">{baixando ? '…' : 'Abrir'}</button>}
          {doc.arquivo_tamanho ? <span className="text-ink-muted">{formatBytes(doc.arquivo_tamanho)}</span> : null}
          <button onClick={onRemove} className="text-ink-muted opacity-0 transition hover:text-red-600 group-hover:opacity-100" aria-label="Remover">✕</button>
        </div>
      </div>
    </div>
  );
}

// ── Aba: Etiqueta QR ──────────────────────────────────────────────────────────────
// O QR é gerado por um serviço público (api.qrserver.com) via <img> — sem
// dependência npm nova. O payload é a URL desta ficha (uuid, não sensível): ao
// bipar, abre o ativo para conferência física do inventário. Há fallback visual.
function EtiquetaTab({ ativo, propNome }: { ativo: Ativo; propNome: string }) {
  const [origin, setOrigin] = useState('');
  useEffect(() => { setOrigin(window.location.origin); }, []);
  const payload = `${origin}/painel/ativos/${ativo.id}`;
  const qr = (size: number) => `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(payload)}`;
  const codigo = ativo.codigo || ativo.id.slice(0, 8).toUpperCase();

  function imprimir() {
    const w = window.open('', '_blank', 'width=420,height=600'); if (!w) return;
    const linha = [catLabel(ativo.categoria), propNome].filter(Boolean).join(' · ');
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Etiqueta ${codigo}</title>
      <style>
        *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;margin:0}
        body{display:flex;align-items:center;justify-content:center;padding:24px}
        .tag{width:300px;border:2px solid #0d0d0d;border-radius:12px;padding:16px;text-align:center}
        .brand{font-style:italic;font-weight:bold;color:#ff385c;font-size:14px;letter-spacing:.5px}
        .nome{font-size:16px;font-weight:bold;margin:6px 0;color:#0d0d0d}
        .cod{font-family:monospace;font-size:22px;font-weight:bold;letter-spacing:1px;margin:4px 0}
        .sub{font-size:11px;color:#555;margin-top:4px}
        img{margin:10px auto 0;display:block}
      </style></head><body>
      <div class="tag">
        <div class="brand">VENTSY</div>
        <div class="nome">${escapeHtml(ativo.nome)}</div>
        <div class="cod">${escapeHtml(codigo)}</div>
        <img src="${qr(180)}" width="180" height="180" alt="QR" onload="window.focus();window.print()" />
        ${linha ? `<div class="sub">${escapeHtml(linha)}</div>` : ''}
      </div></body></html>`);
    w.document.close();
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[320px_1fr]">
      <Card title="Etiqueta de patrimônio">
        {/* Preview da etiqueta */}
        <div className="mx-auto w-[260px] rounded-xl border-2 border-ink p-4 text-center">
          <div className="font-display text-sm font-bold italic text-brand">VENTSY</div>
          <div className="mt-1 text-base font-bold text-ink">{ativo.nome}</div>
          <div className="my-1 font-mono text-xl font-bold tracking-wider text-ink">{codigo}</div>
          {origin
            ? <img src={qr(160)} width={160} height={160} alt="QR code" className="mx-auto mt-2" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
            : <div className="mx-auto mt-2 flex h-40 w-40 items-center justify-center rounded bg-black/[0.04] text-xs text-ink-muted">gerando…</div>}
          <div className="mt-2 text-[0.7rem] text-ink-muted">{[catLabel(ativo.categoria), propNome].filter(Boolean).join(' · ')}</div>
        </div>
        <button onClick={imprimir} className="mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-600">🖨️ Imprimir etiqueta</button>
      </Card>
      <Card title="Como usar">
        <ol className="list-inside list-decimal space-y-2 text-sm text-ink-soft">
          <li>Defina um <strong>código de patrimônio</strong> na aba Visão geral (ex.: PAT-0001). Sem código, usamos um identificador curto.</li>
          <li>Clique em <strong>Imprimir etiqueta</strong> e cole no bem.</li>
          <li>Na <strong>conciliação física</strong>, bipe o QR com a câmera do celular: ele abre esta ficha para conferir localização, estado e responsável.</li>
        </ol>
        <p className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.015] p-3 text-xs text-ink-muted">O QR aponta para a URL desta ficha. A leitura exige login na conta — a etiqueta não expõe dados sensíveis do bem.</p>
      </Card>
    </div>
  );
}

function escapeHtml(s: string): string {
  return (s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

// ── Modais ────────────────────────────────────────────────────────────────────
function ManutModal({ forns, onClose, onSave }: { forns: FornecedorLite[]; onClose: () => void; onSave: (row: Omit<AtivoManutencao, 'id' | 'ativo_id' | 'usuario_id' | 'criado_em'>) => void }) {
  const [tipo, setTipo] = useState<ManutTipo>('corretiva');
  const [titulo, setTitulo] = useState(''); const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] = useState<ManutPrioridade>('media');
  const [status, setStatus] = useState<ManutStatus>('aberta');
  const [responsavel, setResponsavel] = useState(''); const [fornecedorId, setFornecedorId] = useState('');
  const [abertura, setAbertura] = useState(ymd(new Date())); const [prazo, setPrazo] = useState('');
  const [conclusao, setConclusao] = useState(''); const [custo, setCusto] = useState('');
  const [saving, setSaving] = useState(false);
  useEscClose(onClose);
  function salvar() {
    if (!titulo.trim()) return;
    setSaving(true);
    onSave({
      tipo, titulo: titulo.trim(), descricao: descricao.trim() || null, prioridade, status,
      responsavel: responsavel.trim() || null, fornecedor_id: fornecedorId || null, os_id: null,
      data_abertura: abertura, prazo: prazo || null, data_conclusao: conclusao || null, custo_num: Number(custo) || 0, obs: null,
    });
  }
  return (
    <Modal onClose={onClose} title="Nova ordem de serviço">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value as ManutTipo)}>{MANUT_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.icon} {t.label}</option>)}</select></Campo>
          <Campo label="Prioridade"><select className={inp} value={prioridade} onChange={(e) => setPrioridade(e.target.value as ManutPrioridade)}>{MANUT_PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}</select></Campo>
        </div>
        <Campo label="Título"><input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Ex: Troca de correia / revisão geral" /></Campo>
        <Campo label="Descrição"><textarea rows={2} className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Responsável"><input className={inp} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Interno ou fornecedor" /></Campo>
          <Campo label="Fornecedor (opcional)">
            <select className={inp} value={fornecedorId} onChange={(e) => setFornecedorId(e.target.value)}>
              <option value="">— Nenhum —</option>
              {forns.map((f) => <option key={f.id} value={f.id}>{f.fantasia || f.nome}</option>)}
            </select>
          </Campo>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Campo label="Abertura"><input type="date" className={inp} value={abertura} onChange={(e) => setAbertura(e.target.value)} /></Campo>
          <Campo label="Prazo"><input type="date" className={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Campo>
          <Campo label="Custo"><input type="number" min={0} step="0.01" className={inp} value={custo} onChange={(e) => setCusto(e.target.value)} placeholder="0,00" /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Status"><select className={inp} value={status} onChange={(e) => setStatus(e.target.value as ManutStatus)}>{MANUT_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select></Campo>
          {status === 'concluida' && <Campo label="Conclusão"><input type="date" className={inp} value={conclusao} onChange={(e) => setConclusao(e.target.value)} /></Campo>}
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !titulo.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Registrar OS'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function TransferModal({ atual, props, onClose, onSave }: { atual: Ativo; props: PropriedadeLite[]; onClose: () => void; onSave: (p: { propriedade_id: number | null; localizacao: string; responsavel: string; data: string; descricao: string }) => void }) {
  const [propriedadeId, setPropriedadeId] = useState(atual.propriedade_id != null ? String(atual.propriedade_id) : '');
  const [localizacao, setLocalizacao] = useState(atual.localizacao || '');
  const [responsavel, setResponsavel] = useState(atual.responsavel || '');
  const [data, setData] = useState(ymd(new Date())); const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  useEscClose(onClose);
  return (
    <Modal onClose={onClose} title="Transferir ativo">
      <p className="mb-4 text-sm text-ink-muted">Move o bem para outra propriedade/local e/ou responsável, mantendo o histórico de movimentação.</p>
      <div className="space-y-4">
        <Campo label="Propriedade (destino)">
          <select className={inp} value={propriedadeId} onChange={(e) => setPropriedadeId(e.target.value)}>
            <option value="">— Sem propriedade —</option>
            {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome || `Propriedade #${p.id}`}</option>)}
          </select>
        </Campo>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Localização (destino)"><input className={inp} value={localizacao} onChange={(e) => setLocalizacao(e.target.value)} placeholder="Galpão B · sala 2" /></Campo>
          <Campo label="Responsável (destino)"><input className={inp} value={responsavel} onChange={(e) => setResponsavel(e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-[150px_1fr] gap-4">
          <Campo label="Data"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <Campo label="Observação"><input className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Motivo da transferência" /></Campo>
        </div>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => { setSaving(true); onSave({ propriedade_id: propriedadeId ? Number(propriedadeId) : null, localizacao, responsavel, data, descricao }); }} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Transferindo…' : 'Confirmar transferência'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function BaixaModal({ valorContabil, onClose, onSave }: { valorContabil: number; onClose: () => void; onSave: (p: { motivo: string; valor: number | null; data: string; descricao: string }) => void }) {
  const [motivo, setMotivo] = useState('venda'); const [valor, setValor] = useState('');
  const [data, setData] = useState(ymd(new Date())); const [descricao, setDescricao] = useState('');
  const [saving, setSaving] = useState(false);
  useEscClose(onClose);
  const valorNum = valor === '' ? null : Number(valor);
  const resultado = motivo === 'venda' && valorNum != null ? valorNum - valorContabil : null;
  return (
    <Modal onClose={onClose} title="Dar baixa no ativo">
      <p className="mb-4 text-sm text-ink-muted">Registra a saída do bem (venda, perda, sucateamento…). A depreciação congela na data da baixa.</p>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Motivo"><select className={inp} value={motivo} onChange={(e) => setMotivo(e.target.value)}>{MOTIVOS_BAIXA.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select></Campo>
          <Campo label="Data da baixa"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
        </div>
        <Campo label="Valor recuperado (venda)"><input type="number" min={0} step="0.01" className={inp} value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" /></Campo>
        {resultado != null && (
          <div className={`rounded-xl border p-3 text-sm ${resultado >= 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
            Resultado da baixa (valor − contábil {formatMoney(valorContabil)}): <strong>{formatMoney(resultado)}</strong> {resultado >= 0 ? '(ganho)' : '(perda)'}
          </div>
        )}
        <Campo label="Observação"><textarea rows={2} className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Comprador, nº NF, detalhes…" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => { setSaving(true); onSave({ motivo, valor: valorNum, data, descricao }); }} disabled={saving} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">{saving ? 'Baixando…' : 'Confirmar baixa'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function DocModal({ userId, onClose, onSave }: { userId: string; onClose: () => void; onSave: (row: Omit<AtivoDoc, 'id' | 'ativo_id' | 'usuario_id' | 'criado_em'>) => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(''); const [tipo, setTipo] = useState('nota'); const [validade, setValidade] = useState('');
  const [file, setFile] = useState<File | null>(null); const [saving, setSaving] = useState(false);
  useEscClose(onClose);
  async function salvar() {
    if (!nome.trim() && !file) { toast.info('Dê um nome ou anexe um arquivo.'); return; }
    setSaving(true);
    let up: { arquivo_url: string | null; arquivo_nome: string | null; arquivo_tipo: string | null; arquivo_tamanho: number | null } =
      { arquivo_url: null, arquivo_nome: null, arquivo_tipo: null, arquivo_tamanho: null };
    if (file) {
      try { up = await uploadDoc(userId, file); } catch { setSaving(false); toast.error('Erro ao enviar o arquivo.'); return; }
    }
    onSave({ nome: nome.trim() || file?.name || 'Documento', tipo: tipo as AtivoDoc['tipo'], validade: validade || null, obs: null, ...up });
  }
  return (
    <Modal onClose={onClose} title="Adicionar documento">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Nome"><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} autoFocus placeholder="Ex: NF de compra" /></Campo>
          <Campo label="Tipo"><select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value)}>{DOC_TIPOS.map((d) => <option key={d.v} value={d.v}>{d.label}</option>)}</select></Campo>
        </div>
        <Campo label="Validade (opcional)"><input type="date" className={inp} value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-black/15 px-4 py-6 text-center transition hover:border-brand/40">
          <span className="text-sm font-semibold text-ink-soft">{file ? file.name : 'Clique para anexar arquivo (PDF, imagem…)'}</span>
          <input type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Adicionar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function useEscClose(onClose: () => void) {
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f);
  }, [onClose]);
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        <h3 className="mb-5 font-display text-xl font-bold text-ink">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Card({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2"><h3 className="text-base font-bold text-ink">{title}</h3>{action}</div>
      {children}
    </div>
  );
}

function Campo({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>{children}</label>;
}

function Metric({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone: 'ink' | 'gold' | 'azul' | 'verde' | 'vermelho' }) {
  const color = { ink: 'text-ink', gold: 'text-amber-600', azul: 'text-blue-600', verde: 'text-emerald-600', vermelho: 'text-red-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-1.5 text-lg font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.68rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm text-ink-muted">{label}</span>
      <span className={`text-sm font-bold ${tone}`}>{value}</span>
    </div>
  );
}

function VencChip({ label, status, dias, onClick }: { label: string; status: VencStatus; dias: number | null; onClick: () => void }) {
  const meta = VENC_META[status];
  return <button onClick={onClick} className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${status === 'vencido' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>{label}: {diasLabel(dias)}</button>;
}

function IcoQr() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14h1M14 20h3v1M20 17v4" /></svg>;
}

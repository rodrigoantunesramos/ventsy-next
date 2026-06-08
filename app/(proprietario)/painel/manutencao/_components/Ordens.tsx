'use client';

// Aba "Ordens de Serviço" — o coração do módulo Manutenção.
//   • Quadro Kanban por status (aberta → planejada → em andamento → aguardando
//     peça → concluída) + visão Lista com export CSV.
//   • Abrir OS corretiva/preventiva/inspeção/melhoria: alvo (espaço/ativo),
//     responsável (equipe interna ou fornecedor), prazo, prioridade, peças
//     (somam no custo), checklist e anexos.
//   • Concluir → lança a despesa (custo total) no caixa (Financeiro) e grava o
//     lancamento_id; reabrir estorna. Checklist pré-evento bloqueia a conclusão
//     enquanto houver itens não marcados.
// Tipos/helpers em ../_lib; motor puro em lib/manutencao; UI em ./ui.

import { useCallback, useMemo, useRef, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type OS, type Plano, type PropriedadeLite, type EspacoLite, type FornecedorLite, type EquipeLite, type EventoLite,
  type OSTipo, type OSStatus, type Prioridade, type ResponsavelTipo, type ChecklistItem, type Peca,
  TIPOS, STATUS, PRIORIDADES, RESP_TIPOS, STATUS_BY, inp, selCls, alvoLabel, exportCSV,
  uploadAnexo, signedUrl, removeArquivo, lancarDespesa, estornarDespesa, CATEGORIA_DESPESA,
  kpisManutencao, agruparPorStatus, STATUS_ORDEM, osAtrasada, custoOS, custoPecas,
  checklistCompleto, tipoLabel, statusLabel, prioLabel, prioPeso, ymd,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, StatusBadge, PrioBadge, TipoDot, ChecklistBar, ChecklistEditor,
  IcoWrench, IcoPlus, IcoEdit, IcoTrash, IcoDownload, IcoSearch, IcoAlert, IcoCheck,
  IcoBoard, IcoList, IcoWallet, IcoGauge, IcoPaperclip,
} from './ui';

type Shared = {
  userId: string;
  os: OS[];
  planos: Plano[];
  props: PropriedadeLite[];
  espacos: EspacoLite[];
  fornecedores: FornecedorLite[];
  equipe: EquipeLite[];
  eventos: EventoLite[];
  recarregar: () => Promise<void>;
};

const KANBAN_COLS: OSStatus[] = STATUS_ORDEM.filter((s) => s !== 'cancelada');

export default function Ordens({ userId, os, planos, props, espacos, fornecedores, equipe, eventos, recarregar }: Shared) {
  const toast = useToast();
  const nowMs = useMemo(() => Date.now(), []);
  const hoje = ymd(new Date(nowMs));

  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [busca, setBusca] = useState('');
  const [fProp, setFProp] = useState('');
  const [fTipo, setFTipo] = useState<OSTipo | ''>('');
  const [fPrio, setFPrio] = useState<Prioridade | ''>('');
  const [fStatus, setFStatus] = useState<OSStatus | ''>('');

  const [modal, setModal] = useState<null | { editando?: OS }>(null);
  const [concluir, setConcluir] = useState<OS | null>(null);

  const propMap = useMemo(() => new Map(props.map((p) => [p.id, p.nome])), [props]);
  const espMap = useMemo(() => new Map(espacos.map((e) => [e.id, e.nome])), [espacos]);

  const kpis = useMemo(() => kpisManutencao(os, nowMs), [os, nowMs]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return os.filter((o) => {
      if (fProp && String(o.propriedade_id ?? '') !== fProp) return false;
      if (fTipo && o.tipo !== fTipo) return false;
      if (fPrio && o.prioridade !== fPrio) return false;
      if (fStatus && o.status !== fStatus) return false;
      if (q) {
        const hay = `${o.titulo} ${o.descricao || ''} ${o.ativo_nome || ''} ${o.responsavel_nome || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [os, busca, fProp, fTipo, fPrio, fStatus]);

  // Ordena por atraso → prioridade → prazo (mais urgente primeiro).
  const ordenadas = useMemo(() => [...filtrados].sort((a, b) => {
    const atA = osAtrasada(a, hoje) ? 1 : 0, atB = osAtrasada(b, hoje) ? 1 : 0;
    if (atA !== atB) return atB - atA;
    const pa = prioPeso(a.prioridade), pb = prioPeso(b.prioridade);
    if (pa !== pb) return pb - pa;
    return (a.prazo || '9999').localeCompare(b.prazo || '9999');
  }), [filtrados, hoje]);

  const porStatus = useMemo(() => agruparPorStatus(ordenadas), [ordenadas]);

  // ── Ações ──
  async function mover(o: OS, status: OSStatus) {
    if (status === 'concluida') { setConcluir(o); return; }
    const { error } = await sb.from('manutencao_os').update({ status }).eq('id', o.id);
    if (error) { toast.error('Erro ao mover a OS.'); return; }
    await recarregar();
  }
  async function excluir(o: OS) {
    if (!confirm(`Excluir a OS "${o.titulo}"? Esta ação não pode ser desfeita.`)) return;
    if (o.lancamento_id) await estornarDespesa(o.lancamento_id);
    for (const a of o.anexos) await removeArquivo(a.url);
    const { error } = await sb.from('manutencao_os').delete().eq('id', o.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('OS removida.');
    await recarregar();
  }
  async function reabrir(o: OS) {
    if (o.lancamento_id) await estornarDespesa(o.lancamento_id);
    const { error } = await sb.from('manutencao_os').update({ status: 'em_andamento', conclusao: null, lancamento_id: null }).eq('id', o.id);
    if (error) { toast.error('Erro ao reabrir.'); return; }
    toast.info('OS reaberta — lançamento de custo estornado.');
    await recarregar();
  }

  const temFiltro = !!(busca || fProp || fTipo || fPrio || fStatus);

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="OS em aberto" value={String(kpis.abertas)} sub={`${kpis.emAndamento} em andamento`} tone="sky" icon={<IcoWrench />} />
        <Kpi label="Atrasadas" value={String(kpis.atrasadas)} sub="prazo vencido" tone={kpis.atrasadas ? 'vermelho' : 'ink'} icon={<IcoAlert />} />
        <Kpi label="MTTR (corretivas)" value={kpis.mttrN ? `${kpis.mttr.toFixed(1)} d` : '—'} sub={kpis.mttrN ? `${kpis.mttrN} concluída(s)` : 'sem histórico'} tone="azul" icon={<IcoGauge />} />
        <Kpi label="Custo do mês" value={formatMoneyShort(kpis.custoMes)} sub={`${kpis.concluidasMes} concluída(s)`} tone="gold" icon={<IcoWallet />} />
      </div>

      {/* Toolbar */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-black/10 bg-white p-0.5">
          <button onClick={() => setView('kanban')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${view === 'kanban' ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'}`}><IcoBoard /> Quadro</button>
          <button onClick={() => setView('lista')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${view === 'lista' ? 'bg-brand text-white' : 'text-ink-muted hover:text-ink'}`}><IcoList /> Lista</button>
        </div>
        <div className="relative min-w-[160px] flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar OS, ativo, responsável…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        {props.length > 0 && (
          <select value={fProp} onChange={(e) => setFProp(e.target.value)} className={selCls}>
            <option value="">Espaço</option>
            {props.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
        )}
        <select value={fTipo} onChange={(e) => setFTipo(e.target.value as OSTipo | '')} className={selCls}>
          <option value="">Tipo</option>
          {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
        </select>
        <select value={fPrio} onChange={(e) => setFPrio(e.target.value as Prioridade | '')} className={selCls}>
          <option value="">Prioridade</option>
          {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
        </select>
        {view === 'lista' && (
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value as OSStatus | '')} className={selCls}>
            <option value="">Status</option>
            {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        )}
        <button onClick={() => exportar(ordenadas, propMap, espMap, hoje)} disabled={ordenadas.length === 0}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoDownload /> Exportar</button>
        <button onClick={() => setModal({})} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova OS</button>
      </div>

      {/* Conteúdo */}
      {os.length === 0 ? (
        <EmptyOS onNova={() => setModal({})} />
      ) : view === 'kanban' ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {KANBAN_COLS.map((st) => {
            const col = porStatus[st];
            const meta = STATUS_BY[st];
            return (
              <div key={st} className="rounded-2xl bg-black/[0.02] p-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-soft"><span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.cor }} />{meta.label}</span>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((o) => <OSCard key={o.id} o={o} hoje={hoje} alvo={alvoLabel(o, propMap, espMap)} onOpen={() => setModal({ editando: o })} onMover={(s) => mover(o, s)} />)}
                  {col.length === 0 && <p className="px-1 py-6 text-center text-xs text-ink-muted/70">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <ListaOS itens={ordenadas} hoje={hoje} propMap={propMap} espMap={espMap} temFiltro={temFiltro} onOpen={(o) => setModal({ editando: o })} onConcluir={(o) => setConcluir(o)} onReabrir={reabrir} onExcluir={excluir} />
      )}

      {modal && (
        <OSModal shared={{ userId, os, planos, props, espacos, fornecedores, equipe, eventos, recarregar }} editando={modal.editando}
          onClose={() => setModal(null)} onSaved={async () => { setModal(null); await recarregar(); }} />
      )}
      {concluir && (
        <ConcluirModal o={concluir} fornecedores={fornecedores} onClose={() => setConcluir(null)}
          onDone={async () => { setConcluir(null); await recarregar(); }} userId={userId} />
      )}
    </div>
  );
}

// ── Card do Kanban ────────────────────────────────────────────────────────────
function OSCard({ o, hoje, alvo, onOpen, onMover }: { o: OS; hoje: string; alvo: string; onOpen: () => void; onMover: (s: OSStatus) => void }) {
  const atrasada = osAtrasada(o, hoje);
  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-2.5 shadow-sm transition hover:border-brand/30">
      <button onClick={onOpen} className="block w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-sm font-semibold text-ink">{o.titulo}</p>
          <PrioBadge v={o.prioridade} />
        </div>
        <div className="mt-1 flex items-center gap-2"><TipoDot v={o.tipo} /></div>
        {alvo !== '—' && <p className="mt-1 truncate text-xs text-ink-muted">📍 {alvo}</p>}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-xs">
          <span className={atrasada ? 'font-semibold text-red-600' : 'text-ink-muted'}>
            {o.prazo ? `${atrasada ? '⚠ ' : ''}${formatDate(o.prazo, { style: 'short' })}` : 'sem prazo'}
          </span>
          {o.custo_total_num > 0 && <span className="font-bold text-ink-soft">{formatMoney(o.custo_total_num)}</span>}
        </div>
        {o.checklist.length > 0 && <div className="mt-2"><ChecklistBar items={o.checklist} /></div>}
        {o.responsavel_nome && <p className="mt-1.5 truncate text-[0.7rem] text-ink-muted">👤 {o.responsavel_nome}</p>}
      </button>
      <div className="mt-2 border-t border-black/[0.05] pt-2">
        <select value={o.status} onChange={(e) => onMover(e.target.value as OSStatus)} aria-label="Mover OS"
          className="w-full rounded-lg border border-black/10 bg-white px-2 py-1 text-[0.7rem] font-semibold text-ink-soft focus:border-brand focus:outline-none">
          {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
        </select>
      </div>
    </div>
  );
}

// ── Visão Lista ───────────────────────────────────────────────────────────────
function ListaOS({ itens, hoje, propMap, espMap, temFiltro, onOpen, onConcluir, onReabrir, onExcluir }: {
  itens: OS[]; hoje: string; propMap: Map<number, string>; espMap: Map<number, string>; temFiltro: boolean;
  onOpen: (o: OS) => void; onConcluir: (o: OS) => void; onReabrir: (o: OS) => void; onExcluir: (o: OS) => void;
}) {
  if (itens.length === 0) return <p className="mt-6 rounded-2xl bg-white py-12 text-center text-sm text-ink-muted shadow-card">{temFiltro ? 'Nenhuma OS corresponde aos filtros.' : 'Nenhuma ordem de serviço.'}</p>;
  return (
    <div className="mt-5 overflow-x-auto rounded-2xl bg-white p-5 shadow-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
            <th className="pb-2 font-semibold">OS</th>
            <th className="hidden pb-2 font-semibold md:table-cell">Alvo</th>
            <th className="pb-2 font-semibold">Tipo</th>
            <th className="pb-2 font-semibold">Prioridade</th>
            <th className="pb-2 font-semibold">Status</th>
            <th className="pb-2 font-semibold">Prazo</th>
            <th className="pb-2 text-right font-semibold">Custo</th>
            <th className="w-24 pb-2" />
          </tr>
        </thead>
        <tbody>
          {itens.map((o) => {
            const atrasada = osAtrasada(o, hoje);
            return (
              <tr key={o.id} className="group border-b border-black/[0.04] last:border-0 hover:bg-black/[0.015]">
                <td className="py-2.5">
                  <button onClick={() => onOpen(o)} className="text-left">
                    <span className="font-semibold text-ink hover:text-brand">{o.titulo}</span>
                    {o.checklist.length > 0 && <span className="ml-2 text-[0.68rem] text-ink-muted">☑ {o.checklist.filter((c) => c.ok).length}/{o.checklist.length}</span>}
                  </button>
                </td>
                <td className="hidden py-2.5 text-ink-muted md:table-cell">{alvoLabel(o, propMap, espMap)}</td>
                <td className="py-2.5"><TipoDot v={o.tipo} /></td>
                <td className="py-2.5"><PrioBadge v={o.prioridade} /></td>
                <td className="py-2.5"><StatusBadge v={o.status} /></td>
                <td className={`py-2.5 ${atrasada ? 'font-semibold text-red-600' : 'text-ink-muted'}`}>{o.prazo ? formatDate(o.prazo, { style: 'short' }) : '—'}</td>
                <td className="py-2.5 text-right font-bold text-ink-soft">{o.custo_total_num > 0 ? formatMoney(o.custo_total_num) : '—'}</td>
                <td className="py-2.5 pl-2">
                  <div className="flex items-center justify-end gap-1">
                    {o.status === 'concluida' ? (
                      <button onClick={() => onReabrir(o)} title="Reabrir" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-amber-300 hover:text-amber-700">Reabrir</button>
                    ) : o.status !== 'cancelada' && (
                      <button onClick={() => onConcluir(o)} className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-emerald-700">Concluir</button>
                    )}
                    <div className="flex opacity-0 transition group-hover:opacity-100">
                      <button onClick={() => onOpen(o)} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                      <button onClick={() => onExcluir(o)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyOS({ onNova }: { onNova: () => void }) {
  return (
    <div className="mt-6 rounded-2xl bg-white p-10 text-center shadow-card">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoWrench size={30} /></div>
      <h2 className="text-lg font-bold text-ink">Mantenha espaços e ativos funcionando</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">Abra ordens de serviço corretivas (quebrou) e organize as preventivas (ar-condicionado, gerador, elétrica, jardim, piscina, estrutura) — com custo, responsável e checklist.</p>
      <button onClick={onNova} className="mt-6 inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600"><IcoPlus /> Abrir primeira OS</button>
    </div>
  );
}

// ── Modal: criar/editar OS ────────────────────────────────────────────────────
function OSModal({ shared, editando, onClose, onSaved }: { shared: Shared; editando?: OS; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { userId, props, espacos, fornecedores, equipe, eventos } = shared;
  // OS concluída: a edição preserva status/conclusão/lançamento (reabrir é a via
  // de des-conclusão, que estorna o custo). Aqui não rebaixamos o status.
  const concluida = editando?.status === 'concluida';

  const [tipo, setTipo] = useState<OSTipo>(editando?.tipo ?? 'corretiva');
  const [titulo, setTitulo] = useState(editando?.titulo ?? '');
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');
  const [prioridade, setPrioridade] = useState<Prioridade>(editando?.prioridade ?? 'media');
  const [status, setStatus] = useState<OSStatus>(editando && editando.status !== 'concluida' ? editando.status : 'aberta');
  const [propId, setPropId] = useState<string>(editando?.propriedade_id != null ? String(editando.propriedade_id) : '');
  const [espId, setEspId] = useState<string>(editando?.espaco_id != null ? String(editando.espaco_id) : '');
  const [ativoNome, setAtivoNome] = useState(editando?.ativo_nome ?? '');
  const [solicitante, setSolicitante] = useState(editando?.solicitante ?? '');
  const [respTipo, setRespTipo] = useState<ResponsavelTipo | ''>(editando?.responsavel_tipo ?? '');
  const [respId, setRespId] = useState(editando?.responsavel_id ?? '');
  const [abertura, setAbertura] = useState(editando?.abertura ?? ymd(new Date()));
  const [prazo, setPrazo] = useState(editando?.prazo ?? '');
  const [eventoId, setEventoId] = useState(editando?.evento_id ?? '');
  const [maoObra, setMaoObra] = useState(editando ? String(editando.custo_mao_obra_num || '') : '');
  const [pecas, setPecas] = useState<Peca[]>(editando?.pecas ?? []);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(editando?.checklist ?? []);
  const [anexos, setAnexos] = useState(editando?.anexos ?? []);
  const [obs, setObs] = useState(editando?.obs ?? '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const espacosFiltrados = useMemo(() => espacos.filter((e) => !propId || String(e.propriedade_id) === propId), [espacos, propId]);
  const custoPecasTotal = useMemo(() => custoPecas(pecas), [pecas]);

  function setResponsavel(tipoSel: ResponsavelTipo | '', id: string) {
    setRespTipo(tipoSel); setRespId(id);
  }
  function respNome(): string | null {
    if (respTipo === 'equipe') return equipe.find((e) => e.id === respId)?.nome ?? null;
    if (respTipo === 'fornecedor') { const f = fornecedores.find((x) => x.id === respId); return f ? (f.fantasia || f.nome) : null; }
    return null;
  }

  async function onFile(file: File) {
    setUploading(true);
    try { const a = await uploadAnexo(userId, file); setAnexos((prev) => [...prev, a]); }
    catch { toast.error('Falha ao enviar o anexo.'); }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }
  async function abrirAnexo(path: string) {
    const url = await signedUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Não foi possível abrir o anexo.');
  }

  async function salvar() {
    if (!titulo.trim()) { toast.error('Informe um título para a OS.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId,
      propriedade_id: propId ? Number(propId) : null,
      espaco_id: espId ? Number(espId) : null,
      ativo_nome: ativoNome.trim() || null,
      tipo, titulo: titulo.trim(), descricao: descricao.trim() || null, prioridade,
      // Concluída: não tocar no status por edição (preserva conclusão/lançamento).
      ...(concluida ? {} : { status }),
      solicitante: solicitante.trim() || null,
      responsavel_tipo: respTipo || null, responsavel_id: respTipo ? (respId || null) : null, responsavel_nome: respNome(),
      abertura: abertura || ymd(new Date()), prazo: prazo || null,
      evento_id: eventoId || null,
      custo_mao_obra_num: Number(maoObra) || 0,
      custo_pecas_num: custoPecasTotal,
      checklist, pecas, anexos, obs: obs.trim() || null,
    };
    const { error } = editando
      ? await sb.from('manutencao_os').update(payload).eq('id', editando.id)
      : await sb.from('manutencao_os').insert(payload);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar a OS.'); return; }
    toast.success(editando ? 'OS atualizada!' : 'OS aberta!');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editando ? 'Editar OS' : 'Nova ordem de serviço'}</h3>
      <div className="space-y-4">
        {/* Tipo (segmentado) */}
        <div className="grid grid-cols-4 gap-2">
          {TIPOS.map((t) => (
            <button key={t.v} type="button" onClick={() => setTipo(t.v)} className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${tipo === t.v ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-black/20'}`}>
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <Campo label="Título"><input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Ex.: Ar-condicionado do salão A não gela" /></Campo>
        <Campo label="Descrição" hint="(opcional)"><textarea className={inp} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que aconteceu / o que fazer…" /></Campo>

        {/* Alvo: espaço + ativo */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Campo label="Espaço" hint="(opcional)">
            <select className={inp} value={propId} onChange={(e) => { setPropId(e.target.value); setEspId(''); }}>
              <option value="">—</option>
              {props.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Sub-espaço" hint="(opcional)">
            <select className={inp} value={espId} onChange={(e) => setEspId(e.target.value)} disabled={!espacosFiltrados.length}>
              <option value="">—</option>
              {espacosFiltrados.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
            </select>
          </Campo>
          <Campo label="Ativo / equipamento" hint="(opcional)"><input className={inp} value={ativoNome} onChange={(e) => setAtivoNome(e.target.value)} placeholder="Ex.: Gerador 180kVA" /></Campo>
        </div>

        {/* Prioridade · status · datas */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Campo label="Prioridade">
            <select className={inp} value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
              {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </Campo>
          <Campo label="Status">
            {concluida ? (
              <div className="flex h-[42px] items-center rounded-xl border border-black/10 bg-black/[0.03] px-3 text-sm text-ink-muted">Concluída — reabra na lista p/ alterar</div>
            ) : (
              <select className={inp} value={status} onChange={(e) => setStatus(e.target.value as OSStatus)}>
                {STATUS.filter((s) => s.v !== 'concluida').map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
              </select>
            )}
          </Campo>
          <Campo label="Abertura"><input type="date" className={inp} value={abertura} onChange={(e) => setAbertura(e.target.value)} /></Campo>
          <Campo label="Prazo" hint="(opcional)"><input type="date" className={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} /></Campo>
        </div>

        {/* Responsável */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Responsável">
            <select className={inp} value={respTipo} onChange={(e) => setResponsavel(e.target.value as ResponsavelTipo | '', '')}>
              <option value="">Não atribuído</option>
              {RESP_TIPOS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </Campo>
          {respTipo === 'equipe' && (
            <Campo label="Quem (equipe)">
              <select className={inp} value={respId} onChange={(e) => setRespId(e.target.value)}>
                <option value="">Selecione…</option>
                {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}{m.cargo ? ` · ${m.cargo}` : ''}</option>)}
              </select>
            </Campo>
          )}
          {respTipo === 'fornecedor' && (
            <Campo label="Qual fornecedor">
              <select className={inp} value={respId} onChange={(e) => setRespId(e.target.value)}>
                <option value="">Selecione…</option>
                {fornecedores.map((f) => <option key={f.id} value={f.id}>{f.fantasia || f.nome}</option>)}
              </select>
            </Campo>
          )}
        </div>

        {/* Custos: mão de obra + peças */}
        <div className="rounded-xl border border-black/[0.06] p-3">
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Custo de mão de obra"><input type="number" min={0} step="0.01" className={inp} value={maoObra} onChange={(e) => setMaoObra(e.target.value)} placeholder="0,00" /></Campo>
            <Campo label="Custo de peças" hint="(somado abaixo)"><input className={`${inp} bg-black/[0.03]`} value={formatMoney(custoPecasTotal)} readOnly /></Campo>
          </div>
          <PecasEditor pecas={pecas} onChange={setPecas} />
          <div className="mt-2 flex justify-end text-sm"><span className="text-ink-muted">Custo total: <span className="font-bold text-ink">{formatMoney((Number(maoObra) || 0) + custoPecasTotal)}</span></span></div>
        </div>

        {/* Checklist */}
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-soft">Checklist <span className="font-normal text-ink-muted">(inspeção / pré-evento — concluir exige tudo marcado)</span></p>
          <ChecklistEditor items={checklist} onChange={setChecklist} />
        </div>

        {/* Vínculo a evento (pré-evento) */}
        {eventos.length > 0 && (
          <Campo label="Vincular a um evento" hint="(pré-evento — garanta que tudo funciona antes)">
            <select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">Sem vínculo</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome_evento || ev.quem_contratou || 'Evento'}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </Campo>
        )}

        {/* Anexos */}
        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-soft">Anexos <span className="font-normal text-ink-muted">(fotos, nota da peça…)</span></p>
          {anexos.length > 0 && (
            <div className="mb-2 space-y-1.5">
              {anexos.map((a, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2 text-xs">
                  <button type="button" onClick={() => abrirAnexo(a.url)} className="inline-flex items-center gap-1.5 truncate font-medium text-brand hover:underline"><IcoPaperclip /> {a.nome}</button>
                  <button type="button" onClick={async () => { await removeArquivo(a.url); setAnexos((prev) => prev.filter((_, j) => j !== i)); }} className="ml-2 shrink-0 text-ink-muted hover:text-red-600">Remover</button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*,application/pdf" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }}
            className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-black/[0.04] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink-soft" />
          {uploading && <p className="mt-1 text-xs text-ink-muted">Enviando…</p>}
        </div>

        <Campo label="Observações" hint="(opcional)"><textarea className={inp} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Abrir OS'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// ── Editor de peças (somam no custo) ──────────────────────────────────────────
function PecasEditor({ pecas, onChange }: { pecas: Peca[]; onChange: (next: Peca[]) => void }) {
  const [desc, setDesc] = useState(''); const [qtd, setQtd] = useState('1'); const [custo, setCusto] = useState('');
  function add() {
    const d = desc.trim(); const c = Number(custo);
    if (!d || !c) return;
    onChange([...pecas, { descricao: d, quantidade: Number(qtd) || 1, custo_num: c }]);
    setDesc(''); setQtd('1'); setCusto('');
  }
  return (
    <div className="mt-2">
      {pecas.length > 0 && (
        <div className="mb-2 space-y-1">
          {pecas.map((p, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg border border-black/[0.06] px-2.5 py-1.5 text-sm">
              <span className="min-w-0 flex-1 truncate text-ink-soft">{p.descricao}</span>
              <span className="shrink-0 text-xs text-ink-muted">{p.quantidade}× {formatMoney(p.custo_num)}</span>
              <button type="button" onClick={() => onChange(pecas.filter((_, j) => j !== i))} aria-label="Remover peça" className="shrink-0 text-ink-muted hover:text-red-600"><IcoTrash /></button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-[1fr_56px_84px_auto] gap-1.5">
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Peça (ex.: Gás R410)" className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <input value={qtd} onChange={(e) => setQtd(e.target.value)} type="number" min={1} title="Quantidade" className="rounded-lg border border-black/10 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <input value={custo} onChange={(e) => setCusto(e.target.value)} type="number" min={0} step="0.01" placeholder="Custo un." className="rounded-lg border border-black/10 px-2 py-1.5 text-sm focus:border-brand focus:outline-none" />
        <button type="button" onClick={add} className="rounded-lg border border-black/10 px-3 py-1.5 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">+</button>
      </div>
    </div>
  );
}

// ── Modal: concluir OS (lança custo no caixa; gate do checklist) ──────────────
function ConcluirModal({ o, fornecedores, userId, onClose, onDone }: { o: OS; fornecedores: FornecedorLite[]; userId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [data, setData] = useState(ymd(new Date()));
  const [saving, setSaving] = useState(false);
  const custo = custoOS(o);
  const checklistPendente = o.checklist.length > 0 && !checklistCompleto(o.checklist);

  async function confirmar() {
    if (checklistPendente) { toast.error('Marque todos os itens do checklist antes de concluir.'); return; }
    setSaving(true);
    // 1) lança a despesa no caixa (se houver custo)
    let lancamentoId: number | null = null;
    if (custo > 0) {
      const fornecedorId = o.responsavel_tipo === 'fornecedor' ? o.responsavel_id : null;
      const lanc = await lancarDespesa({
        usuario_id: userId, categoria: CATEGORIA_DESPESA, descricao: `Manutenção: ${o.titulo}`,
        valor: custo, data, fornecedor_id: fornecedorId, observacao: 'Conclusão de OS (Manutenção)',
      });
      if (!lanc) { setSaving(false); toast.error('Erro ao lançar o custo no caixa.'); return; }
      lancamentoId = lanc.id;
    }
    // 2) conclui a OS
    const { error } = await sb.from('manutencao_os').update({ status: 'concluida', conclusao: data, lancamento_id: lancamentoId }).eq('id', o.id);
    if (error) { if (lancamentoId) await estornarDespesa(lancamentoId); setSaving(false); toast.error('Erro ao concluir a OS.'); return; }
    setSaving(false);
    toast.success(custo > 0 ? 'OS concluída e custo lançado no caixa!' : 'OS concluída!');
    onDone();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-sm">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><IcoCheck /></span>
        <div>
          <h3 className="font-display text-xl font-bold text-ink">Concluir OS</h3>
          <p className="truncate text-xs text-ink-muted">{o.titulo}</p>
        </div>
      </div>
      {checklistPendente ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Esta OS tem um checklist com itens pendentes ({o.checklist.filter((c) => c.ok).length}/{o.checklist.length}). Abra a OS, marque todos os itens e tente concluir novamente.
        </div>
      ) : (
        <div className="space-y-4">
          <Campo label="Data de conclusão"><input type="date" className={inp} value={data} onChange={(e) => setData(e.target.value)} /></Campo>
          <div className="rounded-lg bg-black/[0.03] px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">Mão de obra</span><span className="font-semibold">{formatMoney(o.custo_mao_obra_num)}</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">Peças</span><span className="font-semibold">{formatMoney(o.custo_pecas_num)}</span></div>
            <div className="mt-1 flex justify-between border-t border-black/[0.06] pt-1"><span className="font-semibold text-ink">Custo total</span><span className="font-bold text-ink">{formatMoney(custo)}</span></div>
          </div>
          {custo > 0 && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">Isto gera um lançamento de despesa no Financeiro{o.responsavel_tipo === 'fornecedor' ? ' (vinculado ao fornecedor)' : ''}.</p>}
        </div>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={confirmar} disabled={saving || checklistPendente} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">{saving ? 'Concluindo…' : 'Concluir OS'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportar(itens: OS[], propMap: Map<number, string>, espMap: Map<number, string>, hoje: string) {
  const header = ['Título', 'Tipo', 'Prioridade', 'Status', 'Alvo', 'Responsável', 'Abertura', 'Prazo', 'Conclusão', 'Mão de obra', 'Peças', 'Custo total', 'Atrasada'];
  const rows = itens.map((o) => [
    o.titulo, tipoLabel(o.tipo), prioLabel(o.prioridade), statusLabel(o.status),
    alvoLabel(o, propMap, espMap), o.responsavel_nome || '',
    o.abertura || '', o.prazo || '', o.conclusao || '',
    o.custo_mao_obra_num, o.custo_pecas_num, o.custo_total_num, osAtrasada(o, hoje) ? 'sim' : 'não',
  ] as (string | number)[]);
  exportCSV(`ordens-servico-${hoje}.csv`, header, rows);
}

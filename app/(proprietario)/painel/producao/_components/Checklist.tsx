'use client';

// Aba "Checklist" — as tarefas de produção como um Kanban (Pendente · Fazendo ·
// Concluída) com responsável, prazo, prioridade e DEPENDÊNCIA que trava a ordem:
// concluir uma tarefa exige a tarefa-pai concluída (a /api/producao recusa com
// 409, refletido aqui pelo cadeado). Gera checklist a partir de um TEMPLATE por
// tipo de evento; mostra % de prontidão e pendências críticas. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatDate, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ProducaoBag, type Tarefa,
  CATEGORIAS, RESPONSAVEIS, PRIORIDADE_META, KANBAN_COLS,
  categoriaLabel, categoriaCor, responsavelLabel, tarefaStatusMeta,
  dependenciaPendente, criaCiclo, prontidao, tarefasCriticas, templateKeyParaTipo, listarTemplates,
  patchTarefa, criarTarefa, excluirTarefa, ensureProducao, inp, selCls, ymd, exportCSV,
} from '../_lib';
import {
  Kpi, Progress, ModalShell, Campo, EmptyState, Chip,
  IcoClipboard, IcoPlus, IcoEdit, IcoTrash, IcoCheck, IcoAlert, IcoLock, IcoSparkle, IcoDownload, IcoChevron,
  btnPrimary, btnSecondary,
} from './ui';

const HOJE = () => ymd(new Date());

export default function Checklist({ bag }: { bag: ProducaoBag }) {
  const toast = useToast();
  const { tarefas, tarefaById, equipe, fornecedores } = bag;
  const hoje = HOJE();

  const [filtroCat, setFiltroCat] = useState<string>('todas');
  const [edit, setEdit] = useState<Tarefa | 'novo' | null>(null);
  const [tplKey, setTplKey] = useState(() => templateKeyParaTipo(bag.evento.tipo_evento));
  const [aplicando, setAplicando] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const pront = useMemo(() => prontidao(tarefas, hoje), [tarefas, hoje]);
  const criticas = useMemo(() => tarefasCriticas(tarefas, hoje), [tarefas, hoje]);

  const visiveis = useMemo(
    () => (filtroCat === 'todas' ? tarefas : tarefas.filter((t) => t.categoria === filtroCat)),
    [tarefas, filtroCat],
  );
  const porStatus = useMemo(() => {
    const m: Record<string, Tarefa[]> = { pendente: [], fazendo: [], concluida: [] };
    for (const t of [...visiveis].sort((a, b) => a.ordem - b.ordem)) (m[t.status] ||= []).push(t);
    return m;
  }, [visiveis]);

  const catsUsadas = useMemo(() => {
    const set = new Set(tarefas.map((t) => t.categoria));
    return CATEGORIAS.filter((c) => set.has(c.v));
  }, [tarefas]);

  // ── Gerar checklist a partir do template ──
  const aplicarTemplate = async () => {
    setAplicando(true);
    const r = await ensureProducao(bag.evento.id, { aplicar_template: true, template: tplKey });
    setAplicando(false);
    if (!r.ok) {
      toast.error(r.error === 'template_ja_aplicado' ? 'Este evento já tem checklist.' : (r.error || 'Falha ao gerar a checklist.'));
      return;
    }
    toast.success(`Checklist e run-show gerados (${r.geradas?.tarefas || 0} tarefas).`);
    await bag.recarregar();
  };

  // ── Mudar status (rota autoritativa: respeita dependência ao concluir) ──
  const mudarStatus = async (t: Tarefa, status: string) => {
    setBusyId(t.id);
    const r = await patchTarefa({ tarefa_id: t.id, status });
    setBusyId(null);
    if (!r.ok) {
      if (r.status === 409 && r.error === 'dependencia_pendente') {
        toast.error(`Conclua antes: "${r.dependencia || 'a tarefa de que esta depende'}".`);
      } else {
        toast.error(r.error || 'Não foi possível atualizar a tarefa.');
      }
      return;
    }
    await bag.recarregar();
  };

  const excluir = async (t: Tarefa) => {
    if (!confirm(`Excluir a tarefa "${t.titulo}"?`)) return;
    const { error } = await excluirTarefa(t.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Tarefa excluída.');
    await bag.recarregar();
  };

  const exportar = () => {
    exportCSV(
      `checklist-${bag.evento.id}.csv`,
      ['Tarefa', 'Categoria', 'Responsável', 'Prazo', 'Status', 'Prioridade', 'Depende de'],
      tarefas.map((t) => [
        t.titulo, categoriaLabel(t.categoria), t.responsavel_nome || responsavelLabel(t.responsavel),
        t.prazo || '', tarefaStatusMeta(t.status).label, PRIORIDADE_META[t.prioridade]?.label || t.prioridade,
        t.depende_de ? tarefaById.get(t.depende_de)?.titulo || '' : '',
      ]),
    );
  };

  if (tarefas.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState icon={<IcoClipboard />} title="Monte a checklist de produção"
          cta={
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2">
                <select value={tplKey} onChange={(e) => setTplKey(e.target.value as typeof tplKey)} className={selCls}>
                  {listarTemplates().map((t) => <option key={t.key} value={t.key}>{t.nome}</option>)}
                </select>
                <button onClick={aplicarTemplate} disabled={aplicando} className={btnPrimary}>
                  <IcoSparkle /> {aplicando ? 'Gerando…' : 'Gerar do template'}
                </button>
              </div>
              <button onClick={() => setEdit('novo')} className="text-sm font-semibold text-ink-muted hover:text-ink">ou adicionar tarefas manualmente</button>
            </div>
          }>
          O template gera a checklist <strong>e</strong> o run-of-show prontos para o tipo de evento (montagem, técnico, A&B, segurança, pós), com dependências e prazos relativos à data. Você ajusta depois.
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs de prontidão */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Prontidão" value={formatPercent(pront.fracao)} sub={`${pront.concluidas}/${pront.total} tarefas`} tone={pront.fracao >= 1 ? 'verde' : 'brand'} icon={<IcoCheck />} />
        <Kpi label="Em andamento" value={String(pront.fazendo)} tone="sky" icon={<IcoClipboard />} />
        <Kpi label="Pendências críticas" value={String(pront.criticasAbertas)} tone={pront.criticasAbertas > 0 ? 'vermelho' : 'verde'} icon={<IcoAlert />} />
        <Kpi label="Atrasadas" value={String(pront.atrasadas)} tone={pront.atrasadas > 0 ? 'gold' : 'verde'} icon={<IcoAlert />} />
      </div>

      <Progress value={pront.fracao} tone={pront.fracao >= 1 ? 'verde' : 'brand'} />

      {/* Pendências críticas */}
      {criticas.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-800"><IcoAlert /> Atenção — pendências críticas</h3>
          <div className="flex flex-wrap gap-2">
            {criticas.slice(0, 8).map((t) => (
              <button key={t.id} onClick={() => setEdit(t)} className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-ink hover:bg-amber-100">
                <span className="h-2 w-2 rounded-full" style={{ background: categoriaCor(t.categoria) }} />
                {t.titulo}
                {t.prazo && t.prazo < hoje && <span className="text-red-600">· atrasada</span>}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Barra de ações + filtro de categoria */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <FiltroChip ativo={filtroCat === 'todas'} onClick={() => setFiltroCat('todas')}>Todas ({tarefas.length})</FiltroChip>
          {catsUsadas.map((c) => (
            <FiltroChip key={c.v} ativo={filtroCat === c.v} cor={c.cor} onClick={() => setFiltroCat(c.v)}>
              {c.label} ({tarefas.filter((t) => t.categoria === c.v).length})
            </FiltroChip>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={exportar} className={btnSecondary}><IcoDownload /> CSV</button>
          <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Tarefa</button>
        </div>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {KANBAN_COLS.map((col) => {
          const meta = tarefaStatusMeta(col);
          const lista = porStatus[col] || [];
          return (
            <div key={col} className="rounded-2xl bg-black/[0.02] p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-sm font-bold text-ink-soft">
                  <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} /> {meta.label}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-ink-muted">{lista.length}</span>
              </div>
              <div className="space-y-2.5">
                {lista.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-muted">—</p>
                ) : lista.map((t) => (
                  <Card key={t.id} t={t} bag={bag} hoje={hoje} busy={busyId === t.id}
                    onStatus={(s) => mudarStatus(t, s)} onEdit={() => setEdit(t)} onDelete={() => excluir(t)} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {edit && (
        <TarefaModal bag={bag} tarefa={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.recarregar(); }} />
      )}
    </div>
  );
}

// ── Card de tarefa ────────────────────────────────────────────────────────────
function Card({ t, bag, hoje, busy, onStatus, onEdit, onDelete }: {
  t: Tarefa; bag: ProducaoBag; hoje: string; busy: boolean;
  onStatus: (s: string) => void; onEdit: () => void; onDelete: () => void;
}) {
  const bloqueada = dependenciaPendente(t, bag.tarefaById);
  const dep = t.depende_de ? bag.tarefaById.get(t.depende_de) : null;
  const atrasada = t.status !== 'concluida' && t.prazo && t.prazo < hoje;
  const prioMeta = PRIORIDADE_META[t.prioridade];
  const respNome = t.responsavel_nome || responsavelLabel(t.responsavel);

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold" style={{ background: `${categoriaCor(t.categoria)}1a`, color: categoriaCor(t.categoria) }}>
          {categoriaLabel(t.categoria)}
        </span>
        <div className="flex shrink-0 gap-0.5">
          <button onClick={onEdit} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
          <button onClick={onDelete} aria-label="Excluir" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
        </div>
      </div>

      <p className="mt-1.5 text-sm font-semibold leading-snug text-ink">{t.titulo}</p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Chip className="bg-black/[0.04] text-ink-soft">{respNome}</Chip>
        {prioMeta && (t.prioridade === 'alta' || t.prioridade === 'critica') && <Chip className={prioMeta.chip}>{prioMeta.label}</Chip>}
        {t.prazo && <Chip className={atrasada ? 'bg-red-50 text-red-700' : 'bg-black/[0.04] text-ink-muted'}>{formatDate(t.prazo, { style: 'short' })}</Chip>}
        {bloqueada && (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-semibold text-amber-700" title={`Depende de: ${dep?.titulo || ''}`}>
            <IcoLock /> {dep?.titulo ? `aguarda` : 'bloqueada'}
          </span>
        )}
      </div>
      {bloqueada && dep && <p className="mt-1 truncate text-[0.68rem] text-amber-700">↳ {dep.titulo}</p>}

      {/* Ações de status */}
      <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-black/[0.05] pt-2.5">
        {t.status === 'pendente' && (
          <button onClick={() => onStatus('fazendo')} disabled={busy} className="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 hover:bg-sky-100 disabled:opacity-50">Iniciar</button>
        )}
        {t.status === 'fazendo' && (
          <button onClick={() => onStatus('pendente')} disabled={busy} className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-black/[0.07] disabled:opacity-50">Voltar</button>
        )}
        {t.status !== 'concluida' && (
          <button onClick={() => onStatus('concluida')} disabled={busy || bloqueada}
            title={bloqueada ? 'Conclua antes a tarefa de que esta depende' : 'Concluir'}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">
            <IcoCheck /> Concluir
          </button>
        )}
        {t.status === 'concluida' && (
          <button onClick={() => onStatus('fazendo')} disabled={busy} className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-xs font-semibold text-ink-soft hover:bg-black/[0.07] disabled:opacity-50">Reabrir</button>
        )}
      </div>
    </div>
  );
}

function FiltroChip({ ativo, cor, onClick, children }: { ativo: boolean; cor?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${ativo ? 'border-brand bg-brand text-white' : 'border-black/10 bg-white text-ink-soft hover:bg-black/[0.03]'}`}>
      {cor && <span className="h-2 w-2 rounded-full" style={{ background: ativo ? '#fff' : cor }} />}
      {children}
    </button>
  );
}

// ── Modal de criar/editar tarefa ──────────────────────────────────────────────
function TarefaModal({ bag, tarefa, onClose, onSaved }: { bag: ProducaoBag; tarefa: Tarefa | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editando = !!tarefa;
  const [titulo, setTitulo] = useState(tarefa?.titulo || '');
  const [categoria, setCategoria] = useState(tarefa?.categoria || 'logistica');
  const [responsavel, setResponsavel] = useState(tarefa?.responsavel || 'producao');
  const [responsavelNome, setResponsavelNome] = useState(tarefa?.responsavel_nome || '');
  const [prazo, setPrazo] = useState(tarefa?.prazo || '');
  const [prioridade, setPrioridade] = useState(tarefa?.prioridade || 'normal');
  const [dependeDe, setDependeDe] = useState(tarefa?.depende_de || '');
  const [obs, setObs] = useState(tarefa?.obs || '');
  const [salvando, setSalvando] = useState(false);

  // Opções de dependência: outras tarefas da produção que não criam ciclo.
  const opcoesDep = useMemo(() => {
    const byId = new Map(bag.tarefas.map((t) => [t.id, { id: t.id, depende_de: t.depende_de }]));
    return bag.tarefas.filter((t) => {
      if (tarefa && t.id === tarefa.id) return false;
      if (tarefa) return !criaCiclo(tarefa.id, t.id, byId);
      return true;
    });
  }, [bag.tarefas, tarefa]);

  // Sugestões de nome do responsável (equipe + fornecedores) conforme o tipo.
  const sugestoes = useMemo(() => {
    if (responsavel === 'equipe') return bag.equipe.map((e) => e.nome);
    if (responsavel === 'fornecedor') return bag.fornecedores.map((f) => f.fantasia || f.nome);
    return [];
  }, [responsavel, bag.equipe, bag.fornecedores]);

  const salvar = async () => {
    if (!titulo.trim()) { toast.error('Informe o título da tarefa.'); return; }
    setSalvando(true);
    if (editando && tarefa) {
      const r = await patchTarefa({
        tarefa_id: tarefa.id, titulo: titulo.trim(), categoria, responsavel,
        responsavel_nome: responsavelNome.trim() || null, prazo: prazo || null, prioridade,
        depende_de: dependeDe || null, obs: obs.trim() || null,
      });
      setSalvando(false);
      if (!r.ok) { toast.error(r.error === 'dependencia_ciclo' ? 'Essa dependência criaria um ciclo.' : (r.error || 'Falha ao salvar.')); return; }
      toast.success('Tarefa atualizada.');
    } else {
      const ordem = bag.tarefas.reduce((m, t) => Math.max(m, t.ordem), -1) + 1;
      const { error } = await criarTarefa({
        usuario_id: bag.userId, producao_id: bag.producao.id, titulo: titulo.trim(), categoria, responsavel,
        responsavel_nome: responsavelNome.trim() || null, prazo: prazo || null, prioridade,
        depende_de: dependeDe || null, obs: obs.trim() || null, ordem,
      });
      setSalvando(false);
      if (error) { toast.error('Não foi possível criar a tarefa.'); return; }
      toast.success('Tarefa criada.');
    }
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-ink">{editando ? 'Editar tarefa' : 'Nova tarefa'}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Título" full>
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} placeholder="Ex.: Montagem da estrutura" autoFocus />
        </Campo>
        <Campo label="Categoria">
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} className={`${inp} bg-white`}>
            {CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Prioridade">
          <select value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={`${inp} bg-white`}>
            {Object.entries(PRIORIDADE_META).map(([v, m]) => <option key={v} value={v}>{m.label}</option>)}
          </select>
        </Campo>
        <Campo label="Responsável por">
          <select value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={`${inp} bg-white`}>
            {RESPONSAVEIS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
          </select>
        </Campo>
        <Campo label="Nome do responsável" hint={sugestoes.length ? 'Sugestões da sua equipe/fornecedores' : undefined}>
          <input list="resp-sugestoes" value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className={inp} placeholder="Opcional" />
          <datalist id="resp-sugestoes">{sugestoes.map((s, i) => <option key={i} value={s} />)}</datalist>
        </Campo>
        <Campo label="Prazo">
          <input type="date" value={prazo} onChange={(e) => setPrazo(e.target.value)} className={inp} />
        </Campo>
        <Campo label="Depende de" hint="A tarefa só pode ser concluída depois desta.">
          <select value={dependeDe} onChange={(e) => setDependeDe(e.target.value)} className={`${inp} bg-white`}>
            <option value="">— sem dependência —</option>
            {opcoesDep.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
          </select>
        </Campo>
        <Campo label="Observações" full>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} placeholder="Detalhes, links, instruções." />
        </Campo>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Criar tarefa'}</button>
      </div>
    </ModalShell>
  );
}

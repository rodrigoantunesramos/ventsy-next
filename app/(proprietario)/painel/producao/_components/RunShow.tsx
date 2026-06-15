'use client';

// Aba "Run-of-show" — o cronograma operacional minuto-a-minuto do dia: horário,
// duração, atividade, área/espaço, responsável e recurso (som/luz/palco). Detecta
// CONFLITOS (mesma área sobreposta), exporta um PDF do roteiro para a equipe e
// tem o MODO DIA DO EVENTO (tela cheia, mobile, marca cada item como concluído ao
// vivo, com destaque do item atual). Multi-dia (feira/festival). Sem "R$".

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ProducaoBag, type RunshowItem,
  ordenarRunshow, fimMin, duracaoTotalMin, duracaoLabel, progressoRunshow, conflitosRunshow,
  hhmmToMin, minToHHMM, criarRunshow, salvarRunshow, excluirRunshow, ensureProducao, templateKeyParaTipo, listarTemplates,
  inp, selCls, ymd, eventoLabel,
} from '../_lib';
import {
  Kpi, Progress, ModalShell, Campo, EmptyState,
  IcoClock, IcoPlus, IcoEdit, IcoTrash, IcoPdf, IcoExpand, IcoAlert, IcoCheck, IcoX, IcoSparkle, IcoPlay,
  btnPrimary, btnSecondary,
} from './ui';

export default function RunShow({ bag }: { bag: ProducaoBag }) {
  const toast = useToast();
  const { runshow } = bag;
  const [edit, setEdit] = useState<RunshowItem | 'novo' | null>(null);
  const [diaAberto, setDiaAberto] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [tplKey, setTplKey] = useState(() => templateKeyParaTipo(bag.evento.tipo_evento));
  const [exportando, setExportando] = useState(false);

  const ordenado = useMemo(() => ordenarRunshow(runshow), [runshow]);
  const progresso = useMemo(() => progressoRunshow(runshow), [runshow]);
  const conflitos = useMemo(() => conflitosRunshow(runshow), [runshow]);
  const conflitoIds = useMemo(() => {
    const s = new Set<string>();
    conflitos.forEach((c) => { s.add(c.a.id); s.add(c.b.id); });
    return s;
  }, [conflitos]);

  // Agrupa por dia (multi-dia). Itens sem data caem num grupo "sem data".
  const dias = useMemo(() => {
    const m = new Map<string, RunshowItem[]>();
    for (const it of ordenado) { const k = it.data || '—'; const arr = m.get(k) || []; arr.push(it); m.set(k, arr); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [ordenado]);

  const aplicarTemplate = async () => {
    setAplicando(true);
    const r = await ensureProducao(bag.evento.id, { aplicar_template: true, template: tplKey });
    setAplicando(false);
    if (!r.ok) {
      toast.error(r.error === 'template_ja_aplicado' ? 'Este evento já tem roteiro/checklist.' : (r.error || 'Falha ao gerar.'));
      return;
    }
    toast.success(`Roteiro gerado (${r.geradas?.runshow || 0} itens).`);
    await bag.recarregar();
  };

  const marcar = async (it: RunshowItem, concluido: boolean) => {
    const { error } = await salvarRunshow(it.id, { concluido });
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    await bag.recarregar();
  };

  const excluir = async (it: RunshowItem) => {
    if (!confirm(`Excluir "${it.atividade}" do roteiro?`)) return;
    const { error } = await excluirRunshow(it.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Item removido.');
    await bag.recarregar();
  };

  const exportarPDF = async () => {
    setExportando(true);
    try {
      let empresa: { nome: string | null; contato: string | null } = { nome: null, contato: null };
      try {
        const { data } = await sb.from('empresa_config').select('razao_social,fantasia,contatos').eq('usuario_id', bag.userId).maybeSingle();
        const contatos = (data?.contatos ?? null) as { telefone?: string | null; email?: string | null } | null;
        if (data) empresa = { nome: data.fantasia || data.razao_social || null, contato: (contatos?.telefone || contatos?.email) ?? null };
      } catch { /* sem config — usa marca padrão */ }
      const { buildRunshowPDF } = await import('../_pdf');
      const doc = await buildRunshowPDF({
        eventoNome: eventoLabel(bag.evento),
        eventoData: bag.evento.data_inicio,
        dias: dias.map(([data, itens]) => ({ data: data === '—' ? null : data, itens })),
        empresaNome: empresa.nome,
        empresaContato: empresa.contato,
      });
      doc.save(`run-of-show-${bag.evento.id}.pdf`);
    } catch {
      toast.error('Falha ao gerar o PDF.');
    } finally {
      setExportando(false);
    }
  };

  if (runshow.length === 0) {
    return (
      <EmptyState icon={<IcoClock />} title="Monte o roteiro do dia (run-of-show)"
        cta={
          <div className="flex flex-col items-center gap-3">
            {bag.tarefas.length === 0 && (
              <div className="flex items-center gap-2">
                <select value={tplKey} onChange={(e) => setTplKey(e.target.value as typeof tplKey)} className={selCls}>
                  {listarTemplates().map((t) => <option key={t.key} value={t.key}>{t.nome}</option>)}
                </select>
                <button onClick={aplicarTemplate} disabled={aplicando} className={btnPrimary}><IcoSparkle /> {aplicando ? 'Gerando…' : 'Gerar do template'}</button>
              </div>
            )}
            <button onClick={() => setEdit('novo')} className={bag.tarefas.length === 0 ? 'text-sm font-semibold text-ink-muted hover:text-ink' : btnPrimary}>
              {bag.tarefas.length === 0 ? 'ou adicionar itens manualmente' : <><IcoPlus /> Adicionar item</>}
            </button>
          </div>
        }>
        O cronograma minuto-a-minuto guia a execução: cada bloco tem horário, duração, área e responsável. Gere a partir do template ou monte do zero.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Itens no roteiro" value={String(runshow.length)} tone="ink" icon={<IcoClock />} />
        <Kpi label="Duração total" value={duracaoLabel(duracaoTotalMin(runshow))} tone="roxo" icon={<IcoClock />} />
        <Kpi label="Concluídos" value={`${progresso.feitos}/${progresso.total}`} tone={progresso.fracao >= 1 ? 'verde' : 'sky'} icon={<IcoCheck />} />
        <Kpi label="Conflitos de área" value={String(conflitos.length)} tone={conflitos.length > 0 ? 'vermelho' : 'verde'} icon={<IcoAlert />} />
      </div>

      {/* Ações */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button onClick={() => setDiaAberto(true)} className="inline-flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-white hover:bg-ink-soft">
          <IcoPlay /> Modo dia do evento
        </button>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportarPDF} disabled={exportando} className={btnSecondary}><IcoPdf /> {exportando ? 'Gerando…' : 'PDF do roteiro'}</button>
          <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Item</button>
        </div>
      </div>

      {conflitos.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50/60 p-3 text-sm text-red-700">
          <strong>Conflito de cronograma:</strong> {conflitos.length} sobreposição(ões) na mesma área. Os itens em vermelho disputam o mesmo espaço ao mesmo tempo.
        </div>
      )}

      {/* Timeline por dia */}
      <div className="space-y-6">
        {dias.map(([data, itens]) => (
          <div key={data}>
            {dias.length > 1 && (
              <h3 className="mb-3 text-sm font-bold text-ink-soft">{data === '—' ? 'Sem data definida' : formatDate(data, { style: 'long' })}</h3>
            )}
            <div className="relative space-y-2.5 border-l-2 border-black/[0.06] pl-4 sm:pl-5">
              {itens.map((it) => (
                <LinhaItem key={it.id} it={it} conflito={conflitoIds.has(it.id)}
                  onToggle={() => marcar(it, !it.concluido)} onEdit={() => setEdit(it)} onDelete={() => excluir(it)} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {edit && (
        <ItemModal bag={bag} item={edit === 'novo' ? null : edit} onClose={() => setEdit(null)} onSaved={async () => { setEdit(null); await bag.recarregar(); }} />
      )}

      {diaAberto && (
        <ModoDiaDoEvento bag={bag} ordenado={ordenado} onClose={() => setDiaAberto(false)} onToggle={marcar} />
      )}
    </div>
  );
}

// ── Linha da timeline ─────────────────────────────────────────────────────────
function LinhaItem({ it, conflito, onToggle, onEdit, onDelete }: { it: RunshowItem; conflito: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const fim = minToHHMM(fimMin(it));
  return (
    <div className="relative">
      <span className={`absolute -left-[1.4rem] top-3 h-3 w-3 rounded-full border-2 border-white sm:-left-[1.65rem] ${it.concluido ? 'bg-emerald-500' : conflito ? 'bg-red-500' : 'bg-brand'}`} />
      <div className={`flex items-start gap-3 rounded-xl border bg-white p-3 shadow-sm ${conflito ? 'border-red-200' : 'border-black/[0.06]'} ${it.concluido ? 'opacity-70' : ''}`}>
        <button onClick={onToggle} aria-label={it.concluido ? 'Desmarcar' : 'Marcar concluído'}
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${it.concluido ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/15 text-transparent hover:border-emerald-400'}`}>
          <IcoCheck />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-mono text-sm font-bold text-ink">{it.horario}</span>
            <span className="text-[0.7rem] text-ink-muted">→ {fim} · {duracaoLabel(it.duracao_min)}</span>
          </div>
          <p className={`mt-0.5 text-sm font-semibold text-ink ${it.concluido ? 'line-through' : ''}`}>{it.atividade}</p>
          <div className="mt-1 flex flex-wrap gap-1.5 text-[0.7rem]">
            {it.area && <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">{it.area}</span>}
            {it.responsavel && <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-ink-soft">{it.responsavel}</span>}
            {it.recurso && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">{it.recurso}</span>}
            {conflito && <span className="rounded-full bg-red-50 px-2 py-0.5 font-semibold text-red-700">conflito de área</span>}
          </div>
          {it.obs && <p className="mt-1 text-[0.72rem] text-ink-muted">{it.obs}</p>}
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button onClick={onEdit} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
          <button onClick={onDelete} aria-label="Excluir" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
        </div>
      </div>
    </div>
  );
}

// ── Modo "dia do evento" (tela cheia, ao vivo) ────────────────────────────────
function ModoDiaDoEvento({ bag, ordenado, onClose, onToggle }: { bag: ProducaoBag; ordenado: RunshowItem[]; onClose: () => void; onToggle: (it: RunshowItem, c: boolean) => void }) {
  const progresso = progressoRunshow(ordenado);
  // "Agora" só para destacar o item corrente — UI, não lógica de negócio.
  const agora = new Date();
  const hojeYmd = ymd(agora);
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const atualId = useMemo(() => {
    const doDia = ordenado.filter((it) => (it.data || hojeYmd) === hojeYmd);
    const cur = doDia.find((it) => hhmmToMin(it.horario) <= agoraMin && agoraMin < fimMin(it));
    return (cur || doDia.find((it) => hhmmToMin(it.horario) >= agoraMin))?.id || null;
  }, [ordenado, hojeYmd, agoraMin]);

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col bg-ink text-white">
      {/* Topo */}
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="truncate text-base font-bold sm:text-lg">{eventoLabel(bag.evento)}</div>
          <div className="text-xs text-white/60">{bag.evento.data_inicio ? formatDate(bag.evento.data_inicio, { style: 'long' }) : 'Run-of-show'} · {progresso.feitos}/{progresso.total} concluídos</div>
        </div>
        <button onClick={onClose} aria-label="Sair do modo dia do evento" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"><IcoX /></button>
      </div>
      <div className="h-1.5 w-full bg-white/10">
        <div className="h-full bg-emerald-400 transition-[width]" style={{ width: `${progresso.fracao * 100}%` }} />
      </div>

      {/* Lista grande */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-2xl space-y-2.5">
          {ordenado.map((it) => {
            const atual = it.id === atualId && !it.concluido;
            return (
              <button key={it.id} onClick={() => onToggle(it, !it.concluido)}
                className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition ${
                  it.concluido ? 'border-white/5 bg-white/[0.03] text-white/40'
                  : atual ? 'border-brand bg-brand/15 ring-2 ring-brand'
                  : 'border-white/10 bg-white/[0.06] hover:bg-white/10'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border-2 ${it.concluido ? 'border-emerald-400 bg-emerald-400 text-ink' : 'border-white/30 text-transparent'}`}><IcoCheck /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-lg font-bold">{it.horario}</span>
                    <span className="text-xs text-white/50">{duracaoLabel(it.duracao_min)}</span>
                    {atual && <span className="rounded-full bg-brand px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide">agora</span>}
                  </div>
                  <div className={`text-base font-semibold ${it.concluido ? 'line-through' : ''}`}>{it.atividade}</div>
                  <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-white/60">
                    {it.area && <span>{it.area}</span>}
                    {it.responsavel && <span>· {it.responsavel}</span>}
                    {it.recurso && <span>· {it.recurso}</span>}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Modal de criar/editar item ────────────────────────────────────────────────
function ItemModal({ bag, item, onClose, onSaved }: { bag: ProducaoBag; item: RunshowItem | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const editando = !!item;
  const defData = item?.data || (bag.evento.data_inicio ? bag.evento.data_inicio.slice(0, 10) : '');
  const [data, setData] = useState(defData);
  const [horario, setHorario] = useState(item?.horario || '18:00');
  const [duracao, setDuracao] = useState(String(item?.duracao_min ?? 30));
  const [atividade, setAtividade] = useState(item?.atividade || '');
  const [area, setArea] = useState(item?.area || '');
  const [responsavel, setResponsavel] = useState(item?.responsavel || '');
  const [recurso, setRecurso] = useState(item?.recurso || '');
  const [obs, setObs] = useState(item?.obs || '');
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!atividade.trim()) { toast.error('Descreva a atividade.'); return; }
    setSalvando(true);
    const payload = {
      data: data || null, horario: horario || '00:00', duracao_min: Math.max(0, Number(duracao) || 0),
      atividade: atividade.trim(), area: area.trim() || null, responsavel: responsavel.trim() || null,
      recurso: recurso.trim() || null, obs: obs.trim() || null,
    };
    if (editando && item) {
      const { error } = await salvarRunshow(item.id, payload);
      setSalvando(false);
      if (error) { toast.error('Não foi possível salvar.'); return; }
      toast.success('Item atualizado.');
    } else {
      const ordem = bag.runshow.reduce((m, r) => Math.max(m, r.ordem), -1) + 1;
      const { error } = await criarRunshow({ usuario_id: bag.userId, producao_id: bag.producao.id, ...payload, ordem });
      setSalvando(false);
      if (error) { toast.error('Não foi possível criar.'); return; }
      toast.success('Item adicionado.');
    }
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-ink">{editando ? 'Editar item' : 'Novo item do roteiro'}</h3>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Campo label="Dia"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} /></Campo>
        <Campo label="Horário"><input type="time" value={horario} onChange={(e) => setHorario(e.target.value)} className={inp} /></Campo>
        <Campo label="Duração (min)"><input type="number" min={0} value={duracao} onChange={(e) => setDuracao(e.target.value)} className={inp} /></Campo>
        <Campo label="Área"><input value={area} onChange={(e) => setArea(e.target.value)} className={inp} placeholder="Palco…" /></Campo>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4">
        <Campo label="Atividade"><input value={atividade} onChange={(e) => setAtividade(e.target.value)} className={inp} placeholder="Ex.: Entrada dos noivos / primeira dança" autoFocus /></Campo>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Responsável"><input value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={inp} placeholder="Nome ou função" /></Campo>
          <Campo label="Recurso"><input value={recurso} onChange={(e) => setRecurso(e.target.value)} className={inp} placeholder="Som / Luz / Palco / Projeção" /></Campo>
        </div>
        <Campo label="Observações"><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} placeholder="Cues, detalhes, links." /></Campo>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : editando ? 'Salvar' : 'Adicionar'}</button>
      </div>
    </ModalShell>
  );
}

'use client';

// Aba "Preventiva" — planos periódicos + checklist pré-evento.
//   • Planos com periodicidade/checklist (ar/gerador/elétrica/jardim/piscina…)
//     que viram OS automaticamente na data (cron) ou no botão "Gerar OS".
//   • Agenda das próximas preventivas (calendário de manutenção).
//   • Pré-evento: cria uma OS de inspeção vinculada a uma reserva/evento com
//     checklist — "antes do evento X, checar gerador/ar/elétrica". A conclusão
//     da OS fica bloqueada até todo o checklist ser marcado.
// Tipos/helpers em ../_lib; motor puro em lib/manutencao; UI em ./ui.

import { useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatDate, formatMonth } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type OS, type Plano, type PropriedadeLite, type EspacoLite, type FornecedorLite, type EquipeLite, type EventoLite,
  type Prioridade, type Periodicidade, type ResponsavelTipo, type ChecklistItem,
  PERIODICIDADES, PRIORIDADES, RESP_TIPOS, inp, alvoLabel, periodLabel,
  planosDevidos, proximaData, progressoChecklist, ymd,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, ChecklistEditor, ChecklistBar, PrioBadge,
  IcoPlus, IcoEdit, IcoTrash, IcoCalendar, IcoRepeat, IcoSpark, IcoFlag, IcoAlert,
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

// Checklist padrão sugerido para a vistoria pré-evento.
const PRE_EVENTO_PADRAO = ['Gerador / energia de backup', 'Ar-condicionado / climatização', 'Rede elétrica e quadros', 'Hidráulica e banheiros', 'Estrutura, palco e segurança', 'Limpeza geral do espaço'];

export default function Preventiva({ userId, os, planos, props, espacos, fornecedores, equipe, eventos, recarregar }: Shared) {
  const toast = useToast();
  const hoje = ymd(new Date());

  const [modal, setModal] = useState<null | { editando?: Plano }>(null);
  const [preEvento, setPreEvento] = useState(false);

  const propMap = useMemo(() => new Map(props.map((p) => [p.id, p.nome])), [props]);
  const espMap = useMemo(() => new Map(espacos.map((e) => [e.id, e.nome])), [espacos]);

  const devidos = useMemo(() => planosDevidos(planos.filter((p) => p.ativo), hoje), [planos, hoje]);

  // Agenda: próximas preventivas calendarizadas, ordenadas por data.
  const agenda = useMemo(() => planos
    .filter((p) => p.ativo && p.proxima_data && p.periodicidade !== 'horas_uso')
    .sort((a, b) => (a.proxima_data || '').localeCompare(b.proxima_data || '')), [planos]);
  const agendaPorMes = useMemo(() => {
    const m = new Map<string, Plano[]>();
    for (const p of agenda) {
      const k = (p.proxima_data || '').slice(0, 7);
      const list = m.get(k) || [];
      list.push(p);
      m.set(k, list);
    }
    return [...m.entries()];
  }, [agenda]);

  // OS de pré-evento (vinculadas a evento) ainda em aberto.
  const preEventoOS = useMemo(() => os.filter((o) => o.evento_id && o.status !== 'concluida' && o.status !== 'cancelada'), [os]);
  const eventoNome = (id: string | null) => eventos.find((e) => e.id === id)?.nome_evento || eventos.find((e) => e.id === id)?.quem_contratou || 'Evento';

  // ── Gerar OS a partir de um plano (e avançar a próxima data) ──
  async function gerarOS(p: Plano) {
    const checklist: ChecklistItem[] = (p.checklist || []).map((c) => ({ item: c.item, ok: false }));
    const { error } = await sb.from('manutencao_os').insert({
      usuario_id: userId, propriedade_id: p.propriedade_id, espaco_id: p.espaco_id, ativo_id: p.ativo_id, ativo_nome: p.ativo_nome,
      tipo: p.tipo, titulo: p.titulo, descricao: p.descricao, prioridade: p.prioridade, status: 'aberta',
      responsavel_tipo: p.responsavel_tipo, responsavel_id: p.responsavel_id, responsavel_nome: p.responsavel_nome,
      abertura: hoje, prazo: p.proxima_data, plano_id: p.id, checklist,
      custo_mao_obra_num: 0, custo_pecas_num: 0,
    });
    if (error) { toast.error('Erro ao gerar a OS.'); return; }
    // avança a próxima data (mantém a cadência a partir da data planejada)
    const prox = p.proxima_data ? proximaData(p.proxima_data, p.periodicidade, p.intervalo) : null;
    await sb.from('manutencao_planos').update({ proxima_data: prox, ultima_geracao: hoje }).eq('id', p.id);
    toast.success('OS gerada — veja na aba Ordens.');
    await recarregar();
  }
  async function gerarTodos() {
    if (!devidos.length) return;
    for (const p of devidos) await gerarOS(p);
  }
  async function toggleAtivo(p: Plano) {
    const { error } = await sb.from('manutencao_planos').update({ ativo: !p.ativo }).eq('id', p.id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    await recarregar();
  }
  async function excluir(p: Plano) {
    if (!confirm(`Excluir o plano "${p.titulo}"?`)) return;
    const { error } = await sb.from('manutencao_planos').delete().eq('id', p.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Plano removido.');
    await recarregar();
  }

  return (
    <div>
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Planos ativos" value={String(planos.filter((p) => p.ativo).length)} sub={`${planos.length} no total`} tone="verde" icon={<IcoRepeat />} />
        <Kpi label="Vencendo / vencidos" value={String(devidos.length)} sub="prontos p/ gerar OS" tone={devidos.length ? 'vermelho' : 'ink'} icon={<IcoAlert />} />
        <Kpi label="Próximas (agenda)" value={String(agenda.length)} sub="preventivas datadas" tone="azul" icon={<IcoCalendar />} />
        <Kpi label="Pré-evento em aberto" value={String(preEventoOS.length)} sub="vistorias de evento" tone="roxo" icon={<IcoFlag />} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => setPreEvento(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoFlag /> Checklist pré-evento</button>
        <button onClick={() => setModal({})} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Novo plano</button>
      </div>

      {/* Planos devidos */}
      {devidos.length > 0 && (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="inline-flex items-center gap-2 text-base font-bold text-ink"><span className="text-amber-600"><IcoAlert /></span> Preventivas vencidas — gerar OS</h3>
            <button onClick={gerarTodos} className="rounded-xl bg-amber-600 px-3 py-1.5 text-sm font-bold text-white hover:bg-amber-700">Gerar todas ({devidos.length})</button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {devidos.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{p.titulo}</p>
                  <p className="truncate text-xs text-ink-muted">{alvoLabel(p, propMap, espMap)} · venceu {formatDate(p.proxima_data, { style: 'short' })}</p>
                </div>
                <button onClick={() => gerarOS(p)} className="shrink-0 rounded-lg bg-brand px-2.5 py-1 text-xs font-bold text-white hover:bg-brand-600">Gerar OS</button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_340px]">
        {/* Lista de planos */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="mb-4 text-base font-bold text-ink">Planos de manutenção</h3>
          {planos.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><IcoRepeat /></div>
              <p className="text-sm font-semibold text-ink">Nenhum plano preventivo ainda</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-ink-muted">Crie rotinas periódicas (mensal, trimestral…) com checklist — elas viram OS sozinhas na data.</p>
              <button onClick={() => setModal({})} className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-brand-600"><IcoPlus /> Criar plano</button>
            </div>
          ) : (
            <div className="space-y-2">
              {planos.map((p) => (
                <div key={p.id} className={`flex items-center gap-3 rounded-xl border border-black/[0.06] p-3 ${!p.ativo ? 'opacity-60' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-semibold text-ink">{p.titulo}</span>
                      <PrioBadge v={p.prioridade} />
                      {!p.ativo && <span className="rounded bg-black/[0.05] px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-ink-muted">pausado</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {alvoLabel(p, propMap, espMap)} · {periodLabel(p.periodicidade)}{p.intervalo > 1 ? ` (×${p.intervalo})` : ''}
                      {p.proxima_data ? ` · próxima ${formatDate(p.proxima_data, { style: 'short' })}` : ''}
                    </p>
                    {p.checklist.length > 0 && <p className="mt-0.5 text-[0.68rem] text-ink-muted">☑ {p.checklist.length} item(ns) no checklist</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button onClick={() => gerarOS(p)} title="Gerar OS agora" className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">Gerar</button>
                    <button onClick={() => toggleAtivo(p)} title={p.ativo ? 'Pausar' : 'Reativar'} className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-amber-600">{p.ativo ? '⏸' : '▶'}</button>
                    <button onClick={() => setModal({ editando: p })} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => excluir(p)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agenda (calendário de manutenção) + pré-evento em aberto */}
        <div className="space-y-5">
          <div className="rounded-2xl bg-white p-5 shadow-card">
            <h3 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-ink"><IcoCalendar /> Agenda de manutenção</h3>
            {agendaPorMes.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">Sem preventivas datadas.</p>
            ) : (
              <div className="space-y-3">
                {agendaPorMes.slice(0, 4).map(([mes, lista]) => (
                  <div key={mes}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted">{formatMonth(mes)}</p>
                    <div className="space-y-1.5">
                      {lista.map((p) => {
                        const venc = (p.proxima_data || '') <= hoje;
                        return (
                          <div key={p.id} className="flex items-center gap-2 text-sm">
                            <span className={`flex h-7 w-9 shrink-0 flex-col items-center justify-center rounded-lg text-[0.6rem] font-bold ${venc ? 'bg-red-50 text-red-600' : 'bg-brand-50 text-brand'}`}>
                              {p.proxima_data ? formatDate(p.proxima_data, { style: 'short' }).slice(0, 5) : ''}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-ink-soft">{p.titulo}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {preEventoOS.length > 0 && (
            <div className="rounded-2xl bg-white p-5 shadow-card">
              <h3 className="mb-3 inline-flex items-center gap-2 text-base font-bold text-ink"><IcoFlag /> Pré-evento em aberto</h3>
              <div className="space-y-2.5">
                {preEventoOS.map((o) => (
                  <div key={o.id} className="rounded-xl border border-black/[0.06] p-2.5">
                    <p className="truncate text-sm font-semibold text-ink">{o.titulo}</p>
                    <p className="mb-1.5 truncate text-xs text-ink-muted">{eventoNome(o.evento_id)}</p>
                    <ChecklistBar items={o.checklist} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {modal && (
        <PlanoModal userId={userId} props={props} espacos={espacos} fornecedores={fornecedores} equipe={equipe} editando={modal.editando}
          onClose={() => setModal(null)} onSaved={async () => { setModal(null); await recarregar(); }} />
      )}
      {preEvento && (
        <PreEventoModal userId={userId} eventos={eventos} planos={planos} props={props} espacos={espacos}
          onClose={() => setPreEvento(false)} onSaved={async () => { setPreEvento(false); await recarregar(); }} />
      )}
    </div>
  );
}

// ── Modal: criar/editar plano preventivo ──────────────────────────────────────
function PlanoModal({ userId, props, espacos, fornecedores, equipe, editando, onClose, onSaved }: {
  userId: string; props: PropriedadeLite[]; espacos: EspacoLite[]; fornecedores: FornecedorLite[]; equipe: EquipeLite[];
  editando?: Plano; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [titulo, setTitulo] = useState(editando?.titulo ?? '');
  const [descricao, setDescricao] = useState(editando?.descricao ?? '');
  const [tipo, setTipo] = useState<'preventiva' | 'inspecao'>(editando?.tipo ?? 'preventiva');
  const [prioridade, setPrioridade] = useState<Prioridade>(editando?.prioridade ?? 'media');
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>(editando?.periodicidade ?? 'mensal');
  const [intervalo, setIntervalo] = useState(editando ? String(editando.intervalo) : '1');
  const [proximaData, setProximaData] = useState(editando?.proxima_data ?? ymd(new Date()));
  const [propId, setPropId] = useState(editando?.propriedade_id != null ? String(editando.propriedade_id) : '');
  const [espId, setEspId] = useState(editando?.espaco_id != null ? String(editando.espaco_id) : '');
  const [ativoNome, setAtivoNome] = useState(editando?.ativo_nome ?? '');
  const [respTipo, setRespTipo] = useState<ResponsavelTipo | ''>(editando?.responsavel_tipo ?? '');
  const [respId, setRespId] = useState(editando?.responsavel_id ?? '');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(editando?.checklist ?? []);
  const [saving, setSaving] = useState(false);

  const espacosFiltrados = useMemo(() => espacos.filter((e) => !propId || String(e.propriedade_id) === propId), [espacos, propId]);
  const semCalendario = periodicidade === 'horas_uso';

  function respNome(): string | null {
    if (respTipo === 'equipe') return equipe.find((e) => e.id === respId)?.nome ?? null;
    if (respTipo === 'fornecedor') { const f = fornecedores.find((x) => x.id === respId); return f ? (f.fantasia || f.nome) : null; }
    return null;
  }

  async function salvar() {
    if (!titulo.trim()) { toast.error('Informe um título.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId, titulo: titulo.trim(), descricao: descricao.trim() || null, tipo, prioridade,
      periodicidade, intervalo: Math.max(1, Number(intervalo) || 1),
      proxima_data: semCalendario ? null : (proximaData || null),
      propriedade_id: propId ? Number(propId) : null, espaco_id: espId ? Number(espId) : null, ativo_nome: ativoNome.trim() || null,
      responsavel_tipo: respTipo || null, responsavel_id: respTipo ? (respId || null) : null, responsavel_nome: respNome(),
      checklist,
    };
    const { error } = editando
      ? await sb.from('manutencao_planos').update(payload).eq('id', editando.id)
      : await sb.from('manutencao_planos').insert(payload);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar o plano.'); return; }
    toast.success(editando ? 'Plano atualizado!' : 'Plano criado!');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editando ? 'Editar plano preventivo' : 'Novo plano preventivo'}</h3>
      <div className="space-y-4">
        <Campo label="Título"><input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus placeholder="Ex.: Manutenção mensal do gerador" /></Campo>
        <Campo label="Descrição" hint="(opcional)"><textarea className={inp} rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} /></Campo>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Campo label="Tipo">
            <select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value as 'preventiva' | 'inspecao')}>
              <option value="preventiva">Preventiva</option>
              <option value="inspecao">Inspeção</option>
            </select>
          </Campo>
          <Campo label="Prioridade">
            <select className={inp} value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>
              {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </Campo>
          <Campo label="Periodicidade">
            <select className={inp} value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}>
              {PERIODICIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </Campo>
          <Campo label="A cada">
            <input type="number" min={1} className={inp} value={intervalo} onChange={(e) => setIntervalo(e.target.value)} />
          </Campo>
        </div>

        {semCalendario ? (
          <p className="rounded-lg bg-sky-50 px-3 py-2 text-xs text-sky-700">Periodicidade por horas de uso não é agendada por data — gere a OS manualmente quando o equipamento atingir o limite de horas.</p>
        ) : (
          <Campo label="Próxima data" hint="(quando gerar a próxima OS)"><input type="date" className={inp} value={proximaData} onChange={(e) => setProximaData(e.target.value)} /></Campo>
        )}

        {/* Alvo */}
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

        {/* Responsável */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Responsável padrão">
            <select className={inp} value={respTipo} onChange={(e) => { setRespTipo(e.target.value as ResponsavelTipo | ''); setRespId(''); }}>
              <option value="">Não atribuído</option>
              {RESP_TIPOS.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </Campo>
          {respTipo === 'equipe' && (
            <Campo label="Quem (equipe)">
              <select className={inp} value={respId} onChange={(e) => setRespId(e.target.value)}>
                <option value="">Selecione…</option>
                {equipe.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
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

        <div>
          <p className="mb-1.5 text-sm font-semibold text-ink-soft">Checklist (template) <span className="font-normal text-ink-muted">— copiado para cada OS gerada</span></p>
          <ChecklistEditor items={checklist} onChange={setChecklist} withCheck={false} />
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : editando ? 'Salvar plano' : 'Criar plano'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// ── Modal: checklist pré-evento (cria OS de inspeção vinculada ao evento) ─────
function PreEventoModal({ userId, eventos, planos, props, espacos, onClose, onSaved }: {
  userId: string; eventos: EventoLite[]; planos: Plano[]; props: PropriedadeLite[]; espacos: EspacoLite[];
  onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [eventoId, setEventoId] = useState('');
  const [templateId, setTemplateId] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>(PRE_EVENTO_PADRAO.map((item) => ({ item, ok: false })));
  const [saving, setSaving] = useState(false);

  const evento = eventos.find((e) => e.id === eventoId);
  const templates = planos.filter((p) => p.checklist.length > 0);

  function aplicarTemplate(id: string) {
    setTemplateId(id);
    const p = planos.find((x) => x.id === id);
    if (p) setChecklist(p.checklist.map((c) => ({ item: c.item, ok: false })));
    else setChecklist(PRE_EVENTO_PADRAO.map((item) => ({ item, ok: false })));
  }

  async function criar() {
    if (!eventoId) { toast.error('Escolha o evento.'); return; }
    if (!checklist.length) { toast.error('Adicione ao menos um item ao checklist.'); return; }
    setSaving(true);
    const nome = evento?.nome_evento || evento?.quem_contratou || 'Evento';
    // prazo = véspera do evento (1 dia antes), se houver data
    let prazo: string | null = null;
    if (evento?.data_inicio) { const d = new Date(evento.data_inicio + 'T12:00:00'); d.setDate(d.getDate() - 1); prazo = ymd(d); }
    const { error } = await sb.from('manutencao_os').insert({
      usuario_id: userId, tipo: 'inspecao', titulo: `Pré-evento: ${nome}`, prioridade: 'alta', status: 'aberta',
      propriedade_id: evento?.propriedade_id ?? null, evento_id: eventoId, abertura: ymd(new Date()), prazo,
      descricao: 'Vistoria de manutenção antes do evento — garantir que tudo funciona.',
      checklist, custo_mao_obra_num: 0, custo_pecas_num: 0,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao criar a vistoria.'); return; }
    toast.success('Vistoria pré-evento criada — veja na aba Ordens.');
    onSaved();
  }

  const { feitos, total } = progressoChecklist(checklist);

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-50 text-violet-600"><IcoFlag /></span>
        <div>
          <h3 className="font-display text-xl font-bold text-ink">Checklist pré-evento</h3>
          <p className="text-xs text-ink-muted">Cria uma OS de inspeção vinculada ao evento.</p>
        </div>
      </div>
      {eventos.length === 0 ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Nenhum evento/reserva cadastrado para vincular. Crie um evento em Clientes/Reservas primeiro.</p>
      ) : (
        <div className="space-y-4">
          <Campo label="Evento / reserva">
            <select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">Selecione…</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome_evento || ev.quem_contratou || 'Evento'}{ev.data_inicio ? ` · ${formatDate(ev.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </Campo>
          {templates.length > 0 && (
            <Campo label="Usar checklist de um plano" hint="(opcional)">
              <select className={inp} value={templateId} onChange={(e) => aplicarTemplate(e.target.value)}>
                <option value="">Checklist padrão</option>
                {templates.map((p) => <option key={p.id} value={p.id}>{p.titulo}</option>)}
              </select>
            </Campo>
          )}
          <div>
            <p className="mb-1.5 text-sm font-semibold text-ink-soft">Itens a vistoriar <span className="font-normal text-ink-muted">({feitos}/{total})</span></p>
            <ChecklistEditor items={checklist} onChange={setChecklist} />
          </div>
          <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">A OS só poderá ser concluída quando todos os itens estiverem marcados.</p>
        </div>
      )}
      <div className="mt-6 flex items-center gap-3">
        <button onClick={criar} disabled={saving || !eventoId} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60"><IcoSpark /> {saving ? 'Criando…' : 'Criar vistoria'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

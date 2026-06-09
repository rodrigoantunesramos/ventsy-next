'use client';

// Construtor de automação — modal "se isto, então aquilo".
// Gatilho → condição (filtros) → ação (canal + mensagem) → prévia/teste. Salva em
// `automacoes` via RLS (_lib.salvarAutomacao). A prévia/teste passam pela
// /api/automacoes (service-role) para varrer o estado atual. Sem "R$" hardcoded —
// `valor_min` é número CRU (a moeda é formatada nas mensagens pelo servidor).

import { useMemo, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  type Automacao, type Gatilho, type Acao, type Urgencia,
  GATILHOS, GATILHO_BY, ACOES, ACAO_BY, URGENCIAS, VARIAVEIS,
  diasDoGatilho, validarAutomacao, resumoAutomacao,
} from '@/lib/automacoes';
import type { AutomacoesCtx, AutomacaoForm } from '../_lib';
import { apiPrevia, apiTestar, salvarAutomacao } from '../_lib';
import {
  ModalShell, Campo, Toggle, Chip, GatilhoIcon, AcaoIcon,
  inp, sel, btnPrimary, btnSecondary, IcoBolt, IcoPlay, IcoSparkle, IcoCheck,
} from './ui';

function formInicial(a: Automacao | null): AutomacaoForm {
  if (a) return { id: a.id, nome: a.nome, gatilho: a.gatilho, condicao: { ...a.condicao }, acao: a.acao, acao_config: { ...a.acao_config }, ativo: a.ativo };
  return {
    id: null, nome: '', gatilho: 'x_dias_antes_evento', condicao: { dias: 7 },
    acao: 'notificar', acao_config: { destinatario: 'dono', urgencia: 'info', titulo: '', mensagem: '' }, ativo: true,
  };
}

export default function Builder({ ctx, inicial, onClose, onSaved }: {
  ctx: AutomacoesCtx; inicial: Automacao | null; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState<AutomacaoForm>(() => formInicial(inicial));
  const [saving, setSaving] = useState(false);
  const [previa, setPrevia] = useState<{ total: number; amostra: { alvo_label: string }[] } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const msgRef = useRef<HTMLTextAreaElement>(null);

  const gMeta = GATILHO_BY[f.gatilho];
  const aMeta = ACAO_BY[f.acao];
  const escopo = gMeta?.escopo;
  const resumo = useMemo(() => resumoAutomacao(f), [f]);

  function set(patch: Partial<AutomacaoForm>) { setF((p) => ({ ...p, ...patch })); setPrevia(null); }
  function setCond(patch: Partial<AutomacaoForm['condicao']>) { set({ condicao: { ...f.condicao, ...patch } }); }
  function setCfg(patch: Partial<AutomacaoForm['acao_config']>) { set({ acao_config: { ...f.acao_config, ...patch } }); }

  function trocarGatilho(g: Gatilho) {
    const meta = GATILHO_BY[g];
    set({ gatilho: g, condicao: { dias: meta?.temDias ? meta.diasDefault : undefined, ...(g === 'feedback_negativo' ? { nota_max: 2 } : {}) } });
  }
  function trocarAcao(a: Acao) {
    const next: AutomacaoForm['acao_config'] = { ...f.acao_config };
    if ((a === 'enviar_email' || a === 'enviar_whatsapp') && !next.destinatario) next.destinatario = 'cliente';
    set({ acao: a, acao_config: next });
  }

  function inserirVar(k: string) {
    const ta = msgRef.current;
    const token = `{{${k}}}`;
    if (!ta) { setCfg({ mensagem: (f.acao_config.mensagem || '') + token }); return; }
    const start = ta.selectionStart ?? (f.acao_config.mensagem || '').length;
    const end = ta.selectionEnd ?? start;
    const cur = f.acao_config.mensagem || '';
    const next = cur.slice(0, start) + token + cur.slice(end);
    setCfg({ mensagem: next });
    requestAnimationFrame(() => { ta.focus(); const pos = start + token.length; ta.setSelectionRange(pos, pos); });
  }

  const tiposEvento = ctx.tiposEvento;
  const mostraTipos = escopo === 'evento' || escopo === 'parcela' || escopo === 'contrato' || escopo === 'feedback';
  const mostraProp = escopo === 'evento' || escopo === 'parcela' || escopo === 'contrato' || escopo === 'licenca';
  const mostraValor = escopo === 'evento' || escopo === 'parcela';
  const mostraNota = f.gatilho === 'feedback_negativo';
  const mostraStatus = escopo === 'evento';
  const usaCanal = f.acao === 'enviar_email' || f.acao === 'enviar_whatsapp';
  const usaUrgencia = f.acao === 'notificar' || f.acao === 'criar_tarefa' || f.acao === 'mover_funil';

  function toggleTipo(t: string) {
    const cur = f.condicao.tipos_evento || [];
    setCond({ tipos_evento: cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t] });
  }
  function toggleStatus(stv: string) {
    const cur = f.condicao.status || [];
    setCond({ status: cur.includes(stv) ? cur.filter((x) => x !== stv) : [...cur, stv] });
  }

  async function preVisualizar() {
    setPreviewing(true);
    const r = await apiPrevia({ id: f.id ?? undefined, nome: f.nome, gatilho: f.gatilho, condicao: f.condicao, acao: f.acao, acao_config: f.acao_config });
    setPreviewing(false);
    if (r.error) { toast.error(String(r.error)); return; }
    setPrevia({ total: Number(r.total) || 0, amostra: (r.amostra as { alvo_label: string }[]) || [] });
  }

  async function salvar(): Promise<string | null> {
    const erros = validarAutomacao(f);
    if (erros.length) { toast.error(erros[0]); return null; }
    setSaving(true);
    const id = await salvarAutomacao(ctx.userId, f);
    setSaving(false);
    if (!id) { toast.error('Não foi possível salvar a automação.'); return null; }
    if (!f.id) setF((p) => ({ ...p, id }));   // vira "edição" → habilita teste
    return id;
  }

  async function onSalvar() {
    const id = await salvar();
    if (!id) return;
    toast.success(inicial ? 'Automação atualizada.' : 'Automação criada.');
    onSaved();
  }

  async function onTestar() {
    const id = await salvar();
    if (!id) return;
    const r = await apiTestar(id);
    if (r.error) { toast.error(String(r.error)); return; }
    const exec = Number(r.executados) || 0, pul = Number(r.pulados) || 0;
    if (exec > 0) toast.success(`Disparou para ${exec} alvo(s) agora.`);
    else if (pul > 0) toast.info('Nada novo — os alvos de hoje já haviam sido processados.');
    else toast.info('Nenhum alvo casou com a regra hoje.');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand"><IcoBolt /></span>
        <h2 className="text-lg font-bold text-ink">{inicial ? 'Editar automação' : 'Nova automação'}</h2>
      </div>
      <p className="mb-4 text-sm text-ink-muted">Monte a regra <strong className="text-ink-soft">se isto → então aquilo</strong>. Você pode pré-visualizar e testar antes de deixar ativa.</p>

      {/* resumo vivo */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-black/[0.03] px-3 py-2 text-sm">
        <Chip className="bg-white text-ink-soft"><GatilhoIcon g={f.gatilho} /> SE {resumo.se}</Chip>
        <span className="text-ink-muted">→</span>
        <Chip className="bg-white text-ink-soft"><AcaoIcon a={f.acao} /> ENTÃO {resumo.entao}</Chip>
      </div>

      <div className="space-y-4">
        <Campo label="Nome da automação">
          <input value={f.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Lembrete de parcela a vencer" className={inp} />
        </Campo>

        {/* ── SE (gatilho + condição) ── */}
        <div className="rounded-xl border border-black/[0.06] p-3.5">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><span className="text-brand">SE</span> acontecer</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Gatilho">
              <select value={f.gatilho} onChange={(e) => trocarGatilho(e.target.value as Gatilho)} className={sel}>
                {GATILHOS.map((g) => <option key={g.v} value={g.v}>{g.label}</option>)}
              </select>
            </Campo>
            {gMeta?.temDias && (
              <Campo label={`Nº de ${gMeta.diasLabel}`}>
                <input type="number" min={0} value={f.condicao.dias ?? gMeta.diasDefault}
                  onChange={(e) => setCond({ dias: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} className={inp} />
              </Campo>
            )}
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-muted">{gMeta?.desc}</p>

          {/* filtros da condição */}
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {mostraProp && ctx.propriedades.length > 0 && (
              <Campo label="Propriedade (opcional)">
                <select value={f.condicao.propriedade_id ?? ''} onChange={(e) => setCond({ propriedade_id: e.target.value === '' ? null : Number(e.target.value) })} className={sel}>
                  <option value="">Todas</option>
                  {ctx.propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
              </Campo>
            )}
            {mostraValor && (
              <Campo label="Valor mínimo (opcional)" hint="Número cru, sem moeda.">
                <input type="number" min={0} value={f.condicao.valor_min ?? ''} onChange={(e) => setCond({ valor_min: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })} placeholder="0" className={inp} />
              </Campo>
            )}
            {mostraNota && (
              <Campo label="Nota máxima (dispara se ≤)" hint="Escala 1–5.">
                <input type="number" min={1} max={5} value={f.condicao.nota_max ?? 2} onChange={(e) => setCond({ nota_max: Math.max(1, Math.min(5, Number(e.target.value) || 2)) })} className={inp} />
              </Campo>
            )}
          </div>
          {mostraTipos && tiposEvento.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-sm font-semibold text-ink-soft">Tipos de evento (opcional)</div>
              <div className="flex flex-wrap gap-1.5">
                {tiposEvento.map((t) => {
                  const on = (f.condicao.tipos_evento || []).includes(t);
                  return <button key={t} type="button" onClick={() => toggleTipo(t)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-brand text-white' : 'bg-black/[0.04] text-ink-soft hover:bg-black/[0.08]'}`}>{t}</button>;
                })}
              </div>
            </div>
          )}
          {mostraStatus && ctx.statusEvento.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-sm font-semibold text-ink-soft">Status do funil (opcional)</div>
              <div className="flex flex-wrap gap-1.5">
                {ctx.statusEvento.map((stv) => {
                  const on = (f.condicao.status || []).includes(stv);
                  return <button key={stv} type="button" onClick={() => toggleStatus(stv)} className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${on ? 'bg-brand text-white' : 'bg-black/[0.04] text-ink-soft hover:bg-black/[0.08]'}`}>{stv}</button>;
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── ENTÃO (ação) ── */}
        <div className="rounded-xl border border-black/[0.06] p-3.5">
          <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-ink-muted"><span className="text-brand">ENTÃO</span> fazer</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Campo label="Ação">
              <select value={f.acao} onChange={(e) => trocarAcao(e.target.value as Acao)} className={sel}>
                {ACOES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
              </select>
            </Campo>
            {usaCanal && (
              <Campo label="Destinatário">
                <select value={f.acao_config.destinatario || 'cliente'} onChange={(e) => setCfg({ destinatario: e.target.value as 'dono' | 'cliente' })} className={sel}>
                  <option value="cliente">O cliente</option>
                  <option value="dono">Você (dono)</option>
                </select>
              </Campo>
            )}
            {usaUrgencia && (
              <Campo label="Urgência">
                <select value={f.acao_config.urgencia || 'info'} onChange={(e) => setCfg({ urgencia: e.target.value as Urgencia })} className={sel}>
                  {URGENCIAS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}
                </select>
              </Campo>
            )}
            {f.acao === 'mover_funil' && (
              <Campo label="Status de destino">
                {ctx.statusEvento.length > 0 ? (
                  <select value={f.acao_config.novo_status || ''} onChange={(e) => setCfg({ novo_status: e.target.value })} className={sel}>
                    <option value="">Escolha…</option>
                    {ctx.statusEvento.map((stv) => <option key={stv} value={stv}>{stv}</option>)}
                  </select>
                ) : (
                  <input value={f.acao_config.novo_status || ''} onChange={(e) => setCfg({ novo_status: e.target.value })} placeholder="Ex.: Em negociação" className={inp} />
                )}
              </Campo>
            )}
          </div>
          <p className="mt-1.5 text-[0.72rem] text-ink-muted">{aMeta?.desc}</p>

          {f.acao !== 'mover_funil' && (
            <>
              <div className="mt-3">
                <Campo label={f.acao === 'enviar_email' ? 'Assunto / título' : 'Título'}>
                  <input value={f.acao_config.titulo || ''} onChange={(e) => setCfg({ titulo: e.target.value })} placeholder="Ex.: Parcela a vencer — {{evento}}" className={inp} />
                </Campo>
              </div>
              <div className="mt-3">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-soft">Mensagem</span>
                  <div className="flex flex-wrap gap-1">
                    {VARIAVEIS.map((v) => (
                      <button key={v.k} type="button" onClick={() => inserirVar(v.k)} title={`${v.label} (ex.: ${v.exemplo})`}
                        className="rounded-md bg-brand-50 px-1.5 py-0.5 text-[0.68rem] font-semibold text-brand hover:bg-brand-100">{`{{${v.k}}}`}</button>
                    ))}
                  </div>
                </div>
                <textarea ref={msgRef} value={f.acao_config.mensagem || ''} onChange={(e) => setCfg({ mensagem: e.target.value })} rows={4}
                  placeholder="Escreva a mensagem. Use as variáveis acima — elas são preenchidas na hora do disparo." className={`${inp} resize-y`} />
                <p className="mt-1 text-[0.7rem] text-ink-muted">As variáveis viram texto no envio (ex.: <code className="rounded bg-black/[0.05] px-1">{'{{valor}}'}</code> sai já formatado na sua moeda).</p>
              </div>
            </>
          )}
        </div>

        {/* prévia */}
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-ink-soft"><IcoSparkle /> Pré-visualização</div>
            <button type="button" onClick={preVisualizar} disabled={previewing} className={btnSecondary}>
              {previewing ? 'Verificando…' : 'Ver quem dispararia hoje'}
            </button>
          </div>
          {previa && (
            <div className="mt-2.5 text-sm">
              {previa.total === 0 ? (
                <p className="text-ink-muted">Nenhum alvo casaria com esta regra hoje. Isso é normal — a regra dispara quando a condição acontecer (ex.: na data certa).</p>
              ) : (
                <>
                  <p className="text-ink-soft">Dispararia para <strong className="text-brand">{previa.total}</strong> alvo(s) hoje:</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {previa.amostra.map((a, i) => <Chip key={i} className="bg-white text-ink-soft">{a.alvo_label}</Chip>)}
                    {previa.total > previa.amostra.length && <Chip className="bg-white text-ink-muted">+{previa.total - previa.amostra.length}</Chip>}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-sm">
          <Toggle checked={f.ativo} onChange={(v) => set({ ativo: v })} label="Ativa" />
          <span className="font-medium text-ink-soft">{f.ativo ? 'Ativa — vai rodar no processador diário' : 'Inativa — não dispara'}</span>
        </label>
      </div>

      {/* footer */}
      <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t border-black/[0.06] pt-4">
        <button type="button" onClick={onTestar} disabled={saving} className={btnSecondary}><IcoPlay /> Salvar e testar agora</button>
        <button type="button" onClick={onSalvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : <><IcoCheck /> Salvar</>}</button>
      </div>
    </ModalShell>
  );
}

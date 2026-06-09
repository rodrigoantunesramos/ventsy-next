'use client';

// Construtor de campanha (/painel/campanhas) — modal multi-etapas:
//   1) Básico (nome · canal · assunto)  2) Público (segmentos + contagem ao vivo)
//   3) Mensagem (templates · variáveis · IA · preview)  4) Revisar (testar · agendar · enviar)
// A contagem de público é 100% client-side via lib/campanhas.resolverPublico (puro);
// o disparo/agendamento/teste delega à página (onCommit/onTeste/onGerarIA), que
// materializa a fila (campanhas_envios) e chama a API. Sem "R$".

import { useEffect, useMemo, useRef, useState } from 'react';
import { formatNumber } from '@/lib/format';
import {
  type Canal, type SegmentoFiltro, type ClienteAlvo, type Descadastro, type Campanha,
  TEMPLATES, VARIAVEIS, resolverPublico, varsDoAlvo, interpolar, validarCampanha, segmentoVazio,
} from '@/lib/campanhas';
import { SEGMENTOS, ORIGEM_LABEL } from '../../clientes/_lib';
import { IcoX, IcoChevron, IcoSparkles, IcoSend, IcoCalendar, IcoCheck, IcoUsers, IcoEye } from './ui';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export type CommitArgs = {
  campos: { nome: string; canal: Canal; assunto: string; corpo: string };
  filtro: SegmentoFiltro;
  modo: 'rascunho' | 'enviar' | 'agendar' | 'whatsapp';
  agendada_para: string | null;
};
type Props = {
  inicial: Campanha | null;
  alvos: ClienteAlvo[];
  descadastros: Descadastro[];
  empresa: string;
  isPro: boolean;
  restanteEmail: number;          // cota de e-mails restante no mês (limite do plano)
  podeEmail: boolean;             // plano permite envio por e-mail (Pro+)
  origens: string[];
  cidades: string[];
  tags: string[];
  tiposEvento: string[];
  now: Date;
  onClose: () => void;
  onCommit: (a: CommitArgs) => Promise<boolean>;
  onTeste: (campos: CommitArgs['campos'], email: string) => Promise<void>;
  onGerarIA: (objetivo: string, canal: Canal) => Promise<{ assunto: string; corpo: string } | null>;
};

// chip multi-seleção
function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${on ? 'border-brand bg-brand text-white' : 'border-black/10 bg-white text-ink-soft hover:border-brand/40'}`}>
      {children}
    </button>
  );
}

export function Builder(props: Props) {
  const { inicial, alvos, descadastros, empresa, isPro, restanteEmail, podeEmail, origens, cidades, tags, tiposEvento, now, onClose, onCommit, onTeste, onGerarIA } = props;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState('');

  // ── Campos ──
  const [nome, setNome] = useState(inicial?.nome || '');
  const [canal, setCanal] = useState<Canal>(inicial?.canal === 'whatsapp' ? 'whatsapp' : 'email');
  const [assunto, setAssunto] = useState(inicial?.assunto || '');
  const [corpo, setCorpo] = useState(inicial?.corpo || '');
  const [filtro, setFiltro] = useState<SegmentoFiltro>(inicial?.segmento || {});
  const [agch, setAgch] = useState('');        // datetime-local
  const [teste, setTeste] = useState('');
  const [objetivo, setObjetivo] = useState('');
  const [iaBusy, setIaBusy] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const corpoRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [onClose]);

  // ── Público ao vivo (puro) ──
  const publico = useMemo(() => resolverPublico(alvos, filtro, descadastros, canal, now), [alvos, filtro, descadastros, canal, now]);
  const permitido = canal === 'email' ? Math.min(publico.elegiveis.length, restanteEmail) : publico.elegiveis.length;
  const estourou = canal === 'email' && publico.elegiveis.length > restanteEmail;

  // ── Preview interpolado (1º elegível ou amostra) ──
  const amostra: Record<string, string> = useMemo(() => {
    const a = publico.elegiveis[0]?.alvo;
    return a ? varsDoAlvo(a, empresa) : { nome: 'Maria', evento: 'seu evento', empresa: empresa || 'sua empresa' };
  }, [publico, empresa]);

  // multi-toggle helper
  function toggle<T extends string>(key: keyof SegmentoFiltro, val: T) {
    setFiltro((f) => {
      const arr = ((f[key] as string[] | undefined) || []).slice();
      const i = arr.indexOf(val);
      if (i >= 0) arr.splice(i, 1); else arr.push(val);
      return { ...f, [key]: arr.length ? arr : undefined };
    });
  }
  const has = (key: keyof SegmentoFiltro, val: string) => ((filtro[key] as string[] | undefined) || []).includes(val);

  function inserirVar(k: string) {
    const ta = corpoRef.current;
    const token = `{{${k}}}`;
    if (!ta) { setCorpo((c) => c + token); return; }
    const s = ta.selectionStart ?? corpo.length, e = ta.selectionEnd ?? corpo.length;
    const novo = corpo.slice(0, s) + token + corpo.slice(e);
    setCorpo(novo);
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + token.length; });
  }

  function aplicarTemplate(id: string) {
    const t = TEMPLATES.find((x) => x.id === id);
    if (!t) return;
    if (canal === 'email') setAssunto(t.assunto);
    setCorpo(t.corpo);
  }

  async function gerarIA() {
    if (!objetivo.trim()) { setErro('Descreva o objetivo para a IA.'); return; }
    setErro(''); setIaBusy(true);
    const r = await onGerarIA(objetivo.trim(), canal);
    setIaBusy(false);
    if (r) { if (canal === 'email' && r.assunto) setAssunto(r.assunto); setCorpo(r.corpo); }
  }

  const campos = { nome: nome.trim(), canal, assunto: assunto.trim(), corpo: corpo.trim() };
  const errosCampos = validarCampanha(campos);

  function podeAvancar(): boolean {
    if (step === 0) return !!nome.trim() && (canal !== 'email' || !!assunto.trim());
    if (step === 1) return publico.elegiveis.length > 0;
    if (step === 2) return !!corpo.trim();
    return true;
  }

  async function commit(modo: CommitArgs['modo']) {
    setErro('');
    // Rascunho aceita campanha incompleta — só exige um nome para identificá-la.
    if (modo === 'rascunho') { if (!nome.trim()) { setErro('Dê um nome à campanha.'); return; } }
    else if (errosCampos.length) { setErro(errosCampos[0]); return; }
    if (modo !== 'rascunho' && publico.elegiveis.length === 0) { setErro('Nenhum destinatário no público selecionado.'); return; }
    let agendada_para: string | null = null;
    if (modo === 'agendar') {
      if (!agch) { setErro('Escolha a data e a hora do agendamento.'); return; }
      const d = new Date(agch);
      if (Number.isNaN(d.getTime()) || d.getTime() < Date.now()) { setErro('A data de agendamento precisa estar no futuro.'); return; }
      agendada_para = d.toISOString();
    }
    setBusy(true);
    const ok = await onCommit({ campos, filtro, modo, agendada_para });
    setBusy(false);
    if (ok) onClose();
  }

  async function enviarTeste() {
    if (!teste.includes('@')) { setErro('Informe um e-mail de teste válido.'); return; }
    if (errosCampos.length) { setErro(errosCampos[0]); return; }
    setErro(''); setBusy(true);
    await onTeste(campos, teste.trim());
    setBusy(false);
  }

  const STEPS = ['Básico', 'Público', 'Mensagem', 'Revisar'];

  return (
    <div className="fixed inset-0 z-[300] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        {/* Header + stepper */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-ink">{inicial ? 'Editar campanha' : 'Nova campanha'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1 text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
        </div>
        <div className="flex items-center gap-1 px-5 pt-3">
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => i < step && setStep(i)} disabled={i > step}
              className={`flex flex-1 items-center gap-1.5 ${i <= step ? 'text-brand' : 'text-ink-muted'}`}>
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < step ? 'bg-brand text-white' : i === step ? 'border-2 border-brand text-brand' : 'border border-black/15'}`}>
                {i < step ? <IcoCheck size={12} /> : i + 1}
              </span>
              <span className="hidden text-xs font-semibold sm:block">{s}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {/* ── Etapa 1: Básico ── */}
          {step === 0 && (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome da campanha</span>
                <input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Reativação de clientes de casamento" autoFocus />
                <span className="mt-1 block text-xs text-ink-muted">Interno — o cliente não vê este nome.</span>
              </label>
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Canal</span>
                <div className="grid grid-cols-2 gap-3">
                  {(['email', 'whatsapp'] as Canal[]).map((c) => (
                    <button key={c} type="button" onClick={() => setCanal(c)}
                      className={`flex items-center gap-2 rounded-xl border-2 px-4 py-3 text-sm font-semibold transition ${canal === c ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand/30'}`}>
                      <span aria-hidden>{c === 'email' ? '✉️' : '💬'}</span> {c === 'email' ? 'E-mail' : 'WhatsApp'}
                    </button>
                  ))}
                </div>
                {canal === 'whatsapp' && <p className="mt-2 text-xs text-ink-muted">Sem provedor de API conectado, o WhatsApp gera links <code className="rounded bg-black/[0.06] px-1">wa.me</code> em lote para você enviar — métricas de abertura não se aplicam.</p>}
                {canal === 'email' && !podeEmail && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">Envio em massa por e-mail é um recurso Pro+. Você pode montar e salvar como rascunho.</p>}
              </div>
              {canal === 'email' && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Assunto do e-mail</span>
                  <input className={inp} value={assunto} onChange={(e) => setAssunto(e.target.value)} placeholder="Ex.: Sentimos sua falta, {{nome}} 💜" />
                  <span className="mt-1 block text-xs text-ink-muted">Pode usar variáveis como <code className="rounded bg-black/[0.06] px-1">{'{{nome}}'}</code>.</span>
                </label>
              )}
            </div>
          )}

          {/* ── Etapa 2: Público ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50/60 to-white p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><IcoUsers /> Público selecionado</span>
                  <span className="text-2xl font-bold text-brand">{formatNumber(publico.elegiveis.length)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {segmentoVazio(filtro) ? 'Todos os clientes' : 'Filtro aplicado'} · de {formatNumber(publico.totalNoSegmento)} no segmento
                  {publico.semContato > 0 && <> · {formatNumber(publico.semContato)} sem {canal === 'email' ? 'e-mail' : 'WhatsApp'}</>}
                  {publico.descadastrados > 0 && <> · {formatNumber(publico.descadastrados)} descadastrado(s)</>}
                </p>
                {estourou && <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">Seu plano permite enviar {formatNumber(restanteEmail)} este mês — os primeiros {formatNumber(permitido)} serão enviados.</p>}
              </div>

              <Secao titulo="Segmento (RFM)">
                {SEGMENTOS.map((s) => <Chip key={s.v} on={has('segmentos', s.v)} onClick={() => toggle('segmentos', s.v)}>{s.label}</Chip>)}
              </Secao>
              {origens.length > 0 && (
                <Secao titulo="Origem">
                  {origens.map((o) => <Chip key={o} on={has('origens', o)} onClick={() => toggle('origens', o)}>{ORIGEM_LABEL[o] || o}</Chip>)}
                </Secao>
              )}
              {tiposEvento.length > 0 && (
                <Secao titulo="Tipo de evento já contratado">
                  {tiposEvento.map((t) => <Chip key={t} on={has('tiposEvento', t)} onClick={() => toggle('tiposEvento', t)}>{t}</Chip>)}
                </Secao>
              )}
              {cidades.length > 0 && (
                <Secao titulo="Cidade">
                  {cidades.slice(0, 12).map((c) => <Chip key={c} on={has('cidades', c)} onClick={() => toggle('cidades', c)}>{c}</Chip>)}
                </Secao>
              )}
              {tags.length > 0 && (
                <Secao titulo="Tags">
                  {tags.slice(0, 16).map((t) => <Chip key={t} on={has('tags', t)} onClick={() => toggle('tags', t)}>{t}</Chip>)}
                </Secao>
              )}
              <Secao titulo="Atalhos">
                <Chip on={!!filtro.vip} onClick={() => setFiltro((f) => ({ ...f, vip: f.vip ? undefined : true }))}>⭐ Somente VIP</Chip>
                <Chip on={!!filtro.inativo90} onClick={() => setFiltro((f) => ({ ...f, inativo90: f.inativo90 ? undefined : true }))}>💤 Inativos 90d+</Chip>
                <Chip on={!!filtro.aniversariantesMes} onClick={() => setFiltro((f) => ({ ...f, aniversariantesMes: f.aniversariantesMes ? undefined : true }))}>🎂 Aniversariantes do mês</Chip>
              </Secao>
              {!segmentoVazio(filtro) && <button onClick={() => setFiltro({})} className="text-xs font-semibold text-ink-muted hover:text-brand">Limpar filtros</button>}
            </div>
          )}

          {/* ── Etapa 3: Mensagem ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Começar de um template</span>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} type="button" onClick={() => aplicarTemplate(t.id)}
                      className="rounded-lg border border-black/10 bg-white px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-brand/40 hover:text-brand">
                      {t.nome}
                    </button>
                  ))}
                </div>
              </div>

              {/* IA */}
              <div className="rounded-2xl border border-brand/15 bg-gradient-to-br from-brand-50/50 to-white p-4">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-ink"><IcoSparkles /> Gerar com IA {isPro ? '' : '(Pro+)'}</span>
                {isPro ? (
                  <div className="mt-2 flex gap-2">
                    <input className={inp} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo: ex. promover datas de fim de ano" />
                    <button onClick={gerarIA} disabled={iaBusy} className="shrink-0 rounded-xl bg-brand px-4 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{iaBusy ? '…' : 'Gerar'}</button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-ink-muted">Descreva um objetivo e a IA escreve assunto e corpo. Disponível no Pro+.</p>
                )}
              </div>

              {canal === 'email' && (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Assunto</span>
                  <input className={inp} value={assunto} onChange={(e) => setAssunto(e.target.value)} />
                </label>
              )}
              <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink-soft">Mensagem</span>
                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-xs text-ink-muted">Inserir:</span>
                    {VARIAVEIS.map((v) => (
                      <button key={v.k} type="button" onClick={() => inserirVar(v.k)} title={v.label}
                        className="rounded-md bg-black/[0.05] px-1.5 py-0.5 text-xs font-medium text-ink-soft hover:bg-brand/10 hover:text-brand">{`{{${v.k}}}`}</button>
                    ))}
                  </div>
                </div>
                <textarea ref={corpoRef} className={`${inp} min-h-[180px] font-mono text-[0.8rem] leading-relaxed`} value={corpo} onChange={(e) => setCorpo(e.target.value)} placeholder={'Olá {{nome}},\n\nEscreva sua mensagem aqui…'} />
              </div>

              <button onClick={() => setShowPreview((v) => !v)} className="flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"><IcoEye /> {showPreview ? 'Ocultar' : 'Ver'} preview</button>
              {showPreview && (
                <div className="rounded-2xl border border-black/[0.06] bg-[#f7f7f8] p-4">
                  {canal === 'email' && <div className="mb-2 border-b border-black/[0.06] pb-2 text-sm"><span className="text-ink-muted">Assunto: </span><span className="font-semibold text-ink">{interpolar(assunto, amostra) || '—'}</span></div>}
                  <div className={canal === 'whatsapp' ? 'max-w-[80%] rounded-2xl rounded-tl-sm bg-[#dcf8c6] p-3 text-sm text-ink-soft' : 'text-sm text-ink-soft'}>
                    <p className="whitespace-pre-wrap leading-relaxed">{interpolar(corpo, amostra) || 'Sua mensagem aparecerá aqui.'}</p>
                  </div>
                  <p className="mt-2 text-[0.7rem] text-ink-muted">Pré-visualização com dados de {amostra.nome}.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Etapa 4: Revisar ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Info label="Canal" valor={canal === 'email' ? '✉️ E-mail' : '💬 WhatsApp'} />
                <Info label="Público" valor={`${formatNumber(canal === 'email' ? permitido : publico.elegiveis.length)} destinatário(s)`} />
              </div>
              {canal === 'email' && (
                <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-sm">
                  <div className="text-ink-muted">Assunto</div>
                  <div className="font-semibold text-ink">{interpolar(assunto, amostra)}</div>
                </div>
              )}
              <div className="max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-sm text-ink-soft">{interpolar(corpo, amostra)}</div>

              {canal === 'email' && podeEmail && (
                <div className="flex gap-2">
                  <input className={inp} value={teste} onChange={(e) => setTeste(e.target.value)} placeholder="Enviar teste para seu e-mail" type="email" />
                  <button onClick={enviarTeste} disabled={busy} className="shrink-0 rounded-xl border border-black/10 px-4 text-sm font-semibold text-ink-soft hover:border-brand/40 hover:text-brand disabled:opacity-50">Testar</button>
                </div>
              )}

              {canal === 'email' && (
                <details className="rounded-xl border border-black/[0.06] p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Agendar para depois</summary>
                  <div className="mt-2 flex gap-2">
                    <input type="datetime-local" className={inp} value={agch} onChange={(e) => setAgch(e.target.value)} />
                    <button onClick={() => commit('agendar')} disabled={busy || !podeEmail} className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-black/10 px-4 text-sm font-semibold text-ink-soft hover:border-brand/40 hover:text-brand disabled:opacity-50"><IcoCalendar /> Agendar</button>
                  </div>
                </details>
              )}

              {erro && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">{erro}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-2 border-t border-black/[0.06] px-5 py-4">
          {step > 0
            ? <button onClick={() => setStep((s) => s - 1)} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink">Voltar</button>
            : <button onClick={() => commit('rascunho')} disabled={busy || !nome.trim()} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-muted hover:text-ink disabled:opacity-40">Salvar rascunho</button>}
          {step < 3
            ? <button onClick={() => { setErro(''); podeAvancar() ? setStep((s) => s + 1) : setErro(step === 1 ? 'Selecione ao menos 1 destinatário.' : 'Preencha os campos obrigatórios.'); }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Continuar <IcoChevron /></button>
            : (
              <div className="flex items-center gap-2">
                <button onClick={() => commit('rascunho')} disabled={busy || !nome.trim()} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:bg-black/[0.03] disabled:opacity-50">Salvar rascunho</button>
                {canal === 'email'
                  ? <button onClick={() => commit('enviar')} disabled={busy || !podeEmail} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><IcoSend /> {busy ? 'Enviando…' : `Enviar (${formatNumber(permitido)})`}</button>
                  : <button onClick={() => commit('whatsapp')} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><IcoSend /> {busy ? 'Gerando…' : `Gerar links (${formatNumber(publico.elegiveis.length)})`}</button>}
              </div>
            )}
        </div>

        {step === 0 && erro && <p className="px-5 pb-4 -mt-2 text-sm text-red-600">{erro}</p>}
      </div>
    </div>
  );
}

function Secao({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-ink-muted">{titulo}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}
function Info({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.02] p-3">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="mt-0.5 text-sm font-bold text-ink">{valor}</div>
    </div>
  );
}

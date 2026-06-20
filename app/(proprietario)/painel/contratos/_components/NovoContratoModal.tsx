'use client';

// Geração de contrato (/painel/contratos · "Novo contrato").
// Fluxo: fonte (um evento do funil ou avulso) → modelo → variáveis (pré-preenchidas
// e editáveis) + cláusulas → signatários → PREVIEW → grava SNAPSHOT imutável
// (conteudo_final já renderizado) em `contratos` + linhas em `contratos_assinaturas`.
// Moeda/idioma via lib/format — sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatMoney, formatDate, getFormatPrefs, type Currency } from '@/lib/format';
import {
  buildContext, montarCorpo, renderTemplate, tokensUsados, proximoNumero, templatePadrao,
  VAR_DEFS, PAPEL_META,
  type ContratoTemplate, type Clausula, type Papel, type ContextoInput,
} from '@/lib/contracts';
import ContractBody from '@/components/ContractBody';
import { rotuloEvento, type EventoLite, type ClienteLite, type Propriedade, type EmpresaConfig } from '../_lib';
import { Icon, ModalShell, Field, inp, MoneyInput, PrimaryBtn, GhostBtn } from './ui';

type SignDraft = { signatario_nome: string; signatario_doc: string; email: string; papel: Papel; obrigatorio: boolean };
const LABEL_BY_TOKEN = Object.fromEntries(VAR_DEFS.map((v) => [v.token, v.label]));
// Tokens controlados por campos dedicados (não entram na grade editável de variáveis).
const AUTO_TOKENS = new Set(['contrato.numero', 'contrato.data', 'contrato.vencimento', 'valor']);

export function NovoContratoModal({
  userId, templates, eventos, clientes, propriedades, empresa, numerosExistentes, onClose, onCreated,
}: {
  userId: string; templates: ContratoTemplate[]; eventos: EventoLite[]; clientes: ClienteLite[];
  propriedades: Propriedade[]; empresa: EmpresaConfig; numerosExistentes: string[];
  onClose: () => void; onCreated: (id: string) => void;
}) {
  const toast = useToast();
  const ativos = useMemo(() => templates.filter((t) => t.ativo), [templates]);

  const [fonte, setFonte] = useState<'evento' | 'avulso'>(eventos.length ? 'evento' : 'avulso');
  const [eventoId, setEventoId] = useState<string>(eventos[0]?.id ? String(eventos[0].id) : '');
  const [templateId, setTemplateId] = useState<string>(ativos[0]?.id ?? 'padrao');
  const [moeda, setMoeda] = useState<Currency>(getFormatPrefs().currency);
  const [valorStr, setValorStr] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [titulo, setTitulo] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [clausulaOn, setClausulaOn] = useState<Record<string, boolean>>({});
  const [vars, setVars] = useState<Record<string, string>>({});
  const [signatarios, setSignatarios] = useState<SignDraft[]>([]);
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedEvento = useMemo(() => (fonte === 'evento' ? eventos.find((e) => String(e.id) === eventoId) ?? null : null), [fonte, eventos, eventoId]);
  const templateData = useMemo<ContratoTemplate | { corpo: string; clausulas: Clausula[] }>(() => {
    if (templateId === 'padrao') return templatePadrao(selectedEvento?.tipo_evento || undefined);
    return ativos.find((t) => t.id === templateId) ?? templatePadrao();
  }, [templateId, ativos, selectedEvento]);

  // Cliente/espaço resolvidos a partir do evento (quando houver).
  const cliente = useMemo<ClienteLite | null>(() => {
    if (!selectedEvento?.cliente_id) return null;
    return clientes.find((c) => c.id === selectedEvento.cliente_id) ?? null;
  }, [selectedEvento, clientes]);
  const espaco = useMemo<Propriedade | null>(() => {
    if (selectedEvento?.propriedade_id == null) return null;
    return propriedades.find((p) => p.id === selectedEvento.propriedade_id) ?? null;
  }, [selectedEvento, propriedades]);

  // Contexto-base (defaults das variáveis a partir das linhas cruas).
  const ctx0 = useMemo<Record<string, string>>(() => {
    const input: ContextoInput = {
      moeda,
      evento: selectedEvento ?? null,
      cliente: cliente ? { nome: cliente.nome, doc: cliente.doc, email: cliente.email, telefone: cliente.telefone, whatsapp: cliente.whatsapp, endereco: cliente.endereco, cidade: cliente.cidade, estado: cliente.estado } : null,
      empresa: empresa ? { razao_social: empresa.razao_social, fantasia: empresa.fantasia, cnpj: empresa.cnpj, endereco: empresa.endereco || {}, contatos: empresa.contatos || {} } : null,
      espaco: espaco ? { nome: espaco.nome, rua: espaco.rua, numero: espaco.numero, bairro: espaco.bairro, cidade: espaco.cidade, estado: espaco.estado } : null,
    };
    return buildContext(input);
  }, [moeda, selectedEvento, cliente, empresa, espaco]);

  // Cláusulas do modelo + corpo combinado para extrair os tokens.
  const clausulasSel = useMemo(() => (templateData.clausulas || []).filter((c) => clausulaOn[c.chave] !== false), [templateData, clausulaOn]);
  const corpoFull = useMemo(() => montarCorpo(templateData.corpo || '', clausulasSel), [templateData, clausulasSel]);
  const tokens = useMemo(() => tokensUsados(corpoFull).filter((t) => !AUTO_TOKENS.has(t)), [corpoFull]);

  // Default do valor a partir do evento quando troca a fonte.
  useEffect(() => {
    if (selectedEvento?.valor_total_num != null) setValorStr(String(selectedEvento.valor_total_num));
  }, [selectedEvento]);

  // Reinicia variáveis quando a fonte/modelo/conjunto de tokens muda.
  const tokensKey = tokens.join('|');
  useEffect(() => {
    setVars(Object.fromEntries(tokens.map((t) => [t, ctx0[t] ?? ''])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokensKey, eventoId, fonte, templateId]);

  // Cláusulas ativas por padrão quando troca o modelo.
  useEffect(() => {
    setClausulaOn(Object.fromEntries((templateData.clausulas || []).map((c) => [c.chave, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // Signatários padrão (contratante + contratada) quando troca a fonte/evento.
  useEffect(() => {
    const contratante: SignDraft = {
      signatario_nome: ctx0['cliente.nome'] || '', signatario_doc: ctx0['cliente.doc'] || '',
      email: ctx0['cliente.email'] || '', papel: 'contratante', obrigatorio: true,
    };
    const contratada: SignDraft = {
      signatario_nome: ctx0['contratada.razao'] || '', signatario_doc: ctx0['contratada.cnpj'] || '',
      email: ctx0['contratada.email'] || '', papel: 'contratada', obrigatorio: true,
    };
    setSignatarios([contratante, contratada]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventoId, fonte]);

  const valorNum = Number(valorStr) || 0;

  // Contexto final (com tokens auto) — usado no preview e no snapshot.
  const ctxFinal = useMemo<Record<string, string>>(() => ({
    ...vars,
    'contrato.numero': proximoNumero(numerosExistentes),
    'contrato.data': formatDate(new Date()),
    'contrato.vencimento': vencimento ? formatDate(vencimento) : '',
    'valor': valorNum ? formatMoney(valorNum, { currency: moeda }) : '',
  }), [vars, numerosExistentes, vencimento, valorNum, moeda]);

  const conteudoPreview = useMemo(() => renderTemplate(corpoFull, ctxFinal), [corpoFull, ctxFinal]);

  function updateSign(i: number, patch: Partial<SignDraft>) { setSignatarios((a) => a.map((s, idx) => (idx === i ? { ...s, ...patch } : s))); }
  function addTestemunha() { setSignatarios((a) => [...a, { signatario_nome: '', signatario_doc: '', email: '', papel: 'testemunha', obrigatorio: false }]); }
  function removeSign(i: number) { setSignatarios((a) => a.filter((_, idx) => idx !== i)); }

  async function gerar() {
    const validos = signatarios.filter((s) => s.signatario_nome.trim());
    if (validos.length === 0) { toast.error('Adicione ao menos um signatário com nome.'); return; }
    setSaving(true);
    const numero = proximoNumero(numerosExistentes);
    const ctxSnap = { ...ctxFinal, 'contrato.numero': numero };
    const conteudo_final = renderTemplate(corpoFull, ctxSnap);

    const { data: novo, error } = await sb.from('contratos').insert({
      usuario_id: userId,
      cliente_id: cliente?.id ?? null,
      evento_id: selectedEvento?.id ?? null,
      template_id: templateId === 'padrao' ? null : templateId,
      numero,
      titulo: titulo.trim() || (selectedEvento?.nome_evento ?? null),
      conteudo_final,
      variaveis: ctxSnap,
      valor_num: valorNum,
      moeda,
      status: 'rascunho',
      vencimento: vencimento || null,
      observacoes: observacoes.trim() || null,
    }).select('id').single();

    if (error || !novo) { setSaving(false); toast.error('Não foi possível criar o contrato.'); return; }

    const rows = validos.map((s, idx) => ({
      contrato_id: novo.id, usuario_id: userId,
      signatario_nome: s.signatario_nome.trim(), signatario_doc: s.signatario_doc.trim() || null,
      email: s.email.trim() || null, papel: s.papel, ordem: idx, obrigatorio: s.obrigatorio,
    }));
    const { error: sErr } = await sb.from('contratos_assinaturas').insert(rows);
    setSaving(false);
    if (sErr) { toast.error('Contrato criado, mas falhou ao salvar signatários.'); onCreated(novo.id); return; }
    toast.success('Contrato gerado. Revise e envie para assinatura.');
    onCreated(novo.id);
  }

  return (
    <ModalShell
      size="xl" onClose={onClose} icon={<Icon name="doc" size={18} />}
      title="Novo contrato" subtitle="Preencha as variáveis e confira o preview — ao enviar, o conteúdo vira um snapshot imutável."
      footer={<>
        <button onClick={() => setPreview((v) => !v)} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]"><Icon name="eye" size={14} /> {preview ? 'Ocultar preview' : 'Preview'}</button>
        <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
        <PrimaryBtn onClick={gerar} disabled={saving}>{saving ? 'Gerando…' : 'Gerar contrato'}</PrimaryBtn>
      </>}
    >
      {preview ? (
        <div className="rounded-2xl border border-black/[0.08] bg-[#fcfcfc] p-5">
          <ContractBody text={conteudoPreview} />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Fonte + modelo */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Origem do contrato">
              <div className="flex gap-2">
                <SegBtn active={fonte === 'evento'} onClick={() => setFonte('evento')} disabled={!eventos.length}>De um evento</SegBtn>
                <SegBtn active={fonte === 'avulso'} onClick={() => setFonte('avulso')}>Avulso</SegBtn>
              </div>
            </Field>
            <Field label="Modelo">
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={inp}>
                {ativos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                <option value="padrao">Modelo padrão (locação)</option>
              </select>
            </Field>
          </div>

          {fonte === 'evento' && (
            <Field label="Evento" hint="Puxa cliente, espaço, datas e valor automaticamente.">
              {eventos.length === 0
                ? <p className="text-xs text-ink-muted">Nenhum evento no funil. Use a origem “Avulso”.</p>
                : <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className={inp}>{eventos.map((e) => <option key={e.id} value={e.id}>{rotuloEvento(e)}</option>)}</select>}
            </Field>
          )}

          {/* Valor / moeda / vencimento / título */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Valor total"><MoneyInput value={valorStr} onChange={setValorStr} moeda={moeda} /></Field>
            <Field label="Moeda">
              <select value={moeda} onChange={(e) => setMoeda(e.target.value as Currency)} className={inp}><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
            </Field>
            <Field label="Vencimento"><input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={inp} /></Field>
            <Field label="Título (opcional)"><input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} placeholder="Casamento Ana & João" /></Field>
          </div>

          {/* Variáveis */}
          {tokens.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-soft">Variáveis do contrato</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {tokens.map((t) => (
                  <label key={t} className="block">
                    <span className="mb-1 block text-xs font-medium text-ink-muted">{LABEL_BY_TOKEN[t] || t}</span>
                    <input value={vars[t] ?? ''} onChange={(e) => setVars((v) => ({ ...v, [t]: e.target.value }))} className={inp} placeholder={`{{${t}}}`} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Cláusulas */}
          {(templateData.clausulas?.length ?? 0) > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold text-ink-soft">Cláusulas ({clausulasSel.length}/{templateData.clausulas.length})</div>
              <div className="flex flex-wrap gap-1.5">
                {templateData.clausulas.map((c) => {
                  const on = clausulaOn[c.chave] !== false;
                  return (
                    <button key={c.chave} onClick={() => setClausulaOn((m) => ({ ...m, [c.chave]: !on }))} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? 'border-brand/30 bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-muted'}`}>
                      <span className={`flex h-3.5 w-3.5 items-center justify-center rounded-full ${on ? 'bg-brand text-white' : 'border border-black/20'}`}>{on && <Icon name="check" size={9} sw={3} />}</span>
                      {c.titulo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Signatários */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-ink-soft">Signatários ({signatarios.length})</span>
              <button onClick={addTestemunha} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold text-ink-muted hover:text-brand"><Icon name="plus" size={12} /> Testemunha</button>
            </div>
            <div className="space-y-2">
              {signatarios.map((s, i) => (
                <div key={i} className="rounded-xl border border-black/[0.08] bg-white p-3">
                  <div className="mb-2 flex items-center gap-2">
                    <select value={s.papel} onChange={(e) => updateSign(i, { papel: e.target.value as Papel })} className="rounded-lg border border-black/10 bg-white px-2 py-1.5 text-xs font-semibold focus:border-brand focus:outline-none">
                      {(Object.keys(PAPEL_META) as Papel[]).map((p) => <option key={p} value={p}>{PAPEL_META[p].label}</option>)}
                    </select>
                    <label className="flex items-center gap-1.5 text-xs text-ink-muted"><input type="checkbox" checked={s.obrigatorio} onChange={(e) => updateSign(i, { obrigatorio: e.target.checked })} className="h-3.5 w-3.5 rounded border-black/20 text-brand focus:ring-brand/30" /> obrigatório</label>
                    {signatarios.length > 1 && <button onClick={() => removeSign(i)} title="Remover" className="ml-auto rounded p-1 text-ink-muted hover:text-red-600"><Icon name="trash" size={13} /></button>}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <input value={s.signatario_nome} onChange={(e) => updateSign(i, { signatario_nome: e.target.value })} className={inp} placeholder="Nome completo" />
                    <input value={s.signatario_doc} onChange={(e) => updateSign(i, { signatario_doc: e.target.value })} className={inp} placeholder="CPF/CNPJ" />
                    <input value={s.email} onChange={(e) => updateSign(i, { email: e.target.value })} className={inp} placeholder="E-mail (para enviar o link)" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Field label="Observações internas (não saem no contrato)"><textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={2} className={inp} /></Field>
        </div>
      )}
    </ModalShell>
  );
}

function SegBtn({ active, onClick, disabled, children }: { active: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={disabled} className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition disabled:opacity-40 ${active ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 bg-white text-ink-muted hover:bg-black/[0.02]'}`}>{children}</button>;
}

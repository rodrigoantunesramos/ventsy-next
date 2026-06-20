'use client';

// Construtor de proposta — o coração do módulo. Monta o orçamento puxando preço
// da MESMA engine (lib/pricing.ts) que a Precificação/Simulador, com itens
// editáveis, desconto, plano de pagamento (entrada + parcelas), validade,
// observações/cláusulas e IA (Pro+). Pré-visualização ao vivo (PropostaView,
// idêntica ao PDF/link público). Persiste via supabase; cria o lead se novo.
// Sem "R$" hardcoded — moeda da proposta vinda da tabela de preço escolhida.

import { useMemo, useState } from 'react';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import type { TablesInsert } from '@/types/supabase';
import { useToast } from '@/components/Toast';
import { formatMoney, getFormatPrefs, type Currency } from '@/lib/format';
import { calcularPreco, type PrecoRegra, type PrecoTabela, type Taxa } from '@/lib/pricing';
import { TIPOS_EVENTO } from '../../precificacao/_lib';
import type { Pacote } from '../../precificacao/_lib';
import {
  CLAUSULAS_PADRAO, METODOS_PAGAMENTO, addDays, breakdownToItens, calcSubtotal, calcTotal,
  clienteDoEvento, gerarParcelas, inp, itemTotal, newId, somaParcelas, ymd,
  type Empresa, type Evento, type Parcela, type Proposta, type PropostaItem, type Propriedade,
} from '../_lib';
import { Field, Icon, MoneyInput, ModalShell, PrimaryBtn, SecondaryBtn, IconBtn } from './ui';
import { PropostaView, type PropostaViewData } from './PropostaView';
import { AiPanel } from './AiPanel';

type Props = {
  userId: string;
  plano: string;
  editando: Proposta | null;
  eventos: Evento[];
  propriedades: Propriedade[];
  tabelas: PrecoTabela[];
  regras: PrecoRegra[];
  taxas: Taxa[];
  pacotes: Pacote[];
  empresa: Empresa | null;
  onClose: () => void;
  onSaved: (acao: 'rascunho' | 'enviar') => void;
};

export function Construtor(props: Props) {
  const { userId, plano, editando, eventos, propriedades, tabelas, regras, taxas, pacotes, empresa } = props;
  const toast = useToast();
  const hoje = ymd(new Date());

  // ── Cliente / evento ──
  const [eventoId, setEventoId] = useState<string>(editando?.evento_id ?? '');
  const [novo, setNovo] = useState({ nome: '', evento: '', tipo: '', data: '', email: '', prop: '' });

  // ── Documento ──
  const [titulo, setTitulo] = useState(editando?.titulo ?? 'Proposta comercial');
  const [moeda, setMoeda] = useState<Currency>(editando?.moeda ?? getFormatPrefs().currency);
  const [itens, setItens] = useState<PropostaItem[]>(editando?.itens ?? []);
  const [desconto, setDesconto] = useState(editando?.desconto_num ? String(editando.desconto_num) : '');
  const [validade, setValidade] = useState(editando?.validade ?? addDays(hoje, 15));
  const [metodo, setMetodo] = useState(editando?.condicoes_pagamento?.metodo ?? 'Pix');
  const [parcelas, setParcelas] = useState<Parcela[]>(editando?.condicoes_pagamento?.parcelas ?? []);
  const [observacoes, setObservacoes] = useState(editando?.observacoes ?? '');
  const [condicoes, setCondicoes] = useState(editando?.condicoes ?? '');
  const [saving, setSaving] = useState<null | 'rascunho' | 'enviar'>(null);

  const eventoSel = useMemo(() => eventos.find((e) => e.id === eventoId) ?? null, [eventos, eventoId]);

  const subtotal = useMemo(() => calcSubtotal(itens), [itens]);
  const total = useMemo(() => calcTotal(subtotal, Number(desconto) || 0), [subtotal, desconto]);

  // Evento "virtual" para a pré-visualização (existente ou o novo em digitação).
  const eventoPreview: Evento | null = eventoSel ?? (novo.nome || novo.evento
    ? { id: 'novo', nome_evento: novo.evento || null, quem_contratou: novo.nome || null, documento: null, email: novo.email || null, telefones: null, tipo_evento: novo.tipo || null, status: null, data_inicio: novo.data || null, data_fim: null, qtd_adultos: null, qtd_criancas: null, valor_total_num: null, propriedade_id: novo.prop ? Number(novo.prop) : null, cliente_id: null }
    : null);

  const propriedadeId = eventoSel?.propriedade_id ?? (novo.prop ? Number(novo.prop) : null) ?? null;
  const propriedadeNome = propriedades.find((p) => p.id === propriedadeId)?.nome ?? null;

  const viewData: PropostaViewData = {
    numero: editando?.numero ?? 0,
    titulo, moeda, itens, subtotal_num: subtotal, desconto_num: Number(desconto) || 0, total_num: total,
    validade, condicoes_pagamento: { metodo, parcelas }, observacoes, condicoes, criado_em: editando?.criado_em ?? hoje,
  };

  // ── Itens ──
  const addItens = (novos: PropostaItem[], novaMoeda?: Currency) => {
    if (novaMoeda) setMoeda(novaMoeda);
    setItens((a) => [...a, ...novos]);
  };
  const updItem = (id: string, patch: Partial<PropostaItem>) =>
    setItens((a) => a.map((it) => {
      if (it.id !== id) return it;
      const next = { ...it, ...patch };
      next.total = itemTotal(next.qtd, next.valor_unit);
      return next;
    }));
  const delItem = (id: string) => setItens((a) => a.filter((it) => it.id !== id));

  // ── Pré-fill ao escolher evento existente ──
  function escolherEvento(id: string) {
    setEventoId(id);
    const ev = eventos.find((e) => e.id === id);
    if (ev && (!titulo || titulo === 'Proposta comercial')) {
      setTitulo(`Proposta — ${ev.nome_evento || ev.tipo_evento || clienteDoEvento(ev)}`);
    }
  }

  // ── Pagamento ──
  function autoParcelar(entradaPct: number, n: number) {
    if (total <= 0) { toast.error('Adicione itens ao orçamento primeiro.'); return; }
    setParcelas(gerarParcelas(total, entradaPct, n, validade > hoje ? validade : addDays(hoje, 7)));
  }

  // ── Validação + payload ──
  async function salvar(acao: 'rascunho' | 'enviar') {
    if (itens.length === 0) { toast.error('Adicione ao menos um item ao orçamento.'); return; }
    if (!eventoId && !novo.nome.trim()) { toast.error('Escolha um cliente/evento ou crie um novo.'); return; }
    setSaving(acao);

    // Cria o lead/evento se for novo.
    let evId = eventoId || null;
    let cliId = eventoSel?.cliente_id ?? null;
    if (!evId) {
      const { data: lead, error: e1 } = await sb.from('clientes_eventos').insert({
        usuario_id: userId,
        quem_contratou: novo.nome.trim(),
        nome_evento: novo.evento.trim() || null,
        tipo_evento: novo.tipo || null,
        email: novo.email.trim() || null,
        data_inicio: novo.data || null,
        propriedade_id: novo.prop ? Number(novo.prop) : null,
        status: 'negociacao',
      } as TablesInsert<'clientes_eventos'>).select('id,cliente_id').single();
      if (e1 || !lead) { setSaving(null); toast.error('Não foi possível criar o cliente/evento.'); return; }
      evId = lead.id;
      cliId = lead.cliente_id ?? null;
    }

    const payload = {
      usuario_id: userId,
      cliente_id: cliId,
      evento_id: evId,
      propriedade_id: propriedadeId,
      titulo: titulo.trim() || 'Proposta comercial',
      itens,
      subtotal_num: subtotal,
      desconto_num: Number(desconto) || 0,
      total_num: total,
      moeda,
      validade: validade || null,
      condicoes_pagamento: { metodo, parcelas },
      observacoes: observacoes.trim() || null,
      condicoes: condicoes.trim() || null,
      ...(acao === 'enviar' ? { status: 'enviada', enviada_em: new Date().toISOString() } : {}),
    };

    const { error } = editando
      ? await sb.from('propostas').update(payload).eq('id', editando.id)
      : await sb.from('propostas').insert(payload);
    setSaving(null);
    if (error) { toast.error('Não foi possível salvar a proposta.'); return; }
    props.onSaved(acao);
  }

  return (
    <ModalShell
      title={editando ? `Editar proposta ${editando.numero ? '· Nº ' + String(editando.numero).padStart(4, '0') : ''}` : 'Nova proposta'}
      subtitle="Monte o orçamento, defina pagamento e envie por link/PDF."
      icon={<Icon name="fileText" size={18} />}
      onClose={props.onClose}
      wide="xl"
      footer={<>
        <PrimaryBtn onClick={() => salvar('enviar')} disabled={!!saving}>
          <Icon name="send" size={15} /> {saving === 'enviar' ? 'Salvando…' : 'Salvar e gerar link'}
        </PrimaryBtn>
        <SecondaryBtn onClick={() => salvar('rascunho')} disabled={!!saving}>
          {saving === 'rascunho' ? 'Salvando…' : 'Salvar rascunho'}
        </SecondaryBtn>
        <button onClick={props.onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px]">
        {/* ── Form ── */}
        <div className="space-y-5">
          {/* Cliente / evento */}
          <Secao titulo="Cliente & evento" icon="user">
            <Field label="Vincular a um lead/evento existente">
              <select value={eventoId} onChange={(e) => escolherEvento(e.target.value)} className={inp}>
                <option value="">— Novo cliente/evento —</option>
                {eventos.map((e) => (
                  <option key={e.id} value={e.id}>
                    {clienteDoEvento(e)}{e.nome_evento ? ` · ${e.nome_evento}` : ''}{e.data_inicio ? ` · ${e.data_inicio}` : ''}
                  </option>
                ))}
              </select>
            </Field>
            {!eventoId && (
              <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-3">
                <Field label="Contratante" className="col-span-2">
                  <input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} className={inp} placeholder="Nome do cliente" />
                </Field>
                <Field label="Nome do evento"><input value={novo.evento} onChange={(e) => setNovo({ ...novo, evento: e.target.value })} className={inp} placeholder="Ex.: Casamento Ana & João" /></Field>
                <Field label="Tipo">
                  <select value={novo.tipo} onChange={(e) => setNovo({ ...novo, tipo: e.target.value })} className={inp}>
                    <option value="">—</option>
                    {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Data"><input type="date" value={novo.data} onChange={(e) => setNovo({ ...novo, data: e.target.value })} className={inp} /></Field>
                <Field label="E-mail"><input type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} className={inp} placeholder="cliente@email.com" /></Field>
                {propriedades.length > 0 && (
                  <Field label="Espaço" className="col-span-2">
                    <select value={novo.prop} onChange={(e) => setNovo({ ...novo, prop: e.target.value })} className={inp}>
                      <option value="">—</option>
                      {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            )}
            <Field label="Título da proposta" className="mt-3">
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inp} placeholder="Proposta comercial" />
            </Field>
          </Secao>

          {/* Preço da engine */}
          <Secao titulo="Adicionar do catálogo de preços" icon="tag">
            <PrecoPicker
              tabelas={tabelas} regras={regras} taxas={taxas} pacotes={pacotes}
              evento={eventoSel} defaultData={eventoSel?.data_inicio || novo.data || hoje}
              onAddBreakdown={addItens} onAddPacote={(it) => addItens([it])}
            />
          </Secao>

          {/* Itens */}
          <Secao titulo="Itens do orçamento" icon="receipt">
            <ItensEditor itens={itens} moeda={moeda} onUpdate={updItem} onDelete={delItem} onAddManual={() => addItens([{ id: newId(), tipo: 'manual', descricao: '', qtd: 1, valor_unit: 0, total: 0 }])} />
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
              <span className="text-sm text-ink-muted">Subtotal</span>
              <span className="text-sm font-semibold tabular-nums">{formatMoney(subtotal, { currency: moeda })}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-sm text-ink-muted">Desconto</span>
              <div className="w-36"><MoneyInput value={desconto} onChange={setDesconto} moeda={moeda} small placeholder="0,00" /></div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 border-t border-black/[0.06] pt-3">
              <span className="text-base font-bold text-ink">Total</span>
              <span className="font-display text-lg font-bold tabular-nums text-brand">{formatMoney(total, { currency: moeda })}</span>
            </div>
          </Secao>

          {/* Pagamento */}
          <Secao titulo="Condições de pagamento" icon="coins">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Método">
                <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={inp}>
                  {METODOS_PAGAMENTO.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Gerar plano">
                <div className="flex gap-1.5">
                  <button onClick={() => autoParcelar(0, 1)} className="flex-1 rounded-lg border border-black/10 px-2 py-2 text-xs font-semibold hover:border-brand/30 hover:text-brand">À vista</button>
                  <button onClick={() => autoParcelar(30, 2)} className="flex-1 rounded-lg border border-black/10 px-2 py-2 text-xs font-semibold hover:border-brand/30 hover:text-brand">30%+2x</button>
                  <button onClick={() => autoParcelar(50, 3)} className="flex-1 rounded-lg border border-black/10 px-2 py-2 text-xs font-semibold hover:border-brand/30 hover:text-brand">50%+3x</button>
                </div>
              </Field>
            </div>
            <PagamentoEditor parcelas={parcelas} moeda={moeda} total={total} onChange={setParcelas} />
          </Secao>

          {/* Validade + textos */}
          <Secao titulo="Validade, observações & cláusulas" icon="calendar">
            <Field label="Válida até">
              <input type="date" value={validade} min={hoje} onChange={(e) => setValidade(e.target.value)} className={inp} />
            </Field>
            <Field label="Observações" className="mt-3">
              <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} className={inp} placeholder="Mensagem ao cliente, escopo, inclusões…" />
            </Field>
            <Field label="Condições gerais / cláusulas" className="mt-3"
              hint="Texto que vai ao rodapé do documento (multa, caução, cancelamento…).">
              <textarea value={condicoes} onChange={(e) => setCondicoes(e.target.value)} rows={4} className={inp} placeholder="Cláusulas e condições…" />
            </Field>
            <button onClick={() => setCondicoes((c) => (c?.trim() ? c : CLAUSULAS_PADRAO))} className="mt-2 text-xs font-semibold text-brand hover:underline">+ Usar cláusulas padrão</button>

            <AiPanel
              plano={plano}
              authHeaders={authHeaders}
              contexto={{ evento: eventoPreview, itens, total, moeda }}
              onTexto={(t) => setObservacoes((o) => (o ? o + '\n\n' : '') + t)}
            />
          </Secao>
        </div>

        {/* ── Pré-visualização ── */}
        <div className="lg:sticky lg:top-2 lg:self-start">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
            <Icon name="eye" size={13} /> Pré-visualização
          </div>
          <div className="max-h-[70vh] overflow-y-auto rounded-2xl ring-1 ring-black/[0.06]">
            <PropostaView data={viewData} empresa={empresa} evento={eventoPreview} propriedadeNome={propriedadeNome} compact />
          </div>
        </div>
      </div>
    </ModalShell>
  );
}

// ── Seção rotulada ───────────────────────────────────────────────────────────
function Secao({ titulo, icon, children }: { titulo: string; icon: Parameters<typeof Icon>[0]['name']; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-50 text-brand"><Icon name={icon} size={13} /></span>
        {titulo}
      </h3>
      {children}
    </section>
  );
}

// ── Picker de preço (usa a engine pura) ──────────────────────────────────────
function PrecoPicker({
  tabelas, regras, taxas, pacotes, evento, defaultData, onAddBreakdown, onAddPacote,
}: {
  tabelas: PrecoTabela[]; regras: PrecoRegra[]; taxas: Taxa[]; pacotes: Pacote[];
  evento: Evento | null; defaultData: string;
  onAddBreakdown: (itens: PropostaItem[], moeda: Currency) => void;
  onAddPacote: (it: PropostaItem) => void;
}) {
  const toast = useToast();
  const ativas = useMemo(() => tabelas.filter((t) => t.ativo), [tabelas]);
  const hoje = ymd(new Date());
  const [tabelaId, setTabelaId] = useState(ativas[0]?.id ?? '');
  const [data, setData] = useState(defaultData || hoje);
  const [dataFim, setDataFim] = useState(evento?.data_fim || '');
  const [convidados, setConvidados] = useState(String((evento?.qtd_adultos || 0) + (evento?.qtd_criancas || 0) || 120));
  const [horas, setHoras] = useState('8');
  const [tipoEvento, setTipoEvento] = useState(evento?.tipo_evento || '');
  const [selTaxas, setSelTaxas] = useState<string[]>([]);

  const tabela = useMemo(() => tabelas.find((t) => t.id === tabelaId) ?? ativas[0], [tabelas, tabelaId, ativas]);
  const regrasDaTabela = useMemo(() => (tabela ? regras.filter((r) => r.tabela_id === tabela.id) : []), [regras, tabela]);
  const taxasAplicaveis = useMemo(
    () => (tabela ? taxas.filter((t) => t.ativo !== false && (t.propriedade_id == null || t.propriedade_id === tabela.propriedade_id)) : []),
    [taxas, tabela],
  );
  const opcionais = taxasAplicaveis.filter((t) => !t.obrigatoria);

  const breakdown = useMemo(() => {
    if (!tabela) return null;
    return calcularPreco({
      tabela, regras: regrasDaTabela, taxas: taxasAplicaveis,
      req: { data, dataFim: dataFim || undefined, convidados: Number(convidados) || 0, horas: Number(horas) || 0, tipoEvento: tipoEvento || undefined, hoje, taxasSelecionadas: selTaxas },
    });
  }, [tabela, regrasDaTabela, taxasAplicaveis, data, dataFim, convidados, horas, tipoEvento, hoje, selTaxas]);

  if (ativas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-black/10 bg-black/[0.01] p-4 text-center text-sm text-ink-muted">
        Nenhuma tabela de preço ativa. Crie em <a href="/painel/precificacao" className="font-semibold text-brand hover:underline">Precificação</a> ou adicione itens manualmente abaixo.
      </div>
    );
  }

  const moeda = tabela?.moeda ?? 'BRL';
  const toggleTaxa = (id: string) => setSelTaxas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tabela / espaço" className="col-span-2">
          <select value={tabelaId} onChange={(e) => { setTabelaId(e.target.value); setSelTaxas([]); }} className={inp}>
            {ativas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        </Field>
        <Field label="Data"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} /></Field>
        <Field label={tabela?.base === 'diaria' ? 'Data fim (opc.)' : 'Tipo de evento'}>
          {tabela?.base === 'diaria'
            ? <input type="date" value={dataFim} min={data} onChange={(e) => setDataFim(e.target.value)} className={inp} />
            : <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} className={inp}><option value="">—</option>{TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
        </Field>
        <Field label="Convidados"><input type="number" min={0} value={convidados} onChange={(e) => setConvidados(e.target.value)} className={inp} /></Field>
        <Field label="Duração (horas)"><input type="number" min={0} value={horas} onChange={(e) => setHoras(e.target.value)} className={inp} /></Field>
        {tabela?.base === 'diaria' && (
          <Field label="Tipo de evento" className="col-span-2">
            <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} className={inp}><option value="">—</option>{TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}</select>
          </Field>
        )}
      </div>

      {opcionais.length > 0 && (
        <div className="rounded-lg bg-black/[0.02] p-2.5">
          <span className="mb-1.5 block text-xs font-semibold text-ink-soft">Adicionais</span>
          <div className="flex flex-wrap gap-1.5">
            {opcionais.map((t) => (
              <button key={t.id} onClick={() => toggleTaxa(t.id)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${selTaxas.includes(t.id) ? 'bg-brand text-white' : 'bg-white text-ink-muted ring-1 ring-black/10 hover:ring-brand/30'}`}>
                {t.nome}
              </button>
            ))}
          </div>
        </div>
      )}

      {breakdown && (
        <div className="flex items-center justify-between rounded-xl bg-brand-50/50 px-3 py-2.5">
          <div className="text-xs text-ink-muted">
            Estimado · <span className="font-bold text-ink">{formatMoney(breakdown.total, { currency: moeda })}</span>
            {breakdown.ajustes.length > 0 && <span className="ml-1">({breakdown.ajustes.length} ajuste{breakdown.ajustes.length > 1 ? 's' : ''})</span>}
          </div>
          <button
            onClick={() => { if (tabela) { onAddBreakdown(breakdownToItens(breakdown, tabela.nome), tabela.moeda); toast.success('Itens adicionados ao orçamento.'); } }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-600">
            <Icon name="plus" size={13} /> Adicionar
          </button>
        </div>
      )}

      {pacotes.filter((p) => p.ativo).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-ink-muted">Pacotes:</span>
          {pacotes.filter((p) => p.ativo).map((p) => (
            <button key={p.id}
              onClick={() => onAddPacote({ id: newId(), tipo: 'pacote', descricao: p.nome, qtd: 1, valor_unit: p.valor_num, total: p.valor_num })}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-ink-muted ring-1 ring-black/10 hover:ring-brand/30 hover:text-brand">
              + {p.nome} · {formatMoney(p.valor_num, { currency: moeda })}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Editor de itens ──────────────────────────────────────────────────────────
function ItensEditor({
  itens, moeda, onUpdate, onDelete, onAddManual,
}: {
  itens: PropostaItem[]; moeda: Currency;
  onUpdate: (id: string, patch: Partial<PropostaItem>) => void; onDelete: (id: string) => void; onAddManual: () => void;
}) {
  return (
    <div className="space-y-2">
      {itens.length === 0 && (
        <div className="rounded-xl border border-dashed border-black/10 py-6 text-center text-sm text-ink-muted">
          Nenhum item ainda. Adicione do catálogo acima ou um item avulso.
        </div>
      )}
      {itens.map((it) => (
        <div key={it.id} className="rounded-xl border border-black/[0.06] bg-white p-2.5">
          <div className="flex items-start gap-2">
            <input
              value={it.descricao} onChange={(e) => onUpdate(it.id, { descricao: e.target.value })}
              placeholder="Descrição do item" className={`${inp} px-2.5 py-1.5 text-sm`}
            />
            <IconBtn label="Remover item" danger onClick={() => onDelete(it.id)}><Icon name="trash" size={14} /></IconBtn>
          </div>
          <div className="mt-2 grid grid-cols-[64px_1fr_1fr] items-center gap-2">
            <label className="text-[0.65rem] text-ink-muted">Qtd
              <input type="number" min={0} step="1" value={it.qtd} onChange={(e) => onUpdate(it.id, { qtd: Number(e.target.value) || 0 })} className={`${inp} px-2 py-1.5 text-sm`} />
            </label>
            <label className="text-[0.65rem] text-ink-muted">Valor unit.
              <MoneyInput value={String(it.valor_unit)} onChange={(v) => onUpdate(it.id, { valor_unit: Number(v) || 0 })} moeda={moeda} small />
            </label>
            <div className="text-right text-[0.65rem] text-ink-muted">Total
              <div className="pt-1.5 text-sm font-bold tabular-nums text-ink">{formatMoney(it.total, { currency: moeda })}</div>
            </div>
          </div>
        </div>
      ))}
      <button onClick={onAddManual} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline">
        <Icon name="plus" size={14} /> Item avulso
      </button>
    </div>
  );
}

// ── Editor de parcelas ───────────────────────────────────────────────────────
function PagamentoEditor({
  parcelas, moeda, total, onChange,
}: { parcelas: Parcela[]; moeda: Currency; total: number; onChange: (p: Parcela[]) => void }) {
  const upd = (i: number, patch: Partial<Parcela>) => onChange(parcelas.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  const del = (i: number) => onChange(parcelas.filter((_, idx) => idx !== i));
  const add = () => onChange([...parcelas, { descricao: `Parcela ${parcelas.length + 1}`, valor: 0, vencimento: null }]);
  const soma = somaParcelas(parcelas);
  const dif = Math.round((soma - total) * 100) / 100;
  return (
    <div className="mt-3 space-y-2">
      {parcelas.map((p, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_110px_auto] items-center gap-2">
          <input value={p.descricao} onChange={(e) => upd(i, { descricao: e.target.value })} className={`${inp} px-2.5 py-1.5 text-sm`} placeholder="Descrição" />
          <input type="date" value={p.vencimento || ''} onChange={(e) => upd(i, { vencimento: e.target.value || null })} className={`${inp} px-2 py-1.5 text-sm`} />
          <MoneyInput value={String(p.valor)} onChange={(v) => upd(i, { valor: Number(v) || 0 })} moeda={moeda} small />
          <IconBtn label="Remover parcela" danger onClick={() => del(i)}><Icon name="trash" size={14} /></IconBtn>
        </div>
      ))}
      <div className="flex items-center justify-between pt-1">
        <button onClick={add} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:underline"><Icon name="plus" size={14} /> Parcela</button>
        {parcelas.length > 0 && (
          <span className={`text-xs font-semibold ${Math.abs(dif) < 0.01 ? 'text-emerald-600' : 'text-amber-600'}`}>
            Soma {formatMoney(soma, { currency: moeda })}{Math.abs(dif) >= 0.01 ? ` · ${dif > 0 ? '+' : ''}${formatMoney(dif, { currency: moeda })}` : ' ✓'}
          </span>
        )}
      </div>
    </div>
  );
}

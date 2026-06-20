'use client';

// Contratos & Assinatura digital — /painel/contratos.
// Gera contratos de locação a partir de MODELOS com variáveis ({{cliente.nome}},
// {{valor}}…) e cláusulas, envia para ASSINATURA ELETRÔNICA por link público e
// mantém uma TRILHA DE AUDITORIA (IP/UA/hash/timestamp por signatário).
// PILARES: Modelos (biblioteca por tipo de evento) · Geração (de um lead/evento
//   ou avulso → snapshot imutável) · Assinatura (multi-signatário, certificado)
//   · Gestão (status, vencimento, cancelamento/rescisão com multa).
// Fontes: contratos, contratos_templates, contratos_assinaturas + clientes_eventos,
//   clientes, propriedades, empresa_config (RLS por dono). i18n via lib/format.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  STATUS_META, progressoAssinaturas, templatePadrao,
  type Contrato, type ContratoTemplate, type Assinatura, type ContratoStatus,
} from '@/lib/contracts';
import {
  isMissingTable, gerarPdfContrato, rotuloEvento,
  type EventoLite, type ClienteLite, type Propriedade, type EmpresaConfig,
} from './_lib';
import { Icon, type IconName } from './_components/ui';
import { SetupCard } from '@/components/ui/Estados';
import { NovoContratoModal } from './_components/NovoContratoModal';
import { TemplateModal } from './_components/TemplateModal';

type Tab = 'contratos' | 'modelos';
const EVENTO_COLS = 'id,cliente_id,nome_evento,quem_contratou,tipo_evento,status,data_inicio,data_fim,horario_inicio,horario_fim,qtd_adultos,qtd_criancas,documento,email,telefones,forma_pagamento,valor_total_num,propriedade_id';

export default function ContratosPage() {
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [templates, setTemplates] = useState<ContratoTemplate[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [eventos, setEventos] = useState<EventoLite[]>([]);
  const [clientes, setClientes] = useState<ClienteLite[]>([]);
  const [propriedades, setPropriedades] = useState<Propriedade[]>([]);
  const [empresa, setEmpresa] = useState<EmpresaConfig>(null);

  const [tab, setTab] = useState<Tab>('contratos');
  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState<ContratoStatus | 'all'>('all');

  const [novoOpen, setNovoOpen] = useState(false);
  const [templateModal, setTemplateModal] = useState<{ editando: ContratoTemplate | null } | null>(null);
  const [confirmDel, setConfirmDel] = useState<{ kind: 'contrato' | 'template'; id: string } | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);

  const carregar = useCallback(async (uid: string) => {
    const [cRes, tRes, aRes, evRes, cliRes, propRes, empRes] = await Promise.all([
      sb.from('contratos').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('contratos_templates').select('*').eq('usuario_id', uid).order('criado_em', { ascending: false }),
      sb.from('contratos_assinaturas').select('*').eq('usuario_id', uid),
      sb.from('clientes_eventos').select(EVENTO_COLS).eq('usuario_id', uid).order('data_inicio', { ascending: false }),
      sb.from('clientes').select('id,nome,doc,email,telefone,whatsapp,endereco,cidade,estado').eq('usuario_id', uid),
      sb.from('propriedades').select('id,nome,rua,numero,bairro,cidade,estado').eq('usuario_id', uid).order('id'),
      sb.from('empresa_config').select('razao_social,fantasia,cnpj,endereco,contatos').eq('usuario_id', uid).maybeSingle(),
    ]);

    if (isMissingTable(cRes.error) || isMissingTable(tRes.error)) {
      setNeedsSetup(true); setContratos([]); setTemplates([]); setAssinaturas([]);
    } else {
      setNeedsSetup(false);
      setContratos(((cRes.data || []) as Contrato[]).map((c) => ({ ...c, valor_num: Number(c.valor_num) || 0, variaveis: c.variaveis || {} })));
      setTemplates(((tRes.data || []) as ContratoTemplate[]).map((t) => ({ ...t, clausulas: Array.isArray(t.clausulas) ? t.clausulas : [] })));
      setAssinaturas((aRes.data || []) as Assinatura[]);
    }
    setEventos(((evRes.data || []) as EventoLite[]).map((e) => ({ ...e, valor_total_num: e.valor_total_num != null ? Number(e.valor_total_num) : null })));
    setClientes((cliRes.data || []) as ClienteLite[]);
    setPropriedades((propRes.data || []) as Propriedade[]);
    setEmpresa((empRes.data || null) as EmpresaConfig);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      await carregar(session.user.id);
      setLoading(false);
    })();
  }, [carregar]);

  const refetch = useCallback(() => { if (userId) carregar(userId); }, [userId, carregar]);

  const contratadaNome = empresa?.razao_social || empresa?.fantasia || 'Contratada';
  const assinByContrato = useMemo(() => {
    const m = new Map<string, Assinatura[]>();
    for (const a of assinaturas) { const arr = m.get(a.contrato_id) || []; arr.push(a); m.set(a.contrato_id, arr); }
    return m;
  }, [assinaturas]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const ativos = contratos.filter((c) => c.status === 'enviado' || c.status === 'assinado');
    return {
      total: contratos.length,
      aguardando: contratos.filter((c) => c.status === 'enviado').length,
      assinados: contratos.filter((c) => c.status === 'assinado').length,
      valorSob: ativos.reduce((s, c) => s + (c.valor_num || 0), 0),
    };
  }, [contratos]);

  // ── Lista filtrada ──
  const contratosView = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return contratos.filter((c) => {
      if (fStatus !== 'all' && c.status !== fStatus) return false;
      if (!q) return true;
      const cli = c.variaveis?.['cliente.nome'] || '';
      return [c.numero, c.titulo || '', cli].some((s) => s.toLowerCase().includes(q));
    });
  }, [contratos, busca, fStatus]);

  // ── Ações ──
  async function enviar(c: Contrato, lembrete = false) {
    setEnviando(c.id);
    try {
      const res = await fetch('/api/contratos/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ contrato_id: c.id, lembrete }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || 'Falha ao enviar.'); return; }
      if (j.email_configurado && j.emails_enviados > 0) toast.success(`Enviado: ${j.emails_enviados} e-mail(s) de assinatura.`);
      else { try { await navigator.clipboard.writeText(j.link); } catch { /* sem clipboard */ } toast.success('Link de assinatura copiado. Compartilhe com o signatário.'); }
      refetch();
    } finally { setEnviando(null); }
  }

  async function copiarLink(c: Contrato) {
    if (!c.link_token) { toast.error('Envie o contrato primeiro para gerar o link.'); return; }
    try { await navigator.clipboard.writeText(`${window.location.origin}/contrato/${c.link_token}`); toast.success('Link copiado.'); }
    catch { toast.error('Não foi possível copiar.'); }
  }

  async function baixarPdf(c: Contrato) {
    try { await gerarPdfContrato(c, assinByContrato.get(c.id) || [], contratadaNome); }
    catch { toast.error('Falha ao gerar o PDF.'); }
  }

  async function remover(kind: 'contrato' | 'template', id: string) {
    if (!confirmDel || confirmDel.kind !== kind || confirmDel.id !== id) {
      setConfirmDel({ kind, id });
      setTimeout(() => setConfirmDel((c) => (c?.id === id ? null : c)), 3000);
      return;
    }
    const table = kind === 'contrato' ? 'contratos' : 'contratos_templates';
    const { error } = await sb.from(table).delete().eq('id', id);
    setConfirmDel(null);
    if (error) { toast.error('Não foi possível remover.'); return; }
    if (kind === 'contrato') setContratos((a) => a.filter((x) => x.id !== id));
    else setTemplates((a) => a.filter((x) => x.id !== id));
    toast.success('Removido.');
  }

  async function seedTemplate() {
    if (!userId) return;
    const base = templatePadrao();
    const { error } = await sb.from('contratos_templates').insert({ usuario_id: userId, nome: base.nome, tipo_evento: null, corpo: base.corpo, clausulas: base.clausulas, ativo: true });
    if (error) { toast.error('Não foi possível criar o modelo.'); return; }
    toast.success('Modelo padrão criado. Personalize como quiser.');
    refetch();
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-[72px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-[96px] animate-pulse rounded-2xl bg-black/[0.05]" />)}</div>
        <div className="h-[52px] animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="h-[240px] animate-pulse rounded-2xl bg-black/[0.05]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Contratos</h1>
          <p className="mt-1 text-sm text-ink-muted">Gere a partir de um <Link href="/painel/leads" className="font-semibold text-brand underline">evento</Link>, envie para assinatura eletrônica e mantenha a trilha de auditoria.</p>
        </div>
        <div className="flex items-center gap-2">
          {tab === 'contratos'
            ? <button onClick={() => setNovoOpen(true)} disabled={needsSetup} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><Icon name="plus" size={14} /> Novo contrato</button>
            : <button onClick={() => setTemplateModal({ editando: null })} disabled={needsSetup} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><Icon name="plus" size={14} /> Novo modelo</button>}
        </div>
      </div>

      {needsSetup && <SetupCard sql="contratos.sql">As tabelas de contratos ainda não foram criadas.</SetupCard>}

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Contratos" value={String(kpis.total)} icon={<Icon name="doc" size={15} />} tone="brand" />
        <Kpi label="Aguardando assinatura" value={String(kpis.aguardando)} icon={<Icon name="clock" size={15} />} tone="ambar" />
        <Kpi label="Assinados" value={String(kpis.assinados)} icon={<Icon name="check" size={15} />} tone="verde" />
        <Kpi label="Valor sob contrato" value={formatMoneyShort(kpis.valorSob)} icon={<Icon name="wallet" size={15} />} tone="azul" />
      </div>

      {/* Tabs */}
      <div className="mt-5 flex gap-1 rounded-2xl bg-white p-1.5 shadow-card">
        {([['contratos', 'doc', 'Contratos', kpis.total], ['modelos', 'layers', 'Modelos', templates.length]] as [Tab, IconName, string, number][]).map(([v, icon, label, count]) => (
          <button key={v} onClick={() => setTab(v)} className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${tab === v ? 'bg-brand text-white shadow-sm' : 'text-ink-muted hover:bg-black/[0.03] hover:text-ink'}`}>
            <Icon name={icon} size={15} /> {label}
            {count > 0 && <span className={`rounded-full px-1.5 py-0.5 text-[0.6rem] font-bold ${tab === v ? 'bg-white/25' : 'bg-black/[0.06] text-ink-muted'}`}>{count}</span>}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === 'contratos' ? (
          <ContratosTab
            contratos={contratosView} total={contratos.length} assinByContrato={assinByContrato}
            busca={busca} setBusca={setBusca} fStatus={fStatus} setFStatus={setFStatus}
            enviando={enviando} confirmDel={confirmDel}
            onNew={() => setNovoOpen(true)}
            onOpen={(id) => router.push(`/painel/contratos/${id}`)}
            onEnviar={enviar} onCopiar={copiarLink} onPdf={baixarPdf} onDelete={(id) => remover('contrato', id)}
          />
        ) : (
          <ModelosTab
            templates={templates} confirmDel={confirmDel}
            onNew={() => setTemplateModal({ editando: null })} onSeed={seedTemplate}
            onEdit={(t) => setTemplateModal({ editando: t })} onDelete={(id) => remover('template', id)}
          />
        )}
      </div>

      {/* Modais */}
      {userId && novoOpen && (
        <NovoContratoModal
          userId={userId} templates={templates} eventos={eventos} clientes={clientes}
          propriedades={propriedades} empresa={empresa} numerosExistentes={contratos.map((c) => c.numero)}
          onClose={() => setNovoOpen(false)}
          onCreated={(id) => { setNovoOpen(false); refetch(); router.push(`/painel/contratos/${id}`); }}
        />
      )}
      {userId && templateModal && (
        <TemplateModal userId={userId} editando={templateModal.editando} onClose={() => setTemplateModal(null)} onSaved={() => { setTemplateModal(null); refetch(); }} />
      )}
    </div>
  );
}

// ── Tab: Contratos ────────────────────────────────────────────────────────────
function ContratosTab({
  contratos, total, assinByContrato, busca, setBusca, fStatus, setFStatus, enviando, confirmDel,
  onNew, onOpen, onEnviar, onCopiar, onPdf, onDelete,
}: {
  contratos: Contrato[]; total: number; assinByContrato: Map<string, Assinatura[]>;
  busca: string; setBusca: (v: string) => void; fStatus: ContratoStatus | 'all'; setFStatus: (v: ContratoStatus | 'all') => void;
  enviando: string | null; confirmDel: { kind: string; id: string } | null;
  onNew: () => void; onOpen: (id: string) => void; onEnviar: (c: Contrato) => void; onCopiar: (c: Contrato) => void; onPdf: (c: Contrato) => void; onDelete: (id: string) => void;
}) {
  if (total === 0) return <EmptyState icon="doc" title="Nenhum contrato ainda" desc="Gere o primeiro contrato a partir de um evento do funil ou de forma avulsa, escolha o modelo e envie para assinatura." cta="Criar primeiro contrato" onCta={onNew} />;
  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><Icon name="search" size={15} /></span>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número, título ou cliente…" className="w-full rounded-xl border border-black/10 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        </div>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value as ContratoStatus | 'all')} className="rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none">
          <option value="all">Todos os status</option>
          {(Object.keys(STATUS_META) as ContratoStatus[]).map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>

      {contratos.length === 0
        ? <div className="rounded-2xl bg-white py-12 text-center text-sm text-ink-muted shadow-card">Nenhum contrato para o filtro selecionado.</div>
        : (
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            <div className="divide-y divide-black/[0.05]">
              {contratos.map((c) => {
                const assin = assinByContrato.get(c.id) || [];
                const prog = progressoAssinaturas(assin);
                const st = STATUS_META[c.status];
                return (
                  <div key={c.id} className="group flex flex-col gap-3 px-4 py-3 transition hover:bg-black/[0.01] sm:flex-row sm:items-center">
                    <button onClick={() => onOpen(c.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand"><Icon name="doc" size={16} /></span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-bold text-ink">{c.numero}</span>
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide ${st.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>
                        </div>
                        <div className="mt-0.5 truncate text-xs text-ink-muted">{c.variaveis?.['cliente.nome'] || c.titulo || 'Sem cliente'}{c.variaveis?.['evento.tipo'] ? ` · ${c.variaveis['evento.tipo']}` : ''}</div>
                      </div>
                    </button>

                    <div className="flex items-center gap-4 sm:gap-5">
                      <div className="text-right">
                        <div className="text-sm font-bold text-ink">{formatMoney(c.valor_num, { currency: c.moeda })}</div>
                        <div className="text-[0.62rem] text-ink-muted">{c.vencimento ? `vence ${formatDate(c.vencimento)}` : (c.criado_em ? formatDate(c.criado_em) : '')}</div>
                      </div>
                      {assin.length > 0 && (
                        <div className="hidden text-right sm:block" title="Assinaturas">
                          <div className={`text-sm font-bold ${prog.completo ? 'text-emerald-600' : 'text-ink'}`}>{prog.assinadas}/{prog.total}</div>
                          <div className="text-[0.62rem] text-ink-muted">assinaturas</div>
                        </div>
                      )}
                      <div className="flex items-center gap-0.5">
                        {c.status === 'rascunho' && <IconBtn label="Enviar para assinatura" onClick={() => onEnviar(c)} busy={enviando === c.id}><Icon name="send" size={14} /></IconBtn>}
                        {(c.status === 'enviado' || c.status === 'assinado') && <IconBtn label="Copiar link" onClick={() => onCopiar(c)}><Icon name="link" size={14} /></IconBtn>}
                        {c.status === 'enviado' && <IconBtn label="Reenviar / lembrete" onClick={() => onEnviar(c)} busy={enviando === c.id}><Icon name="send" size={14} /></IconBtn>}
                        <IconBtn label="Baixar PDF" onClick={() => onPdf(c)}><Icon name="download" size={14} /></IconBtn>
                        {c.status === 'rascunho' && <DelBtn confirming={confirmDel?.kind === 'contrato' && confirmDel.id === c.id} onClick={() => onDelete(c.id)} />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
    </div>
  );
}

// ── Tab: Modelos ──────────────────────────────────────────────────────────────
function ModelosTab({
  templates, confirmDel, onNew, onSeed, onEdit, onDelete,
}: {
  templates: ContratoTemplate[]; confirmDel: { kind: string; id: string } | null;
  onNew: () => void; onSeed: () => void; onEdit: (t: ContratoTemplate) => void; onDelete: (id: string) => void;
}) {
  if (templates.length === 0) {
    return (
      <div className="rounded-2xl bg-white py-14 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name="layers" size={26} /></div>
        <p className="mb-1 text-sm font-semibold text-ink">Nenhum modelo de contrato</p>
        <p className="mx-auto mb-5 max-w-md px-6 text-xs text-ink-muted">Crie um modelo com variáveis e cláusulas, ou comece pelo modelo padrão de locação e personalize.</p>
        <div className="flex items-center justify-center gap-2">
          <button onClick={onSeed} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]"><Icon name="sparkles" size={14} /> Usar modelo padrão</button>
          <button onClick={onNew} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="plus" size={14} /> Criar do zero</button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {templates.map((t) => (
        <div key={t.id} className={`group flex flex-col rounded-2xl border bg-white p-4 shadow-card transition ${t.ativo ? 'border-black/[0.06]' : 'border-dashed border-black/15 opacity-70'}`}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-sm font-bold text-ink">{t.nome}</h3>
            {t.tipo_evento && <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-brand">{t.tipo_evento}</span>}
          </div>
          <p className="mt-2 line-clamp-3 flex-1 text-xs text-ink-muted">{(t.corpo || '').replace(/[#*]/g, '').slice(0, 160) || 'Modelo sem corpo.'}</p>
          <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2.5">
            <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.62rem] font-semibold text-ink-muted">{t.clausulas.length} cláusula{t.clausulas.length === 1 ? '' : 's'}</span>
            <div className="flex items-center gap-0.5">
              <IconBtn label="Editar" onClick={() => onEdit(t)}><Icon name="edit" size={13} /></IconBtn>
              <DelBtn confirming={confirmDel?.kind === 'template' && confirmDel.id === t.id} onClick={() => onDelete(t.id)} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Kpi({ label, value, icon, tone }: { label: string; value: string; icon: ReactNode; tone: 'brand' | 'azul' | 'ambar' | 'verde' }) {
  const bg = { brand: 'bg-brand-50 text-brand', azul: 'bg-blue-50 text-blue-600', ambar: 'bg-amber-50 text-amber-600', verde: 'bg-emerald-50 text-emerald-600' }[tone];
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs text-ink-muted">{label}</span>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${bg}`}>{icon}</span>
      </div>
      <div className="mt-2 text-2xl font-bold text-ink">{value}</div>
    </div>
  );
}

function IconBtn({ children, label, onClick, busy }: { children: ReactNode; label: string; onClick: () => void; busy?: boolean }) {
  return <button onClick={onClick} disabled={busy} title={label} aria-label={label} className="rounded-lg p-2 text-ink-muted transition hover:bg-black/[0.04] hover:text-brand disabled:opacity-50">{busy ? <span className="block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand/30 border-t-brand" /> : children}</button>;
}
function DelBtn({ confirming, onClick }: { confirming: boolean; onClick: () => void }) {
  return <button onClick={onClick} title={confirming ? 'Confirmar exclusão' : 'Remover'} aria-label="Remover" className={`rounded-lg px-2 py-2 text-xs font-bold transition ${confirming ? 'bg-red-50 text-red-600' : 'text-ink-muted hover:bg-black/[0.04] hover:text-red-600'}`}>{confirming ? 'Confirmar?' : <Icon name="trash" size={13} />}</button>;
}
function EmptyState({ icon, title, desc, cta, onCta }: { icon: IconName; title: string; desc: string; cta: string; onCta: () => void }) {
  return (
    <div className="rounded-2xl bg-white py-14 text-center shadow-card">
      <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name={icon} size={26} /></div>
      <p className="mb-1 text-sm font-semibold text-ink">{title}</p>
      <p className="mx-auto mb-5 max-w-md px-6 text-xs text-ink-muted">{desc}</p>
      <button onClick={onCta} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="plus" size={14} /> {cta}</button>
    </div>
  );
}

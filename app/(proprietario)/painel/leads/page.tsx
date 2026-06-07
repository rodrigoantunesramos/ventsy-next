'use client';

// Leads — /painel/leads (CRM premium).
// Pipeline sobre `clientes_eventos` (por usuario_id). Reúne e supera o módulo legado:
// KPIs com valor de pipeline, funil de conversão, alertas de parcela, visão Kanban
// arrastável + Lista, e a ficha completa de 6 seções num drawer lateral com auto-save.
// Valor monetário usa a coluna numérica `valor_total_num` (migration aditiva) + lib/format.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatMoneyShort, formatDateRange, formatPercent } from '@/lib/format';

// ── Modelo de status ──────────────────────────────────────────────────────
type Grupo = 'negociando' | 'contratados' | 'finalizados' | 'perdidos';
type StatusDef = { v: string; label: string; emoji: string; grupo: Grupo };

const STATUS: StatusDef[] = [
  { v: 'lead', label: 'Lead / Novo', emoji: '🟡', grupo: 'negociando' },
  { v: 'consultada', label: 'Data Consultada', emoji: '🔵', grupo: 'negociando' },
  { v: 'visita', label: 'Visita Agendada', emoji: '🟣', grupo: 'negociando' },
  { v: 'negociacao', label: 'Em Negociação', emoji: '💗', grupo: 'negociando' },
  { v: 'reserva', label: 'Reserva Temp.', emoji: '🟠', grupo: 'negociando' },
  { v: 'contratado', label: 'Contratado', emoji: '✅', grupo: 'contratados' },
  { v: 'briefing', label: 'Briefing', emoji: '📋', grupo: 'contratados' },
  { v: 'pronto', label: 'Pronto p/ Exec.', emoji: '🟢', grupo: 'contratados' },
  { v: 'montagem', label: 'Em Montagem', emoji: '🔨', grupo: 'contratados' },
  { v: 'finalizado', label: 'Finalizado', emoji: '🎊', grupo: 'finalizados' },
  { v: 'pos', label: 'Pós-Evento', emoji: '⭐', grupo: 'finalizados' },
  { v: 'perdido', label: 'Perdido', emoji: '❌', grupo: 'perdidos' },
  { v: 'recontactar', label: 'Recontactar', emoji: '🔄', grupo: 'perdidos' },
];
const STATUS_BY_V: Record<string, StatusDef> = Object.fromEntries(STATUS.map((s) => [s.v, s]));

const GRUPOS: { v: Grupo; label: string; padrao: string; dot: string; ring: string }[] = [
  { v: 'negociando', label: 'Negociando', padrao: 'lead', dot: 'bg-amber-400', ring: 'ring-amber-300' },
  { v: 'contratados', label: 'Contratados', padrao: 'contratado', dot: 'bg-emerald-400', ring: 'ring-emerald-300' },
  { v: 'finalizados', label: 'Finalizados', padrao: 'finalizado', dot: 'bg-blue-400', ring: 'ring-blue-300' },
  { v: 'perdidos', label: 'Perdidos', padrao: 'perdido', dot: 'bg-red-400', ring: 'ring-red-300' },
];
const GRUPO_CLS: Record<Grupo, string> = {
  negociando: 'bg-amber-50 text-amber-700 border-amber-200',
  contratados: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  finalizados: 'bg-blue-50 text-blue-700 border-blue-200',
  perdidos: 'bg-red-50 text-red-700 border-red-200',
};

const TIPOS = ['Casamento', 'Aniversário', 'Corporativo', 'Formatura', 'Batizado', 'Outro'];
const COMO_CONHECEU = ['', 'Instagram', 'Facebook', 'Google', 'Site VENTSY', 'Indicação de amigo', 'Já conhecia', 'Outro'];
const FORMATOS = ['', 'Coquetel', 'Jantar sentado', 'Buffet franco-americano', 'Churrasco', 'Misto'];
const PAGAMENTOS = ['', 'Pix', 'Parcelamento', 'Cartão de crédito', 'Dinheiro', 'Misto'];
const CHECKLIST_ITEMS: [string, string][] = [
  ['contrato', 'Contrato assinado'], ['sinal', 'Sinal / entrada pago'],
  ['visita', 'Visita ao local realizada'], ['briefing', 'Briefing completo e aprovado'],
  ['fornecedores', 'Fornecedores confirmados'], ['ecad', 'ECAD (direitos musicais) tratado'],
  ['layout', 'Layout de mesas definido'], ['confirmacao', 'Confirmação final enviada'],
];

// ── Tipos ─────────────────────────────────────────────────────────────────
type Parcela = { desc?: string; vencimento?: string; valor?: number | string | null };
type Lead = {
  id: string;
  nome_evento: string | null;
  quem_contratou: string | null;
  documento: string | null;
  email: string | null;
  telefones: string[];
  contato_emergencia: string | null;
  como_conheceu: string | null;
  tipo_evento: string | null;
  status: string | null;
  data_inicio: string | null;
  data_fim: string | null;
  horario_inicio: string | null;
  horario_fim: string | null;
  qtd_adultos: number | null;
  qtd_criancas: number | null;
  formato_recepcao: string | null;
  atracoes: string | null;
  horario_montagem: string | null;
  horario_desmontagem: string | null;
  layout_mesas: string | null;
  servicos_casa: string | null;
  fornecedores: string | null;
  necessidades_tecnicas: string | null;
  checkin_materiais: string | null;
  valor_total_num: number | null;
  forma_pagamento: string | null;
  parcelas: Parcela[];
  taxas_extras: string | null;
  restricoes_alimentares: string | null;
  vip_autoridades: string | null;
  observacoes: string | null;
  motivo_descarte: string | null;
  checklist: Record<string, boolean>;
  propriedade_id: number | null;
};
type Prop = { id: number; nome: string | null };
type Saude = 'idle' | 'saving' | 'saved';

// ── Helpers ─────────────────────────────────────────────────────────────────
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function soDigitos(s: string) { return (s || '').replace(/\D/g, ''); }
function waLink(fone: string) {
  const d = soDigitos(fone);
  if (!d) return null;
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`;
}
function grupoDe(status: string | null): Grupo { return STATUS_BY_V[status || 'lead']?.grupo || 'negociando'; }
function normalizar(c: Record<string, unknown>): Lead {
  return {
    ...(c as object),
    telefones: Array.isArray(c.telefones) ? (c.telefones as string[]) : [],
    parcelas: Array.isArray(c.parcelas) ? (c.parcelas as Parcela[]) : [],
    checklist: c.checklist && typeof c.checklist === 'object' ? (c.checklist as Record<string, boolean>) : {},
    valor_total_num: c.valor_total_num == null ? null : Number(c.valor_total_num),
    qtd_adultos: c.qtd_adultos == null ? null : Number(c.qtd_adultos),
    qtd_criancas: c.qtd_criancas == null ? null : Number(c.qtd_criancas),
  } as Lead;
}
function montarPayload(c: Lead) {
  return {
    nome_evento: c.nome_evento || null, quem_contratou: c.quem_contratou || null,
    documento: c.documento || null, email: c.email || null,
    telefones: c.telefones || [], contato_emergencia: c.contato_emergencia || null,
    como_conheceu: c.como_conheceu || null, tipo_evento: c.tipo_evento || null,
    status: c.status || 'lead', data_inicio: c.data_inicio || null, data_fim: c.data_fim || null,
    horario_inicio: c.horario_inicio || null, horario_fim: c.horario_fim || null,
    qtd_adultos: c.qtd_adultos ?? null, qtd_criancas: c.qtd_criancas ?? null,
    formato_recepcao: c.formato_recepcao || null, atracoes: c.atracoes || null,
    horario_montagem: c.horario_montagem || null, horario_desmontagem: c.horario_desmontagem || null,
    layout_mesas: c.layout_mesas || null, servicos_casa: c.servicos_casa || null,
    fornecedores: c.fornecedores || null, necessidades_tecnicas: c.necessidades_tecnicas || null,
    checkin_materiais: c.checkin_materiais || null,
    valor_total_num: c.valor_total_num ?? null, forma_pagamento: c.forma_pagamento || null,
    parcelas: c.parcelas || [], taxas_extras: c.taxas_extras || null,
    restricoes_alimentares: c.restricoes_alimentares || null, vip_autoridades: c.vip_autoridades || null,
    observacoes: c.observacoes || null, motivo_descarte: c.motivo_descarte || null,
    checklist: c.checklist || {}, propriedade_id: c.propriedade_id ?? null,
  };
}
// Sinaliza parcela vencida (< hoje) ou próxima (≤ 7 dias) de um lead.
function flagParcela(l: Lead): 'vencida' | 'proxima' | null {
  const hoje = ymd(new Date());
  const lim = ymd(new Date(Date.now() + 7 * 864e5));
  let prox = false;
  for (const p of l.parcelas || []) {
    if (!p.vencimento) continue;
    if (p.vencimento < hoje) return 'vencida';
    if (p.vencimento <= lim) prox = true;
  }
  return prox ? 'proxima' : null;
}

// ── Página ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [props, setProps] = useState<Prop[]>([]);

  const [view, setView] = useState<'kanban' | 'lista'>('kanban');
  const [fStatus, setFStatus] = useState('');
  const [fTipo, setFTipo] = useState('');
  const [fProp, setFProp] = useState('');
  const [busca, setBusca] = useState('');

  // criar
  const [modal, setModal] = useState(false);
  const [nNome, setNNome] = useState('');
  const [nQuem, setNQuem] = useState('');
  const [nTipo, setNTipo] = useState(TIPOS[0]);
  const [nStatus, setNStatus] = useState('lead');
  const [saving, setSaving] = useState(false);

  // drawer / ficha
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Lead | null>(null);
  const [drawerShown, setDrawerShown] = useState(false);
  const [saude, setSaude] = useState<Saude>('idle');
  const draftRef = useRef<Lead | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // dnd
  const [dragId, setDragId] = useState<string | null>(null);
  const [overGrupo, setOverGrupo] = useState<Grupo | null>(null);

  // toasts
  const [toasts, setToasts] = useState<{ id: number; msg: string; tone: 'ok' | 'erro' }[]>([]);
  const pushToast = useCallback((msg: string, tone: 'ok' | 'erro' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      const [{ data: ls }, { data: ps }] = await Promise.all([
        sb.from('clientes_eventos').select('*').eq('usuario_id', session.user.id).order('criado_em', { ascending: false }),
        sb.from('propriedades').select('id,nome').eq('usuario_id', session.user.id).order('id'),
      ]);
      setLeads((ls || []).map(normalizar));
      setProps((ps || []) as Prop[]);
      setLoading(false);
    })();
  }, []);

  // ── Agregados ──
  const kpis = useMemo(() => {
    const somaG = (g: Grupo) => leads.filter((l) => grupoDe(l.status) === g).reduce((s, l) => s + (l.valor_total_num || 0), 0);
    const contaG = (g: Grupo) => leads.filter((l) => grupoDe(l.status) === g).length;
    const fechados = contaG('contratados') + contaG('finalizados');
    return {
      total: leads.length,
      negCount: contaG('negociando'), negValor: somaG('negociando'),
      contCount: contaG('contratados'), contValor: somaG('contratados'),
      finCount: contaG('finalizados'), ganho: somaG('finalizados'),
      perdCount: contaG('perdidos'),
      conv: leads.length ? fechados / leads.length : 0,
    };
  }, [leads]);

  const funil = useMemo(() => {
    const conta = (g: Grupo) => leads.filter((l) => grupoDe(l.status) === g).length;
    const etapas = [
      { label: 'Leads', n: leads.length },
      { label: 'Negociando', n: conta('negociando') },
      { label: 'Contratados', n: conta('contratados') },
      { label: 'Finalizados', n: conta('finalizados') },
    ];
    const max = Math.max(1, ...etapas.map((e) => e.n));
    return { etapas, max };
  }, [leads]);

  const alertas = useMemo(() => {
    let venc = 0, prox = 0;
    for (const l of leads) {
      const f = flagParcela(l);
      if (f === 'vencida') venc++;
      else if (f === 'proxima') prox++;
    }
    return { venc, prox };
  }, [leads]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter((l) => {
      if (fStatus && l.status !== fStatus) return false;
      if (fTipo && l.tipo_evento !== fTipo) return false;
      if (fProp && String(l.propriedade_id ?? '') !== fProp) return false;
      if (q && !(`${l.nome_evento || ''} ${l.quem_contratou || ''}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [leads, fStatus, fTipo, fProp, busca]);

  const porGrupo = useMemo(() => {
    const m: Record<Grupo, Lead[]> = { negociando: [], contratados: [], finalizados: [], perdidos: [] };
    for (const l of filtrados) m[grupoDe(l.status)].push(l);
    return m;
  }, [filtrados]);

  // ── CRUD ──
  async function criar() {
    if (!userId || !nNome.trim() || !nQuem.trim()) return;
    setSaving(true);
    const { data, error } = await sb.from('clientes_eventos').insert({
      usuario_id: userId, nome_evento: nNome.trim(), quem_contratou: nQuem.trim(),
      tipo_evento: nTipo, status: nStatus, telefones: [], parcelas: [], checklist: {},
    }).select().single();
    setSaving(false);
    if (error || !data) { pushToast('Erro ao criar lead', 'erro'); return; }
    setLeads((arr) => [normalizar(data), ...arr]);
    setModal(false); setNNome(''); setNQuem(''); setNTipo(TIPOS[0]); setNStatus('lead');
    pushToast(`"${data.nome_evento}" criado`);
  }

  async function mudarStatus(id: string, status: string) {
    setLeads((arr) => arr.map((l) => (l.id === id ? { ...l, status } : l)));
    if (draftRef.current?.id === id) { const nd = { ...draftRef.current, status }; draftRef.current = nd; setDraft(nd); }
    if (userId) {
      const { error } = await sb.from('clientes_eventos').update({ status }).eq('id', id).eq('usuario_id', userId);
      if (error) pushToast('Erro ao atualizar status', 'erro');
    }
  }

  async function excluir(id: string) {
    if (!userId || !confirm('Excluir este lead/evento? Esta ação não pode ser desfeita.')) return;
    const { error } = await sb.from('clientes_eventos').delete().eq('id', id).eq('usuario_id', userId);
    if (error) { pushToast('Erro ao excluir', 'erro'); return; }
    setLeads((arr) => arr.filter((l) => l.id !== id));
    if (editingId === id) closeDrawer();
    pushToast('Lead removido');
  }

  // ── Drag & drop entre colunas (muda o grupo de status) ──
  function dropNoGrupo(g: Grupo) {
    const id = dragId; setDragId(null); setOverGrupo(null);
    if (!id) return;
    const lead = leads.find((l) => l.id === id);
    if (!lead || grupoDe(lead.status) === g) return;
    const novo = GRUPOS.find((x) => x.v === g)!.padrao;
    void mudarStatus(id, novo);
    pushToast(`${lead.nome_evento || 'Lead'} → ${STATUS_BY_V[novo].label}`);
  }

  // ── Drawer + auto-save ──
  function openDrawer(l: Lead) {
    draftRef.current = l; setDraft(l); setEditingId(l.id); setSaude('idle');
    requestAnimationFrame(() => setDrawerShown(true));
  }
  async function closeDrawer() {
    if (saveTimer.current) { clearTimeout(saveTimer.current); saveTimer.current = null; await persistDraft(); }
    setDrawerShown(false);
    setTimeout(() => { setEditingId(null); setDraft(null); }, 220);
  }
  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaude('saving');
    saveTimer.current = setTimeout(() => { void persistDraft(); }, 700);
  }
  async function persistDraft() {
    const d = draftRef.current;
    if (!d || !userId) return;
    const { error } = await sb.from('clientes_eventos').update(montarPayload(d)).eq('id', d.id).eq('usuario_id', userId);
    if (error) { setSaude('idle'); pushToast('Erro ao salvar', 'erro'); return; }
    setLeads((arr) => arr.map((l) => (l.id === d.id ? { ...l, ...d } : l)));
    setSaude('saved');
    setTimeout(() => setSaude((s) => (s === 'saved' ? 'idle' : s)), 1400);
  }
  function updateDraft(patch: Partial<Lead>) {
    const nd = { ...(draftRef.current as Lead), ...patch };
    draftRef.current = nd; setDraft(nd);
    setLeads((arr) => arr.map((l) => (l.id === nd.id ? { ...l, ...patch } : l)));
    scheduleSave();
  }
  // parcelas
  function addParcela() { updateDraft({ parcelas: [...(draft!.parcelas || []), { desc: '', vencimento: '', valor: null }] }); }
  function setParcela(i: number, patch: Partial<Parcela>) {
    const arr = [...(draft!.parcelas || [])]; arr[i] = { ...arr[i], ...patch }; updateDraft({ parcelas: arr });
  }
  function rmParcela(i: number) { updateDraft({ parcelas: (draft!.parcelas || []).filter((_, j) => j !== i) }); }
  // telefones
  function addFone() { updateDraft({ telefones: [...(draft!.telefones || []), ''] }); }
  function setFone(i: number, v: string) { const arr = [...(draft!.telefones || [])]; arr[i] = v; updateDraft({ telefones: arr }); }
  function rmFone(i: number) { updateDraft({ telefones: (draft!.telefones || []).filter((_, j) => j !== i) }); }
  // checklist
  function toggleCheck(k: string, v: boolean) { updateDraft({ checklist: { ...(draft!.checklist || {}), [k]: v } }); }

  // ── Exports (dynamic import p/ não inflar o bundle) ──
  function tabelaExport() {
    return filtrados.map((l) => ({
      'Nome do Evento': l.nome_evento || '', 'Quem Contratou': l.quem_contratou || '',
      Tipo: l.tipo_evento || '', Status: STATUS_BY_V[l.status || 'lead']?.label || '',
      'Data Início': l.data_inicio || '', 'Data Fim': l.data_fim || '',
      'E-mail': l.email || '', Telefone: (l.telefones || []).join(', '),
      Adultos: l.qtd_adultos ?? '', Crianças: l.qtd_criancas ?? '',
      'Valor Total': l.valor_total_num ?? '', 'Forma de Pagamento': l.forma_pagamento || '',
      Observações: l.observacoes || '',
    }));
  }
  async function exportExcel() {
    if (!filtrados.length) return pushToast('Nada para exportar', 'erro');
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(tabelaExport());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `ventsy-leads-${ymd(new Date())}.xlsx`);
    pushToast(`${filtrados.length} lead(s) exportado(s)`);
  }
  async function exportPdfLista() {
    if (!filtrados.length) return pushToast('Nada para exportar', 'erro');
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('VENTSY — Leads & Eventos', 14, 18);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} • ${filtrados.length} lead(s)`, 14, 25);
    const cols = ['Evento', 'Cliente', 'Data', 'Status', 'Tipo', 'Valor'];
    const colW = [62, 52, 34, 38, 30, 40];
    let y = 35, x = 14;
    doc.setFillColor(255, 56, 92); doc.setTextColor(255); doc.rect(x, y - 5, colW.reduce((a, b) => a + b, 0), 10, 'F');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    cols.forEach((c, i) => { doc.text(c, x + 2, y + 1); x += colW[i]; });
    doc.setTextColor(0); doc.setFont('helvetica', 'normal');
    filtrados.forEach((l, idx) => {
      y += 10; x = 14;
      if (y > 188) { doc.addPage(); y = 20; }
      if (idx % 2 === 0) { doc.setFillColor(248, 248, 248); doc.rect(14, y - 5, colW.reduce((a, b) => a + b, 0), 10, 'F'); }
      [l.nome_evento || '—', l.quem_contratou || '—', formatDateRange(l.data_inicio, l.data_fim) || '—',
        STATUS_BY_V[l.status || 'lead']?.label || '—', l.tipo_evento || '—',
        l.valor_total_num != null ? formatMoney(l.valor_total_num) : '—',
      ].forEach((v, i) => { doc.text(String(v).substring(0, 28), x + 2, y + 1); x += colW[i]; });
    });
    doc.save(`ventsy-leads-${ymd(new Date())}.pdf`);
    pushToast('PDF da lista exportado');
  }
  async function exportPdfLead(l: Lead) {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(l.nome_evento || 'Evento', 14, 20);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(150);
    doc.text(`${STATUS_BY_V[l.status || 'lead']?.label || ''} • Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 28);
    doc.setTextColor(0);
    const secoes: [string, [string, string | number | null | undefined][]][] = [
      ['DADOS PESSOAIS', [['Quem Contratou', l.quem_contratou], ['Documento', l.documento], ['E-mail', l.email], ['Telefone(s)', (l.telefones || []).join(', ')], ['Como Conheceu', l.como_conheceu]]],
      ['DADOS DO EVENTO', [['Tipo', l.tipo_evento], ['Formato', l.formato_recepcao], ['Período', formatDateRange(l.data_inicio, l.data_fim)], ['Horário', `${l.horario_inicio || '—'} às ${l.horario_fim || '—'}`], ['Convidados', `${l.qtd_adultos || 0} adultos, ${l.qtd_criancas || 0} crianças`]]],
      ['FINANCEIRO', [['Valor Total', l.valor_total_num != null ? formatMoney(l.valor_total_num) : null], ['Forma de Pagamento', l.forma_pagamento], ['Taxas Extras', l.taxas_extras]]],
      ['OBSERVAÇÕES', [['Restrições Alimentares', l.restricoes_alimentares], ['VIP / Autoridades', l.vip_autoridades], ['Observações', l.observacoes]]],
    ];
    let y = 40;
    for (const [titulo, campos] of secoes) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFillColor(255, 245, 247); doc.rect(14, y - 4, 182, 8, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255, 56, 92);
      doc.text(titulo, 16, y + 1);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(0); y += 10;
      for (const [label, val] of campos) {
        if (val == null || val === '') continue;
        if (y > 275) { doc.addPage(); y = 20; }
        doc.setFontSize(7.5); doc.setTextColor(150); doc.text(label + ':', 16, y);
        doc.setTextColor(0); doc.setFontSize(8.5);
        const linhas = doc.splitTextToSize(String(val), 150);
        doc.text(linhas, 60, y); y += 5 * linhas.length + 2;
      }
      y += 4;
    }
    doc.save(`ventsy-${(l.nome_evento || 'evento').replace(/\s+/g, '-').toLowerCase()}.pdf`);
    pushToast('PDF do evento exportado');
  }

  if (loading) return <div className="mx-auto h-[520px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  const temFiltro = !!(fStatus || fTipo || fProp || busca);

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Leads</h1>
          <p className="mt-1 text-sm text-ink-muted">Do primeiro interesse ao pós-evento — pipeline, ficha completa e financeiro.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={exportExcel} className="rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-emerald-300 hover:text-emerald-700">Excel</button>
          <button onClick={exportPdfLista} className="rounded-xl border border-black/10 px-3 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-red-300 hover:text-red-600">PDF</button>
          <button onClick={() => setModal(true)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">+ Novo lead</button>
        </div>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Total de leads" value={String(kpis.total)} sub={`${kpis.perdCount} perdido(s)`} />
        <Kpi label="Em negociação" value={formatMoneyShort(kpis.negValor)} sub={`${kpis.negCount} lead(s)`} tone="amber" />
        <Kpi label="Contratados" value={formatMoneyShort(kpis.contValor)} sub={`${kpis.contCount} evento(s)`} tone="emerald" />
        <Kpi label="Receita ganha" value={formatMoneyShort(kpis.ganho)} sub={`${kpis.finCount} finalizado(s)`} tone="blue" />
        <Kpi label="Conversão" value={formatPercent(kpis.conv)} sub="fechados / total" tone="gold" />
      </div>

      {/* Alertas de parcela */}
      {(alertas.venc > 0 || alertas.prox > 0) && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">💸 Parcelas:</span>
          {alertas.venc > 0 && <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-semibold text-red-700">{alertas.venc} vencida(s)</span>}
          {alertas.prox > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-800">{alertas.prox} vencendo em 7 dias</span>}
          <span className="text-amber-700/80">Abra a ficha do evento para conferir os vencimentos.</span>
        </div>
      )}

      {/* Funil + Toolbar */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
        <div className="rounded-2xl bg-white p-5 shadow-card">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-xl border border-black/10 p-0.5">
              {(['kanban', 'lista'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition ${view === v ? 'bg-ink text-white' : 'text-ink-muted hover:text-ink'}`}>
                  {v === 'kanban' ? 'Kanban' : 'Lista'}
                </button>
              ))}
            </div>
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar evento ou cliente…" className="min-w-[180px] flex-1 rounded-xl border border-black/10 px-3.5 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selCls}>
              <option value="">Status</option>
              {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
            </select>
            <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className={selCls}>
              <option value="">Tipo</option>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {props.length > 0 && (
              <select value={fProp} onChange={(e) => setFProp(e.target.value)} className={selCls}>
                <option value="">Espaço</option>
                {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome || `#${p.id}`}</option>)}
              </select>
            )}
          </div>

          {/* Conteúdo */}
          {filtrados.length === 0 ? (
            <div className="py-16 text-center text-sm text-ink-muted">
              {temFiltro ? 'Nenhum lead com esse filtro.' : <>Nenhum lead ainda. Use <strong>+ Novo lead</strong> para registrar o primeiro contato.</>}
            </div>
          ) : view === 'kanban' ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {GRUPOS.map((g) => {
                const items = porGrupo[g.v];
                const soma = items.reduce((s, l) => s + (l.valor_total_num || 0), 0);
                return (
                  <div
                    key={g.v}
                    onDragOver={(e) => { e.preventDefault(); setOverGrupo(g.v); }}
                    onDragLeave={() => setOverGrupo((cur) => (cur === g.v ? null : cur))}
                    onDrop={() => dropNoGrupo(g.v)}
                    className={`rounded-2xl border bg-black/[0.015] p-2.5 transition ${overGrupo === g.v ? `ring-2 ${g.ring} border-transparent` : 'border-black/[0.05]'}`}
                  >
                    <div className="mb-2 flex items-center justify-between px-1">
                      <div className="flex items-center gap-2 text-sm font-bold text-ink">
                        <span className={`h-2 w-2 rounded-full ${g.dot}`} />{g.label}
                        <span className="text-ink-muted">{items.length}</span>
                      </div>
                      {soma > 0 && <span className="text-[0.7rem] font-semibold text-ink-muted">{formatMoneyShort(soma)}</span>}
                    </div>
                    <div className="space-y-2 min-h-[60px]">
                      {items.map((l) => {
                        const sd = STATUS_BY_V[l.status || 'lead'];
                        const fp = flagParcela(l);
                        return (
                          <div
                            key={l.id}
                            draggable
                            onDragStart={() => setDragId(l.id)}
                            onDragEnd={() => { setDragId(null); setOverGrupo(null); }}
                            onClick={() => openDrawer(l)}
                            className={`cursor-grab rounded-xl border border-black/[0.06] bg-white p-3 shadow-card transition active:cursor-grabbing hover:border-brand/30 ${dragId === l.id ? 'opacity-40' : ''}`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm font-semibold text-ink line-clamp-1">{l.nome_evento || '—'}</span>
                              {l.valor_total_num != null && <span className="shrink-0 text-xs font-bold text-ink-soft">{formatMoneyShort(l.valor_total_num)}</span>}
                            </div>
                            <div className="mt-0.5 text-xs text-ink-muted line-clamp-1">{l.quem_contratou || '—'}</div>
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <span className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.65rem] font-medium text-ink-muted">{l.tipo_evento || '—'}</span>
                              <span className="text-[0.65rem] text-ink-muted">{formatDateRange(l.data_inicio, l.data_fim) || ''}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold ${GRUPO_CLS[g.v]}`}>{sd?.emoji} {sd?.label}</span>
                              {fp && <span title={fp === 'vencida' ? 'Parcela vencida' : 'Parcela em 7 dias'} className={`h-2 w-2 rounded-full ${fp === 'vencida' ? 'bg-red-500' : 'bg-amber-400'}`} />}
                            </div>
                          </div>
                        );
                      })}
                      {items.length === 0 && <div className="rounded-xl border border-dashed border-black/10 py-6 text-center text-[0.7rem] text-ink-muted">Arraste para cá</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Evento</th>
                    <th className="pb-2 font-semibold">Cliente</th>
                    <th className="pb-2 font-semibold">Tipo</th>
                    <th className="pb-2 font-semibold">Data</th>
                    <th className="pb-2 text-right font-semibold">Valor</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtrados.map((l) => {
                    const g = grupoDe(l.status);
                    const fp = flagParcela(l);
                    return (
                      <tr key={l.id} onClick={() => openDrawer(l)} className="cursor-pointer border-b border-black/[0.04] hover:bg-black/[0.015]">
                        <td className="py-2.5 font-semibold text-ink">
                          <span className="inline-flex items-center gap-1.5">
                            {fp && <span className={`h-2 w-2 rounded-full ${fp === 'vencida' ? 'bg-red-500' : 'bg-amber-400'}`} />}
                            {l.nome_evento || '—'}
                          </span>
                        </td>
                        <td className="py-2.5 text-ink-soft">{l.quem_contratou || '—'}</td>
                        <td className="py-2.5 text-ink-muted">{l.tipo_evento || '—'}</td>
                        <td className="py-2.5 text-ink-muted">{formatDateRange(l.data_inicio, l.data_fim) || '—'}</td>
                        <td className="py-2.5 text-right font-semibold text-ink-soft">{l.valor_total_num != null ? formatMoney(l.valor_total_num) : '—'}</td>
                        <td className="py-2.5" onClick={(e) => e.stopPropagation()}>
                          <select value={l.status || 'lead'} onChange={(e) => mudarStatus(l.id, e.target.value)} className={`rounded-full border px-2.5 py-1 text-xs font-semibold focus:outline-none ${GRUPO_CLS[g]}`}>
                            {STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                          </select>
                        </td>
                        <td className="py-2.5 pl-2 text-right" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => excluir(l.id)} title="Excluir" className="text-ink-muted hover:text-red-600">✕</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Funil */}
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-base font-bold text-ink">Funil</h3>
          <p className="mt-0.5 text-xs text-ink-muted">Distribuição atual dos leads.</p>
          <div className="mt-4 space-y-3">
            {funil.etapas.map((e) => (
              <div key={e.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="text-ink-soft">{e.label}</span>
                  <span className="font-semibold text-ink-muted">{e.n}{kpis.total > 0 && <span className="ml-1 text-ink-muted/70">· {formatPercent(e.n / kpis.total)}</span>}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/[0.06]">
                  <div className="h-full rounded-full bg-brand" style={{ width: `${Math.round((e.n / funil.max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Drawer da ficha */}
      {editingId && draft && (
        <div className="fixed inset-0 z-[10000]" role="dialog" aria-modal="true">
          <div onClick={closeDrawer} className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${drawerShown ? 'opacity-100' : 'opacity-0'}`} />
          <div className={`absolute right-0 top-0 flex h-full w-full max-w-xl flex-col bg-[#f7f7f8] shadow-pop transition-transform duration-200 ${drawerShown ? 'translate-x-0' : 'translate-x-full'}`}>
            {/* Header */}
            <div className="flex items-center gap-3 border-b border-black/[0.06] bg-white px-5 py-3">
              <input
                value={draft.nome_evento || ''}
                onChange={(e) => updateDraft({ nome_evento: e.target.value })}
                placeholder="Nome do evento"
                className="flex-1 truncate rounded-lg border border-transparent bg-transparent px-1 py-1 text-lg font-bold text-ink hover:border-black/10 focus:border-brand focus:outline-none"
              />
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${saude === 'saving' ? 'bg-amber-50 text-amber-700' : saude === 'saved' ? 'bg-emerald-50 text-emerald-700' : 'text-ink-muted'}`}>
                {saude === 'saving' ? 'Salvando…' : saude === 'saved' ? 'Salvo ✓' : ''}
              </span>
              <button onClick={closeDrawer} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            </div>

            {/* Barra de status + valor */}
            <div className="flex flex-wrap items-center gap-2 border-b border-black/[0.06] bg-white px-5 py-2.5">
              <select value={draft.status || 'lead'} onChange={(e) => updateDraft({ status: e.target.value })} className={`rounded-full border px-3 py-1 text-xs font-semibold focus:outline-none ${GRUPO_CLS[grupoDe(draft.status)]}`}>
                {STATUS.map((s) => <option key={s.v} value={s.v}>{s.emoji} {s.label}</option>)}
              </select>
              {props.length > 0 && (
                <select value={draft.propriedade_id != null ? String(draft.propriedade_id) : ''} onChange={(e) => updateDraft({ propriedade_id: e.target.value ? Number(e.target.value) : null })} className={selCls}>
                  <option value="">Sem espaço vinculado</option>
                  {props.map((p) => <option key={p.id} value={String(p.id)}>{p.nome || `#${p.id}`}</option>)}
                </select>
              )}
              {draft.valor_total_num != null && <span className="ml-auto text-sm font-bold text-ink">{formatMoney(draft.valor_total_num)}</span>}
            </div>

            {/* Corpo rolável */}
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Dados pessoais */}
              <Secao icon="👤" tone="bg-blue-50 text-blue-600" title="Dados Pessoais">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Quem contratou"><input className={inp} value={draft.quem_contratou || ''} onChange={(e) => updateDraft({ quem_contratou: e.target.value })} /></Campo>
                  <Campo label="Documento (CPF/CNPJ)"><input className={inp} value={draft.documento || ''} onChange={(e) => updateDraft({ documento: e.target.value })} placeholder="000.000.000-00" /></Campo>
                </div>
                <Campo label="E-mail"><input type="email" className={inp} value={draft.email || ''} onChange={(e) => updateDraft({ email: e.target.value })} placeholder="email@exemplo.com" /></Campo>
                <Campo label="Telefone(s) / WhatsApp">
                  <div className="space-y-2">
                    {(draft.telefones.length ? draft.telefones : ['']).map((f, i) => (
                      <div key={i} className="flex gap-2">
                        <input type="tel" className={inp} value={f} onChange={(e) => (draft.telefones.length ? setFone(i, e.target.value) : updateDraft({ telefones: [e.target.value] }))} placeholder="(00) 00000-0000" />
                        {waLink(f) && <a href={waLink(f)!} target="_blank" rel="noopener noreferrer" title="Abrir WhatsApp" className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">💬</a>}
                        {draft.telefones.length > 1 && <button onClick={() => rmFone(i)} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-black/10 text-ink-muted hover:text-red-600">✕</button>}
                      </div>
                    ))}
                    <button onClick={addFone} className="text-xs font-semibold text-brand hover:underline">＋ Adicionar telefone</button>
                  </div>
                </Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Contato de emergência"><input className={inp} value={draft.contato_emergencia || ''} onChange={(e) => updateDraft({ contato_emergencia: e.target.value })} /></Campo>
                  <Campo label="Como conheceu"><select className={inp} value={draft.como_conheceu || ''} onChange={(e) => updateDraft({ como_conheceu: e.target.value })}>{COMO_CONHECEU.map((o) => <option key={o} value={o}>{o || 'Selecionar…'}</option>)}</select></Campo>
                </div>
              </Secao>

              {/* Dados do evento */}
              <Secao icon="🎉" tone="bg-pink-50 text-pink-600" title="Dados do Evento">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Tipo de evento"><select className={inp} value={draft.tipo_evento || ''} onChange={(e) => updateDraft({ tipo_evento: e.target.value })}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select></Campo>
                  <Campo label="Formato da recepção"><select className={inp} value={draft.formato_recepcao || ''} onChange={(e) => updateDraft({ formato_recepcao: e.target.value })}>{FORMATOS.map((o) => <option key={o} value={o}>{o || 'Selecionar…'}</option>)}</select></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Data início"><input type="date" className={inp} value={draft.data_inicio || ''} onChange={(e) => updateDraft({ data_inicio: e.target.value })} /></Campo>
                  <Campo label="Data fim"><input type="date" className={inp} value={draft.data_fim || ''} min={draft.data_inicio || undefined} onChange={(e) => updateDraft({ data_fim: e.target.value })} /></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Horário início"><input type="time" className={inp} value={draft.horario_inicio || ''} onChange={(e) => updateDraft({ horario_inicio: e.target.value })} /></Campo>
                  <Campo label="Horário fim"><input type="time" className={inp} value={draft.horario_fim || ''} onChange={(e) => updateDraft({ horario_fim: e.target.value })} /></Campo>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Convidados adultos"><input type="number" min={0} className={inp} value={draft.qtd_adultos ?? ''} onChange={(e) => updateDraft({ qtd_adultos: e.target.value ? parseInt(e.target.value) : null })} /></Campo>
                  <Campo label="Convidados crianças"><input type="number" min={0} className={inp} value={draft.qtd_criancas ?? ''} onChange={(e) => updateDraft({ qtd_criancas: e.target.value ? parseInt(e.target.value) : null })} /></Campo>
                </div>
                <Campo label="Atrações / nomes principais"><textarea rows={2} className={inp} value={draft.atracoes || ''} onChange={(e) => updateDraft({ atracoes: e.target.value })} /></Campo>
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Horário de montagem"><input className={inp} value={draft.horario_montagem || ''} onChange={(e) => updateDraft({ horario_montagem: e.target.value })} placeholder="Ex: 10h do dia anterior" /></Campo>
                  <Campo label="Horário de desmontagem"><input className={inp} value={draft.horario_desmontagem || ''} onChange={(e) => updateDraft({ horario_desmontagem: e.target.value })} /></Campo>
                </div>
              </Secao>

              {/* Serviços & estrutura */}
              <Secao icon="🔧" tone="bg-emerald-50 text-emerald-600" title="Serviços & Estrutura">
                <Campo label="Serviços contratados da casa"><textarea rows={2} className={inp} value={draft.servicos_casa || ''} onChange={(e) => updateDraft({ servicos_casa: e.target.value })} /></Campo>
                <Campo label="Fornecedores externos"><textarea rows={2} className={inp} value={draft.fornecedores || ''} onChange={(e) => updateDraft({ fornecedores: e.target.value })} /></Campo>
                <Campo label="Necessidades técnicas"><textarea rows={2} className={inp} value={draft.necessidades_tecnicas || ''} onChange={(e) => updateDraft({ necessidades_tecnicas: e.target.value })} /></Campo>
                <Campo label="Layout de mesas"><textarea rows={2} className={inp} value={draft.layout_mesas || ''} onChange={(e) => updateDraft({ layout_mesas: e.target.value })} /></Campo>
                <Campo label="Check-in de materiais do cliente"><textarea rows={2} className={inp} value={draft.checkin_materiais || ''} onChange={(e) => updateDraft({ checkin_materiais: e.target.value })} /></Campo>
              </Secao>

              {/* Financeiro */}
              <Secao icon="💰" tone="bg-amber-50 text-amber-600" title="Financeiro">
                <div className="grid grid-cols-2 gap-3">
                  <Campo label="Valor total do contrato"><input type="number" min={0} step="0.01" className={inp} value={draft.valor_total_num ?? ''} onChange={(e) => updateDraft({ valor_total_num: e.target.value ? Number(e.target.value) : null })} placeholder="0,00" /></Campo>
                  <Campo label="Forma de pagamento"><select className={inp} value={draft.forma_pagamento || ''} onChange={(e) => updateDraft({ forma_pagamento: e.target.value })}>{PAGAMENTOS.map((o) => <option key={o} value={o}>{o || 'Selecionar…'}</option>)}</select></Campo>
                </div>
                <Campo label="Parcelas / vencimentos">
                  <div className="space-y-2">
                    {(draft.parcelas || []).map((p, i) => {
                      const venc = p.vencimento && p.vencimento < ymd(new Date());
                      return (
                        <div key={i} className="flex gap-2">
                          <input className={inp} value={p.desc || ''} onChange={(e) => setParcela(i, { desc: e.target.value })} placeholder="Ex: 1ª parcela" />
                          <input type="date" className={`${inp} ${venc ? 'border-red-300 text-red-600' : ''}`} value={p.vencimento || ''} onChange={(e) => setParcela(i, { vencimento: e.target.value })} />
                          <input type="number" min={0} step="0.01" className={`${inp} w-28`} value={p.valor ?? ''} onChange={(e) => setParcela(i, { valor: e.target.value ? Number(e.target.value) : null })} placeholder="R$" />
                          <button onClick={() => rmParcela(i)} className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border border-black/10 text-ink-muted hover:text-red-600">✕</button>
                        </div>
                      );
                    })}
                    <button onClick={addParcela} className="text-xs font-semibold text-brand hover:underline">＋ Adicionar parcela</button>
                  </div>
                </Campo>
                <Campo label="Taxas extras"><textarea rows={2} className={inp} value={draft.taxas_extras || ''} onChange={(e) => updateDraft({ taxas_extras: e.target.value })} /></Campo>
              </Secao>

              {/* Experiência */}
              <Secao icon="⭐" tone="bg-purple-50 text-purple-600" title="Experiência & Convidados">
                <Campo label="Restrições alimentares"><textarea rows={2} className={inp} value={draft.restricoes_alimentares || ''} onChange={(e) => updateDraft({ restricoes_alimentares: e.target.value })} /></Campo>
                <Campo label="Lista VIP / autoridades"><textarea rows={2} className={inp} value={draft.vip_autoridades || ''} onChange={(e) => updateDraft({ vip_autoridades: e.target.value })} /></Campo>
                <Campo label="Observações gerais"><textarea rows={3} className={inp} value={draft.observacoes || ''} onChange={(e) => updateDraft({ observacoes: e.target.value })} /></Campo>
                {grupoDe(draft.status) === 'perdidos' && (
                  <Campo label="Motivo do descarte"><textarea rows={2} className={inp} value={draft.motivo_descarte || ''} onChange={(e) => updateDraft({ motivo_descarte: e.target.value })} placeholder="Por que este lead foi perdido?" /></Campo>
                )}
              </Secao>

              {/* Checklist */}
              <Secao icon="✅" tone="bg-orange-50 text-orange-600" title="Checklist Operacional">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {CHECKLIST_ITEMS.map(([k, label]) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg border border-black/[0.06] bg-white px-3 py-2 text-sm text-ink-soft hover:border-brand/30">
                      <input type="checkbox" checked={!!draft.checklist?.[k]} onChange={(e) => toggleCheck(k, e.target.checked)} className="h-4 w-4 accent-brand" />
                      {label}
                    </label>
                  ))}
                </div>
              </Secao>
            </div>

            {/* Footer */}
            <div className="flex items-center gap-3 border-t border-black/[0.06] bg-white px-5 py-3">
              <button onClick={() => excluir(draft.id)} className="rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50">🗑️ Excluir</button>
              <button onClick={() => exportPdfLead(draft)} className="rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft hover:border-ink/20">📄 Exportar PDF</button>
              <button onClick={closeDrawer} className="ml-auto rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">Concluir</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal novo lead */}
      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-md rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">Novo lead</h3>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Nome do evento</span>
                <input value={nNome} onChange={(e) => setNNome(e.target.value)} className={inp} placeholder="Ex: Casamento Silva" autoFocus />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Quem contratou</span>
                <input value={nQuem} onChange={(e) => setNQuem(e.target.value)} className={inp} placeholder="Nome do cliente" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Tipo</span>
                  <select value={nTipo} onChange={(e) => setNTipo(e.target.value)} className={inp}>{TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Status</span>
                  <select value={nStatus} onChange={(e) => setNStatus(e.target.value)} className={inp}>{STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}</select>
                </label>
              </div>
            </div>
            <div className="mt-6 flex items-center gap-3">
              <button onClick={criar} disabled={saving || !nNome.trim() || !nQuem.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Criando…' : 'Criar lead'}</button>
              <button onClick={() => setModal(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[10001] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`pointer-events-auto rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-pop ${t.tone === 'erro' ? 'bg-red-600' : 'bg-ink'}`}>{t.msg}</div>
        ))}
      </div>
    </div>
  );
}

// ── UI helpers ──────────────────────────────────────────────────────────────
const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const selCls = 'rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none';

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'amber' | 'emerald' | 'blue' | 'gold' }) {
  const color = tone === 'amber' ? 'text-amber-600' : tone === 'emerald' ? 'text-emerald-600' : tone === 'blue' ? 'text-blue-600' : tone === 'gold' ? 'text-amber-500' : 'text-ink';
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className={`mt-2 text-xl font-bold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[0.7rem] text-ink-muted">{sub}</div>}
    </div>
  );
}

function Secao({ icon, tone, title, children }: { icon: string; tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg text-sm ${tone}`}>{icon}</span>
        <span className="text-sm font-bold text-ink">{title}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

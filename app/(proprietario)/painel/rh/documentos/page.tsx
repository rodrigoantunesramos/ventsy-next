'use client';

// Documentação — /painel/rh/documentos.
// Repositório de documentos por funcionário com VALIDADE (ASO, certificações:
// brigada, NR, vigilante, manipulação de alimentos) e alertas de vencimento
// (semáforo do motor lib/rh.statusValidade). Dados: rh_documentos (RLS) + equipe.
// Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/format';
import { statusValidade, diasAteVencer } from '@/lib/rh';
import {
  useRh, mapDoc, SEL_DOC, exportCSV, inp, inicial, avatarCor,
  TIPOS_DOC, DOC_LABEL, VAL_CLS, VAL_LABEL, type Documento, type Funcionario,
} from '../_lib';
import { Kpi, Card, Chip, EmptyState, ModalShell, Campo, btnPrimary, btnSecondary, IcoFolder, IcoPlus, IcoDownload, IcoEdit, IcoTrash, IcoLink } from '../_components/ui';

export default function DocumentosPage() {
  const { userId, hoje, equipe } = useRh();
  const toast = useToast();
  const [docs, setDocs] = useState<Documento[]>([]);
  const [loading, setLoading] = useState(true);
  const [fFunc, setFFunc] = useState('todos');
  const [fTipo, setFTipo] = useState('todos');
  const [fStatus, setFStatus] = useState('todos'); // todos | vencido | vencendo | ok | pendente
  const [modal, setModal] = useState<{ open: boolean; doc?: Documento }>({ open: false });

  async function carregar() {
    const { data, error } = await sb.from('rh_documentos').select(SEL_DOC).eq('usuario_id', userId).order('validade', { ascending: true, nullsFirst: false });
    setDocs(error ? [] : (data || []).map(mapDoc));
    setLoading(false);
  }
  useEffect(() => { carregar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [userId]);

  const nomeFunc = (id: number) => equipe.find((e) => e.id === id)?.nome ?? '—';

  const enriquecidos = useMemo(() => docs.map((d) => ({ d, st: statusValidade(d.validade, hoje, d.dias_aviso), dias: diasAteVencer(d.validade, hoje) })), [docs, hoje]);

  const kpis = useMemo(() => ({
    total: docs.length,
    vencidos: enriquecidos.filter((x) => x.st === 'vencido').length,
    vencendo: enriquecidos.filter((x) => x.st === 'critico' || x.st === 'atencao').length,
    pendentes: docs.filter((d) => d.status === 'pendente').length,
  }), [docs, enriquecidos]);

  const filtrados = useMemo(() => enriquecidos.filter(({ d, st }) => {
    if (fFunc !== 'todos' && d.equipe_id !== Number(fFunc)) return false;
    if (fTipo !== 'todos' && d.tipo !== fTipo) return false;
    if (fStatus === 'pendente' && d.status !== 'pendente') return false;
    if (fStatus === 'vencido' && st !== 'vencido') return false;
    if (fStatus === 'vencendo' && !(st === 'critico' || st === 'atencao')) return false;
    if (fStatus === 'ok' && st !== 'ok') return false;
    return true;
  }), [enriquecidos, fFunc, fTipo, fStatus]);

  async function excluir(d: Documento) {
    if (!confirm('Remover este documento?')) return;
    await sb.from('rh_documentos').delete().eq('id', d.id).eq('usuario_id', userId);
    setDocs((arr) => arr.filter((x) => x.id !== d.id));
  }

  if (loading) return <div className="h-[320px] animate-pulse rounded-2xl bg-black/[0.05]" />;

  if (equipe.length === 0) {
    return <EmptyState icon={<IcoFolder />} title="Cadastre funcionários para anexar documentos">Comece em <a href="/painel/rh/funcionarios" className="font-semibold text-brand underline">Funcionários</a>.</EmptyState>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Documentos" value={String(kpis.total)} tone="azul" icon={<IcoFolder />} />
        <Kpi label="Vencidos" value={String(kpis.vencidos)} tone={kpis.vencidos ? 'vermelho' : 'verde'} />
        <Kpi label="Vencendo" value={String(kpis.vencendo)} tone={kpis.vencendo ? 'gold' : 'verde'} hint="ASO/certificações" />
        <Kpi label="Pendentes" value={String(kpis.pendentes)} tone={kpis.pendentes ? 'roxo' : 'cinza'} />
      </div>

      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <select value={fFunc} onChange={(e) => setFFunc(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="todos">Funcionário: Todos</option>{equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
          <select value={fTipo} onChange={(e) => setFTipo(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="todos">Tipo: Todos</option>{TIPOS_DOC.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
          <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none">
            <option value="todos">Validade: Todas</option><option value="vencido">Vencidos</option><option value="vencendo">Vencendo</option><option value="ok">Em dia</option><option value="pendente">Pendentes</option>
          </select>
          <button onClick={() => exportCSV('documentos-rh.csv', ['Funcionario', 'Tipo', 'Nome', 'Validade', 'Status'], filtrados.map(({ d, st }) => [nomeFunc(d.equipe_id), DOC_LABEL[d.tipo] ?? d.tipo, d.nome ?? '', d.validade ?? '', d.status === 'pendente' ? 'pendente' : VAL_LABEL[st]]))} className={btnSecondary}><IcoDownload /> CSV</button>
          <button onClick={() => setModal({ open: true })} className={`${btnPrimary} ml-auto`}><IcoPlus /> Novo documento</button>
        </div>

        {filtrados.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhum documento {docs.length ? 'com esse filtro' : 'cadastrado'}.</p>
        ) : (
          <div className="space-y-2">
            {filtrados.map(({ d, st, dias }) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.06] px-3 py-2.5 text-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: avatarCor(d.equipe_id) }}>{inicial(nomeFunc(d.equipe_id))}</span>
                <div className="min-w-0">
                  <div className="font-semibold text-ink">{nomeFunc(d.equipe_id)}</div>
                  <div className="text-xs text-ink-muted">{DOC_LABEL[d.tipo] ?? d.tipo}{d.nome ? ` · ${d.nome}` : ''}</div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-ink-muted">{d.validade ? formatDate(d.validade, { style: 'short' }) : 'sem validade'}{dias != null && dias >= 0 && st !== 'ok' ? ` · ${dias}d` : ''}</span>
                  {d.status === 'pendente' ? <Chip cls="bg-violet-50 text-violet-700">Pendente</Chip> : <Chip cls={VAL_CLS[st]}>{VAL_LABEL[st]}</Chip>}
                  {d.arquivo_url && <a href={d.arquivo_url} target="_blank" rel="noreferrer" aria-label="Abrir arquivo" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoLink /></a>}
                  <button onClick={() => setModal({ open: true, doc: d })} aria-label="Editar" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                  <button onClick={() => excluir(d)} aria-label="Remover" className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {modal.open && <DocModal userId={userId} equipe={equipe} doc={modal.doc} onClose={() => setModal({ open: false })} onSaved={() => { setModal({ open: false }); carregar(); }} />}
    </div>
  );
}

function DocModal({ userId, equipe, doc, onClose, onSaved }: { userId: string; equipe: Funcionario[]; doc?: Documento; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState({
    equipe_id: doc?.equipe_id ? String(doc.equipe_id) : (equipe[0]?.id ? String(equipe[0].id) : ''),
    tipo: doc?.tipo ?? 'aso', nome: doc?.nome ?? '', arquivo_url: doc?.arquivo_url ?? '',
    validade: doc?.validade ?? '', dias_aviso: doc?.dias_aviso ? String(doc.dias_aviso) : '30', status: doc?.status ?? 'valido', obs: doc?.obs ?? '',
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function salvar() {
    if (!f.equipe_id) { toast.error('Selecione o funcionário.'); return; }
    setSaving(true);
    const payload = {
      equipe_id: Number(f.equipe_id), tipo: f.tipo, nome: f.nome || null, arquivo_url: f.arquivo_url || null,
      validade: f.validade || null, dias_aviso: f.dias_aviso ? Number(f.dias_aviso) : 30, status: f.status, obs: f.obs || null,
    };
    let error;
    if (doc) ({ error } = await sb.from('rh_documentos').update(payload).eq('id', doc.id).eq('usuario_id', userId));
    else ({ error } = await sb.from('rh_documentos').insert({ ...payload, usuario_id: userId }));
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(doc ? 'Documento atualizado.' : 'Documento anexado.');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg" title={doc ? 'Editar documento' : 'Novo documento'}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Funcionário" full><select className={inp} value={f.equipe_id} onChange={set('equipe_id')}>{equipe.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</select></Campo>
        <Campo label="Tipo"><select className={inp} value={f.tipo} onChange={set('tipo')}>{TIPOS_DOC.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}</select></Campo>
        <Campo label="Nome / descrição"><input className={inp} value={f.nome} onChange={set('nome')} placeholder="Ex.: ASO periódico 2026" /></Campo>
        <Campo label="Validade"><input type="date" className={inp} value={f.validade} onChange={set('validade')} /></Campo>
        <Campo label="Alerta (dias antes)"><input type="number" min={0} className={inp} value={f.dias_aviso} onChange={set('dias_aviso')} /></Campo>
        <Campo label="Status"><select className={inp} value={f.status} onChange={set('status')}><option value="valido">Válido</option><option value="pendente">Pendente (aguardando)</option></select></Campo>
        <Campo label="Link do arquivo" full hint="Cole a URL do documento (Storage, Drive…)."><input className={inp} value={f.arquivo_url} onChange={set('arquivo_url')} placeholder="https://" /></Campo>
        <Campo label="Observações" full><textarea className={`${inp} min-h-[56px]`} value={f.obs} onChange={set('obs')} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

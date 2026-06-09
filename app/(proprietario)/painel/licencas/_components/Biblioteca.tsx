'use client';

// Biblioteca de exigências — templates de checklist por tipo/porte de evento.
// Mostra os templates EMBUTIDOS (engine lib/licencas.ts) e permite o dono criar
// versões PRÓPRIAS (compliance_checklists, via RLS), pois as exigências variam
// por município. Esses templates customizados aparecem em "Por evento".

import { useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  type ExigenciaTemplate, type TipoLicenca,
  listarTemplates, TIPOS, tipoMeta, FAIXAS_PUBLICO,
} from '@/lib/licencas';
import { type LicencasCtx, type ChecklistRow } from '../_lib';
import {
  inp, btnPrimary, btnSecondary, btnGhost, Chip, ModalShell, Campo, EmptyState,
  IcoPlus, IcoEdit, IcoTrash, IcoBook, IcoSparkle,
} from './ui';

export default function Biblioteca({ ctx }: { ctx: LicencasCtx }) {
  const toast = useToast();
  const [editor, setEditor] = useState<{ row: ChecklistRow | null } | null>(null);

  const builtin = useMemo(() => listarTemplates(), []);

  const duplicar = (nome: string, itens: ExigenciaTemplate[], tipo_evento: string) => {
    setEditor({ row: { id: '', nome: `${nome} (cópia)`, tipo_evento, itens: itens.map((i) => ({ ...i })) } });
  };

  const excluir = async (row: ChecklistRow) => {
    if (!window.confirm(`Excluir o checklist "${row.nome}"?`)) return;
    const { error } = await sb.from('compliance_checklists').delete().eq('id', row.id);
    if (error) { toast.error('Falha ao excluir.'); return; }
    toast.success('Checklist excluído.');
    await ctx.reloadChecklists();
  };

  return (
    <div className="space-y-6">
      {/* Customizados do dono */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-ink-soft">Meus checklists</h3>
            <p className="text-[0.78rem] text-ink-muted">Versões adaptadas ao seu município/operação — usadas em “Por evento”.</p>
          </div>
          <button onClick={() => setEditor({ row: null })} className={btnPrimary}><IcoPlus /> Novo checklist</button>
        </div>
        {ctx.checklists.length === 0 ? (
          <EmptyState icon={<IcoBook />} title="Nenhum checklist próprio ainda">
            Crie um do zero ou duplique um modelo abaixo para ajustar as exigências do seu município.
          </EmptyState>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {ctx.checklists.map((c) => (
              <ChecklistCard key={c.id} nome={c.nome} subtitulo={c.tipo_evento || 'Personalizado'} itens={c.itens}
                acoes={
                  <>
                    <button onClick={() => setEditor({ row: c })} className={btnGhost}><IcoEdit /> Editar</button>
                    <button onClick={() => excluir(c)} className={`${btnGhost} text-red-600 hover:text-red-700`}><IcoTrash /></button>
                  </>
                } />
            ))}
          </div>
        )}
      </section>

      {/* Embutidos */}
      <section>
        <h3 className="mb-3 text-sm font-bold text-ink-soft">Modelos prontos</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {builtin.map((t) => (
            <ChecklistCard key={t.key} nome={t.nome} subtitulo="Modelo padrão" itens={t.itens}
              acoes={<button onClick={() => duplicar(t.nome, t.itens, t.key)} className={btnGhost}><IcoSparkle /> Duplicar para editar</button>} />
          ))}
        </div>
      </section>

      {editor && (
        <ChecklistEditor
          userId={ctx.userId}
          row={editor.row}
          onClose={() => setEditor(null)}
          onSaved={async () => { await ctx.reloadChecklists(); setEditor(null); }}
        />
      )}
    </div>
  );
}

// ── Cartão de um checklist (lista as exigências como chips) ──────────────────
function ChecklistCard({ nome, subtitulo, itens, acoes }: { nome: string; subtitulo: string; itens: ExigenciaTemplate[]; acoes: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-bold text-ink">{nome}</div>
          <div className="text-[0.72rem] text-ink-muted">{subtitulo} · {itens.length} exigência(s)</div>
        </div>
        <div className="flex shrink-0 items-center gap-1">{acoes}</div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {itens.map((i, idx) => (
          <Chip key={idx} className={i.obrigatorio ? 'bg-brand-50 text-brand' : 'bg-black/[0.04] text-ink-muted'}>
            {i.titulo}{i.publicoMin > 0 && <span className="opacity-60"> ≥{i.publicoMin}</span>}
          </Chip>
        ))}
      </div>
    </div>
  );
}

// ── Editor de checklist customizado ──────────────────────────────────────────
function ChecklistEditor({ userId, row, onClose, onSaved }: { userId: string; row: ChecklistRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [nome, setNome] = useState(row?.nome || '');
  const [tipoEvento, setTipoEvento] = useState(row?.tipo_evento || '');
  const [itens, setItens] = useState<ExigenciaTemplate[]>(row?.itens?.length ? row.itens.map((i) => ({ ...i })) : []);
  const [salvando, setSalvando] = useState(false);

  const novoItem = (): ExigenciaTemplate => {
    const m = tipoMeta('evento_publico');
    return { tipo: 'evento_publico', titulo: m.label, obrigatorio: true, publicoMin: 0, orgao: m.orgao, dias_aviso: m.diasAviso, descricao: '' };
  };
  const addItem = () => setItens((a) => [...a, novoItem()]);
  const setItem = (idx: number, patch: Partial<ExigenciaTemplate>) =>
    setItens((a) => a.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const rmItem = (idx: number) => setItens((a) => a.filter((_, i) => i !== idx));

  const onTipoItem = (idx: number, tipo: TipoLicenca) => {
    const m = tipoMeta(tipo);
    const cur = itens[idx];
    setItem(idx, { tipo, titulo: cur.titulo && cur.titulo !== tipoMeta(cur.tipo).label ? cur.titulo : m.label, orgao: cur.orgao || m.orgao, dias_aviso: cur.dias_aviso || m.diasAviso });
  };

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Dê um nome ao checklist.'); return; }
    if (itens.length === 0) { toast.error('Adicione ao menos uma exigência.'); return; }
    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim(),
        tipo_evento: tipoEvento.trim() || null,
        itens: itens.map((i) => ({
          tipo: i.tipo, titulo: i.titulo.trim() || tipoMeta(i.tipo).label, obrigatorio: !!i.obrigatorio,
          publicoMin: Math.max(0, Number(i.publicoMin) || 0), orgao: i.orgao.trim(),
          dias_aviso: Math.max(0, Number(i.dias_aviso) || 60), descricao: i.descricao.trim(),
        })),
      };
      if (row?.id) {
        const { error } = await sb.from('compliance_checklists').update(payload).eq('id', row.id);
        if (error) throw error;
      } else {
        const { error } = await sb.from('compliance_checklists').insert({ ...payload, usuario_id: userId });
        if (error) throw error;
      }
      toast.success('Checklist salvo.');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-3xl">
      <h3 className="text-lg font-bold text-ink">{row?.id ? 'Editar checklist' : 'Novo checklist'}</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome do checklist">
          <input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Show — Prefeitura de SP" />
        </Campo>
        <Campo label="Tipo de evento" hint="Usado para sugerir este checklist no evento certo.">
          <input className={inp} value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} placeholder="casamento, show, corrida…" />
        </Campo>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-soft">Exigências</span>
          <button onClick={addItem} className={btnGhost}><IcoPlus /> Adicionar</button>
        </div>
        {itens.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/15 p-6 text-center text-sm text-ink-muted">Nenhuma exigência. Clique em “Adicionar”.</div>
        ) : (
          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={idx} className="rounded-xl border border-black/[0.08] bg-black/[0.015] p-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
                  <select className={`${inp} sm:col-span-3`} value={it.tipo} onChange={(e) => onTipoItem(idx, e.target.value as TipoLicenca)}>
                    {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
                  </select>
                  <input className={`${inp} sm:col-span-4`} value={it.titulo} onChange={(e) => setItem(idx, { titulo: e.target.value })} placeholder="Título da exigência" />
                  <select className={`${inp} sm:col-span-3`} value={String(it.publicoMin)} onChange={(e) => setItem(idx, { publicoMin: Number(e.target.value) })}>
                    {FAIXAS_PUBLICO.map((f) => <option key={f.min} value={f.min}>A partir de {f.min === 0 ? 'qualquer público' : f.min}</option>)}
                  </select>
                  <label className="flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-2 text-[0.78rem] font-medium text-ink-soft sm:col-span-2">
                    <input type="checkbox" className="h-3.5 w-3.5 accent-brand" checked={it.obrigatorio} onChange={(e) => setItem(idx, { obrigatorio: e.target.checked })} />
                    Obrig.
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input className={`${inp} flex-1`} value={it.orgao} onChange={(e) => setItem(idx, { orgao: e.target.value })} placeholder="Órgão" />
                  <input type="number" min={0} className={`${inp} w-28`} value={it.dias_aviso} onChange={(e) => setItem(idx, { dias_aviso: Number(e.target.value) })} placeholder="Aviso (dias)" />
                  <button onClick={() => rmItem(idx)} className={`${btnGhost} text-red-600 hover:text-red-700`} aria-label="Remover exigência"><IcoTrash /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={btnPrimary}><IcoSparkle /> {salvando ? 'Salvando…' : 'Salvar checklist'}</button>
      </div>
    </ModalShell>
  );
}

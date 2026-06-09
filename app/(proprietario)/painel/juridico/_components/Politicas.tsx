'use client';

// Aba "Políticas" (LGPD) — dois blocos:
//   • Retenção & descarte: por tipo de dado, define o prazo de retenção (meses a
//     partir de um gatilho), a base legal e a ação ao fim (excluir/anonimizar/
//     arquivar). Vira a régua que orienta o descarte.
//   • Documentos versionados: política de privacidade, termos, cookies… com versão,
//     vigência e publicação — ligando com /painel/configuracoes e as páginas
//     públicas /privacidade e /termos.
// CRUD via RLS. Sem "R$" hardcoded — datas via lib/format.

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type JuridicoBag, type RegraRetencao, type Politica, type BaseLegal, type GatilhoRetencao, type AcaoRetencao, type TipoPolitica,
  BASES_LEGAIS, baseLegalLabel, ACOES_RETENCAO, acaoRetencaoLabel, GATILHOS_RETENCAO, gatilhoRetencaoLabel,
  TIPOS_POLITICA, tipoPoliticaLabel,
  criarRetencao, salvarRetencao, excluirRetencao, criarPolitica, salvarPolitica, excluirPolitica, inp, selCls,
} from '../_lib';
import {
  ModalShell, Campo, EmptyState, Chip, SectionCard,
  IcoLock, IcoArchive, IcoPlus, IcoEdit, IcoTrash, IcoExternal, IcoCheck, IcoPaper, btnPrimary, btnSecondary, btnDanger,
} from './ui';

const SEED_RETENCAO: Partial<RegraRetencao>[] = [
  { tipo_dado: 'Cadastro de cliente', base_legal: 'contrato', prazo_meses: 60, gatilho: 'fim_relacao', acao_apos: 'anonimizar' },
  { tipo_dado: 'Lista de convidados do evento', base_legal: 'consentimento', prazo_meses: 6, gatilho: 'apos_evento', acao_apos: 'excluir' },
  { tipo_dado: 'Documentos fiscais', base_legal: 'obrigacao_legal', prazo_meses: 60, gatilho: 'coleta', acao_apos: 'arquivar' },
  { tipo_dado: 'Currículos / candidaturas', base_legal: 'consentimento', prazo_meses: 12, gatilho: 'coleta', acao_apos: 'excluir' },
];

export default function Politicas({ bag }: { bag: JuridicoBag }) {
  const toast = useToast();
  const [editReg, setEditReg] = useState<RegraRetencao | 'novo' | null>(null);
  const [editPol, setEditPol] = useState<Politica | 'novo' | null>(null);
  const [del, setDel] = useState<{ kind: 'reg' | 'pol'; id: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const porTipo = useMemo(() => {
    const m = new Map<TipoPolitica, Politica[]>();
    for (const p of bag.politicas) {
      const arr = m.get(p.tipo) || [];
      arr.push(p);
      m.set(p.tipo, arr);
    }
    // versão mais recente primeiro (por vigência/criação)
    for (const arr of m.values()) arr.sort((a, b) => (b.vigente_desde || b.criado_em || '').localeCompare(a.vigente_desde || a.criado_em || ''));
    return m;
  }, [bag.politicas]);

  const semearRetencao = async () => {
    setSeeding(true);
    const rows = SEED_RETENCAO.map((s) => ({
      usuario_id: bag.userId, tipo_dado: s.tipo_dado, base_legal: s.base_legal, prazo_meses: s.prazo_meses,
      gatilho: s.gatilho, acao_apos: s.acao_apos,
    }));
    const { error } = await criarRetencaoBulk(rows);
    setSeeding(false);
    if (error) { toast.error('Não foi possível criar a base de retenção.'); return; }
    toast.success('Base de retenção criada. Ajuste conforme o seu município/operação.');
    await bag.reload();
  };

  const onDelete = async () => {
    if (!del) return;
    setBusy(true);
    const { error } = del.kind === 'reg' ? await excluirRetencao(del.id) : await excluirPolitica(del.id);
    setBusy(false); setDel(null);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Excluído.');
    await bag.reload();
  };

  return (
    <div className="space-y-5">
      {/* Bloco 1 — Retenção & descarte */}
      <SectionCard
        title="Retenção & descarte"
        desc="Quanto tempo cada tipo de dado é mantido e o que acontece ao fim do prazo."
        action={<button onClick={() => setEditReg('novo')} className={btnPrimary}><IcoPlus /> Nova regra</button>}
      >
        {bag.retencao.length === 0 ? (
          <div className="rounded-xl border border-dashed border-black/10 p-6 text-center">
            <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-full bg-black/[0.04] text-ink-muted"><IcoArchive /></div>
            <p className="text-sm text-ink-muted">Nenhuma regra de retenção definida.</p>
            <button onClick={semearRetencao} disabled={seeding} className={btnSecondary + ' mt-3'}>
              {seeding ? 'Criando…' : 'Começar com modelo sugerido'}
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs uppercase tracking-wide text-ink-muted">
                  <th className="py-2 pr-3 font-semibold">Tipo de dado</th>
                  <th className="py-2 pr-3 font-semibold">Base legal</th>
                  <th className="py-2 pr-3 font-semibold">Retenção</th>
                  <th className="py-2 pr-3 font-semibold">Ao fim</th>
                  <th className="py-2 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {bag.retencao.map((r) => (
                  <tr key={r.id} className="border-b border-black/[0.04]">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-ink">{r.tipo_dado}</div>
                      {r.responsavel && <div className="text-[0.72rem] text-ink-muted">Resp.: {r.responsavel}</div>}
                    </td>
                    <td className="py-3 pr-3 text-ink-soft">{baseLegalLabel(r.base_legal)}</td>
                    <td className="py-3 pr-3 text-ink-soft">{r.prazo_meses} {r.prazo_meses === 1 ? 'mês' : 'meses'} <span className="text-ink-muted">· {gatilhoRetencaoLabel(r.gatilho).toLowerCase()}</span></td>
                    <td className="py-3 pr-3"><Chip className={acaoChip(r.acao_apos)}>{acaoRetencaoLabel(r.acao_apos)}</Chip></td>
                    <td className="py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => setEditReg(r)} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
                        <button onClick={() => setDel({ kind: 'reg', id: r.id })} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* Bloco 2 — Documentos versionados */}
      <SectionCard
        title="Documentos & políticas versionadas"
        desc="Privacidade, termos e cookies — com versão e vigência. Publique a versão atual nas páginas públicas."
        action={<button onClick={() => setEditPol('novo')} className={btnPrimary}><IcoPlus /> Nova versão</button>}
      >
        {bag.politicas.length === 0 ? (
          <EmptyState icon={<IcoLock />} title="Nenhuma política cadastrada">
            Versione a Política de Privacidade e os Termos de Uso. A versão publicada alimenta as páginas <Link href="/privacidade" className="text-brand hover:underline">/privacidade</Link> e <Link href="/termos" className="text-brand hover:underline">/termos</Link>, e os textos base ficam em <Link href="/painel/configuracoes" className="text-brand hover:underline">Configurações</Link>.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[...porTipo.entries()].map(([tipo, versoes]) => {
              const rotaPublica = TIPOS_POLITICA.find((t) => t.key === tipo)?.rotaPublica;
              const publicada = versoes.find((v) => v.publicada);
              return (
                <div key={tipo} className="rounded-xl border border-black/[0.06] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-ink">{tipoPoliticaLabel(tipo)}</div>
                      <div className="mt-0.5 text-[0.75rem] text-ink-muted">{versoes.length} versão(ões)</div>
                    </div>
                    {rotaPublica && <Link href={rotaPublica} className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline"><IcoExternal /> Página</Link>}
                  </div>
                  <ul className="mt-3 space-y-2">
                    {versoes.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.02] px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-ink">v{v.versao}</span>
                            {v.publicada && <Chip className="bg-emerald-50 text-emerald-700"><IcoCheck /> Publicada</Chip>}
                          </div>
                          <div className="truncate text-[0.72rem] text-ink-muted">{v.vigente_desde ? `Vigente desde ${formatDate(v.vigente_desde, { style: 'short' })}` : v.titulo || 'Sem vigência definida'}</div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {v.url && <a href={v.url} target="_blank" rel="noopener noreferrer" aria-label="Abrir documento" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoPaper /></a>}
                          <button onClick={() => setEditPol(v)} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
                          <button onClick={() => setDel({ kind: 'pol', id: v.id })} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!publicada && <p className="mt-2 text-[0.72rem] text-amber-600">Nenhuma versão publicada.</p>}
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {editReg && <RetencaoModal bag={bag} editando={editReg === 'novo' ? null : editReg} onClose={() => setEditReg(null)} onSaved={async () => { setEditReg(null); await bag.reload(); }} />}
      {editPol && <PoliticaModal bag={bag} editando={editPol === 'novo' ? null : editPol} onClose={() => setEditPol(null)} onSaved={async () => { setEditPol(null); await bag.reload(); }} />}
      {del && (
        <ModalShell onClose={() => setDel(null)} maxW="max-w-sm">
          <h3 className="text-lg font-bold text-ink">Excluir {del.kind === 'reg' ? 'regra de retenção' : 'documento'}?</h3>
          <p className="mt-1 text-sm text-ink-muted">Esta ação não pode ser desfeita.</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setDel(null)} className={btnSecondary + ' flex-1'}>Cancelar</button>
            <button onClick={onDelete} disabled={busy} className={btnDanger + ' flex-1'}><IcoTrash /> Excluir</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}

function acaoChip(a: AcaoRetencao): string {
  return a === 'excluir' ? 'bg-red-50 text-red-700' : a === 'anonimizar' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700';
}

// Inserção em lote do modelo de retenção (via supabase client — RLS).
async function criarRetencaoBulk(rows: Record<string, unknown>[]) {
  const { supabaseAny } = await import('@/lib/supabase');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabaseAny as any).from('lgpd_retencao').insert(rows);
}

function RetencaoModal({ bag, editando, onClose, onSaved }: { bag: JuridicoBag; editando: RegraRetencao | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<RegraRetencao>(() => editando || {
    id: '', tipo_dado: '', base_legal: 'obrigacao_legal', prazo_meses: 12, gatilho: 'coleta', acao_apos: 'anonimizar', responsavel: '', obs: '',
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<RegraRetencao>) => setF((v) => ({ ...v, ...patch }));

  const salvar = async () => {
    if (!f.tipo_dado.trim()) { toast.error('Informe o tipo de dado.'); return; }
    setBusy(true);
    const row = {
      usuario_id: bag.userId, tipo_dado: f.tipo_dado, base_legal: f.base_legal, prazo_meses: Number(f.prazo_meses) || 12,
      gatilho: f.gatilho, acao_apos: f.acao_apos, responsavel: f.responsavel || null, obs: f.obs || null,
    };
    const { error } = editando ? await salvarRetencao(editando.id, row) : await criarRetencao(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(editando ? 'Regra atualizada.' : 'Regra criada.');
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="text-lg font-bold text-ink">{editando ? 'Editar regra de retenção' : 'Nova regra de retenção'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo label="Tipo de dado" full>
          <input value={f.tipo_dado} onChange={(e) => set({ tipo_dado: e.target.value })} placeholder="Ex.: Lista de convidados do evento" className={inp} />
        </Campo>
        <Campo label="Base legal">
          <select value={f.base_legal} onChange={(e) => set({ base_legal: e.target.value as BaseLegal })} className={selCls}>
            {BASES_LEGAIS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
          </select>
        </Campo>
        <Campo label="Ação ao fim do prazo">
          <select value={f.acao_apos} onChange={(e) => set({ acao_apos: e.target.value as AcaoRetencao })} className={selCls}>
            {ACOES_RETENCAO.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </Campo>
        <Campo label="Prazo de retenção (meses)">
          <input type="number" min={1} value={f.prazo_meses} onChange={(e) => set({ prazo_meses: Number(e.target.value) })} className={inp} />
        </Campo>
        <Campo label="Contado a partir de">
          <select value={f.gatilho} onChange={(e) => set({ gatilho: e.target.value as GatilhoRetencao })} className={selCls}>
            {GATILHOS_RETENCAO.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>
        </Campo>
        <Campo label="Responsável">
          <input value={f.responsavel || ''} onChange={(e) => set({ responsavel: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Observações" full>
          <textarea value={f.obs || ''} onChange={(e) => set({ obs: e.target.value })} rows={2} className={inp} />
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

function PoliticaModal({ bag, editando, onClose, onSaved }: { bag: JuridicoBag; editando: Politica | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Politica>(() => editando || {
    id: '', tipo: 'privacidade', versao: '1.0', titulo: '', resumo: '', url: '', conteudo: '', vigente_desde: null, publicada: false,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Politica>) => setF((v) => ({ ...v, ...patch }));

  const salvar = async () => {
    if (!f.versao.trim()) { toast.error('Informe a versão.'); return; }
    setBusy(true);
    const row = {
      usuario_id: bag.userId, tipo: f.tipo, versao: f.versao, titulo: f.titulo || null, resumo: f.resumo || null,
      url: f.url || null, conteudo: f.conteudo || null, vigente_desde: f.vigente_desde || null, publicada: f.publicada,
    };
    // Garante "uma publicada por tipo": ao publicar esta, despublica as demais do mesmo tipo.
    if (f.publicada) {
      const outras = bag.politicas.filter((p) => p.tipo === f.tipo && p.publicada && p.id !== editando?.id);
      for (const o of outras) await salvarPolitica(o.id, { publicada: false });
    }
    const { error } = editando ? await salvarPolitica(editando.id, row) : await criarPolitica(row);
    setBusy(false);
    if (error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(editando ? 'Documento atualizado.' : 'Versão criada.');
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="text-lg font-bold text-ink">{editando ? 'Editar documento' : 'Nova versão de documento'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo label="Tipo de documento">
          <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value as TipoPolitica })} className={selCls}>
            {TIPOS_POLITICA.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Versão">
          <input value={f.versao} onChange={(e) => set({ versao: e.target.value })} placeholder="Ex.: 1.0" className={inp} />
        </Campo>
        <Campo label="Título" full>
          <input value={f.titulo || ''} onChange={(e) => set({ titulo: e.target.value })} className={inp} />
        </Campo>
        <Campo label="O que mudou (resumo)" full>
          <textarea value={f.resumo || ''} onChange={(e) => set({ resumo: e.target.value })} rows={2} className={inp} />
        </Campo>
        <Campo label="Vigente desde">
          <input type="date" value={f.vigente_desde || ''} onChange={(e) => set({ vigente_desde: e.target.value || null })} className={inp} />
        </Campo>
        <Campo label="Link do documento">
          <input value={f.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://…" className={inp} />
        </Campo>
        <label className="flex items-center gap-2 sm:col-span-2">
          <input type="checkbox" checked={f.publicada} onChange={(e) => set({ publicada: e.target.checked })} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
          <span className="text-sm text-ink-soft">Publicar esta versão (torna-se a vigente do tipo nas páginas públicas)</span>
        </label>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

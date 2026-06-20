'use client';

// Aba Equipe & Permissões — convide membros e atribua papel + permissões por
// módulo (RBAC). Tabela usuarios_papeis (migration empresa-config-rbac.sql).
// O modelo de papéis/níveis vem de lib/rbac e é reutilizado pelo gate e pela API.

import { useCallback, useEffect, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { validarEmail } from '@/lib/masks';
import { MODULOS, PAPEIS, NIVEIS, defaultPerms, papelLabel, type Papel, type Permissoes, type Nivel } from '@/lib/rbac';
import { Section, Campo, Toggle, inp } from './ui';

type Membro = {
  id: string; nome: string; email: string | null; papel: Papel;
  permissoes: Permissoes; requer_2fa: boolean; status: string;
};

const STATUS_MAP: Record<string, { label: string; c: string }> = {
  convidado: { label: 'Convidado', c: 'bg-amber-50 text-amber-700' },
  ativo: { label: 'Ativo', c: 'bg-emerald-50 text-emerald-700' },
  suspenso: { label: 'Suspenso', c: 'bg-red-50 text-red-700' },
};

type FormState = { nome: string; email: string; papel: Papel; status: string; requer_2fa: boolean; permissoes: Permissoes };
const novoForm = (): FormState => ({ nome: '', email: '', papel: 'leitura', status: 'convidado', requer_2fa: false, permissoes: defaultPerms('leitura') });

export default function TabEquipe({ userId }: { userId: string }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [membros, setMembros] = useState<Membro[]>([]);

  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(novoForm());
  const [showMatrix, setShowMatrix] = useState(false);
  const [saving, setSaving] = useState(false);

  const carregar = useCallback(async () => {
    const { data, error } = await sb.from('usuarios_papeis').select('*').eq('usuario_id', userId).order('nome');
    if (error) { setNeedsSetup(true); setMembros([]); return; }
    setNeedsSetup(false);
    setMembros((data || []).map((m) => ({ ...m, papel: m.papel as Papel, permissoes: (m.permissoes || {}) as Permissoes })));
  }, [userId]);

  useEffect(() => { (async () => { await carregar(); setLoading(false); })(); }, [carregar]);

  function abrirNovo() { setEditId(null); setForm(novoForm()); setShowMatrix(false); setModal(true); }
  function abrirEdit(m: Membro) {
    setEditId(m.id);
    setForm({ nome: m.nome, email: m.email || '', papel: m.papel, status: m.status, requer_2fa: m.requer_2fa, permissoes: { ...defaultPerms(m.papel), ...m.permissoes } });
    setShowMatrix(false); setModal(true);
  }
  function trocarPapel(papel: Papel) { setForm((f) => ({ ...f, papel, permissoes: defaultPerms(papel) })); }
  function setNivel(modulo: string, nivel: Nivel) { setForm((f) => ({ ...f, permissoes: { ...f.permissoes, [modulo]: nivel } })); }

  async function salvar() {
    if (!form.nome.trim()) { toast.error('Informe o nome do membro.'); return; }
    if (form.email && !validarEmail(form.email)) { toast.error('E-mail inválido.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId, nome: form.nome.trim(), email: form.email.trim() || null,
      papel: form.papel, permissoes: form.permissoes, requer_2fa: form.requer_2fa, status: form.status,
      atualizado_em: new Date().toISOString(),
    };
    let error;
    if (editId) ({ error } = await sb.from('usuarios_papeis').update(payload).eq('id', editId).eq('usuario_id', userId));
    else ({ error } = await sb.from('usuarios_papeis').insert(payload));
    setSaving(false);
    if (error) { toast.error('Erro ao salvar o membro.'); return; }
    toast.success(editId ? 'Membro atualizado.' : 'Membro convidado.');
    setModal(false); await carregar();
  }

  async function excluir(m: Membro) {
    if (!confirm(`Remover ${m.nome} da equipe?`)) return;
    await sb.from('usuarios_papeis').delete().eq('id', m.id).eq('usuario_id', userId);
    setMembros((arr) => arr.filter((x) => x.id !== m.id));
    toast.success('Membro removido.');
  }

  if (loading) return <div className="h-72 animate-pulse rounded-2xl bg-black/[0.05]" />;

  const grupos = Array.from(new Set(MODULOS.map((m) => m.grupo)));

  return (
    <div className="space-y-5">
      <Section
        title="Membros & permissões"
        desc="Cada membro recebe um papel; ajuste o acesso por módulo quando precisar."
        action={<button onClick={abrirNovo} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600">+ Convidar membro</button>}
      >
        {needsSetup ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            A tabela <code>usuarios_papeis</code> ainda não existe. Rode a migration <code>docs/sql/empresa-config-rbac.sql</code> no Supabase.
          </div>
        ) : membros.length === 0 ? (
          <div className="rounded-xl bg-black/[0.03] px-4 py-8 text-center text-sm text-ink-muted">
            Nenhum membro ainda. Use <strong>+ Convidar membro</strong> para definir papéis e permissões.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2.5 font-semibold">Membro</th>
                  <th className="pb-2.5 font-semibold">Papel</th>
                  <th className="pb-2.5 font-semibold">2FA</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                  <th className="pb-2.5" />
                </tr>
              </thead>
              <tbody>
                {membros.map((m) => {
                  const st = STATUS_MAP[m.status] ?? STATUS_MAP.convidado;
                  return (
                    <tr key={m.id} className="border-b border-black/[0.04]">
                      <td className="py-3">
                        <div className="font-semibold text-ink">{m.nome}</div>
                        {m.email && <div className="text-xs text-ink-muted">{m.email}</div>}
                      </td>
                      <td className="py-3"><span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand">{papelLabel(m.papel)}</span></td>
                      <td className="py-3 text-ink-soft">{m.requer_2fa ? 'Obrigatório' : '—'}</td>
                      <td className="py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${st.c}`}>{st.label}</span></td>
                      <td className="py-3 text-right">
                        <button onClick={() => abrirEdit(m)} className="font-semibold text-ink-soft hover:text-brand">Editar</button>
                        <span className="px-2 text-black/15">|</span>
                        <button onClick={() => excluir(m)} className="font-semibold text-red-600 hover:text-red-700">Excluir</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <div className="rounded-xl border border-black/[0.06] bg-white px-4 py-3 text-xs text-ink-muted">
        Os papéis e níveis (Sem acesso · Visualizar · Editar · Total) são aplicados pelo controle de acesso do painel e verificados nas rotas de API. O dono da conta sempre tem acesso total.
      </div>

      {modal && (
        <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="relative my-8 w-full max-w-2xl rounded-2xl bg-white p-6 shadow-pop">
            <button onClick={() => setModal(false)} className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
            <h3 className="mb-5 font-display text-xl font-bold text-ink">{editId ? 'Editar membro' : 'Convidar membro'}</h3>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Campo label="Nome"><input className={inp} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} autoFocus /></Campo>
              <Campo label="E-mail"><input className={inp} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Campo>
              <Campo label="Papel">
                <select className={inp} value={form.papel} onChange={(e) => trocarPapel(e.target.value as Papel)}>
                  {PAPEIS.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </Campo>
              <Campo label="Status">
                <select className={inp} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option value="convidado">Convidado</option>
                  <option value="ativo">Ativo</option>
                  <option value="suspenso">Suspenso</option>
                </select>
              </Campo>
            </div>

            <p className="mt-2 text-xs text-ink-muted">{PAPEIS.find((p) => p.v === form.papel)?.desc}</p>

            <div className="mt-3"><Toggle label="Exigir 2FA para este membro" checked={form.requer_2fa} onChange={(v) => setForm({ ...form, requer_2fa: v })} /></div>

            <button onClick={() => setShowMatrix((s) => !s)} className="mt-4 text-sm font-semibold text-brand">
              {showMatrix ? '▾ Ocultar permissões por módulo' : '▸ Ajustar permissões por módulo'}
            </button>

            {showMatrix && (
              <div className="mt-3 max-h-72 space-y-4 overflow-y-auto rounded-xl border border-black/[0.06] p-4">
                {grupos.map((g) => (
                  <div key={g}>
                    <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{g}</div>
                    <div className="space-y-1.5">
                      {MODULOS.filter((m) => m.grupo === g).map((mod) => (
                        <div key={mod.key} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-ink-soft">{mod.label}</span>
                          <select
                            value={form.permissoes[mod.key] ?? 'nenhum'}
                            onChange={(e) => setNivel(mod.key, e.target.value as Nivel)}
                            className="w-32 rounded-lg border border-black/10 px-2 py-1.5 text-sm focus:border-brand focus:outline-none"
                          >
                            {NIVEIS.map((n) => <option key={n.v} value={n.v}>{n.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex items-center gap-3">
              <button onClick={salvar} disabled={saving || !form.nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar'}</button>
              <button onClick={() => setModal(false)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

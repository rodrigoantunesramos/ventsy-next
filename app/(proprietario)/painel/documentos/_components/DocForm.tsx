'use client';

// Formulário completo de documento (criação e edição).
// Seções: identificação, validade+aviso, arquivo (upload), renovação online,
// atendimento presencial e observações.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  CATS, EMPTY_FORM, type DocForm as FormShape, formToPayload, statusDe, diasRestantes,
  diasLabel, STATUS_META, uploadArquivo, removeArquivo, formatBytes, isImagem, isPdf, dataAviso,
} from '../_lib';
import { CatIcon } from './CatIcon';

type ArquivoAtual = { url: string; nome: string | null; tipo: string | null; tamanho: number | null } | null;

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export function DocForm({
  initialForm,
  docId,
  arquivoAtual,
}: {
  initialForm?: FormShape;
  docId?: number;
  arquivoAtual?: ArquivoAtual;
}) {
  const router = useRouter();
  const toast = useToast();

  const [uid, setUid] = useState<string | null>(null);
  const [form, setForm] = useState<FormShape>(
    initialForm ?? { ...EMPTY_FORM, emissao: new Date().toISOString().split('T')[0] },
  );
  const [file, setFile] = useState<File | null>(null);
  const [removeAtual, setRemoveAtual] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showSenha, setShowSenha] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      setUid(session?.user.id ?? null);
    })();
  }, []);

  const set = <K extends keyof FormShape>(k: K, v: FormShape[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Preview de status com base nas datas digitadas.
  const preview = useMemo(() => {
    const venc = form.vencimento || null;
    const s = statusDe(venc, form.dias_aviso);
    return { status: s, dias: diasRestantes(venc), meta: STATUS_META[s], aviso: dataAviso(venc, form.dias_aviso) };
  }, [form.vencimento, form.dias_aviso]);

  const arquivoVisivel = file ? { nome: file.name, tipo: file.type, tamanho: file.size }
    : (!removeAtual && arquivoAtual?.url) ? { nome: arquivoAtual.nome, tipo: arquivoAtual.tipo, tamanho: arquivoAtual.tamanho }
    : null;

  function escolherArquivo(f: File | null) {
    if (!f) return;
    if (f.size > 25 * 1024 * 1024) { toast.error('Arquivo muito grande (máx. 25 MB).'); return; }
    setFile(f);
    setRemoveAtual(false);
  }

  async function salvar() {
    if (!uid) { toast.error('Sessão expirada. Faça login novamente.'); return; }
    if (!form.nome.trim()) { toast.error('Informe o nome do documento.'); return; }
    setSaving(true);
    try {
      let arquivoFields: Record<string, unknown> = {};
      if (file) {
        const up = await uploadArquivo(uid, file);
        arquivoFields = { arquivo_url: up.arquivo_url, arquivo_nome: up.arquivo_nome, arquivo_tipo: up.arquivo_tipo, arquivo_tamanho: up.arquivo_tamanho };
        if (docId && arquivoAtual?.url) await removeArquivo(arquivoAtual.url);
      } else if (removeAtual && arquivoAtual?.url) {
        await removeArquivo(arquivoAtual.url);
        arquivoFields = { arquivo_url: null, arquivo_nome: null, arquivo_tipo: null, arquivo_tamanho: null };
      }

      const payload = { ...formToPayload(form), ...arquivoFields };
      let savedId = docId;
      if (docId) {
        const { error } = await sb.from('documentos').update(payload).eq('id', docId).eq('usuario_id', uid);
        if (error) throw error;
      } else {
        const { data, error } = await sb.from('documentos').insert({ ...payload, usuario_id: uid }).select('id').single();
        if (error) throw error;
        savedId = data?.id;
      }
      toast.success(docId ? 'Documento atualizado!' : 'Documento adicionado!');
      router.push(`/painel/documentos/${savedId}`);
    } catch {
      toast.error('Erro ao salvar. Tente novamente.');
      setSaving(false);
    }
  }

  const cat = CATS.find((c) => c.v === form.categoria) || CATS[CATS.length - 1];

  return (
    <>
      <div className="space-y-5">
        {/* ── Identificação ── */}
        <Section title="Identificação" icon={<CatIcon catV={form.categoria} color={cat.color} />}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Nome do documento" full required>
              <input value={form.nome} onChange={(e) => set('nome', e.target.value)} className={inp} placeholder="Ex: Alvará de Funcionamento" autoFocus />
            </Campo>
            <Campo label="Categoria">
              <select value={form.categoria} onChange={(e) => set('categoria', e.target.value)} className={inp}>
                {CATS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </select>
            </Campo>
            <Campo label="Órgão emissor">
              <input value={form.orgao} onChange={(e) => set('orgao', e.target.value)} className={inp} placeholder="Ex: Prefeitura Municipal" />
            </Campo>
            <Campo label="Número / protocolo" full>
              <input value={form.numero} onChange={(e) => set('numero', e.target.value)} className={inp} placeholder="Ex: ALV-2025-00991" />
            </Campo>
          </div>
        </Section>

        {/* ── Validade ── */}
        <Section title="Validade e avisos" icon={<svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={1.8} className="h-5 w-5"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Data de emissão">
              <input type="date" value={form.emissao} onChange={(e) => set('emissao', e.target.value)} className={inp} />
            </Campo>
            <Campo label="Data de vencimento">
              <input type="date" value={form.vencimento} onChange={(e) => set('vencimento', e.target.value)} className={inp} />
            </Campo>
            <Campo label="Avisar com antecedência de" full>
              <div className="flex flex-wrap items-center gap-2">
                {[30, 60, 90, 120].map((d) => (
                  <button
                    key={d} type="button" onClick={() => set('dias_aviso', d)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${form.dias_aviso === d ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-muted hover:border-brand/40'}`}
                  >{d} dias</button>
                ))}
                <div className="flex items-center gap-1.5">
                  <input type="number" min={1} value={form.dias_aviso} onChange={(e) => set('dias_aviso', Number(e.target.value))} className={`${inp} w-20`} />
                  <span className="text-xs text-ink-muted">dias antes</span>
                </div>
              </div>
            </Campo>
          </div>
          {form.vencimento && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.015] px-4 py-3">
              <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${preview.meta.bgCls}`}>{preview.meta.label}</span>
              <span className="text-sm font-medium" style={{ color: preview.meta.color }}>{diasLabel(preview.dias)}</span>
              {preview.aviso && preview.status !== 'vencido' && (
                <span className="ml-auto text-xs text-ink-muted">Aviso a partir de {new Date(preview.aviso + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
              )}
            </div>
          )}
        </Section>

        {/* ── Arquivo ── */}
        <Section title="Arquivo do documento" icon={<svg viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth={1.8} className="h-5 w-5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>}>
          {arquivoVisivel ? (
            <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand">
                {isImagem(arquivoVisivel.tipo) ? '🖼️' : isPdf(arquivoVisivel.tipo) ? '📄' : '📎'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-ink">{arquivoVisivel.nome}</div>
                <div className="text-xs text-ink-muted">{formatBytes(arquivoVisivel.tamanho ?? null)}{file ? ' • novo' : ''}</div>
              </div>
              <button
                type="button"
                onClick={() => { setFile(null); setRemoveAtual(true); if (fileRef.current) fileRef.current.value = ''; }}
                className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              >Remover</button>
            </div>
          ) : (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); escolherArquivo(e.dataTransfer.files?.[0] ?? null); }}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition ${dragging ? 'border-brand bg-brand-50' : 'border-black/15 hover:border-brand/40 hover:bg-black/[0.01]'}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} className="h-9 w-9 text-black/25"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
              <p className="mt-2 text-sm font-semibold text-ink-soft">Arraste o arquivo ou clique para enviar</p>
              <p className="mt-0.5 text-xs text-ink-muted">PDF, JPG ou PNG • até 25 MB</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)} />
        </Section>

        {/* ── Renovação online ── */}
        <Section title="Como renovar (online)" icon={<svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={1.8} className="h-5 w-5"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></svg>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Link para renovar / emitir" full>
              <input value={form.link_renovacao} onChange={(e) => set('link_renovacao', e.target.value)} className={inp} placeholder="https://..." />
            </Campo>
            <Campo label="Login do portal">
              <input value={form.login_portal} onChange={(e) => set('login_portal', e.target.value)} className={inp} placeholder="usuário ou e-mail" autoComplete="off" />
            </Campo>
            <Campo label="Senha do portal">
              <div className="relative">
                <input type={showSenha ? 'text' : 'password'} value={form.senha_portal} onChange={(e) => set('senha_portal', e.target.value)} className={`${inp} pr-12`} placeholder="••••••••" autoComplete="new-password" />
                <button type="button" onClick={() => setShowSenha((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-muted hover:text-ink">
                  {showSenha ? 'ocultar' : 'mostrar'}
                </button>
              </div>
            </Campo>
            <Campo label="Passo a passo online" full>
              <textarea value={form.passo_online} onChange={(e) => set('passo_online', e.target.value)} className={`${inp} min-h-[120px] resize-y`} placeholder={'1. Acesse o portal...\n2. Faça login...\n3. Solicite a renovação...'} />
            </Campo>
          </div>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-ink-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3.5 w-3.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            As credenciais ficam visíveis só para você (protegidas por RLS).
          </p>
        </Section>

        {/* ── Presencial ── */}
        <Section title="Atendimento presencial" icon={<svg viewBox="0 0 24 24" fill="none" stroke="#ff385c" strokeWidth={1.8} className="h-5 w-5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" /></svg>}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Campo label="Endereço do órgão" full>
              <input value={form.endereco_orgao} onChange={(e) => set('endereco_orgao', e.target.value)} className={inp} placeholder="Rua, número, bairro, cidade" />
            </Campo>
            <Campo label="Telefone">
              <input value={form.telefone_orgao} onChange={(e) => set('telefone_orgao', e.target.value)} className={inp} placeholder="(00) 0000-0000" />
            </Campo>
            <Campo label="Horário de atendimento">
              <input value={form.horario_orgao} onChange={(e) => set('horario_orgao', e.target.value)} className={inp} placeholder="Seg a Sex, 8h às 17h" />
            </Campo>
            <Campo label="Passo a passo presencial" full>
              <textarea value={form.passo_presencial} onChange={(e) => set('passo_presencial', e.target.value)} className={`${inp} min-h-[100px] resize-y`} placeholder={'1. Leve os documentos...\n2. Retire a senha...\n3. Protocole o pedido...'} />
            </Campo>
          </div>
        </Section>

        {/* ── Observações ── */}
        <Section title="Observações" icon={<svg viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth={1.8} className="h-5 w-5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" /></svg>}>
          <textarea value={form.obs} onChange={(e) => set('obs', e.target.value)} className={`${inp} min-h-[80px] resize-y`} placeholder="Notas livres, lembretes de renovação, contatos…" />
        </Section>
      </div>

      {/* Footer fixo */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/90 backdrop-blur-sm lg:left-[var(--sidebar-w,0px)]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-0">
          <button onClick={salvar} disabled={saving || !form.nome.trim()} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando…' : docId ? 'Salvar alterações' : 'Adicionar documento'}
          </button>
          <button onClick={() => router.back()} className="text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
        </div>
      </div>
    </>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center gap-2.5">
        {icon}
        <h2 className="text-sm font-bold text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Campo({ label, children, full, required }: { label: string; children: React.ReactNode; full?: boolean; required?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
        {label}{required && <span className="ml-0.5 text-brand">*</span>}
      </span>
      {children}
    </label>
  );
}

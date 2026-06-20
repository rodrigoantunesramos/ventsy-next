'use client';

// Página dedicada de um documento (/painel/documentos/[id]).
// View premium: hero de status, visualizador de arquivo, informações,
// guia de renovação (online + presencial) com credenciais, e observações.

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Doc, CAT_BY_V, STATUS_META, statusDe, diasRestantes, diasLabel, validadePct,
  dataAviso, formatBytes, signedUrl, removeArquivo, isImagem, isPdf, revealSenha,
} from '../_lib';
import { CatIcon } from '../_components/CatIcon';

export default function DocDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [senhaRevelada, setSenhaRevelada] = useState<string | null>(null);
  const [revelando, setRevelando] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const carregar = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setLoading(false); return; }
    setUid(session.user.id);
    const { data } = await sb.from('documentos').select('*').eq('id', id).eq('usuario_id', session.user.id).single();
    setDoc((data as Doc) || null);
    if (data?.arquivo_url) setFileUrl(await signedUrl(data.arquivo_url));
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function excluir() {
    if (!doc || !uid) return;
    setDeleting(true);
    if (doc.arquivo_url) await removeArquivo(doc.arquivo_url);
    await sb.from('documentos').delete().eq('id', doc.id).eq('usuario_id', uid);
    toast.success('Documento excluído.');
    router.push('/painel/documentos');
  }

  function copiar(texto: string | null, label: string) {
    if (!texto) return;
    navigator.clipboard?.writeText(texto).then(() => toast.success(`${label} copiado`));
  }

  async function revelar(): Promise<string> {
    if (!doc) return '';
    setRevelando(true);
    try {
      const v = await revealSenha(doc.id);
      setSenhaRevelada(v);
      return v;
    } catch {
      toast.error('Não foi possível revelar a senha.');
      return '';
    } finally {
      setRevelando(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-black/[0.05]" />
        <div className="h-48 animate-pulse rounded-2xl bg-black/[0.05]" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-64 animate-pulse rounded-2xl bg-black/[0.05] lg:col-span-2" />
          <div className="h-64 animate-pulse rounded-2xl bg-black/[0.05]" />
        </div>
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-12 text-center shadow-card">
        <div className="text-4xl">🔍</div>
        <h2 className="mt-3 font-bold text-ink">Documento não encontrado</h2>
        <p className="mt-1 text-sm text-ink-muted">Ele pode ter sido removido ou não pertence à sua conta.</p>
        <Link href="/painel/documentos" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          Voltar para documentos
        </Link>
      </div>
    );
  }

  const cat = CAT_BY_V[doc.categoria] || CAT_BY_V.outros;
  const status = statusDe(doc.vencimento, doc.dias_aviso);
  const meta = STATUS_META[status];
  const dias = diasRestantes(doc.vencimento);
  const pct = validadePct(doc.emissao, doc.vencimento);
  const aviso = dataAviso(doc.vencimento, doc.dias_aviso);
  const isUrgente = status === 'vencido' || status === 'avencer';
  const temRenovacao = doc.link_renovacao || doc.login_portal || doc.senha_portal || doc.passo_online;
  const temPresencial = doc.endereco_orgao || doc.telefone_orgao || doc.horario_orgao || doc.passo_presencial;

  return (
    <div className="mx-auto max-w-5xl">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/painel/documentos" className="flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition hover:text-ink">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
          Documentos
        </Link>
        <div className="flex items-center gap-2">
          <Link href={`/painel/documentos/${doc.id}/editar`} className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-ink-soft transition hover:text-ink">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Editar
          </Link>
          <button onClick={() => setConfirmDel(true)} className="flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
            Excluir
          </button>
        </div>
      </div>

      {/* Hero status */}
      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-card">
        <div className="h-1.5" style={{ background: meta.color }} />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl" style={{ background: cat.bg }}>
              <CatIcon catV={doc.categoria} color={cat.color} className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-bold leading-tight text-ink sm:text-2xl">{doc.nome}</h1>
              <p className="mt-0.5 text-sm text-ink-muted">
                {cat.label}{doc.orgao ? ` · ${doc.orgao}` : ''}
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${meta.bgCls}`}>{meta.label}</span>
          </div>

          {doc.vencimento ? (
            <>
              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <div className="text-2xl font-bold" style={{ color: meta.color }}>{diasLabel(dias)}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">
                    Emitido {doc.emissao ? formatDate(doc.emissao, { style: 'short' }) : '—'} · Vence {formatDate(doc.vencimento, { style: 'short' })}
                  </div>
                </div>
                <div className="text-right text-xs text-ink-muted">{Math.round(pct)}% restante</div>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/[0.06]">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: meta.color }} />
              </div>
            </>
          ) : (
            <div className="mt-5 flex items-center gap-2 text-sm text-ink-muted">
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Permanente</span>
              Este documento não tem data de vencimento.
            </div>
          )}

          {/* Warning banner */}
          {isUrgente && (
            <div className={`mt-4 flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm ${status === 'vencido' ? 'border-red-200 bg-red-50 text-red-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <span className="text-base leading-none">⚠️</span>
              <div className="flex-1">
                {status === 'vencido'
                  ? <><strong>Documento vencido.</strong> Providencie a regularização o quanto antes — operar com documento vencido pode gerar multas e interdição.</>
                  : <><strong>Vencimento se aproximando.</strong> Você pediu para ser avisado {doc.dias_aviso} dias antes{aviso ? ` (desde ${new Date(aviso + 'T00:00:00').toLocaleDateString('pt-BR')})` : ''}. Renove com antecedência.</>}
              </div>
              {temRenovacao && doc.link_renovacao && (
                <a href={normalizeUrl(doc.link_renovacao)} target="_blank" rel="noopener noreferrer" className="shrink-0 rounded-lg bg-white/70 px-3 py-1 text-xs font-bold underline-offset-2 hover:underline">
                  Renovar →
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-4 lg:col-span-2">
          {/* Arquivo */}
          <Card title="Arquivo do documento">
            {doc.arquivo_url ? (
              <div>
                <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] bg-black/[0.015] px-4 py-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-lg">
                    {isImagem(doc.arquivo_tipo) ? '🖼️' : isPdf(doc.arquivo_tipo) ? '📄' : '📎'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{doc.arquivo_nome || 'Arquivo'}</div>
                    <div className="text-xs text-ink-muted">{formatBytes(doc.arquivo_tamanho)}</div>
                  </div>
                  {fileUrl && (
                    <a href={fileUrl} target="_blank" rel="noopener noreferrer" download={doc.arquivo_nome || true} className="shrink-0 rounded-lg bg-brand px-3.5 py-2 text-xs font-bold text-white hover:bg-brand-600">
                      Baixar
                    </a>
                  )}
                </div>
                {/* Preview inline */}
                {fileUrl && isImagem(doc.arquivo_tipo) && (
                  <img src={fileUrl} alt={doc.arquivo_nome || 'Documento'} className="mt-3 max-h-[480px] w-full rounded-xl border border-black/[0.06] object-contain" />
                )}
                {fileUrl && isPdf(doc.arquivo_tipo) && (
                  <iframe src={fileUrl} title={doc.arquivo_nome || 'Documento'} className="mt-3 h-[560px] w-full rounded-xl border border-black/[0.06]" />
                )}
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-black/15 px-6 py-8 text-center">
                <p className="text-sm text-ink-muted">Nenhum arquivo anexado.</p>
                <Link href={`/painel/documentos/${doc.id}/editar`} className="mt-3 inline-block rounded-lg border border-black/10 px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink">
                  Anexar arquivo
                </Link>
              </div>
            )}
          </Card>

          {/* Como renovar — online */}
          {temRenovacao && (
            <Card title="Como renovar — online">
              {doc.link_renovacao && (
                <a href={normalizeUrl(doc.link_renovacao)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-between gap-3 rounded-xl border border-brand/20 bg-brand-50 px-4 py-3 text-sm font-semibold text-brand transition hover:bg-brand-100">
                  <span className="flex items-center gap-2">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></svg>
                    Abrir portal de renovação
                  </span>
                  <span>→</span>
                </a>
              )}
              {(doc.login_portal || doc.senha_portal) && (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {doc.login_portal && <Credencial label="Login" valor={doc.login_portal} onCopy={() => copiar(doc.login_portal, 'Login')} />}
                  {doc.senha_portal && (
                    <Credencial
                      label="Senha"
                      valor={senhaRevelada ?? '••••••••'}
                      onCopy={async () => { const v = senhaRevelada ?? await revelar(); if (v) copiar(v, 'Senha'); }}
                      extra={
                        <button
                          onClick={async () => { if (senhaRevelada != null) setSenhaRevelada(null); else await revelar(); }}
                          className="text-xs font-semibold text-ink-muted hover:text-ink"
                        >
                          {revelando ? '…' : senhaRevelada != null ? 'ocultar' : 'mostrar'}
                        </button>
                      }
                    />
                  )}
                </div>
              )}
              {doc.passo_online && <Passos texto={doc.passo_online} />}
            </Card>
          )}

          {/* Atendimento presencial */}
          {temPresencial && (
            <Card title="Atendimento presencial">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {doc.endereco_orgao && <InfoLinha icon="📍" label="Endereço" valor={doc.endereco_orgao} mapa />}
                {doc.telefone_orgao && <InfoLinha icon="📞" label="Telefone" valor={doc.telefone_orgao} />}
                {doc.horario_orgao && <InfoLinha icon="🕐" label="Horário" valor={doc.horario_orgao} />}
              </div>
              {doc.passo_presencial && <Passos texto={doc.passo_presencial} />}
            </Card>
          )}

          {/* Observações */}
          {doc.obs && (
            <Card title="Observações">
              <p className="whitespace-pre-line text-sm text-ink-soft">{doc.obs}</p>
            </Card>
          )}

          {!temRenovacao && !temPresencial && (
            <Card title="Guia de renovação">
              <div className="rounded-xl border-2 border-dashed border-black/15 px-6 py-8 text-center">
                <p className="text-sm text-ink-muted">Nenhuma instrução de renovação cadastrada ainda.</p>
                <Link href={`/painel/documentos/${doc.id}/editar`} className="mt-3 inline-block rounded-lg border border-black/10 px-4 py-2 text-xs font-semibold text-ink-soft hover:text-ink">
                  Adicionar guia de renovação
                </Link>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card title="Informações">
            <dl className="space-y-3 text-sm">
              <Field label="Órgão emissor" value={doc.orgao || '—'} />
              <Field label="Número / protocolo" value={doc.numero || '—'} />
              <Field label="Data de emissão" value={doc.emissao ? formatDate(doc.emissao, { style: 'short' }) : '—'} />
              <Field label="Data de vencimento" value={doc.vencimento ? formatDate(doc.vencimento, { style: 'short' }) : 'Não vence'} color={doc.vencimento ? meta.color : undefined} />
              <Field label="Aviso prévio" value={`${doc.dias_aviso} dias antes`} />
            </dl>
          </Card>

          {doc.vencimento && (
            <Card title="Linha do tempo">
              <ol className="relative space-y-4 border-l border-black/10 pl-5 text-sm">
                <Timeline color="#16a34a" titulo="Emitido" data={doc.emissao ? formatDate(doc.emissao, { style: 'short' }) : '—'} />
                {aviso && <Timeline color="#d97706" titulo={`Aviso (${doc.dias_aviso}d antes)`} data={new Date(aviso + 'T00:00:00').toLocaleDateString('pt-BR')} ativo={status === 'avencer'} />}
                <Timeline color="#dc2626" titulo="Vence" data={formatDate(doc.vencimento, { style: 'short' })} ativo={status === 'vencido'} />
              </ol>
            </Card>
          )}
        </div>
      </div>

      {/* Modal de exclusão */}
      {confirmDel && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => !deleting && setConfirmDel(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-pop" onClick={(e) => e.stopPropagation()}>
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50">
                <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2} className="h-7 w-7"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" /></svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-ink">Excluir documento?</h3>
                <p className="mt-1 text-sm text-ink-muted"><strong>{doc.nome}</strong> e seu arquivo serão removidos permanentemente.</p>
              </div>
              <div className="flex w-full gap-3">
                <button onClick={() => setConfirmDel(false)} disabled={deleting} className="flex-1 rounded-xl border border-black/10 py-3 text-sm font-semibold text-ink-soft hover:bg-black/[0.02]">Cancelar</button>
                <button onClick={excluir} disabled={deleting} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60">{deleting ? 'Excluindo…' : 'Excluir'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── helpers de UI ──────────────────────────────────────────────────────────────
function normalizeUrl(u: string): string {
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <h2 className="mb-3 text-sm font-bold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-semibold text-ink-soft" style={color ? { color } : undefined}>{value}</dd>
    </div>
  );
}

function Credencial({ label, valor, onCopy, extra }: { label: string; valor: string; onCopy: () => void; extra?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">{label}</span>
        <div className="flex items-center gap-2">
          {extra}
          <button onClick={onCopy} className="text-xs font-semibold text-brand hover:underline">copiar</button>
        </div>
      </div>
      <div className="mt-0.5 truncate font-mono text-sm text-ink">{valor}</div>
    </div>
  );
}

function InfoLinha({ icon, label, valor, mapa }: { icon: string; label: string; valor: string; mapa?: boolean }) {
  return (
    <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] px-3.5 py-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-ink-muted">{icon} {label}</span>
        {mapa && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(valor)}`} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-brand hover:underline">ver no mapa</a>}
      </div>
      <div className="mt-0.5 text-sm font-medium text-ink-soft">{valor}</div>
    </div>
  );
}

function Passos({ texto }: { texto: string }) {
  return (
    <div className="mt-3 rounded-xl border border-black/[0.06] bg-black/[0.015] px-4 py-3">
      <div className="mb-1 text-xs font-semibold text-ink-muted">Passo a passo</div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-ink-soft">{texto}</p>
    </div>
  );
}

function Timeline({ color, titulo, data, ativo }: { color: string; titulo: string; data: string; ativo?: boolean }) {
  return (
    <li className="relative">
      <span className="absolute -left-[26px] top-0.5 h-3 w-3 rounded-full border-2 border-white" style={{ background: color, boxShadow: ativo ? `0 0 0 3px ${color}33` : undefined }} />
      <div className={`font-semibold ${ativo ? 'text-ink' : 'text-ink-soft'}`}>{titulo}</div>
      <div className="text-xs text-ink-muted">{data}</div>
    </li>
  );
}

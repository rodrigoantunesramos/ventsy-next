'use client';

// Ficha do contrato — /painel/contratos/[id].
// Mostra o SNAPSHOT renderizado, o progresso/trilha de auditoria de cada
// signatário (IP/UA/hash/timestamp/método), a linha do tempo de status e as
// ações de gestão: enviar, copiar link, baixar PDF+certificado, cancelar e
// rescindir (com multa). Moeda/datas via lib/format — sem "R$" hardcoded.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { formatMoney, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  STATUS_META, PAPEL_META, progressoAssinaturas,
  type Contrato, type Assinatura,
} from '@/lib/contracts';
import ContractBody from '@/components/ContractBody';
import { isMissingTable, gerarPdfContrato } from '../_lib';
import { Icon, ModalShell, Field, inp, MoneyInput, PrimaryBtn, GhostBtn } from '../_components/ui';

export default function ContratoDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const id = params?.id;

  const [loading, setLoading] = useState(true);
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [contratada, setContratada] = useState('Contratada');
  const [enviando, setEnviando] = useState(false);
  const [acao, setAcao] = useState<'cancelar' | 'rescindir' | null>(null);

  const carregar = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session || !id) { setLoading(false); return; }
    const uid = session.user.id;
    const { data: c, error } = await sb.from('contratos').select('*').eq('id', id).eq('usuario_id', uid).maybeSingle();
    if (isMissingTable(error) || !c) { setContrato(null); setLoading(false); return; }
    setContrato({ ...(c as Contrato), valor_num: Number(c.valor_num) || 0, variaveis: c.variaveis || {} });
    const [{ data: assin }, { data: emp }] = await Promise.all([
      sb.from('contratos_assinaturas').select('*').eq('contrato_id', id).order('ordem'),
      sb.from('empresa_config').select('razao_social,fantasia').eq('usuario_id', uid).maybeSingle(),
    ]);
    setAssinaturas((assin || []) as Assinatura[]);
    setContratada(emp?.razao_social || emp?.fantasia || 'Contratada');
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  const prog = useMemo(() => progressoAssinaturas(assinaturas), [assinaturas]);

  async function enviar(lembrete = false) {
    if (!contrato) return;
    setEnviando(true);
    try {
      const res = await fetch('/api/contratos/enviar', {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ contrato_id: contrato.id, lembrete }),
      });
      const j = await res.json();
      if (!res.ok) { toast.error(j.error || 'Falha ao enviar.'); return; }
      if (j.email_configurado && j.emails_enviados > 0) toast.success(`Enviado: ${j.emails_enviados} e-mail(s).`);
      else { try { await navigator.clipboard.writeText(j.link); } catch { /* */ } toast.success('Link de assinatura copiado.'); }
      carregar();
    } finally { setEnviando(false); }
  }

  async function copiarLink() {
    if (!contrato?.link_token) { toast.error('Envie o contrato primeiro.'); return; }
    try { await navigator.clipboard.writeText(`${window.location.origin}/contrato/${contrato.link_token}`); toast.success('Link copiado.'); }
    catch { toast.error('Não foi possível copiar.'); }
  }

  async function baixarPdf() {
    if (!contrato) return;
    try { await gerarPdfContrato(contrato, assinaturas, contratada); } catch { toast.error('Falha ao gerar PDF.'); }
  }

  if (loading) {
    return <div className="mx-auto max-w-5xl space-y-4"><div className="h-10 w-40 animate-pulse rounded-xl bg-black/[0.05]" /><div className="h-[120px] animate-pulse rounded-2xl bg-black/[0.05]" /><div className="h-[420px] animate-pulse rounded-2xl bg-black/[0.05]" /></div>;
  }

  if (!contrato) {
    return (
      <div className="mx-auto max-w-2xl rounded-2xl bg-white py-16 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-black/[0.04] text-ink-muted"><Icon name="doc" size={26} /></div>
        <p className="mb-1 text-sm font-semibold text-ink">Contrato não encontrado</p>
        <p className="mb-5 text-xs text-ink-muted">Ele pode ter sido removido ou não pertence à sua conta.</p>
        <Link href="/painel/contratos" className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><Icon name="back" size={14} /> Voltar aos contratos</Link>
      </div>
    );
  }

  const st = STATUS_META[contrato.status];
  const imutavel = contrato.status !== 'rascunho';
  const encerrado = contrato.status === 'cancelado' || contrato.status === 'rescindido';

  return (
    <div className="mx-auto max-w-5xl">
      {/* Topo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/painel/contratos" aria-label="Voltar" className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white text-ink-muted hover:bg-black/[0.03]"><Icon name="back" size={16} /></Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-ink sm:text-xl">{contrato.numero}</h1>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wide ${st.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />{st.label}</span>
            </div>
            <p className="mt-0.5 text-sm text-ink-muted">{contrato.titulo || contrato.variaveis?.['cliente.nome'] || 'Contrato'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {contrato.status === 'rascunho' && <PrimaryBtn onClick={() => enviar()} disabled={enviando}><Icon name="send" size={14} /> {enviando ? 'Enviando…' : 'Enviar para assinatura'}</PrimaryBtn>}
          {contrato.status === 'enviado' && <button onClick={() => enviar(true)} disabled={enviando} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-50"><Icon name="send" size={14} /> Lembrete</button>}
          {(contrato.status === 'enviado' || contrato.status === 'assinado') && <button onClick={copiarLink} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]"><Icon name="link" size={14} /> Copiar link</button>}
          <button onClick={baixarPdf} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]"><Icon name="download" size={14} /> PDF</button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
        {/* Documento */}
        <div className="order-2 lg:order-1">
          <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-card sm:p-8">
            {imutavel && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                <Icon name="shield" size={14} /> Snapshot imutável — congelado no envio. A trilha de auditoria sela este conteúdo por hash.
              </div>
            )}
            <ContractBody text={contrato.conteudo_final} />
          </div>
        </div>

        {/* Lateral */}
        <div className="order-1 space-y-4 lg:order-2">
          {/* Resumo */}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <Resumo label="Valor" value={formatMoney(contrato.valor_num, { currency: contrato.moeda })} />
            {contrato.vencimento && <Resumo label="Vencimento" value={formatDate(contrato.vencimento)} />}
            <Resumo label="Assinaturas" value={`${prog.assinadas}/${prog.total}`} tone={prog.completo ? 'verde' : undefined} />
            {contrato.multa_num != null && <Resumo label="Multa de rescisão" value={formatMoney(contrato.multa_num, { currency: contrato.moeda })} tone="vermelho" />}
          </div>

          {/* Timeline */}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-3 text-sm font-bold text-ink">Linha do tempo</div>
            <ol className="space-y-3">
              <TL on={!!contrato.criado_em} label="Criado" when={contrato.criado_em} />
              <TL on={!!contrato.enviado_em} label="Enviado para assinatura" when={contrato.enviado_em} />
              <TL on={!!contrato.assinado_em} label="Assinado por todos" when={contrato.assinado_em} tone="verde" />
              {contrato.cancelado_em && <TL on label="Cancelado" when={contrato.cancelado_em} tone="cinza" />}
              {contrato.rescindido_em && <TL on label="Rescindido" when={contrato.rescindido_em} tone="vermelho" />}
            </ol>
          </div>

          {/* Assinantes + trilha */}
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold text-ink"><Icon name="users" size={15} /> Signatários</div>
            <div className="space-y-2.5">
              {assinaturas.length === 0 && <p className="text-xs text-ink-muted">Nenhum signatário cadastrado.</p>}
              {assinaturas.map((a) => <Signatario key={a.id} a={a} />)}
            </div>
          </div>

          {/* Gestão */}
          {!encerrado && (
            <div className="rounded-2xl bg-white p-4 shadow-card">
              <div className="mb-3 text-sm font-bold text-ink">Gestão</div>
              <div className="flex flex-col gap-2">
                <button onClick={() => setAcao('rescindir')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-100"><Icon name="ban" size={14} /> Rescindir contrato</button>
                <button onClick={() => setAcao('cancelar')} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-ink-muted hover:bg-black/[0.03]"><Icon name="x" size={14} /> Cancelar contrato</button>
              </div>
            </div>
          )}
          {contrato.motivo && <div className="rounded-2xl bg-white p-4 text-xs text-ink-muted shadow-card"><span className="font-semibold text-ink-soft">Motivo:</span> {contrato.motivo}</div>}
        </div>
      </div>

      {acao && <EncerrarModal kind={acao} contrato={contrato} onClose={() => setAcao(null)} onDone={() => { setAcao(null); carregar(); }} />}
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────
function Resumo({ label, value, tone }: { label: string; value: string; tone?: 'verde' | 'vermelho' }) {
  const c = tone === 'verde' ? 'text-emerald-600' : tone === 'vermelho' ? 'text-red-600' : 'text-ink';
  return <div className="flex items-center justify-between border-b border-black/[0.05] py-1.5 last:border-0"><span className="text-xs text-ink-muted">{label}</span><span className={`text-sm font-bold ${c}`}>{value}</span></div>;
}

function TL({ on, label, when, tone }: { on: boolean; label: string; when?: string | null; tone?: 'verde' | 'vermelho' | 'cinza' }) {
  const dot = !on ? 'bg-black/15' : tone === 'verde' ? 'bg-emerald-500' : tone === 'vermelho' ? 'bg-red-500' : tone === 'cinza' ? 'bg-ink-muted' : 'bg-brand';
  return (
    <li className="flex items-start gap-3">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      <div className="min-w-0">
        <div className={`text-sm ${on ? 'font-semibold text-ink' : 'text-ink-muted'}`}>{label}</div>
        {on && when && <div className="text-[0.7rem] text-ink-muted">{formatDateTime(when)}</div>}
      </div>
    </li>
  );
}

function Signatario({ a }: { a: Assinatura }) {
  const [open, setOpen] = useState(false);
  const assinou = !!a.assinou_em;
  return (
    <div className={`rounded-xl border p-2.5 ${assinou ? 'border-emerald-200 bg-emerald-50/40' : 'border-black/[0.08] bg-white'}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${assinou ? 'bg-emerald-100 text-emerald-700' : 'bg-black/[0.05] text-ink-muted'}`}>{assinou ? <Icon name="check" size={15} /> : <Icon name="user" size={14} />}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink">{a.signatario_nome || '—'}</div>
          <div className="text-[0.68rem] text-ink-muted">{PAPEL_META[a.papel].label}{a.obrigatorio ? '' : ' · opcional'}</div>
        </div>
        {assinou
          ? <button onClick={() => setOpen((v) => !v)} className="rounded-lg px-2 py-1 text-[0.68rem] font-semibold text-emerald-700 hover:bg-emerald-100">{open ? 'ocultar' : 'trilha'}</button>
          : <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-amber-700">pendente</span>}
      </div>
      {assinou && open && (
        <dl className="mt-2 space-y-1 border-t border-emerald-200/60 pt-2 text-[0.68rem]">
          <Audit k="Assinado em" v={formatDateTime(a.assinou_em, { withSeconds: true })} />
          <Audit k="Documento" v={a.signatario_doc || '—'} />
          <Audit k="Método" v={a.metodo || '—'} />
          <Audit k="IP" v={a.ip || '—'} />
          <Audit k="Dispositivo" v={a.user_agent || '—'} mono />
          <Audit k="Hash" v={a.hash || '—'} mono />
          {a.assinatura_img && <div className="pt-1"><img src={a.assinatura_img} alt="Assinatura" className="max-h-16 rounded border border-black/10 bg-white" /></div>}
        </dl>
      )}
    </div>
  );
}
function Audit({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return <div className="flex gap-2"><dt className="shrink-0 text-ink-muted">{k}:</dt><dd className={`min-w-0 break-all text-ink-soft ${mono ? 'font-mono text-[0.62rem]' : ''}`}>{v}</dd></div>;
}

// ── Encerramento (cancelar / rescindir) ───────────────────────────────────────
function EncerrarModal({ kind, contrato, onClose, onDone }: { kind: 'cancelar' | 'rescindir'; contrato: Contrato; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [motivo, setMotivo] = useState('');
  const [multaStr, setMultaStr] = useState('');
  const [busy, setBusy] = useState(false);
  const rescindir = kind === 'rescindir';

  async function confirmar() {
    setBusy(true);
    const patch: Record<string, unknown> = { motivo: motivo.trim() || null };
    if (rescindir) { patch.status = 'rescindido'; patch.rescindido_em = new Date().toISOString(); patch.multa_num = multaStr ? Number(multaStr) : null; }
    else { patch.status = 'cancelado'; patch.cancelado_em = new Date().toISOString(); }
    const { error } = await sb.from('contratos').update(patch).eq('id', contrato.id);
    setBusy(false);
    if (error) { toast.error('Não foi possível concluir.'); return; }
    toast.success(rescindir ? 'Contrato rescindido.' : 'Contrato cancelado.');
    onDone();
  }

  return (
    <ModalShell
      onClose={onClose} icon={<Icon name={rescindir ? 'ban' : 'x'} size={18} />}
      title={rescindir ? 'Rescindir contrato' : 'Cancelar contrato'}
      subtitle={rescindir ? 'Encerra um contrato vigente, registrando a multa.' : 'Cancela um contrato que não terá efeito.'}
      footer={<><GhostBtn onClick={onClose}>Voltar</GhostBtn><PrimaryBtn onClick={confirmar} disabled={busy}>{busy ? 'Processando…' : (rescindir ? 'Rescindir' : 'Cancelar contrato')}</PrimaryBtn></>}
    >
      <div className="space-y-4">
        {rescindir && (
          <Field label="Multa de rescisão" hint="Valor da multa (puxe da sua política de taxas, se houver).">
            <MoneyInput value={multaStr} onChange={setMultaStr} moeda={contrato.moeda} />
          </Field>
        )}
        <Field label="Motivo"><textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} className={inp} placeholder={rescindir ? 'Descreva o motivo da rescisão…' : 'Descreva o motivo do cancelamento…'} /></Field>
      </div>
    </ModalShell>
  );
}

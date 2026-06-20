'use client';

// Aba Notificações — a central in-app (o mesmo conteúdo do "sino" do topo).
// Lista as notificações do dono, marca lida/todas-lidas, abre o link e exclui.
// Também expõe as preferências por tipo (reusa empresa_config.notificacoes — a
// MESMA fonte de /painel/configuracoes > Preferências). Tudo via RLS. Sem "R$".

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabase as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatDateTime } from '@/lib/format';
import { type Notificacao, contarNaoLidas } from '@/lib/automacoes';
import { NOTIF_ITEMS, NOTIF_DEFAULTS } from '../../configuracoes/_lib';
import type { AutomacoesCtx } from '../_lib';
import { marcarLida, marcarTodasLidas, excluirNotificacao } from '../_lib';
import { UrgDot, Toggle, EmptyState, IcoBell, IcoCheck, IcoTrash, IcoExternal } from './ui';

const TIPO_LABEL: Record<string, string> = {
  parcela: 'Parcela', contrato: 'Contrato', evento: 'Evento', licenca: 'Licença',
  cliente: 'Cliente', feedback: 'Feedback', tarefa: 'Tarefa', sistema: 'Sistema',
};

export default function Notificacoes({ ctx }: { ctx: AutomacoesCtx }) {
  const toast = useToast();
  const [soNaoLidas, setSoNaoLidas] = useState(false);
  const [prefs, setPrefs] = useState<Record<string, boolean>>(NOTIF_DEFAULTS);
  const [savingPref, setSavingPref] = useState(false);

  const naoLidas = useMemo(() => contarNaoLidas(ctx.notificacoes), [ctx.notificacoes]);
  const lista = useMemo(
    () => (soNaoLidas ? ctx.notificacoes.filter((n) => !n.lida) : ctx.notificacoes).slice(0, 100),
    [ctx.notificacoes, soNaoLidas],
  );

  // Carrega as preferências (empresa_config.notificacoes) — mesma fonte da Config.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb.from('empresa_config').select('notificacoes').eq('usuario_id', ctx.userId).maybeSingle();
        setPrefs({ ...NOTIF_DEFAULTS, ...((data?.notificacoes as Record<string, boolean>) || {}) });
      } catch { /* sem config — usa defaults */ }
    })();
  }, [ctx.userId]);

  async function togglePref(k: string, v: boolean) {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    setSavingPref(true);
    const { error } = await sb.from('empresa_config').upsert({ usuario_id: ctx.userId, notificacoes: next, atualizado_em: new Date().toISOString() }, { onConflict: 'usuario_id' });
    setSavingPref(false);
    if (error) toast.error('Não foi possível salvar a preferência.');
  }

  async function lerTodas() {
    if (!naoLidas) return;
    const ok = await marcarTodasLidas(ctx.userId);
    if (!ok) { toast.error('Falha ao marcar como lidas.'); return; }
    await ctx.reloadNotificacoes();
  }
  async function alternarLida(n: Notificacao) {
    const ok = await marcarLida(n.id, !n.lida);
    if (!ok) { toast.error('Falha ao atualizar.'); return; }
    await ctx.reloadNotificacoes();
  }
  async function remover(n: Notificacao) {
    const ok = await excluirNotificacao(n.id);
    if (!ok) { toast.error('Falha ao excluir.'); return; }
    await ctx.reloadNotificacoes();
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {/* Inbox */}
      <div className="lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-ink">Caixa de notificações</h3>
            {naoLidas > 0 && <span className="rounded-full bg-brand px-2 py-0.5 text-[0.68rem] font-bold text-white">{naoLidas}</span>}
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-ink-muted">
              <Toggle checked={soNaoLidas} onChange={setSoNaoLidas} label="Só não lidas" /> Só não lidas
            </label>
            <button onClick={lerTodas} disabled={!naoLidas} className="inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-medium text-ink-muted hover:text-brand disabled:opacity-40"><IcoCheck size={13} /> Marcar todas</button>
          </div>
        </div>

        {lista.length === 0 ? (
          <EmptyState icon={<IcoBell size={22} />} title={soNaoLidas ? 'Nenhuma não lida' : 'Sem notificações ainda'}>
            Quando suas automações dispararem (ou houver pendências), elas aparecem aqui e no sino do topo.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {lista.map((n) => (
              <li key={n.id} className={`rounded-xl border p-3 transition ${n.lida ? 'border-black/[0.06] bg-white' : 'border-brand/20 bg-brand-50/40'}`}>
                <div className="flex items-start gap-2.5">
                  <span className="mt-1.5"><UrgDot u={n.urgencia} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-ink">{n.titulo}</span>
                      <span className="rounded-full bg-black/[0.04] px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide text-ink-muted">{TIPO_LABEL[n.tipo] || n.tipo}</span>
                    </div>
                    {n.corpo && <p className="mt-0.5 whitespace-pre-line text-xs text-ink-soft">{n.corpo}</p>}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 text-[0.68rem] text-ink-muted">
                      <span>{formatDateTime(n.criado_em)}</span>
                      {n.link && (n.link.startsWith('http')
                        ? <a href={n.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Abrir <IcoExternal size={11} /></a>
                        : <Link href={n.link} className="inline-flex items-center gap-1 font-semibold text-brand hover:underline">Abrir <IcoExternal size={11} /></Link>)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button onClick={() => alternarLida(n)} title={n.lida ? 'Marcar não lida' : 'Marcar lida'} aria-label="Alternar lida" className={`rounded-lg p-1.5 ${n.lida ? 'text-ink-muted hover:text-brand' : 'text-brand'} hover:bg-black/[0.04]`}><IcoCheck size={14} /></button>
                    <button onClick={() => remover(n)} title="Excluir" aria-label="Excluir" className="rounded-lg p-1.5 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Preferências (mesma fonte da Config) */}
      <div>
        <div className="rounded-2xl bg-white p-5 shadow-card">
          <h3 className="text-sm font-bold text-ink">Preferências</h3>
          <p className="mt-0.5 text-xs text-ink-muted">O que a Ventsy te avisa por padrão. Vale também em <Link href="/painel/configuracoes" className="font-semibold text-brand underline">Configurações</Link>.</p>
          <div className="mt-3 space-y-2.5">
            {NOTIF_ITEMS.map((it) => (
              <label key={it.k} className="flex items-center justify-between gap-3">
                <span className="text-sm text-ink-soft">{it.label}<span className="ml-1 text-[0.62rem] uppercase tracking-wide text-ink-muted">· {it.grupo}</span></span>
                <Toggle checked={!!prefs[it.k]} onChange={(v) => togglePref(it.k, v)} label={it.label} />
              </label>
            ))}
          </div>
          {savingPref && <p className="mt-2 text-[0.7rem] text-ink-muted">Salvando…</p>}
        </div>
      </div>
    </div>
  );
}

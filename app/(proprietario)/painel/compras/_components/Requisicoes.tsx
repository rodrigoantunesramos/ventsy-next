'use client';

// Aba "Requisições" — quem precisa de quê (liga a evento/centro de custo), itens,
// prioridade → aprovação por ALÇADA (limite de valor): acima do limite a
// aprovação simples é bloqueada e exige confirmação de alçada superior.
// Fluxo de status: aberta → aprovada/reprovada → em_cotacao (→ pedido/recebida).

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import type { TablesInsert } from '@/types/supabase';
import { formatMoney, formatMoneyShort, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ComprasBag, type Requisicao, type RequisicaoItem, type Prioridade, type ReqStatus,
  PRIORIDADES, PRIORIDADE_BY, REQ_STATUS, UNIDADES, inp, selCls,
  valorEstimado, precisaAlcada, proximoNumero,
} from '../_lib';
import { Kpi, ModalShell, Campo, Chip, Empty, IcoDoc, IcoPlus, IcoEdit, IcoTrash, IcoAlert, IcoCheck, IcoSearch, IcoCompare, IcoWallet, IcoClock } from './ui';

type ItemDraft = { descricao: string; quantidade: string; unidade: string; valor_estimado: string };
const itemVazio = (): ItemDraft => ({ descricao: '', quantidade: '1', unidade: 'un', valor_estimado: '' });

export default function Requisicoes({ bag }: { bag: ComprasBag }) {
  const toast = useToast();
  const { userId, requisicoes, reqItens, eventos, alcada, setAlcadaLocal, recarregar } = bag;

  const [busca, setBusca] = useState('');
  const [fStatus, setFStatus] = useState<ReqStatus | ''>('');
  const [fPrio, setFPrio] = useState<Prioridade | ''>('');

  const [modal, setModal] = useState<null | { editando?: Requisicao }>(null);
  const [aprovacao, setAprovacao] = useState<null | { req: Requisicao; acima: boolean }>(null);
  const [reprova, setReprova] = useState<null | Requisicao>(null);
  const [alcadaModal, setAlcadaModal] = useState(false);

  const itensPorReq = useMemo(() => {
    const m = new Map<string, RequisicaoItem[]>();
    for (const it of reqItens) { const a = m.get(it.requisicao_id) || []; a.push(it); m.set(it.requisicao_id, a); }
    return m;
  }, [reqItens]);

  const eventoNome = useMemo(() => {
    const m = new Map(eventos.map((e) => [e.id, e.nome_evento || e.tipo_evento || 'Evento']));
    return (id: string | null) => (id ? m.get(id) || '' : '');
  }, [eventos]);

  const kpis = useMemo(() => {
    const ativos = requisicoes.filter((r) => r.status !== 'cancelada' && r.status !== 'reprovada');
    const abertas = requisicoes.filter((r) => r.status === 'aberta');
    const acimaAlcada = abertas.filter((r) => precisaAlcada(r.valor_estimado, alcada));
    const emAberto = ativos.filter((r) => r.status === 'aberta' || r.status === 'aprovada' || r.status === 'em_cotacao');
    return {
      abertas: abertas.length,
      acima: acimaAlcada.length,
      valorAberto: emAberto.reduce((s, r) => s + r.valor_estimado, 0),
      aprovadas: requisicoes.filter((r) => r.status === 'aprovada').length,
    };
  }, [requisicoes, alcada]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return requisicoes.filter((r) => {
      if (fStatus && r.status !== fStatus) return false;
      if (fPrio && r.prioridade !== fPrio) return false;
      if (q) {
        const hay = `${r.numero || ''} ${r.solicitante || ''} ${r.justificativa || ''} ${eventoNome(r.evento_id)}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requisicoes, fStatus, fPrio, busca, eventoNome]);

  // ── Aprovação por alçada ──
  function pedirAprovacao(r: Requisicao) {
    const acima = precisaAlcada(r.valor_estimado, alcada);
    setAprovacao({ req: r, acima });
  }
  async function confirmarAprovacao(comAlcada: boolean) {
    if (!aprovacao) return;
    const { error } = await sb.from('requisicoes').update({
      status: 'aprovada', aprovado_em: new Date().toISOString(), aprovado_por: comAlcada ? 'Alçada superior' : 'Padrão',
    }).eq('id', aprovacao.req.id);
    if (error) { toast.error('Erro ao aprovar.'); return; }
    toast.success('Requisição aprovada.');
    setAprovacao(null);
    await recarregar();
  }
  async function confirmarReprova(motivo: string) {
    if (!reprova) return;
    const { error } = await sb.from('requisicoes').update({ status: 'reprovada', reprovado_motivo: motivo || null }).eq('id', reprova.id);
    if (error) { toast.error('Erro ao reprovar.'); return; }
    toast.info('Requisição reprovada.');
    setReprova(null);
    await recarregar();
  }
  async function mudarStatus(r: Requisicao, status: ReqStatus, ok: string) {
    const { error } = await sb.from('requisicoes').update({ status }).eq('id', r.id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    toast.success(ok);
    await recarregar();
  }
  async function excluir(r: Requisicao) {
    if (!confirm(`Excluir a requisição ${r.numero || ''}? Os itens também serão removidos.`)) return;
    const { error } = await sb.from('requisicoes').delete().eq('id', r.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Requisição excluída.');
    await recarregar();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button onClick={() => setAlcadaModal(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03]">
          <IcoCheck /> Alçada: {alcada > 0 ? formatMoneyShort(alcada) : 'sem limite'}
        </button>
        <button onClick={() => setModal({})} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600"><IcoPlus /> Nova requisição</button>
      </div>

      {/* KPIs */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Abertas" value={String(kpis.abertas)} tone="azul" icon={<IcoDoc />} />
        <Kpi label="Acima da alçada" value={String(kpis.acima)} sub="aguardando alçada superior" tone={kpis.acima ? 'gold' : 'ink'} icon={<IcoAlert />} />
        <Kpi label="Aprovadas" value={String(kpis.aprovadas)} tone="verde" icon={<IcoCheck />} />
        <Kpi label="Valor em aberto" value={formatMoneyShort(kpis.valorAberto)} sub="estimado" tone="roxo" icon={<IcoWallet />} />
      </div>

      {requisicoes.length === 0 ? (
        <div className="mt-5">
          <Empty
            icon={<IcoDoc size={30} />}
            title="Comece pela requisição"
            action={<button onClick={() => setModal({})} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600">+ Nova requisição</button>}
          >
            Registre o que cada evento ou setor precisa comprar. Depois você cota entre fornecedores, emite o pedido e dá entrada no recebimento — tudo rastreado.
          </Empty>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1">
              <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar número, solicitante, evento…" className="w-full rounded-xl border border-black/10 py-2 pl-8 pr-3 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
            </div>
            <select value={fStatus} onChange={(e) => setFStatus(e.target.value as ReqStatus | '')} className={selCls}>
              <option value="">Status</option>
              {(Object.keys(REQ_STATUS) as ReqStatus[]).map((s) => <option key={s} value={s}>{REQ_STATUS[s].label}</option>)}
            </select>
            <select value={fPrio} onChange={(e) => setFPrio(e.target.value as Prioridade | '')} className={selCls}>
              <option value="">Prioridade</option>
              {PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}
            </select>
          </div>

          {filtradas.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-muted">Nenhuma requisição neste filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                    <th className="pb-2 font-semibold">Requisição</th>
                    <th className="hidden pb-2 font-semibold md:table-cell">Evento</th>
                    <th className="pb-2 font-semibold">Prioridade</th>
                    <th className="pb-2 font-semibold">Status</th>
                    <th className="pb-2 text-right font-semibold">Estimado</th>
                    <th className="w-px pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((r) => {
                    const itens = itensPorReq.get(r.id) || [];
                    const acima = r.status === 'aberta' && precisaAlcada(r.valor_estimado, alcada);
                    return (
                      <tr key={r.id} className="group border-b border-black/[0.04] last:border-0 align-top">
                        <td className="py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-ink">{r.numero || '—'}</span>
                            {acima && <span title="Acima da alçada" className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[0.6rem] font-bold text-amber-700">alçada</span>}
                          </div>
                          <p className="text-xs text-ink-muted">{r.solicitante || 'Sem solicitante'} · {itens.length} {itens.length === 1 ? 'item' : 'itens'}</p>
                        </td>
                        <td className="hidden py-2.5 text-ink-muted md:table-cell">{eventoNome(r.evento_id) || <span className="italic text-ink-muted/70">—</span>}</td>
                        <td className="py-2.5"><Chip meta={PRIORIDADE_BY[r.prioridade]} /></td>
                        <td className="py-2.5"><Chip meta={REQ_STATUS[r.status]} /></td>
                        <td className="py-2.5 text-right font-bold text-ink">{r.valor_estimado > 0 ? formatMoney(r.valor_estimado) : <span className="font-normal text-ink-muted">—</span>}</td>
                        <td className="py-2.5 pl-2">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === 'aberta' && (
                              <>
                                <button onClick={() => pedirAprovacao(r)} className={`rounded-lg px-2.5 py-1 text-[0.7rem] font-bold text-white ${acima ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-600 hover:bg-emerald-700'}`}>{acima ? 'Aprovar (alçada)' : 'Aprovar'}</button>
                                <button onClick={() => setReprova(r)} className="rounded-lg border border-black/10 px-2 py-1 text-[0.7rem] font-semibold text-ink-muted hover:border-red-300 hover:text-red-600">Reprovar</button>
                              </>
                            )}
                            {(r.status === 'aprovada' || r.status === 'em_cotacao') && (
                              <button onClick={() => mudarStatus(r, 'em_cotacao', 'Requisição enviada para cotação.')} disabled={r.status === 'em_cotacao'} className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1 text-[0.7rem] font-bold text-white hover:bg-violet-700 disabled:opacity-50"><IcoCompare /> {r.status === 'em_cotacao' ? 'Em cotação' : 'Cotar'}</button>
                            )}
                            <div className="flex opacity-0 transition group-hover:opacity-100">
                              {r.status !== 'recebida' && <button onClick={() => setModal({ editando: r })} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>}
                              <button onClick={() => excluir(r)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
                            </div>
                          </div>
                          {r.status === 'reprovada' && r.reprovado_motivo && <p className="mt-1 text-right text-[0.68rem] italic text-red-500">{r.reprovado_motivo}</p>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && userId && (
        <RequisicaoModal
          bag={bag}
          editando={modal.editando}
          itensIniciais={modal.editando ? (itensPorReq.get(modal.editando.id) || []) : []}
          onClose={() => setModal(null)}
          onSaved={async () => { setModal(null); await recarregar(); }}
        />
      )}

      {/* Modal aprovação (com gate de alçada) */}
      {aprovacao && (
        <ModalShell onClose={() => setAprovacao(null)} maxW="max-w-sm">
          <div className="mb-4 flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full ${aprovacao.acima ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>{aprovacao.acima ? <IcoAlert /> : <IcoCheck />}</span>
            <div>
              <h3 className="font-display text-xl font-bold text-ink">Aprovar requisição</h3>
              <p className="text-xs text-ink-muted">{aprovacao.req.numero} · {formatMoney(aprovacao.req.valor_estimado)}</p>
            </div>
          </div>
          {aprovacao.acima ? (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Esta requisição ({formatMoney(aprovacao.req.valor_estimado)}) está <strong>acima da alçada</strong> de {formatMoney(alcada)}. A aprovação exige confirmação de alçada superior.
              </p>
              <div className="mt-6 flex items-center gap-3">
                <button onClick={() => confirmarAprovacao(true)} className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white hover:bg-amber-600">Aprovar com alçada superior</button>
                <button onClick={() => setAprovacao(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-ink-soft">Confirmar a aprovação desta requisição? Ela ficará disponível para cotação.</p>
              <div className="mt-6 flex items-center gap-3">
                <button onClick={() => confirmarAprovacao(false)} className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-700">Aprovar</button>
                <button onClick={() => setAprovacao(null)} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
              </div>
            </>
          )}
        </ModalShell>
      )}

      {/* Modal reprova */}
      {reprova && <ReprovaModal req={reprova} onClose={() => setReprova(null)} onConfirm={confirmarReprova} />}

      {/* Modal alçada */}
      {alcadaModal && <AlcadaModal valor={alcada} onClose={() => setAlcadaModal(false)} onSave={(n) => { setAlcadaLocal(n); setAlcadaModal(false); toast.success('Limite de alçada atualizado.'); }} />}
    </div>
  );
}

// ── Modal: criar/editar requisição + itens ────────────────────────────────────
function RequisicaoModal({ bag, editando, itensIniciais, onClose, onSaved }: {
  bag: ComprasBag; editando?: Requisicao; itensIniciais: RequisicaoItem[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { userId, requisicoes, eventos, centrosCusto } = bag;
  const [solicitante, setSolicitante] = useState(editando?.solicitante ?? '');
  const [eventoId, setEventoId] = useState(editando?.evento_id ?? '');
  const [centroId, setCentroId] = useState(editando?.centro_custo_id ?? '');
  const [prioridade, setPrioridade] = useState<Prioridade>(editando?.prioridade ?? 'media');
  const [justificativa, setJustificativa] = useState(editando?.justificativa ?? '');
  const [obs, setObs] = useState(editando?.obs ?? '');
  const [itens, setItens] = useState<ItemDraft[]>(
    itensIniciais.length
      ? itensIniciais.map((i) => ({ descricao: i.descricao, quantidade: String(i.quantidade), unidade: i.unidade, valor_estimado: i.valor_estimado ? String(i.valor_estimado) : '' }))
      : [itemVazio()],
  );
  const [saving, setSaving] = useState(false);

  const total = useMemo(() => valorEstimado(itens.map((i) => ({ quantidade: Number(i.quantidade) || 0, valor_estimado_num: Number(i.valor_estimado) || 0 }))), [itens]);

  function setItem(idx: number, patch: Partial<ItemDraft>) { setItens((arr) => arr.map((it, i) => i === idx ? { ...it, ...patch } : it)); }
  function addItem() { setItens((arr) => [...arr, itemVazio()]); }
  function delItem(idx: number) { setItens((arr) => arr.length > 1 ? arr.filter((_, i) => i !== idx) : arr); }

  async function salvar() {
    if (!userId) return;
    const limpos = itens.map((i) => ({ ...i, descricao: i.descricao.trim() })).filter((i) => i.descricao);
    if (!limpos.length) { toast.error('Adicione ao menos um item com descrição.'); return; }
    setSaving(true);
    const valor_estimado_num = valorEstimado(limpos.map((i) => ({ quantidade: Number(i.quantidade) || 0, valor_estimado_num: Number(i.valor_estimado) || 0 })));
    const head = {
      usuario_id: userId, solicitante: solicitante.trim() || null, evento_id: eventoId || null, centro_custo_id: centroId || null,
      prioridade, justificativa: justificativa.trim() || null, obs: obs.trim() || null, valor_estimado_num,
    };

    let reqId = editando?.id;
    if (editando) {
      const { error } = await sb.from('requisicoes').update(head).eq('id', editando.id);
      if (error) { setSaving(false); toast.error('Erro ao salvar.'); return; }
      await sb.from('requisicao_itens').delete().eq('requisicao_id', editando.id);
    } else {
      const numero = proximoNumero('REQ', requisicoes.map((r) => r.numero));
      const { data, error } = await sb.from('requisicoes').insert({ ...head, numero, status: 'aberta' }).select('id').single();
      if (error || !data) { setSaving(false); toast.error('Erro ao criar requisição.'); return; }
      reqId = String(data.id);
    }

    const payloadItens = limpos.map((i) => ({
      requisicao_id: reqId, usuario_id: userId, descricao: i.descricao,
      quantidade: Number(i.quantidade) || 1, unidade: i.unidade || 'un', valor_estimado_num: Number(i.valor_estimado) || 0,
    }));
    const { error: eItens } = await sb.from('requisicao_itens').insert(payloadItens as TablesInsert<'requisicao_itens'>[]);
    setSaving(false);
    if (eItens) { toast.error('Requisição salva, mas houve erro nos itens.'); return; }
    toast.success(editando ? 'Requisição atualizada!' : 'Requisição criada!');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editando ? `Editar ${editando.numero || 'requisição'}` : 'Nova requisição'}</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Solicitante"><input className={inp} value={solicitante} onChange={(e) => setSolicitante(e.target.value)} placeholder="Quem está pedindo" /></Campo>
          <Campo label="Prioridade">
            <select className={inp} value={prioridade} onChange={(e) => setPrioridade(e.target.value as Prioridade)}>{PRIORIDADES.map((p) => <option key={p.v} value={p.v}>{p.label}</option>)}</select>
          </Campo>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Evento" hint="(opcional)">
            <select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">Sem evento</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{e.nome_evento || e.tipo_evento || 'Evento'}{e.data_inicio ? ` · ${formatDate(e.data_inicio, { style: 'short' })}` : ''}</option>)}
            </select>
          </Campo>
          {centrosCusto.length > 0 ? (
            <Campo label="Centro de custo" hint="(opcional)">
              <select className={inp} value={centroId} onChange={(e) => setCentroId(e.target.value)}>
                <option value="">Sem centro de custo</option>
                {centrosCusto.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </Campo>
          ) : (
            <Campo label="Justificativa" hint="(opcional)"><input className={inp} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que precisa" /></Campo>
          )}
        </div>
        {centrosCusto.length > 0 && (
          <Campo label="Justificativa" hint="(opcional)"><input className={inp} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Por que precisa" /></Campo>
        )}

        {/* Itens */}
        <div className="rounded-xl border border-black/[0.06] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-soft">Itens</span>
            <button onClick={addItem} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoPlus size={12} /> Item</button>
          </div>
          <div className="space-y-2">
            {itens.map((it, idx) => (
              <div key={idx} className="grid grid-cols-[1fr_64px_70px_92px_auto] items-center gap-2">
                <input className="rounded-lg border border-black/10 px-2.5 py-2 text-sm focus:border-brand focus:outline-none" value={it.descricao} onChange={(e) => setItem(idx, { descricao: e.target.value })} placeholder="Descrição do item" />
                <input type="number" min={0} step="any" className="rounded-lg border border-black/10 px-2 py-2 text-sm focus:border-brand focus:outline-none" value={it.quantidade} onChange={(e) => setItem(idx, { quantidade: e.target.value })} placeholder="Qtd" />
                <select className="rounded-lg border border-black/10 px-1.5 py-2 text-sm focus:border-brand focus:outline-none" value={it.unidade} onChange={(e) => setItem(idx, { unidade: e.target.value })}>{UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}</select>
                <input type="number" min={0} step="0.01" className="rounded-lg border border-black/10 px-2 py-2 text-sm focus:border-brand focus:outline-none" value={it.valor_estimado} onChange={(e) => setItem(idx, { valor_estimado: e.target.value })} placeholder="Vlr est." title="Valor unitário estimado" />
                <button onClick={() => delItem(idx)} disabled={itens.length === 1} className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600 disabled:opacity-30"><IcoTrash /></button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-black/[0.06] pt-2 text-sm">
            <span className="text-ink-muted">Total estimado</span>
            <span className="font-bold text-ink">{formatMoney(total)}</span>
          </div>
        </div>

        <Campo label="Observações" hint="(opcional)"><textarea className={inp} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Notas internas…" /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar requisição'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

function ReprovaModal({ req, onClose, onConfirm }: { req: Requisicao; onClose: () => void; onConfirm: (motivo: string) => void }) {
  const [motivo, setMotivo] = useState('');
  return (
    <ModalShell onClose={onClose} maxW="max-w-sm">
      <h3 className="mb-1 font-display text-xl font-bold text-ink">Reprovar requisição</h3>
      <p className="mb-4 text-xs text-ink-muted">{req.numero}</p>
      <Campo label="Motivo" hint="(opcional)"><textarea className={inp} rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Por que está sendo reprovada…" /></Campo>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => onConfirm(motivo)} className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white hover:bg-red-700">Reprovar</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

function AlcadaModal({ valor, onClose, onSave }: { valor: number; onClose: () => void; onSave: (n: number) => void }) {
  const [v, setV] = useState(valor ? String(valor) : '');
  return (
    <ModalShell onClose={onClose} maxW="max-w-sm">
      <h3 className="mb-1 font-display text-xl font-bold text-ink">Limite de alçada</h3>
      <p className="mb-4 text-sm text-ink-muted">Requisições acima deste valor exigem aprovação de alçada superior. Deixe em branco (ou 0) para não exigir.</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-ink-muted"><IcoClock /></span>
        <input type="number" min={0} step="0.01" className={inp} value={v} onChange={(e) => setV(e.target.value)} placeholder="Ex.: 5000" autoFocus />
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => onSave(Number(v) || 0)} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600">Salvar limite</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

'use client';

// Aba "Cotações" — para uma requisição em cotação: disparar pedido de cotação a
// N fornecedores (e-mail/WhatsApp com a lista de itens), registrar as propostas
// (preço por item ou total cheio) e comparar no MAPA COMPARATIVO (melhor preço por
// item destacado + cotação recomendada). Escolher a vencedora libera o pedido.

import { useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ComprasBag, type Requisicao, type RequisicaoItem, type Cotacao, type CotacaoItem, type FornecedorLite,
  type CotacaoRef, inp, selCls, montarComparativo, fornNomeDe, mailLink, waLink,
  uploadAnexo, signedUrl, removeArquivo,
} from '../_lib';
import { Kpi, ModalShell, Campo, Empty, IcoCompare, IcoPlus, IcoEdit, IcoTrash, IcoCheck, IcoPaperclip, IcoArrow, IcoDoc } from './ui';

export default function Cotacoes({ bag }: { bag: ComprasBag }) {
  const toast = useToast();
  const { userId, requisicoes, reqItens, cotacoes, cotacaoItens, fornecedores, recarregar } = bag;

  // Requisições elegíveis para cotação (em cotação ou aprovadas).
  const elegiveis = useMemo(() => requisicoes.filter((r) => r.status === 'em_cotacao' || r.status === 'aprovada'), [requisicoes]);
  const [reqId, setReqId] = useState<string>('');
  useEffect(() => {
    if (reqId && elegiveis.some((r) => r.id === reqId)) return;
    setReqId(elegiveis[0]?.id ?? '');
  }, [elegiveis, reqId]);

  const req = useMemo(() => requisicoes.find((r) => r.id === reqId) || null, [requisicoes, reqId]);
  const itens = useMemo(() => reqItens.filter((i) => i.requisicao_id === reqId), [reqItens, reqId]);
  const cots = useMemo(() => cotacoes.filter((c) => c.requisicao_id === reqId), [cotacoes, reqId]);
  const itensPorCot = useMemo(() => {
    const m = new Map<string, CotacaoItem[]>();
    for (const ci of cotacaoItens) { const a = m.get(ci.cotacao_id) || []; a.push(ci); m.set(ci.cotacao_id, a); }
    return m;
  }, [cotacaoItens]);

  const comparativo = useMemo(() => {
    const refs: CotacaoRef[] = cots.map((c) => ({
      id: c.id, rotulo: fornNomeDe(fornecedores.find((f) => f.id === c.fornecedor_id)) || c.fornecedor_nome || 'Fornecedor',
      valor_total_num: c.valor_total, prazo_dias: c.prazo_dias,
      itens: (itensPorCot.get(c.id) || []).map((ci) => ({ requisicao_item_id: ci.requisicao_item_id, valor_unit_num: ci.valor_unit, prazo_dias: ci.prazo_dias, disponivel: ci.disponivel })),
    }));
    return montarComparativo(itens.map((i) => ({ id: i.id, descricao: i.descricao, quantidade: i.quantidade })), refs);
  }, [cots, itens, itensPorCot, fornecedores]);

  const [modal, setModal] = useState<null | { editando?: Cotacao }>(null);
  const [solicitar, setSolicitar] = useState(false);

  const nomeForn = (c: Cotacao) => fornNomeDe(fornecedores.find((f) => f.id === c.fornecedor_id)) || c.fornecedor_nome || 'Fornecedor';

  async function escolher(c: Cotacao) {
    // Marca a vencedora e desmarca as demais da mesma requisição.
    await sb.from('cotacoes').update({ escolhida: false }).eq('requisicao_id', reqId);
    const { error } = await sb.from('cotacoes').update({ escolhida: true, status: 'recebida', recebida_em: new Date().toISOString() }).eq('id', c.id);
    if (error) { toast.error('Erro ao escolher a cotação.'); return; }
    toast.success(`Cotação de ${nomeForn(c)} escolhida. Gere o pedido na aba Pedidos.`);
    await recarregar();
  }
  async function excluir(c: Cotacao) {
    if (!confirm('Excluir esta cotação?')) return;
    if (c.anexo_url) await removeArquivo(c.anexo_url);
    const { error } = await sb.from('cotacoes').delete().eq('id', c.id);
    if (error) { toast.error('Erro ao excluir.'); return; }
    toast.success('Cotação removida.');
    await recarregar();
  }
  async function abrirAnexo(path: string | null) {
    const url = await signedUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer'); else toast.error('Não foi possível abrir o anexo.');
  }

  if (elegiveis.length === 0) {
    return (
      <Empty icon={<IcoCompare size={28} />} title="Nenhuma requisição em cotação">
        Aprove uma requisição e clique em <strong>Cotar</strong> na aba Requisições para começar a comparar fornecedores aqui.
      </Empty>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-soft">Requisição</span>
          <select value={reqId} onChange={(e) => setReqId(e.target.value)} className={selCls}>
            {elegiveis.map((r) => <option key={r.id} value={r.id}>{r.numero} · {formatMoney(r.valor_estimado)}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSolicitar(true)} disabled={!req} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium text-ink-soft hover:bg-black/[0.03] disabled:opacity-50"><IcoArrow /> Solicitar cotação</button>
          <button onClick={() => setModal({})} disabled={!req} className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"><IcoPlus /> Registrar cotação</button>
        </div>
      </div>

      {/* KPIs da requisição */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Itens" value={String(itens.length)} tone="ink" icon={<IcoDoc />} />
        <Kpi label="Cotações" value={String(cots.length)} tone="azul" icon={<IcoCompare />} />
        <Kpi label="Estimado" value={formatMoney(req?.valor_estimado || 0)} tone="roxo" />
        <Kpi
          label="Melhor cotação"
          value={comparativo.recomendadaId ? formatMoney(comparativo.totais.find((t) => t.cotacaoId === comparativo.recomendadaId)!.total) : '—'}
          sub={comparativo.recomendadaId ? nomeForn(cots.find((c) => c.id === comparativo.recomendadaId)!) : 'sem cotação completa'}
          tone="verde" icon={<IcoCheck />}
        />
      </div>

      {/* Mapa comparativo */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-1 text-base font-bold text-ink">Mapa comparativo</h3>
        <p className="mb-4 text-xs text-ink-muted">Melhor preço por item em <span className="font-semibold text-emerald-600">verde</span>. A cotação recomendada é a de menor total que cobre todos os itens (desempate pelo menor prazo).</p>

        {cots.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Nenhuma cotação registrada para esta requisição ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted">
                  <th className="pb-2 pr-3 font-semibold">Item</th>
                  {cots.map((c) => (
                    <th key={c.id} className="px-3 pb-2 text-right font-semibold">
                      <div className="flex items-center justify-end gap-1">
                        {comparativo.recomendadaId === c.id && <span title="Recomendada" className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.55rem] font-bold text-emerald-700">TOP</span>}
                        {c.escolhida && <span title="Escolhida" className="text-emerald-600"><IcoCheck /></span>}
                        <span className="truncate">{nomeForn(c)}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparativo.linhas.map((linha) => (
                  <tr key={linha.item.id} className="border-b border-black/[0.04]">
                    <td className="py-2 pr-3">
                      <div className="font-medium text-ink-soft">{linha.item.descricao}</div>
                      <div className="text-[0.68rem] text-ink-muted">{linha.item.quantidade} {itens.find((i) => i.id === linha.item.id)?.unidade}</div>
                    </td>
                    {linha.celulas.map((cel) => (
                      <td key={cel.cotacaoId} className={`px-3 py-2 text-right ${cel.melhor ? 'bg-emerald-50' : ''}`}>
                        {cel.valorUnit == null ? (
                          <span className="text-ink-muted/60">—</span>
                        ) : (
                          <div>
                            <div className={`font-semibold ${cel.melhor ? 'text-emerald-700' : 'text-ink'}`}>{formatMoney(cel.total || 0)}</div>
                            <div className="text-[0.66rem] text-ink-muted">{formatMoney(cel.valorUnit)}/un</div>
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Totais */}
                <tr className="border-t-2 border-black/10 text-sm">
                  <td className="py-2 pr-3 font-bold text-ink">Total</td>
                  {cots.map((c) => {
                    const t = comparativo.totais.find((x) => x.cotacaoId === c.id)!;
                    const rec = comparativo.recomendadaId === c.id;
                    return (
                      <td key={c.id} className="px-3 py-2 text-right">
                        <div className={`font-bold ${rec ? 'text-emerald-700' : 'text-ink'}`}>{formatMoney(t.total)}</div>
                        <div className="text-[0.66rem] text-ink-muted">{c.prazo_dias != null ? `${c.prazo_dias} d` : 'prazo —'}{t.completa ? '' : ' · parcial'}</div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cotações detalhadas */}
      {cots.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cots.map((c) => {
            const rec = comparativo.recomendadaId === c.id;
            return (
              <div key={c.id} className={`rounded-2xl border bg-white p-4 shadow-card ${c.escolhida ? 'border-emerald-300 ring-1 ring-emerald-200' : 'border-black/[0.06]'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate font-bold text-ink">{nomeForn(c)}</p>
                      {rec && <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[0.55rem] font-bold text-emerald-700">TOP</span>}
                    </div>
                    <p className="text-xs text-ink-muted">{c.condicao || 'Condição a combinar'}{c.prazo_dias != null ? ` · ${c.prazo_dias} dias` : ''}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-ink">{formatMoney(c.valor_total)}</div>
                    {c.validade && <div className="text-[0.66rem] text-ink-muted">val. {formatDate(c.validade, { style: 'short' })}</div>}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-1.5">
                  {c.escolhida ? (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"><IcoCheck /> Escolhida</span>
                  ) : (
                    <button onClick={() => escolher(c)} className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"><IcoCheck /> Escolher</button>
                  )}
                  {c.anexo_url && <button onClick={() => abrirAnexo(c.anexo_url)} title={c.anexo_nome || 'Anexo'} className="rounded-lg border border-black/10 p-1.5 text-ink-muted hover:text-brand"><IcoPaperclip /></button>}
                  <div className="ml-auto flex">
                    <button onClick={() => setModal({ editando: c })} title="Editar" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
                    <button onClick={() => excluir(c)} title="Excluir" className="rounded p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-red-600"><IcoTrash /></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && req && userId && (
        <CotacaoModal bag={bag} req={req} itens={itens} editando={modal.editando} itensEditando={modal.editando ? (itensPorCot.get(modal.editando.id) || []) : []} onClose={() => setModal(null)} onSaved={async () => { setModal(null); await recarregar(); }} />
      )}
      {solicitar && req && <SolicitarModal req={req} itens={itens} fornecedores={fornecedores} onClose={() => setSolicitar(false)} />}
    </div>
  );
}

// ── Modal: registrar/editar cotação ───────────────────────────────────────────
function CotacaoModal({ bag, req, itens, editando, itensEditando, onClose, onSaved }: {
  bag: ComprasBag; req: Requisicao; itens: RequisicaoItem[]; editando?: Cotacao; itensEditando: CotacaoItem[]; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const { userId, fornecedores } = bag;
  const [fornId, setFornId] = useState(editando?.fornecedor_id ?? '');
  const [fornNome, setFornNome] = useState(editando?.fornecedor_nome ?? '');
  const [prazo, setPrazo] = useState(editando?.prazo_dias != null ? String(editando.prazo_dias) : '');
  const [condicao, setCondicao] = useState(editando?.condicao ?? '');
  const [validade, setValidade] = useState(editando?.validade ?? '');
  const [obs, setObs] = useState(editando?.obs ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [removerAnexo, setRemoverAnexo] = useState(false);
  const [saving, setSaving] = useState(false);

  // preços por item (mapa requisicao_item_id → {unit, disponivel})
  const inicial = useMemo(() => {
    const m = new Map<string, { unit: string; disp: boolean }>();
    for (const ci of itensEditando) if (ci.requisicao_item_id) m.set(ci.requisicao_item_id, { unit: ci.valor_unit ? String(ci.valor_unit) : '', disp: ci.disponivel });
    return m;
  }, [itensEditando]);
  const [precos, setPrecos] = useState<Record<string, { unit: string; disp: boolean }>>(() =>
    Object.fromEntries(itens.map((i) => [i.id, inicial.get(i.id) || { unit: '', disp: true }])),
  );
  function setPreco(id: string, patch: Partial<{ unit: string; disp: boolean }>) { setPrecos((p) => ({ ...p, [id]: { ...p[id], ...patch } })); }

  const total = useMemo(() => itens.reduce((s, i) => {
    const p = precos[i.id]; if (!p || !p.disp) return s; return s + (Number(p.unit) || 0) * i.quantidade;
  }, 0), [itens, precos]);

  async function salvar() {
    if (!userId) return;
    const nome = fornId ? (fornNomeDe(fornecedores.find((f) => f.id === fornId)) || null) : (fornNome.trim() || null);
    if (!fornId && !fornNome.trim()) { toast.error('Selecione um fornecedor ou informe o nome.'); return; }
    setSaving(true);
    let anexo_url = editando?.anexo_url ?? null;
    let anexo_nome = editando?.anexo_nome ?? null;
    if (removerAnexo) { await removeArquivo(anexo_url); anexo_url = null; anexo_nome = null; }
    if (file) { try { const up = await uploadAnexo(userId, file); anexo_url = up.anexo_url; anexo_nome = up.anexo_nome; } catch { setSaving(false); toast.error('Falha ao enviar o anexo.'); return; } }

    const head = {
      usuario_id: userId, requisicao_id: req.id, fornecedor_id: fornId || null, fornecedor_nome: nome,
      valor_total_num: total, prazo_dias: prazo ? Number(prazo) : null, condicao: condicao.trim() || null,
      validade: validade || null, anexo_url, anexo_nome, obs: obs.trim() || null,
    };
    let cotId = editando?.id;
    if (editando) {
      const { error } = await sb.from('cotacoes').update(head).eq('id', editando.id);
      if (error) { setSaving(false); toast.error('Erro ao salvar cotação.'); return; }
      await sb.from('cotacao_itens').delete().eq('cotacao_id', editando.id);
    } else {
      const { data, error } = await sb.from('cotacoes').insert({ ...head, status: 'recebida', recebida_em: new Date().toISOString() }).select('id').single();
      if (error || !data) { setSaving(false); toast.error('Erro ao criar cotação.'); return; }
      cotId = String(data.id);
    }
    const payload = itens.map((i) => ({
      cotacao_id: cotId, requisicao_item_id: i.id, usuario_id: userId, descricao: i.descricao,
      quantidade: i.quantidade, valor_unit_num: Number(precos[i.id]?.unit) || 0, disponivel: precos[i.id]?.disp !== false,
    }));
    const { error: eItens } = await sb.from('cotacao_itens').insert(payload);
    setSaving(false);
    if (eItens) { toast.error('Cotação salva, mas houve erro nos itens.'); return; }
    toast.success(editando ? 'Cotação atualizada!' : 'Cotação registrada!');
    onSaved();
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">{editando ? 'Editar cotação' : 'Registrar cotação'} · {req.numero}</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Campo label="Fornecedor">
            <select className={inp} value={fornId} onChange={(e) => { setFornId(e.target.value); if (e.target.value) setFornNome(''); }}>
              <option value="">Outro (informar nome)</option>
              {fornecedores.map((f) => <option key={f.id} value={f.id}>{fornNomeDe(f)}</option>)}
            </select>
          </Campo>
          {!fornId ? (
            <Campo label="Nome do fornecedor"><input className={inp} value={fornNome} onChange={(e) => setFornNome(e.target.value)} placeholder="Fornecedor sem cadastro" /></Campo>
          ) : (
            <Campo label="Prazo de entrega (dias)" hint="(opcional)"><input type="number" min={0} className={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="Ex.: 7" /></Campo>
          )}
        </div>
        {fornId && (
          <div className="grid grid-cols-2 gap-4">
            <Campo label="Condição de pagamento" hint="(opcional)"><input className={inp} value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="Ex.: 30 dias" /></Campo>
            <Campo label="Validade da proposta" hint="(opcional)"><input type="date" className={inp} value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>
          </div>
        )}
        {!fornId && (
          <div className="grid grid-cols-3 gap-4">
            <Campo label="Prazo (dias)" hint="(opc.)"><input type="number" min={0} className={inp} value={prazo} onChange={(e) => setPrazo(e.target.value)} placeholder="7" /></Campo>
            <Campo label="Condição" hint="(opc.)"><input className={inp} value={condicao} onChange={(e) => setCondicao(e.target.value)} placeholder="30 dias" /></Campo>
            <Campo label="Validade" hint="(opc.)"><input type="date" className={inp} value={validade} onChange={(e) => setValidade(e.target.value)} /></Campo>
          </div>
        )}

        {/* Preços por item */}
        <div className="rounded-xl border border-black/[0.06] p-3">
          <div className="mb-2 text-sm font-semibold text-ink-soft">Preço por item</div>
          <div className="space-y-1.5">
            {itens.map((i) => {
              const p = precos[i.id] || { unit: '', disp: true };
              return (
                <div key={i.id} className="grid grid-cols-[1fr_88px_auto] items-center gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm text-ink-soft">{i.descricao}</div>
                    <div className="text-[0.66rem] text-ink-muted">{i.quantidade} {i.unidade}</div>
                  </div>
                  <input type="number" min={0} step="0.01" disabled={!p.disp} className="rounded-lg border border-black/10 px-2 py-2 text-sm focus:border-brand focus:outline-none disabled:bg-black/[0.03] disabled:text-ink-muted" value={p.unit} onChange={(e) => setPreco(i.id, { unit: e.target.value })} placeholder="unit." />
                  <label className="flex items-center gap-1 text-[0.7rem] text-ink-muted"><input type="checkbox" checked={p.disp} onChange={(e) => setPreco(i.id, { disp: e.target.checked })} className="h-3.5 w-3.5 rounded border-black/20 text-brand focus:ring-brand/30" /> tem</label>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-end gap-2 border-t border-black/[0.06] pt-2 text-sm">
            <span className="text-ink-muted">Total da cotação</span>
            <span className="font-bold text-ink">{formatMoney(total)}</span>
          </div>
        </div>

        <Campo label="Anexo da proposta" hint="(opcional)">
          {editando?.anexo_url && !removerAnexo && !file && (
            <div className="mb-2 flex items-center justify-between rounded-lg bg-black/[0.03] px-3 py-2 text-xs">
              <span className="truncate font-medium text-ink-soft">{editando.anexo_nome || 'Anexo'}</span>
              <button type="button" onClick={() => setRemoverAnexo(true)} className="ml-2 shrink-0 text-ink-muted hover:text-red-600">Remover</button>
            </div>
          )}
          <input type="file" accept="image/*,application/pdf" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setRemoverAnexo(false); }} className="block w-full text-xs text-ink-muted file:mr-3 file:rounded-lg file:border-0 file:bg-black/[0.04] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-ink-soft" />
        </Campo>
        <Campo label="Observações" hint="(opcional)"><textarea className={inp} rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Campo>
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Salvando…' : 'Salvar cotação'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

// ── Modal: solicitar cotação (e-mail/WhatsApp com a lista de itens) ───────────
function SolicitarModal({ req, itens, fornecedores, onClose }: { req: Requisicao; itens: RequisicaoItem[]; fornecedores: FornecedorLite[]; onClose: () => void }) {
  const toast = useToast();
  const corpo = useMemo(() => {
    const linhas = itens.map((i) => `• ${i.quantidade} ${i.unidade} — ${i.descricao}`).join('\n');
    return `Olá! Gostaríamos de uma cotação para os itens abaixo (ref. ${req.numero}):\n\n${linhas}\n\nPor favor, informe preço unitário, prazo de entrega e condições de pagamento. Obrigado!`;
  }, [itens, req]);
  const assunto = `Solicitação de cotação — ${req.numero}`;
  const comContato = fornecedores.filter((f) => f.email || f.whatsapp);

  async function copiar() {
    try { await navigator.clipboard.writeText(corpo); toast.success('Lista copiada.'); } catch { toast.error('Não foi possível copiar.'); }
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-1 font-display text-xl font-bold text-ink">Solicitar cotação</h3>
      <p className="mb-4 text-xs text-ink-muted">Dispare a lista de itens da {req.numero} para os fornecedores por e-mail ou WhatsApp.</p>
      <div className="mb-4 max-h-32 overflow-y-auto whitespace-pre-wrap rounded-xl border border-black/[0.06] bg-black/[0.02] p-3 text-xs text-ink-soft">{corpo}</div>
      <button onClick={copiar} className="mb-4 inline-flex items-center gap-1.5 rounded-lg border border-black/10 px-3 py-1.5 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand"><IcoPaperclip /> Copiar lista</button>
      {comContato.length === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Nenhum fornecedor ativo com e-mail/WhatsApp cadastrado. Adicione contatos em Fornecedores.</p>
      ) : (
        <div className="max-h-56 space-y-1.5 overflow-y-auto">
          {comContato.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.06] px-3 py-2">
              <span className="min-w-0 truncate text-sm text-ink-soft">{fornNomeDe(f)}</span>
              <div className="flex shrink-0 gap-1.5">
                {mailLink(f.email, assunto, corpo) && <a href={mailLink(f.email, assunto, corpo)!} className="rounded-lg border border-black/10 px-2.5 py-1 text-xs font-semibold text-ink-soft hover:border-brand/30 hover:text-brand">E-mail</a>}
                {waLink(f.whatsapp, corpo) && <a href={waLink(f.whatsapp, corpo)!} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100">WhatsApp</a>}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="mt-6 flex justify-end"><button onClick={onClose} className="text-sm font-medium text-ink-muted hover:text-ink">Fechar</button></div>
    </ModalShell>
  );
}

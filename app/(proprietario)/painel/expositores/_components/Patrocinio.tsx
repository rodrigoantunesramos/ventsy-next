'use client';

// Aba "Patrocínio" — cotas (Master/Ouro/Prata/Bronze/Apoio) com preço, vagas e
// ENTREGÁVEIS (contrapartidas), o pipeline de venda por patrocinador e o
// CHECKLIST de entrega de cada item por marca. Faturar/estornar (→ Financeiro) e
// gerar contrato (→ Contratos) por patrocinador. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatMoneyShort } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type ExpoBag, type Cota, type Patrocinador, type Entregavel,
  PATROCINADOR_STATUS_META, patrocinadorStatusMeta, COTA_PRESETS,
  resumoCota, resumoPatrocinio, progressoEntregaveis, marcarEntregavel, receitaPatrocinador,
  faturar, estornar, gerarContrato,
  criarCota, salvarCota, excluirCota, criarPatrocinador, salvarPatrocinador, excluirPatrocinador,
  inp, selCls,
} from '../_lib';
import {
  Kpi, Progress, ModalShell, Campo, EmptyState, Chip, btnPrimary, btnSecondary, btnGhost,
  IcoStar, IcoHandshake, IcoMoney, IcoPlus, IcoEdit, IcoTrash, IcoSign, IcoCheckCircle,
} from './ui';

const slug = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'item';

export default function Patrocinio({ bag }: { bag: ExpoBag }) {
  const { cotas, patrocinadores } = bag;
  const [showCota, setShowCota] = useState(false);
  const [editCota, setEditCota] = useState<Cota | null>(null);
  const [showPatro, setShowPatro] = useState(false);
  const [editPatro, setEditPatro] = useState<Patrocinador | null>(null);

  const resumo = useMemo(() => resumoPatrocinio(cotas, patrocinadores), [cotas, patrocinadores]);
  const cotaById = useMemo(() => new Map(cotas.map((c) => [c.id, c])), [cotas]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cotas" value={String(resumo.cotas)} tone="roxo" icon={<IcoStar />}
          sub={resumo.vagasTotais == null ? 'vagas ilimitadas' : `${resumo.vagasTotais} vagas`} />
        <Kpi label="Vendidas" value={String(resumo.vendidas)} tone="verde" icon={<IcoHandshake />} />
        <Kpi label="Receita realizada" value={formatMoneyShort(resumo.receitaRealizada)} tone="brand" icon={<IcoMoney />} />
        <Kpi label="Pipeline" value={formatMoneyShort(resumo.receitaPipeline)} tone="sky"
          sub={`${formatMoneyShort(resumo.receitaPotencialMapa)} em vagas abertas`} />
      </div>

      {/* ── Cotas ── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Cotas de patrocínio</h2>
          <button onClick={() => { setEditCota(null); setShowCota(true); }} className={btnGhost}><IcoPlus /> Nova cota</button>
        </div>
        {cotas.length === 0 ? (
          <EmptyState icon={<IcoStar />} title="Crie as cotas de patrocínio"
            cta={<button onClick={() => { setEditCota(null); setShowCota(true); }} className={btnPrimary}><IcoPlus /> Nova cota</button>}>
            Defina os pacotes (Master, Ouro, Prata…) com preço, número de vagas e os entregáveis prometidos à marca.
          </EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cotas.map((c) => (
              <CotaCard key={c.id} cota={c} patrocinadores={patrocinadores}
                onEditar={() => { setEditCota(c); setShowCota(true); }} bag={bag} />
            ))}
          </div>
        )}
      </section>

      {/* ── Patrocinadores ── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-ink-muted">Patrocinadores</h2>
          <button onClick={() => { setEditPatro(null); setShowPatro(true); }} disabled={cotas.length === 0} className={btnGhost}><IcoPlus /> Novo patrocinador</button>
        </div>
        {patrocinadores.length === 0 ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-ink-muted shadow-card">
            {cotas.length === 0 ? 'Crie ao menos uma cota para começar a vender patrocínio.' : 'Nenhum patrocinador ainda. Clique em “Novo patrocinador”.'}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {patrocinadores.map((p) => (
              <PatrocinadorCard key={p.id} patro={p} cota={p.cota_id ? cotaById.get(p.cota_id) || null : null}
                bag={bag} onEditar={() => { setEditPatro(p); setShowPatro(true); }} />
            ))}
          </div>
        )}
      </section>

      {showCota && <CotaFormModal bag={bag} cota={editCota} onClose={() => setShowCota(false)} />}
      {showPatro && <PatrocinadorFormModal bag={bag} patro={editPatro} onClose={() => setShowPatro(false)} />}
    </div>
  );
}

// ── Card da cota ────────────────────────────────────────────────────────────────
function CotaCard({ cota, patrocinadores, onEditar, bag }: { cota: Cota; patrocinadores: Patrocinador[]; onEditar: () => void; bag: ExpoBag }) {
  const toast = useToast();
  const r = resumoCota(cota, patrocinadores);
  const cor = cota.cor || '#7c3aed';
  const onExcluir = async () => {
    if (!window.confirm(`Excluir a cota ${cota.nome}? Os patrocinadores ficam sem cota.`)) return;
    const { error } = await excluirCota(cota.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    await bag.recarregar();
    toast.success('Cota excluída.');
  };
  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-3.5 w-3.5 rounded-full" style={{ background: cor }} />
          <span className="text-base font-bold text-ink">{cota.nome}</span>
        </div>
        {r.esgotada ? <Chip className="bg-red-50 text-red-600">Esgotada</Chip>
          : <Chip className="bg-emerald-50 text-emerald-700">{r.disponiveis == null ? 'Ilimitada' : `${r.disponiveis} vaga(s)`}</Chip>}
      </div>
      <div className="mt-2 text-xl font-bold text-ink">{formatMoneyShort(Number(cota.preco_num) || 0)}</div>
      <div className="mt-1 text-xs text-ink-muted">
        {r.vendidas}{cota.quantidade != null ? `/${cota.quantidade}` : ''} vendida(s) · {formatMoneyShort(r.receita)} realizado
      </div>
      {cota.entregaveis.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-black/[0.06] pt-3 text-[0.78rem] text-ink-soft">
          {cota.entregaveis.slice(0, 5).map((e) => (
            <li key={e.chave} className="flex items-center gap-1.5"><span className="text-violet-500">•</span>{e.nome}{e.qtd ? ` (${e.qtd})` : ''}</li>
          ))}
          {cota.entregaveis.length > 5 && <li className="text-ink-muted">+{cota.entregaveis.length - 5} entregável(is)…</li>}
        </ul>
      )}
      <div className="mt-3 flex items-center justify-end gap-1 border-t border-black/[0.06] pt-2">
        <button onClick={onEditar} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
        <button onClick={onExcluir} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
      </div>
    </div>
  );
}

// ── Card do patrocinador (com checklist de entregáveis) ─────────────────────────
function PatrocinadorCard({ patro, cota, bag, onEditar }: { patro: Patrocinador; cota: Cota | null; bag: ExpoBag; onEditar: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const meta = patrocinadorStatusMeta(patro.status);
  const prog = progressoEntregaveis(cota, patro);
  const valor = receitaPatrocinador(patro, cota ? [cota] : []);

  const toggleEntregavel = async (chave: string, entregue: boolean) => {
    const next = marcarEntregavel(patro.entregaveis_status, chave, {
      entregue, data: entregue ? new Date().toISOString().slice(0, 10) : null,
    });
    const { error } = await salvarPatrocinador(patro.id, { entregaveis_status: next });
    if (error) { toast.error('Não foi possível salvar o entregável.'); return; }
    await bag.recarregar();
  };

  const action = async (fn: () => Promise<{ ok: boolean; error?: string; [k: string]: unknown }>, okMsg: (r: Record<string, unknown>) => string, failMap: Record<string, string> = {}) => {
    setBusy(true);
    try {
      const r = await fn();
      if (r.ok) { toast.success(okMsg(r)); await bag.recarregar(); }
      else toast.error(failMap[r.error || ''] || r.error || 'Não foi possível concluir.');
    } finally { setBusy(false); }
  };

  const onExcluir = async () => {
    if (!window.confirm(`Excluir o patrocinador ${patro.marca}?`)) return;
    const { error } = await excluirPatrocinador(patro.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    await bag.recarregar();
    toast.success('Patrocinador excluído.');
  };

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-base font-bold text-ink">{patro.marca}</div>
          <div className="truncate text-xs text-ink-muted">
            {cota ? cota.nome : 'Sem cota'} · {formatMoneyShort(valor)}{patro.contato ? ` · ${patro.contato}` : ''}
          </div>
        </div>
        <Chip className={meta.chip}>{meta.label}</Chip>
      </div>

      {/* checklist de entregáveis */}
      {cota && cota.entregaveis.length > 0 ? (
        <div className="mt-3 border-t border-black/[0.06] pt-3">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-ink-soft">Entregáveis</span>
            <span className="text-ink-muted">{prog.entregues}/{prog.total}</span>
          </div>
          <Progress value={prog.pct} tone={prog.pct >= 1 ? 'verde' : 'roxo'} />
          <ul className="mt-2 space-y-1">
            {cota.entregaveis.map((e) => {
              const on = !!patro.entregaveis_status[e.chave]?.entregue;
              return (
                <li key={e.chave}>
                  <label className="flex cursor-pointer items-center gap-2 text-sm">
                    <input type="checkbox" checked={on} onChange={(ev) => toggleEntregavel(e.chave, ev.target.checked)} className="accent-emerald-600" />
                    <span className={on ? 'text-ink-muted line-through' : 'text-ink-soft'}>{e.nome}{e.qtd ? ` (${e.qtd})` : ''}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="mt-3 border-t border-black/[0.06] pt-3 text-[0.7rem] text-ink-muted">
          {cota ? 'Esta cota não tem entregáveis cadastrados.' : 'Vincule uma cota para ver os entregáveis.'}
        </div>
      )}

      {/* status de integração + ações */}
      <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-black/[0.06] pt-3">
        {patro.lancamento_id
          ? <button disabled={busy} onClick={() => action(() => estornar('patrocinador', patro.id), () => 'Fatura estornada.')} className={`${btnGhost} text-ink-muted`}>Estornar</button>
          : <button disabled={busy} onClick={() => action(() => faturar('patrocinador', patro.id), (r) => r.ja_faturado ? 'Já faturado.' : `Receita lançada: ${formatMoneyShort(Number(r.valor) || 0)}.`)} className={`${btnGhost} text-emerald-700`}><IcoMoney /> Faturar</button>}
        {!patro.contrato_id && (
          <button disabled={busy} onClick={() => action(() => gerarContrato('patrocinador', patro.id), (r) => r.ja_gerado ? 'Contrato já gerado.' : `Contrato ${r.numero || ''} gerado.`, { modulo_contratos_indisponivel: 'Ative o módulo Contratos para gerar contratos.' })} className={`${btnGhost} text-ink-soft`}><IcoSign /> Contrato</button>
        )}
        {patro.contrato_id && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-700"><IcoSign /> Contrato</span>}
        {patro.lancamento_id && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-700"><IcoCheckCircle /> Faturado</span>}
        <span className="ml-auto flex items-center gap-1">
          <button onClick={onEditar} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoEdit /></button>
          <button onClick={onExcluir} aria-label="Excluir" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
        </span>
      </div>
    </div>
  );
}

// ── Modal: criar/editar cota (com editor de entregáveis) ────────────────────────
function CotaFormModal({ bag, cota, onClose }: { bag: ExpoBag; cota: Cota | null; onClose: () => void }) {
  const toast = useToast();
  const editing = !!cota;
  const [nome, setNome] = useState(cota?.nome || '');
  const [preco, setPreco] = useState(cota?.preco_num != null ? String(cota.preco_num) : '');
  const [quantidade, setQuantidade] = useState(cota?.quantidade != null ? String(cota.quantidade) : '');
  const [cor, setCor] = useState(cota?.cor || '#7c3aed');
  const [entregaveis, setEntregaveis] = useState<Entregavel[]>(cota?.entregaveis || []);
  const [saving, setSaving] = useState(false);

  const addItem = () => setEntregaveis((s) => [...s, { chave: `item_${s.length + 1}`, nome: '', qtd: null }]);
  const setItem = (i: number, patch: Partial<Entregavel>) => setEntregaveis((s) => s.map((e, idx) => idx === i ? { ...e, ...patch } : e));
  const delItem = (i: number) => setEntregaveis((s) => s.filter((_, idx) => idx !== i));

  const aplicarPreset = (nomePreset: string) => {
    const p = COTA_PRESETS.find((c) => c.nome === nomePreset);
    if (!p) return;
    setNome(p.nome); setCor(p.cor); setEntregaveis(p.entregaveis.map((e) => ({ ...e })));
  };

  const submit = async () => {
    if (!nome.trim()) { toast.error('Informe o nome da cota.'); return; }
    setSaving(true);
    try {
      // normaliza chaves dos entregáveis (slug do nome quando vazia/duplicada)
      const seen = new Set<string>();
      const ents = entregaveis.filter((e) => (e.nome || '').trim()).map((e) => {
        let k = (e.chave || slug(e.nome)).trim() || slug(e.nome);
        while (seen.has(k)) k = `${k}_`;
        seen.add(k);
        return { chave: k, nome: e.nome.trim(), qtd: e.qtd ? Number(e.qtd) : null };
      });
      const payload = {
        nome: nome.trim(), preco_num: preco ? Number(preco) : 0,
        quantidade: quantidade === '' ? null : Math.max(0, Number(quantidade) || 0),
        cor, entregaveis: ents,
      };
      if (editing && cota) {
        const { error } = await salvarCota(cota.id, payload);
        if (error) throw error;
      } else {
        const { error } = await criarCota({ ...payload, usuario_id: bag.userId, evento_id: bag.evento.id, ordem: bag.cotas.length });
        if (error) throw error;
      }
      await bag.recarregar();
      toast.success(editing ? 'Cota atualizada.' : 'Cota criada.');
      onClose();
    } catch (e) {
      toast.error((e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '') || 'Não foi possível salvar.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="mb-1 text-lg font-bold text-ink">{editing ? 'Editar cota' : 'Nova cota'}</h3>
      {!editing && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <span className="self-center text-xs text-ink-muted">Começar de:</span>
          {COTA_PRESETS.map((p) => (
            <button key={p.nome} onClick={() => aplicarPreset(p.nome)} className="rounded-full border border-black/10 px-2.5 py-1 text-xs font-semibold hover:border-brand hover:text-brand">{p.nome}</button>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Campo label="Nome"><input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} placeholder="Master, Ouro…" /></Campo>
        <Campo label="Preço"><input type="number" min={0} value={preco} onChange={(e) => setPreco(e.target.value)} className={inp} placeholder="0" /></Campo>
        <Campo label="Vagas" hint="Vazio = ilimitada"><input type="number" min={0} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} className={inp} placeholder="∞" /></Campo>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-ink-soft">Cor</span>
        <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-8 w-12 cursor-pointer rounded border border-black/10" />
      </div>

      <div className="mt-4 rounded-xl border border-black/[0.06] p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-soft">Entregáveis (contrapartidas)</span>
          <button onClick={addItem} className={btnGhost}><IcoPlus /> Adicionar</button>
        </div>
        {entregaveis.length === 0 && <div className="py-2 text-center text-xs text-ink-muted">Nenhum entregável. Adicione as contrapartidas prometidas à marca.</div>}
        <div className="space-y-2">
          {entregaveis.map((e, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={e.nome} onChange={(ev) => setItem(i, { nome: ev.target.value })} className={`${inp} flex-1`} placeholder="Ex.: Logo no palco principal" />
              <input type="number" min={0} value={e.qtd ?? ''} onChange={(ev) => setItem(i, { qtd: ev.target.value ? Number(ev.target.value) : null })} className={`${inp} w-20`} placeholder="qtd" />
              <button onClick={() => delItem(i)} aria-label="Remover" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button disabled={saving} onClick={submit} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

// ── Modal: criar/editar patrocinador ────────────────────────────────────────────
function PatrocinadorFormModal({ bag, patro, onClose }: { bag: ExpoBag; patro: Patrocinador | null; onClose: () => void }) {
  const toast = useToast();
  const editing = !!patro;
  const [f, setF] = useState({
    marca: patro?.marca || '', contato: patro?.contato || '', email: patro?.email || '', telefone: patro?.telefone || '',
    cota_id: patro?.cota_id || bag.cotas[0]?.id || '', valor: patro?.valor_num != null ? String(patro.valor_num) : '',
    status: String(patro?.status || 'prospecto'),
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));
  const cotaSel = bag.cotas.find((c) => c.id === f.cota_id);

  const submit = async () => {
    if (!f.marca.trim()) { toast.error('Informe a marca.'); return; }
    setSaving(true);
    try {
      const payload = {
        marca: f.marca.trim(), contato: f.contato.trim() || null, email: f.email.trim() || null,
        telefone: f.telefone.trim() || null, cota_id: f.cota_id || null,
        valor_num: f.valor ? Number(f.valor) : 0, status: f.status,
      };
      if (editing && patro) {
        const { error } = await salvarPatrocinador(patro.id, payload);
        if (error) throw error;
      } else {
        const { error } = await criarPatrocinador({ ...payload, usuario_id: bag.userId, evento_id: bag.evento.id, entregaveis_status: {} });
        if (error) throw error;
      }
      await bag.recarregar();
      toast.success(editing ? 'Patrocinador atualizado.' : 'Patrocinador cadastrado.');
      onClose();
    } catch (e) {
      toast.error((e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : '') || 'Não foi possível salvar.');
    } finally { setSaving(false); }
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-4 text-lg font-bold text-ink">{editing ? 'Editar patrocinador' : 'Novo patrocinador'}</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Campo label="Marca" full><input value={f.marca} onChange={(e) => set('marca', e.target.value)} className={inp} placeholder="Nome da marca" /></Campo>
        <Campo label="Cota">
          <select value={f.cota_id} onChange={(e) => set('cota_id', e.target.value)} className={`${selCls} w-full`}>
            <option value="">— Sem cota —</option>
            {bag.cotas.map((c) => <option key={c.id} value={c.id}>{c.nome} ({formatMoneyShort(Number(c.preco_num) || 0)})</option>)}
          </select>
        </Campo>
        <Campo label="Valor" hint={cotaSel ? `Vazio usa o preço da cota (${formatMoneyShort(Number(cotaSel.preco_num) || 0)}).` : undefined}>
          <input type="number" min={0} value={f.valor} onChange={(e) => set('valor', e.target.value)} className={inp} placeholder={cotaSel ? String(cotaSel.preco_num ?? 0) : '0'} />
        </Campo>
        <Campo label="Contato"><input value={f.contato} onChange={(e) => set('contato', e.target.value)} className={inp} placeholder="Responsável" /></Campo>
        <Campo label="E-mail"><input value={f.email} onChange={(e) => set('email', e.target.value)} className={inp} placeholder="marketing@marca.com" /></Campo>
        <Campo label="Telefone"><input value={f.telefone} onChange={(e) => set('telefone', e.target.value)} className={inp} placeholder="(00) 00000-0000" /></Campo>
        <Campo label="Status">
          <select value={f.status} onChange={(e) => set('status', e.target.value)} className={`${selCls} w-full`}>
            {Object.entries(PATROCINADOR_STATUS_META).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </Campo>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button disabled={saving} onClick={submit} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

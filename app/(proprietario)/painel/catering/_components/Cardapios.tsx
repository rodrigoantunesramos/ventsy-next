'use client';

// Aba Cardápios — biblioteca GLOBAL de cardápios/pacotes (reutilizáveis entre
// eventos). Cada cardápio tem itens com FICHA TÉCNICA (insumos → produtos do
// Estoque), custo/pessoa derivado da ficha e preço/pessoa do pacote (que alimenta
// a Proposta/Precificação via item `por_pessoa`). Sem "R$" hardcoded — lib/format.

import { useMemo, useState } from 'react';
import { formatMoney, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Cardapio, type CardapioItem, type FichaInsumo, type ProdutoLite, type CardapioTipo,
  CARDAPIO_TIPOS, ITEM_CATEGORIAS, RESTRICOES, TEMPLATES_CARDAPIO,
  custoItemPorPessoa, custoCardapioPorPessoa, precoCardapioPorPessoa, foodCost, margemBruta,
  cardapioTipoLabel,
  criarCardapio, salvarCardapio, excluirCardapio, cryptoId, inp, inpSm, selCls,
} from '../_lib';
import {
  Kpi, ModalShell, EmptyState, Chip, btnPrimary, btnSecondary, btnGhost,
  IcoUtensils, IcoPlus, IcoEdit, IcoTrash, IcoCopy, IcoBox, IcoSparkle, IcoLeaf,
} from './ui';

type Props = { userId: string; cardapios: Cardapio[]; produtos: ProdutoLite[]; recarregar: () => Promise<void> };

export default function Cardapios({ userId, cardapios, produtos, recarregar }: Props) {
  const toast = useToast();
  const [editando, setEditando] = useState<Cardapio | null>(null);
  const [novoMenu, setNovoMenu] = useState(false);

  const kpis = useMemo(() => {
    const n = cardapios.length;
    const custoMedio = n ? cardapios.reduce((s, c) => s + custoCardapioPorPessoa(c), 0) / n : 0;
    const precoMedio = n ? cardapios.reduce((s, c) => s + precoCardapioPorPessoa(c), 0) / n : 0;
    return { n, custoMedio, precoMedio, foodCost: foodCost(custoMedio, precoMedio) };
  }, [cardapios]);

  const novoEmBranco = () => {
    setNovoMenu(false);
    setEditando({ id: '', nome: '', tipo: 'buffet', itens: [], preco_pessoa_num: 0 });
  };
  const novoDeTemplate = (idx: number) => {
    const t = TEMPLATES_CARDAPIO[idx];
    setNovoMenu(false);
    // Clona o template com ids locais novos (evita colisão entre instâncias).
    setEditando({
      id: '', nome: t.nome, tipo: t.tipo, preco_pessoa_num: t.preco_pessoa_num,
      itens: t.itens.map((it) => ({ ...it, id: cryptoId(), ficha: it.ficha.map((f) => ({ ...f })) })),
    });
  };
  const duplicar = (c: Cardapio) => {
    setEditando({
      id: '', nome: `${c.nome} (cópia)`, tipo: c.tipo, preco_pessoa_num: c.preco_pessoa_num,
      itens: c.itens.map((it) => ({ ...it, id: cryptoId(), ficha: it.ficha.map((f) => ({ ...f })) })),
    });
  };
  const remover = async (c: Cardapio) => {
    if (!window.confirm(`Excluir o cardápio "${c.nome}"?`)) return;
    const { error } = await excluirCardapio(c.id);
    if (error) { toast.error('Não foi possível excluir.'); return; }
    toast.success('Cardápio excluído.');
    await recarregar();
  };

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Cardápios" value={String(kpis.n)} tone="brand" icon={<IcoUtensils />} />
        <Kpi label="Custo médio / pessoa" value={formatMoney(kpis.custoMedio)} tone="ink" icon={<IcoBox />} />
        <Kpi label="Preço médio / pessoa" value={formatMoney(kpis.precoMedio)} tone="verde" />
        <Kpi label="Food cost médio" value={formatPercent(kpis.foodCost)} tone={kpis.foodCost > 0.4 ? 'vermelho' : 'gold'} sub="custo ÷ preço" />
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-muted">Monte cardápios com ficha técnica; o custo/pessoa vem dos insumos e liga ao Estoque.</p>
        <div className="relative">
          <button onClick={() => setNovoMenu((v) => !v)} className={btnPrimary}><IcoPlus /> Novo cardápio</button>
          {novoMenu && (
            <>
              <div className="fixed inset-0 z-[40]" onClick={() => setNovoMenu(false)} />
              <div className="absolute right-0 z-[41] mt-2 w-72 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-pop">
                <button onClick={novoEmBranco} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-black/[0.03]">
                  <IcoPlus /> Em branco
                </button>
                <div className="px-3 pb-1 pt-2 text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted/70">A partir de um modelo</div>
                {TEMPLATES_CARDAPIO.map((t, i) => (
                  <button key={t.nome} onClick={() => novoDeTemplate(i)} className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left hover:bg-black/[0.03]">
                    <span className="mt-0.5 text-brand"><IcoSparkle /></span>
                    <span>
                      <span className="block text-sm font-medium text-ink">{t.nome}</span>
                      <span className="block text-[0.7rem] text-ink-muted">{t.descricao}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Lista */}
      {cardapios.length === 0 ? (
        <EmptyState icon={<IcoUtensils />} title="Nenhum cardápio ainda"
          cta={<button onClick={() => setNovoMenu(true)} className={btnPrimary}><IcoPlus /> Criar primeiro cardápio</button>}>
          Crie um cardápio do zero ou parta de um modelo (coquetel, jantar, churrasco, coffee). A ficha técnica de cada prato vira custo por pessoa e lista de compras.
        </EmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {cardapios.map((c) => {
            const custo = custoCardapioPorPessoa(c);
            const preco = precoCardapioPorPessoa(c);
            const fc = foodCost(custo, preco);
            return (
              <div key={c.id} className="flex flex-col rounded-2xl bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-bold text-ink">{c.nome || 'Sem nome'}</div>
                    <Chip className="mt-1 bg-brand-50 text-brand">{cardapioTipoLabel(c.tipo)}</Chip>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => setEditando(c)} aria-label="Editar" className={btnGhost}><IcoEdit /></button>
                    <button onClick={() => duplicar(c)} aria-label="Duplicar" className={btnGhost}><IcoCopy /></button>
                    <button onClick={() => remover(c)} aria-label="Excluir" className={`${btnGhost} text-red-500 hover:bg-red-50`}><IcoTrash /></button>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Itens" value={String(c.itens.length)} />
                  <Mini label="Custo/pes." value={formatMoney(custo)} />
                  <Mini label="Preço/pes." value={preco > 0 ? formatMoney(preco) : '—'} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-black/[0.05] pt-2 text-[0.72rem]">
                  <span className="text-ink-muted">Food cost</span>
                  <span className={`font-bold ${fc > 0.4 ? 'text-red-600' : fc > 0 ? 'text-emerald-600' : 'text-ink-muted'}`}>
                    {preco > 0 ? formatPercent(fc) : '—'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editando && (
        <CardapioEditor
          userId={userId}
          cardapio={editando}
          produtos={produtos}
          onClose={() => setEditando(null)}
          onSaved={async () => { setEditando(null); await recarregar(); }}
        />
      )}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/[0.03] py-1.5">
      <div className="text-sm font-bold text-ink">{value}</div>
      <div className="text-[0.62rem] text-ink-muted">{label}</div>
    </div>
  );
}

// ── Editor (cria/edita um cardápio com itens + ficha técnica) ─────────────────
function CardapioEditor({ userId, cardapio, produtos, onClose, onSaved }: {
  userId: string; cardapio: Cardapio; produtos: ProdutoLite[]; onClose: () => void; onSaved: () => Promise<void>;
}) {
  const toast = useToast();
  const [nome, setNome] = useState(cardapio.nome);
  const [tipo, setTipo] = useState<CardapioTipo>(cardapio.tipo);
  const [preco, setPreco] = useState(cardapio.preco_pessoa_num);
  const [itens, setItens] = useState<CardapioItem[]>(cardapio.itens);
  const [saving, setSaving] = useState(false);

  const custo = useMemo(() => custoCardapioPorPessoa({ itens }), [itens]);
  const fc = foodCost(custo, preco);
  const margem = margemBruta(custo, preco);

  const novoItem = () => setItens((xs) => [...xs, {
    id: cryptoId(), nome: '', categoria: 'principal', porcao_por_pessoa: 0, unidade: 'un',
    custo_num: 0, preco_num: 0, incluso: true, restricoes: [], ficha: [],
  }]);
  const patchItem = (id: string, patch: Partial<CardapioItem>) =>
    setItens((xs) => xs.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const removeItem = (id: string) => setItens((xs) => xs.filter((it) => it.id !== id));
  const toggleRestricao = (id: string, r: CardapioItem['restricoes'][number]) =>
    setItens((xs) => xs.map((it) => it.id === id
      ? { ...it, restricoes: it.restricoes.includes(r) ? it.restricoes.filter((x) => x !== r) : [...it.restricoes, r] }
      : it));

  const salvar = async () => {
    if (!nome.trim()) { toast.error('Dê um nome ao cardápio.'); return; }
    setSaving(true);
    const row = {
      usuario_id: userId, nome: nome.trim(), tipo, preco_pessoa_num: Number(preco) || 0,
      itens: itens.map((it) => ({ ...it, restricoes: it.restricoes, ficha: it.ficha })),
    };
    const res = cardapio.id ? await salvarCardapio(cardapio.id, row) : await criarCardapio(row);
    setSaving(false);
    if (res.error) { toast.error('Não foi possível salvar.'); return; }
    toast.success(cardapio.id ? 'Cardápio atualizado.' : 'Cardápio criado.');
    await onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-3xl">
      <h3 className="text-lg font-bold text-ink">{cardapio.id ? 'Editar cardápio' : 'Novo cardápio'}</h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-soft">Nome</span>
          <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} placeholder="Ex.: Jantar empratado premium" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-soft">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as CardapioTipo)} className={selCls}>
            {CARDAPIO_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-soft">Preço / pessoa</span>
          <input type="number" min={0} step="0.01" value={preco || ''} onChange={(e) => setPreco(Number(e.target.value))} className={`${inp} w-32`} placeholder="0,00" />
        </label>
      </div>

      {/* Itens */}
      <div className="mt-5 flex items-center justify-between">
        <h4 className="text-sm font-bold text-ink">Itens & ficha técnica</h4>
        <button onClick={novoItem} className={btnSecondary}><IcoPlus /> Item</button>
      </div>

      <div className="mt-3 max-h-[44vh] space-y-3 overflow-y-auto pr-1">
        {itens.length === 0 && (
          <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-sm text-ink-muted">
            Adicione pratos. A ficha técnica de cada prato (insumos do Estoque × porção por pessoa) define o custo.
          </p>
        )}
        {itens.map((it) => (
          <ItemEditor
            key={it.id} item={it} produtos={produtos}
            onPatch={(p) => patchItem(it.id, p)} onRemove={() => removeItem(it.id)} onToggleRestricao={(r) => toggleRestricao(it.id, r)}
          />
        ))}
      </div>

      {/* Rodapé: totais + salvar */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/[0.06] pt-4">
        <div className="flex flex-wrap gap-4 text-sm">
          <Total label="Custo / pessoa" value={formatMoney(custo)} />
          <Total label="Preço / pessoa" value={preco > 0 ? formatMoney(preco) : '—'} />
          <Total label="Food cost" value={preco > 0 ? formatPercent(fc) : '—'} tone={fc > 0.4 ? 'vermelho' : 'gold'} />
          <Total label="Margem" value={preco > 0 ? formatPercent(margem) : '—'} tone="verde" />
        </div>
        <div className="flex gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar cardápio'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function Total({ label, value, tone }: { label: string; value: string; tone?: 'verde' | 'vermelho' | 'gold' }) {
  const cor = tone === 'verde' ? 'text-emerald-600' : tone === 'vermelho' ? 'text-red-600' : tone === 'gold' ? 'text-amber-600' : 'text-ink';
  return (
    <div>
      <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">{label}</div>
      <div className={`text-base font-bold ${cor}`}>{value}</div>
    </div>
  );
}

// ── Editor de um item (nome/categoria/restrições + ficha técnica) ─────────────
function ItemEditor({ item, produtos, onPatch, onRemove, onToggleRestricao }: {
  item: CardapioItem; produtos: ProdutoLite[];
  onPatch: (p: Partial<CardapioItem>) => void; onRemove: () => void; onToggleRestricao: (r: CardapioItem['restricoes'][number]) => void;
}) {
  const custo = custoItemPorPessoa(item);

  const novoInsumo = () => onPatch({ ficha: [...item.ficha, { produto_id: null, nome: '', unidade: 'un', qtd_por_pessoa: 0, custo_unit_num: 0, perda_pct: 0 }] });
  const patchInsumo = (idx: number, patch: Partial<FichaInsumo>) =>
    onPatch({ ficha: item.ficha.map((f, i) => (i === idx ? { ...f, ...patch } : f)) });
  const removeInsumo = (idx: number) => onPatch({ ficha: item.ficha.filter((_, i) => i !== idx) });
  const escolherProduto = (idx: number, produtoId: string) => {
    if (!produtoId) { patchInsumo(idx, { produto_id: null }); return; }
    const p = produtos.find((x) => x.id === produtoId);
    if (!p) { patchInsumo(idx, { produto_id: null }); return; }
    patchInsumo(idx, { produto_id: p.id, nome: p.nome, unidade: p.unidade, custo_unit_num: p.custo_medio_num });
  };

  return (
    <div className="rounded-2xl border border-black/[0.07] bg-black/[0.015] p-3">
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[140px] flex-1 block">
          <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">Prato</span>
          <input value={item.nome} onChange={(e) => onPatch({ nome: e.target.value })} className={inpSm} placeholder="Nome do prato" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-ink-muted">Categoria</span>
          <select value={item.categoria} onChange={(e) => onPatch({ categoria: e.target.value as CardapioItem['categoria'] })} className={`${selCls} py-1.5`}>
            {ITEM_CATEGORIAS.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
          </select>
        </label>
        <div className="text-right">
          <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">Custo/pes.</div>
          <div className="text-sm font-bold text-ink">{formatMoney(custo)}</div>
        </div>
        <button onClick={onRemove} aria-label="Remover prato" className={`${btnGhost} text-red-500 hover:bg-red-50`}><IcoTrash /></button>
      </div>

      {/* Restrições que o prato atende */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold text-ink-muted"><IcoLeaf /> Atende:</span>
        {RESTRICOES.map((r) => {
          const on = item.restricoes.includes(r.v);
          return (
            <button key={r.v} type="button" onClick={() => onToggleRestricao(r.v)}
              className={`rounded-full px-2 py-0.5 text-[0.66rem] font-semibold transition ${on ? 'text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.08]'}`}
              style={on ? { backgroundColor: r.cor } : undefined}>
              {r.label}
            </button>
          );
        })}
      </div>

      {/* Ficha técnica (insumos → Estoque) */}
      <div className="mt-3 rounded-xl bg-white p-2">
        <div className="flex items-center justify-between px-1 pb-1">
          <span className="text-[0.65rem] font-bold uppercase tracking-wide text-ink-muted">Ficha técnica (por pessoa)</span>
          <button onClick={novoInsumo} className={`${btnGhost} text-brand`}><IcoPlus /> Insumo</button>
        </div>
        {item.ficha.length === 0 ? (
          <p className="px-1 py-2 text-[0.72rem] text-ink-muted">Sem ficha — o custo cai no valor manual abaixo.</p>
        ) : (
          <div className="space-y-1.5">
            {item.ficha.map((f, idx) => (
              <div key={idx} className="grid grid-cols-[1fr] gap-1.5 sm:grid-cols-[1.4fr_0.7fr_0.6fr_0.7fr_0.6fr_auto]">
                <select value={f.produto_id || ''} onChange={(e) => escolherProduto(idx, e.target.value)} className={`${inpSm} min-w-0`} title="Produto do Estoque">
                  <option value="">Avulso (não controlado)…</option>
                  {produtos.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                </select>
                {f.produto_id ? (
                  <input value={f.nome} readOnly className={`${inpSm} bg-black/[0.03] text-ink-muted`} title="Insumo do Estoque" />
                ) : (
                  <input value={f.nome} onChange={(e) => patchInsumo(idx, { nome: e.target.value })} className={inpSm} placeholder="Insumo" />
                )}
                <input type="number" min={0} step="0.001" value={f.qtd_por_pessoa || ''} onChange={(e) => patchInsumo(idx, { qtd_por_pessoa: Number(e.target.value) })} className={inpSm} placeholder="Qtd" title="Quantidade por pessoa" />
                <input value={f.unidade} onChange={(e) => patchInsumo(idx, { unidade: e.target.value })} className={inpSm} placeholder="un" title="Unidade" readOnly={!!f.produto_id} />
                <input type="number" min={0} step="0.01" value={f.custo_unit_num || ''} onChange={(e) => patchInsumo(idx, { custo_unit_num: Number(e.target.value) })} className={inpSm} placeholder="Custo" title="Custo unitário" />
                <button onClick={() => removeInsumo(idx)} aria-label="Remover insumo" className={`${btnGhost} text-red-400 hover:bg-red-50`}><IcoTrash /></button>
              </div>
            ))}
            <p className="px-1 pt-0.5 text-[0.66rem] text-ink-muted">Insumo do Estoque puxa o custo médio; perda/quebra é opcional por insumo.</p>
          </div>
        )}
        {item.ficha.length === 0 && (
          <div className="mt-1 flex items-center gap-2 px-1">
            <span className="text-[0.65rem] font-semibold text-ink-muted">Custo manual/pessoa</span>
            <input type="number" min={0} step="0.01" value={item.custo_num || ''} onChange={(e) => onPatch({ custo_num: Number(e.target.value) })} className={`${inpSm} w-28`} placeholder="0,00" />
          </div>
        )}
      </div>
    </div>
  );
}

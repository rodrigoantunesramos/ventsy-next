'use client';

// Modais do módulo Bilheteria: editor da bilheteria, categoria/lote, cupom e
// emissão manual (cortesia/balcão). Estado controlado localmente; persistência
// fica nas mutações da page.tsx (RLS). Sem "R$" hardcoded — preços são números
// crus na moeda da bilheteria (a formatação fica nas listagens via lib/format).

import { useEffect, useState, type ReactNode } from 'react';
import type { BilheteriaEvento, Categoria, Cupom, CampoExtra } from '@/lib/bilheteria';
import type { EventoLite } from '../_lib';
import { eventoLabel } from '../_lib';
import { IcoX, IcoPlus, IcoTrash } from './Icons';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const lbl = 'mb-1 block text-xs font-semibold text-ink-soft';

// ── Helpers de data (timestamptz ↔ input datetime-local) ──
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// ── Shell genérico (backdrop + Esc + scroll) ──
function ModalShell({ titulo, sub, onClose, children, footer, wide }: { titulo: string; sub?: string; onClose: () => void; children: ReactNode; footer: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`flex max-h-[92vh] w-full flex-col rounded-t-3xl bg-white shadow-pop sm:rounded-3xl ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}>
        <div className="flex items-start justify-between gap-3 border-b border-black/[0.06] p-5">
          <div>
            <h3 className="font-display text-xl font-bold text-ink">{titulo}</h3>
            {sub && <p className="mt-0.5 text-sm text-ink-muted">{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04]"><IcoX /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="flex items-center justify-end gap-3 border-t border-black/[0.06] p-4">{footer}</div>
      </div>
    </div>
  );
}

const btnPrim = 'rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-50';
const btnGhost = 'text-sm font-medium text-ink-muted hover:text-ink';

// ════════════════════ BILHETERIA ════════════════════
export function BilheteriaModal({ editing, eventos, defaultMoeda, onClose, onSave }: {
  editing: BilheteriaEvento | null; eventos: EventoLite[]; defaultMoeda: string;
  onClose: () => void; onSave: (p: Partial<BilheteriaEvento>) => void;
}) {
  const [titulo, setTitulo] = useState(editing?.titulo || '');
  const [descricao, setDescricao] = useState(editing?.descricao || '');
  const [eventoId, setEventoId] = useState(editing?.evento_id || '');
  const [local, setLocal] = useState(editing?.local_texto || '');
  const [imagem, setImagem] = useState(editing?.imagem_url || '');
  const [capacidade, setCapacidade] = useState(String(editing?.capacidade || 0));
  const [vendaIni, setVendaIni] = useState(toLocalInput(editing?.venda_inicio));
  const [vendaFim, setVendaFim] = useState(toLocalInput(editing?.venda_fim));
  const [taxa, setTaxa] = useState(String(((editing?.taxa_servico || 0) * 100)));
  const [moeda, setMoeda] = useState(editing?.moeda || defaultMoeda || 'BRL');
  const [campos, setCampos] = useState<CampoExtra[]>(editing?.campos_extras || []);
  const [busy, setBusy] = useState(false);

  function addCampo() { setCampos((c) => [...c, { chave: `campo_${c.length + 1}`, label: '', tipo: 'texto', obrigatorio: false }]); }
  function setCampo(i: number, patch: Partial<CampoExtra>) { setCampos((c) => c.map((x, k) => (k === i ? { ...x, ...patch } : x))); }
  function delCampo(i: number) { setCampos((c) => c.filter((_, k) => k !== i)); }

  function submit() {
    if (!titulo.trim()) return;
    setBusy(true);
    onSave({
      titulo: titulo.trim(), descricao: descricao.trim() || null, evento_id: eventoId || null,
      local_texto: local.trim() || null, imagem_url: imagem.trim() || null,
      capacidade: Math.max(0, parseInt(capacidade) || 0),
      venda_inicio: fromLocalInput(vendaIni), venda_fim: fromLocalInput(vendaFim),
      taxa_servico: Math.min(1, Math.max(0, (parseFloat(taxa) || 0) / 100)),
      moeda, campos_extras: campos.filter((c) => c.label.trim()),
    });
  }

  return (
    <ModalShell wide titulo={editing ? 'Editar bilheteria' : 'Nova bilheteria'} sub="A vitrine e a janela de venda do seu evento." onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={submit} disabled={busy || !titulo.trim()} className={btnPrim}>{editing ? 'Salvar' : 'Criar bilheteria'}</button></>}>
      <div className="space-y-4">
        <div><label className={lbl}>Título *</label><input className={inp} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Corrida 5k Solidária · Show de Aniversário" /></div>
        <div><label className={lbl}>Descrição</label><textarea className={inp} rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Detalhes do evento, regras, o que está incluído…" /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Evento vinculado</label>
            <select className={inp} value={eventoId} onChange={(e) => setEventoId(e.target.value)}>
              <option value="">— Sem vínculo —</option>
              {eventos.map((e) => <option key={e.id} value={e.id}>{eventoLabel(e)}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Local</label><input className={inp} value={local} onChange={(e) => setLocal(e.target.value)} placeholder="Cidade · Endereço" /></div>
        </div>
        <div><label className={lbl}>Imagem de capa (URL)</label><input className={inp} value={imagem} onChange={(e) => setImagem(e.target.value)} placeholder="https://…" /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className={lbl}>Capacidade total</label><input className={inp} type="number" min={0} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder="0 = soma dos lotes" /></div>
          <div><label className={lbl}>Taxa de serviço (%)</label><input className={inp} type="number" min={0} step="0.5" value={taxa} onChange={(e) => setTaxa(e.target.value)} /></div>
          <div><label className={lbl}>Moeda</label>
            <select className={inp} value={moeda} onChange={(e) => setMoeda(e.target.value)}><option value="BRL">BRL</option><option value="USD">USD</option><option value="EUR">EUR</option></select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Início das vendas</label><input className={inp} type="datetime-local" value={vendaIni} onChange={(e) => setVendaIni(e.target.value)} /></div>
          <div><label className={lbl}>Fim das vendas</label><input className={inp} type="datetime-local" value={vendaFim} onChange={(e) => setVendaFim(e.target.value)} /></div>
        </div>

        {/* Campos extras por ingresso */}
        <div className="rounded-xl border border-black/[0.06] p-3">
          <div className="mb-2 flex items-center justify-between">
            <div><div className="text-sm font-semibold text-ink">Campos extras por ingresso</div><div className="text-xs text-ink-muted">Ex.: tamanho da camiseta (corrida), modelo do carro (expo), registro ANAC (fly-in).</div></div>
            <button onClick={addCampo} className="inline-flex items-center gap-1 rounded-lg border border-black/10 px-2.5 py-1.5 text-xs font-semibold hover:border-brand/40 hover:text-brand"><IcoPlus size={14} /> Campo</button>
          </div>
          {campos.length === 0 ? <p className="py-2 text-center text-xs text-ink-muted">Nenhum campo extra.</p> : (
            <div className="space-y-2">
              {campos.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
                  <input className={inp} value={c.label} onChange={(e) => setCampo(i, { label: e.target.value, chave: e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24) || `campo_${i}` })} placeholder="Pergunta (ex.: Tamanho da camiseta)" />
                  <select className={`${inp} w-auto`} value={c.tipo} onChange={(e) => setCampo(i, { tipo: e.target.value as CampoExtra['tipo'] })}>
                    <option value="texto">Texto</option><option value="opcoes">Opções</option><option value="numero">Número</option>
                  </select>
                  <button onClick={() => delCampo(i)} aria-label="Remover" className="rounded-lg p-2 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash size={15} /></button>
                  {c.tipo === 'opcoes' && (
                    <input className={`${inp} col-span-3`} value={(c.opcoes || []).join(', ')} onChange={(e) => setCampo(i, { opcoes: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} placeholder="Opções separadas por vírgula (P, M, G, GG)" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ModalShell>
  );
}

// ════════════════════ CATEGORIA / LOTE ════════════════════
export function CategoriaModal({ editing, moeda, onClose, onSave }: {
  editing: Categoria | null; moeda: string; onClose: () => void; onSave: (p: Partial<Categoria>) => void;
}) {
  const [nome, setNome] = useState(editing?.nome || '');
  const [descricao, setDescricao] = useState(editing?.descricao || '');
  const [preco, setPreco] = useState(String(editing?.preco_num ?? 0));
  const [quantidade, setQuantidade] = useState(String(editing?.quantidade ?? 0));
  const [lote, setLote] = useState(String(editing?.lote ?? 1));
  const [loteNome, setLoteNome] = useState(editing?.lote_nome || '');
  const [maxPedido, setMaxPedido] = useState(String(editing?.max_por_pedido ?? 0));
  const [meia, setMeia] = useState(editing?.meia ?? false);
  const [meiaPercent, setMeiaPercent] = useState(String(((editing?.meia_percent ?? 0.5) * 100)));
  const [porPessoa, setPorPessoa] = useState(editing?.por_pessoa ?? false);
  const [vendaIni, setVendaIni] = useState(toLocalInput(editing?.venda_inicio));
  const [vendaFim, setVendaFim] = useState(toLocalInput(editing?.venda_fim));
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [kitTxt, setKitTxt] = useState(((editing?.kit as { inclui?: string[] } | null)?.inclui || []).join('\n'));
  const [busy, setBusy] = useState(false);

  function submit() {
    if (!nome.trim()) return;
    setBusy(true);
    const incluiArr = kitTxt.split('\n').map((s) => s.trim()).filter(Boolean);
    onSave({
      nome: nome.trim(), descricao: descricao.trim() || null, preco_num: Math.max(0, parseFloat(preco) || 0),
      quantidade: Math.max(0, parseInt(quantidade) || 0), lote: Math.max(1, parseInt(lote) || 1), lote_nome: loteNome.trim() || null,
      max_por_pedido: Math.max(0, parseInt(maxPedido) || 0), meia, meia_percent: Math.min(1, Math.max(0.01, (parseFloat(meiaPercent) || 50) / 100)),
      por_pessoa: porPessoa, venda_inicio: fromLocalInput(vendaIni), venda_fim: fromLocalInput(vendaFim), ativo,
      kit: incluiArr.length ? { inclui: incluiArr } : null,
    });
  }

  return (
    <ModalShell wide titulo={editing ? 'Editar categoria' : 'Nova categoria / lote'} sub="O preço sobe por lote: crie um lote por onda (1º lote, 2º lote…)." onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={submit} disabled={busy || !nome.trim()} className={btnPrim}>{editing ? 'Salvar' : 'Criar'}</button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Nome *</label><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Pista · Camarote · Inscrição 5k · Mesa" /></div>
          <div><label className={lbl}>Preço ({moeda})</label><input className={inp} type="number" min={0} step="0.01" value={preco} onChange={(e) => setPreco(e.target.value)} /></div>
        </div>
        <div><label className={lbl}>Descrição</label><input className={inp} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que está incluído nesta categoria" /></div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><label className={lbl}>Quantidade</label><input className={inp} type="number" min={0} value={quantidade} onChange={(e) => setQuantidade(e.target.value)} placeholder="0 = ilimitado" /></div>
          <div><label className={lbl}>Lote nº</label><input className={inp} type="number" min={1} value={lote} onChange={(e) => setLote(e.target.value)} /></div>
          <div><label className={lbl}>Nome do lote</label><input className={inp} value={loteNome} onChange={(e) => setLoteNome(e.target.value)} placeholder="1º lote" /></div>
          <div><label className={lbl}>Máx. por pedido</label><input className={inp} type="number" min={0} value={maxPedido} onChange={(e) => setMaxPedido(e.target.value)} placeholder="0 = sem limite" /></div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={lbl}>Abertura (opcional)</label><input className={inp} type="datetime-local" value={vendaIni} onChange={(e) => setVendaIni(e.target.value)} /></div>
          <div><label className={lbl}>Encerramento (opcional)</label><input className={inp} type="datetime-local" value={vendaFim} onChange={(e) => setVendaFim(e.target.value)} /></div>
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="inline-flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={meia} onChange={(e) => setMeia(e.target.checked)} className="rounded border-black/20 text-brand focus:ring-brand/30" /> Permite meia-entrada</label>
          {meia && <div className="flex items-center gap-2 text-sm"><span className="text-ink-muted">a</span><input className={`${inp} w-20`} type="number" min={1} max={99} value={meiaPercent} onChange={(e) => setMeiaPercent(e.target.value)} /><span className="text-ink-muted">% do valor</span></div>}
          <label className="inline-flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={porPessoa} onChange={(e) => setPorPessoa(e.target.checked)} className="rounded border-black/20 text-brand focus:ring-brand/30" /> Exigir titular por ingresso</label>
          <label className="inline-flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded border-black/20 text-brand focus:ring-brand/30" /> Ativa (à venda)</label>
        </div>
        <div><label className={lbl}>Kit / itens inclusos (1 por linha — corrida, combos)</label><textarea className={inp} rows={2} value={kitTxt} onChange={(e) => setKitTxt(e.target.value)} placeholder={'Camiseta\nMedalha\nKit lanche'} /></div>
      </div>
    </ModalShell>
  );
}

// ════════════════════ CUPOM ════════════════════
export function CupomModal({ editing, moeda, onClose, onSave }: {
  editing: Cupom | null; moeda: string; onClose: () => void; onSave: (p: Partial<Cupom>) => void;
}) {
  const [codigo, setCodigo] = useState(editing?.codigo || '');
  const [tipo, setTipo] = useState<'percentual' | 'fixo'>(editing?.tipo || 'percentual');
  const [valor, setValor] = useState(String(editing?.valor_num ?? 10));
  const [limite, setLimite] = useState(String(editing?.limite ?? 0));
  const [validade, setValidade] = useState(editing?.validade || '');
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [busy, setBusy] = useState(false);

  function submit() {
    if (!codigo.trim()) return;
    setBusy(true);
    onSave({
      codigo: codigo.trim().toUpperCase(), tipo, valor_num: Math.max(0, parseFloat(valor) || 0),
      limite: Math.max(0, parseInt(limite) || 0), validade: validade || null, ativo,
    });
  }

  return (
    <ModalShell titulo={editing ? 'Editar cupom' : 'Novo cupom'} sub="Desconto percentual ou de valor fixo, com limite e validade." onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={submit} disabled={busy || !codigo.trim()} className={btnPrim}>{editing ? 'Salvar' : 'Criar'}</button></>}>
      <div className="space-y-4">
        <div><label className={lbl}>Código *</label><input className={inp} value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="EX.: PRIMEIROLOTE" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Tipo</label>
            <select className={inp} value={tipo} onChange={(e) => setTipo(e.target.value as 'percentual' | 'fixo')}><option value="percentual">Percentual (%)</option><option value="fixo">Valor fixo ({moeda})</option></select>
          </div>
          <div><label className={lbl}>{tipo === 'percentual' ? 'Desconto (%)' : `Desconto (${moeda})`}</label><input className={inp} type="number" min={0} step={tipo === 'percentual' ? '1' : '0.01'} value={valor} onChange={(e) => setValor(e.target.value)} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className={lbl}>Limite de usos</label><input className={inp} type="number" min={0} value={limite} onChange={(e) => setLimite(e.target.value)} placeholder="0 = ilimitado" /></div>
          <div><label className={lbl}>Validade</label><input className={inp} type="date" value={validade} onChange={(e) => setValidade(e.target.value)} /></div>
        </div>
        <label className="inline-flex items-center gap-2 text-sm text-ink-soft"><input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="rounded border-black/20 text-brand focus:ring-brand/30" /> Ativo</label>
      </div>
    </ModalShell>
  );
}

// ════════════════════ EMISSÃO MANUAL (cortesia / balcão) ════════════════════
export function EmitirModal({ categorias, onClose, onEmitir }: {
  categorias: Categoria[]; onClose: () => void;
  onEmitir: (a: { categoria_id: string; qtd: number; comprador: { nome: string; email: string; doc: string }; canal: 'cortesia' | 'manual' }) => Promise<boolean>;
}) {
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.id || '');
  const [qtd, setQtd] = useState('1');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [doc, setDoc] = useState('');
  const [canal, setCanal] = useState<'cortesia' | 'manual'>('cortesia');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!categoriaId || !nome.trim()) return;
    setBusy(true);
    const ok = await onEmitir({ categoria_id: categoriaId, qtd: Math.max(1, parseInt(qtd) || 1), comprador: { nome: nome.trim(), email: email.trim(), doc: doc.trim() }, canal });
    if (!ok) setBusy(false);
  }

  return (
    <ModalShell titulo="Emitir ingressos" sub="Cortesia (grátis) ou venda no balcão (pagamento por fora). Já entram como pagos." onClose={onClose}
      footer={<><button onClick={onClose} className={btnGhost}>Cancelar</button><button onClick={submit} disabled={busy || !categoriaId || !nome.trim()} className={btnPrim}>Emitir</button></>}>
      <div className="space-y-4">
        <div><label className={lbl}>Canal</label>
          <div className="flex overflow-hidden rounded-xl border border-black/10">
            <button onClick={() => setCanal('cortesia')} className={`flex-1 py-2.5 text-sm font-bold transition ${canal === 'cortesia' ? 'bg-amber-500 text-white' : 'bg-white text-ink-muted hover:bg-black/[0.03]'}`}>Cortesia</button>
            <button onClick={() => setCanal('manual')} className={`flex-1 py-2.5 text-sm font-bold transition ${canal === 'manual' ? 'bg-violet-600 text-white' : 'bg-white text-ink-muted hover:bg-black/[0.03]'}`}>Balcão (pago)</button>
          </div>
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div><label className={lbl}>Categoria</label>
            <select className={inp} value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.lote_nome ? ` · ${c.lote_nome}` : ''}</option>)}
            </select>
          </div>
          <div><label className={lbl}>Qtd.</label><input className={`${inp} w-24`} type="number" min={1} value={qtd} onChange={(e) => setQtd(e.target.value)} /></div>
        </div>
        <div><label className={lbl}>Nome do titular *</label><input className={inp} value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div><label className={lbl}>E-mail</label><input className={inp} type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div><label className={lbl}>Documento</label><input className={inp} value={doc} onChange={(e) => setDoc(e.target.value)} /></div>
        </div>
        {canal === 'manual' && <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700">A venda no balcão lança a receita no Financeiro com o preço da categoria.</p>}
      </div>
    </ModalShell>
  );
}

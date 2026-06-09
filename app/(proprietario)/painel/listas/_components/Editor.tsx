'use client';

// Construtor de Lista Oficial — modal de criar/editar (/painel/listas).
// Define título, descrição (com sugestão de IA), capa, categoria, cidade e
// visibilidade; e monta os ITENS buscando propriedades da plataforma (linkam ao
// anúncio público) ou adicionando itens externos, com nota de curadoria 1–5 e
// comentário, reordenáveis. Persiste via RLS (o dono mexe só nas próprias linhas):
// upsert da lista + regrava os itens (delete+insert) — o n_itens é do trigger.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb, authHeaders } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import {
  type Lista, type DraftItem, type ItemTipo, type PropriedadeLite,
  CATEGORIAS, TIPOS_ITEM, slugComSufixo, normItem, itemToDraft,
  draftFromPropriedade, draftExterno,
} from '../_lib';

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const sel = 'rounded-xl border border-black/10 bg-white px-3 py-2.5 text-sm focus:border-brand focus:outline-none';

function rand5() { return Math.random().toString(36).slice(2, 7); }

type Campos = {
  titulo: string; descricao: string; capa_url: string;
  categoria: string; cidade: string; publica: boolean;
};

export function Editor({
  inicial, userId, autorNome, onClose, onSaved,
}: {
  inicial: Lista | null;
  userId: string;
  autorNome: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const editing = !!inicial;

  const [c, setC] = useState<Campos>({
    titulo: inicial?.titulo ?? '',
    descricao: inicial?.descricao ?? '',
    capa_url: inicial?.capa_url ?? '',
    categoria: inicial?.categoria ?? '',
    cidade: inicial?.cidade ?? '',
    publica: inicial?.publica ?? false,
  });
  const set = <K extends keyof Campos>(k: K, v: Campos[K]) => setC((s) => ({ ...s, [k]: v }));

  const [itens, setItens] = useState<DraftItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(editing);
  const [salvando, setSalvando] = useState(false);
  const [iaBusy, setIaBusy] = useState<'' | 'descricao' | 'itens'>('');

  // Buscador de propriedades da plataforma
  const [busca, setBusca] = useState('');
  const [resultados, setResultados] = useState<PropriedadeLite[]>([]);
  const [buscando, setBuscando] = useState(false);

  // Item externo
  const [extNome, setExtNome] = useState('');
  const [extTipo, setExtTipo] = useState<ItemTipo>('fornecedor');

  // Carrega itens existentes (ao editar)
  useEffect(() => {
    if (!inicial) return;
    (async () => {
      const { data } = await sb.from('listas_itens').select('*').eq('lista_id', inicial.id).order('ordem', { ascending: true });
      setItens(((data || []) as unknown[]).map((x) => itemToDraft(normItem(x))));
      setCarregandoItens(false);
    })();
  }, [inicial]);

  // Busca de propriedades (debounce simples)
  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) { setResultados([]); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      const { data } = await sb
        .from('propriedades')
        .select('id,nome,cidade,estado,imagem_url,avaliacao,tipo_propriedade')
        .eq('publicada', true)
        .ilike('nome', `%${q}%`)
        .limit(8);
      if (!vivo) return;
      setResultados((data || []) as PropriedadeLite[]);
      setBuscando(false);
    }, 280);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca]);

  // Fecha no Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const jaTem = useCallback((propId: number) => itens.some((i) => i.propriedade_id === propId), [itens]);

  function addPropriedade(p: PropriedadeLite) {
    if (jaTem(p.id)) { toast.info('Esse espaço já está na lista.'); return; }
    setItens((arr) => [...arr, draftFromPropriedade(p)]);
    setBusca(''); setResultados([]);
  }
  function addExterno() {
    const nome = extNome.trim();
    if (!nome) return;
    setItens((arr) => [...arr, draftExterno(nome, extTipo)]);
    setExtNome('');
  }
  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItens((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }
  function removeItem(key: string) {
    setItens((arr) => arr.filter((i) => i.key !== key));
  }
  function mover(key: string, dir: -1 | 1) {
    setItens((arr) => {
      const idx = arr.findIndex((i) => i.key === key);
      const alvo = idx + dir;
      if (idx < 0 || alvo < 0 || alvo >= arr.length) return arr;
      const cp = [...arr];
      [cp[idx], cp[alvo]] = [cp[alvo], cp[idx]];
      return cp;
    });
  }

  const capaPreview = useMemo(
    () => c.capa_url.trim() || itens.find((i) => i.ref_imagem)?.ref_imagem || '',
    [c.capa_url, itens],
  );

  // ── IA (degrade NO_KEY) ──
  async function sugerirIA(modo: 'descricao' | 'itens') {
    if (!c.titulo.trim()) { toast.info('Dê um título à lista primeiro.'); return; }
    setIaBusy(modo);
    try {
      const res = await fetch('/api/listas/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify({ modo, titulo: c.titulo, categoria: c.categoria, cidade: c.cidade, itens: itens.map((i) => i.ref_nome || i.nome_externo) }),
      });
      const j = await res.json().catch(() => ({ error: 'Falha de rede.' }));
      if (j.code === 'NO_KEY') { toast.info(j.error); return; }
      if (j.error) { toast.error(j.error); return; }
      if (modo === 'descricao' && j.descricao) { set('descricao', j.descricao); toast.success('Descrição sugerida pela IA.'); }
      if (modo === 'itens' && Array.isArray(j.sugestoes)) {
        const novos = (j.sugestoes as string[])
          .map((s) => s.split('—')[0].trim())
          .filter(Boolean)
          .filter((nome) => !itens.some((i) => (i.ref_nome || i.nome_externo || '').toLowerCase() === nome.toLowerCase()))
          .map((nome) => draftExterno(nome, 'fornecedor'));
        if (novos.length) { setItens((arr) => [...arr, ...novos]); toast.success(`${novos.length} ideia(s) adicionada(s) — ajuste à vontade.`); }
        else toast.info('Sem novas ideias para adicionar.');
      }
    } catch { toast.error('Não foi possível chamar a IA.'); }
    finally { setIaBusy(''); }
  }

  // ── Salvar ──
  async function salvar() {
    if (!c.titulo.trim()) { toast.error('Informe o título da lista.'); return; }
    setSalvando(true);
    const payload = {
      usuario_id: userId,
      autor_nome: autorNome || null,
      titulo: c.titulo.trim(),
      descricao: c.descricao.trim() || null,
      capa_url: c.capa_url.trim() || itens.find((i) => i.ref_imagem)?.ref_imagem || null,
      categoria: c.categoria || null,
      cidade: c.cidade.trim() || null,
      publica: c.publica,
    };

    let listaId = inicial?.id ?? '';
    if (editing) {
      const { error } = await sb.from('listas').update(payload).eq('id', inicial!.id);
      if (error) { setSalvando(false); toast.error('Não foi possível salvar a lista.'); return; }
    } else {
      const { data, error } = await sb.from('listas')
        .insert({ ...payload, slug: slugComSufixo(payload.titulo, rand5()) })
        .select('id').single();
      if (error || !data) { setSalvando(false); toast.error('Não foi possível criar a lista.'); return; }
      listaId = String(data.id);
    }

    // Regrava os itens: limpa e reinsere na ordem atual (o n_itens é do trigger).
    await sb.from('listas_itens').delete().eq('lista_id', listaId);
    if (itens.length) {
      const rows = itens.map((i, idx) => ({
        lista_id: listaId, usuario_id: userId,
        propriedade_id: i.propriedade_id, nome_externo: i.nome_externo,
        ref_nome: i.ref_nome, ref_cidade: i.ref_cidade, ref_imagem: i.ref_imagem,
        tipo: i.tipo, nota: i.nota, comentario: i.comentario?.trim() || null, ordem: idx,
      }));
      const { error: errItens } = await sb.from('listas_itens').insert(rows);
      if (errItens) { setSalvando(false); toast.error('Lista salva, mas falhou ao gravar os itens.'); return; }
    }

    setSalvando(false);
    toast.success(editing ? 'Lista atualizada.' : 'Lista criada.');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[9000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div
        className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-pop sm:rounded-3xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4">
          <h2 className="text-base font-bold text-ink">{editing ? 'Editar lista' : 'Nova lista'}</h2>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-ink-muted hover:bg-black/[0.04] hover:text-ink">✕</button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {/* Dados da lista */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Título *</span>
              <input className={inp} value={c.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder="Ex.: Melhores espaços para casamento em SP" maxLength={120} />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 flex items-center justify-between text-sm font-semibold text-ink-soft">
                Descrição
                <button type="button" onClick={() => sugerirIA('descricao')} disabled={iaBusy === 'descricao'} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-50 disabled:opacity-50">
                  <IcoSparkles /> {iaBusy === 'descricao' ? 'Gerando…' : 'Sugerir com IA'}
                </button>
              </span>
              <textarea className={`${inp} min-h-[80px]`} value={c.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Para quem é a lista e o que a torna especial." maxLength={600} />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Categoria</span>
              <select className={`${sel} w-full`} value={c.categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="">Sem categoria</option>
                {CATEGORIAS.map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Cidade / região</span>
              <input className={inp} value={c.cidade} onChange={(e) => set('cidade', e.target.value)} placeholder="Ex.: São Paulo, SP" maxLength={80} />
            </label>

            <label className="block sm:col-span-2">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Capa (URL da imagem)</span>
              <div className="flex items-center gap-3">
                <input className={inp} value={c.capa_url} onChange={(e) => set('capa_url', e.target.value)} placeholder="https://… (ou usa a 1ª imagem dos itens)" />
                {capaPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={capaPreview} alt="" className="h-11 w-16 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-11 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-ink-muted"><IcoImage /></div>
                )}
              </div>
            </label>
          </div>

          {/* Itens */}
          <div className="mt-6 border-t border-black/[0.06] pt-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-ink">Itens da lista <span className="text-ink-muted">({itens.length})</span></h3>
              <button type="button" onClick={() => sugerirIA('itens')} disabled={iaBusy === 'itens'} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-brand-50 disabled:opacity-50">
                <IcoSparkles /> {iaBusy === 'itens' ? 'Pensando…' : 'Sugerir itens'}
              </button>
            </div>

            {/* Buscar propriedade da plataforma */}
            <div className="relative mt-3">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"><IcoSearch /></span>
              <input className={`${inp} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar espaço da plataforma pelo nome…" />
              {(buscando || resultados.length > 0) && busca.trim().length >= 2 && (
                <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-black/10 bg-white shadow-pop">
                  {buscando && <div className="px-4 py-3 text-sm text-ink-muted">Buscando…</div>}
                  {!buscando && resultados.length === 0 && <div className="px-4 py-3 text-sm text-ink-muted">Nenhum espaço encontrado. Use “item externo” abaixo.</div>}
                  {resultados.map((p) => (
                    <button key={p.id} type="button" onClick={() => addPropriedade(p)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50 disabled:opacity-40" disabled={jaTem(p.id)}>
                      {p.imagem_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imagem_url} alt="" className="h-9 w-12 flex-shrink-0 rounded-md object-cover" />
                        : <div className="flex h-9 w-12 flex-shrink-0 items-center justify-center rounded-md bg-black/[0.04] text-ink-muted"><IcoImage /></div>}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{p.nome || 'Espaço'}</span>
                        <span className="block truncate text-xs text-ink-muted">{[p.cidade, p.estado].filter(Boolean).join(', ') || p.tipo_propriedade || '—'}</span>
                      </span>
                      {jaTem(p.id) && <span className="text-xs font-semibold text-emerald-600">incluído</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Item externo */}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <input className={`${inp} min-w-[160px] flex-1`} value={extNome} onChange={(e) => setExtNome(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addExterno(); } }} placeholder="Ou adicione um item externo (nome livre)" maxLength={120} />
              <select className={sel} value={extTipo} onChange={(e) => setExtTipo(e.target.value as ItemTipo)} aria-label="Tipo do item externo">
                {TIPOS_ITEM.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
              </select>
              <button type="button" onClick={addExterno} className="inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm font-medium hover:bg-black/[0.03]"><IcoPlus /> Adicionar</button>
            </div>

            {/* Lista de itens */}
            <div className="mt-4 space-y-2.5">
              {carregandoItens && <div className="h-16 animate-pulse rounded-xl bg-black/[0.05]" />}
              {!carregandoItens && itens.length === 0 && (
                <p className="rounded-xl border border-dashed border-black/10 px-4 py-6 text-center text-sm text-ink-muted">Adicione espaços da plataforma ou itens externos para montar a lista.</p>
              )}
              {itens.map((i, idx) => (
                <div key={i.key} className="rounded-xl border border-black/[0.06] bg-white p-3">
                  <div className="flex items-start gap-3">
                    {i.ref_imagem
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={i.ref_imagem} alt="" className="h-12 w-16 flex-shrink-0 rounded-lg object-cover" />
                      : <div className="flex h-12 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-black/[0.04] text-ink-muted"><IcoImage /></div>}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold text-ink">{i.ref_nome || i.nome_externo}</span>
                        <span className="flex-shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[0.65rem] font-semibold text-ink-soft">{TIPOS_ITEM.find((t) => t.v === i.tipo)?.label}</span>
                        {i.propriedade_id != null && <span className="flex-shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-semibold text-brand">na plataforma</span>}
                      </div>
                      {i.ref_cidade && <p className="mt-0.5 truncate text-xs text-ink-muted">{i.ref_cidade}</p>}
                      <div className="mt-1.5 flex items-center gap-2">
                        <Stars value={i.nota} onChange={(n) => patchItem(i.key, { nota: n })} />
                        {i.nota != null && <button type="button" onClick={() => patchItem(i.key, { nota: null })} className="text-[0.7rem] text-ink-muted hover:text-brand">limpar</button>}
                      </div>
                      <input className={`${inp} mt-2 py-1.5 text-xs`} value={i.comentario ?? ''} onChange={(e) => patchItem(i.key, { comentario: e.target.value })} placeholder="Por que recomenda? (opcional)" maxLength={240} />
                    </div>
                    <div className="flex flex-shrink-0 flex-col items-center gap-0.5">
                      <button type="button" onClick={() => mover(i.key, -1)} disabled={idx === 0} aria-label="Subir" className="rounded p-1 text-ink-muted hover:bg-black/[0.04] hover:text-ink disabled:opacity-30">▲</button>
                      <button type="button" onClick={() => mover(i.key, 1)} disabled={idx === itens.length - 1} aria-label="Descer" className="rounded p-1 text-ink-muted hover:bg-black/[0.04] hover:text-ink disabled:opacity-30">▼</button>
                      <button type="button" onClick={() => removeItem(i.key)} aria-label="Remover" className="rounded p-1 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between gap-3 border-t border-black/[0.06] px-5 py-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-ink-soft">
            <input type="checkbox" checked={c.publica} onChange={(e) => set('publica', e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
            Publicar (visível na comunidade)
          </label>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium hover:bg-black/[0.03]">Cancelar</button>
            <button onClick={salvar} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50">{salvando ? 'Salvando…' : editing ? 'Salvar' : 'Criar lista'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Estrelas de curadoria (1–5) ──
function Stars({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Nota de curadoria">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)} aria-label={`${n} estrela${n > 1 ? 's' : ''}`} className="text-base leading-none">
          <span className={n <= (value ?? 0) ? 'text-amber-400' : 'text-black/15'}>★</span>
        </button>
      ))}
    </div>
  );
}

// ── Ícones ──
function IcoSparkles() { return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" /></svg>; }
function IcoSearch() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>; }
function IcoPlus() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>; }
function IcoTrash() { return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" /></svg>; }
function IcoImage() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></svg>; }

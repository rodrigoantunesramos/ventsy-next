'use client';

// Editor de sub-espaço (tabela `espacos`) — usado na aba "Espaços" de
// /painel/reservas. Escreve direto via RLS (o dono só mexe nas próprias linhas).
// Define nome, tipo, capacidade, buffer de montagem (usado na detecção de
// conflito) e se pode ser reservado isoladamente.

import { useEffect, useState, type ReactNode } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { ESPACO_TIPOS, ESPACO_TIPO_LABEL, type Espaco } from '@/lib/reservas';

type PropRef = { id: number; nome: string | null };

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const lbl = 'mb-1.5 block text-sm font-semibold text-ink-soft';

export function EspacoEditor({
  userId, propriedades, editing, defaultPropId, onClose, onSaved,
}: {
  userId: string;
  propriedades: PropRef[];
  editing: Espaco | null;
  defaultPropId?: number;
  onClose: () => void;
  onSaved: (e: Espaco) => void;
}) {
  const [propId, setPropId] = useState<number>(editing?.propriedade_id ?? defaultPropId ?? propriedades[0]?.id ?? 0);
  const [nome, setNome] = useState(editing?.nome || '');
  const [tipo, setTipo] = useState<string>(editing?.tipo || 'salao');
  const [capacidade, setCapacidade] = useState(editing?.capacidade != null ? String(editing.capacidade) : '');
  const [area, setArea] = useState(editing?.area_m2 != null ? String(editing.area_m2) : '');
  const [buffer, setBuffer] = useState(editing?.buffer_minutos != null ? String(editing.buffer_minutos) : '0');
  const [isolado, setIsolado] = useState(editing?.reservavel_isolado ?? true);
  const [cor, setCor] = useState(editing?.cor || '#ff385c');
  const [ordem, setOrdem] = useState(editing?.ordem != null ? String(editing.ordem) : '0');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  async function salvar() {
    setErro('');
    if (!propId) { setErro('Escolha a propriedade.'); return; }
    if (!nome.trim()) { setErro('Dê um nome ao espaço.'); return; }
    setSalvando(true);
    const row = {
      usuario_id: userId,
      propriedade_id: propId,
      nome: nome.trim(),
      tipo,
      capacidade: capacidade ? Number(capacidade) : null,
      area_m2: area ? Number(area) : null,
      buffer_minutos: Number(buffer) || 0,
      reservavel_isolado: isolado,
      cor: cor || null,
      ordem: Number(ordem) || 0,
      ativo: editing?.ativo ?? true,
    };
    const q = editing
      ? sb.from('espacos').update(row).eq('id', editing.id).select('*').single()
      : sb.from('espacos').insert(row).select('*').single();
    const { data, error } = await q;
    setSalvando(false);
    if (error) { setErro(error.message || 'Não foi possível salvar.'); return; }
    onSaved(data as Espaco);
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-4 font-display text-xl font-bold text-ink">{editing ? 'Editar sub-espaço' : 'Novo sub-espaço'}</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Propriedade</label>
            <select value={propId} onChange={(e) => setPropId(Number(e.target.value))} className={inp} disabled={!!editing}>
              {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Tipo</label>
            <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}>
              {ESPACO_TIPOS.map((tp) => <option key={tp} value={tp}>{ESPACO_TIPO_LABEL[tp]}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={lbl}>Nome</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: Arena Principal, Galpão B, Camarote VIP" className={inp} />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <label className={lbl}>Capacidade</label>
            <input type="number" min={0} value={capacidade} onChange={(e) => setCapacidade(e.target.value)} placeholder="pessoas" className={inp} />
          </div>
          <div>
            <label className={lbl}>Área (m²)</label>
            <input type="number" min={0} value={area} onChange={(e) => setArea(e.target.value)} placeholder="m²" className={inp} />
          </div>
          <div>
            <label className={lbl}>Buffer (min)</label>
            <input type="number" min={0} value={buffer} onChange={(e) => setBuffer(e.target.value)} placeholder="montagem" className={inp} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Cor (timeline)</label>
            <input type="color" value={cor} onChange={(e) => setCor(e.target.value)} className="h-11 w-full cursor-pointer rounded-xl border border-black/10" />
          </div>
          <div>
            <label className={lbl}>Ordem</label>
            <input type="number" value={ordem} onChange={(e) => setOrdem(e.target.value)} className={inp} />
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-4 py-3">
          <input type="checkbox" checked={isolado} onChange={(e) => setIsolado(e.target.checked)} className="h-4 w-4 accent-brand" />
          <span className="text-sm font-semibold text-ink-soft">Pode ser reservado isoladamente</span>
        </label>
        <p className="text-xs text-ink-muted">O <strong>buffer</strong> reserva um intervalo de montagem/desmontagem entre dois eventos no mesmo espaço — a detecção de conflito respeita esse tempo.</p>
        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={salvando} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
          {salvando ? 'Salvando…' : editing ? 'Salvar' : 'Criar'}
        </button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[10000] flex items-start justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="relative my-8 w-full max-w-lg rounded-2xl bg-white p-6 shadow-pop">
        <button onClick={onClose} aria-label="Fechar" className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 text-ink-muted hover:bg-black/[0.03]">✕</button>
        {children}
      </div>
    </div>
  );
}

'use client';

// Editor compartilhado de reserva operacional (firme / provisória / bloqueio /
// manutenção), usado por /painel/calendario e /painel/reservas.
// • Seletor de propriedade → sub-espaço (ou "espaço inteiro").
// • Pré-visualização de conflito AO VIVO (lib/reservas.detectarConflitos) contra
//   as reservas do contexto, respeitando o buffer do espaço.
// • Salva via /api/reservas (POST/PATCH) — a checagem autoritativa é no servidor;
//   se ele responder 409, mostramos os conflitos confirmados.
// Sem "R$"/datas hardcoded — toda formatação por lib/format.

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { authHeaders } from '@/lib/supabase';
import { formatDateTime } from '@/lib/format';
import {
  detectarConflitos, toRange, statusMeta, ESPACO_TIPO_LABEL,
  type Reserva, type Espaco,
} from '@/lib/reservas';

type PropRef = { id: number; nome: string | null };
type EventoRef = { id: string; nome_evento: string | null };
type Defaults = { propriedade_id?: number; espaco_id?: number | null; inicio?: string; fim?: string; status?: TipoStatus };

type TipoStatus = 'confirmada' | 'hold' | 'bloqueio' | 'manutencao';

const TIPOS: { key: TipoStatus; label: string }[] = [
  { key: 'confirmada', label: 'Reserva' },
  { key: 'hold', label: 'Provisória' },
  { key: 'bloqueio', label: 'Bloqueio' },
  { key: 'manutencao', label: 'Manutenção' },
];

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';
const lbl = 'mb-1.5 block text-sm font-semibold text-ink-soft';

// ── datetime-local ⇄ ISO (interpreta como hora local do navegador) ───────────
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function ReservaEditor({
  propriedades, espacos, eventos = [], reservasContexto, editing, defaults, onClose, onSaved,
}: {
  propriedades: PropRef[];
  espacos: Espaco[];
  eventos?: EventoRef[];
  reservasContexto: Reserva[];
  editing: Reserva | null;
  defaults?: Defaults;
  onClose: () => void;
  onSaved: (r: Reserva) => void;
}) {
  const [propId, setPropId] = useState<number>(
    editing?.propriedade_id ?? defaults?.propriedade_id ?? propriedades[0]?.id ?? 0,
  );
  const [espacoId, setEspacoId] = useState<number | null>(
    editing ? editing.espaco_id : defaults?.espaco_id ?? null,
  );
  const [status, setStatus] = useState<TipoStatus>(
    (editing && (['confirmada', 'hold', 'bloqueio', 'manutencao'] as string[]).includes(editing.status)
      ? (editing.status as TipoStatus)
      : defaults?.status) || 'confirmada',
  );
  const [titulo, setTitulo] = useState(editing?.titulo || '');
  const [inicio, setInicio] = useState(toLocalInput(editing?.inicio || defaults?.inicio));
  const [fim, setFim] = useState(toLocalInput(editing?.fim || defaults?.fim));
  const [holdHoras, setHoldHoras] = useState('48');
  const [eventoId, setEventoId] = useState<string>(editing?.evento_id || '');
  const [obs, setObs] = useState(editing?.obs || '');
  const [forcar, setForcar] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [serverConf, setServerConf] = useState<Reserva[]>([]);

  // Esc fecha o modal.
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  const espacosDaProp = useMemo(
    () => espacos.filter((e) => e.propriedade_id === propId && e.ativo).sort((a, b) => a.ordem - b.ordem),
    [espacos, propId],
  );
  const espacoSel = espacosDaProp.find((e) => e.id === espacoId) || null;
  const buffer = espacoSel?.buffer_minutos || 0;

  const isoInicio = fromLocalInput(inicio);
  const isoFim = fromLocalInput(fim);
  const rangeOk = !!isoInicio && !!isoFim && Date.parse(isoFim) > Date.parse(isoInicio);

  // ── Conflitos ao vivo (preview local; o servidor reconfirma) ────────────────
  const conflitosLocais = useMemo(() => {
    if (!rangeOk) return [];
    const range = toRange({ inicio: isoInicio, fim: isoFim })!;
    return detectarConflitos(
      { propriedade_id: propId, espaco_id: espacoId, start: range.start, end: range.end, ignoreId: editing?.id },
      reservasContexto,
      { bufferMin: buffer },
    );
  }, [rangeOk, isoInicio, isoFim, propId, espacoId, editing?.id, reservasContexto, buffer]);

  const conflitos = serverConf.length ? serverConf : conflitosLocais;
  const podeForcar = status === 'bloqueio' || status === 'manutencao';
  const bloqueadoPorConflito = conflitos.length > 0 && !(podeForcar && forcar);

  function setDiaInteiro() {
    const base = inicio ? inicio.slice(0, 10) : new Date().toISOString().slice(0, 10);
    setInicio(`${base}T00:00`);
    setFim(`${base}T23:59`);
  }

  async function salvar() {
    setErro('');
    setServerConf([]);
    if (!propId) { setErro('Escolha a propriedade.'); return; }
    if (!rangeOk) { setErro('Informe início e fim válidos (fim depois do início).'); return; }
    setSalvando(true);
    const payload: Record<string, unknown> = {
      propriedade_id: propId,
      espaco_id: espacoId,
      status,
      titulo: titulo.trim() || null,
      inicio: isoInicio,
      fim: isoFim,
      obs: obs.trim() || null,
      evento_id: (status === 'confirmada' || status === 'hold') && eventoId ? eventoId : null,
      ...(status === 'hold' ? { hold_horas: Number(holdHoras) || 48 } : {}),
      ...(podeForcar && forcar ? { force: true } : {}),
    };
    if (editing) payload.id = editing.id;
    try {
      const res = await fetch('/api/reservas', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.status === 409 && json.error === 'conflito') {
        setServerConf((json.conflitos || []) as Reserva[]);
        setErro('Conflito de agenda neste espaço. Ajuste o horário ou o espaço.');
        return;
      }
      if (!res.ok) { setErro(json.error || 'Não foi possível salvar a reserva.'); return; }
      onSaved(json.data as Reserva);
    } catch {
      setErro('Falha de rede ao salvar. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  }

  const eventoNome = status === 'confirmada' || status === 'hold';

  return (
    <Modal onClose={onClose}>
      <h3 className="mb-4 font-display text-xl font-bold text-ink">
        {editing ? 'Editar' : 'Nova'} {TIPOS.find((x) => x.key === status)?.label.toLowerCase()}
      </h3>

      {/* Tipo */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {TIPOS.map((tp) => (
          <button
            key={tp.key}
            type="button"
            onClick={() => setStatus(tp.key)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
              status === tp.key ? 'border-brand bg-brand-50 text-brand' : 'border-black/10 text-ink-soft hover:border-brand'
            }`}
          >
            <span className={`mr-1.5 inline-block h-2 w-2 rounded-full align-middle ${statusMeta(tp.key).dot}`} />
            {tp.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Propriedade + espaço */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Propriedade</label>
            <select
              value={propId}
              onChange={(e) => { setPropId(Number(e.target.value)); setEspacoId(null); }}
              className={inp}
              disabled={!!editing}
            >
              {propriedades.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Sub-espaço</label>
            <select value={espacoId ?? ''} onChange={(e) => setEspacoId(e.target.value ? Number(e.target.value) : null)} className={inp}>
              <option value="">Espaço inteiro</option>
              {espacosDaProp.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome} · {ESPACO_TIPO_LABEL[e.tipo]}{e.buffer_minutos ? ` · buffer ${e.buffer_minutos}min` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Título */}
        <div>
          <label className={lbl}>{status === 'bloqueio' || status === 'manutencao' ? 'Motivo' : 'Título / evento'}</label>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={status === 'manutencao' ? 'Ex.: Manutenção do ar-condicionado' : status === 'bloqueio' ? 'Ex.: Indisponível' : 'Ex.: Casamento Marina & João'}
            className={inp}
          />
        </div>

        {/* Datas */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={lbl}>Início</label>
            <input type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} className={inp} />
          </div>
          <div>
            <label className={lbl}>Fim</label>
            <input type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} className={inp} />
          </div>
        </div>
        <button type="button" onClick={setDiaInteiro} className="text-xs font-semibold text-brand hover:underline">Marcar dia inteiro</button>

        {/* Hold */}
        {status === 'hold' && (
          <div>
            <label className={lbl}>Segurar por (horas) — expira automaticamente</label>
            <input type="number" min={1} value={holdHoras} onChange={(e) => setHoldHoras(e.target.value)} className={inp} />
            {editing?.status === 'hold' && editing.hold_expira_em && (
              <p className="mt-1 text-xs text-ink-muted">Expira atualmente em {formatDateTime(editing.hold_expira_em)}.</p>
            )}
          </div>
        )}

        {/* Vínculo a evento/lead */}
        {eventoNome && eventos.length > 0 && (
          <div>
            <label className={lbl}>Vincular a um cliente/evento (opcional)</label>
            <select value={eventoId} onChange={(e) => setEventoId(e.target.value)} className={inp}>
              <option value="">— Sem vínculo —</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome_evento || `Evento #${ev.id.slice(0, 6)}`}</option>)}
            </select>
          </div>
        )}

        {/* Observação */}
        <div>
          <label className={lbl}>Observações</label>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} className={inp} />
        </div>

        {/* Conflitos */}
        {conflitos.length > 0 && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
            <p className="font-semibold text-red-700">⚠ Conflito neste espaço ({conflitos.length})</p>
            <ul className="mt-1.5 space-y-1 text-red-700/90">
              {conflitos.slice(0, 4).map((c) => (
                <li key={c.id} className="text-xs">
                  <span className="font-semibold">{statusMeta(c.status).label}</span>
                  {c.titulo ? ` · ${c.titulo}` : ''}
                  {c.inicio ? ` · ${formatDateTime(c.inicio)}` : c.data_inicio ? ` · ${c.data_inicio}` : ''}
                </li>
              ))}
            </ul>
            {podeForcar && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-red-800">
                <input type="checkbox" checked={forcar} onChange={(e) => setForcar(e.target.checked)} className="h-4 w-4 accent-red-600" />
                Sobrepor mesmo assim (bloqueio/manutenção)
              </label>
            )}
          </div>
        )}

        {erro && <p className="text-sm font-medium text-red-600">{erro}</p>}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={salvar}
          disabled={salvando || bloqueadoPorConflito}
          className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50"
        >
          {salvando ? 'Salvando…' : editing ? 'Salvar alterações' : 'Criar'}
        </button>
        {bloqueadoPorConflito && <span className="text-xs text-ink-muted">Resolva o conflito para salvar.</span>}
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

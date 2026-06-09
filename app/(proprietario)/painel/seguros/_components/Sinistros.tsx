'use client';

// Aba "Sinistros" — abertura e acompanhamento de ocorrências por apólice, com
// valores estimado/indenizado, status, anexos e lição aprendida. Dá o rastro
// completo e alimenta o índice de sinistralidade.

import { useMemo, useState } from 'react';
import { formatMoney, formatMoneyShort, formatDate, formatPercent } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type Sinistro, type Seguro, type SinistroStatus, type Anexo,
  SINISTRO_STATUS, SINISTRO_STATUS_BY, sinistroStatusLabel, escopoLabel,
  resumoSinistros, sinistralidade,
  criarSinistro, salvarSinistro, excluirSinistro,
  uploadArquivo, signedUrl, inp,
} from '../_lib';
import type { SegurosBag } from './shared';
import {
  Kpi, ModalShell, Campo, EmptyState, Chip, btnPrimary, btnSecondary,
  IcoAlert, IcoPlus, IcoTrash, IcoMoney, IcoCheck, IcoDoc, IcoDownload, IcoX, IcoBolt,
} from './ui';

const numOrZero = (s: string): number => { const x = Number(String(s).replace(',', '.')); return Number.isFinite(x) ? x : 0; };

export default function Sinistros({ bag }: { bag: SegurosBag }) {
  const toast = useToast();
  const { sinistros, seguros } = bag;
  const [edit, setEdit] = useState<Sinistro | 'novo' | null>(null);

  const segurosMap = useMemo(() => new Map(seguros.map((s) => [s.id, s])), [seguros]);
  const resumo = useMemo(() => resumoSinistros(sinistros), [sinistros]);
  const premioTotal = useMemo(() => seguros.reduce((acc, s) => acc + s.premio_num, 0), [seguros]);
  const indice = sinistralidade(premioTotal, resumo.indenizado);

  const ordenados = useMemo(
    () => [...sinistros].sort((a, b) => (b.data || '').localeCompare(a.data || '')),
    [sinistros],
  );

  const apoliceLabel = (s: Seguro | undefined): string => s ? `${s.seguradora || 'Apólice'} · ${escopoLabel(s.escopo)}` : 'Apólice removida';

  if (seguros.length === 0) {
    return (
      <EmptyState icon={<IcoAlert />} title="Cadastre uma apólice primeiro">
        Os sinistros são abertos sobre uma apólice. Cadastre uma apólice na aba <strong>Carteira</strong> e volte aqui para registrar ocorrências.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Sinistros em aberto" value={String(resumo.abertos)} tone={resumo.abertos > 0 ? 'gold' : 'ink'} icon={<IcoBolt />} sub={`${resumo.total} no total`} />
        <Kpi label="Valor estimado" value={formatMoneyShort(resumo.estimado)} tone="azul" icon={<IcoMoney />} sub="soma das ocorrências" />
        <Kpi label="Indenizado" value={formatMoneyShort(resumo.indenizado)} tone="verde" icon={<IcoCheck />} sub={`${resumo.pagos} pago(s)`} />
        <Kpi label="Sinistralidade" value={indice == null ? '—' : formatPercent(indice)} tone={indice != null && indice > 0.7 ? 'vermelho' : 'ink'} icon={<IcoAlert />} sub="indenizado ÷ prêmio" />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">{sinistros.length} ocorrência(s) registrada(s).</p>
        <button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Registrar sinistro</button>
      </div>

      {sinistros.length === 0 ? (
        <EmptyState icon={<IcoBolt />} title="Nenhum sinistro registrado"
          cta={<button onClick={() => setEdit('novo')} className={btnPrimary}><IcoPlus /> Registrar primeiro</button>}>
          Registre danos, acidentes e ocorrências cobertas pelas apólices — com valor estimado, indenização, anexos e a lição aprendida.
        </EmptyState>
      ) : (
        <div className="space-y-2.5">
          {ordenados.map((s) => {
            const meta = SINISTRO_STATUS_BY[s.status];
            return (
              <button key={s.id} onClick={() => setEdit(s)} className="flex w-full flex-col gap-2 rounded-2xl bg-white p-4 text-left shadow-card transition hover:shadow-pop sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink">{apoliceLabel(segurosMap.get(s.seguro_id))}</span>
                    <Chip className={meta?.chip || 'bg-black/[0.04] text-ink-soft'}>{sinistroStatusLabel(s.status)}</Chip>
                  </div>
                  <div className="mt-0.5 truncate text-sm text-ink-soft">{s.descricao || 'Sem descrição'}</div>
                  <div className="mt-0.5 text-xs text-ink-muted">{formatDate(s.data)}{s.protocolo ? ` · protocolo ${s.protocolo}` : ''}{s.anexos.length ? ` · ${s.anexos.length} anexo(s)` : ''}</div>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">Estimado</div>
                    <div className="text-sm font-semibold text-ink-soft">{formatMoney(s.valor_estimado_num)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[0.65rem] uppercase tracking-wide text-ink-muted">Indenizado</div>
                    <div className="text-sm font-bold text-emerald-600">{s.valor_indenizado_num > 0 ? formatMoney(s.valor_indenizado_num) : '—'}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {edit && (
        <SinistroModal
          bag={bag}
          editing={edit === 'novo' ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={async () => { setEdit(null); await bag.recarregar(); }}
          toastError={(m) => toast.error(m)}
          toastOk={(m) => toast.success(m)}
        />
      )}
    </div>
  );
}

// ── Modal de sinistro ───────────────────────────────────────────────────────
function SinistroModal({ bag, editing, onClose, onSaved, toastError, toastOk }: {
  bag: SegurosBag;
  editing: Sinistro | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
  toastError: (m: string) => void;
  toastOk: (m: string) => void;
}) {
  const { userId, seguros, hoje } = bag;
  const [seguroId, setSeguroId] = useState(editing?.seguro_id ?? (seguros[0]?.id ?? ''));
  const [data, setData] = useState(editing?.data ?? hoje);
  const [descricao, setDescricao] = useState(editing?.descricao ?? '');
  const [estimado, setEstimado] = useState(editing?.valor_estimado_num ? String(editing.valor_estimado_num) : '');
  const [indenizado, setIndenizado] = useState(editing?.valor_indenizado_num ? String(editing.valor_indenizado_num) : '');
  const [status, setStatus] = useState<SinistroStatus>(editing?.status ?? 'aberto');
  const [protocolo, setProtocolo] = useState(editing?.protocolo ?? '');
  const [licao, setLicao] = useState(editing?.licao ?? '');
  const [anexos, setAnexos] = useState<Anexo[]>(editing?.anexos ?? []);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const enviarAnexo = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    try {
      const a = await uploadArquivo(userId, file, 'sinistros/');
      setAnexos((xs) => [...xs, a]);
    } catch { toastError('Falha ao enviar o anexo.'); }
    setEnviando(false);
  };
  const abrirAnexo = async (path: string) => {
    const url = await signedUrl(path);
    if (url) window.open(url, '_blank');
  };

  const salvar = async () => {
    if (!seguroId) { toastError('Selecione a apólice.'); return; }
    setSalvando(true);
    const seguro = seguros.find((s) => s.id === seguroId);
    const row = {
      usuario_id: userId,
      seguro_id: seguroId,
      evento_id: seguro?.evento_id ?? null,   // herda o evento da apólice (se houver)
      data: data || hoje,
      descricao: descricao.trim() || null,
      valor_estimado_num: numOrZero(estimado),
      valor_indenizado_num: numOrZero(indenizado),
      status,
      protocolo: protocolo.trim() || null,
      anexos,
      licao: licao.trim() || null,
    };
    const res = editing ? await salvarSinistro(editing.id, row) : await criarSinistro(row);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível salvar o sinistro.'); return; }
    toastOk(editing ? 'Sinistro atualizado.' : 'Sinistro registrado.');
    await onSaved();
  };

  const excluir = async () => {
    if (!editing) return;
    if (!confirm('Excluir este sinistro?')) return;
    setSalvando(true);
    const res = await excluirSinistro(editing.id);
    setSalvando(false);
    if (res.error) { toastError('Não foi possível excluir.'); return; }
    toastOk('Sinistro excluído.');
    await onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="mb-1 text-lg font-bold text-ink">{editing ? 'Editar sinistro' : 'Registrar sinistro'}</h3>
      <p className="mb-4 text-sm text-ink-muted">Documente a ocorrência e o andamento até a indenização.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Apólice" full>
          <select value={seguroId} onChange={(e) => setSeguroId(e.target.value)} className={inp}>
            {seguros.map((s) => <option key={s.id} value={s.id}>{s.seguradora || 'Apólice'} · {escopoLabel(s.escopo)}{s.apolice ? ` · ${s.apolice}` : ''}</option>)}
          </select>
        </Campo>
        <Campo label="Data da ocorrência"><input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} /></Campo>
        <Campo label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as SinistroStatus)} className={inp}>
            {SINISTRO_STATUS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </select>
        </Campo>
        <Campo label="Descrição da ocorrência" full><textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} className={inp} placeholder="O que aconteceu, danos, envolvidos…" /></Campo>
        <Campo label="Valor estimado"><input value={estimado} onChange={(e) => setEstimado(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <Campo label="Valor indenizado"><input value={indenizado} onChange={(e) => setIndenizado(e.target.value)} inputMode="decimal" className={inp} placeholder="0,00" /></Campo>
        <Campo label="Protocolo / nº do sinistro"><input value={protocolo} onChange={(e) => setProtocolo(e.target.value)} className={inp} placeholder="Protocolo na seguradora" /></Campo>
        <Campo label="Lição aprendida / providência"><input value={licao} onChange={(e) => setLicao(e.target.value)} className={inp} placeholder="O que evita repetir" /></Campo>
      </div>

      {/* Anexos */}
      <div className="mt-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-ink-soft">Anexos (laudos, fotos, boletim)</span>
          <label className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand hover:underline">
            <IcoDownload /> {enviando ? 'Enviando…' : 'Anexar'}
            <input type="file" className="hidden" onChange={(e) => enviarAnexo(e.target.files?.[0])} accept=".pdf,.jpg,.jpeg,.png,.webp" />
          </label>
        </div>
        {anexos.length === 0 ? (
          <p className="text-xs text-ink-muted">Nenhum anexo.</p>
        ) : (
          <div className="space-y-1.5">
            {anexos.map((a, i) => (
              <div key={i} className="flex items-center justify-between gap-2 rounded-lg border border-black/[0.06] bg-black/[0.015] px-3 py-1.5 text-sm">
                <button onClick={() => abrirAnexo(a.url)} className="inline-flex min-w-0 items-center gap-2 text-ink-soft hover:text-brand"><IcoDoc /> <span className="truncate">{a.nome}</span></button>
                <button onClick={() => setAnexos((xs) => xs.filter((_, idx) => idx !== i))} aria-label="Remover anexo" className="text-ink-muted hover:text-red-600"><IcoX /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between gap-2">
        {editing ? (
          <button onClick={excluir} disabled={salvando} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"><IcoTrash /> Excluir</button>
        ) : <span />}
        <div className="flex gap-2">
          <button onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button onClick={salvar} disabled={salvando} className={btnPrimary}><IcoCheck /> {salvando ? 'Salvando…' : 'Salvar'}</button>
        </div>
      </div>
    </ModalShell>
  );
}

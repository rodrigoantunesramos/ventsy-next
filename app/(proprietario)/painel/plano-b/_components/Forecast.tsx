'use client';

// Aba "Previsão" — o tempo previsto para a DATA e o LOCAL do evento (lat/long da
// propriedade), via Open-Meteo (sem chave), com cache do snapshot. Mostra a
// condição do dia, KPIs (chuva, vento/rajada, temperatura, UV, visibilidade),
// nascer/pôr do sol e a curva horária (SVG puro). Degrada para ENTRADA MANUAL
// quando não há coordenadas, a data está fora do horizonte ou a API falha.
// Sem "R$" hardcoded — números via lib/format.

import { useMemo, useState } from 'react';
import { formatNumber, formatDate, formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type PlanoBBag, type ClimaResumo, type PrevisaoMotivo,
  condicaoDe, resumoVazio,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, EmptyState, CondIcon,
  IcoCloud, IcoRefresh, IcoEdit, IcoWind, IcoThermo, IcoSun, IcoSunrise, IcoEye, IcoAlert,
  btnPrimary, btnSecondary,
} from './ui';

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

/** Número + unidade, ou '—'. Locale-aware no número (lib/format). */
function val(v: number | null, unidade: string, casas = 0): string {
  if (v == null) return '—';
  return `${formatNumber(v, { maximumFractionDigits: casas })}${unidade}`;
}
/** Visibilidade em km (vem em metros). */
function vis(v: number | null): string {
  if (v == null) return '—';
  return `${formatNumber(v / 1000, { maximumFractionDigits: 1 })} km`;
}
function horaCurta(iso: string | null): string {
  if (!iso) return '—';
  const m = /T(\d{2}:\d{2})/.exec(iso) || /^(\d{2}:\d{2})/.exec(iso);
  return m ? m[1] : '—';
}

const MOTIVO_TXT: Record<NonNullable<PrevisaoMotivo>, { titulo: string; texto: string }> = {
  sem_data: { titulo: 'Evento sem data definida', texto: 'Defina a data do evento para buscarmos a previsão do tempo.' },
  sem_coordenadas: { titulo: 'Propriedade sem coordenadas', texto: 'A previsão usa a latitude/longitude da propriedade do evento. Cadastre o local em Minha Propriedade — ou informe a previsão manualmente.' },
  fora_do_horizonte: { titulo: 'Previsão ainda indisponível', texto: 'A previsão fica disponível a partir de ~16 dias antes do evento. Você pode registrar uma estimativa manual enquanto isso.' },
  falha_api: { titulo: 'Não foi possível buscar a previsão', texto: 'O serviço de meteorologia não respondeu. Tente novamente em instantes ou informe a previsão manualmente.' },
};

export default function Forecast({ bag }: { bag: PlanoBBag }) {
  const { resumo, meta, evento } = bag;
  const [manual, setManual] = useState(false);

  const cond = condicaoDe(resumo?.codigo ?? null);
  const fonteLabel = resumo?.manual ? 'Informada manualmente' : resumo?.fonte === 'open-meteo' ? 'Open-Meteo' : resumo?.fonte || '—';

  return (
    <div className="space-y-5">
      {/* Cabeçalho da previsão: local, frescor, atualizar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-50 text-sky-600"><IcoCloud /></span>
            {meta.local || 'Local do evento'}
          </div>
          <div className="mt-1 text-[0.72rem] text-ink-muted">
            {evento.data_inicio ? formatDate(evento.data_inicio, { style: 'long' }) : 'Sem data'}
            {resumo?.capturado_em && <> · atualizado {formatDateTime(resumo.capturado_em)}</>}
            {resumo && <> · {fonteLabel}</>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setManual(true)} className={btnSecondary}><IcoEdit /> Manual</button>
          <button onClick={() => bag.atualizarPrevisao()} disabled={meta.carregando} className={btnPrimary}>
            <IcoRefresh /> {meta.carregando ? 'Buscando…' : 'Atualizar previsão'}
          </button>
        </div>
      </div>

      {!resumo ? (
        <DegradeCard motivo={meta.motivo} onManual={() => setManual(true)} carregando={meta.carregando} />
      ) : (
        <>
          {/* Condição do dia */}
          <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-sky-50 to-white p-5 shadow-card">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-sky-600 shadow-sm"><CondIcon icone={cond.icone} size={36} /></span>
            <div>
              <div className="text-lg font-bold text-ink">{cond.label}</div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-ink-muted">
                <span className="inline-flex items-center gap-1"><IcoThermo /> {val(resumo.temp_min, '°', 0)} / {val(resumo.temp_max, '°', 0)}</span>
                <span className="inline-flex items-center gap-1"><IcoSunrise /> {horaCurta(resumo.nascer_sol)} – {horaCurta(resumo.por_sol)}</span>
              </div>
            </div>
          </div>

          {/* KPIs da previsão */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Chance de chuva" value={val(resumo.chuva_prob, '%', 0)} sub={resumo.precipitacao != null ? `${val(resumo.precipitacao, ' mm', 1)} previstos` : undefined} tone="azul" icon={<IcoCloud />} />
            <Kpi label="Vento (rajadas)" value={val(resumo.vento, ' km/h', 0)} sub={resumo.rajada != null ? `rajadas ${val(resumo.rajada, ' km/h', 0)}` : undefined} tone="teal" icon={<IcoWind />} />
            <Kpi label="Temperatura máx." value={val(resumo.temp_max, '°C', 0)} sub={`mín. ${val(resumo.temp_min, '°C', 0)}`} tone="gold" icon={<IcoThermo />} />
            <Kpi label="Índice UV" value={val(resumo.uv, '', 0)} sub={uvLabel(resumo.uv)} tone="gold" icon={<IcoSun />} />
            <Kpi label="Visibilidade" value={vis(resumo.visibilidade)} tone="cinza" icon={<IcoEye />} />
            <Kpi label="Precipitação" value={val(resumo.precipitacao, ' mm', 1)} tone="sky" icon={<IcoCloud />} />
          </div>

          {/* Curva horária */}
          {resumo.horas.length > 0 && <CurvaHoraria resumo={resumo} />}
        </>
      )}

      {manual && <ManualModal bag={bag} onClose={() => setManual(false)} />}
    </div>
  );
}

function uvLabel(uv: number | null): string | undefined {
  if (uv == null) return undefined;
  if (uv >= 11) return 'extremo';
  if (uv >= 8) return 'muito alto';
  if (uv >= 6) return 'alto';
  if (uv >= 3) return 'moderado';
  return 'baixo';
}

// ── Degrade (sem dados de API) ────────────────────────────────────────────────
function DegradeCard({ motivo, onManual, carregando }: { motivo: PrevisaoMotivo; onManual: () => void; carregando: boolean }) {
  if (carregando) {
    return <div className="h-[220px] animate-pulse rounded-2xl bg-black/[0.05]" />;
  }
  const info = motivo ? MOTIVO_TXT[motivo] : { titulo: 'Sem previsão ainda', texto: 'Clique em "Atualizar previsão" para buscar o tempo do dia do evento.' };
  return (
    <EmptyState icon={<IcoAlert />} title={info.titulo}
      cta={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={onManual} className={btnPrimary}><IcoEdit /> Informar previsão manual</button>
          {motivo === 'sem_coordenadas' && <a href="/painel/minha-propriedade" className={btnSecondary}>Cadastrar local</a>}
        </div>
      }>
      {info.texto}
    </EmptyState>
  );
}

// ── Curva horária (SVG combo: temperatura em linha + chuva % em barras) ────────
function CurvaHoraria({ resumo }: { resumo: ClimaResumo }) {
  const horas = resumo.horas;
  const W = 720, H = 200, padX = 36, padY = 24, padB = 26;
  const innerW = W - padX * 2, innerH = H - padY - padB;

  const temps = horas.map((h) => h.temp).filter((v): v is number => v != null);
  const tMin = temps.length ? Math.min(...temps) : 0;
  const tMax = temps.length ? Math.max(...temps) : 1;
  const tSpan = tMax - tMin || 1;
  const x = (i: number) => padX + (horas.length <= 1 ? innerW / 2 : (i / (horas.length - 1)) * innerW);
  const yTemp = (t: number) => padY + innerH - ((t - tMin) / tSpan) * innerH;
  const yChuva = (p: number) => padY + innerH - (Math.max(0, Math.min(100, p)) / 100) * innerH;

  const linha = horas.map((h, i) => (h.temp == null ? null : `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${yTemp(h.temp).toFixed(1)}`)).filter(Boolean).join(' ');
  const barW = Math.max(3, (innerW / Math.max(1, horas.length)) * 0.5);
  const step = Math.max(1, Math.ceil(horas.length / 8)); // rótulos de hora espaçados

  return (
    <div className="rounded-2xl bg-white p-4 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-ink">Curva horária do dia</h3>
        <div className="flex items-center gap-3 text-[0.7rem] text-ink-muted">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-sky-300" /> chuva %</span>
          <span className="inline-flex items-center gap-1"><span className="h-0.5 w-3 rounded-sm bg-amber-500" /> temp °C</span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Curva horária de chuva e temperatura">
        {[0, 25, 50, 75, 100].map((g) => (
          <line key={g} x1={padX} x2={W - padX} y1={yChuva(g)} y2={yChuva(g)} stroke="#0000000d" strokeWidth={1} />
        ))}
        {horas.map((h, i) => h.chuva_prob == null ? null : (
          <rect key={i} x={x(i) - barW / 2} y={yChuva(h.chuva_prob)} width={barW} height={padY + innerH - yChuva(h.chuva_prob)} rx={2} fill="#7dd3fc" />
        ))}
        {linha && <path d={linha} fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {horas.map((h, i) => h.temp == null ? null : <circle key={i} cx={x(i)} cy={yTemp(h.temp)} r={2} fill="#f59e0b" />)}
        {horas.map((h, i) => (i % step === 0 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">{h.hora}</text>
        ) : null))}
      </svg>
    </div>
  );
}

// ── Entrada manual da previsão ─────────────────────────────────────────────────
const COND_OPCOES: { codigo: number; label: string }[] = [
  { codigo: 0, label: 'Céu limpo' }, { codigo: 2, label: 'Parcialmente nublado' }, { codigo: 3, label: 'Nublado' },
  { codigo: 45, label: 'Névoa' }, { codigo: 61, label: 'Chuva' }, { codigo: 80, label: 'Pancadas de chuva' },
  { codigo: 95, label: 'Trovoada' },
];
function ManualModal({ bag, onClose }: { bag: PlanoBBag; onClose: () => void }) {
  const toast = useToast();
  const r0 = bag.resumo && bag.resumo.manual ? bag.resumo : null;
  const [chuva, setChuva] = useState(r0?.chuva_prob != null ? String(r0.chuva_prob) : '');
  const [precip, setPrecip] = useState(r0?.precipitacao != null ? String(r0.precipitacao) : '');
  const [vento, setVento] = useState(r0?.vento != null ? String(r0.vento) : '');
  const [rajada, setRajada] = useState(r0?.rajada != null ? String(r0.rajada) : '');
  const [tmax, setTmax] = useState(r0?.temp_max != null ? String(r0.temp_max) : '');
  const [tmin, setTmin] = useState(r0?.temp_min != null ? String(r0.temp_min) : '');
  const [uv, setUv] = useState(r0?.uv != null ? String(r0.uv) : '');
  const [visKm, setVisKm] = useState(r0?.visibilidade != null ? String(r0.visibilidade / 1000) : '');
  const [codigo, setCodigo] = useState(r0?.codigo != null ? String(r0.codigo) : '2');
  const [salvando, setSalvando] = useState(false);

  const numOrNull = (s: string): number | null => { const x = Number(s.replace(',', '.')); return s.trim() !== '' && Number.isFinite(x) ? x : null; };

  const salvar = async () => {
    setSalvando(true);
    const resumo: ClimaResumo = {
      ...resumoVazio(), fonte: 'manual', manual: true, dia: bag.evento.data_inicio?.slice(0, 10) || null,
      chuva_prob: numOrNull(chuva), precipitacao: numOrNull(precip), vento: numOrNull(vento), rajada: numOrNull(rajada),
      temp_max: numOrNull(tmax), temp_min: numOrNull(tmin), uv: numOrNull(uv),
      visibilidade: visKm.trim() ? (numOrNull(visKm) ?? 0) * 1000 : null,
      codigo: numOrNull(codigo),
    };
    const ok = await bag.salvarManual(resumo);
    setSalvando(false);
    if (!ok) { toast.error('Não foi possível salvar a previsão manual.'); return; }
    toast.success('Previsão manual registrada.');
    onClose();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-1 text-lg font-bold text-ink">Previsão manual</h3>
      <p className="mb-4 text-sm text-ink-muted">Use quando não houver previsão automática. Estes valores alimentam o semáforo de risco do evento.</p>
      <div className="grid grid-cols-2 gap-4">
        <Campo label="Condição" full>
          <select value={codigo} onChange={(e) => setCodigo(e.target.value)} className={`${inp} bg-white`}>
            {COND_OPCOES.map((c) => <option key={c.codigo} value={c.codigo}>{c.label}</option>)}
          </select>
        </Campo>
        <Campo label="Chance de chuva (%)"><input value={chuva} onChange={(e) => setChuva(e.target.value)} inputMode="numeric" className={inp} placeholder="0–100" /></Campo>
        <Campo label="Precipitação (mm)"><input value={precip} onChange={(e) => setPrecip(e.target.value)} inputMode="decimal" className={inp} placeholder="mm" /></Campo>
        <Campo label="Vento (km/h)"><input value={vento} onChange={(e) => setVento(e.target.value)} inputMode="numeric" className={inp} placeholder="km/h" /></Campo>
        <Campo label="Rajadas (km/h)"><input value={rajada} onChange={(e) => setRajada(e.target.value)} inputMode="numeric" className={inp} placeholder="km/h" /></Campo>
        <Campo label="Temp. máx. (°C)"><input value={tmax} onChange={(e) => setTmax(e.target.value)} inputMode="numeric" className={inp} placeholder="°C" /></Campo>
        <Campo label="Temp. mín. (°C)"><input value={tmin} onChange={(e) => setTmin(e.target.value)} inputMode="numeric" className={inp} placeholder="°C" /></Campo>
        <Campo label="Índice UV"><input value={uv} onChange={(e) => setUv(e.target.value)} inputMode="numeric" className={inp} placeholder="0–11+" /></Campo>
        <Campo label="Visibilidade (km)"><input value={visKm} onChange={(e) => setVisKm(e.target.value)} inputMode="decimal" className={inp} placeholder="km" /></Campo>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : 'Salvar previsão'}</button>
      </div>
    </ModalShell>
  );
}

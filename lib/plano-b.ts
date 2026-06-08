// Motor PURO de Clima & Plano B (eventos outdoor) da Ventsy.
// ─────────────────────────────────────────────────────────────────────────────
// Reduz o risco de eventos ao ar livre: pega a PREVISÃO do tempo para a data/local
// do evento, avalia GATILHOS (limiares de chuva/vento/calor/frio/tempestade/
// visibilidade/UV) e classifica cada plano em verde/amarelo/vermelho, alimentando
// o painel de risco do evento, a checklist de contingência e os comunicados.
// Escala: corrida (calor/UV → hidratação), air show (vento/teto/visibilidade),
// equestre (piso/lama), casamento no jardim, festa de igreja, exposição de carros.
//
// Consumido por:
//   • /painel/plano-b   (previsão, gatilhos & planos, contingência, comunicação)
//   • /api/plano-b       (busca a previsão na API de meteo + cacheia o snapshot —
//                          a PARSE da resposta é pura e mora aqui)
//   • /api/cron/clima-eventos (atualiza snapshots dos próximos eventos)
//
// Regras de ouro (espelham lib/producao.ts, lib/logistica.ts, lib/reservas.ts):
//   • SEM React, SEM Supabase, SEM "R$"/Intl aqui — só números/datas/strings crus.
//     A formatação (data/moeda/locale) fica em lib/format, chamada por quem usa.
//   • Determinístico e testável: nada de relógio/fetch escondido na lógica. O
//     "hoje"/dia entram por parâmetro; o parse recebe o JSON já buscado.
//   • i18n: os rótulos PT são o default dos catálogos; a UI pode reescrevê-los.

// ── Datas (puro, agnóstico de fuso) ───────────────────────────────────────────
/** 'YYYY-MM-DD' + n dias → 'YYYY-MM-DD' (ancorado ao meio-dia p/ evitar DST/UTC off-by-one). */
export function addDiasYMD(ymd: string, n: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd || '')) return ymd
  const d = new Date(`${ymd}T12:00:00`)
  d.setDate(d.getDate() + Math.round(Number(n) || 0))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Date → 'YYYY-MM-DD' local. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
/** Só a parte 'YYYY-MM-DD' de uma string de data/timestamp (null se inválida). */
export function diaDe(v: string | null | undefined): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((v || '').trim())
  return m ? m[1] : null
}
/** 'HH:MM[:SS]' → minutos desde a meia-noite (null se inválido). */
export function horaParaMin(v: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec((v || '').trim())
  if (!m) return null
  return Math.min(24 * 60, Number(m[1]) * 60 + Number(m[2]))
}

// Open-Meteo entrega previsão até ~16 dias à frente; além disso não há dado.
export const HORIZONTE_PREVISAO_DIAS = 16
/** A data do evento está dentro da janela em que existe previsão? */
export function previsaoDisponivel(dia: string | null, hoje: string, dias = HORIZONTE_PREVISAO_DIAS): boolean {
  if (!dia || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false
  if (dia < hoje) return false                       // evento no passado
  return dia <= addDiasYMD(hoje, dias)
}

// ── Vocabulário do domínio ────────────────────────────────────────────────────
/** Tipo de risco climático (espelha o CHECK do SQL). */
export type RiscoTipo =
  | 'chuva' | 'vento' | 'calor' | 'frio' | 'tempestade' | 'baixa_visibilidade' | 'uv'

/** Métrica meteorológica que o gatilho observa. */
export type Metrica =
  | 'chuva_prob' | 'precipitacao' | 'vento' | 'rajada'
  | 'temp_max' | 'temp_min' | 'uv' | 'visibilidade'

/** Sentido do limiar: 'acima' dispara quando valor ≥ limiar; 'abaixo' quando ≤. */
export type Operador = 'acima' | 'abaixo'

/** Nível de risco resultante de avaliar um gatilho contra a previsão. */
export type NivelRisco = 'verde' | 'amarelo' | 'vermelho' | 'sem_dados'

/** Estado operacional de um plano (definido pelo usuário; ≠ nível calculado). */
export type PlanoStatus = 'armado' | 'acionado' | 'descartado'

/** Limiar de disparo do plano. `atencao` → amarelo; `critico` → vermelho.
 *  Para 'acima', critico > atencao; para 'abaixo', critico < atencao. */
export type Gatilho = {
  metrica: Metrica
  operador: Operador
  atencao: number
  critico: number
  unidade: string   // rótulo da unidade ('%','mm','km/h','°C','UV','km') — só exibição
}

/** Item da checklist de contingência (lonas, escoamento, ventiladores…). */
export type ChecklistItem = { label: string; responsavel: string | null; ok: boolean }

/** Linha de `plano_contingencia` (gatilho + ação + contingência + comunicado). */
export type Plano = {
  id: string
  usuario_id?: string
  evento_id: string
  tipo_risco: RiscoTipo | string
  gatilho: Gatilho
  acao: string
  responsavel: string | null
  status: PlanoStatus | string
  comunicado_template: string | null
  checklist: ChecklistItem[]
  ordem: number
  criado_em?: string
  atualizado_em?: string
}

// ── Previsão normalizada (o que a UI consome; guardado em clima_snapshots) ─────
/** Uma hora da previsão (para o gráfico horário do dia). */
export type ClimaHora = {
  hora: string          // 'HH:MM'
  temp: number | null   // °C
  chuva_prob: number | null  // %
  precipitacao: number | null // mm
  vento: number | null  // km/h
  rajada: number | null // km/h
  uv: number | null
  visibilidade: number | null // metros
  codigo: number | null // WMO weather code
}
/** Resumo da previsão do dia do evento (agregado na janela do evento). */
export type ClimaResumo = {
  fonte: string                 // 'open-meteo' | 'manual' | …
  manual: boolean
  dia: string | null            // 'YYYY-MM-DD'
  capturado_em: string | null   // ISO
  chuva_prob: number | null     // % (máx na janela)
  precipitacao: number | null   // mm (soma na janela)
  vento: number | null          // km/h (máx)
  rajada: number | null         // km/h (máx)
  temp_max: number | null       // °C
  temp_min: number | null       // °C
  uv: number | null             // índice UV (máx)
  visibilidade: number | null   // metros (mín)
  codigo: number | null         // WMO code do dia (condição dominante)
  nascer_sol: string | null     // ISO/'HH:MM'
  por_sol: string | null
  horas: ClimaHora[]
}

/** Resumo vazio — base segura p/ render e merge (nunca undefined nos campos). */
export function resumoVazio(): ClimaResumo {
  return {
    fonte: '', manual: false, dia: null, capturado_em: null,
    chuva_prob: null, precipitacao: null, vento: null, rajada: null,
    temp_max: null, temp_min: null, uv: null, visibilidade: null,
    codigo: null, nascer_sol: null, por_sol: null, horas: [],
  }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const numOrNull = (v: any): number | null => {
  if (v == null || v === '') return null
  const x = Number(v)
  return Number.isFinite(x) ? x : null
}
/** Mescla um resumo parcial (do banco/manual) sobre a base vazia — defensivo. */
export function mesclarResumo(parcial: Partial<ClimaResumo> | null | undefined): ClimaResumo {
  const base = resumoVazio()
  if (!parcial || typeof parcial !== 'object') return base
  const p = parcial as any
  return {
    fonte: p.fonte || '',
    manual: !!p.manual || p.fonte === 'manual',
    dia: diaDe(p.dia),
    capturado_em: p.capturado_em || null,
    chuva_prob: numOrNull(p.chuva_prob),
    precipitacao: numOrNull(p.precipitacao),
    vento: numOrNull(p.vento),
    rajada: numOrNull(p.rajada),
    temp_max: numOrNull(p.temp_max),
    temp_min: numOrNull(p.temp_min),
    uv: numOrNull(p.uv),
    visibilidade: numOrNull(p.visibilidade),
    codigo: numOrNull(p.codigo),
    nascer_sol: p.nascer_sol || null,
    por_sol: p.por_sol || null,
    horas: Array.isArray(p.horas)
      ? p.horas.filter((h: any) => h && h.hora).map((h: any): ClimaHora => ({
          hora: String(h.hora).slice(0, 5),
          temp: numOrNull(h.temp), chuva_prob: numOrNull(h.chuva_prob),
          precipitacao: numOrNull(h.precipitacao), vento: numOrNull(h.vento),
          rajada: numOrNull(h.rajada), uv: numOrNull(h.uv),
          visibilidade: numOrNull(h.visibilidade), codigo: numOrNull(h.codigo),
        }))
      : [],
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Parse da resposta Open-Meteo (PURO — o fetch fica na /api/plano-b) ─────────
export type JanelaHoras = { inicio?: string | null; fim?: string | null }
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Normaliza a resposta do Open-Meteo (forecast) para o `ClimaResumo` do dia do
 * evento. Agrega as métricas na JANELA do evento (se informada) — máx de chuva/
 * vento/UV, soma de precipitação, máx/mín de temperatura, mín de visibilidade —
 * e mantém todas as horas do dia para o gráfico. Determinístico (sem relógio).
 */
export function parseOpenMeteo(
  json: any,
  dia: string,
  janela?: JanelaHoras,
  capturadoEm?: string,
): ClimaResumo {
  const r = resumoVazio()
  r.fonte = 'open-meteo'
  r.dia = diaDe(dia)
  r.capturado_em = capturadoEm || null
  if (!json || typeof json !== 'object') return r

  // Diário (nascer/pôr do sol + código do dia) — alinhado por índice de `time`.
  const daily = json.daily || {}
  const dTimes: string[] = Array.isArray(daily.time) ? daily.time : []
  const di = dTimes.findIndex((t) => diaDe(t) === r.dia)
  if (di >= 0) {
    r.nascer_sol = daily.sunrise?.[di] ?? null
    r.por_sol = daily.sunset?.[di] ?? null
    r.codigo = numOrNull(daily.weather_code?.[di])
  }

  // Horário — monta as horas do dia e agrega na janela.
  const hourly = json.hourly || {}
  const hTimes: string[] = Array.isArray(hourly.time) ? hourly.time : []
  const minI = janela?.inicio ? horaParaMin(janela.inicio) : null
  const minF = janela?.fim ? horaParaMin(janela.fim) : null
  const dentroJanela = (hhmm: string): boolean => {
    if (minI == null && minF == null) return true
    const m = horaParaMin(hhmm)
    if (m == null) return false
    const lo = minI ?? 0
    const hi = minF == null ? 24 * 60 : (minF >= lo ? minF : 24 * 60) // fim<início ⇒ vai até o fim do dia
    return m >= lo && m <= hi
  }

  const horas: ClimaHora[] = []
  const naJanela: ClimaHora[] = []
  for (let i = 0; i < hTimes.length; i++) {
    if (diaDe(hTimes[i]) !== r.dia) continue
    const hhmm = (hTimes[i].split('T')[1] || '00:00').slice(0, 5)
    const h: ClimaHora = {
      hora: hhmm,
      temp: numOrNull(hourly.temperature_2m?.[i]),
      chuva_prob: numOrNull(hourly.precipitation_probability?.[i]),
      precipitacao: numOrNull(hourly.precipitation?.[i]),
      vento: numOrNull(hourly.wind_speed_10m?.[i]),
      rajada: numOrNull(hourly.wind_gusts_10m?.[i]),
      uv: numOrNull(hourly.uv_index?.[i]),
      visibilidade: numOrNull(hourly.visibility?.[i]),
      codigo: numOrNull(hourly.weather_code?.[i]),
    }
    horas.push(h)
    if (dentroJanela(hhmm)) naJanela.push(h)
  }
  r.horas = horas
  const agg = naJanela.length ? naJanela : horas

  const maxDe = (sel: (h: ClimaHora) => number | null): number | null => {
    const vs = agg.map(sel).filter((v): v is number => v != null)
    return vs.length ? Math.max(...vs) : null
  }
  const minDe = (sel: (h: ClimaHora) => number | null): number | null => {
    const vs = agg.map(sel).filter((v): v is number => v != null)
    return vs.length ? Math.min(...vs) : null
  }
  const somaDe = (sel: (h: ClimaHora) => number | null): number | null => {
    const vs = agg.map(sel).filter((v): v is number => v != null)
    return vs.length ? Math.round(vs.reduce((s, v) => s + v, 0) * 10) / 10 : null
  }

  r.chuva_prob = maxDe((h) => h.chuva_prob)
  r.precipitacao = somaDe((h) => h.precipitacao)
  r.vento = maxDe((h) => h.vento)
  r.rajada = maxDe((h) => h.rajada)
  r.temp_max = maxDe((h) => h.temp) ?? numOrNull(daily.temperature_2m_max?.[di])
  r.temp_min = minDe((h) => h.temp) ?? numOrNull(daily.temperature_2m_min?.[di])
  r.uv = maxDe((h) => h.uv) ?? numOrNull(daily.uv_index_max?.[di])
  r.visibilidade = minDe((h) => h.visibilidade)
  // Fallbacks do diário quando não houve hora na janela.
  if (r.chuva_prob == null) r.chuva_prob = numOrNull(daily.precipitation_probability_max?.[di])
  if (r.precipitacao == null) r.precipitacao = numOrNull(daily.precipitation_sum?.[di])
  if (r.vento == null) r.vento = numOrNull(daily.wind_speed_10m_max?.[di])
  if (r.rajada == null) r.rajada = numOrNull(daily.wind_gusts_10m_max?.[di])
  return r
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Parâmetros `hourly`/`daily` que a /api/plano-b pede ao Open-Meteo. */
export const OPEN_METEO_HOURLY = [
  'temperature_2m', 'precipitation_probability', 'precipitation', 'weather_code',
  'wind_speed_10m', 'wind_gusts_10m', 'uv_index', 'visibility',
].join(',')
export const OPEN_METEO_DAILY = [
  'weather_code', 'temperature_2m_max', 'temperature_2m_min',
  'precipitation_probability_max', 'precipitation_sum',
  'wind_speed_10m_max', 'wind_gusts_10m_max', 'uv_index_max', 'sunrise', 'sunset',
].join(',')
export const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
/** URL do Open-Meteo (forecast) p/ um ponto + dia. Pura (sem fetch). */
export function urlOpenMeteo(lat: number, lon: number, dia: string): string {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    start_date: dia,
    end_date: dia,
    wind_speed_unit: 'kmh',
    hourly: OPEN_METEO_HOURLY,
    daily: OPEN_METEO_DAILY,
  })
  return `${OPEN_METEO_ENDPOINT}?${q.toString()}`
}

// ── Códigos WMO → condição (rótulo PT + ícone simples) ────────────────────────
export type CondIcone = 'sol' | 'sol_nuvem' | 'nuvem' | 'nevoa' | 'chuva' | 'tempestade' | 'neve'
const WMO: Record<number, { label: string; icone: CondIcone }> = {
  0: { label: 'Céu limpo', icone: 'sol' },
  1: { label: 'Predominantemente limpo', icone: 'sol' },
  2: { label: 'Parcialmente nublado', icone: 'sol_nuvem' },
  3: { label: 'Nublado', icone: 'nuvem' },
  45: { label: 'Névoa', icone: 'nevoa' }, 48: { label: 'Névoa com geada', icone: 'nevoa' },
  51: { label: 'Garoa fraca', icone: 'chuva' }, 53: { label: 'Garoa', icone: 'chuva' }, 55: { label: 'Garoa intensa', icone: 'chuva' },
  56: { label: 'Garoa congelante', icone: 'chuva' }, 57: { label: 'Garoa congelante forte', icone: 'chuva' },
  61: { label: 'Chuva fraca', icone: 'chuva' }, 63: { label: 'Chuva moderada', icone: 'chuva' }, 65: { label: 'Chuva forte', icone: 'chuva' },
  66: { label: 'Chuva congelante', icone: 'chuva' }, 67: { label: 'Chuva congelante forte', icone: 'chuva' },
  71: { label: 'Neve fraca', icone: 'neve' }, 73: { label: 'Neve', icone: 'neve' }, 75: { label: 'Neve forte', icone: 'neve' }, 77: { label: 'Grãos de neve', icone: 'neve' },
  80: { label: 'Pancadas de chuva', icone: 'chuva' }, 81: { label: 'Pancadas fortes', icone: 'chuva' }, 82: { label: 'Pancadas violentas', icone: 'chuva' },
  85: { label: 'Pancadas de neve', icone: 'neve' }, 86: { label: 'Pancadas de neve fortes', icone: 'neve' },
  95: { label: 'Trovoada', icone: 'tempestade' }, 96: { label: 'Trovoada com granizo', icone: 'tempestade' }, 99: { label: 'Trovoada com granizo forte', icone: 'tempestade' },
}
export function condicaoDe(codigo: number | null | undefined): { label: string; icone: CondIcone } {
  if (codigo == null) return { label: '—', icone: 'nuvem' }
  return WMO[codigo] || { label: 'Indefinido', icone: 'nuvem' }
}

// ── Catálogo de riscos (rótulo PT, métrica/operador default, gatilho padrão) ───
export type RiscoMeta = {
  v: RiscoTipo
  label: string
  descricao: string
  cor: string                 // hex p/ chips/realces
  metrica: Metrica
  operador: Operador
  unidade: string
  gatilho: { atencao: number; critico: number }
}
export const RISCOS: RiscoMeta[] = [
  { v: 'chuva', label: 'Chuva', descricao: 'Probabilidade de chuva no horário do evento.', cor: '#0ea5e9',
    metrica: 'chuva_prob', operador: 'acima', unidade: '%', gatilho: { atencao: 50, critico: 80 } },
  { v: 'vento', label: 'Vento', descricao: 'Velocidade do vento — risco para tendas e estruturas.', cor: '#14b8a6',
    metrica: 'vento', operador: 'acima', unidade: 'km/h', gatilho: { atencao: 35, critico: 50 } },
  { v: 'tempestade', label: 'Tempestade', descricao: 'Rajadas fortes / temporal — suspensão e abrigo.', cor: '#7c3aed',
    metrica: 'rajada', operador: 'acima', unidade: 'km/h', gatilho: { atencao: 45, critico: 65 } },
  { v: 'calor', label: 'Calor', descricao: 'Temperatura máxima — sombra, hidratação, climatização.', cor: '#f97316',
    metrica: 'temp_max', operador: 'acima', unidade: '°C', gatilho: { atencao: 33, critico: 38 } },
  { v: 'frio', label: 'Frio', descricao: 'Temperatura mínima — aquecedores e conforto.', cor: '#3b82f6',
    metrica: 'temp_min', operador: 'abaixo', unidade: '°C', gatilho: { atencao: 12, critico: 6 } },
  { v: 'uv', label: 'Índice UV', descricao: 'Radiação UV — protetor, sombra, protocolo de hidratação.', cor: '#eab308',
    metrica: 'uv', operador: 'acima', unidade: 'UV', gatilho: { atencao: 8, critico: 11 } },
  { v: 'baixa_visibilidade', label: 'Visibilidade', descricao: 'Visibilidade mínima — crítico para air show/fly-in.', cor: '#64748b',
    metrica: 'visibilidade', operador: 'abaixo', unidade: 'm', gatilho: { atencao: 5000, critico: 2000 } },
]
const RISCO_BY = Object.fromEntries(RISCOS.map((r) => [r.v, r])) as Record<string, RiscoMeta>
export function riscoMeta(v: string | null | undefined): RiscoMeta {
  return RISCO_BY[v || ''] || { v: 'chuva', label: v || '—', descricao: '', cor: '#94a3b8', metrica: 'chuva_prob', operador: 'acima', unidade: '', gatilho: { atencao: 50, critico: 80 } }
}
export function riscoLabel(v: string | null | undefined): string { return riscoMeta(v).label }

export const METRICAS: { v: Metrica; label: string; unidade: string }[] = [
  { v: 'chuva_prob', label: 'Probabilidade de chuva', unidade: '%' },
  { v: 'precipitacao', label: 'Precipitação acumulada', unidade: 'mm' },
  { v: 'vento', label: 'Velocidade do vento', unidade: 'km/h' },
  { v: 'rajada', label: 'Rajadas de vento', unidade: 'km/h' },
  { v: 'temp_max', label: 'Temperatura máxima', unidade: '°C' },
  { v: 'temp_min', label: 'Temperatura mínima', unidade: '°C' },
  { v: 'uv', label: 'Índice UV', unidade: 'UV' },
  { v: 'visibilidade', label: 'Visibilidade', unidade: 'm' },
]
const METRICA_BY = Object.fromEntries(METRICAS.map((m) => [m.v, m])) as Record<string, (typeof METRICAS)[number]>
export function metricaLabel(v: string | null | undefined): string { return METRICA_BY[v || '']?.label || v || '—' }
export function metricaUnidade(v: string | null | undefined): string { return METRICA_BY[v || '']?.unidade || '' }

/** Gatilho padrão para um tipo de risco (pré-preenche o formulário). */
export function gatilhoPadrao(tipo: RiscoTipo | string): Gatilho {
  const m = riscoMeta(tipo)
  return { metrica: m.metrica, operador: m.operador, atencao: m.gatilho.atencao, critico: m.gatilho.critico, unidade: m.unidade }
}

// ── Metadados de nível e status (rótulo PT + classes Tailwind) ────────────────
export type NivelMeta = { label: string; chip: string; dot: string; ring: string; bar: string; hex: string; peso: number }
export const NIVEL_META: Record<NivelRisco, NivelMeta> = {
  verde:     { label: 'Baixo risco', chip: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500', ring: 'border-emerald-200 bg-emerald-50', bar: 'bg-emerald-500', hex: '#10b981', peso: 1 },
  amarelo:   { label: 'Atenção',     chip: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500',   ring: 'border-amber-200 bg-amber-50',     bar: 'bg-amber-400',   hex: '#f59e0b', peso: 2 },
  vermelho:  { label: 'Alto risco',  chip: 'bg-red-50 text-red-700',         dot: 'bg-red-500',     ring: 'border-red-200 bg-red-50',         bar: 'bg-red-500',     hex: '#ef4444', peso: 3 },
  sem_dados: { label: 'Sem dados',   chip: 'bg-slate-100 text-slate-600',    dot: 'bg-slate-300',   ring: 'border-black/10 bg-black/[0.02]',  bar: 'bg-slate-300',   hex: '#94a3b8', peso: 0 },
}
export function nivelMeta(n: NivelRisco): NivelMeta { return NIVEL_META[n] || NIVEL_META.sem_dados }

export const PLANO_STATUS_META: Record<string, { label: string; chip: string }> = {
  armado:     { label: 'Armado',     chip: 'bg-sky-50 text-sky-700' },
  acionado:   { label: 'Acionado',   chip: 'bg-red-50 text-red-700' },
  descartado: { label: 'Descartado', chip: 'bg-gray-100 text-gray-500' },
}

// ── Avaliação de gatilhos contra a previsão ───────────────────────────────────
/** Valor da métrica do gatilho no resumo da previsão (null se ausente). */
export function valorDaMetrica(resumo: ClimaResumo | null, metrica: Metrica | string): number | null {
  if (!resumo) return null
  switch (metrica) {
    case 'chuva_prob': return resumo.chuva_prob
    case 'precipitacao': return resumo.precipitacao
    case 'vento': return resumo.vento
    case 'rajada': return resumo.rajada
    case 'temp_max': return resumo.temp_max
    case 'temp_min': return resumo.temp_min
    case 'uv': return resumo.uv
    case 'visibilidade': return resumo.visibilidade
    default: return null
  }
}
/** O valor cruza o limiar, no sentido do operador? */
export function cruzaLimiar(valor: number, operador: Operador, limiar: number): boolean {
  return operador === 'abaixo' ? valor <= limiar : valor >= limiar
}

export type Avaliacao = { plano: Plano; nivel: NivelRisco; valor: number | null; limiar: number | null }
/**
 * Avalia UM plano contra a previsão: nível vermelho se cruza o `critico`,
 * amarelo se cruza o `atencao`, verde caso contrário; `sem_dados` se a métrica
 * não está disponível na previsão. Robusto a limiares na "ordem errada" pois
 * checa o crítico primeiro.
 */
export function avaliarPlano(plano: Plano, resumo: ClimaResumo | null): Avaliacao {
  const g = plano.gatilho
  const valor = valorDaMetrica(resumo, g.metrica)
  if (valor == null) return { plano, nivel: 'sem_dados', valor: null, limiar: null }
  if (cruzaLimiar(valor, g.operador, g.critico)) return { plano, nivel: 'vermelho', valor, limiar: g.critico }
  if (cruzaLimiar(valor, g.operador, g.atencao)) return { plano, nivel: 'amarelo', valor, limiar: g.atencao }
  return { plano, nivel: 'verde', valor, limiar: null }
}
/** Avalia todos os planos (descartados ficam de fora do semáforo). */
export function avaliarPlanos(planos: Plano[], resumo: ClimaResumo | null): Avaliacao[] {
  return planos.filter((p) => p.status !== 'descartado').map((p) => avaliarPlano(p, resumo))
}
/** Nível geral do evento = pior nível entre as avaliações (vermelho > amarelo > verde). */
export function nivelGeral(avaliacoes: Avaliacao[]): NivelRisco {
  let melhor: NivelRisco = 'sem_dados'
  for (const a of avaliacoes) {
    if (nivelMeta(a.nivel).peso > nivelMeta(melhor).peso) melhor = a.nivel
  }
  return melhor
}
/** Avaliações que dispararam (amarelo/vermelho), piores primeiro. */
export function avaliacoesDisparadas(avaliacoes: Avaliacao[]): Avaliacao[] {
  return avaliacoes
    .filter((a) => a.nivel === 'amarelo' || a.nivel === 'vermelho')
    .sort((a, b) => nivelMeta(b.nivel).peso - nivelMeta(a.nivel).peso)
}

// ── Checklist de contingência ─────────────────────────────────────────────────
export function normalizarChecklist(v: unknown): ChecklistItem[] {
  if (!Array.isArray(v)) return []
  return v
    .filter((i): i is Record<string, unknown> => !!i && typeof i === 'object')
    .map((i) => ({
      label: String((i as { label?: unknown }).label || '').trim(),
      responsavel: (i as { responsavel?: unknown }).responsavel ? String((i as { responsavel?: unknown }).responsavel) : null,
      ok: !!(i as { ok?: unknown }).ok,
    }))
    .filter((i) => i.label)
}
/** Fração concluída de uma checklist (0–1). Use lib/format.formatPercent na UI. */
export function progressoChecklist(itens: ChecklistItem[]): number {
  if (!itens.length) return 0
  return itens.filter((i) => i.ok).length / itens.length
}
/** Item da checklist agregada do evento, com referência ao plano de origem. */
export type ChecklistRef = { planoId: string; tipo_risco: string; indice: number; item: ChecklistItem }
/** Achata as checklists de todos os planos (não-descartados) numa lista única. */
export function checklistDoEvento(planos: Plano[]): ChecklistRef[] {
  const out: ChecklistRef[] = []
  for (const p of planos) {
    if (p.status === 'descartado') continue
    p.checklist.forEach((item, indice) => out.push({ planoId: p.id, tipo_risco: p.tipo_risco, indice, item }))
  }
  return out
}

// ── Comunicação (templates com variáveis {…}) ─────────────────────────────────
export type ComunicadoVars = {
  evento?: string; data?: string; local?: string; empresa?: string
  risco?: string; acao?: string; nivel?: string; contato?: string
}
/** Substitui {chave} pelas variáveis informadas (chaves ausentes viram ''). */
export function renderComunicado(template: string, vars: ComunicadoVars): string {
  return (template || '').replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = (vars as Record<string, string | undefined>)[k]
    return v == null ? '' : String(v)
  })
}
/** Comunicado-modelo por tipo de risco (texto base; o usuário edita por plano). */
export function comunicadoSeed(tipo: RiscoTipo | string): string {
  const r = riscoLabel(tipo)
  return [
    'Olá! Aqui é da {empresa}.',
    'Sobre o evento "{evento}" em {data} ({local}):',
    `a previsão indica risco de ${r.toLowerCase()}.`,
    'Por precaução, vamos {acao}.',
    'Seguimos monitorando e avisamos qualquer mudança. Qualquer dúvida, fale com {contato}.',
  ].join(' ')
}
/** Públicos-alvo do comunicado (liga com Campanhas/Portal/equipe). */
export const AUDIENCIAS: { v: string; label: string }[] = [
  { v: 'cliente', label: 'Cliente / contratante' },
  { v: 'equipe', label: 'Equipe & fornecedores' },
  { v: 'publico', label: 'Público / convidados' },
]

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES de planos por tipo de evento outdoor — geram planos prontos
// (gatilho + ação + checklist + comunicado) tunados ao risco daquele evento.
// ─────────────────────────────────────────────────────────────────────────────
export type TemplateKey = 'corrida' | 'airshow' | 'equestre' | 'casamento' | 'show' | 'generico'

export type PlanoSeed = {
  tipo_risco: RiscoTipo
  gatilho: Gatilho
  acao: string
  responsavel: string | null
  comunicado_template: string
  checklist: ChecklistItem[]
  ordem: number
}
type SeedDef = { tipo: RiscoTipo; acao: string; checklist: string[]; gatilho?: Partial<Gatilho> }

function seed(def: SeedDef, ordem: number): PlanoSeed {
  const g = { ...gatilhoPadrao(def.tipo), ...(def.gatilho || {}) }
  return {
    tipo_risco: def.tipo, gatilho: g, acao: def.acao, responsavel: null,
    comunicado_template: comunicadoSeed(def.tipo),
    checklist: def.checklist.map((label) => ({ label, responsavel: null, ok: false })),
    ordem,
  }
}

const TEMPLATES: Record<TemplateKey, { nome: string; seeds: SeedDef[] }> = {
  corrida: {
    nome: 'Corrida / Esportivo',
    seeds: [
      { tipo: 'calor', acao: 'reforçar hidratação e sombra, antecipar a largada se necessário', gatilho: { atencao: 30, critico: 35 },
        checklist: ['Postos de hidratação extras no percurso', 'Tendas de sombra na largada/chegada', 'Reforço de apoio médico e soro', 'Comunicar protocolo de calor aos atletas'] },
      { tipo: 'uv', acao: 'orientar protetor solar e reforçar hidratação',
        checklist: ['Protetor solar disponível na retirada de kit', 'Sinalização de proteção UV', 'Água gelada nos postos'] },
      { tipo: 'chuva', acao: 'avaliar adiamento da largada e proteger a cronometragem', gatilho: { atencao: 60, critico: 85 },
        checklist: ['Cobertura para cronometragem e som', 'Pisos antiderrapantes na largada/chegada', 'Plano de adiamento da largada', 'Lonas para o kit/credenciamento'] },
      { tipo: 'tempestade', acao: 'suspender a prova e abrigar atletas e público',
        checklist: ['Pontos de abrigo definidos', 'Protocolo de suspensão com a federação', 'Comunicação de emergência pronta'] },
    ],
  },
  airshow: {
    nome: 'Air show / Fly-in',
    seeds: [
      { tipo: 'baixa_visibilidade', acao: 'suspender voos até o teto/visibilidade voltarem ao mínimo', gatilho: { atencao: 5000, critico: 3000 },
        checklist: ['Confirmar teto e visibilidade mínimos com a coordenação de voo', 'NOTAM e ATC informados', 'Plano de espera em solo'] },
      { tipo: 'vento', acao: 'reavaliar a grade de voo e o vento cruzado na pista', gatilho: { atencao: 28, critico: 40 },
        checklist: ['Medição de vento cruzado na cabeceira', 'Briefing de pilotos sobre limites', 'Reposicionar barracas e estruturas'] },
      { tipo: 'tempestade', acao: 'interromper a apresentação e recolher aeronaves', gatilho: { atencao: 40, critico: 60 },
        checklist: ['Aeronaves hangaradas/amarradas', 'Público para abrigo', 'Energia e palco protegidos'] },
      { tipo: 'chuva', acao: 'proteger área de exposição e aeronaves estáticas', gatilho: { atencao: 50, critico: 80 },
        checklist: ['Lonas nas aeronaves estáticas', 'Escoamento no estacionamento de aeronaves', 'Pisos para o público'] },
    ],
  },
  equestre: {
    nome: 'Equestre / Vaquejada / Hípica',
    seeds: [
      { tipo: 'chuva', acao: 'avaliar condição do piso/lama e adiar provas se inseguro', gatilho: { atencao: 40, critico: 70 },
        checklist: ['Vistoria do piso da pista/raia', 'Areia/serragem para drenagem', 'Plano de adiamento por lama', 'Cobertura para baias e julgamento'] },
      { tipo: 'tempestade', acao: 'recolher animais e suspender a competição',
        checklist: ['Abrigo de animais garantido', 'Protocolo de suspensão', 'Estruturas e som protegidos'] },
      { tipo: 'calor', acao: 'reforçar hidratação de animais e atletas, sombra',
        checklist: ['Água para animais e público', 'Sombra nas baias', 'Apoio veterinário de prontidão'] },
    ],
  },
  casamento: {
    nome: 'Casamento / Festa no jardim',
    seeds: [
      { tipo: 'chuva', acao: 'acionar a tenda/cobertura e mover a cerimônia para a área coberta', gatilho: { atencao: 40, critico: 70 },
        checklist: ['Tenda/cobertura confirmada com o fornecedor', 'Layout alternativo na área coberta', 'Escoamento e pisos no jardim', 'Guarda-chuvas para os convidados', 'Seguro-chuva acionável'] },
      { tipo: 'vento', acao: 'reforçar a fixação de tendas e decoração', gatilho: { atencao: 30, critico: 45 },
        checklist: ['Fixação reforçada de tendas e arcos', 'Velas/itens leves protegidos', 'Som e iluminação ancorados'] },
      { tipo: 'calor', acao: 'instalar climatização, ventiladores e pontos de água', gatilho: { atencao: 32, critico: 37 },
        checklist: ['Ventiladores/climatizadores na área de convidados', 'Estação de água e leques', 'Sombra na recepção'] },
    ],
  },
  show: {
    nome: 'Show / Festival ao ar livre',
    seeds: [
      { tipo: 'tempestade', acao: 'suspender o palco e abrigar o público (protocolo de raio)', gatilho: { atencao: 45, critico: 65 },
        checklist: ['Protocolo de suspensão por raio definido', 'Pontos de abrigo e rotas de saída', 'Energia/palco aterrados e protegidos'] },
      { tipo: 'vento', acao: 'reduzir/abaixar telões e estruturas de palco', gatilho: { atencao: 35, critico: 55 },
        checklist: ['Telões e fly-bars rebaixáveis', 'Estruturas com lastro conferido', 'Fechamento lateral de palco avaliado'] },
      { tipo: 'chuva', acao: 'proteger equipamentos e cobrir áreas técnicas',
        checklist: ['Cobertura de FOH e palco', 'Pisos/estrados antiderrapantes', 'Lonas para geradores e cabeamento'] },
    ],
  },
  generico: {
    nome: 'Evento ao ar livre (genérico)',
    seeds: [
      { tipo: 'chuva', acao: 'acionar cobertura/tenda e mover para a área interna alternativa',
        checklist: ['Cobertura/tenda confirmada', 'Área interna alternativa definida', 'Escoamento e pisos', 'Lonas para equipamentos'] },
      { tipo: 'vento', acao: 'reforçar fixação de estruturas e itens leves',
        checklist: ['Fixação de tendas/estruturas', 'Itens leves recolhidos', 'Som/iluminação ancorados'] },
      { tipo: 'calor', acao: 'instalar sombra, climatização e pontos de hidratação',
        checklist: ['Pontos de água/hidratação', 'Sombra e ventilação', 'Sinalização de calor'] },
    ],
  },
}

/** Lista de templates disponíveis (p/ a UI escolher manualmente). */
export function listarTemplates(): { key: TemplateKey; nome: string }[] {
  return (Object.keys(TEMPLATES) as TemplateKey[]).map((key) => ({ key, nome: TEMPLATES[key].nome }))
}
/** Mapeia o `tipo_evento` livre do CRM para a chave de template mais próxima. */
export function templateKeyParaTipo(tipo: string | null | undefined): TemplateKey {
  const t = (tipo || '').toLowerCase()
  if (/corrid|maraton|run|ciclis|espor|atlet|triat/.test(t)) return 'corrida'
  if (/air\s?show|fly|aviac|aeron|avia|anac|aerea/.test(t)) return 'airshow'
  if (/equest|hipic|hípic|vaqueja|cavalg|rodeio|cavalo|montaria/.test(t)) return 'equestre'
  if (/casa|wedding|noiv|matr|jardim|debut|15\s*anos/.test(t)) return 'casamento'
  if (/show|festiv|music|palco|dj/.test(t)) return 'show'
  return 'generico'
}
/** Gera os planos-semente de um template (a /api ou o client grava). */
export function gerarPlanosDoTemplate(key: TemplateKey): PlanoSeed[] {
  const tpl = TEMPLATES[key] || TEMPLATES.generico
  return tpl.seeds.map((def, i) => seed(def, i))
}

// ── Detecção de "tabela ainda não criada" (rodar o SQL) ──────────────────────
export function isMissingTable(err: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false
  return err.code === 'PGRST205' || err.code === '42P01' ||
    /could not find the table|schema cache|does not exist/i.test(err.message || '')
}

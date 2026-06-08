// _lib — tipos e helpers só do módulo Logística (/painel/logistica).
// A lógica de domínio (cronograma, choque de docas, frota) vive em
// lib/logistica.ts (pura e testada) — aqui ficam apenas os tipos de vínculo
// (evento/fornecedor/espaço/propriedade), plumbing de <input datetime-local>
// e export CSV. Regra de ouro: NADA de "R$"/percentual/data formatada para
// EXIBIÇÃO aqui — só dados crus; a formatação fica em lib/format, na página.

import {
  janelaRange, credencialVeiculo,
  janelaTipoMeta, chegadaStatusMeta, frotaStatusMeta,
  type Janela, type Chegada, type Veiculo,
} from '@/lib/logistica'

// ── Tipos de vínculo (subconjuntos do schema) ────────────────────────────────
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  propriedade_id: number | null
}
export function eventoLabel(e: EventoLite | null | undefined): string {
  if (!e) return '—'
  return e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento sem nome'
}

export type FornecedorLite = { id: string; nome: string; fantasia: string | null; categoria?: string | null; telefone?: string | null; whatsapp?: string | null; contato?: string | null }
export function fornecedorLabel(f: FornecedorLite | null | undefined): string {
  if (!f) return '—'
  return f.fantasia || f.nome
}
export function fornecedorContato(f: FornecedorLite | null | undefined): string {
  if (!f) return ''
  return f.whatsapp || f.telefone || f.contato || ''
}

export type EspacoLite = { id: number; nome: string; tipo: string | null; propriedade_id: number; cor: string | null; ativo?: boolean }
export type PropriedadeLite = { id: number; nome: string | null; titulo?: string | null }
export function propriedadeLabel(p: PropriedadeLite | null | undefined): string {
  if (!p) return '—'
  return p.titulo || p.nome || `Propriedade #${p.id}`
}

// Iniciais para avatares (mesma estética dos demais módulos).
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// ── <input type="datetime-local"> ⇄ ISO ──────────────────────────────────────
// O datetime-local trabalha em horário LOCAL sem fuso ("YYYY-MM-DDTHH:mm").
// Convertemos para ISO (timestamptz) na ida e de volta na edição. É plumbing de
// data crua — não é formatação de exibição (essa fica em lib/format).
export function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
export function localInputToISO(v: string | null | undefined): string | null {
  if (!v) return null
  const d = new Date(v) // interpretado como horário local pelo runtime
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
/** 'YYYY-MM-DD' (date) + 'HH:mm' → ISO, para presets de janela a partir do evento. */
export function ymdHmToISO(ymdStr: string, hm: string): string | null {
  if (!ymdStr) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymdStr)
  const t = /^(\d{2}):(\d{2})/.exec(hm || '08:00')
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), t ? Number(t[1]) : 8, t ? Number(t[2]) : 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

// ── Export CSV (números/datas cruas — sem moeda formatada, vírgula BR-safe) ───
function baixarCSV(nome: string, header: string[], linhas: (string | number)[][]): void {
  const esc = (s: string | number) => `"${String(s ?? '').replace(/"/g, '""')}"`
  const body = linhas.map((l) => l.map(esc).join(',')).join('\n')
  const blob = new Blob(['﻿' + header.map(esc).join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportJanelasCSV(janelas: Janela[], eventoNome: (id: string | null) => string): void {
  baixarCSV('logistica-janelas',
    ['Tipo', 'Título', 'Evento', 'Início', 'Fim', 'Duração (min)', 'Observação'],
    janelas.map((j) => {
      const r = janelaRange(j)
      return [
        janelaTipoMeta(j.tipo).label, j.titulo || '', eventoNome(j.evento_id),
        j.inicio || '', j.fim || '', r ? Math.round((r.end - r.start) / 60000) : '', j.obs || '',
      ]
    }),
  )
}

export function exportChegadasCSV(chegadas: Chegada[], fornNome: (id: string | null) => string, eventoNome: (id: string | null) => string): void {
  baixarCSV('logistica-chegadas',
    ['Item', 'Fornecedor', 'Evento', 'Previsto', 'Duração (min)', 'Doca', 'Veículo', 'Placa', 'Responsável', 'Contato', 'Status', 'Credencial'],
    chegadas.map((c) => [
      c.item, fornNome(c.fornecedor_id), eventoNome(c.evento_id), c.previsto || '', c.duracao_min,
      c.doca || '', c.veiculo || '', c.placa || '', c.responsavel || '', c.contato || '',
      chegadaStatusMeta(c.status).label, credencialVeiculo(c),
    ]),
  )
}

export function exportFrotaCSV(veiculos: Veiculo[]): void {
  baixarCSV('frota',
    ['Nome', 'Tipo', 'Placa', 'Capacidade', 'Unidade', 'Motorista', 'Contato', 'Status'],
    veiculos.map((v) => [
      v.nome, v.tipo, v.placa || '', v.capacidade ?? '', v.capacidade_unidade,
      v.motorista || '', v.motorista_contato || '', frotaStatusMeta(v.status).label,
    ]),
  )
}

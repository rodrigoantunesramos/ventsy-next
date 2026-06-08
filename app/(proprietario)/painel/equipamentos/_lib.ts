// _lib — tipos e helpers só do módulo Equipamentos (/painel/equipamentos).
// A lógica de domínio (disponibilidade, status, categorias) vive em
// lib/equipamentos.ts (pura e testada) — aqui ficam apenas os tipos de
// vínculo (evento/fornecedor) e utilitários de UI sem formatação de moeda.
// Regra de ouro: NADA de "R$"/percentual/data formatada aqui — só números/
// datas cruas; toda a formatação fica em lib/format, chamada na página.

import { CATEGORIAS_EQUIP, catEquipLabel, type Equipamento, type Disponibilidade } from '@/lib/equipamentos'

// Evento (clientes_eventos) — subconjunto para vincular alocações / romaneio.
export type EventoLite = {
  id: string
  nome_evento: string | null
  quem_contratou: string | null
  tipo_evento: string | null
  status: string | null
  data_inicio: string | null
  data_fim: string | null
  valor_total_num: number | null
  propriedade_id: number | null
}
export function eventoLabel(e: EventoLite | null | undefined): string {
  if (!e) return '—'
  return e.nome_evento || e.quem_contratou || e.tipo_evento || 'Evento sem nome'
}

// Fornecedor (subconjunto) — para o select de "sublocado de quem".
export type FornecedorLite = { id: string; nome: string; fantasia: string | null; categoria?: string | null }
export function fornecedorLabel(f: FornecedorLite | null | undefined): string {
  if (!f) return '—'
  return f.fantasia || f.nome
}

// Iniciais para o avatar do item (mesma estética dos demais módulos).
export function iniciais(nome: string): string {
  const partes = (nome || '?').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '?'
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}

// Linha do inventário: item + disponibilidade calculada no período de referência.
export type LinhaInventario = {
  e: Equipamento
  disp: Disponibilidade        // total / pico alocado / disponível no período
  reservadas: number           // unidades ocupando AGORA (fora)
  receita: number              // receita de locação acumulada (período carregado)
  custo: number                // custo de sublocação acumulado
}

// Exporta o inventário para CSV (sem moeda formatada — números crus, vírgula BR-safe).
export function exportEquipamentosCSV(linhas: LinhaInventario[]): void {
  const header = ['Item', 'Categoria', 'Próprio/Sublocado', 'Unidade', 'Total', 'Alocado (pico)', 'Disponível', 'Custo locação/un', 'Preço locação/un', 'Ativo']
  const esc = (s: string) => `"${(s || '').replace(/"/g, '""')}"`
  const body = linhas.map(({ e, disp }) => [
    esc(e.nome), esc(catEquipLabel(e.categoria)), e.proprio ? 'próprio' : 'sublocado',
    esc(e.unidade || 'un'), disp.total, disp.alocadoPico, disp.disponivel,
    Number(e.custo_locacao_num) || 0, Number(e.preco_locacao_num) || 0, e.ativo ? 'sim' : 'não',
  ].join(',')).join('\n')
  const blob = new Blob(['﻿' + header.join(',') + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `equipamentos-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

// Categorias re-exportadas por conveniência da página.
export { CATEGORIAS_EQUIP }

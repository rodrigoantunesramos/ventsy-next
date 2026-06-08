// Engine pura e compartilhada de Contratos (lib/contracts.ts).
// Sem React, sem Supabase, sem segredos — importável pela página do painel, pelas
// rotas de API (server) e pela página pública de assinatura. Centraliza:
//   • Tipos das entidades (template, contrato, assinatura).
//   • Catálogo de VARIÁVEIS ({{cliente.nome}}, {{evento.data}}, {{valor}}…) e o
//     renderizador de template (substitui tokens → texto final/snapshot).
//   • Biblioteca de CLÁUSULAS prontas (multa, caução, cancelamento, força maior,
//     uso de imagem/LGPD, regras da casa).
//   • Metadados de status/papel e helpers de numeração e hash de auditoria.
// Moeda/idioma sempre via lib/format — nunca "R$" hardcoded.

import { formatMoney, formatDate, type Currency } from '@/lib/format'

// ── Tipos ─────────────────────────────────────────────────────────────────────
export type ContratoStatus = 'rascunho' | 'enviado' | 'assinado' | 'cancelado' | 'rescindido'
export type Papel = 'contratante' | 'contratada' | 'testemunha'
export type MetodoAssinatura = 'clique' | 'desenho' | 'token_email'

export type Clausula = { chave: string; titulo: string; texto: string; padrao?: boolean }

export type ContratoTemplate = {
  id: string
  usuario_id: string
  nome: string
  tipo_evento: string | null
  corpo: string
  clausulas: Clausula[]
  ativo: boolean
  criado_em?: string
  atualizado_em?: string
}

export type Contrato = {
  id: string
  usuario_id: string
  cliente_id: string | null
  evento_id: string | null
  proposta_id: string | null
  template_id: string | null
  numero: string
  titulo: string | null
  conteudo_final: string
  variaveis: Record<string, string>
  valor_num: number
  moeda: Currency
  status: ContratoStatus
  vencimento: string | null
  link_token: string | null
  pdf_url: string | null
  enviado_em: string | null
  assinado_em: string | null
  cancelado_em: string | null
  rescindido_em: string | null
  multa_num: number | null
  motivo: string | null
  observacoes: string | null
  criado_em?: string
  atualizado_em?: string
}

export type Assinatura = {
  id: string
  contrato_id: string
  usuario_id: string
  signatario_nome: string
  signatario_doc: string | null
  email: string | null
  papel: Papel
  ordem: number
  obrigatorio: boolean
  assinou_em: string | null
  ip: string | null
  user_agent: string | null
  hash: string | null
  metodo: MetodoAssinatura | null
  assinatura_img: string | null
  criado_em?: string
}

// ── Status & papéis (rótulos + tons do design system) ─────────────────────────
export const STATUS_META: Record<ContratoStatus, { label: string; tone: string; dot: string }> = {
  rascunho:   { label: 'Rascunho',    tone: 'bg-black/[0.05] text-ink-muted', dot: 'bg-ink-muted' },
  enviado:    { label: 'Aguardando',  tone: 'bg-amber-50 text-amber-700',     dot: 'bg-amber-500' },
  assinado:   { label: 'Assinado',    tone: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  cancelado:  { label: 'Cancelado',   tone: 'bg-black/[0.05] text-ink-muted', dot: 'bg-ink-muted' },
  rescindido: { label: 'Rescindido',  tone: 'bg-red-50 text-red-700',         dot: 'bg-red-500' },
}

export const PAPEL_META: Record<Papel, { label: string; hint: string }> = {
  contratante: { label: 'Contratante', hint: 'Cliente que contrata o espaço/serviço.' },
  contratada:  { label: 'Contratada',  hint: 'Você / a empresa que presta o serviço.' },
  testemunha:  { label: 'Testemunha',  hint: 'Terceiro que testemunha a assinatura.' },
}

export const TIPOS_EVENTO = ['Casamento', 'Aniversário', 'Formatura', 'Corporativo', 'Confraternização', 'Debutante', 'Show', 'Feira', 'Outro']

// ── Catálogo de variáveis ─────────────────────────────────────────────────────
// `token` é o que se digita no corpo entre {{ }}. `grupo` só organiza a paleta.
export type VarDef = { token: string; label: string; grupo: string }
export const VAR_DEFS: VarDef[] = [
  { token: 'contrato.numero',      label: 'Número do contrato', grupo: 'Contrato' },
  { token: 'contrato.data',        label: 'Data de emissão',    grupo: 'Contrato' },
  { token: 'contrato.vencimento',  label: 'Vencimento',         grupo: 'Contrato' },
  { token: 'cliente.nome',         label: 'Nome do cliente',    grupo: 'Contratante' },
  { token: 'cliente.doc',          label: 'CPF/CNPJ do cliente', grupo: 'Contratante' },
  { token: 'cliente.email',        label: 'E-mail do cliente',  grupo: 'Contratante' },
  { token: 'cliente.telefone',     label: 'Telefone do cliente', grupo: 'Contratante' },
  { token: 'cliente.endereco',     label: 'Endereço do cliente', grupo: 'Contratante' },
  { token: 'contratada.razao',     label: 'Razão social',       grupo: 'Contratada' },
  { token: 'contratada.cnpj',      label: 'CNPJ',               grupo: 'Contratada' },
  { token: 'contratada.endereco',  label: 'Endereço',           grupo: 'Contratada' },
  { token: 'contratada.email',     label: 'E-mail',             grupo: 'Contratada' },
  { token: 'contratada.telefone',  label: 'Telefone',           grupo: 'Contratada' },
  { token: 'contratada.responsavel', label: 'Responsável',      grupo: 'Contratada' },
  { token: 'evento.tipo',          label: 'Tipo de evento',     grupo: 'Evento' },
  { token: 'evento.nome',          label: 'Nome do evento',     grupo: 'Evento' },
  { token: 'evento.data',          label: 'Data do evento',     grupo: 'Evento' },
  { token: 'evento.periodo',       label: 'Período',            grupo: 'Evento' },
  { token: 'evento.horario',       label: 'Horário',            grupo: 'Evento' },
  { token: 'evento.convidados',    label: 'Nº de convidados',   grupo: 'Evento' },
  { token: 'espaco.nome',          label: 'Nome do espaço',     grupo: 'Espaço' },
  { token: 'espaco.endereco',      label: 'Endereço do espaço', grupo: 'Espaço' },
  { token: 'valor',                label: 'Valor total',        grupo: 'Financeiro' },
  { token: 'pagamento.forma',      label: 'Forma de pagamento', grupo: 'Financeiro' },
  { token: 'pagamento.condicoes',  label: 'Condições de pagamento', grupo: 'Financeiro' },
]

/** Marca de preenchimento manual quando uma variável não tem valor resolvido. */
export const BLANK = '____________'

/** Substitui {{token}} pelos valores do contexto. Token sem valor vira BLANK. */
export function renderTemplate(corpo: string, ctx: Record<string, string>): string {
  return (corpo || '').replace(/{{\s*([\w.]+)\s*}}/g, (_m, key: string) => {
    const v = ctx[key]
    return v != null && String(v).trim() !== '' ? String(v) : BLANK
  })
}

/** Lista os tokens usados num corpo (para preview/validação no editor). */
export function tokensUsados(corpo: string): string[] {
  const out = new Set<string>()
  for (const m of (corpo || '').matchAll(/{{\s*([\w.]+)\s*}}/g)) out.add(m[1])
  return [...out]
}

// ── Montagem do contexto de variáveis ─────────────────────────────────────────
// Recebe linhas cruas (cliente_evento, cliente, empresa_config, propriedade) e o
// meta do contrato; devolve o mapa token→texto pronto para renderizar. Moeda via
// lib/format (i18n). Datas via formatDate. Nada de "R$" cru.
export type ContextoInput = {
  numero?: string
  emissao?: string | Date | null
  vencimento?: string | null
  valor?: number | null
  moeda?: Currency
  evento?: {
    nome_evento?: string | null; tipo_evento?: string | null
    data_inicio?: string | null; data_fim?: string | null
    horario_inicio?: string | null; horario_fim?: string | null
    qtd_adultos?: number | null; qtd_criancas?: number | null
    quem_contratou?: string | null; documento?: string | null; email?: string | null
    telefones?: string[] | null; forma_pagamento?: string | null
  } | null
  cliente?: {
    nome?: string | null; doc?: string | null; email?: string | null
    telefone?: string | null; whatsapp?: string | null
    endereco?: string | null; cidade?: string | null; estado?: string | null
  } | null
  empresa?: {
    razao_social?: string | null; fantasia?: string | null; cnpj?: string | null
    endereco?: { rua?: string; numero?: string; bairro?: string; cidade?: string; estado?: string; cep?: string } | null
    contatos?: { email?: string; telefone?: string; whatsapp?: string } | null
    responsavel?: string | null
  } | null
  espaco?: {
    nome?: string | null; rua?: string | null; numero?: string | null
    bairro?: string | null; cidade?: string | null; estado?: string | null
  } | null
  pagamento?: { forma?: string | null; condicoes?: string | null }
}

function joinEndereco(parts: Array<string | null | undefined>): string {
  return parts.map((p) => (p ?? '').toString().trim()).filter(Boolean).join(', ')
}

export function buildContext(i: ContextoInput): Record<string, string> {
  const moeda = i.moeda ?? 'BRL'
  const ev = i.evento ?? {}
  const cli = i.cliente ?? {}
  const emp = i.empresa ?? {}
  const esp = i.espaco ?? {}
  const convidados = (Number(ev.qtd_adultos) || 0) + (Number(ev.qtd_criancas) || 0)
  const periodo = ev.data_inicio
    ? formatDate(ev.data_inicio) + (ev.data_fim && ev.data_fim !== ev.data_inicio ? ' a ' + formatDate(ev.data_fim) : '')
    : ''
  const horario = ev.horario_inicio || ev.horario_fim ? `${ev.horario_inicio || '—'} às ${ev.horario_fim || '—'}` : ''

  const clienteNome = cli.nome || ev.quem_contratou || ''
  const clienteDoc = cli.doc || ev.documento || ''
  const clienteEmail = cli.email || ev.email || ''
  const clienteTel = cli.telefone || cli.whatsapp || (ev.telefones && ev.telefones[0]) || ''
  const clienteEnd = cli.endereco || joinEndereco([cli.cidade, cli.estado])

  const empEnd = emp.endereco || {}
  const empContatos = emp.contatos || {}

  const ctx: Record<string, string> = {
    'contrato.numero':       i.numero || '',
    'contrato.data':         i.emissao ? formatDate(i.emissao) : formatDate(new Date()),
    'contrato.vencimento':   i.vencimento ? formatDate(i.vencimento) : '',
    'cliente.nome':          clienteNome,
    'cliente.doc':           clienteDoc,
    'cliente.email':         clienteEmail,
    'cliente.telefone':      clienteTel,
    'cliente.endereco':      clienteEnd,
    'contratada.razao':      emp.razao_social || emp.fantasia || '',
    'contratada.cnpj':       emp.cnpj || '',
    'contratada.endereco':   joinEndereco([empEnd.rua && `${empEnd.rua}${empEnd.numero ? ', ' + empEnd.numero : ''}`, empEnd.bairro, empEnd.cidade, empEnd.estado, empEnd.cep]),
    'contratada.email':      empContatos.email || '',
    'contratada.telefone':   empContatos.telefone || empContatos.whatsapp || '',
    'contratada.responsavel': emp.responsavel || '',
    'evento.tipo':           ev.tipo_evento || '',
    'evento.nome':           ev.nome_evento || '',
    'evento.data':           ev.data_inicio ? formatDate(ev.data_inicio) : '',
    'evento.periodo':        periodo,
    'evento.horario':        horario,
    'evento.convidados':     convidados ? String(convidados) : '',
    'espaco.nome':           esp.nome || '',
    'espaco.endereco':       joinEndereco([esp.rua && `${esp.rua}${esp.numero ? ', ' + esp.numero : ''}`, esp.bairro, esp.cidade, esp.estado]),
    'valor':                 i.valor != null ? formatMoney(i.valor, { currency: moeda }) : '',
    'pagamento.forma':       i.pagamento?.forma || ev.forma_pagamento || '',
    'pagamento.condicoes':   i.pagamento?.condicoes || '',
  }
  return ctx
}

/** Junta corpo do template + cláusulas selecionadas num único texto (pré-render). */
export function montarCorpo(corpo: string, clausulas: Clausula[]): string {
  const blocos = clausulas.map((c, idx) => `## ${idx + 1}. ${c.titulo}\n${c.texto}`)
  return [corpo.trim(), ...blocos].filter(Boolean).join('\n\n')
}

// ── Biblioteca de cláusulas prontas (editáveis) ───────────────────────────────
export const CLAUSULAS_PRESET: Clausula[] = [
  {
    chave: 'objeto', titulo: 'Objeto', padrao: true,
    texto: 'O presente contrato tem por objeto a locação do espaço {{espaco.nome}}, situado em {{espaco.endereco}}, para a realização do evento "{{evento.nome}}" ({{evento.tipo}}), no período de {{evento.periodo}}, no horário de {{evento.horario}}, para até {{evento.convidados}} convidados.',
  },
  {
    chave: 'valor', titulo: 'Valor e forma de pagamento', padrao: true,
    texto: 'Pela locação ora contratada, a CONTRATANTE pagará à CONTRATADA o valor total de {{valor}}, na forma de {{pagamento.forma}}. Condições: {{pagamento.condicoes}}.',
  },
  {
    chave: 'caucao', titulo: 'Caução',
    texto: 'A CONTRATANTE depositará caução em garantia, restituível em até 7 (sete) dias após o evento, descontados eventuais danos ao espaço ou itens, apurados em vistoria conjunta.',
  },
  {
    chave: 'cancelamento', titulo: 'Cancelamento', padrao: true,
    texto: 'Em caso de cancelamento pela CONTRATANTE, serão retidos: 30% do valor se com mais de 90 dias de antecedência; 50% entre 90 e 30 dias; e 100% com menos de 30 dias da data do evento.',
  },
  {
    chave: 'multa', titulo: 'Multa por inadimplemento',
    texto: 'O descumprimento de qualquer cláusula sujeita a parte infratora ao pagamento de multa equivalente a 20% (vinte por cento) sobre o valor total do contrato, sem prejuízo das perdas e danos.',
  },
  {
    chave: 'forca_maior', titulo: 'Força maior',
    texto: 'Nenhuma das partes será responsabilizada por falhas decorrentes de caso fortuito ou força maior (desastres naturais, determinações de autoridades, pandemias). Nessas hipóteses, as partes negociarão de boa-fé o reagendamento do evento.',
  },
  {
    chave: 'imagem_lgpd', titulo: 'Uso de imagem e LGPD',
    texto: 'A CONTRATANTE autoriza o uso de imagens do evento para portfólio e divulgação da CONTRATADA, salvo manifestação contrária por escrito. As partes tratarão os dados pessoais conforme a Lei nº 13.709/2018 (LGPD), apenas para a execução deste contrato.',
  },
  {
    chave: 'regras_casa', titulo: 'Regras da casa',
    texto: 'A CONTRATANTE e seus convidados obrigam-se a respeitar as regras de uso do espaço: horários de som, limite de capacidade, proibição de pregos/fitas nas paredes, e responsabilidade por terceiros (fornecedores) por ela contratados.',
  },
  {
    chave: 'foro', titulo: 'Foro', padrao: true,
    texto: 'Fica eleito o foro da comarca de {{espaco.endereco}} para dirimir quaisquer dúvidas oriundas deste contrato, com renúncia a qualquer outro, por mais privilegiado que seja.',
  },
]

/** Corpo de template padrão (locação de espaço) — base editável pelo dono. */
export function templatePadrao(tipo?: string): { nome: string; corpo: string; clausulas: Clausula[] } {
  const corpo = [
    '# CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTOS',
    'Contrato nº {{contrato.numero}} — {{contrato.data}}',
    '',
    '**CONTRATANTE:** {{cliente.nome}}, inscrito(a) sob o documento {{cliente.doc}}, e-mail {{cliente.email}}, telefone {{cliente.telefone}}, residente em {{cliente.endereco}}.',
    '',
    '**CONTRATADA:** {{contratada.razao}}, CNPJ {{contratada.cnpj}}, com sede em {{contratada.endereco}}, neste ato representada por {{contratada.responsavel}}.',
    '',
    'As partes acima identificadas têm, entre si, justo e contratado o presente instrumento, que se regerá pelas cláusulas seguintes.',
  ].join('\n')
  const clausulas = CLAUSULAS_PRESET.filter((c) => c.padrao).map((c) => ({ ...c }))
  return { nome: tipo ? `Locação — ${tipo}` : 'Locação de espaço', corpo, clausulas }
}

// ── Numeração ─────────────────────────────────────────────────────────────────
/** Próximo número sequencial CTR-AAAA-NNNN a partir dos números já existentes. */
export function proximoNumero(existentes: string[], ano = new Date().getFullYear()): string {
  const prefixo = `CTR-${ano}-`
  let max = 0
  for (const n of existentes) {
    if (n?.startsWith(prefixo)) {
      const seq = parseInt(n.slice(prefixo.length), 10)
      if (Number.isFinite(seq) && seq > max) max = seq
    }
  }
  return `${prefixo}${String(max + 1).padStart(4, '0')}`
}

// ── Hash de auditoria ─────────────────────────────────────────────────────────
/** String canônica que será "selada" pelo hash da assinatura. */
export function canonicalAssinatura(p: {
  contratoId: string; conteudo: string; nome: string; doc?: string | null; quando: string; ip?: string | null
}): string {
  return [p.contratoId, p.nome, p.doc || '', p.quando, p.ip || '', p.conteudo].join('\n')
}

/** SHA-256 hex isomórfico (Web Crypto). Use no server ao registrar a assinatura. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Progresso de assinaturas ──────────────────────────────────────────────────
export function progressoAssinaturas(assinaturas: Pick<Assinatura, 'assinou_em' | 'obrigatorio'>[]): { assinadas: number; total: number; obrigatoriasPendentes: number; completo: boolean } {
  const total = assinaturas.length
  const assinadas = assinaturas.filter((a) => a.assinou_em).length
  const obrigatoriasPendentes = assinaturas.filter((a) => a.obrigatorio && !a.assinou_em).length
  return { assinadas, total, obrigatoriasPendentes, completo: total > 0 && obrigatoriasPendentes === 0 }
}

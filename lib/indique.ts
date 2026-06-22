// Motor puro do "Indique & Ganhe" do cliente. Sem I/O. Monta o link de convite,
// consolida os KPIs da lista de indicações e gera as mensagens de compartilhamento.

export type IndicacaoStatus = 'pendente' | 'cadastrado' | 'convertido'

export type IndicacaoCliente = {
  id?: string
  indicado_nome?: string | null
  indicado_email?: string | null
  status?: IndicacaoStatus | string | null
  recompensa_creditos?: number | null
  recompensa_paga?: boolean | null
  criado_em?: string | null
  convertido_em?: string | null
}

export const STATUS_INDICACAO_LABEL: Record<IndicacaoStatus, string> = {
  pendente: 'Convite enviado',
  cadastrado: 'Cadastrou-se',
  convertido: 'Recompensa liberada',
}

export function statusIndicacaoLabel(status?: string | null): string {
  return STATUS_INDICACAO_LABEL[(status as IndicacaoStatus)] ?? 'Convite enviado'
}

/** Link de convite do cliente: leva o amigo ao cadastro já com o código. */
export function linkIndicacao(origin: string, codigo: string): string {
  const base = (origin || 'https://www.ventsy.com.br').replace(/\/+$/, '')
  return `${base}/cadastro?ref=${encodeURIComponent(codigo || '')}`
}

export type KpisIndicacao = {
  indicados: number      // total de convidados
  cadastrados: number    // já criaram conta (cadastrado ou convertido)
  convertidos: number    // viraram contratantes (recompensa liberada)
  creditosGanhos: number // soma dos créditos das indicações convertidas/pagas
}

export function kpisIndicacoes(lista: IndicacaoCliente[]): KpisIndicacao {
  let cadastrados = 0
  let convertidos = 0
  let creditosGanhos = 0
  for (const i of lista) {
    const s = String(i.status ?? 'pendente')
    if (s === 'cadastrado' || s === 'convertido') cadastrados++
    if (s === 'convertido') {
      convertidos++
      if (i.recompensa_paga) creditosGanhos += Number(i.recompensa_creditos) || 0
    }
  }
  return { indicados: lista.length, cadastrados, convertidos, creditosGanhos }
}

/** Mensagem padrão de convite (WhatsApp/e-mail). `recompensa` é texto livre. */
export function mensagemConvite(link: string, recompensa = 'um desconto na primeira reserva'): string {
  return (
    `Encontrei a Ventsy pra organizar eventos — dá pra achar e reservar espaços incríveis num lugar só. ` +
    `Use meu convite e ganhe ${recompensa}: ${link}`
  )
}

export function assuntoConvite(): string {
  return 'Seu convite para a Ventsy 🎉'
}

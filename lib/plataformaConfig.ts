// Catálogo de configurações globais da plataforma — LÓGICA PURA (client-safe).
// Cada entrada define uma flag/texto/parâmetro editável pelo admin. Os valores
// ficam em public.plataforma_config; aqui ficam os metadados + defaults.

export type ConfigTipo = 'flag' | 'texto' | 'numero'

export type ConfigDef = {
  chave: string
  label: string
  desc?: string
  tipo: ConfigTipo
  padrao: boolean | string | number
  grupo: string
}

export const PLATAFORMA_CONFIG: ConfigDef[] = [
  // Funcionalidades (flags)
  {
    chave: 'modo_manutencao',
    label: 'Modo manutenção',
    desc: 'Exibe aviso e sinaliza o site como em manutenção.',
    tipo: 'flag',
    padrao: false,
    grupo: 'Funcionalidades',
  },
  {
    chave: 'fila_aprovacao_anuncios',
    label: 'Fila de aprovação de anúncios',
    desc: 'Novos espaços entram em revisão antes de ir ao ar.',
    tipo: 'flag',
    padrao: true,
    grupo: 'Funcionalidades',
  },
  {
    chave: 'novos_cadastros',
    label: 'Permitir novos cadastros',
    desc: 'Quando desligado, novos cadastros ficam bloqueados.',
    tipo: 'flag',
    padrao: true,
    grupo: 'Funcionalidades',
  },
  // Institucional (textos/parâmetros)
  {
    chave: 'site_url',
    label: 'URL do site',
    tipo: 'texto',
    padrao: 'https://www.ventsy.com.br',
    grupo: 'Institucional',
  },
  {
    chave: 'email_suporte',
    label: 'E-mail de suporte',
    tipo: 'texto',
    padrao: 'suporte@ventsy.com.br',
    grupo: 'Institucional',
  },
  {
    chave: 'whatsapp_suporte',
    label: 'WhatsApp de suporte',
    desc: 'Apenas números (DDI + DDD + número).',
    tipo: 'texto',
    padrao: '5521999992120',
    grupo: 'Institucional',
  },
  {
    chave: 'mensagem_topo',
    label: 'Aviso no topo do site',
    desc: 'Banner exibido no topo (vazio = sem banner).',
    tipo: 'texto',
    padrao: '',
    grupo: 'Institucional',
  },
  // Comissão da Ventsy — incide SÓ em eventos fechados pela plataforma (checkout
  // de reserva paga via Ventsy). Contato direto/WhatsApp não passa por aqui.
  {
    chave: 'comissao_anfitriao_unica_pct',
    label: 'Taxa do anfitrião — modelo único (%)',
    desc: 'Descontada do anfitrião quando o hóspede paga só o aluguel. Padrão 15.',
    tipo: 'numero',
    padrao: 15,
    grupo: 'Comissão (eventos via Ventsy)',
  },
  {
    chave: 'comissao_anfitriao_split_pct',
    label: 'Taxa do anfitrião — modelo dividido (%)',
    desc: 'Percentual do anfitrião no modelo dividido. Padrão 3.',
    tipo: 'numero',
    padrao: 3,
    grupo: 'Comissão (eventos via Ventsy)',
  },
  {
    chave: 'comissao_hospede_split_pct',
    label: 'Taxa do hóspede — modelo dividido (%)',
    desc: 'Percentual somado ao hóspede no modelo dividido. Padrão 12.',
    tipo: 'numero',
    padrao: 12,
    grupo: 'Comissão (eventos via Ventsy)',
  },
]

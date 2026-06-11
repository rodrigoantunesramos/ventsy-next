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
]

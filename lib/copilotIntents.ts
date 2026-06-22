// Motor PURO do Ventsy Copilot — camada DETERMINÍSTICA de intenções.
// ─────────────────────────────────────────────────────────────────────────────
// Responde as perguntas mais comuns do dono direto do PANORAMA (dados reais já
// carregados), SEM chamar o LLM: instantâneo, grátis e funciona mesmo sem chave
// de IA. O servidor tenta isto primeiro; só cai no modelo (generateText) no que
// não casar. Espelha as regras das demais engines: SEM React, SEM Supabase, SEM
// "R$"/Intl — a formatação de moeda é INJETADA (fmt.money) por quem chama.

export type IntentKey =
  | 'resumo' | 'faturamento' | 'pendencias' | 'agenda'
  | 'contratos' | 'clientes' | 'reservas' | 'avaliacao'
  | 'ticket' | 'conversao' | 'evento_top' | 'inadimplencia' | 'tipos';

export type PanoramaEvento = { titulo: string; tipo: string; data: string; valor: number; status: string };
export type PanoramaPendencia = { titulo: string; sub: string; urgencia: string; valor: number | null; tipo: string };

export type Panorama = {
  hoje: string;
  contratado: number; recebido: number; aberto: number; aVencer30: number;
  eventosTotal: number; eventosGanhos: number;
  contratosPendentes: number; parcelasAtrasadas: number; licencasVencendo: number;
  clientes: number; reservasFuturas: number; avaliacao: number | null;
  ticketMedio: number; taxaConversao: number; inadimplenciaValor: number; inadimplenciaQtd: number;
  eventoMaisValioso: PanoramaEvento | null;
  tiposEvento: { tipo: string; n: number }[];
  proximosEventos: PanoramaEvento[];
  pendencias: PanoramaPendencia[];
};

export type Chip = { label: string; href: string };
export type IntentResposta = { texto: string; chips: Chip[]; sugestoes: string[] };
export type Fmt = { money: (n: number) => string };

export const SUGESTOES_INICIAIS = [
  'Como está meu mês?',
  'O que precisa da minha atenção hoje?',
  'Quais são meus próximos eventos?',
  'Quem está com contrato pendente?',
];

const CHIP = {
  financeiro: { label: 'Abrir Financeiro', href: '/painel/financeiro' },
  recebiveis: { label: 'Contas a receber', href: '/painel/recebiveis' },
  painel: { label: 'Ver no painel', href: '/painel' },
  calendario: { label: 'Abrir Calendário', href: '/painel/calendario' },
  reservas: { label: 'Abrir Reservas', href: '/painel/reservas' },
  contratos: { label: 'Abrir Contratos', href: '/painel/contratos' },
  clientes: { label: 'Abrir Clientes', href: '/painel/clientes' },
  leads: { label: 'Ver Leads', href: '/painel/leads' },
  avaliacoes: { label: 'Abrir Avaliações', href: '/painel/avaliacoes' },
  licencas: { label: 'Abrir Licenças', href: '/painel/licencas' },
} as const;

const norm = (s: string) => (s || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Ordem importa: regras mais específicas antes das genéricas ('resumo' por último).
const REGRAS: { key: IntentKey; re: RegExp }[] = [
  { key: 'inadimplencia', re: /inadimpl|quanto me devem|quanto .*(devem|atras)|valor .*atras|total .*atras|em atraso/ },
  { key: 'ticket', re: /ticket medio|valor medio|quanto vale .*(cada|um|por) evento|media por evento/ },
  { key: 'conversao', re: /conversao|taxa de fech|quantos .*(fecho|fechei|fecha)|funil|aproveitamento/ },
  { key: 'evento_top', re: /(evento|festa|casamento|contrato) mais (valioso|caro|alto|importante)|maior evento|maior contrato|top evento/ },
  { key: 'tipos', re: /tipo de evento|tipos de evento|que tipo|qual tipo|mais faco|distribui.*evento/ },
  { key: 'pendencias', re: /pendenc|atenca|atrasad|vencend|vencid|urgente|o que .*(precis|tenho que|devo).*(fazer|resolver)|o que falta|alerta/ },
  { key: 'agenda', re: /proximos? evento|agenda|calendario|que evento|eventos? (dessa|da|na|nesta|nesse) semana|quando .*(evento|festa|casamento)|o que .*tenho (essa|esta|na) semana|programad/ },
  { key: 'contratos', re: /contrato|assinatur|assinar|aguardando assin/ },
  { key: 'reservas', re: /reserva|ocupacao|agenda de espac|disponibilidade/ },
  { key: 'avaliacao', re: /avaliaca|avaliacoes|nota|nps|reputaca|estrela|review/ },
  { key: 'faturamento', re: /faturei|faturament|receita|recebi|quanto .*(entrou|ganhei|fatur|a receber|em aberto)|em aberto|a receber|financeir|caixa|fluxo de caixa/ },
  { key: 'clientes', re: /clientes?|leads?|base de contato|quantos? client/ },
  { key: 'resumo', re: /como (esta|estao|vao|anda|estamos|vai|ta|tao)|resumo|panorama|visao geral|meu mes|do mes|overview|como .*(neg[oó]cio|empresa)|bom dia|me da um|tudo bem/ },
];

/** Classifica a pergunta numa intenção conhecida (ou null = manda pro LLM). */
export function detectarIntent(pergunta: string): IntentKey | null {
  const q = norm(pergunta);
  if (!q.trim()) return null;
  for (const { key, re } of REGRAS) if (re.test(q)) return key;
  return null;
}

function listaEventos(evs: PanoramaEvento[], money: (n: number) => string, limite = 5): string {
  return evs.slice(0, limite).map((e) => `• ${e.data} — ${e.titulo}${e.tipo ? ` (${e.tipo})` : ''}${e.valor ? ` · ${money(e.valor)}` : ''}`).join('\n');
}
function listaPendencias(ps: PanoramaPendencia[], money: (n: number) => string, limite = 6): string {
  return ps.slice(0, limite).map((p) => `• ${p.titulo} — ${p.sub}${p.valor != null ? ` · ${money(p.valor)}` : ''}`).join('\n');
}

/** Resposta determinística para a intenção, a partir do panorama (sem LLM). */
export function responderLocal(intent: IntentKey, p: Panorama, fmt: Fmt): IntentResposta {
  const money = fmt.money;
  switch (intent) {
    case 'resumo':
      return {
        texto: [
          `Recebido até agora: ${money(p.recebido)}. Em aberto: ${money(p.aberto)} (${money(p.aVencer30)} vence nos próximos 30 dias).`,
          p.pendencias.length
            ? `Você tem ${p.pendencias.length} pendência(s) — a mais urgente: ${p.pendencias[0].titulo} (${p.pendencias[0].sub}).`
            : 'Nenhuma pendência para os próximos dias. 🎉',
          p.proximosEventos.length
            ? `Próximo evento: ${p.proximosEventos[0].titulo} em ${p.proximosEventos[0].data}.`
            : 'Nenhum evento futuro agendado.',
        ].join('\n'),
        chips: [CHIP.financeiro, CHIP.painel, CHIP.calendario],
        sugestoes: ['O que precisa da minha atenção?', 'Quais meus próximos eventos?'],
      };

    case 'faturamento':
      return {
        texto:
          `No total: ${money(p.contratado)} contratado, ${money(p.recebido)} já recebido e ${money(p.aberto)} em aberto. ` +
          `Nos próximos 30 dias vencem ${money(p.aVencer30)}` +
          (p.parcelasAtrasadas ? `, e há ${p.parcelasAtrasadas} parcela(s) em atraso.` : '.'),
        chips: [CHIP.financeiro, CHIP.recebiveis],
        sugestoes: ['O que precisa da minha atenção?', 'Quais meus próximos eventos?'],
      };

    case 'pendencias':
      return {
        texto: p.pendencias.length
          ? `Você tem ${p.pendencias.length} pendência(s) para os próximos dias:\n${listaPendencias(p.pendencias, money)}`
          : 'Tudo em dia — nenhuma pendência para os próximos dias. 🎉',
        chips: p.pendencias.length ? [CHIP.painel, CHIP.recebiveis] : [CHIP.painel],
        sugestoes: ['Como está meu mês?', 'Quem está com contrato pendente?'],
      };

    case 'agenda':
      return {
        texto: p.proximosEventos.length
          ? `Seus próximos eventos:\n${listaEventos(p.proximosEventos, money)}`
          : 'Você não tem eventos futuros agendados.',
        chips: [CHIP.calendario, CHIP.reservas],
        sugestoes: ['O que precisa da minha atenção?', 'Como está meu mês?'],
      };

    case 'contratos':
      return {
        texto: p.contratosPendentes
          ? `Há ${p.contratosPendentes} contrato(s) enviado(s) aguardando assinatura. Vale um lembrete aos clientes.`
          : 'Nenhum contrato pendente de assinatura. 👍',
        chips: [CHIP.contratos],
        sugestoes: ['O que precisa da minha atenção?', 'Como está meu mês?'],
      };

    case 'clientes':
      return {
        texto: `Você tem ${p.clientes} cliente(s) cadastrado(s) e ${p.eventosTotal} evento(s) no funil (${p.eventosGanhos} fechado(s)).`,
        chips: [CHIP.clientes, CHIP.leads],
        sugestoes: ['Como está meu mês?', 'Quais meus próximos eventos?'],
      };

    case 'reservas':
      return {
        texto: p.reservasFuturas
          ? `Você tem ${p.reservasFuturas} reserva(s) futura(s) confirmada(s).`
          : 'Nenhuma reserva futura confirmada no momento.',
        chips: [CHIP.reservas, CHIP.calendario],
        sugestoes: ['Quais meus próximos eventos?', 'O que precisa da minha atenção?'],
      };

    case 'avaliacao':
      return {
        texto: p.avaliacao != null
          ? `Sua avaliação média é ${p.avaliacao.toFixed(1)} de 5.`
          : 'Você ainda não tem avaliações registradas.',
        chips: [CHIP.avaliacoes],
        sugestoes: ['Como está meu mês?', 'O que precisa da minha atenção?'],
      };

    case 'ticket':
      return {
        texto: p.eventosGanhos
          ? `Seu ticket médio é ${money(p.ticketMedio)} — média de ${p.eventosGanhos} evento(s) fechado(s) (${money(p.contratado)} no total).`
          : 'Ainda não há eventos fechados para calcular o ticket médio.',
        chips: [CHIP.financeiro, CHIP.painel],
        sugestoes: ['Qual meu evento mais valioso?', 'Como está meu mês?'],
      };

    case 'conversao':
      return {
        texto: p.eventosTotal
          ? `Você fechou ${p.eventosGanhos} de ${p.eventosTotal} evento(s) no funil — taxa de conversão de ${p.taxaConversao}%.`
          : 'Ainda não há eventos no funil para calcular a conversão.',
        chips: [CHIP.clientes, CHIP.leads],
        sugestoes: ['Qual meu ticket médio?', 'Quais meus próximos eventos?'],
      };

    case 'evento_top':
      return {
        texto: p.eventoMaisValioso
          ? `Seu evento mais valioso é ${p.eventoMaisValioso.titulo} (${p.eventoMaisValioso.tipo || 'evento'}), ${money(p.eventoMaisValioso.valor)}${p.eventoMaisValioso.data ? ` em ${p.eventoMaisValioso.data}` : ''}.`
          : 'Ainda não há eventos com valor registrado.',
        chips: [CHIP.calendario, CHIP.financeiro],
        sugestoes: ['Qual meu ticket médio?', 'Quais meus próximos eventos?'],
      };

    case 'inadimplencia':
      return {
        texto: p.inadimplenciaQtd
          ? `Você tem ${money(p.inadimplenciaValor)} em atraso (${p.inadimplenciaQtd} parcela(s)). Vale acionar a cobrança.`
          : 'Nenhuma parcela em atraso no momento. 👍',
        chips: [CHIP.recebiveis, CHIP.financeiro],
        sugestoes: ['Como está meu mês?', 'O que precisa da minha atenção?'],
      };

    case 'tipos':
      return {
        texto: p.tiposEvento.length
          ? `Seus eventos por tipo: ${p.tiposEvento.slice(0, 5).map((t) => `${t.tipo} (${t.n})`).join(', ')}. O mais frequente é ${p.tiposEvento[0].tipo}.`
          : 'Ainda não há eventos para classificar por tipo.',
        chips: [CHIP.clientes, CHIP.calendario],
        sugestoes: ['Qual meu evento mais valioso?', 'Como está meu mês?'],
      };
  }
}

/** Serializa o panorama em texto factual para o system prompt do LLM (fallback). */
export function panoramaParaTexto(p: Panorama, fmt: Fmt): string {
  const money = fmt.money;
  return [
    `Total de eventos no funil: ${p.eventosTotal} (ganhos/fechados: ${p.eventosGanhos})`,
    `Clientes cadastrados: ${p.clientes}`,
    `Reservas futuras confirmadas: ${p.reservasFuturas}`,
    p.avaliacao != null ? `Avaliação média: ${p.avaliacao.toFixed(1)} de 5` : 'Sem avaliações registradas',
    `Financeiro — contratado (vida): ${money(p.contratado)} · recebido: ${money(p.recebido)} · em aberto: ${money(p.aberto)} · a vencer em 30 dias: ${money(p.aVencer30)}`,
    `Contratos aguardando assinatura: ${p.contratosPendentes} · Parcelas em atraso: ${p.parcelasAtrasadas} · Licenças a vencer (30 dias): ${p.licencasVencendo}`,
    `Ticket médio: ${money(p.ticketMedio)} · Conversão do funil: ${p.taxaConversao}% · Em atraso: ${money(p.inadimplenciaValor)} (${p.inadimplenciaQtd} parcela(s))`,
    p.eventoMaisValioso ? `Evento mais valioso: ${p.eventoMaisValioso.titulo} (${p.eventoMaisValioso.tipo || 'evento'}) — ${money(p.eventoMaisValioso.valor)}` : '',
    p.tiposEvento.length ? `Eventos por tipo: ${p.tiposEvento.slice(0, 5).map((t) => `${t.tipo} (${t.n})`).join(', ')}` : '',
    p.proximosEventos.length ? 'Próximos eventos:\n' + listaEventos(p.proximosEventos, money, 8) : 'Nenhum evento futuro agendado.',
    p.pendencias.length ? 'Pendências priorizadas:\n' + listaPendencias(p.pendencias, money, 12) : 'Sem pendências para os próximos dias.',
  ].join('\n');
}

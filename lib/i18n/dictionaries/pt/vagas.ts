// Namespace `vagas` — páginas públicas de carreiras (/vagas/[slug]): detalhe da
// vaga, formulário de candidatura e página de vaga não encontrada. FONTE DA
// VERDADE: en/vagas.ts e es/vagas.ts são tipados por `T` para garantir paridade.
// NÃO inclui dados do banco (título/descrição/requisitos da vaga vêm do DB).

const vagas = {
  // ── Metadata (generateMetadata) ──
  meta: {
    naoEncontrada: 'Vaga não encontrada',
    // Interpolação: `Vaga de ${titulo} na ${SITE_NAME}.` — os trechos abaixo
    // envolvem o título da vaga (vindo do DB).
    descFallbackA: 'Vaga de',
    descFallbackB: 'Candidate-se online.',
  },

  // ── Seções do detalhe da vaga ──
  secaoDescricao: 'Descrição',
  secaoRequisitos: 'Requisitos',
  secaoBeneficios: 'Benefícios',

  // ── Rótulos de tipo de contrato (badges) ──
  contrato: {
    clt: 'CLT',
    horista: 'Horista',
    mei: 'MEI/PJ',
    estagio: 'Estágio',
    freelancer: 'Freelancer',
  },

  // ── Bloco de candidatura ──
  candidateSe: 'Candidate-se',

  // ── Formulário de candidatura ──
  nomeLabel: 'Nome completo *',
  emailLabel: 'E-mail',
  telefoneLabel: 'Telefone',
  curriculoLabel: 'Link do currículo',
  mensagemLabel: 'Mensagem',
  mensagemPlaceholder: 'Conte por que você é um bom match para a vaga.',
  btnEnviar: 'Enviar candidatura',
  btnEnviando: 'Enviando…',

  // ── Mensagens / validação ──
  erroNome: 'Informe seu nome.',
  erroEnvioGenerico: 'Não foi possível enviar. Tente novamente.',
  erroRede: 'Falha de rede. Tente novamente.',

  // ── Sucesso ──
  sucessoTitulo: 'Candidatura enviada!',
  sucessoTexto: 'Obrigado pelo interesse. Entraremos em contato se houver um match.',

  // ── Página de vaga não encontrada ──
  naoEncontrada: {
    titulo: 'Vaga não encontrada',
    texto: 'Esta vaga pode ter sido encerrada ou o link está incorreto.',
    voltar: 'Voltar ao site',
  },
}

export type T = typeof vagas
export default vagas

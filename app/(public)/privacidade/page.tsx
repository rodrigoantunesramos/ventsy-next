import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Política de Privacidade — VENTSY',
  description: 'Como coletamos, usamos e protegemos suas informações na plataforma VENTSY.',
}

const sections = [
  { id: 's1',  num: '01', title: 'Quem somos' },
  { id: 's2',  num: '02', title: 'Quais dados coletamos' },
  { id: 's3',  num: '03', title: 'Como usamos seus dados' },
  { id: 's4',  num: '04', title: 'Compartilhamento de dados' },
  { id: 's5',  num: '05', title: 'Cookies e rastreamento' },
  { id: 's6',  num: '06', title: 'Segurança das informações' },
  { id: 's7',  num: '07', title: 'Seus direitos (LGPD)' },
  { id: 's8',  num: '08', title: 'Retenção de dados' },
  { id: 's9',  num: '09', title: 'Menores de idade' },
  { id: 's10', num: '10', title: 'Alterações nesta política' },
  { id: 's11', num: '11', title: 'Contato' },
]

export default function PrivacidadePage() {
  return (
    <>
      <Header />

      {/* ── HERO ── */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-tag">Documentos legais</span>
          <h1>Política de Privacidade</h1>
          <p>Como coletamos, usamos e protegemos suas informações.</p>
        </div>
      </section>

      {/* ── CONTEÚDO ── */}
      <div className="content-wrap">

        <div className="update-badge">
          📅 Última atualização: <span>Janeiro de 2026</span>
        </div>

        {/* ── ÍNDICE ── */}
        <div className="indice">
          <h2>Índice</h2>
          <ol>
            {sections.map(s => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </div>

        {/* ── 01 ── */}
        <div className="secao" id="s1">
          <span className="secao-num">01</span>
          <h2>Quem somos</h2>
          <p>A <strong>VENTSY</strong> é uma plataforma digital que conecta pessoas que buscam espaços para eventos com proprietários de locais disponíveis para locação. Operamos como marketplace e nos comprometemos com a transparência no tratamento de dados pessoais.</p>
          <p>Esta Política de Privacidade se aplica a todos os usuários da plataforma VENTSY, incluindo visitantes, locatários e proprietários cadastrados, nos termos da <strong>Lei Geral de Proteção de Dados (Lei nº 13.709/2018 — LGPD)</strong>.</p>
        </div>

        {/* ── 02 ── */}
        <div className="secao" id="s2">
          <span className="secao-num">02</span>
          <h2>Quais dados coletamos</h2>
          <p>Coletamos apenas os dados necessários para o funcionamento da plataforma:</p>
          <ul>
            <li><strong>Dados de cadastro:</strong> nome completo, CPF ou CNPJ, data de nascimento, endereço de e-mail e número de telefone.</li>
            <li><strong>Dados de uso:</strong> endereço IP, tipo de navegador, páginas visitadas, buscas realizadas e interações com a plataforma.</li>
            <li><strong>Dados de pagamento:</strong> informações de transação processadas por gateways parceiros. Não armazenamos dados completos de cartão de crédito.</li>
            <li><strong>Dados de propriedades:</strong> endereço, fotos, descrições e valores cadastrados por proprietários.</li>
            <li><strong>Comunicações:</strong> mensagens trocadas entre usuários dentro da plataforma.</li>
          </ul>
        </div>

        {/* ── 03 ── */}
        <div className="secao" id="s3">
          <span className="secao-num">03</span>
          <h2>Como usamos seus dados</h2>
          <p>Utilizamos suas informações para:</p>
          <ul>
            <li>Criar e gerenciar sua conta na plataforma.</li>
            <li>Processar reservas e facilitar o contato entre locatários e proprietários.</li>
            <li>Enviar confirmações, notificações de reserva e comunicados relevantes.</li>
            <li>Melhorar continuamente a experiência de busca e recomendação de espaços.</li>
            <li>Cumprir obrigações legais e prevenir fraudes.</li>
            <li>Enviar comunicações de marketing, apenas com seu consentimento.</li>
          </ul>
          <div className="destaque">
            Nunca vendemos seus dados pessoais a terceiros. Seus dados são usados exclusivamente para os fins descritos nesta política.
          </div>
        </div>

        {/* ── 04 ── */}
        <div className="secao" id="s4">
          <span className="secao-num">04</span>
          <h2>Compartilhamento de dados</h2>
          <p>Seus dados podem ser compartilhados nas seguintes situações:</p>
          <ul>
            <li><strong>Entre usuários da plataforma:</strong> nome e informações de contato são compartilhados entre locatário e proprietário ao confirmar uma reserva.</li>
            <li><strong>Parceiros de pagamento:</strong> processadores de pagamento (como Stripe ou MercadoPago) recebem os dados necessários para processar transações.</li>
            <li><strong>Parceiros de infraestrutura:</strong> serviços de nuvem, hospedagem e banco de dados que operam sob acordos de confidencialidade.</li>
            <li><strong>Autoridades legais:</strong> quando exigido por lei, ordem judicial ou autoridade competente.</li>
          </ul>
        </div>

        {/* ── 05 ── */}
        <div className="secao" id="s5">
          <span className="secao-num">05</span>
          <h2>Cookies e rastreamento</h2>
          <p>Utilizamos cookies e tecnologias similares para:</p>
          <ul>
            <li>Manter sua sessão ativa após o login.</li>
            <li>Lembrar suas preferências de busca.</li>
            <li>Analisar o desempenho das páginas e identificar melhorias.</li>
            <li>Exibir conteúdo relevante com base em seu histórico de navegação.</li>
          </ul>
          <p>Você pode configurar seu navegador para recusar cookies, porém algumas funcionalidades da plataforma podem ser afetadas.</p>
        </div>

        {/* ── 06 ── */}
        <div className="secao" id="s6">
          <span className="secao-num">06</span>
          <h2>Segurança das informações</h2>
          <p>Adotamos medidas técnicas e organizacionais para proteger seus dados contra acesso não autorizado, alteração, divulgação ou destruição, incluindo:</p>
          <ul>
            <li>Transmissão de dados via protocolo HTTPS com criptografia TLS.</li>
            <li>Armazenamento seguro de senhas com hash e salt.</li>
            <li>Controle de acesso baseado em funções (RBAC) para nossa equipe.</li>
            <li>Monitoramento contínuo de acessos e tentativas de invasão.</li>
          </ul>
          <p>Em caso de incidente de segurança que possa afetar seus dados, notificaremos você e a Autoridade Nacional de Proteção de Dados (ANPD) nos prazos previstos em lei.</p>
        </div>

        {/* ── 07 ── */}
        <div className="secao" id="s7">
          <span className="secao-num">07</span>
          <h2>Seus direitos (LGPD)</h2>
          <p>Nos termos da LGPD, você tem direito a:</p>
          <ul>
            <li><strong>Acesso:</strong> solicitar uma cópia dos seus dados pessoais que tratamos.</li>
            <li><strong>Correção:</strong> atualizar dados incompletos, inexatos ou desatualizados.</li>
            <li><strong>Exclusão:</strong> solicitar a exclusão dos seus dados, salvo quando houver obrigação legal de retenção.</li>
            <li><strong>Portabilidade:</strong> receber seus dados em formato estruturado para transferência a outro serviço.</li>
            <li><strong>Revogação do consentimento:</strong> retirar o consentimento para tratamentos baseados nessa base legal.</li>
            <li><strong>Oposição:</strong> opor-se ao tratamento realizado com base em legítimo interesse.</li>
          </ul>
          <p>Para exercer qualquer um desses direitos, entre em contato conosco pelo e-mail <strong><a href="mailto:privacidade@ventsy.com.br" style={{ color: 'var(--vermelho)' }}>privacidade@ventsy.com.br</a></strong>.</p>
        </div>

        {/* ── 08 ── */}
        <div className="secao" id="s8">
          <span className="secao-num">08</span>
          <h2>Retenção de dados</h2>
          <p>Mantemos seus dados pelo tempo necessário para cumprir as finalidades descritas nesta política ou conforme exigido por lei. Dados de transações financeiras são retidos por <strong>5 anos</strong>, conforme exigência fiscal.</p>
          <p>Após o encerramento da sua conta, seus dados serão anonimizados ou excluídos em até 90 dias, salvo obrigações legais que exijam retenção por prazo maior.</p>
        </div>

        {/* ── 09 ── */}
        <div className="secao" id="s9">
          <span className="secao-num">09</span>
          <h2>Menores de idade</h2>
          <p>A plataforma VENTSY é destinada a pessoas com <strong>18 anos ou mais</strong>. Não coletamos intencionalmente dados de menores de idade. Caso identifiquemos que um menor realizou cadastro sem autorização, excluiremos os dados imediatamente.</p>
        </div>

        {/* ── 10 ── */}
        <div className="secao" id="s10">
          <span className="secao-num">10</span>
          <h2>Alterações nesta política</h2>
          <p>Podemos atualizar esta Política de Privacidade periodicamente. Quando realizarmos alterações relevantes, notificaremos você por e-mail ou por aviso destacado na plataforma com pelo menos <strong>15 dias de antecedência</strong>.</p>
          <p>O uso continuado da plataforma após a entrada em vigor das alterações implica aceitação da nova política.</p>
        </div>

        {/* ── 11 ── */}
        <div className="secao" id="s11">
          <span className="secao-num">11</span>
          <h2>Contato</h2>
          <p>Para dúvidas, solicitações ou exercício dos seus direitos, entre em contato com nosso Encarregado de Dados (DPO):</p>
          <ul>
            <li><strong>E-mail:</strong> <a href="mailto:privacidade@ventsy.com.br" style={{ color: 'var(--vermelho)' }}>privacidade@ventsy.com.br</a></li>
            <li><strong>Atendimento:</strong> Segunda a sexta, das 9h às 18h</li>
            <li><strong>Prazo de resposta:</strong> até 15 dias úteis</li>
          </ul>
        </div>

        {/* ── CARD CONTATO ── */}
        <div className="contato-card">
          <h3>Ficou com alguma dúvida?</h3>
          <p>Nossa equipe está pronta para te ajudar com qualquer questão sobre privacidade.</p>
          <Link href="/fale-conosco" className="btn-contato">Fale conosco →</Link>
        </div>

      </div>

      <Footer />
    </>
  )
}

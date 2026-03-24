import Header from '@/components/Header'
import Footer from '@/components/Footer'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termos de Uso — VENTSY',
  description: 'Regras e condições para utilização da plataforma VENTSY.',
}

const sections = [
  { id: 't1', num: '01', title: 'Definições' },
  { id: 't2', num: '02', title: 'Aceitação dos termos' },
  { id: 't3', num: '03', title: 'Cadastro e conta' },
  { id: 't4', num: '04', title: 'Uso da plataforma' },
  { id: 't5', num: '05', title: 'Regras para proprietários' },
  { id: 't6', num: '06', title: 'Regras para locatários' },
  { id: 't7', num: '07', title: 'Pagamentos e tarifas' },
  { id: 't8', num: '08', title: 'Cancelamentos e reembolsos' },
  { id: 't9', num: '09', title: 'Avaliações e conteúdo' },
  { id: 't10', num: '10', title: 'Responsabilidades e limitações' },
  { id: 't11', num: '11', title: 'Propriedade intelectual' },
  { id: 't12', num: '12', title: 'Suspensão e encerramento' },
  { id: 't13', num: '13', title: 'Disposições gerais' },
]

export default function TermosPage() {
  return (
    <>
      <Header />

      {/* ── HERO ── */}
      <section className="page-hero">
        <div className="page-hero-inner">
          <span className="page-hero-tag">Documentos legais</span>
          <h1>Termos de Uso</h1>
          <p>Regras e condições para utilização da plataforma VENTSY.</p>
        </div>
      </section>

      {/* ── CONTEÚDO ── */}
      <div className="content-wrap">

        <div className="update-badge">
          📅 Última atualização: <span>Janeiro de 2026</span>
        </div>

        <div className="alerta">
          <span className="alerta-icon">⚠️</span>
          <span>Ao criar uma conta ou utilizar a plataforma VENTSY, você declara ter lido, compreendido e concordado com todos os termos abaixo. Caso não concorde, não utilize o serviço.</span>
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

        {/* ── SEÇÃO 1 ── */}
        <div className="secao" id="t1">
          <span className="secao-num">01</span>
          <h2>Definições</h2>
          <p>Para os fins destes Termos de Uso, considera-se:</p>
          <ul>
            <li><strong>VENTSY:</strong> plataforma digital marketplace de locação de espaços para eventos.</li>
            <li><strong>Usuário:</strong> qualquer pessoa física ou jurídica que acessa ou utiliza a plataforma.</li>
            <li><strong>Proprietário:</strong> usuário que cadastra e disponibiliza um espaço para locação.</li>
            <li><strong>Locatário:</strong> usuário que busca e reserva espaços através da plataforma.</li>
            <li><strong>Espaço:</strong> imóvel ou local disponibilizado pelo Proprietário para eventos.</li>
            <li><strong>Reserva:</strong> confirmação de uso de um Espaço em data e condições acordadas.</li>
          </ul>
        </div>

        {/* ── SEÇÃO 2 ── */}
        <div className="secao" id="t2">
          <span className="secao-num">02</span>
          <h2>Aceitação dos termos</h2>
          <p>
            Ao acessar, criar uma conta ou utilizar qualquer funcionalidade da VENTSY, o Usuário concorda com estes
            Termos de Uso e com a{' '}
            <Link href="/privacidade" className="text-[var(--vermelho)]">Política de Privacidade</Link>.
          </p>
          <p>Estes termos podem ser atualizados periodicamente. O uso continuado da plataforma após notificação de alterações implica aceitação das novas condições.</p>
        </div>

        {/* ── SEÇÃO 3 ── */}
        <div className="secao" id="t3">
          <span className="secao-num">03</span>
          <h2>Cadastro e conta</h2>
          <p>Para utilizar as funcionalidades completas da plataforma, é necessário criar uma conta. Ao se cadastrar, o Usuário declara que:</p>
          <ul>
            <li>É maior de 18 anos ou possui autorização legal de um responsável.</li>
            <li>Forneceu informações verdadeiras, precisas e atualizadas.</li>
            <li>É responsável por manter a confidencialidade de sua senha.</li>
            <li>Notificará imediatamente a VENTSY sobre qualquer uso não autorizado de sua conta.</li>
          </ul>
          <div className="destaque">
            A VENTSY reserva-se o direito de recusar ou cancelar cadastros que violem estes termos ou que apresentem informações falsas.
          </div>
        </div>

        {/* ── SEÇÃO 4 ── */}
        <div className="secao" id="t4">
          <span className="secao-num">04</span>
          <h2>Uso da plataforma</h2>
          <p>O Usuário compromete-se a utilizar a plataforma de forma lícita e ética. É expressamente proibido:</p>
          <ul>
            <li>Publicar conteúdo falso, enganoso, difamatório ou ilegal.</li>
            <li>Realizar transações financeiras fora da plataforma com o objetivo de burlar as tarifas.</li>
            <li>Utilizar a plataforma para fins de spam, fraude ou phishing.</li>
            <li>Tentar acessar áreas restritas ou sistemas da VENTSY sem autorização.</li>
            <li>Reproduzir, copiar ou distribuir conteúdo da plataforma sem permissão expressa.</li>
            <li>Interferir no funcionamento técnico da plataforma ou de seus servidores.</li>
          </ul>
        </div>

        {/* ── SEÇÃO 5 ── */}
        <div className="secao" id="t5">
          <span className="secao-num">05</span>
          <h2>Regras para proprietários</h2>
          <p>Ao cadastrar um espaço na VENTSY, o Proprietário declara e garante que:</p>
          <ul>
            <li>Possui autorização legal para disponibilizar o espaço para locação.</li>
            <li>As informações, fotos e descrições do espaço são verídicas e atualizadas.</li>
            <li>O espaço está em condições adequadas de uso, higiene e segurança.</li>
            <li>Possui todas as licenças e alvarás necessários para realização de eventos no local.</li>
            <li>Cumprirá as reservas confirmadas nos termos anunciados.</li>
            <li>Comunicará com antecedência mínima de 48h qualquer impossibilidade de cumprimento.</li>
          </ul>
          <p>A VENTSY não se responsabiliza por irregularidades legais dos espaços cadastrados, sendo a responsabilidade exclusiva do Proprietário.</p>
        </div>

        {/* ── SEÇÃO 6 ── */}
        <div className="secao" id="t6">
          <span className="secao-num">06</span>
          <h2>Regras para locatários</h2>
          <p>Ao realizar uma reserva, o Locatário compromete-se a:</p>
          <ul>
            <li>Utilizar o espaço exclusivamente para o evento declarado no momento da reserva.</li>
            <li>Respeitar a capacidade máxima de pessoas informada pelo Proprietário.</li>
            <li>Devolver o espaço nas mesmas condições em que o recebeu.</li>
            <li>Cumprir os horários acordados de entrada e saída.</li>
            <li>Responsabilizar-se por danos causados ao espaço durante o evento.</li>
            <li>Respeitar as normas de conduta, vizinhança e legislação local.</li>
          </ul>
        </div>

        {/* ── SEÇÃO 7 ── */}
        <div className="secao" id="t7">
          <span className="secao-num">07</span>
          <h2>Pagamentos e tarifas</h2>
          <p>Os pagamentos realizados através da plataforma são processados por parceiros certificados. A VENTSY cobra uma <strong>taxa de serviço</strong> sobre cada transação concluída, cujo valor é informado antes da confirmação da reserva.</p>
          <ul>
            <li>Os preços exibidos são de responsabilidade dos Proprietários e podem ser alterados a qualquer momento para novas reservas.</li>
            <li>Reservas já confirmadas têm o valor garantido conforme acordado.</li>
            <li>Taxas bancárias ou de câmbio eventualmente aplicadas são de responsabilidade do Usuário.</li>
          </ul>
          <p>Planos pagos de anúncio (Básico, Pro, Ultra) são cobrados mensalmente e renovados automaticamente salvo cancelamento pelo Proprietário com antecedência de 48h do vencimento.</p>
        </div>

        {/* ── SEÇÃO 8 ── */}
        <div className="secao" id="t8">
          <span className="secao-num">08</span>
          <h2>Cancelamentos e reembolsos</h2>
          <p>A política de cancelamento de cada espaço é definida pelo Proprietário e exibida na página do anúncio. Em regra geral:</p>
          <ul>
            <li><strong>Cancelamento pelo Locatário com mais de 30 dias de antecedência:</strong> reembolso integral.</li>
            <li><strong>Cancelamento entre 15 e 30 dias:</strong> reembolso de 50% do valor pago.</li>
            <li><strong>Cancelamento com menos de 15 dias:</strong> sem reembolso, salvo política específica do espaço.</li>
            <li><strong>Cancelamento pelo Proprietário:</strong> reembolso integral ao Locatário.</li>
          </ul>
          <div className="destaque">
            A taxa de serviço da VENTSY não é reembolsável em casos de cancelamento pelo Locatário.
          </div>
        </div>

        {/* ── SEÇÃO 9 ── */}
        <div className="secao" id="t9">
          <span className="secao-num">09</span>
          <h2>Avaliações e conteúdo</h2>
          <p>A VENTSY permite que Locatários publiquem avaliações sobre os espaços após a realização do evento. Ao publicar uma avaliação, o Usuário:</p>
          <ul>
            <li>Garante que o conteúdo é verdadeiro e baseado em experiência real.</li>
            <li>Concede à VENTSY licença não exclusiva para exibir o conteúdo na plataforma.</li>
            <li>Não publica conteúdo ofensivo, discriminatório ou que viole direitos de terceiros.</li>
          </ul>
          <p>A VENTSY reserva-se o direito de remover avaliações que violem estas diretrizes, sem necessidade de aviso prévio.</p>
          <p>Apenas avaliações <strong>verificadas</strong> (vinculadas a reservas reais concluídas) são exibidas publicamente nas páginas dos espaços.</p>
        </div>

        {/* ── SEÇÃO 10 ── */}
        <div className="secao" id="t10">
          <span className="secao-num">10</span>
          <h2>Responsabilidades e limitações</h2>
          <p>A VENTSY atua como intermediária entre Proprietários e Locatários, <strong>não sendo parte nos contratos de locação</strong>. Portanto:</p>
          <ul>
            <li>A VENTSY não se responsabiliza pela qualidade, segurança ou legalidade dos espaços anunciados.</li>
            <li>A VENTSY não se responsabiliza por danos materiais, pessoais ou financeiros ocorridos durante os eventos.</li>
            <li>A VENTSY não garante a disponibilidade ininterrupta da plataforma e não se responsabiliza por falhas técnicas temporárias.</li>
          </ul>
          <p>Em nenhum caso a responsabilidade total da VENTSY excederá o valor da taxa de serviço cobrada na transação relacionada à reclamação.</p>
        </div>

        {/* ── SEÇÃO 11 ── */}
        <div className="secao" id="t11">
          <span className="secao-num">11</span>
          <h2>Propriedade intelectual</h2>
          <p>Todo o conteúdo da plataforma VENTSY — incluindo logotipos, textos, design, código-fonte e funcionalidades — é protegido por direitos de propriedade intelectual e pertence à VENTSY ou a seus licenciadores.</p>
          <p>É proibida a reprodução, modificação ou distribuição de qualquer elemento da plataforma sem autorização prévia e expressa por escrito.</p>
          <p>Ao publicar fotos ou conteúdo na plataforma, o Usuário garante possuir os direitos sobre esse conteúdo e concede à VENTSY licença para usá-lo na plataforma.</p>
        </div>

        {/* ── SEÇÃO 12 ── */}
        <div className="secao" id="t12">
          <span className="secao-num">12</span>
          <h2>Suspensão e encerramento</h2>
          <p>A VENTSY pode suspender ou encerrar uma conta, a qualquer momento e sem aviso prévio, nos seguintes casos:</p>
          <ul>
            <li>Violação de qualquer disposição destes Termos de Uso.</li>
            <li>Comportamento fraudulento ou lesivo a outros usuários.</li>
            <li>Uso da plataforma para fins ilegais.</li>
            <li>Fornecimento de informações falsas no cadastro ou nos anúncios.</li>
          </ul>
          <p>O encerramento da conta não elimina obrigações já assumidas pelo Usuário em reservas confirmadas anteriormente.</p>
        </div>

        {/* ── SEÇÃO 13 ── */}
        <div className="secao" id="t13">
          <span className="secao-num">13</span>
          <h2>Disposições gerais</h2>
          <p>Estes Termos de Uso são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca do Rio de Janeiro — RJ para dirimir eventuais controvérsias, com renúncia a qualquer outro, por mais privilegiado que seja.</p>
          <p>A eventual invalidade de alguma cláusula não afeta a validade das demais disposições deste instrumento.</p>
          <p>Para dúvidas ou solicitações relacionadas a estes termos, entre em contato: <strong><a href="mailto:juridico@ventsy.com.br" className="text-[var(--vermelho)]">juridico@ventsy.com.br</a></strong>.</p>
        </div>

        {/* ── CARD CONTATO ── */}
        <div className="contato-card">
          <h3>Dúvidas sobre os termos?</h3>
          <p>Nossa equipe jurídica está disponível para esclarecimentos.</p>
          <Link href="/fale-conosco" className="btn-contato">Fale conosco →</Link>
        </div>

      </div>

      <Footer />
    </>
  )
}

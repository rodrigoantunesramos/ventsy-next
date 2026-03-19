import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="main-footer">
      <div className="footer-container">
        <div className="footer-column">
          <h3>Atendimento</h3>
          <ul>
            <li><Link href="/fale-conosco">Fale Conosco</Link></li>
            <li><Link href="/privacidade">Política de Privacidade</Link></li>
            <li><Link href="/termos">Termos de Uso</Link></li>
            <li><Link href="/como-funciona">Como Funciona</Link></li>
          </ul>
        </div>
        <div className="footer-column">
          <h3>Anunciar</h3>
          <ul>
            <li><Link href="/cadastro">Cadastre sua propriedade</Link></li>
            <li><Link href="/planos">Planos Disponíveis</Link></li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <p>&copy; 2026 VENTSY. Todos os direitos reservados.</p>
      </div>
    </footer>
  )
}

export function Footer() {
  return (
    <footer className="bg-gray-100 mt-10 px-6 py-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <div>
          <h3 className="font-bold mb-2">Sobre</h3>
          <p className="text-sm text-gray-600">
            Plataforma para encontrar espaços incríveis para eventos.
          </p>
        </div>

        <div>
          <h3 className="font-bold mb-2">Links</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>Explorar</li>
            <li>Planos</li>
            <li>Contato</li>
          </ul>
        </div>

        <div>
          <h3 className="font-bold mb-2">Contato</h3>
          <p className="text-sm text-gray-600">
            contato@vents y.com
          </p>
        </div>

      </div>

      <div className="text-center text-sm text-gray-500 mt-6">
        © 2026 Ventsy. Todos os direitos reservados.
      </div>
    </footer>
  );
}
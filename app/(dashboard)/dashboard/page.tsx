import DashboardLayout from '@/components/dashboard/DashboardLayout'

export default function DashboardPage() {
  return (
    <DashboardLayout>

      <div className="boas-vindas">
        <div className="bv-inner">
          <p className="bv-tag">Área do proprietário(a)</p>
          <h3>Bem-vindo(a), <em>Usuário</em>!</h3>
          <p>
            Aqui você acompanha o desempenho da sua propriedade e gerencia tudo na VENTSY.
          </p>
        </div>
      </div>

      <div className="grid-metricas">
        <div className="card-metrica">
          <span>👁</span>
          <div>
            <p>Visualizações</p>
            <h3>—</h3>
          </div>
        </div>

        <div className="card-metrica">
          <span>📱</span>
          <div>
            <p>WhatsApp</p>
            <h3>—</h3>
          </div>
        </div>

        <div className="card-metrica">
          <span>💬</span>
          <div>
            <p>Formulário</p>
            <h3>—</h3>
          </div>
        </div>

        <div className="card-metrica">
          <span>⭐</span>
          <div>
            <p>Avaliação</p>
            <h3>—</h3>
          </div>
        </div>
      </div>

    </DashboardLayout>
  )
}
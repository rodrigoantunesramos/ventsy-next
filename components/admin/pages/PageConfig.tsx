'use client'

export default function PageConfig() {
  return (
    <div className="page" id="page-config">
      <div className="max-w-[600px]">
        {/* Segurança */}
        <div className="chart-card mb-5">
          <div className="chart-title mb-4">🔐 Segurança do Admin</div>
          <div className="detail-grid mb-4">
            <div className="detail-row">
              <div className="detail-key">Admin atual</div>
              <div className="detail-val" id="config-admin-email">—</div>
            </div>
            <div className="detail-row">
              <div className="detail-key">Conexão Supabase</div>
              <div className="detail-val"><span className="badge badge-green">✓ Ativa</span></div>
            </div>
          </div>
        </div>

        {/* Banco de dados */}
        <div className="chart-card" style={{ marginBottom: '20px' }}>
          <div className="chart-title" style={{ marginBottom: '16px' }}>🗄️ Banco de Dados</div>
          <div className="detail-grid">
            <div className="detail-row">
              <div className="detail-key">Supabase URL</div>
              <div className="detail-val" style={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>
                hxvlfalgrduitevbhqvq.supabase.co
              </div>
            </div>
            <div className="detail-row">
              <div className="detail-key">Projeto ID</div>
              <div className="detail-val">hxvlfalgrduitevbhqvq</div>
            </div>
            <div className="detail-row">
              <div className="detail-key">Tabelas</div>
              <div className="detail-val">usuarios, propriedades, assinaturas, analytics_eventos, fotos_imovel</div>
            </div>
            <div className="detail-row">
              <div className="detail-key">Versão</div>
              <div className="detail-val">Supabase JS v2</div>
            </div>
          </div>
        </div>

        {/* Sobre */}
        <div className="chart-card">
          <div className="chart-title" style={{ marginBottom: '16px' }}>ℹ️ Sobre o Painel</div>
          <div style={{ fontSize: '0.84rem', color: 'var(--text2)', lineHeight: '1.8' }}>
            Este é o painel de administração central da <strong>VENTSY</strong>.<br /><br />
            Aqui você pode:<br />
            • <strong>Liberar propriedades</strong> para aparecerem na plataforma<br />
            • <strong>Gerenciar usuários</strong> e suas contas<br />
            • <strong>Controlar assinaturas</strong> e planos<br />
            • <strong>Visualizar analytics</strong> completo da plataforma<br /><br />
            <span style={{ color: 'var(--text3)', fontSize: '0.75rem' }}>v1.0 — Ventsy Admin Central</span>
          </div>
        </div>
      </div>
    </div>
  )
}

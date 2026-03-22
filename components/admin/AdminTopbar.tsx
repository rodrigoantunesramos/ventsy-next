// Topbar do painel admin — título e subtítulo são atualizados pelo admin.js via DOM
export default function AdminTopbar() {
  return (
    <div className="topbar">
      <div>
        <div className="topbar-title" id="page-title">Dashboard</div>
        <div className="topbar-subtitle" id="page-sub">Visão geral da plataforma</div>
      </div>
      <div className="topbar-right">
        <div className="topbar-status">
          <div className="pulse"></div>
          Sistema online
        </div>
      </div>
    </div>
  )
}

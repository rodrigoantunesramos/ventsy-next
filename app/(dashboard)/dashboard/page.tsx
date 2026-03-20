// ventsy-next/app/(dashboard)/dashboard/page.tsx
//
// Página principal do admin.
// Renderiza toda a estrutura de seções HTML (igual ao index.html original)
// e carrega os módulos JS via Script tags para manter a lógica existente intacta.

import Script from 'next/script';

export const metadata = {
  title: 'Dashboard — VENTSY',
};

export default function AdminPage() {
  return (
    <>
      {/* ── Scripts CDN (equivalem aos <script src> do index.html) ─────── */}
      {/* Supabase — deve vir antes de qualquer módulo que use `supabase` */}
      <Script
        src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"
        strategy="beforeInteractive"
      />
      <Script
        src="https://cdn.jsdelivr.net/npm/chart.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"
        strategy="beforeInteractive"
      />
      <Script
        src="https://sdk.mercadopago.com/js/v2"
        strategy="lazyOnload"
      />

      {/* Leaflet CSS — via <link> no <head> — adicione em ventsy-next/app/layout.tsx:
           <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      */}

      {/* ── Script do app (ES module) ──────────────────────────────────── */}
      {/*
         
         O app.js importa os demais via import relativo — funciona direto da pasta public.
      */}
      <Script
        src="/dashboard/js/app.js"
        type="module"
        strategy="afterInteractive"
      />

      {/* ── CONTEÚDO DA PÁGINA ─────────────────────────────────────────── */}
      <section className="dash-content">

        {/* ══════════════════════════════════
            PÁGINA: DASHBOARD
        ══════════════════════════════════ */}
        <div className="page-section ativa" id="pagina-dashboard">

          <div className="boas-vindas">
            <div className="bv-inner">
              <p className="bv-tag">Área do proprietário(a)</p>
              <h3>Bem-vindo(a), <em id="hero-nome">...</em>!</h3>
              <p>Aqui você acompanha o desempenho da sua propriedade e gerencia tudo na VENTSY.</p>
            </div>
            <div className="bv-acao">
              <a id="btn-ver-prop" href="#" className="btn-ver-prop" target="_blank">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span id="btn-ver-prop-txt">Ver minha propriedade</span>
              </a>
              <a href="/" className="btn-outras-prop">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                Analisar outras propriedades
              </a>
            </div>
          </div>

          <div className="grid-metricas">
            <div className="card-metrica">
              <span className="icon">👁</span>
              <div><p>Visualizações (30d)</p><h3 id="m-views" className="loading">—</h3></div>
            </div>
            <div className="card-metrica">
              <span className="icon">📱</span>
              <div><p>Cliques WhatsApp (30d)</p><h3 id="m-whatsapp" className="loading">—</h3></div>
            </div>
            <div className="card-metrica">
              <span className="icon">💬</span>
              <div><p>Cliques Formulário (30d)</p><h3 id="m-formulario" className="loading">—</h3></div>
            </div>
            <div className="card-metrica">
              <span className="icon">⭐</span>
              <div><p>Avaliação Média</p><h3 id="m-nota" className="loading">—</h3></div>
            </div>
          </div>

          <div className="container-duas-colunas">
            <div className="secao-dash">
              <div className="analytics-header">
                <h3>Desempenho — últimos 30 dias</h3>
                <div className="analytics-tabs">
                  <button className="tab-btn ativo" data-tipo="view"       onClick={(e) => (window as any).mudarTab?.(e.currentTarget)}>👁 Visualizações</button>
                  <button className="tab-btn"        data-tipo="whatsapp"   onClick={(e) => (window as any).mudarTab?.(e.currentTarget)}>📱 WhatsApp</button>
                  <button className="tab-btn"        data-tipo="formulario" onClick={(e) => (window as any).mudarTab?.(e.currentTarget)}>💬 Formulário</button>
                  <button className="tab-btn"        data-tipo="nota"       onClick={(e) => (window as any).mudarTab?.(e.currentTarget)}>⭐ Avaliações</button>
                </div>
              </div>
              <div style={{ position:'relative', height:'300px', width:'100%' }}>
                <canvas id="graficoAnalytics"></canvas>
              </div>
              <p className="grafico-vazio" id="grafico-vazio">Ainda não há dados para este período.</p>
            </div>
          </div>

          <p className="passos-titulo">📋 Complete seu perfil <span className="passos-progresso" id="passos-progresso">0 de 7 concluídos</span></p>
          <div className="passo-lista">
            <div className="passo-item completo" id="passo-1">
              <div className="passo-num">✓</div>
              <div className="passo-info"><h4>Conta criada com sucesso</h4><p>Seu cadastro foi concluído. Bem-vindo à VENTSY!</p></div>
              <span className="passo-acao verde">✓ Concluído</span>
            </div>
            {[
              { n:2, titulo:'Adicione as fotos da sua propriedade', desc:'Obrigatório: 5 fotos em destaque.', href:'#fotos', acao:'Adicionar fotos' },
              { n:3, titulo:'Descreva seu espaço', desc:'Preencha a aba "Sobre".', href:'#minhapropriedade', acao:'Preencher descrição' },
              { n:4, titulo:'Informe o endereço completo', desc:'CEP, rua, número, bairro, cidade e estado.', href:'#minhapropriedade', acao:'Adicionar endereço' },
              { n:5, titulo:'Informações de contato', desc:'Nome, tipo, capacidade, WhatsApp e e-mail.', href:'#minhapropriedade', acao:'Preencher contato' },
              { n:6, titulo:'Valores dos eventos', desc:'Pelo menos valor por hora ou diária.', href:'#minhapropriedade', acao:'Adicionar valores' },
              { n:7, titulo:'Tipos de eventos', desc:'Selecione pelo menos 1 tipo.', href:'#minhapropriedade', acao:'Selecionar eventos' },
            ].map(p => (
              <div key={p.n} className="passo-item" id={`passo-${p.n}`}>
                <div className="passo-num">{p.n}</div>
                <div className="passo-info"><h4>{p.titulo}</h4><p>{p.desc}</p></div>
                <a href={p.href} className="passo-acao vermelho" onClick={(e) => { e.preventDefault(); (window as any).navegar?.(p.href.replace('#','')); }}>{p.acao}</a>
              </div>
            ))}
          </div>

          <div className="card-solicitar">
            <p className="tag">Último passo</p>
            <h3>Pronto para ir ao ar? 🚀</h3>
            <p>Após preencher todos os dados, solicite a publicação. Nossa equipe revisará em até <strong>48 horas úteis</strong>.</p>
            <div className="solicitar-aviso" id="solicitar-aviso">⚠️ Complete todos os <strong>4 passos</strong> acima para liberar o botão.</div>
            <button
              className="btn-solicitar"
              id="btn-solicitar"
              onClick={() => (window as any).solicitarLiberacao?.()}
              disabled
            >
              🚀 Solicitar liberação de propriedade na plataforma VENTSY
            </button>
            <p className="solicitar-hint" id="solicitar-hint">Após a solicitação, nossa equipe entrará em contato.</p>
          </div>

        </div>{/* /pagina-dashboard */}








        {/* ══════════════════════════════════
            PÁGINA: financeiro
        ══════════════════════════════════ */}
        {/* pagina-financeiro — copiar do index.html */}
        <div className="page-section" id="pagina-financeiro">

            {/* Header fixo da seção */}
  <div className="fin-header">
    <div>
      <h2>💰 Financeiro</h2>
      <div className="nome-propriedade" id="fin-data-atual" />
    </div>
    <div className="fin-header-right">
      <select className="fin-select" onChange={(e: any) => (window as any).finUpdatePeriod(e.target.value)}>
        <option value="mes">Este Mês</option>
        <option value="trimestre">Trimestre</option>
        <option value="ano">Este Ano</option>
      </select>
      <button
        className="btn-fin btn-fin-ghost"
        onClick={() => (window as any).finOpenModal('despesa')}
      >
        + Despesa
      </button>
      <button
        className="btn-fin btn-fin-primary"
        onClick={() => (window as any).finOpenModal('receita')}
      >
        + Receita
      </button>
    </div>
  </div>
  {/* Sub-abas internas */}
  <div className="fin-tabs">
    <button className="fin-tab-btn ativo" onClick={(e: any) => (window as any).finMudarAba('painel', e.target)}>
      📊 Painel
    </button>
    <button className="fin-tab-btn" onClick={(e: any) => (window as any).finMudarAba('receitas', e.target)}> 
      💚 Receitas
    </button>
    <button className="fin-tab-btn" onClick={(e: any) => (window as any).finMudarAba('despesas', e.target)}>
      🔴 Despesas
    </button>
    <button className="fin-tab-btn" onClick={(e: any) => (window as any).finMudarAba('eventos', e.target)}>
      📅 Eventos
    </button>
    <button className="fin-tab-btn" onClick={(e: any) => (window as any).finMudarAba('relatorios', e.target)}>
      📋 Relatórios
    </button>
  </div>
  {/* ── ABA: PAINEL ── */}
  <div className="fin-tab-content ativo" id="fin-painel">
    {/* KPIs */}
    <div className="fin-kpi-grid">
      <div
        className="fin-kpi-card verde"
        style={{ animation: "fadeUp .3s ease both" }}
      >
        <div className="fin-kpi-label">Receita Total</div>
        <div className="fin-kpi-value verde" id="fin-kpi-receita">
          R$ 48.700
        </div>
        <div className="fin-delta up">↑ 12% vs mês anterior</div>
      </div>
      <div
        className="fin-kpi-card vermelho"
        style={{ animation: "fadeUp .35s ease both" }}
      >
        <div className="fin-kpi-label">Despesas Totais</div>
        <div className="fin-kpi-value vermelho" id="fin-kpi-despesa">
          R$ 19.350
        </div>
        <div className="fin-delta down">↑ 4% vs mês anterior</div>
      </div>
      <div
        className="fin-kpi-card gold"
        style={{ animation: "fadeUp .4s ease both" }}
      >
        <div className="fin-kpi-label">Lucro Líquido</div>
        <div className="fin-kpi-value gold" id="fin-kpi-lucro">
          R$ 29.350
        </div>
        <div className="fin-delta up">↑ 18% vs mês anterior</div>
      </div>
      <div
        className="fin-kpi-card azul"
        style={{ animation: "fadeUp .45s ease both" }}
      >
        <div className="fin-kpi-label">Eventos no Mês</div>
        <div className="fin-kpi-value azul" id="fin-kpi-eventos">
          14
        </div>
        <div className="fin-delta up">↑ 2 vs mês anterior</div>
      </div>
    </div>
    {/* Grid meio */}
    <div className="fin-mid-grid">
      {/* Gráfico de barras */}
      <div
        className="fin-section"
        style={{ animation: "fadeUp .4s ease both" }}
      >
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">Receitas × Despesas</div>
            <div className="fin-section-sub">Últimos 6 meses</div>
          </div>
          <span className="fin-badge">2025</span>
        </div>
        <canvas id="finBarChart" height={160} />
      </div>
      {/* Donut */}
      <div
        className="fin-section"
        style={{ animation: "fadeUp .45s ease both" }}
      >
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">Fontes de Receita</div>
            <div className="fin-section-sub">Distribuição por categoria</div>
          </div>
        </div>
        <div className="fin-donut-wrap">
          <canvas id="finDonutChart" width={140} height={140} />
          <div className="fin-donut-legend" id="finDonutLegend" />
        </div>
      </div>
      {/* Metas */}
      <div
        className="fin-section"
        style={{ animation: "fadeUp .5s ease both" }}
      >
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">Metas Mensais</div>
            <div className="fin-section-sub">Progresso até agora</div>
          </div>
          <button
            className="btn-fin btn-fin-ghost"
            style={{ fontSize: "0.78rem", padding: "6px 14px" }}
            onClick={() => (window as any).finOpenModal('meta')}
          >
            Editar
          </button>
        </div>
        <div className="fin-goal-list" id="finGoalList" />
      </div>
      {/* Próximos Eventos */}
      <div
        className="fin-section"
        style={{ animation: "fadeUp .55s ease both" }}
      >
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">Próximos Eventos</div>
            <div className="fin-section-sub">Previsão de entrada</div>
          </div>
        </div>
        <div className="fin-cf-row">
          <div className="fin-cf-box">
            <div className="fin-cf-label">Confirmados</div>
            <div className="fin-cf-val" style={{ color: "#0ca678" }}>
              R$ 22.400
            </div>
          </div>
          <div className="fin-cf-box">
            <div className="fin-cf-label">Em Negociação</div>
            <div className="fin-cf-val" style={{ color: "#f59e0b" }}>
              R$ 8.900
            </div>
          </div>
          <div className="fin-cf-box">
            <div className="fin-cf-label">Pendente Pag.</div>
            <div className="fin-cf-val" style={{ color: "#ff385c" }}>
              R$ 5.200
            </div>
          </div>
        </div>
        <div className="fin-event-list" id="finEventList" />
      </div>
      {/* Lançamentos */}
      <div
        className="fin-section fin-wide"
        style={{ animation: "fadeUp .6s ease both" }}
      >
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">Lançamentos Recentes</div>
            <div className="fin-section-sub">Todas as movimentações do mês</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <select
              className="fin-select"
              style={{ fontSize: "0.78rem", padding: "6px 12px" }}
              onChange={(e: any) => (window as any).finFilterTable(e.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="receita">Receitas</option>
              <option value="despesa">Despesas</option>
              <option value="pendente">Pendentes</option>
            </select>
            <button
              className="btn-fin btn-fin-ghost"
              style={{ fontSize: "0.78rem", padding: "6px 14px" }}
            >
              Exportar
            </button>
          </div>
        </div>
        <div className="fin-table-wrap">
          <table className="fin-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Descrição</th>
                <th>Categoria</th>
                <th>Tipo de Evento</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>Valor</th>
              </tr>
            </thead>
            <tbody id="finTransTable" />
          </table>
        </div>
      </div>
    </div>
  </div>
  {/* /fin-painel */}
  {/* ── ABA: RECEITAS ── */}
  <div className="fin-tab-content" id="fin-receitas">
    <div className="fin-section">
      <div className="fin-section-header">
        <div>
          <div className="fin-section-title">💚 Receitas do Período</div>
          <div className="fin-section-sub">Todas as entradas registradas</div>
        </div>
        <button
          className="btn-fin btn-fin-primary"
          onClick={() => (window as any).finOpenModal('receita')}
        >
          + Nova Receita
        </button>
      </div>
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Evento</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Valor</th>
            </tr>
          </thead>
          <tbody id="finReceitasTable" />
        </table>
      </div>
    </div>
  </div>
  {/* ── ABA: DESPESAS ── */}
  <div className="fin-tab-content" id="fin-despesas">
    <div className="fin-section">
      <div className="fin-section-header">
        <div>
          <div className="fin-section-title">🔴 Despesas do Período</div>
          <div className="fin-section-sub">Todas as saídas registradas</div>
        </div>
        <button
          className="btn-fin btn-fin-ghost"
          onClick={() => (window as any).finOpenModal('despesa')}
        >
          + Nova Despesa
        </button>
      </div>
      <div className="fin-table-wrap">
        <table className="fin-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th>Categoria</th>
              <th>Evento</th>
              <th>Status</th>
              <th style={{ textAlign: "right" }}>Valor</th>
            </tr>
          </thead>
          <tbody id="finDespesasTable" />
        </table>
      </div>
    </div>
  </div>
  {/* ── ABA: EVENTOS ── */}
  <div className="fin-tab-content" id="fin-eventos">
    <div className="fin-section">
      <div className="fin-section-header">
        <div>
          <div className="fin-section-title">📅 Eventos com Movimentação</div>
          <div className="fin-section-sub">Receitas vinculadas a eventos</div>
        </div>
      </div>
      <div
        className="fin-event-list"
        id="finEventListFull"
        style={{ maxHeight: 500, overflowY: "auto" }}
      />
    </div>
  </div>
  {/* ── ABA: RELATÓRIOS ── */}
  <div className="fin-tab-content" id="fin-relatorios">
    <div className="fin-mid-grid">
      <div className="fin-section">
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">📋 Resumo do Mês</div>
            <div className="fin-section-sub">Visão consolidada</div>
          </div>
        </div>
        <div
          className="fin-cf-row"
          style={{ flexDirection: "column", gap: 14 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 14,
              background: "#f7f7f7",
              borderRadius: 10,
              border: "1px solid #eee"
            }}
          >
            <span
              style={{ fontSize: "0.88rem", color: "#444", fontWeight: 600 }}
            >
              Total Receitas
            </span>
            <span
              style={{ fontWeight: 700, color: "#0ca678", fontSize: "1rem" }}
              id="rel-receita"
            >
              R$ 48.700
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 14,
              background: "#f7f7f7",
              borderRadius: 10,
              border: "1px solid #eee"
            }}
          >
            <span
              style={{ fontSize: "0.88rem", color: "#444", fontWeight: 600 }}
            >
              Total Despesas
            </span>
            <span
              style={{ fontWeight: 700, color: "#ff385c", fontSize: "1rem" }}
              id="rel-despesa"
            >
              R$ 19.350
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: 14,
              background: "rgba(255,56,92,0.04)",
              borderRadius: 10,
              border: "1px solid rgba(255,56,92,0.15)"
            }}
          >
            <span
              style={{ fontSize: "0.88rem", color: "#444", fontWeight: 700 }}
            >
              Lucro Líquido
            </span>
            <span
              style={{ fontWeight: 700, color: "#f59e0b", fontSize: "1.1rem" }}
              id="rel-lucro"
            >
              R$ 29.350
            </span>
          </div>
        </div>
      </div>
      <div className="fin-section">
        <div className="fin-section-header">
          <div>
            <div className="fin-section-title">🎯 Metas vs Realizado</div>
            <div className="fin-section-sub">Performance do mês</div>
          </div>
        </div>
        <div className="fin-goal-list" id="finGoalListRel" />
      </div>
    </div>
  </div>
          </div>






        {/* ══════════════════════════════════
            PÁGINA: documentos
        ══════════════════════════════════ */}
        {/* pagina-documentos */}
        <div className="page-section" id="pagina-documentos">
          


          <>
  <div className="docs-header">
    <div>
      <h2>📄 Documentos</h2>
      <div className="nome-propriedade">
        Licenças, alvarás e documentos com controle de validade
      </div>
    </div>
    <div className="docs-header-right">
      <button className="btn-fin btn-fin-ghost" onClick={() => (window as any).docsExport()}>
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="7,10 12,15 17,10" />
          <line x1={12} y1={15} x2={12} y2={3} />
        </svg>
        Exportar Lista
      </button>
      <button className="btn-fin btn-fin-primary" onClick={() => (window as any).docsOpenAddModal()}>
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <line x1={12} y1={5} x2={12} y2={19} />
          <line x1={5} y1={12} x2={19} y2={12} />
        </svg>
        Novo Documento
      </button>
    </div>
  </div>
  {/* Alert banner */}
  <div className="docs-alert" id="docsAlertBanner" style={{ display: "none" }}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <circle cx={12} cy={12} r={10} />
      <line x1={12} y1={8} x2={12} y2={12} />
      <line x1={12} y1={16} x2="12.01" y2={16} />
    </svg>
    <div className="docs-alert-text">
      <strong id="docsAlertTitle">Atenção</strong>
      <span id="docsAlertDesc">Verifique os documentos abaixo.</span>
    </div>
    <span className="docs-alert-tag" id="docsAlertCount">
      0 itens
    </span>
  </div>
  {/* Summary */}
  <div className="docs-summary">
    <div className="docs-sum-card">
      <div className="docs-sum-icon" style={{ background: "#f0fdf4" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth={2}>
          <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
          <polyline points="22,4 12,14.01 9,11.01" />
        </svg>
      </div>
      <div>
        <div
          className="docs-sum-val"
          style={{ color: "#16a34a" }}
          id="docsCntOk"
        >
          0
        </div>
        <div className="docs-sum-label">Em Dia</div>
      </div>
    </div>
    <div className="docs-sum-card">
      <div className="docs-sum-icon" style={{ background: "#fffbeb" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth={2}>
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1={12} y1={9} x2={12} y2={13} />
          <line x1={12} y1={17} x2="12.01" y2={17} />
        </svg>
      </div>
      <div>
        <div
          className="docs-sum-val"
          style={{ color: "#d97706" }}
          id="docsCntWarn"
        >
          0
        </div>
        <div className="docs-sum-label">A Vencer (90d)</div>
      </div>
    </div>
    <div className="docs-sum-card">
      <div className="docs-sum-icon" style={{ background: "#fef2f2" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth={2}>
          <circle cx={12} cy={12} r={10} />
          <line x1={15} y1={9} x2={9} y2={15} />
          <line x1={9} y1={9} x2={15} y2={15} />
        </svg>
      </div>
      <div>
        <div
          className="docs-sum-val"
          style={{ color: "#dc2626" }}
          id="docsCntExp"
        >
          0
        </div>
        <div className="docs-sum-label">Vencidos</div>
      </div>
    </div>
    <div className="docs-sum-card">
      <div className="docs-sum-icon" style={{ background: "#eff6ff" }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth={2}>
          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
          <polyline points="14,2 14,8 20,8" />
          <line x1={16} y1={13} x2={8} y2={13} />
          <line x1={16} y1={17} x2={8} y2={17} />
        </svg>
      </div>
      <div>
        <div
          className="docs-sum-val"
          style={{ color: "#1a73e8" }}
          id="docsCntTotal"
        >
          0
        </div>
        <div className="docs-sum-label">Total de Docs</div>
      </div>
    </div>
  </div>
  {/* Filter bar */}
  <div className="docs-filter-bar">
    <button
      className="docs-filter-pill active"
      onClick={(e: any) => (window as any).docsSetFilter('todos',e.target)}
    >
      Todos
    </button>
    <button
      className="docs-filter-pill"
      onClick={(e: any) => (window as any).docsSetFilter('juridico',e.target)}
    >
      Jurídico
    </button>
    <button
      className="docs-filter-pill"
      onClick={(e: any) => (window as any).docsSetFilter('licencas',e.target)}
    >
      Licenças
    </button>
    <button className="docs-filter-pill" onClick={(e: any) => (window as any).docsSetFilter('fiscal',e.target)}>
      Fiscal
    </button>
    <button
      className="docs-filter-pill"
      onClick={(e: any) => (window as any).docsSetFilter('seguros',e.target)}
    >
      Seguros
    </button>
    <button className="docs-filter-pill" onClick={(e: any) => (window as any).docsSetFilter('alvara',e.target)}>
      Alvarás
    </button>
    <button className="docs-filter-pill" onClick={(e: any) => (window as any).docsSetFilter('outros',e.target)}>
      Outros
    </button>
    <div className="docs-search-box">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx={11} cy={11} r={8} />
        <line x1={21} y1={21} x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        placeholder="Buscar documento..."
        onInput={(e: any) => (window as any).docsSearch(e.target.value)}
      />
    </div>
  </div>
  {/* Docs container */}
  <div id="docsContainer" />
</>
        </div>







        {/* ══════════════════════════════════
            PÁGINA: equipe
        ══════════════════════════════════ */}
        {/* pagina-equipe */}
        <div className="page-section" id="pagina-equipe">
          <div className="page-section" id="pagina-equipe">
  <div className="eq-header">
    <div>
      <h2>👥 Equipe &amp; Folha</h2>
      <div className="nome-propriedade">
        Gestão de funcionários, contracheques e encargos
      </div>
    </div>
    <div className="eq-header-right">
      <button
        className="btn-fin btn-fin-ghost"
        onClick={() => (window as any).eqSwitchTab('impostos')}
      >
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx={12} cy={12} r={3} />
          <path d="M19.07 4.93l-1.41 1.41M20 12h-2M17.66 17.66l-1.41-1.41M12 20v-2M6.34 17.66l-1.41-1.41M4 12H2M6.34 6.34L4.93 4.93" />
        </svg>
        Configurar Encargos
      </button>
      <button className="btn-fin btn-fin-primary" onClick={() => (window as any).eqOpenEmpModal()}>
        <svg
          width={13}
          height={13}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <line x1={12} y1={5} x2={12} y2={19} />
          <line x1={5} y1={12} x2={19} y2={12} />
        </svg>
        Novo Funcionário
      </button>
    </div>
  </div>
  {/* KPI strip */}
  <div className="eq-kpi-grid">
    <div className="eq-kpi t">
      <div className="eq-kpi-label">Total Funcionários</div>
      <div className="eq-kpi-val" id="eq-kpi-total">
        0
      </div>
      <div className="eq-kpi-sub" id="eq-kpi-ativos-sub">
        — ativos
      </div>
    </div>
    <div className="eq-kpi a">
      <div className="eq-kpi-label">Folha Bruta / Mês</div>
      <div className="eq-kpi-val" id="eq-kpi-bruta">
        R$ 0
      </div>
      <div className="eq-kpi-sub">Soma dos salários base</div>
    </div>
    <div className="eq-kpi r">
      <div className="eq-kpi-label">Encargos Totais</div>
      <div className="eq-kpi-val" id="eq-kpi-encargos">
        R$ 0
      </div>
      <div className="eq-kpi-sub">Custo patronal estimado</div>
    </div>
    <div className="eq-kpi v">
      <div className="eq-kpi-label">Custo Total / Mês</div>
      <div className="eq-kpi-val" id="eq-kpi-custo">
        R$ 0
      </div>
      <div className="eq-kpi-sub">Bruto + encargos</div>
    </div>
  </div>
  {/* Sub-abas */}
  <div className="eq-tabs">
    <button
      className="eq-tab active"
      id="eq-tab-equipe"
      onClick={() => (window as any).eqSwitchTab('equipe')}
    >
      Equipe
    </button>
    <button className="eq-tab" id="eq-tab-folha" onClick={() => (window as any).eqSwitchTab('folha')}>
      Folha de Pagamento
    </button>
    <button
      className="eq-tab"
      id="eq-tab-impostos"
      onClick={() => (window as any).eqSwitchTab('impostos')}
    >
      Encargos &amp; Impostos
    </button>
  </div>
  {/* ── ABA: EQUIPE ── */}
  <div id="eq-panel-equipe" className="eq-panel active">
    <div className="eq-filter-bar">
      <button
        className="eq-filter-pill active"
        onClick={(e: any) => (window as any).eqFilterEmp('todos',e.target)}
      >
        Todos
      </button>
      <button className="eq-filter-pill" onClick={(e: any) => (window as any).eqFilterEmp('ativo',e.target)}>
        Ativos
      </button>
      <button className="eq-filter-pill" onClick={(e: any) => (window as any).eqFilterEmp('ferias',e.target)}>
        Férias
      </button>
      <button className="eq-filter-pill" onClick={(e: any) => (window as any).eqFilterEmp('horista',e.target)}>
        Horista
      </button>
      <div className="eq-search-box">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx={11} cy={11} r={8} />
          <line x1={21} y1={21} x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Buscar funcionário..."
          onInput={(e: any) => (window as any).eqSearchEmp(e.target.value)}
        />
      </div>
    </div>
    <div className="eq-emp-grid" id="eqEmpGrid" />
  </div>
  {/* ── ABA: FOLHA ── */}
  <div id="eq-panel-folha" className="eq-panel">
    <div className="eq-payroll-header">
      <div className="eq-month-nav">
        <button onClick={() => (window as any).eqChangeMonth(-1)}>‹</button>
        <div className="eq-month-label" id="eqMonthLabel">
          —
        </div>
        <button onClick={() => (window as any).eqChangeMonth(1)}>›</button>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn-fin btn-fin-ghost" onClick={() => (window as any).eqExportPayroll()}>
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1={12} y1={15} x2={12} y2={3} />
          </svg>
          Exportar CSV
        </button>
        <button
          className="btn-fin btn-fin-primary"
          style={{
            background: "#f59e0b",
            boxShadow: "0 2px 10px rgba(245,158,11,.25)"
          }}
        >
          Fechar Folha
        </button>
      </div>
    </div>
    <div className="eq-payroll-totals">
      <div className="eq-ptotal">
        <div className="eq-ptotal-label">Total Bruto</div>
        <div
          className="eq-ptotal-val"
          style={{ color: "#f59e0b" }}
          id="eq-pt-bruto"
        >
          R$ 0
        </div>
      </div>
      <div className="eq-ptotal">
        <div className="eq-ptotal-label">Total Descontos</div>
        <div
          className="eq-ptotal-val"
          style={{ color: "#ff385c" }}
          id="eq-pt-descontos"
        >
          R$ 0
        </div>
      </div>
      <div className="eq-ptotal">
        <div className="eq-ptotal-label">Total Líquido</div>
        <div
          className="eq-ptotal-val"
          style={{ color: "#0ca678" }}
          id="eq-pt-liquido"
        >
          R$ 0
        </div>
      </div>
    </div>
    <div className="eq-table-wrap">
      <table className="eq-table">
        <thead>
          <tr>
            <th>Funcionário</th>
            <th>Cargo</th>
            <th>Salário Base</th>
            <th>Adicionais</th>
            <th>Descontos</th>
            <th>Líquido</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody id="eqPayrollBody" />
      </table>
    </div>
  </div>
  {/* ── ABA: IMPOSTOS ── */}
  <div id="eq-panel-impostos" className="eq-panel">
    <div style={{ maxWidth: 900 }}>
      <div className="eq-tax-notice">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <circle cx={12} cy={12} r={10} />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <div>
          <strong>
            ⚠️ Peça ajuda ao seu contador para preencher esta seção.
          </strong>
          <span>
            Os percentuais variam conforme regime tributário, categoria e
            legislação vigente.
          </span>
        </div>
      </div>
      <div className="eq-tax-grid">
        {/* Encargos Patronais */}
        <div className="eq-tax-section">
          <div className="eq-tax-section-title">
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f59e0b"
              strokeWidth={2}
            >
              <path d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
              <circle cx={12} cy={12} r={2} />
            </svg>{" "}
            Encargos Patronais
          </div>
          <div className="eq-tax-section-desc">
            Pago pela empresa sobre a folha de pagamento
          </div>
          <div className="eq-tax-field">
            <label>
              <span>INSS Patronal</span>
              <em id="eq-v-inss-pat">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-inss-pat"
                defaultValue={20}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>FGTS</span>
              <em id="eq-v-fgts">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-fgts"
                defaultValue={8}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>RAT / SAT</span>
              <em id="eq-v-rat">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-rat"
                defaultValue={2}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Sistema S</span>
              <em id="eq-v-sis-s">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-sis-s"
                defaultValue="3.1"
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Outros patronais</span>
              <em id="eq-v-outros-pat">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-outros-pat"
                defaultValue={0}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-total-row">
            <span className="eq-tax-total-label">Total patronal</span>
            <span className="eq-tax-total-val" id="eq-total-patronal">
              0%
            </span>
          </div>
        </div>
        {/* Descontos do funcionário */}
        <div className="eq-tax-section">
          <div className="eq-tax-section-title">
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ff385c"
              strokeWidth={2}
            >
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
              <circle cx={9} cy={7} r={4} />
            </svg>{" "}
            Descontos do Funcionário
          </div>
          <div className="eq-tax-section-desc">
            Descontados do salário bruto do trabalhador
          </div>
          <div className="eq-tax-field">
            <label>
              <span>INSS Empregado</span>
              <em id="eq-v-inss-emp">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-inss-emp"
                defaultValue={9}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>IRRF</span>
              <em id="eq-v-irrf">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-irrf"
                defaultValue="7.5"
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Vale Transporte (desc.)</span>
              <em id="eq-v-vt">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-vt"
                defaultValue={6}
                min={0}
                max={6}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Plano Saúde (R$ fixo)</span>
              <em id="eq-v-ps">R$ 0</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-ps"
                defaultValue={0}
                min={0}
                step={10}
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">R$</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Outros descontos</span>
              <em id="eq-v-outros-desc">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-outros-desc"
                defaultValue={0}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-total-row">
            <span className="eq-tax-total-label">Total descontos</span>
            <span className="eq-tax-total-val" id="eq-total-desconto">
              0%
            </span>
          </div>
        </div>
        {/* Benefícios */}
        <div className="eq-tax-section">
          <div className="eq-tax-section-title">
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#0ca678"
              strokeWidth={2}
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>{" "}
            Benefícios (R$/mês)
          </div>
          <div className="eq-tax-section-desc">
            Valores fixos pagos pela empresa por funcionário
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Vale Refeição/Alimentação</span>
              <em id="eq-v-vr">R$ 0</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-vr"
                defaultValue={550}
                min={0}
                step={10}
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">R$</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Vale Transporte (empresa)</span>
              <em id="eq-v-vt-emp">R$ 0</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-vt-emp"
                defaultValue={220}
                min={0}
                step={10}
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">R$</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Plano Saúde (empresa)</span>
              <em id="eq-v-ps-emp">R$ 0</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-ps-emp"
                defaultValue={0}
                min={0}
                step={50}
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">R$</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Outros benefícios</span>
              <em id="eq-v-outros-ben">R$ 0</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-outros-ben"
                defaultValue={0}
                min={0}
                step={10}
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">R$</span>
            </div>
          </div>
          <div className="eq-tax-total-row">
            <span className="eq-tax-total-label">Total benefícios / func.</span>
            <span className="eq-tax-total-val" id="eq-total-beneficios">
              R$ 0
            </span>
          </div>
        </div>
        {/* Provisões */}
        <div className="eq-tax-section">
          <div className="eq-tax-section-title">
            <svg
              width={15}
              height={15}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth={2}
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>{" "}
            Provisões
          </div>
          <div className="eq-tax-section-desc">
            Reservas mensais para direitos trabalhistas futuros
          </div>
          <div className="eq-tax-field">
            <label>
              <span>13º Salário (1/12)</span>
              <em id="eq-v-dec">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-dec"
                defaultValue="8.33"
                min={0}
                max={100}
                step="0.01"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Férias + 1/3</span>
              <em id="eq-v-fer">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-fer"
                defaultValue="11.11"
                min={0}
                max={100}
                step="0.01"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Multa FGTS rescisão</span>
              <em id="eq-v-multa">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-multa"
                defaultValue="3.2"
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-field">
            <label>
              <span>Outras provisões</span>
              <em id="eq-v-outros-prov">0%</em>
            </label>
            <div className="eq-tax-input-row">
              <input
                className="eq-tax-input"
                type="number"
                id="eq-t-outros-prov"
                defaultValue={0}
                min={0}
                max={100}
                step="0.1"
                onInput={() => (window as any).eqUpdateTax()}
              />
              <span className="eq-tax-suffix">%</span>
            </div>
          </div>
          <div className="eq-tax-total-row">
            <span className="eq-tax-total-label">Total provisões</span>
            <span className="eq-tax-total-val" id="eq-total-provisoes">
              0%
            </span>
          </div>
        </div>
      </div>
      {/* Simulador */}
      <div className="eq-sim-panel">
        <div className="eq-sim-title">🧮 Simulador de Custo Real</div>
        <div className="eq-sim-desc">
          Digite o salário base e veja o custo total para a empresa e o líquido
          do funcionário.
        </div>
        <div className="eq-sim-body">
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div className="eq-sim-label">Salário Base (R$)</div>
              <input
                className="eq-sim-input"
                type="number"
                id="eq-sim-salario"
                defaultValue={2500}
                min={0}
                step={100}
                onInput={() => (window as any).eqRunSimulator()}
              />
            </div>
            <div>
              <div className="eq-sim-label">Tipo de Contrato</div>
              <select
                className="eq-sim-select"
                id="eq-sim-tipo"
                onChange={() => (window as any).eqRunSimulator()}
              >
                <option value="clt">CLT — Integral</option>
                <option value="horista">CLT — Horista</option>
                <option value="mei">MEI / Autônomo</option>
              </select>
            </div>
            <div>
              <div className="eq-sim-label">Horas extras (quantidade)</div>
              <input
                className="eq-sim-input"
                type="number"
                id="eq-sim-he"
                defaultValue={0}
                min={0}
                max={80}
                step={1}
                onInput={() => (window as any).eqRunSimulator()}
                style={{ fontSize: ".9rem" }}
              />
            </div>
            <div>
              <div className="eq-sim-label">Adicional / Bônus (R$)</div>
              <input
                className="eq-sim-input"
                type="number"
                id="eq-sim-bonus"
                defaultValue={0}
                min={0}
                step={50}
                onInput={() => (window as any).eqRunSimulator()}
                style={{ fontSize: ".9rem" }}
              />
            </div>
          </div>
          <div>
            <div className="eq-sim-result" id="eqSimResult" />
            <div className="eq-sim-disclaimer">
              ⚠️ Simulação estimada com base nos encargos configurados.
              <br />
              Consulte seu contador para valores oficiais.
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

        </div>







        {/* ══════════════════════════════════
            PÁGINA: fotos
        ══════════════════════════════════ */}
        {/* pagina-fotos */}
        <div className="page-section" id="pagina-fotos">
          <>
  <div className="dash-header-fixo">
    <div>
      <h2>📸 Fotos do Espaço</h2>
      <p style={{ fontSize: "0.82rem", color: "#999", marginTop: 3 }}>
        Organize as fotos por ambiente e defina as 5 fotos em destaque.
      </p>
    </div>
    <div className="fotos-header-acoes">
      <button className="fotos-btn-salvar-tudo" onClick={() => (window as any).fotosSalvarTudo()}>
        💾 Salvar
      </button>
      <button className="fotos-btn-nova-secao" onClick={() => (window as any).fotosCriarSecao()}>
        + Nova seção
      </button>
    </div>
  </div>
  {/* Aviso sem propriedade */}
  <div className="fotos-aviso-sem-prop" id="fotos-aviso-sem-prop">
    <span style={{ fontSize: "1.5rem" }}>⚠️</span>
    <p>
      Você precisa cadastrar sua propriedade antes de adicionar fotos.{" "}
      <a href="minhapropriedade.html">Cadastrar agora →</a>
    </p>
  </div>
  {/* Banner de plano */}
  <div className="fotos-banner-plano" id="fotos-banner-plano" />
  {/* Tabs */}
  <div className="fotos-tabs">
    <button
      className="fotos-tab-btn active"
      id="fotos-tab-espaco"
      onClick={() => (window as any).fotosMudarAba('espaco')}
    >
      📷 Fotos do Espaço
    </button>
    <button
      className="fotos-tab-btn"
      id="fotos-tab-evento"
      onClick={() => (window as any).fotosMudarAba('evento')}
    >
      🎉 Fotos de Eventos
    </button>
  </div>
  {/* ═══ ABA: FOTOS DO ESPAÇO ═══ */}
  <div className="fotos-aba ativa" id="fotos-aba-espaco">
    <div className="fotos-aviso-intro">
      <span className="fotos-aviso-intro-icon">💡</span>
      <div className="fotos-aviso-intro-texto">
        <h4>Fotos do espaço em si</h4>
        <p>
          Crie uma seção para cada ambiente — ex: <strong>Área Externa</strong>,{" "}
          <strong>Salão Principal</strong>, <strong>Lareira</strong>. A primeira
          foto de cada seção será a capa daquele ambiente.
        </p>
      </div>
    </div>
    {/* PAINEL DESTAQUE */}
    <div className="fotos-destaque-panel">
      <div className="fotos-destaque-panel-top">
        <div>
          <h3>⭐ 5 Fotos em Destaque — Galeria Principal</h3>
          <p>
            Clique em um slot para ativá-lo, depois clique na foto abaixo que
            deseja colocar nessa posição.
            <br />
            Pos. 1 = foto grande à esquerda &nbsp;|&nbsp; 2 = sup. esq.
            &nbsp;|&nbsp; 3 = sup. dir. &nbsp;|&nbsp; 4 = inf. esq.
            &nbsp;|&nbsp; 5 = inf. dir.
          </p>
        </div>
      </div>
      <div className="fotos-destaque-slots-grid">
        <div
          className="fotos-destaque-slot slot-main"
          id="fotos-dslot-1"
          onClick={() => (window as any).fotosAtivarSlot(1)}
          title="Posição 1 — principal"
        >
          <img id="fotos-dslot-img-1" src="" alt="Posição 1" />
          <div className="fotos-dslot-empty" id="fotos-dslot-empty-1">
            <span>📷</span>
            <span>
              Pos. 1<br />
              <small>(principal)</small>
            </span>
          </div>
          <div className="fotos-dslot-num">1</div>
          <button
            className="fotos-btn-limpar-dslot"
            title="Remover"
            onClick={(e) => { e.stopPropagation(); (window as any).fotosLimparDestaquePos(1) }}
          >
            ✕
          </button>
        </div>
        <div
          className="fotos-destaque-slot"
          id="fotos-dslot-2"
          onClick={() => (window as any).fotosAtivarSlot(2)}
          title="Posição 2"
        >
          <img id="fotos-dslot-img-2" src="" alt="Posição 2" />
          <div className="fotos-dslot-empty" id="fotos-dslot-empty-2">
            <span>📷</span>
            <span>Pos. 2</span>
          </div>
          <div className="fotos-dslot-num">2</div>
          <button
            className="fotos-btn-limpar-dslot"
            title="Remover"
            onClick={(e) => { e.stopPropagation(); (window as any).fotosLimparDestaquePos(2) }}
          >
            ✕
          </button>
        </div>
        <div
          className="fotos-destaque-slot"
          id="fotos-dslot-3"
          onClick={() => (window as any).fotosAtivarSlot(3)}
          title="Posição 3"
        >
          <img id="fotos-dslot-img-3" src="" alt="Posição 3" />
          <div className="fotos-dslot-empty" id="fotos-dslot-empty-3">
            <span>📷</span>
            <span>Pos. 3</span>
          </div>
          <div className="fotos-dslot-num">3</div>
          <button
            className="fotos-btn-limpar-dslot"
            title="Remover"
            onClick={(e) => { e.stopPropagation(); (window as any).fotosLimparDestaquePos(3) }}
          >
            ✕
          </button>
        </div>
        <div
          className="fotos-destaque-slot"
          id="fotos-dslot-4"
          onClick={() => (window as any).fotosAtivarSlot(4)}
          title="Posição 4"
        >
          <img id="fotos-dslot-img-4" src="" alt="Posição 4" />
          <div className="fotos-dslot-empty" id="fotos-dslot-empty-4">
            <span>📷</span>
            <span>Pos. 4</span>
          </div>
          <div className="fotos-dslot-num">4</div>
          <button
            className="fotos-btn-limpar-dslot"
            title="Remover"
            onClick={(e) => { e.stopPropagation(); (window as any).fotosLimparDestaquePos(4) }}
          >
            ✕
          </button>
        </div>
        <div
          className="fotos-destaque-slot"
          id="fotos-dslot-5"
          onClick={() => (window as any).fotosAtivarSlot(5)}
          title="Posição 5"
        >
          <img id="fotos-dslot-img-5" src="" alt="Posição 5" />
          <div className="fotos-dslot-empty" id="fotos-dslot-empty-5">
            <span>📷</span>
            <span>Pos. 5</span>
          </div>
          <div className="fotos-dslot-num">5</div>
          <button
            className="fotos-btn-limpar-dslot"
            title="Remover"
            onClick={(e) => { e.stopPropagation(); (window as any).fotosLimparDestaquePos(5) }}
          >
            ✕
          </button>
        </div>
      </div>
      <div className="fotos-slot-hint" id="fotos-slot-hint" />
    </div>
    {/* Seções do espaço */}
    <div className="fotos-lista-secoes-wrap" id="fotos-lista-secoes">
      <div className="fotos-placeholder-vazio" id="fotos-placeholder">
        <span>🏗️</span>
        <h3>Nenhuma seção criada ainda</h3>
        <p>
          Clique em <strong>"+ Nova seção"</strong> para começar a organizar as
          fotos por ambiente.
        </p>
      </div>
    </div>
  </div>
  {/* /fotos-aba-espaco */}
  {/* ═══ ABA: FOTOS DE EVENTOS ═══ */}
  <div className="fotos-aba" id="fotos-aba-evento">
    <div className="fotos-aviso-intro" style={{ background: "#1b3a5c" }}>
      <span className="fotos-aviso-intro-icon">🎉</span>
      <div className="fotos-aviso-intro-texto">
        <h4>Como o espaço fica decorado nos eventos</h4>
        <p>
          Mostre registros de eventos já realizados — casamentos, aniversários,
          corporativos. Isso inspira novos contratantes.
        </p>
      </div>
    </div>
    {/* Seções de evento */}
    <div className="fotos-lista-secoes-wrap" id="fotos-lista-secoes-evento">
      <div className="fotos-placeholder-vazio" id="fotos-placeholder-evento">
        <span>🎉</span>
        <h3>Nenhuma seção de evento ainda</h3>
        <p>
          Clique em <strong>"+ Nova seção"</strong> para adicionar fotos de
          eventos realizados.
        </p>
      </div>
    </div>
  </div>
  {/* /fotos-aba-evento */}
  {/* Rodapé sticky com botão salvar */}
  <div className="fotos-footer-acoes">
    <button
      className="fotos-btn-salvar fotos-btn-salvar"
      onClick={() => (window as any).fotosSalvarTudo()}
    >
      💾 Salvar alterações
    </button>
  </div>
</>

        </div>







        {/* ══════════════════════════════════
            PÁGINA: minhapropriedade
        ══════════════════════════════════ */}
        {/* pagina-minhapropriedade */}
        <div className="page-section" id="pagina-minhapropriedade">
          <>
  <header className="dash-header-fixo">
    <h2>🏡 Minha Propriedade</h2>
    <button
      className="prop-btn-visualizar"
      id="prop-btn-visualizar"
      onClick={() => (window as any).propVerAnuncio()}
      style={{ opacity: "0.5" }}
    >
      👁 Ver Anúncio Público
    </button>
  </header>
  {/* ABAS DE NAVEGAÇÃO */}
  <nav className="prop-sub-menu">
    <button
      className="prop-tab-link active"
      data-tab="contato"
      onClick={() => (window as any).propOpenTab(event,'contato')}
    >
      1. Contato
    </button>
    <button
      className="prop-tab-link"
      data-tab="sobre"
      onClick={() => (window as any).propOpenTab(event,'sobre')}
    >
      2. Sobre
    </button>
    <button
      className="prop-tab-link"
      data-tab="valores"
      onClick={() => (window as any).propOpenTab(event,'valores')}
    >
      3. Valores
    </button>
    <button
      className="prop-tab-link"
      data-tab="endereco"
      onClick={() => (window as any).propOpenTab(event,'endereco')}
    >
      4. Endereço
    </button>
    <button
      className="prop-tab-link"
      data-tab="eventos"
      onClick={() => (window as any).propOpenTab(event,'eventos')}
    >
      5. Eventos
    </button>
    <button
      className="prop-tab-link"
      data-tab="faq"
      onClick={() => (window as any).propOpenTab(event,'faq')}
    >
      6. FAQ
    </button>
    <button
      className="prop-tab-link"
      data-tab="servicos"
      onClick={() => (window as any).propOpenTab(event,'servicos')}
    >
      7. Serviços
    </button>
    <button
      className="prop-tab-link"
      data-tab="forca"
      onClick={() => (window as any).propOpenTab(event,'forca')}
    >
      ⚡ Força do Anúncio
    </button>
  </nav>
  <div className="prop-container-abas">
    {/* ══ ABA 1: CONTATO ══ */}
    <div id="prop-aba-contato" className="prop-tab-content active">
      <div className="prop-sessao-edit">
        <h3>Dados da Propriedade</h3>
        <p className="aviso-form">
          Essas informações serão exibidas no seu anúncio público.
        </p>
        <div className="grid-form">
          <div className="campo span-2">
            <label>Nome do Espaço</label>
            <input
              type="text"
              id="prop-nome-espaco"
              placeholder="Ex: Mansão das Palmeiras"
            />
          </div>
          <div className="campo span-2">
            <label>Tipo de Propriedade</label>
            <select id="prop-tipo-propriedade">
              <option value="">Selecione o tipo...</option>
              <option value="Sítio">🌿 Sítio</option>
              <option value="Chácara">🏡 Chácara</option>
              <option value="Salão de Festas">🎉 Salão de Festas</option>
              <option value="Fazenda">🐄 Fazenda</option>
              <option value="Casa de Campo">🏠 Casa de Campo</option>
              <option value="Mansão / Villa">🏛️ Mansão / Villa</option>
              <option value="Espaço Gourmet">🍷 Espaço Gourmet</option>
              <option value="Haras / Rancho">🐎 Haras / Rancho</option>
              <option value="Clube / Resort">🏊 Clube / Resort</option>
              <option value="Espaço Corporativo">💼 Espaço Corporativo</option>
              <option value="Espaço ao Ar Livre">🌳 Espaço ao Ar Livre</option>
              <option value="Outro">📍 Outro</option>
            </select>
          </div>
          <div className="campo">
            <label>Capacidade Máxima (pessoas)</label>
            <input
              type="number"
              id="prop-capacidade"
              placeholder="Ex: 200"
              min={1}
            />
          </div>
          <div className="campo">
            <label>E-mail de Contato</label>
            <input
              type="email"
              id="prop-email-contato"
              placeholder="contato@seuespaco.com.br"
            />
          </div>
          <div className="campo">
            <label>WhatsApp</label>
            <input
              type="tel"
              id="prop-whatsapp"
              placeholder="(21) 99999-0000"
            />
          </div>
          <div className="campo">
            <label>Telefone Fixo</label>
            <input type="tel" id="prop-telefone" placeholder="(21) 3333-0000" />
          </div>
          <div className="campo">
            <label>Instagram</label>
            <input type="text" id="prop-instagram" placeholder="@seuespaco" />
          </div>
          <div className="campo">
            <label>Facebook</label>
            <input
              type="text"
              id="prop-facebook"
              placeholder="facebook.com/seuespaco"
            />
          </div>
          <div className="campo">
            <label>TikTok</label>
            <input type="text" id="prop-tiktok" placeholder="@seuespaco" />
          </div>
          <div className="campo">
            <label>YouTube</label>
            <input
              type="text"
              id="prop-youtube"
              placeholder="youtube.com/@seuespaco"
            />
          </div>
          <div className="campo">
            <label>LinkedIn</label>
            <input
              type="text"
              id="prop-linkedin"
              placeholder="linkedin.com/in/seuespaco"
            />
          </div>
          <div className="campo">
            <label>Site Externo</label>
            <input
              type="text"
              id="prop-site"
              placeholder="www.seuespaco.com.br"
            />
          </div>
        </div>
      </div>
      <div className="prop-sessao-edit">
        <h3>Responsável pelo Atendimento</h3>
        <p className="aviso-form">
          Quem os clientes vão encontrar ao entrar em contato?
        </p>
        <div className="prop-atendimento-box">
          <div className="prop-foto-anfitriao">
            <div className="avatar-preview" id="prop-avatar-preview">
              😊
            </div>
            <button
              className="btn-trocar-foto"
              onClick={() => document.getElementById('prop-input-foto-resp')?.click()}
            >
              Trocar Foto
            </button>
            <input
              type="file"
              id="prop-input-foto-resp"
              accept="image/*"
              hidden
              onChange={(e: any) => (window as any).propPreviewFoto(e.target)}
            />
            <input type="hidden" id="prop-foto-resp-data" />
          </div>
          <div className="prop-info-anfitriao">
            <div className="campo">
              <label>Nome do Responsável</label>
              <input
                type="text"
                id="prop-nome-resp"
                placeholder="Ex: Rodrigo Ramos"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
    {/* ══ ABA 2: SOBRE ══ */}
    <div id="prop-aba-sobre" className="prop-tab-content">
      <div className="prop-sessao-edit">
        <h3>Descrição do Espaço</h3>
        <p className="aviso-form">
          ⚠️ Não inclua dados de contato aqui. Use conteúdo exclusivo e
          original.
        </p>
        <div className="campo">
          <label>Apresentação completa do espaço</label>
          <textarea
            id="prop-descricao"
            className="txt-descricao"
            placeholder="Apresente seu espaço, explique seus diferenciais..."
            defaultValue={""}
          />
        </div>
      </div>
    </div>
    {/* ══ ABA 3: VALORES ══ */}
    <div id="prop-aba-valores" className="prop-tab-content">
      <div className="prop-sessao-edit">
        <h3>Preços de Referência</h3>
        <p className="aviso-form">
          Valores orientativos exibidos no anúncio. Negociações pelo WhatsApp.
        </p>
        <div className="prop-preco-grid">
          <div className="campo">
            <label>Valor por Hora</label>
            <div className="prop-input-moeda">
              <span>R$</span>
              <input
                type="number"
                id="prop-valor-hora"
                placeholder="0,00"
                min={0}
              />
            </div>
          </div>
          <div className="campo">
            <label>Valor por Diária (dia completo)</label>
            <div className="prop-input-moeda">
              <span>R$</span>
              <input
                type="number"
                id="prop-valor-diaria"
                placeholder="0,00"
                min={0}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="prop-sessao-edit">
        <h3>Custos Extras (opcionais para o cliente)</h3>
        <p className="aviso-form">
          Serviços que o cliente pode contratar à parte.
        </p>
        <div
          id="prop-lista-custos-extras"
          className="prop-lista-custos-extras"
        />
        <button
          type="button"
          className="prop-btn-add-faq"
          onClick={() => (window as any).propAdicionarCusto()}
        >
          + Adicionar item
        </button>
      </div>
    </div>
    {/* ══ ABA 4: ENDEREÇO ══ */}
    <div id="prop-aba-endereco" className="prop-tab-content">
      <div className="prop-sessao-edit">
        <div className="prop-header-sessao">
          <h3>Localização do Espaço</h3>
          <p className="aviso-form">
            O endereço completo ajuda os clientes a traçarem a rota.
          </p>
        </div>
        <div className="prop-grid-endereco">
          <div className="campo-cep">
            <span className="campo-label">CEP</span>
            <input
              type="text"
              id="prop-cep"
              placeholder="00000-000"
              onBlur={() => (window as any).propBuscarCEP()}
            />
          </div>
          <div className="campo-largo">
            <span className="campo-label">Logradouro (Rua / Avenida)</span>
            <input type="text" id="prop-rua" placeholder="Ex: Rua das Flores" />
          </div>
          <div className="campo-curto">
            <span className="campo-label">Número</span>
            <input type="text" id="prop-numero" placeholder="123" />
          </div>
          <div className="campo-medio">
            <span className="campo-label">Complemento</span>
            <input
              type="text"
              id="prop-complemento"
              placeholder="Sala, Bloco..."
            />
          </div>
          <div className="campo-medio">
            <span className="campo-label">Bairro</span>
            <input type="text" id="prop-bairro" placeholder="Ex: Centro" />
          </div>
          <div className="campo-medio">
            <span className="campo-label">Cidade</span>
            <input type="text" id="prop-cidade" placeholder="Ex: São Paulo" />
          </div>
          <div style={{ gridColumn: "span 6" }}>
            <span className="campo-label">Estado</span>
            <input type="hidden" id="prop-uf" />
            <div className="prop-uf-grid" id="prop-uf-grid">
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="AC"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'AC')}
              >
                AC
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="AL"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'AL')}
              >
                AL
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="AP"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'AP')}
              >
                AP
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="AM"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'AM')}
              >
                AM
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="BA"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'BA')}
              >
                BA
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="CE"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'CE')}
              >
                CE
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="DF"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'DF')}
              >
                DF
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="ES"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'ES')}
              >
                ES
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="GO"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'GO')}
              >
                GO
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="MA"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'MA')}
              >
                MA
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="MT"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'MT')}
              >
                MT
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="MS"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'MS')}
              >
                MS
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="MG"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'MG')}
              >
                MG
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="PA"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'PA')}
              >
                PA
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="PB"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'PB')}
              >
                PB
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="PR"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'PR')}
              >
                PR
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="PE"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'PE')}
              >
                PE
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="PI"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'PI')}
              >
                PI
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="RJ"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'RJ')}
              >
                RJ
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="RN"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'RN')}
              >
                RN
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="RS"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'RS')}
              >
                RS
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="RO"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'RO')}
              >
                RO
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="RR"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'RR')}
              >
                RR
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="SC"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'SC')}
              >
                SC
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="SP"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'SP')}
              >
                SP
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="SE"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'SE')}
              >
                SE
              </button>
              <button
                type="button"
                className="prop-uf-btn"
                data-uf="TO"
                onClick={(e: any) => (window as any).propSelecionarUF(e.target,'TO')}
              >
                TO
              </button>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 20 }}>
          <button
            type="button"
            className="prop-btn-visualizar"
            style={{
              background: "#0d0d0d",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: "0.88rem"
            }}
            onClick={() => (window as any).propAtualizarMapa()}
          >
            📍 Atualizar Mapa
          </button>
          <div className="prop-mapa-container" style={{ marginTop: 14 }}>
            <div
              id="prop-mapa-msg"
              style={{
                fontSize: "0.85rem",
                color: "#aaa",
                padding: 14,
                textAlign: "center"
              }}
            >
              Preencha o endereço e clique em "Atualizar Mapa"
            </div>
            <div
              id="prop-mapa-leaflet"
              style={{
                display: "none",
                width: "100%",
                height: 280,
                borderRadius: 14,
                overflow: "hidden"
              }}
            />
          </div>
        </div>
      </div>
    </div>
    {/* ══ ABA 5: EVENTOS ══ */}
    <div id="prop-aba-eventos" className="prop-tab-content">
      <div className="prop-sessao-edit">
        <div className="prop-header-sessao">
          <h3>Quais eventos seu espaço recebe?</h3>
          <p className="aviso-form">
            Selecione todos os tipos de celebrações permitidos no seu local.
          </p>
        </div>
        <div className="prop-grid-eventos">
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="casamento"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">💍</span>
              <span className="prop-nome-evento">Casamentos</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="infantil"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🎈</span>
              <span className="prop-nome-evento">Festas Infantis</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="corporativo"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">💼</span>
              <span className="prop-nome-evento">Corporativos</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="aniversario"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🎂</span>
              <span className="prop-nome-evento">Aniversários</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="confraternizacao"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🥂</span>
              <span className="prop-nome-evento">Confraternizações</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="formatura"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🎓</span>
              <span className="prop-nome-evento">Formaturas</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="workshop"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🎤</span>
              <span className="prop-nome-evento">Workshops / Cursos</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="religioso"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🕊️</span>
              <span className="prop-nome-evento">Retiros / Religiosos</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="show"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🎸</span>
              <span className="prop-nome-evento">Shows / Festivais</span>
            </div>
          </label>
          <label className="prop-card-evento-check">
            <input
              type="checkbox"
              name="prop-tipo-evento"
              defaultValue="esportivo"
            />
            <div className="prop-conteudo-check">
              <span className="prop-icon-evento">🏆</span>
              <span className="prop-nome-evento">Esportivos</span>
            </div>
          </label>
        </div>
      </div>
    </div>
    {/* ══ ABA 6: FAQ ══ */}
    <div id="prop-aba-faq" className="prop-tab-content">
      <div className="prop-sessao-edit">
        <div className="prop-header-sessao">
          <h3>Perguntas Frequentes (FAQ)</h3>
          <p className="aviso-form">
            Ajude seus clientes respondendo às dúvidas mais comuns.
          </p>
        </div>
        <div id="prop-lista-faq" className="prop-lista-faq">
          <div className="prop-faq-item" data-fixo="true">
            <div className="prop-faq-inputs">
              <input
                type="text"
                defaultValue="Regras de Cobrança"
                readOnly
                style={{
                  background: "#f5f5f5",
                  color: "#555",
                  cursor: "default",
                  fontWeight: 600
                }}
              />
              <textarea
                id="prop-regras-preco"
                placeholder="Ex: Valor inclui 6 horas de uso. Mínimo de 4h..."
                style={{ minHeight: 100 }}
                defaultValue={""}
              />
            </div>
          </div>
        </div>
        <button className="prop-btn-adicionar-faq" onClick={() => (window as any).propAdicionarFAQ()}>
          + Adicionar Nova Pergunta
        </button>
      </div>
    </div>
    {/* ══ ABA 7: SERVIÇOS ══ */}
    <div id="prop-aba-servicos" className="prop-tab-content">
      <div className="prop-sessao-edit">
        <h3>Serviços e Amenidades Disponíveis</h3>
        <p className="aviso-form">Marque tudo que seu espaço oferece.</p>
        <div className="prop-amenidades-grid">
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="climatizado" />
            <span className="prop-amenidade-label">❄️ Climatizado</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="estacionamento" />
            <span className="prop-amenidade-label">🅿️ Estacionamento</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="seguranca" />
            <span className="prop-amenidade-label">🛡️ Segurança</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="espaco-aberto" />
            <span className="prop-amenidade-label">🌿 Espaço Aberto</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="cozinha" />
            <span className="prop-amenidade-label">🍽️ Cozinha Equipada</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="gerador" />
            <span className="prop-amenidade-label">⚡ Gerador</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="piscina" />
            <span className="prop-amenidade-label">🏊 Piscina</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="wifi" />
            <span className="prop-amenidade-label">📶 Wi-Fi</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="acessibilidade" />
            <span className="prop-amenidade-label">♿ Acessibilidade</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="hospedagem" />
            <span className="prop-amenidade-label">🛏️ Hospedagem</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="palco" />
            <span className="prop-amenidade-label">🎤 Palco / Som</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="decoracao" />
            <span className="prop-amenidade-label">🎀 Decoração</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="bar" />
            <span className="prop-amenidade-label">🍹 Bar / Chopeira</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="churrasqueira" />
            <span className="prop-amenidade-label">🔥 Churrasqueira</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="playground" />
            <span className="prop-amenidade-label">🛝 Playground</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="quadra" />
            <span className="prop-amenidade-label">⚽ Quadra Esportiva</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="camarim" />
            <span className="prop-amenidade-label">💄 Camarim</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="projetor" />
            <span className="prop-amenidade-label">📽️ Projetor / Telão</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="sauna" />
            <span className="prop-amenidade-label">🧖 Sauna</span>
          </label>
          <label className="prop-amenidade-check">
            <input type="checkbox" defaultValue="heliponto" />
            <span className="prop-amenidade-label">🚁 Heliponto</span>
          </label>
        </div>
      </div>
      <div className="prop-sessao-edit">
        <h3>Serviços Extras que Você Pode Oferecer</h3>
        <p className="aviso-form">
          Serviços adicionais disponíveis (pode ter custo extra).
        </p>
        <div className="prop-amenidades-grid">
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="buffet"
            />
            <span className="prop-amenidade-label">🍽️ Buffet Completo</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="garcom"
            />
            <span className="prop-amenidade-label">🤵 Garçons / Staff</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="seguranca-extra"
            />
            <span className="prop-amenidade-label">🛡️ Equipe de Segurança</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="bar-open"
            />
            <span className="prop-amenidade-label">🍹 Bar Open Bar</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="mesa-cadeira"
            />
            <span className="prop-amenidade-label">🪑 Mesas/Cadeiras</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="decoracao-extra"
            />
            <span className="prop-amenidade-label">🎀 Decoração Completa</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="floricultura"
            />
            <span className="prop-amenidade-label">💐 Floricultura</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="dj"
            />
            <span className="prop-amenidade-label">🎧 DJ / Sonorização</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="foto-video"
            />
            <span className="prop-amenidade-label">📸 Foto e Vídeo</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="cerimonialista"
            />
            <span className="prop-amenidade-label">📋 Cerimonialista</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="valet"
            />
            <span className="prop-amenidade-label">🚗 Valet</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="limpeza"
            />
            <span className="prop-amenidade-label">🧹 Limpeza Pós-Evento</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="iluminacao"
            />
            <span className="prop-amenidade-label">💡 Iluminação Especial</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="locacao-tendas"
            />
            <span className="prop-amenidade-label">⛺ Tendas</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="transporte"
            />
            <span className="prop-amenidade-label">🚌 Transfer</span>
          </label>
          <label className="prop-amenidade-check">
            <input
              type="checkbox"
              className="prop-svc-extra"
              defaultValue="hospedagem-extra"
            />
            <span className="prop-amenidade-label">
              🛏️ Hospedagem de Convidados
            </span>
          </label>
        </div>
      </div>
    </div>
    {/* ══ ABA 8: FORÇA DO ANÚNCIO ══ */}
    <div id="prop-aba-forca" className="prop-tab-content">
      <div className="prop-termometro-card" id="prop-termometro-card">
        <div className="prop-termometro-header">
          <div className="prop-termometro-titulo">🌡️ Força do seu anúncio</div>
          <div
            className="prop-termometro-pct"
            id="prop-termo-pct"
            style={{ color: "#ff385c" }}
          >
            —
          </div>
        </div>
        <div className="prop-termometro-bar-wrap">
          <div
            className="prop-termometro-bar-fill"
            id="prop-termo-bar"
            style={{ width: "0%" }}
          />
        </div>
        <div className="prop-termometro-msg" id="prop-termo-msg">
          Calculando...
        </div>
        <div className="prop-termometro-itens" id="prop-termo-itens" />
      </div>
    </div>
  </div>
  {/* /prop-container-abas */}
  {/* FOOTER AÇÕES (sticky) */}
  <div className="prop-footer-acoes">
    <button className="prop-btn-cancelar" onClick={() => (window as any).navegar('dashboard')}>
      Cancelar
    </button>
    <button className="prop-btn-salvar" onClick={() => (window as any).propSalvar()}>
      💾 Salvar Alterações
    </button>
  </div>
</>

        </div>










        {/* ══════════════════════════════════
            PÁGINA: leads
        ══════════════════════════════════ */}
        {/* pagina-leads */}
        <div className="page-section" id="pagina-leads">
          <>
  <div className="dash-header-fixo">
    <div>
      <h2>🎉 Clientes &amp; Eventos</h2>
      <p>
        Gerencie todos os seus contatos, negociações e eventos em um só lugar.
      </p>
    </div>
    <div className="header-acoes">
      <button className="btn-outline" onClick={() => (window as any).leadsExportarExcel()}>
        📊 Excel
      </button>
      <button className="btn-outline" onClick={() => (window as any).leadsExportarPDF()}>
        📄 PDF
      </button>
      <button className="btn-primary" onClick={() => (window as any).leadsAbrirModalNovo()}>
        ＋ Novo Cliente
      </button>
    </div>
  </div>
  {/* KPIs */}
  <div className="grid-kpis">
    <div className="card-kpi">
      <div className="kpi-icone verde">🎉</div>
      <div className="kpi-label">Total</div>
      <div className="kpi-valor" id="leads-kpi-total">
        —
      </div>
      <div className="kpi-sub">clientes cadastrados</div>
    </div>
    <div className="card-kpi">
      <div className="kpi-icone amarelo">🔥</div>
      <div className="kpi-label">Em Negociação</div>
      <div className="kpi-valor" id="leads-kpi-negociando">
        —
      </div>
      <div className="kpi-sub">ativos no funil</div>
    </div>
    <div className="card-kpi">
      <div className="kpi-icone azul">✅</div>
      <div className="kpi-label">Contratados</div>
      <div className="kpi-valor" id="leads-kpi-contratados">
        —
      </div>
      <div className="kpi-sub">eventos confirmados</div>
    </div>
    <div className="card-kpi">
      <div className="kpi-icone verde">🎊</div>
      <div className="kpi-label">Finalizados</div>
      <div className="kpi-valor" id="leads-kpi-finalizados">
        —
      </div>
      <div className="kpi-sub">eventos realizados</div>
    </div>
    <div className="card-kpi">
      <div className="kpi-icone rosa">❌</div>
      <div className="kpi-label">Perdidos</div>
      <div className="kpi-valor" id="leads-kpi-perdidos">
        —
      </div>
      <div className="kpi-sub">negociações encerradas</div>
    </div>
  </div>
  {/* Tabela */}
  <div className="tabela-wrapper">
    <div className="tabela-toolbar">
      <div className="tabela-toolbar-left">
        <span className="tabela-titulo">Lista de Clientes e Eventos</span>
        <span className="tabela-count" id="leads-tabela-count">
          0 clientes
        </span>
        <select
          className="select-filtro"
          id="leads-filtro-status"
          onChange={() => (window as any).leadsAplicarFiltros()}
        >
          <option value="">Todos os status</option>
          <option value="lead">Lead / Novo Contato</option>
          <option value="consultada">Data Consultada</option>
          <option value="visita">Visita Agendada</option>
          <option value="negociacao">Em Negociação</option>
          <option value="reserva">Reserva Temporária</option>
          <option value="contratado">Contrato Assinado</option>
          <option value="briefing">Montando Briefing</option>
          <option value="pronto">Pronto para Execução</option>
          <option value="montagem">Em Montagem</option>
          <option value="finalizado">Evento Concluído</option>
          <option value="pos">Pós-Evento / Feedback</option>
          <option value="perdido">Perdido</option>
          <option value="recontactar">Recontactar</option>
        </select>
        <select
          className="select-filtro"
          id="leads-filtro-tipo"
          onChange={() => (window as any).leadsAplicarFiltros()}
        >
          <option value="">Todos os tipos</option>
          <option value="Casamento">Casamento</option>
          <option value="Aniversário">Aniversário</option>
          <option value="Corporativo">Corporativo</option>
          <option value="Formatura">Formatura</option>
          <option value="Batizado">Batizado</option>
          <option value="Outro">Outro</option>
        </select>
        <input
          type="text"
          className="input-busca"
          id="leads-input-busca"
          placeholder="Buscar por nome..."
          onInput={() => (window as any).leadsAplicarFiltros()}
        />
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span style={{ fontSize: "0.78rem", color: "#aaa" }}>Por página:</span>
        <select
          className="select-filtro"
          id="leads-por-pagina"
          onChange={() => (window as any).leadsMudarPorPagina()}
        >
          <option value={10}>10</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
      </div>
    </div>
    <div className="tabela-scroll">
      <table>
        <thead>
          <tr>
            <th className="td-seta" />
            <th className="leads-th" onClick={() => (window as any).leadsOrdenarPor('nome_evento')}>
              Nome do Evento{" "}
              <span className="leads-sort-icon" id="leads-sort-nome_evento">
                ↕
              </span>
            </th>
            <th
              className="leads-th"
              onClick={() => (window as any).leadsOrdenarPor('quem_contratou')}
            >
              Quem Contratou{" "}
              <span className="leads-sort-icon" id="leads-sort-quem_contratou">
                ↕
              </span>
            </th>
            <th className="leads-th" onClick={() => (window as any).leadsOrdenarPor('data_inicio')}>
              Data do Evento{" "}
              <span className="leads-sort-icon" id="leads-sort-data_inicio">
                ↕
              </span>
            </th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody id="leads-tabela-body" />
      </table>
    </div>
    <div
      id="leads-estado-vazio"
      className="estado-vazio"
      style={{ display: "none" }}
    >
      <div className="icone-vazio">🎉</div>
      <p>Nenhum cliente encontrado. Que tal adicionar o primeiro?</p>
    </div>
    <div className="paginacao" id="leads-paginacao" style={{ display: "none" }}>
      <span className="paginacao-info" id="leads-paginacao-info" />
      <div className="paginacao-btns" id="leads-paginacao-btns" />
    </div>
  </div>
  {/* /pagina-leads */}
  {/* MODAL: Atualizar Status */}
  <div className="modal-overlay" id="leads-modal-status">
    <div className="modal-box">
      <button className="btn-fechar-modal" onClick={() => (window as any).leadsFecharModalStatus()}>
        ✕
      </button>
      <h3>Atualizar Status</h3>
      <p className="modal-sub" id="leads-modal-status-nome">
        —
      </p>
      <div className="lista-status">
        <div className="status-grupo-label">🔍 Funil de Vendas</div>
        <div
          className="opcao-status"
          data-status="lead"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#f59e0b" }} />
          <div>
            <div className="label-status">Lead / Novo Contato</div>
            <div className="desc-status">
              Cliente acabou de chegar, ainda sem qualificação
            </div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="consultada"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#3b82f6" }} />
          <div>
            <div className="label-status">Data Consultada</div>
            <div className="desc-status">
              Verificou disponibilidade, orçamento enviado
            </div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="visita"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#8b5cf6" }} />
          <div>
            <div className="label-status">Visita Agendada</div>
            <div className="desc-status">
              Cliente vai conhecer o espaço pessoalmente
            </div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="negociacao"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#ec4899" }} />
          <div>
            <div className="label-status">Em Negociação</div>
            <div className="desc-status">
              Ajustando valores, serviços ou pagamento
            </div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="reserva"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#f97316" }} />
          <div>
            <div className="label-status">Reserva Temporária</div>
            <div className="desc-status">Data "segurada" por 24–48h</div>
          </div>
        </div>
        <div className="status-grupo-label">📋 Gestão do Evento</div>
        <div
          className="opcao-status"
          data-status="contratado"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#10b981" }} />
          <div>
            <div className="label-status">Contrato Assinado</div>
            <div className="desc-status">Sinal pago, compromisso firmado</div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="briefing"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#0ea5e9" }} />
          <div>
            <div className="label-status">Montando Briefing</div>
            <div className="desc-status">Coletando detalhes do evento</div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="pronto"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#14b8a6" }} />
          <div>
            <div className="label-status">Pronto para Execução</div>
            <div className="desc-status">
              Briefing fechado, fornecedores alinhados
            </div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="montagem"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#f97316" }} />
          <div>
            <div className="label-status">Em Montagem</div>
            <div className="desc-status">Equipe já está no local</div>
          </div>
        </div>
        <div className="status-grupo-label">🏁 Finalização</div>
        <div
          className="opcao-status"
          data-status="finalizado"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#1ebc54" }} />
          <div>
            <div className="label-status">Evento Concluído</div>
            <div className="desc-status">A festa aconteceu com sucesso</div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="pos"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#22c55e" }} />
          <div>
            <div className="label-status">Pós-Evento / Feedback</div>
            <div className="desc-status">Enviando pesquisa de satisfação</div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="perdido"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#ef4444" }} />
          <div>
            <div className="label-status">Perdido</div>
            <div className="desc-status">
              Negociação encerrada sem conversão
            </div>
          </div>
        </div>
        <div
          className="opcao-status"
          data-status="recontactar"
          onClick={(e: any) => (window as any).leadsSelecionarStatus(e.target)}
        >
          <div className="dot" style={{ background: "#6b7280" }} />
          <div>
            <div className="label-status">Recontactar</div>
            <div className="desc-status">
              Follow-up pendente ou evento recorrente
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  {/* MODAL: Novo Cliente */}
  <div className="modal-overlay" id="leads-modal-novo">
    <div className="modal-box modal-novo">
      <button className="btn-fechar-modal" onClick={() => (window as any).leadsFecharModalNovo()}>
        ✕
      </button>
      <h3>➕ Novo Cliente / Evento</h3>
      <p className="modal-sub">Preencha os dados básicos para começar</p>
      <div className="campo-grupo">
        <label className="campo-label">Nome do Evento *</label>
        <input
          type="text"
          className="campo-input"
          id="leads-novo-nome-evento"
          placeholder="Ex: Casamento Ana & Pedro"
        />
      </div>
      <div className="campo-grupo">
        <label className="campo-label">Quem Contratou *</label>
        <input
          type="text"
          className="campo-input"
          id="leads-novo-quem-contratou"
          placeholder="Nome completo do contratante"
        />
      </div>
      <div className="campo-grupo">
        <label className="campo-label">Tipo de Evento</label>
        <select className="campo-input" id="leads-novo-tipo">
          <option value="">Selecionar...</option>
          <option value="Casamento">💒 Casamento</option>
          <option value="Aniversário">🎂 Aniversário</option>
          <option value="Corporativo">💼 Corporativo</option>
          <option value="Formatura">🎓 Formatura</option>
          <option value="Batizado">👶 Batizado</option>
          <option value="Outro">📌 Outro</option>
        </select>
      </div>
      <div className="campo-grupo">
        <label className="campo-label">Status Inicial</label>
        <select className="campo-input" id="leads-novo-status">
          <option value="lead">Lead / Novo Contato</option>
          <option value="consultada">Data Consultada</option>
          <option value="negociacao">Em Negociação</option>
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
        <button
          className="btn-outline"
          style={{ flex: 1 }}
          onClick={() => (window as any).leadsFecharModalNovo()}
        >
          Cancelar
        </button>
        <button
          className="btn-primary"
          style={{ flex: 1, justifyContent: "center" }}
          onClick={() => (window as any).leadsCriarCliente()}
        >
          Criar Cliente
        </button>
      </div>
    </div>
  </div>
</>

        </div>











        {/* ══════════════════════════════════
            PÁGINA: planos
        ══════════════════════════════════ */}
        {/* pagina-planos */}
        <div className="page-section" id="pagina-planos">
          <>
  <div className="dash-header-fixo">
    <h2>💳 Assinaturas e Planos</h2>
    <p>Selecione o plano ideal, escolha a duração e finalize com segurança.</p>
  </div>
  {/* BANNER PLANO ATIVO */}
  <div className="banner-plano-ativo" id="planos-banner-ativo">
    <div className="banner-plano-esq">
      <span className="banner-plano-icone" id="planos-banner-icone">
        ⭐
      </span>
      <div className="banner-plano-info">
        <h4 id="planos-banner-titulo">Seu plano atual</h4>
        <p id="planos-banner-desc">Carregando informações...</p>
      </div>
    </div>
    <div className="banner-badges">
      <span className="badge-ativo">● Ativo</span>
      <span className="badge-validade" id="planos-banner-validade">
        Válido até —
      </span>
      <span
        className="badge-downgrade-pendente"
        id="planos-badge-downgrade"
        style={{ display: "none" }}
      >
        ⏳ Downgrade agendado
      </span>
    </div>
  </div>
  {/* GRID DE PLANOS */}
  <div className="container-planos" id="planos-container">
    {/* Gerado via JS */}
  </div>
  {/* CHECKOUT INLINE */}
  <div
    className="checkout-inline"
    id="planos-checkout-inline"
    style={{ display: "none" }}
  >
    <div className="checkout-inline-header">
      <h3 id="planos-checkout-titulo">🛒 Finalizar Assinatura</h3>
      <button className="btn-fechar-checkout" onClick={() => (window as any).planosFecharCheckout()}>
        ✕
      </button>
    </div>
    <div className="checkout-body">
      {/* COLUNA ESQUERDA: RESUMO + DURAÇÃO + CUPOM */}
      <div className="col-resumo">
        <h4>Resumo do Pedido</h4>
        <div className="resumo-plano-box">
          <div className="resumo-plano-nome" id="planos-resumo-nome">
            —
          </div>
          <div className="resumo-plano-preco" id="planos-resumo-preco">
            R$ —
          </div>
          <div className="resumo-plano-desc" id="planos-resumo-desc">
            —
          </div>
        </div>
        {/* Duração */}
        <div className="duracao-label">⏱ Duração da assinatura:</div>
        <div className="duracao-opcoes">
          <button
            className="planos-duracao-btn ativo"
            data-meses={1}
            onClick={() => (window as any).planosSelecionarDuracao(1)}
          >
            1 mês
          </button>
          <button
            className="planos-duracao-btn"
            data-meses={3}
            onClick={() => (window as any).planosSelecionarDuracao(3)}
          >
            3 meses
          </button>
          <button
            className="planos-duracao-btn"
            data-meses={6}
            onClick={() => (window as any).planosSelecionarDuracao(6)}
          >
            6 meses
          </button>
          <button
            className="planos-duracao-btn"
            data-meses={12}
            onClick={() => (window as any).planosSelecionarDuracao(12)}
          >
            12 meses <span className="duracao-badge-anual">−20%</span>
          </button>
        </div>
        {/* Cupom */}
        <div className="duracao-label">🎟 Cupom de desconto:</div>
        <div className="cupom-row">
          <input
            type="text"
            className="input-cupom"
            id="planos-input-cupom"
            placeholder="CODIGO123"
            maxLength={30}
            onInput={(e: any) => { e.target.value = e.target.value.toUpperCase() }}
          />
          <button
            className="btn-aplicar-cupom"
            id="planos-btn-aplicar-cupom"
            onClick={() => (window as any).planosAplicarCupom()}
          >
            Aplicar
          </button>
        </div>
        <div
          className="cupom-feedback"
          id="planos-cupom-feedback"
          style={{ display: "none" }}
        />
        {/* Valores */}
        <div className="resumo-linha">
          <span>Subtotal</span>
          <span id="planos-val-subtotal">—</span>
        </div>
        <div
          className="resumo-linha"
          id="planos-linha-desconto-anual"
          style={{ display: "none" }}
        >
          <span>🎉 Desconto anual (20%)</span>
          <span
            className="desconto"
            style={{ color: "#1ebc54" }}
            id="planos-val-desconto-anual"
          >
            —
          </span>
        </div>
        <div
          className="resumo-linha credito"
          id="planos-linha-credito"
          style={{ display: "none" }}
        >
          <span>💚 Crédito do plano atual</span>
          <span id="planos-val-credito">—</span>
        </div>
        <div
          className="resumo-linha desconto"
          id="planos-linha-desconto-cupom"
          style={{ display: "none" }}
        >
          <span id="planos-label-desconto-cupom">🎟 Desconto (cupom)</span>
          <span style={{ color: "#1ebc54" }} id="planos-val-desconto-cupom">
            —
          </span>
        </div>
        <div className="resumo-total">
          <span>Total a pagar:</span>
          <strong id="planos-resumo-total">R$ —</strong>
        </div>
        <ul className="check-lista-resumo">
          <li>✅ Acesso imediato após confirmação</li>
          <li>✅ Sem taxa de cancelamento antecipado</li>
          <li>✅ Suporte durante toda a assinatura</li>
          <li>✅ Nota fiscal emitida automaticamente</li>
        </ul>
      </div>
      {/* COLUNA DIREITA: PAGAMENTO + NF-E + TERMOS */}
      <div className="col-pagamento">
        <h4>Forma de Pagamento</h4>
        <div className="metodos-pagamento">
          <label className="metodo-item">
            <input
              type="radio"
              name="planos-pagamento"
              defaultValue="pix"
              defaultChecked
              onChange={() => (window as any).planosTrocarMetodo('pix')}
            />
            <div className="metodo-box">
              ⚡ Pix
              <br />
              <small style={{ fontSize: "0.7rem", fontWeight: 400 }}>
                Aprovação imediata
              </small>
            </div>
          </label>
          <label className="metodo-item">
            <input
              type="radio"
              name="planos-pagamento"
              defaultValue="cartao"
              onChange={() => (window as any).planosTrocarMetodo('cartao')}
            />
            <div className="metodo-box">
              💳 Cartão
              <br />
              <small style={{ fontSize: "0.7rem", fontWeight: 400 }}>
                Crédito ou débito
              </small>
            </div>
          </label>
          <label className="metodo-item">
            <input
              type="radio"
              name="planos-pagamento"
              defaultValue="boleto"
              onChange={() => (window as any).planosTrocarMetodo('boleto')}
            />
            <div className="metodo-box">
              📄 Boleto
              <br />
              <small style={{ fontSize: "0.7rem", fontWeight: 400 }}>
                Vence em 3 dias
              </small>
            </div>
          </label>
        </div>
        {/* Área Pix */}
        <div className="area-pagamento" id="planos-area-pix">
          <div className="pix-instrucao">
            <div className="pix-ico">⚡</div>
            <strong>Pagamento por Pix</strong>
            <p>
              Ao confirmar, um QR Code será gerado para você escanear.
              <br />
              Aprovação em até <strong>1 minuto</strong>.
            </p>
          </div>
        </div>
        {/* Área Cartão */}
        <div
          className="area-pagamento"
          id="planos-area-cartao"
          style={{ display: "none" }}
        >
          <div id="planos-form-cartao-mp">
            <input
              type="text"
              className="input-checkout"
              id="planos-cartao-numero"
              placeholder="Número do Cartão"
              maxLength={19}
              onInput={(e: any) => (window as any).planosMascaraCartao(e.target)}
            />
            <div className="input-duplo">
              <input
                type="text"
                className="input-checkout"
                id="planos-cartao-validade"
                placeholder="Validade (MM/AA)"
                maxLength={5}
                onInput={(e: any) => (window as any).planosMascaraValidade(e.target)}
              />
              <input
                type="text"
                className="input-checkout"
                id="planos-cartao-cvv"
                placeholder="CVV"
                maxLength={4}
              />
            </div>
            <input
              type="text"
              className="input-checkout"
              id="planos-cartao-nome"
              placeholder="Nome igual ao cartão"
            />
            <select className="select-checkout" id="planos-cartao-parcelas">
              <option value={1}>1x sem juros</option>
            </select>
            <input
              type="text"
              className="input-checkout"
              id="planos-cartao-cpf"
              placeholder="CPF ou CNPJ do titular"
              maxLength={18}
              onInput={(e: any) => (window as any).planosMascaraCPFCNPJ(e.target)}
            />
          </div>
          <p
            style={{
              fontSize: "0.72rem",
              color: "#aaa",
              marginTop: 6,
              textAlign: "center"
            }}
          >
            🔒 Dados criptografados pelo SDK do Mercado Pago
          </p>
        </div>
        {/* Área Boleto */}
        <div
          className="area-pagamento"
          id="planos-area-boleto"
          style={{ display: "none" }}
        >
          <input
            type="text"
            className="input-checkout"
            id="planos-boleto-cpf"
            placeholder="CPF ou CNPJ do pagador"
            maxLength={18}
            onInput={(e: any) => (window as any).planosMascaraCPFCNPJ(e.target)}
          />
        </div>
        {/* NF-e */}
        <div className="nfe-toggle" onClick={() => (window as any).planosToggleNFe()}>
          <span id="planos-nfe-seta">▶</span> 📋 Inserir dados para Nota Fiscal
          (NF-e) — opcional
        </div>
        <div className="nfe-area" id="planos-nfe-area">
          <label className="form-label">CPF ou CNPJ</label>
          <input
            type="text"
            className="input-checkout"
            id="planos-nfe-cpfcnpj"
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
            maxLength={18}
            onInput={(e: any) => (window as any).planosMascaraCPFCNPJ(e.target)}
          />
          <label className="form-label">Nome / Razão Social</label>
          <input
            type="text"
            className="input-checkout"
            id="planos-nfe-nome"
            placeholder="Nome completo ou razão social"
          />
          <label className="form-label">E-mail para recebimento da NF</label>
          <input
            type="email"
            className="input-checkout"
            id="planos-nfe-email"
            placeholder="seu@email.com"
          />
          <div className="nfe-row">
            <div style={{ flex: 2 }}>
              <label className="form-label">Endereço</label>
              <input
                type="text"
                className="input-checkout"
                id="planos-nfe-endereco"
                placeholder="Rua, número"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">CEP</label>
              <input
                type="text"
                className="input-checkout"
                id="planos-nfe-cep"
                placeholder="00000-000"
                maxLength={9}
                onInput={(e: any) => (window as any).planosMascaraCEP(e.target)}
              />
            </div>
          </div>
          <div className="nfe-row">
            <div style={{ flex: 2 }}>
              <label className="form-label">Cidade</label>
              <input
                type="text"
                className="input-checkout"
                id="planos-nfe-cidade"
                placeholder="Cidade"
              />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label">Estado</label>
              <select className="select-checkout" id="planos-nfe-estado">
                <option value="">UF</option>
                <option>AC</option>
                <option>AL</option>
                <option>AP</option>
                <option>AM</option>
                <option>BA</option>
                <option>CE</option>
                <option>DF</option>
                <option>ES</option>
                <option>GO</option>
                <option>MA</option>
                <option>MT</option>
                <option>MS</option>
                <option>MG</option>
                <option>PA</option>
                <option>PB</option>
                <option>PR</option>
                <option>PE</option>
                <option>PI</option>
                <option>RJ</option>
                <option>RN</option>
                <option>RS</option>
                <option>RO</option>
                <option>RR</option>
                <option>SC</option>
                <option>SP</option>
                <option>SE</option>
                <option>TO</option>
              </select>
            </div>
          </div>
        </div>
        {/* Política */}
        <div className="politica-cancelamento">
          ⚠️ <strong>Política de Cancelamento:</strong> Você pode cancelar sua
          assinatura a qualquer momento. Não há reembolso proporcional do
          período já pago. Planos anuais não permitem cancelamento parcial com
          estorno.
        </div>
        {/* Termos */}
        <div className="termos-box">
          <label className="termos-check-row">
            <input
              type="checkbox"
              id="planos-check-termos"
              onChange={() => (window as any).planosValidarBtnFinalizar()}
            />
            <span>
              Li e aceito os{" "}
              <a href="../termos.html" target="_blank">
                Termos de Uso
              </a>{" "}
              e a{" "}
              <a href="../privacidade.html" target="_blank">
                Política de Privacidade
              </a>{" "}
              da VENTSY.
            </span>
          </label>
        </div>
        {/* Selos */}
        <div className="selos-seguranca">
          <div className="selo">🔒 SSL Criptografado</div>
          <div className="selo">💳 Mercado Pago</div>
          <div className="selo">🛡️ Ambiente Seguro</div>
        </div>
        <button
          className="btn-finalizar"
          id="planos-btn-finalizar"
          disabled
          onClick={() => (window as any).planosFinalizarCompra()}
        >
          ✅ Confirmar e Finalizar Pagamento
        </button>
        <p className="seguranca-aviso">
          🔒 Pagamento processado com segurança pelo Mercado Pago
        </p>
      </div>
    </div>
  </div>
  <div className="faq-assinatura">
    <p>
      Precisa de um plano personalizado para redes de espaços?{" "}
      <a href="../fale-conosco.html">Fale com nosso consultor.</a>
    </p>
  </div>
  {/* /pagina-planos */}
  {/* MODAL: Downgrade */}
  <div className="modal-overlay" id="planos-modal-downgrade">
    <div className="downgrade-box">
      <button
        className="btn-fechar-modal"
        onClick={() => (window as any).planosFecharModal('planos-modal-downgrade')}
      >
        ✕
      </button>
      <h3>⬇️ Confirmar Downgrade</h3>
      <p>
        Você está prestes a fazer o downgrade para o plano{" "}
        <strong id="planos-downgrade-nome-destino">—</strong>.
      </p>
      <div className="aviso-downgrade">
        <strong>⚠️ Leia com atenção antes de confirmar:</strong>
        Seu plano atual (<span id="planos-downgrade-nome-atual">—</span>)
        continuará <strong>ativo até o fim do período já pago</strong> em{" "}
        <strong id="planos-downgrade-data-fim">—</strong>. Após essa data, o
        plano será alterado automaticamente.
        <br />
        <br />
        <strong>Não há reembolso</strong> do valor já pago no plano atual.
      </div>
      <div className="confirma-digitacao">
        <label>
          Para confirmar, digite <strong>CONFIRMAR</strong> abaixo:
        </label>
        <input
          type="text"
          id="planos-input-confirma-downgrade"
          placeholder="Digite CONFIRMAR"
          onInput={(e: any) => (window as any).planosValidarDowngrade(e.target.value)}
        />
      </div>
      <div className="modal-acoes">
        <button
          className="btn-cancelar-modal"
          onClick={() => (window as any).planosFecharModal('planos-modal-downgrade')}
        >
          Cancelar
        </button>
        <button
          className="btn-confirmar-downgrade"
          id="planos-btn-ok-downgrade"
          disabled
          onClick={() => (window as any).planosExecutarDowngrade()}
        >
          Confirmar downgrade
        </button>
      </div>
    </div>
  </div>
  {/* MODAL: Resultado do pagamento */}
  <div className="modal-pagamento-overlay" id="planos-modal-pagamento">
    <div className="modal-pagamento-box" id="planos-modal-pagamento-conteudo">
      {/* preenchido via JS */}
    </div>
  </div>
</>

        </div>














        {/* ══════════════════════════════════
            PÁGINA: relatorio
        ══════════════════════════════════ */}
        {/* pagina-relatorio */}
        <div className="page-section" id="pagina-relatorio">
          <>
  {/* HEADER + PERÍODO */}
  <div className="dash-header-fixo">
    <div>
      <h2>📊 Relatório de Desempenho</h2>
      <p id="rel-sub-periodo">
        Análise detalhada do seu espaço na plataforma VENTSY.
      </p>
    </div>
    <div className="controles-periodo">
      <div className="filtro-periodo">
        <button
          className="rel-btn-periodo btn-periodo"
          onClick={(e: any) => (window as any).relSetPeriodo('semana', e.target)}
        >
          Semana
        </button>
        <button
          className="rel-btn-periodo btn-periodo ativo"
          id="rel-btn-mes"
          onClick={(e: any) => (window as any).relSetPeriodo('mes', e.target)}
        >
          Mês
        </button>
        <button
          className="rel-btn-periodo btn-periodo"
          onClick={(e: any) => (window as any).relSetPeriodo('ano', e.target)}
        >
          Ano
        </button>
        <button
          className="rel-btn-periodo btn-periodo"
          onClick={(e: any) => (window as any).relSetPeriodo('personalizado', e.target)}
        >
          📅 Período
        </button>
      </div>
      <div
        className="range-personalizado"
        id="rel-range-personalizado"
        style={{ display: "none" }}
      >
        <input
          type="date"
          id="rel-data-inicio"
          onChange={() => (window as any).relAplicarPersonalizado()}
        />
        <span>até</span>
        <input
          type="date"
          id="rel-data-fim"
          onChange={() => (window as any).relAplicarPersonalizado()}
        />
      </div>
    </div>
  </div>
  {/* SELETOR DE MÉTRICA */}
  <div className="seletor-metricas" id="rel-seletor-metricas" />
  {/* GRÁFICO FULL WIDTH */}
  <div className="card-grafico-full">
    <div className="card-header">
      <h3 id="rel-titulo-grafico">Visualizações</h3>
      <span id="rel-label-periodo-grafico">Últimos 30 dias</span>
    </div>
    <div className="grafico-wrapper-full">
      <canvas id="rel-grafico" />
    </div>
  </div>
  {/* TABELA DE MÉTRICAS */}
  <div className="card-tabela">
    <h3>📋 Todas as Métricas do Período</h3>
    <table className="tabela-metricas">
      <thead>
        <tr>
          <th>Métrica</th>
          <th style={{ textAlign: "right" }}>Total</th>
          <th style={{ textAlign: "right" }}>Média/dia</th>
          <th style={{ minWidth: 120 }} />
        </tr>
      </thead>
      <tbody id="rel-tbody-metricas" />
    </table>
  </div>
  {/* RANKING + BUSCAS POPULARES */}
  <div className="linha-inferior">
    <div className="card-ranking">
      <h3>🏆 Seu Ranking</h3>
      <div id="rel-ranking-content">
        <div className="ranking-sem-dados">
          <p style={{ color: "#666" }}>Carregando...</p>
        </div>
      </div>
    </div>
    <div className="card-tendencias">
      <h3>🔥 Buscas populares na VENTSY</h3>
      <div id="rel-tendencias-content">
        <p style={{ color: "#bbb", fontSize: "0.85rem" }}>Carregando...</p>
      </div>
    </div>
  </div>
</>

        </div>













        {/* ══════════════════════════════════
            PÁGINA: indique
        ══════════════════════════════════ */}
        {/* pagina-indique */}
        <div className="page-section" id="pagina-indique">
          <>
  <div className="dash-header-fixo">
    <h2>🎁 Programa de Indicação</h2>
    <p>Indique espaços, ganhe benefícios exclusivos na sua assinatura.</p>
  </div>
  {/* CARD SEU CÓDIGO */}
  <div className="indique-card-codigo">
    <div className="indique-card-codigo-esq">
      <div className="indique-codigo-icone-wrap">🎟️</div>
      <div className="indique-codigo-texto">
        <label>Seu código de indicação</label>
        <div className="indique-codigo-valor">
          <span id="indique-codigo-valor">——————</span>
          <button
            className="indique-btn-copiar-codigo"
            id="indique-btn-copiar-codigo"
            onClick={() => (window as any).indiqueCopiarCodigo()}
          >
            📋 Copiar
          </button>
        </div>
      </div>
    </div>
    <p className="indique-codigo-dica">
      Passe este código para quem você quer indicar.
      <br />
      <strong>
        Funciona tanto pelo link quanto digitando na hora do cadastro.
      </strong>
    </p>
  </div>
  {/* CARD HERO */}
  <div className="indique-card-hero">
    <div className="indique-badge-promo">PROGRAMA DE PARCEIROS</div>
    <h3>
      Indique um espaço e ganhe
      <br />
      <em>1 mês grátis</em>
    </h3>
    <p>
      Quando o indicado publicar uma propriedade e realizar a{" "}
      <strong>primeira compra de um plano</strong>, você recebe automaticamente{" "}
      <strong>1 mês gratuito</strong> na sua assinatura.
    </p>
    <div className="indique-caixa-link">
      <label>Seu link de convite único</label>
      <div className="indique-input-copiar-grupo">
        <input
          type="text"
          id="indique-link-ref"
          defaultValue="ventsy.com/anunciar?ref=..."
          readOnly
        />
        <button
          className="indique-btn-copiar"
          id="indique-btn-copiar"
          onClick={() => (window as any).indiqueCopiarLink()}
        >
          📋 Copiar
        </button>
      </div>
    </div>
    <div className="indique-botoes-share">
      <button
        className="indique-share-btn indique-share-whatsapp"
        onClick={() => (window as any).indiqueEnviarWhats()}
      >
        📱 Enviar pelo WhatsApp
      </button>
      <button
        className="indique-share-btn indique-share-email"
        onClick={() => (window as any).indiqueEnviarEmail()}
      >
        📧 Enviar por E-mail
      </button>
    </div>
  </div>
  {/* PASSOS */}
  <div className="indique-passos">
    <div className="indique-passo">
      <div className="numero">1</div>
      <h4>Envie o link</h4>
      <p>
        Mande seu link para donos de chácaras, salões, sítios ou qualquer espaço
        para eventos.
      </p>
    </div>
    <div className="indique-passo">
      <div className="numero">2</div>
      <h4>Eles publicam e testam</h4>
      <p>
        O novo parceiro cria e publica um anúncio na VENTSY durante o período de
        teste gratuito.
      </p>
    </div>
    <div className="indique-passo">
      <div className="numero">3</div>
      <h4>Você ganha!</h4>
      <p>
        Quando o indicado realizar a{" "}
        <strong>primeira compra de um plano</strong>, seu 1 mês grátis é
        creditado. Renovações futuras dele não geram novo bônus.
      </p>
    </div>
  </div>
  {/* RESULTADOS */}
  <div className="indique-secao-resultados">
    <div className="indique-header-resultados">
      <div>
        <h3>Acompanhe seus resultados</h3>
        <p style={{ fontSize: "0.78rem", color: "#aaa", marginTop: 4 }}>
          O bônus de 1 mês é creditado somente na{" "}
          <strong style={{ color: "#888" }}>primeira compra</strong> do
          indicado.
        </p>
      </div>
      <div className="indique-badges-resumo">
        <div className="indique-badge-resumo-item">
          <span>Indicados</span>
          <strong id="indique-total-indicados">—</strong>
        </div>
        <div className="indique-badge-resumo-item">
          <span>Publicaram</span>
          <strong id="indique-total-publicaram">—</strong>
        </div>
        <div className="indique-badge-resumo-item premio">
          <span>Meses Ganhos</span>
          <strong id="indique-total-creditos">—</strong>
        </div>
      </div>
    </div>
    <div className="indique-tabela-container">
      <table className="indique-tabela">
        <thead>
          <tr>
            <th>Propriedade Indicada</th>
            <th>Data do Convite</th>
            <th>Status</th>
            <th>Sua Recompensa</th>
          </tr>
        </thead>
        <tbody id="indique-tbody">{/* preenchido via JS */}</tbody>
      </table>
    </div>
  </div>
</>

            </div>












        {/* ══════════════════════════════════
            PÁGINA: configuracoes
        ══════════════════════════════════ */}
        {/* pagina-configuracoes */}
        <div className="page-section" id="pagina-configuracoes">
          <>
  <div className="dash-header-fixo">
    <h2>⚙️ Configurações</h2>
    <p>Gerencie os dados da sua conta, segurança e preferências.</p>
  </div>
  {/* ── PERFIL PESSOAL ── */}
  <div className="cfg-secao">
    <div className="cfg-secao-header">
      <div className="cfg-secao-icone">👤</div>
      <div className="cfg-titulo-grupo">
        <h3>Perfil Pessoal</h3>
        <p>Suas informações de conta na plataforma VENTSY</p>
      </div>
    </div>
    <div className="cfg-perfil-topo-box">
      <div className="cfg-avatar-grande-wrap">
        <div className="cfg-avatar-grande" id="cfg-avatar-grande">
          ?
        </div>
        <button
          className="cfg-btn-trocar-avatar"
          onClick={() => document.getElementById('cfg-input-foto-perfil')?.click()}
          title="Trocar foto"
        >
          📷
        </button>
        <input
          type="file"
          id="cfg-input-foto-perfil"
          accept="image/*"
          hidden
          onChange={(e: any) => (window as any).cfgPreviewAvatar(e.target)}
        />
      </div>
      <div className="cfg-perfil-info-texto">
        <h4 id="cfg-perfil-nome-display">—</h4>
        <span id="cfg-perfil-email-display">—</span>
      </div>
    </div>
    <div className="cfg-grid-2">
      <div className="campo">
        <label>Nome Completo</label>
        <input
          type="text"
          id="cfg-campo-nome"
          placeholder="Seu nome completo"
        />
      </div>
      <div className="campo">
        <label>Usuário (@handle)</label>
        <input type="text" id="cfg-campo-usuario" placeholder="@seuusuario" />
        <span className="dica">Identificador único público na plataforma</span>
      </div>
      <div className="campo">
        <label>E-mail de Login</label>
        <input type="email" id="cfg-campo-email" disabled />
        <span className="dica">
          Para alterar o e-mail entre em contato com o suporte
        </span>
      </div>
      <div className="campo">
        <label>Telefone Pessoal</label>
        <input
          type="tel"
          id="cfg-campo-telefone"
          placeholder="(21) 99999-0000"
        />
      </div>
      <div className="campo">
        <label>CPF / CNPJ</label>
        <input
          type="text"
          id="cfg-campo-documento"
          placeholder="000.000.000-00"
        />
      </div>
      <div className="campo">
        <label>Data de Nascimento</label>
        <input type="date" id="cfg-campo-nascimento" />
      </div>
    </div>
    <div className="cfg-acoes-linha">
      <button className="cfg-btn-primario" onClick={() => (window as any).cfgSalvarPerfil()}>
        💾 Salvar Alterações
      </button>
    </div>
  </div>
  {/* ── SEGURANÇA / SENHA ── */}
  <div className="cfg-secao">
    <div className="cfg-secao-header">
      <div className="cfg-secao-icone">🔒</div>
      <div className="cfg-titulo-grupo">
        <h3>Segurança — Alterar Senha</h3>
        <p>Use uma senha forte com letras, números e símbolos</p>
      </div>
    </div>
    <div className="cfg-grid-2">
      <div className="campo span-2">
        <label>Nova Senha</label>
        <div className="cfg-input-senha-wrap">
          <input
            type="password"
            id="cfg-nova-senha"
            placeholder="Mínimo 8 caracteres"
            onInput={(e: any) => (window as any).cfgCalcularForcaSenha(e.target.value)}
          />
          <button
            className="cfg-btn-olho"
            type="button"
            onClick={(e: any) => (window as any).cfgToggleSenha('cfg-nova-senha', e.target)}
          >
            👁
          </button>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 4 }}>
          <div
            id="cfg-forca-1"
            style={{
              height: 4,
              flex: 1,
              borderRadius: 4,
              background: "#eee",
              transition: "background .3s"
            }}
          />
          <div
            id="cfg-forca-2"
            style={{
              height: 4,
              flex: 1,
              borderRadius: 4,
              background: "#eee",
              transition: "background .3s"
            }}
          />
          <div
            id="cfg-forca-3"
            style={{
              height: 4,
              flex: 1,
              borderRadius: 4,
              background: "#eee",
              transition: "background .3s"
            }}
          />
          <div
            id="cfg-forca-4"
            style={{
              height: 4,
              flex: 1,
              borderRadius: 4,
              background: "#eee",
              transition: "background .3s"
            }}
          />
        </div>
        <span className="dica" id="cfg-forca-label">
          Digite a nova senha
        </span>
      </div>
      <div className="campo span-2">
        <label>Confirmar Nova Senha</label>
        <div className="cfg-input-senha-wrap">
          <input
            type="password"
            id="cfg-confirmar-senha"
            placeholder="Repita a nova senha"
          />
          <button
            className="cfg-btn-olho"
            type="button"
            onClick={(e: any) => (window as any).cfgToggleSenha('cfg-confirmar-senha', e.target)}
          >
            👁
          </button>
        </div>
      </div>
    </div>
    <div className="cfg-acoes-linha">
      <button className="cfg-btn-secundario" onClick={() => (window as any).cfgAlterarSenha()}>
        🔑 Atualizar Senha
      </button>
      <button
        className="cfg-btn-secundario"
        onClick={() => (window as any).cfgEnviarLinkRedefinicao()}
      >
        📧 Receber link por e-mail
      </button>
    </div>
  </div>
  {/* ── NOTIFICAÇÕES ── */}
  <div className="cfg-secao">
    <div className="cfg-secao-header">
      <div className="cfg-secao-icone">🔔</div>
      <div className="cfg-titulo-grupo">
        <h3>Notificações e Alertas</h3>
        <p>Escolha como deseja ser avisado sobre interações</p>
      </div>
    </div>
    <div className="cfg-lista-notif">
      <div className="cfg-item-notif">
        <div className="cfg-notif-texto">
          <strong>Novo Lead por E-mail</strong>
          <p>
            Receba um e-mail quando alguém clicar no botão de contato do seu
            anúncio.
          </p>
        </div>
        <label className="switch">
          <input type="checkbox" id="cfg-notif-lead-email" defaultChecked />
          <span className="switch-slider" />
        </label>
      </div>
      <div className="cfg-item-notif">
        <div className="cfg-notif-texto">
          <strong>Novo Lead por WhatsApp</strong>
          <p>Receba uma mensagem no WhatsApp a cada novo contato gerado.</p>
        </div>
        <label className="switch">
          <input type="checkbox" id="cfg-notif-lead-whatsapp" />
          <span className="switch-slider" />
        </label>
      </div>
      <div className="cfg-item-notif">
        <div className="cfg-notif-texto">
          <strong>Alerta de Visitas</strong>
          <p>Ser notificado quando seu anúncio receber um novo acesso.</p>
        </div>
        <label className="switch">
          <input type="checkbox" id="cfg-notif-visitas" />
          <span className="switch-slider" />
        </label>
      </div>
      <div className="cfg-item-notif">
        <div className="cfg-notif-texto">
          <strong>E-mails Promocionais</strong>
          <p>
            Novidades, dicas de marketing e atualizações da plataforma VENTSY.
          </p>
        </div>
        <label className="switch">
          <input type="checkbox" id="cfg-notif-promo" defaultChecked />
          <span className="switch-slider" />
        </label>
      </div>
      <div className="cfg-item-notif">
        <div className="cfg-notif-texto">
          <strong>Relatório Semanal</strong>
          <p>
            Resumo semanal de visitas, leads e desempenho do seu anúncio por
            e-mail.
          </p>
        </div>
        <label className="switch">
          <input type="checkbox" id="cfg-notif-relatorio" defaultChecked />
          <span className="switch-slider" />
        </label>
      </div>
    </div>
    <div className="cfg-acoes-linha">
      <button className="cfg-btn-primario" onClick={() => (window as any).cfgSalvarNotificacoes()}>
        💾 Salvar Preferências
      </button>
    </div>
  </div>
  {/* ── SEGURANÇA AVANÇADA ── */}
  <div className="cfg-secao">
    <div className="cfg-secao-header">
      <div className="cfg-secao-icone">🛡️</div>
      <div className="cfg-titulo-grupo">
        <h3>Segurança Avançada</h3>
        <p>Proteja sua conta com camadas extras de verificação</p>
      </div>
    </div>
    <div className="cfg-item-seguranca">
      <div className="cfg-seg-texto">
        <strong>Autenticação de Dois Fatores (2FA)</strong>
        <p>Adicione um código enviado ao seu celular ou e-mail a cada login.</p>
        <span className="cfg-badge-status cfg-badge-inativo" id="cfg-badge-2fa">
          ○ Não configurado
        </span>
      </div>
      <button className="cfg-btn-secundario" onClick={() => (window as any).cfgAbrirModal2FA()}>
        Configurar
      </button>
    </div>
    <div className="cfg-item-seguranca">
      <div className="cfg-seg-texto">
        <strong>Sessões Ativas</strong>
        <p>Encerre o acesso de todos os dispositivos conectados à sua conta.</p>
      </div>
      <button className="cfg-btn-secundario" onClick={() => (window as any).cfgEncerrarSessoes()}>
        Encerrar todas
      </button>
    </div>
    <div className="cfg-item-seguranca">
      <div className="cfg-seg-texto">
        <strong>Histórico de Acessos</strong>
        <p>Veja os últimos logins realizados na sua conta.</p>
      </div>
      <button
        className="cfg-btn-secundario"
        onClick={() => (window as any).mostrarToast('📋 Funcionalidade em breve!')}
      >
        Ver histórico
      </button>
    </div>
  </div>
  {/* ── ZONA DE PERIGO ── */}
  <div className="cfg-secao-perigo">
    <div className="cfg-secao-header" style={{ borderBottomColor: "#ffe0e0" }}>
      <div className="cfg-secao-icone" style={{ background: "#fff0f0" }}>
        ⚠️
      </div>
      <div className="cfg-titulo-grupo">
        <h3 style={{ color: "#ff385c" }}>Zona de Perigo</h3>
        <p>Ações irreversíveis — leia com atenção antes de continuar</p>
      </div>
    </div>
    <div className="cfg-perigo-item">
      <div className="cfg-perigo-texto">
        <strong>Despublicar meu anúncio</strong>
        <p>
          Oculta temporariamente seu espaço da busca pública. Pode reativar
          quando quiser.
        </p>
      </div>
      <button
        className="cfg-btn-secundario"
        onClick={() => (window as any).mostrarToast('👁‍🗨 Anúncio despublicado temporariamente.')}
      >
        Despublicar
      </button>
    </div>
    <div className="cfg-perigo-item">
      <div className="cfg-perigo-texto">
        <strong>Cancelar assinatura</strong>
        <p>
          Encerra sua assinatura atual ao fim do período vigente. Dados são
          mantidos.
        </p>
      </div>
      <button
        className="cfg-btn-secundario"
        onClick={() => (window as any).mostrarToast('💳 Solicitação enviada. Em breve entraremos em contato.')}
      >
        Cancelar plano
      </button>
    </div>
    <div className="cfg-perigo-item">
      <div className="cfg-perigo-texto">
        <strong>Excluir minha conta permanentemente</strong>
        <p>
          Remove todos os dados, anúncio e histórico. Esta ação{" "}
          <strong>não pode ser desfeita</strong>.
        </p>
      </div>
      <button className="cfg-btn-perigo" onClick={() => (window as any).cfgAbrirModalExcluir()}>
        🗑️ Excluir conta
      </button>
    </div>
  </div>
</>

        </div>





      </section>

      {/* Toast global */}
      <div className="toast" id="toast"><span>✅</span><span id="toast-msg">Mensagem</span></div>

      {/* Modais (Financeiro, Documentos, Equipe etc.) — copiar do index.html */}

<>
  {/* MODAL FINANCEIRO */}
  <div className="fin-modal-overlay" id="finModal">
    <div className="fin-modal">
      <div className="fin-modal-head">
        <div>
          <h2 id="fin-modal-title">Novo Lançamento</h2>
          <p id="fin-modal-desc">Registre a movimentação financeira abaixo.</p>
        </div>
        <button className="fin-modal-close" onClick={() => (window as any).finCloseModal()}>
          ✕
        </button>
      </div>
      <div className="fin-form-grid">
        <div className="fin-form-group">
          <label>Tipo</label>
          <select id="fin-f-tipo">
            <option value="receita">Receita</option>
            <option value="despesa">Despesa</option>
          </select>
        </div>
        <div className="fin-form-group">
          <label>Data</label>
          <input type="date" id="fin-f-data" />
        </div>
        <div className="fin-form-group">
          <label>Valor (R$)</label>
          <input
            type="number"
            id="fin-f-valor"
            placeholder="0,00"
            step="0.01"
            min={0}
          />
        </div>
        <div className="fin-form-group">
          <label>Categoria</label>
          <select id="fin-f-cat">
            <option>Aluguel de Espaço</option>
            <option>Buffet / Catering</option>
            <option>Decoração</option>
            <option>Som / Iluminação</option>
            <option>Limpeza</option>
            <option>Manutenção</option>
            <option>Marketing</option>
            <option>Outros</option>
          </select>
        </div>
        <div className="fin-form-group">
          <label>Status</label>
          <select id="fin-f-status">
            <option value="pago">Pago</option>
            <option value="pendente">Pendente</option>
            <option value="atrasado">Atrasado</option>
            <option value="cancelado">Cancelado</option>
          </select>
        </div>
        <div className="fin-form-group full">
          <label>Descrição</label>
          <input
            type="text"
            id="fin-f-desc"
            placeholder="Ex: Casamento Silva — Salão Principal"
          />
        </div>
      </div>
      <div className="fin-modal-actions">
        <button className="btn-fin btn-fin-ghost" onClick={() => (window as any).finCloseModal()}>
          Cancelar
        </button>
        <button
          className="btn-fin btn-fin-primary"
          onClick={() => (window as any).finSaveTransaction()}
        >
          Salvar
        </button>
      </div>
    </div>
  </div>
</>


<>
  {/* MODAL ADD/EDIT DOCUMENTOS */}
  <div className="docs-modal-overlay" id="docsAddModal">
    <div className="docs-modal">
      <div className="docs-modal-header">
        <div>
          <h2 id="docsFormTitle">Novo Documento</h2>
          <p>Preencha os dados e anexe o arquivo do documento.</p>
        </div>
        <button className="docs-modal-close" onClick={() => (window as any).docsCloseAddModal()}>
          ✕
        </button>
      </div>
      <div className="docs-modal-body">
        <div className="docs-form-grid">
          <div className="docs-form-group full">
            <label>Nome do Documento</label>
            <input
              type="text"
              id="docs-f-nome"
              placeholder="Ex: Licença do Corpo de Bombeiros"
            />
          </div>
          <div className="docs-form-group">
            <label>Categoria</label>
            <select id="docs-f-cat">
              <option value="licencas">Licenças</option>
              <option value="alvara">Alvarás</option>
              <option value="juridico">Jurídico</option>
              <option value="fiscal">Fiscal</option>
              <option value="seguros">Seguros</option>
              <option value="outros">Outros</option>
            </select>
          </div>
          <div className="docs-form-group">
            <label>Órgão Emissor</label>
            <input
              type="text"
              id="docs-f-orgao"
              placeholder="Ex: Corpo de Bombeiros"
            />
          </div>
          <div className="docs-form-group">
            <label>Número / Protocolo</label>
            <input
              type="text"
              id="docs-f-numero"
              placeholder="Ex: 00123456/2024"
            />
          </div>
          <div className="docs-form-group">
            <label>Data de Emissão</label>
            <input type="date" id="docs-f-emissao" />
          </div>
          <div className="docs-form-group">
            <label>Data de Vencimento</label>
            <input
              type="date"
              id="docs-f-vencimento"
              placeholder="Deixe vazio se não vence"
            />
          </div>
          <div className="docs-form-group full">
            <label>Observações</label>
            <textarea
              id="docs-f-obs"
              placeholder="Informações adicionais, contatos, instruções de renovação..."
              defaultValue={""}
            />
          </div>
          <div className="docs-form-group full">
            <label>Arquivo</label>
            <div
              className="docs-upload-zone"
              id="docsUploadZone"
              onClick={() => document.getElementById('docsFileInput')?.click()}
              onDragOver={() => (window as any).docsDragOver(event)}
              onDragLeave={() => (window as any).docsDragLeave()}
              onDrop={() => (window as any).docsDropFile(event)}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="17,8 12,3 7,8" />
                <line x1={12} y1={3} x2={12} y2={15} />
              </svg>
              <p>
                Arraste aqui ou <strong>clique para selecionar</strong>
              </p>
              <p className="ftype">PDF, JPG, PNG — até 20 MB</p>
            </div>
            <div
              className="docs-file-preview"
              id="docsFilePreview"
              style={{ display: "none" }}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14,2 14,8 20,8" />
              </svg>
              <span id="docsFilePreviewName">arquivo.pdf</span>
            </div>
            <input
              type="file"
              id="docsFileInput"
              accept=".pdf,.jpg,.jpeg,.png"
              style={{ display: "none" }}
              onChange={(e: any) => (window as any).docsFileSelected(e.target)}
            />
          </div>
        </div>
      </div>
      <div className="docs-modal-footer">
        <button className="btn-fin btn-fin-ghost" onClick={() => (window as any).docsCloseAddModal()}>
          Cancelar
        </button>
        <button className="btn-fin btn-fin-primary" onClick={() => (window as any).docsSaveDoc()}>
          Salvar Documento
        </button>
      </div>
    </div>
  </div>
</>


<>
  {/* MODAL VIEW DOCUMENTOS */}
  <div className="docs-modal-overlay" id="docsViewModal">
    <div className="docs-modal" style={{ width: 600 }}>
      <div className="docs-modal-header">
        <div>
          <div
            style={{
              fontSize: "0.68rem",
              color: "#999",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 5,
              fontWeight: 700
            }}
            id="docs-view-cat"
          >
            —
          </div>
          <h2 id="docs-view-nome">—</h2>
        </div>
        <button className="docs-modal-close" onClick={() => (window as any).docsCloseViewModal()}>
          ✕
        </button>
      </div>
      <div className="docs-view-content">
        <div className="docs-view-grid" id="docsViewGrid" />
        <div className="docs-file-placeholder" id="docsViewFile">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
            <polyline points="14,2 14,8 20,8" />
            <line x1={16} y1={13} x2={8} y2={13} />
            <line x1={16} y1={17} x2={8} y2={17} />
          </svg>
          <p>Pré-visualização não disponível nesta demo</p>
          <p
            style={{ fontSize: "0.72rem", marginTop: 3, color: "#ccc" }}
            id="docsViewFileName"
          >
            —
          </p>
        </div>
        <div id="docsViewObsWrap" style={{ marginTop: 16, display: "none" }}>
          <div
            style={{
              fontSize: "0.68rem",
              color: "#999",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              marginBottom: 6,
              fontWeight: 700
            }}
          >
            Observações
          </div>
          <div className="docs-notes-box" id="docsViewObs" />
        </div>
      </div>
      <div className="docs-modal-footer">
        <button className="btn-fin btn-fin-ghost" onClick={() => (window as any).docsEditDoc()}>
          Editar
        </button>
        <button className="btn-fin btn-fin-primary">
          <svg
            width={13}
            height={13}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1={12} y1={15} x2={12} y2={3} />
          </svg>
          Baixar Arquivo
        </button>
      </div>
    </div>
  </div>
</>



<>
  {/* MODAL FUNCIONÁRIO */}
  <div className="eq-modal-overlay" id="eqEmpModal">
    <div className="eq-modal">
      <div className="eq-modal-head">
        <div>
          <h2 id="eqEmpModalTitle">Novo Funcionário</h2>
          <p>Preencha os dados do colaborador.</p>
        </div>
        <button className="eq-modal-close" onClick={() => (window as any).eqCloseEmpModal()}>
          ✕
        </button>
      </div>
      <div className="eq-modal-body">
        <div className="eq-fg">
          <label>Nome Completo</label>
          <input type="text" id="eq-ef-nome" placeholder="Ex: Maria da Silva" />
        </div>
        <div className="eq-fg-row">
          <div className="eq-fg">
            <label>Cargo / Função</label>
            <input type="text" id="eq-ef-cargo" placeholder="Ex: Garçom" />
          </div>
          <div className="eq-fg">
            <label>Departamento</label>
            <select id="eq-ef-dept">
              <option>Operações</option>
              <option>Limpeza</option>
              <option>Segurança</option>
              <option>Cozinha/Buffet</option>
              <option>Decoração</option>
              <option>Administração</option>
              <option>Tecnologia</option>
            </select>
          </div>
        </div>
        <div className="eq-fg-row">
          <div className="eq-fg">
            <label>Salário Base (R$)</label>
            <input
              type="number"
              id="eq-ef-salario"
              defaultValue={1800}
              min={0}
              step={100}
            />
          </div>
          <div className="eq-fg">
            <label>Tipo de Contrato</label>
            <select id="eq-ef-contrato">
              <option value="clt">CLT — Integral</option>
              <option value="horista">CLT — Horista</option>
              <option value="mei">MEI / Autônomo</option>
              <option value="estagio">Estágio</option>
            </select>
          </div>
        </div>
        <div className="eq-fg-row">
          <div className="eq-fg">
            <label>Data de Admissão</label>
            <input type="date" id="eq-ef-admissao" />
          </div>
          <div className="eq-fg">
            <label>Status</label>
            <select id="eq-ef-status">
              <option value="ativo">Ativo</option>
              <option value="ferias">Férias</option>
              <option value="afas">Afastado</option>
              <option value="horista">Horista/Freelancer</option>
            </select>
          </div>
        </div>
        <div className="eq-fg">
          <label>Telefone / WhatsApp</label>
          <input type="text" id="eq-ef-tel" placeholder="(31) 9 9999-9999" />
        </div>
        <div className="eq-fg">
          <label>Observações</label>
          <textarea
            id="eq-ef-obs"
            placeholder="Informações adicionais..."
            defaultValue={""}
          />
        </div>
      </div>
      <div className="eq-modal-foot">
        <button className="btn-fin btn-fin-ghost" onClick={() => (window as any).eqCloseEmpModal()}>
          Cancelar
        </button>
        <button className="btn-fin btn-fin-primary" onClick={() => (window as any).eqSaveEmployee()}>
          Salvar
        </button>
      </div>
    </div>
  </div>
</>


<>
  {/* MODAL CONTRACHEQUE */}
  <div className="eq-modal-overlay" id="eqPayModal">
    <div className="eq-modal" style={{ width: 460 }}>
      <div className="eq-modal-head">
        <div>
          <h2 id="eq-pay-emp-name">—</h2>
          <p id="eq-pay-emp-role">Contracheque</p>
        </div>
        <button
          className="eq-modal-close"
          onClick={() => document.getElementById('eqPayModal')?.classList.remove('open')}
        >
          ✕
        </button>
      </div>
      <div className="eq-modal-body">
        <div id="eqPayBreakdown" />
        <div className="eq-pb-total">
          <span className="eq-pb-total-label">Salário Líquido</span>
          <span className="eq-pb-total-val" id="eq-pb-liquido">
            R$ 0
          </span>
        </div>
        <div className="eq-cost-info">
          Custo total para a empresa:{" "}
          <strong id="eq-pb-custo-empresa" style={{ color: "#f59e0b" }}>
            R$ 0
          </strong>
          <br />
          Inclui encargos patronais, benefícios e provisões.
        </div>
      </div>
      <div className="eq-modal-foot">
        <button
          className="btn-fin btn-fin-ghost"
          onClick={() => document.getElementById('eqPayModal')?.classList.remove('open')}
        >
          Fechar
        </button>
        <button className="btn-fin btn-fin-primary">
          Imprimir Contracheque
        </button>
      </div>
    </div>
  </div>
</>









    </>
  );
}

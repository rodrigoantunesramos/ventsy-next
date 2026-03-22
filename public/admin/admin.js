const SUPA_URL = 'https://hxvlfalgrduitevbhqvq.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh4dmxmYWxncmR1aXRldmJocXZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMDA2MDYsImV4cCI6MjA4ODc3NjYwNn0.AUUY8k1dM3rzanf6qdiqk9kcFztDFFm-SuEv2aoBbQQ';
const { createClient } = supabase;
const sb = createClient(SUPA_URL, SUPA_KEY);
const ADMIN_EMAILS = ['rodrigoantunesramos@gmail.com'];

// ─── ESTADO GLOBAL ───
let allUsers = [], allProps = [], allAss = [], allEvents = [], allFotos = [];
let adminEmail = '';
let graficoAtividade = null, graficoPlanos = null, graficoTipos = null;


// ─── TOAST ───
function toast(msg, type='info') {
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span class="toast-text">${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ─── MODAL ───
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ─── LOGIN ───
async function doLogin() {
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const pass = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-err');
  errEl.style.display = 'none';

  if (!ADMIN_EMAILS.includes(email)) {
    errEl.textContent = '🔒 Acesso negado. Esta conta não tem permissão de admin.';
    errEl.style.display = 'block';
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
  if (error) {
    errEl.textContent = 'E-mail ou senha incorretos.';
    errEl.style.display = 'block';
    return;
  }
  adminEmail = email;
  showApp();
}

async function doLogout() {
  await sb.auth.signOut();
  location.reload();
}

// ─── INIT ───
async function init() {
  await new Promise(r => setTimeout(r, 1800));
  const { data: { session } } = await sb.auth.getSession();
  document.getElementById('loading-screen').style.display = 'none';
  if (!session) {
    document.getElementById('login-screen').style.display = 'flex';
    return;
  }
  adminEmail = session.user.email.toLowerCase();
  if (!ADMIN_EMAILS.includes(adminEmail)) {
    await sb.auth.signOut();
    const errEl = document.getElementById('login-err');
    errEl.textContent = '🔒 Acesso negado. Esta conta não tem permissão de admin.';
    errEl.style.display = 'block';
    document.getElementById('login-screen').style.display = 'flex';
    return;
  }
  showApp();
}

async function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('main-content').style.display = 'flex';
  // Admin info
  const ini = adminEmail[0]?.toUpperCase() || 'A';
  document.getElementById('admin-avatar').textContent = ini;
  document.getElementById('admin-name').textContent = adminEmail.split('@')[0];
  document.getElementById('config-admin-email').textContent = adminEmail;
  addLog('sistema', `Login efetuado`, adminEmail);
  // Load data
  await loadAllData();
  renderDashboard();
}

// ─── LOAD DATA ───
async function loadAllData() {
  const [r1, r2, r3, r4, r5] = await Promise.all([
    sb.from('usuarios').select('*').order('criado_em', { ascending: false }),
    sb.from('propriedades').select('*').order('criadoem', { ascending: false }),
    sb.from('assinaturas').select('*').order('criado_em', { ascending: false }),
    sb.from('analytics_eventos').select('*').order('created_at', { ascending: false }),
    sb.from('fotos_imovel').select('propriedade_id, url, secao').order('ordem')
  ]);
  allUsers = r1.data || [];
  allProps = r2.data || [];
  allAss = r3.data || [];
  allEvents = r4.data || [];
  allFotos = r5.data || [];
  await loadCupons();
}

// ─── NAVEGAÇÃO ───
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById(`page-${page}`).classList.add('active');
  const links = document.querySelectorAll('.sidebar-link');
  links.forEach(l => { if (l.onclick?.toString().includes(`'${page}'`)) l.classList.add('active'); });
  const titles = {
    dashboard: ['Dashboard', 'Visão geral da plataforma'],
    analytics: ['Analytics', 'Métricas detalhadas da plataforma'],
    propriedades: ['Propriedades', 'Gestão e liberação de propriedades'],
    usuarios: ['Usuários', 'Gerenciar contas de usuários'],
    assinaturas: ['Assinaturas', 'Controle de planos e pagamentos'],
    planos: ['Planos', 'Configuração dos planos'],
    config: ['Configurações', 'Configurações do painel admin'],
    financeiro: ['Financeiro', 'Receita, MRR, ARR e métricas financeiras'],
    cupons: ['Cupons & Promoções', 'Criar e gerenciar cupons de desconto'],
    qualidade: ['Qualidade da Plataforma', 'Score e métricas de completude dos perfis'],
    comunicacao: ['Comunicação', 'Enviar mensagens segmentadas para usuários'],
    logs: ['Logs de Auditoria', 'Histórico de ações do administrador'],
    incompletos: ['Cadastros Incompletos', 'Usuários que não finalizaram o perfil — oportunidade de recuperação'],
  };
  const [t, s] = titles[page] || ['', ''];
  document.getElementById('page-title').textContent = t;
  document.getElementById('page-sub').textContent = s;
  // Render specific page
  if (page === 'dashboard') renderDashboard();
  if (page === 'analytics') renderAnalytics();
  if (page === 'propriedades') renderPropriedades();
  if (page === 'usuarios') renderUsuarios();
  if (page === 'assinaturas') renderAssinaturas();
  if (page === 'financeiro') renderFinanceiro();
  if (page === 'qualidade') { renderQualidade(); recarregarBuscasSemResultado(); }
  if (page === 'comunicacao') { updateComCount(); renderComHistorico(); }
  if (page === 'cupons') renderCupons();
  if (page === 'logs') renderLogs();
  if (page === 'planos') carregarPlanos();
  if (page === 'incompletos') renderIncompletos();
}

// ─── DASHBOARD ───
function renderDashboard() {
  // Stat: usuários
  const totalU = allUsers.length;
  setValue('s-usuarios', totalU);
  const thisMonth = allUsers.filter(u => new Date(u.criado_em) > new Date(Date.now() - 30*864e5)).length;
  document.getElementById('s-usuarios-sub').textContent = `+${thisMonth} este mês`;

  // Stat: propriedades
  setValue('s-props', allProps.length);
  const pendentes = allProps.filter(p => !p.publicada && p.usuario_id && p.usuario_id !== 'a1b2c3d4-e5f6-7890-abcd-ef1234567890').length;
  document.getElementById('s-props-sub').textContent = `${pendentes} pendentes de revisão`;
  document.getElementById('badge-pendentes').textContent = pendentes;
  setValue('s-pendentes', pendentes);
  document.getElementById('pending-count').textContent = `${pendentes} propriedades aguardando liberação`;

  // Stat: eventos 30d
  const d30 = new Date(Date.now() - 30*864e5);
  const e30 = allEvents.filter(e => new Date(e.created_at) >= d30);
  const views = e30.filter(e => e.evento_tipo === 'view').length;
  const wa = e30.filter(e => e.evento_tipo === 'whatsapp').length;
  const form = e30.filter(e => e.evento_tipo === 'formulario').length;
  setValue('s-views', views);
  setValue('s-whatsapp', wa);
  setValue('s-form', form);

  // Stat: assinaturas
  const assAtivas = allAss.filter(a => a.status === 'ativa' || a.status === 'trial').length;
  setValue('s-assinaturas', assAtivas);
  const ultra = allAss.filter(a => a.plano_ativo === 'ultra').length;
  document.getElementById('s-assinaturas-sub').textContent = `${ultra} no plano Ultra`;

  // Gráfico atividade
  renderChartAtividade(e30);
  // Gráfico planos
  renderChartPlanos();
  // Propriedades pendentes
  renderPendentes();
  // Últimos usuários
  renderRecentUsers();
}

function setValue(id, val) {
  const el = document.getElementById(id);
  if (el) { el.textContent = val; el.classList.remove('loading'); }
}

function renderChartAtividade(events) {
  const labels = [], keys = [];
  const hoje = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(hoje); d.setDate(hoje.getDate() - i);
    labels.push(`${d.getDate()}/${d.getMonth()+1}`);
    keys.push(d.toISOString().split('T')[0]);
  }
  const cnt = (tipo) => keys.map(k => events.filter(e => e.evento_tipo === tipo && e.created_at?.startsWith(k)).length);
  const ctx = document.getElementById('chart-atividade').getContext('2d');
  if (graficoAtividade) graficoAtividade.destroy();
  graficoAtividade = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label:'Visualizações', data:cnt('view'), borderColor:'#ff385c', backgroundColor:'rgba(255,56,92,0.08)', tension:0.4, borderWidth:2, pointRadius:0 },
        { label:'WhatsApp', data:cnt('whatsapp'), borderColor:'#25D366', backgroundColor:'rgba(37,211,102,0.08)', tension:0.4, borderWidth:2, pointRadius:0 },
        { label:'Formulário', data:cnt('formulario'), borderColor:'#3b82f6', backgroundColor:'rgba(59,130,246,0.08)', tension:0.4, borderWidth:2, pointRadius:0 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{ labels:{ color:'#a0a0b8', boxWidth:10, font:{size:11} } } },
      scales: {
        x: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5c78', maxTicksLimit:8} },
        y: { grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5c78'}, beginAtZero:true }
      }
    }
  });
}

function renderChartPlanos() {
  const basico = allAss.filter(a => a.plano_ativo === 'basico').length;
  const pro = allAss.filter(a => a.plano_ativo === 'pro').length;
  const ultra = allAss.filter(a => a.plano_ativo === 'ultra').length;
  const ctx = document.getElementById('chart-planos').getContext('2d');
  if (graficoPlanos) graficoPlanos.destroy();
  graficoPlanos = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Básico', 'Pro', 'Ultra'],
      datasets: [{ data:[basico,pro,ultra], backgroundColor:['rgba(255,255,255,0.1)','#3b82f6','#8b5cf6'], borderWidth:0 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins: { legend:{ position:'bottom', labels:{ color:'#a0a0b8', font:{size:11}, padding:16 } } },
      cutout: '65%'
    }
  });
}

function renderPendentes() {
  // Propriedades com usuario_id real (que não sejam seedadas)
  const seedUsers = ['a1b2c3d4-e5f6-7890-abcd-ef1234567890'];
  const pending = allProps.filter(p => !p.publicada && p.usuario_id && !seedUsers.includes(p.usuario_id));
  const container = document.getElementById('pendentes-list');
  if (!pending.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🎉</div><p>Nenhuma propriedade pendente de liberação</p></div>`;
    return;
  }
  container.innerHTML = pending.map(p => {
    const owner = allUsers.find(u => u.id === p.usuario_id);
    return `
    <div class="prop-pending-card">
      <div style="width:64px;height:64px;border-radius:10px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">🏡</div>
      <div class="prop-info">
        <div class="prop-name">${p.nome || 'Sem nome'}</div>
        <div class="prop-meta">
          👤 ${owner?.nome || 'Desconhecido'}
          &nbsp;·&nbsp; 📍 ${p.cidade || '—'}, ${p.estado || '—'}
          &nbsp;·&nbsp; 👥 ${p.capacidade || '—'} pessoas
        </div>
      </div>
      <div class="prop-actions">
        <button class="btn btn-success btn-sm" onclick="liberarProp('${p.id}')">✅ Liberar</button>
        <button class="btn btn-ghost btn-sm" onclick="verProp('${p.id}')">👁 Ver</button>
        <button class="btn btn-danger btn-sm" onclick="rejeitarProp('${p.id}')">❌ Rejeitar</button>
      </div>
    </div>`;
  }).join('');
}

function renderRecentUsers() {
  const recent = allUsers.slice(0, 6);
  const tbody = document.getElementById('recent-users');
  if (!recent.length) { tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--text3);">Nenhum usuário</td></tr>'; return; }
  tbody.innerHTML = recent.map(u => {
    const ass = allAss.find(a => a.usuario_id === u.id);
    const plano = ass?.plano_ativo || 'basico';
    const status = ass?.status || 'sem plano';
    const dt = u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '—';
    return `<tr>
      <td><div class="td-name"><div class="td-avatar">${(u.nome||'?')[0].toUpperCase()}</div>${u.nome||'Sem nome'}</div></td>
      <td><span style="color:var(--text3)">@${u.usuario||'—'}</span></td>
      <td><span class="badge plano-${plano}">${plano}</span></td>
      <td>${badgeStatus(status)}</td>
      <td style="color:var(--text3)">${dt}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">✏️ Editar</button></td>
    </tr>`;
  }).join('');
}

// ─── ANALYTICS ───
function renderAnalytics() {
  const totalV = allEvents.filter(e=>e.evento_tipo==='view').length;
  const totalW = allEvents.filter(e=>e.evento_tipo==='whatsapp').length;
  const totalF = allEvents.filter(e=>e.evento_tipo==='formulario').length;
  setValue('an-total-views', totalV);
  setValue('an-total-wa', totalW);
  setValue('an-total-form', totalF);
  // CTR: cliques WA / visualizações
  const ctr = totalV > 0 ? ((totalW / totalV) * 100).toFixed(1) : '0';
  setValue('an-ctr', `${ctr}%`);

  // Top prop
  const propCount = {};
  allEvents.filter(e=>e.evento_tipo==='view').forEach(e => {
    propCount[e.propriedade_id] = (propCount[e.propriedade_id]||0)+1;
  });
  const topId = Object.entries(propCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const topProp = allProps.find(p=>p.id==topId);
  setValue('an-top-prop', topProp?.nome || `#${topId}`);

  // Chart tipos
  const ctx = document.getElementById('chart-eventos-tipo').getContext('2d');
  if (graficoTipos) graficoTipos.destroy();
  graficoTipos = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['Visualizações','WhatsApp','Formulário'],
      datasets: [{ data:[totalV,totalW,totalF], backgroundColor:['rgba(255,56,92,0.7)','rgba(37,211,102,0.7)','rgba(59,130,246,0.7)'], borderRadius:6 }]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales: {
        x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#a0a0b8'} },
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5c78'}, beginAtZero:true }
      }
    }
  });

  // Ranking
  const tbody = document.getElementById('ranking-props');
  const ranking = Object.entries(propCount).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if (!ranking.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:30px;color:var(--text3);">Sem dados</td></tr>'; return; }
  tbody.innerHTML = ranking.map(([pid, views], i) => {
    const prop = allProps.find(p=>p.id==pid);
    const waC = allEvents.filter(e=>e.propriedade_id==pid && e.evento_tipo==='whatsapp').length;
    const fC = allEvents.filter(e=>e.propriedade_id==pid && e.evento_tipo==='formulario').length;
    const medals = ['🥇','🥈','🥉'];
    return `<tr>
      <td style="font-weight:700;color:var(--text3)">${medals[i]||`#${i+1}`}</td>
      <td><span style="font-weight:600;color:var(--text)">${prop?.nome||`ID #${pid}`}</span></td>
      <td>${views}</td>
      <td>${waC}</td>
      <td>${fC}</td>
      <td style="font-weight:700;color:var(--text)">${views+waC+fC}</td>
    </tr>`;
  }).join('');
}

// ─── PROPRIEDADES ───
function renderPropriedades(filter='') {
  const tbody = document.getElementById('props-tbody');
  let data = allProps;
  if (filter) data = data.filter(p => (p.nome||'').toLowerCase().includes(filter.toLowerCase()) || (p.cidade||'').toLowerCase().includes(filter.toLowerCase()));
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding:40px;">Nenhuma encontrada</td></tr>`; return; }
  tbody.innerHTML = data.map(p => {
    const owner = allUsers.find(u => u.id === p.usuario_id);
    const ass = allAss.find(a => a.usuario_id === p.usuario_id);
    const statusBadge = p.publicada ? '<span class="badge badge-green">✓ Ativa</span>' : '<span class="badge badge-yellow">⏳ Pendente</span>';
    const destBadge = p.destaque ? '<span class="badge badge-purple" style="margin-left:4px;">📌</span>' : '';
    return `<tr>
      <td><div class="td-name" style="gap:10px">
        <div style="width:36px;height:36px;border-radius:8px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🏡</div>
        <div><div style="font-weight:600;color:var(--text)">${p.nome||'Sem nome'}${destBadge}</div><div style="font-size:0.72rem;color:var(--text3)">${p.tipo_propriedade||p.categoria||'—'}</div></div>
      </div></td>
      <td style="color:var(--text2)">${owner?.nome||'Desconhecido'}</td>
      <td>${statusBadge}</td>
      <td><span class="badge plano-${ass?.plano_ativo||'basico'}">${ass?.plano_ativo||'básico'}</span></td>
      <td style="color:var(--text3)">${p.cidade||'—'}, ${p.estado||'—'}</td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          ${!p.publicada ? `<button class="btn btn-success btn-sm" onclick="liberarProp('${p.id}')">✅ Liberar</button>` : `<button class="btn btn-warn btn-sm" onclick="suspenderProp('${p.id}')">⏸</button>`}
          <button class="btn btn-ghost btn-sm" onclick="editarProp('${p.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="${p.destaque ? `removerDestaque('${p.id}')` : `fixarDestaque('${p.id}')`}" title="${p.destaque?'Remover destaque':'Fixar no topo'}">📌</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterProps() { renderPropriedades(document.getElementById('search-props').value); }

// ─── USUÁRIOS ───
function renderUsuarios(filter='') {
  const tbody = document.getElementById('users-tbody');
  let data = allUsers;
  if (filter) data = data.filter(u => (u.nome||'').toLowerCase().includes(filter.toLowerCase()) || (u.usuario||'').toLowerCase().includes(filter.toLowerCase()));
  if (!data.length) { tbody.innerHTML = `<tr><td colspan="6" class="empty-state" style="padding:40px;">Nenhum encontrado</td></tr>`; return; }
  tbody.innerHTML = data.map(u => {
    const ass = allAss.find(a => a.usuario_id === u.id);
    const plano = ass?.plano_ativo || 'basico';
    const status = ass?.status || 'sem plano';
    const dt = u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '—';
    return `<tr>
      <td><div class="td-name"><div class="td-avatar">${(u.nome||'?')[0].toUpperCase()}</div><div><div>${u.nome||'Sem nome'}</div></div></div></td>
      <td style="color:var(--text3)">@${u.usuario||'—'}</td>
      <td><span class="badge plano-${plano}">${plano}</span></td>
      <td>${badgeStatus(status)}</td>
      <td style="color:var(--text3)">${dt}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">✏️ Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="editAss('${u.id}')">💳 Plano</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function filterUsers() { renderUsuarios(document.getElementById('search-users').value); }

// ─── ASSINATURAS ───
function renderAssinaturas() {
  const ativas = allAss.filter(a => a.status === 'ativa').length;
  const trial = allAss.filter(a => a.status === 'trial').length;
  const canc = allAss.filter(a => a.status === 'cancelada' || a.status === 'expirada').length;
  setValue('ass-ativas', ativas);
  setValue('ass-trial', trial);
  setValue('ass-canc', canc);

  const tbody = document.getElementById('ass-tbody');
  if (!allAss.length) { tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:30px;color:var(--text3);">Nenhuma assinatura</td></tr>'; return; }
  tbody.innerHTML = allAss.map(a => {
    const user = allUsers.find(u => u.id === a.usuario_id);
    const ini = a.inicio_periodo ? new Date(a.inicio_periodo).toLocaleDateString('pt-BR') : '—';
    const fim = a.fim_periodo ? new Date(a.fim_periodo).toLocaleDateString('pt-BR') : '—';
    return `<tr>
      <td><div class="td-name"><div class="td-avatar">${(user?.nome||'?')[0].toUpperCase()}</div>${user?.nome||'Desconhecido'}</div></td>
      <td><span class="badge plano-${a.plano_ativo}">${a.plano_ativo||'—'}</span></td>
      <td>${badgeStatus(a.status)}</td>
      <td style="color:var(--text3)">${ini}</td>
      <td style="color:var(--text3)">${fim}</td>
      <td style="color:var(--text2)">R$ ${Number(a.valor_pago||0).toFixed(2)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="editAss('${a.usuario_id}')">✏️ Editar</button></td>
    </tr>`;
  }).join('');
}

// ─── HELPERS ───
function badgeStatus(s) {
  const map = {
    ativa: 'badge-green', trial: 'badge-yellow', cancelada: 'badge-red',
    expirada: 'badge-red', 'sem plano': 'badge-gray'
  };
  return `<span class="badge ${map[s]||'badge-gray'}">${s}</span>`;
}

// ─── AÇÕES: PROPRIEDADES ───
async function liberarProp(id) {
  const { error } = await sb.from('propriedades').update({ publicada: true }).eq('id', id);
  if (error) { toast('Erro ao liberar propriedade', 'error'); return; }
  const p = allProps.find(p => p.id == id);
  if (p) p.publicada = true;
  addLog('propriedade', `Propriedade liberada: ${p?.nome || id}`, `ID #${id}`);
  toast('✅ Propriedade liberada com sucesso!', 'success');
  document.getElementById('badge-pendentes').textContent = allProps.filter(p => !p.publicada && p.usuario_id && p.usuario_id !== 'a1b2c3d4-e5f6-7890-abcd-ef1234567890').length;
  renderPendentes();
  renderPropriedades();
}

async function suspenderProp(id) {
  const { error } = await sb.from('propriedades').update({ publicada: false }).eq('id', id);
  if (error) { toast('Erro ao suspender', 'error'); return; }
  const p = allProps.find(p => p.id == id);
  if (p) p.publicada = false;
  addLog('propriedade', `Propriedade suspensa: ${p?.nome || id}`, `ID #${id}`);
  toast('⏸ Propriedade suspensa', 'info');
  renderPropriedades();
  renderPendentes();
}

async function rejeitarProp(id) {
  if (!confirm('Rejeitar esta propriedade? Ela será marcada como rejeitada.')) return;
  const { error } = await sb.from('propriedades').update({ publicada: false, rejeitada: true }).eq('id', id);
  if (error) { toast('Erro ao rejeitar', 'error'); return; }
  toast('❌ Propriedade rejeitada', 'error');
  await loadAllData();
  renderPendentes();
}

function verProp(id) {
  const p = allProps.find(p => p.id == id);
  if (!p) return;
  const owner = allUsers.find(u => u.id === p.usuario_id);
  const ass = allAss.find(a => a.usuario_id === p.usuario_id);
  document.getElementById('mp-nome').textContent = `🏡 ${p.nome || 'Sem nome'}`;
  document.getElementById('mp-sub').textContent = `${p.tipo_propriedade || p.categoria || '—'} · ${p.cidade || '—'}, ${p.estado || '—'}`;
  document.getElementById('mp-details').innerHTML = `
    <div class="detail-row"><div class="detail-key">ID</div><div class="detail-val">#${p.id}</div></div>
    <div class="detail-row"><div class="detail-key">Dono</div><div class="detail-val">${owner?.nome||'—'}</div></div>
    <div class="detail-row"><div class="detail-key">Status</div><div class="detail-val">${p.publicada ? '✅ Ativa' : '⏳ Pendente'}</div></div>
    <div class="detail-row"><div class="detail-key">Plano do dono</div><div class="detail-val">${ass?.plano_ativo||'básico'}</div></div>
    <div class="detail-row"><div class="detail-key">Capacidade</div><div class="detail-val">${p.capacidade || '—'} pessoas</div></div>
    <div class="detail-row"><div class="detail-key">Valor base</div><div class="detail-val">R$ ${p.valor_base || '—'}</div></div>
    <div class="detail-row"><div class="detail-key">WhatsApp</div><div class="detail-val">${p.whatsapp || '—'}</div></div>
    <div class="detail-row"><div class="detail-key">Email contato</div><div class="detail-val">${p.email_contato || '—'}</div></div>
    <div class="detail-row"><div class="detail-key">CEP</div><div class="detail-val">${p.cep || '—'}</div></div>
    <div class="detail-row"><div class="detail-key">Endereço</div><div class="detail-val">${p.rua ? `${p.rua}, ${p.numero||''} - ${p.bairro||''}` : p.endereco||'—'}</div></div>
  `;
  document.getElementById('mp-footer').innerHTML = !p.publicada
    ? `<button class="btn btn-danger" onclick="closeModal('modal-prop')">Fechar</button>
       <button class="btn btn-success" onclick="liberarProp('${p.id}');closeModal('modal-prop')">✅ Liberar esta propriedade</button>`
    : `<button class="btn btn-ghost" onclick="closeModal('modal-prop')">Fechar</button>
       <button class="btn btn-warn" onclick="suspenderProp('${p.id}');closeModal('modal-prop')">⏸ Suspender</button>`;
  openModal('modal-prop');
}

// ─── AÇÕES: USUÁRIOS ───
function editUser(id) {
  const u = allUsers.find(u => u.id === id);
  if (!u) return;
  document.getElementById('mu-id').value = id;
  document.getElementById('mu-nome').value = u.nome || '';
  document.getElementById('mu-usuario').value = u.usuario || '';
  document.getElementById('mu-telefone').value = u.telefone || '';
  document.getElementById('mu-sub').textContent = u.email || id;
  openModal('modal-user');
}

async function saveUser() {
  const id = document.getElementById('mu-id').value;
  const payload = {
    nome: document.getElementById('mu-nome').value,
    usuario: document.getElementById('mu-usuario').value,
    telefone: document.getElementById('mu-telefone').value
  };
  const { error } = await sb.from('usuarios').update(payload).eq('id', id);
  if (error) { toast('Erro ao salvar: ' + error.message, 'error'); return; }
  const idx = allUsers.findIndex(u => u.id === id);
  if (idx >= 0) Object.assign(allUsers[idx], payload);
  addLog('usuario', `Usuário editado: ${payload.nome}`, `@${payload.usuario}`);
  closeModal('modal-user');
  toast('✅ Usuário atualizado!', 'success');
  renderUsuarios();
  renderRecentUsers();
}

// ─── AÇÕES: ASSINATURAS ───
function editAss(userId) {
  const u = allUsers.find(u => u.id === userId);
  const a = allAss.find(a => a.usuario_id === userId);
  document.getElementById('mass-id').value = a?.id || '';
  document.getElementById('mass-sub').textContent = u?.nome || userId;
  document.getElementById('mass-plano').value = a?.plano_ativo || 'basico';
  document.getElementById('mass-status').value = a?.status || 'ativa';
  document.getElementById('mass-fim').value = a?.fim_periodo ? a.fim_periodo.substring(0,10) : '';
  // Store userId for save
  document.getElementById('mass-id').dataset.userId = userId;
  openModal('modal-ass');
}

async function saveAss() {
  const id = document.getElementById('mass-id').value;
  const userId = document.getElementById('mass-id').dataset.userId;
  const plano = document.getElementById('mass-plano').value;
  const status = document.getElementById('mass-status').value;
  const fim = document.getElementById('mass-fim').value;
  const payload = { plano_ativo: plano, status, fim_periodo: fim || null, atualizado_em: new Date().toISOString() };
  let error;
  if (id) {
    ({ error } = await sb.from('assinaturas').update(payload).eq('id', id));
  } else {
    ({ error } = await sb.from('assinaturas').insert({ ...payload, usuario_id: userId, inicio_periodo: new Date().toISOString().substring(0,10), valor_pago: 0, moeda: 'BRL', criado_em: new Date().toISOString() }));
  }
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  await loadAllData();
  const u2 = allUsers.find(u => u.id === userId);
  addLog('assinatura', `Assinatura alterada: ${u2?.nome || userId}`, `Plano ${plano} · status ${status}`);
  closeModal('modal-ass');
  toast('💳 Assinatura atualizada!', 'success');
  renderAssinaturas();
  renderRecentUsers();
}

// ══════════════════════════════════════════════
// ─── EDITOR DE PLANOS ───
// ══════════════════════════════════════════════
async function carregarPlanos() {
  const p = getPlanPrices();
  const el = (id) => document.getElementById(id);
  if (el('plano-basico-preco')) el('plano-basico-preco').value = p.basico;
  if (el('plano-pro-preco'))    el('plano-pro-preco').value    = p.pro;
  if (el('plano-ultra-preco'))  el('plano-ultra-preco').value  = p.ultra;

  // Carrega benefícios e status do Supabase
  try {
    const { data, error } = await sb.from('planos_config').select('*');
    if (!error && data) {
      data.forEach(row => {
        const itemsEl  = el(`plano-${row.id}-items`);
        const statusEl = el(`plano-${row.id}-status`);
        const precoEl  = el(`plano-${row.id}-preco`);
        if (precoEl)  precoEl.value  = row.preco;
        if (itemsEl)  itemsEl.value  = (row.items || []).join('\n');
        if (statusEl) statusEl.value = row.status || 'ativo';
      });
    }
  } catch(e) { console.warn('Erro ao carregar planos:', e); }
}

async function salvarPlanos() {
  const basico = Number(document.getElementById('plano-basico-preco').value) || 0;
  const pro    = Number(document.getElementById('plano-pro-preco').value) || 99;
  const ultra  = Number(document.getElementById('plano-ultra-preco').value) || 249;
  const prices = { basico, pro, ultra };
  savePlanPrices(prices);
  PLAN_PRICES = prices;

  const btn = document.querySelector('[onclick="salvarPlanos()"]');
  if (btn) { btn.textContent = '⏳ Salvando...'; btn.disabled = true; }

  const registros = [
    {
      id: 'basico',
      preco: basico,
      items: (document.getElementById('plano-basico-items').value || '').split('\n').map(s => s.trim()).filter(Boolean),
      status: document.getElementById('plano-basico-status').value || 'ativo',
      atualizado_em: new Date().toISOString()
    },
    {
      id: 'pro',
      preco: pro,
      items: (document.getElementById('plano-pro-items').value || '').split('\n').map(s => s.trim()).filter(Boolean),
      status: document.getElementById('plano-pro-status').value || 'ativo',
      atualizado_em: new Date().toISOString()
    },
    {
      id: 'ultra',
      preco: ultra,
      items: (document.getElementById('plano-ultra-items').value || '').split('\n').map(s => s.trim()).filter(Boolean),
      status: document.getElementById('plano-ultra-status').value || 'ativo',
      atualizado_em: new Date().toISOString()
    }
  ];

  const { error } = await sb.from('planos_config').upsert(registros, { onConflict: 'id' });

  if (btn) { btn.textContent = '💾 Salvar configurações de planos'; btn.disabled = false; }

  if (error) {
    toast('Erro ao salvar planos: ' + error.message, 'error');
    return;
  }

  addLog('sistema', 'Planos atualizados', `Básico R$${basico} · Pro R$${pro} · Ultra R$${ultra}`);
  toast('💾 Planos salvos! As páginas planos.html e planos2.html foram atualizadas.', 'success');
}

// ══════════════════════════════════════════════
// ─── EDITOR DE PROPRIEDADE (WYSIWYG ADMIN) ───
// ══════════════════════════════════════════════
function editarProp(id) {
  const p = allProps.find(p => p.id == id);
  if (!p) return;
  const owner = allUsers.find(u => u.id === p.usuario_id);
  document.getElementById('mep-id').value = id;
  document.getElementById('mep-sub').textContent = `Dono: ${owner?.nome || 'Desconhecido'} · ID #${id}`;
  document.getElementById('mep-nome').value      = p.nome || '';
  document.getElementById('mep-cidade').value    = p.cidade || '';
  document.getElementById('mep-estado').value    = p.estado || '';
  document.getElementById('mep-capacidade').value= p.capacidade || '';
  document.getElementById('mep-valor').value     = p.valor_base || '';
  document.getElementById('mep-whatsapp').value  = p.whatsapp || '';
  document.getElementById('mep-email').value     = p.email_contato || '';
  document.getElementById('mep-tipo').value      = p.tipo_propriedade || p.categoria || '';
  document.getElementById('mep-descricao').value = p.descricao || '';
  document.getElementById('mep-cep').value       = p.cep || '';
  document.getElementById('mep-endereco').value  = p.rua ? `${p.rua}, ${p.numero||''} - ${p.bairro||''}` : (p.endereco || '');
  document.getElementById('mep-publicada').checked = !!p.publicada;
  document.getElementById('mep-destaque').checked  = !!p.destaque;
  openModal('modal-edit-prop');
}

async function saveProp() {
  const id = document.getElementById('mep-id').value;
  const p  = allProps.find(x => x.id == id);
  const payload = {
    nome:           document.getElementById('mep-nome').value.trim() || null,
    cidade:         document.getElementById('mep-cidade').value.trim() || null,
    estado:         document.getElementById('mep-estado').value.trim().toUpperCase() || null,
    capacidade:     Number(document.getElementById('mep-capacidade').value) || null,
    valor_base:     Number(document.getElementById('mep-valor').value) || null,
    whatsapp:       document.getElementById('mep-whatsapp').value.trim() || null,
    email_contato:  document.getElementById('mep-email').value.trim() || null,
    tipo_propriedade: document.getElementById('mep-tipo').value.trim() || null,
    descricao:      document.getElementById('mep-descricao').value.trim() || null,
    cep:            document.getElementById('mep-cep').value.trim() || null,
    publicada:      document.getElementById('mep-publicada').checked,
    destaque:       document.getElementById('mep-destaque').checked,
  };
  const { error } = await sb.from('propriedades').update(payload).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  // Log de alterações com diff
  const diffs = [];
  if (p?.nome !== payload.nome) diffs.push(`Nome: "${p?.nome}" → "${payload.nome}"`);
  if (Number(p?.valor_base) !== payload.valor_base) diffs.push(`Valor: R$${p?.valor_base||0} → R$${payload.valor_base||0}`);
  if (p?.publicada !== payload.publicada) diffs.push(`Publicada: ${p?.publicada} → ${payload.publicada}`);
  const idx = allProps.findIndex(x => x.id == id);
  if (idx >= 0) Object.assign(allProps[idx], payload);
  addLog('propriedade', `Propriedade editada pelo admin: ${payload.nome}`, diffs.join(' | ') || 'campos atualizados');
  closeModal('modal-edit-prop');
  toast('✅ Propriedade atualizada!', 'success');
  renderPropriedades();
  renderPendentes();
  renderDashboard();
}

// ─── DESTAQUE ───
async function fixarDestaque(id) {
  const { error } = await sb.from('propriedades').update({ destaque: true }).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  const p = allProps.find(x => x.id == id);
  if (p) p.destaque = true;
  addLog('propriedade', `Propriedade fixada em destaque: ${p?.nome||id}`, '');
  toast('📌 Propriedade fixada no destaque!', 'success');
  renderPropriedades();
}

async function removerDestaque(id) {
  const { error } = await sb.from('propriedades').update({ destaque: false }).eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  const p = allProps.find(x => x.id == id);
  if (p) p.destaque = false;
  toast('📌 Destaque removido', 'info');
  renderPropriedades();
}

// ══════════════════════════════════════════════
// ─── LOGS DE AUDITORIA (localStorage) ───
// ══════════════════════════════════════════════
function addLog(tipo, acao, detalhe = '') {
  const logs = JSON.parse(localStorage.getItem('ventsy_admin_logs') || '[]');
  logs.unshift({ id: Date.now(), tipo, acao, detalhe, admin: adminEmail, ts: new Date().toISOString() });
  if (logs.length > 300) logs.splice(300);
  localStorage.setItem('ventsy_admin_logs', JSON.stringify(logs));
}

function renderLogs() {
  const filter = document.getElementById('log-filter')?.value || '';
  let logs = JSON.parse(localStorage.getItem('ventsy_admin_logs') || '[]');
  if (filter) logs = logs.filter(l => l.tipo === filter);
  document.getElementById('logs-count').textContent = `${logs.length} registros`;
  const container = document.getElementById('logs-list');
  if (!logs.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>Nenhum log registrado ainda. As ações do admin aparecem aqui automaticamente.</p></div>`;
    return;
  }
  const icons = { propriedade:'🏡', usuario:'👤', assinatura:'💳', cupom:'🎟️', comunicacao:'📣', sistema:'⚙️' };
  const colors = { propriedade:'var(--green)', usuario:'var(--blue)', assinatura:'var(--purple)', cupom:'var(--yellow)', comunicacao:'var(--red)', sistema:'var(--text3)' };
  container.innerHTML = logs.map(l => {
    const dt = new Date(l.ts).toLocaleString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    const bg = (colors[l.tipo] || 'var(--bg4)').replace('var(', '').replace(')', '');
    return `<div class="log-item">
      <div class="log-dot" style="background:${colors[l.tipo]||'var(--bg4)'}22;">${icons[l.tipo]||'•'}</div>
      <div class="log-body">
        <div class="log-action">${l.acao}</div>
        ${l.detalhe ? `<div class="log-meta">${l.detalhe}</div>` : ''}
        <div class="log-meta" style="margin-top:2px;">👤 ${l.admin || 'admin'}</div>
      </div>
      <div class="log-time">${dt}</div>
    </div>`;
  }).join('');
}

function clearLogs() {
  if (!confirm('Limpar todos os logs de auditoria?')) return;
  localStorage.removeItem('ventsy_admin_logs');
  renderLogs();
  toast('🗑️ Logs apagados', 'info');
}

// ══════════════════════════════════════════════
// ─── FINANCEIRO ───
// ══════════════════════════════════════════════
// PLAN_PRICES lê do localStorage para refletir edições do admin
function getPlanPrices() {
  try {
    const saved = localStorage.getItem('ventsy_plan_prices');
    if (saved) return JSON.parse(saved);
  } catch(e) {}
  return { basico: 0, pro: 99, ultra: 249 };
}
function savePlanPrices(prices) {
  localStorage.setItem('ventsy_plan_prices', JSON.stringify(prices));
}
let PLAN_PRICES = getPlanPrices();

function renderFinanceiro() {
  PLAN_PRICES = getPlanPrices(); // recarrega preços dinâmicos
  const ativas = allAss.filter(a => a.status === 'ativa' || a.status === 'trial');

  // MRR / ARR
  const mrr = ativas.reduce((sum, a) => sum + (PLAN_PRICES[a.plano_ativo] || 0), 0);
  setValue('fin-mrr', `R$${mrr.toLocaleString('pt-BR')}`);
  setValue('fin-arr', `R$${(mrr * 12).toLocaleString('pt-BR')}`);

  // Receita total histórica (valor_pago registrado manualmente nas assinaturas)
  const total = allAss.reduce((sum, a) => sum + Number(a.valor_pago || 0), 0);
  const totalEl = document.getElementById('fin-total');
  if (totalEl) {
    totalEl.textContent = `R$${total.toLocaleString('pt-BR', {minimumFractionDigits:2,maximumFractionDigits:2})}`;
    totalEl.classList.remove('loading');
    totalEl.title = 'Baseado no campo valor_pago das assinaturas. Atualize manualmente ao confirmar pagamentos.';
  }

  // ARPU
  const arpu = ativas.length ? (mrr / ativas.length) : 0;
  setValue('fin-arpu', `R$${arpu.toFixed(0)}`);

  // Churn
  const canceladas = allAss.filter(a => a.status === 'cancelada' || a.status === 'expirada').length;
  const churnRate = allAss.length ? ((canceladas / allAss.length) * 100).toFixed(1) : 0;
  setValue('fin-churn', `${churnRate}%`);

  // LTV = ARPU / churn mensal estimado
  const ltv = churnRate > 0 ? Math.round(arpu / (churnRate / 100)) : 0;
  setValue('fin-ltv', ltv > 0 ? `R$${ltv.toLocaleString('pt-BR')}` : 'N/A');

  // Novos MRR 30d
  const d30 = new Date(Date.now() - 30 * 864e5);
  const novos = allAss.filter(a => a.criado_em && new Date(a.criado_em) >= d30 && (a.status === 'ativa' || a.status === 'trial'));
  const novosMrr = novos.reduce((sum, a) => sum + (PLAN_PRICES[a.plano_ativo] || 0), 0);
  setValue('fin-novos-mrr', `R$${novosMrr.toLocaleString('pt-BR')}`);

  // Alertas
  const alertsEl = document.getElementById('fin-alerts');
  let alerts = '';
  if (Number(churnRate) > 20) alerts += `<div class="alert-banner danger">⚠️ Taxa de churn alta (${churnRate}%) — considere estratégias de retenção</div>`;
  if (mrr === 0 && allAss.length > 0) alerts += `<div class="alert-banner warn">💡 MRR zerado — verifique se as assinaturas estão registradas com valor_pago</div>`;
  const expirando = allAss.filter(a => { if (!a.fim_periodo) return false; const d = new Date(a.fim_periodo); return d >= new Date() && d <= new Date(Date.now()+7*864e5) && a.status !== 'cancelada'; }).length;
  if (expirando > 0) alerts += `<div class="alert-banner info">🔔 ${expirando} assinatura${expirando>1?'s':''} vence${expirando>1?'m':''} em até 7 dias</div>`;
  alertsEl.innerHTML = alerts;

  renderChartReceitaMensal();
  renderChartReceitaPlanos(mrr);
  renderFinBreakdown(mrr);
  renderFinVencimentos();
  renderFinPagamentos();
}

function renderChartReceitaMensal() {
  const labels = [], meses = [];
  const hoje = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    labels.push(d.toLocaleDateString('pt-BR', { month:'short', year:'2-digit' }));
    meses.push({ y: d.getFullYear(), m: d.getMonth() });
  }
  const data = meses.map(({ y, m }) =>
    allAss.filter(a => { if (!a.inicio_periodo) return false; const d = new Date(a.inicio_periodo); return d.getFullYear()===y && d.getMonth()===m; })
          .reduce((sum, a) => sum + Number(a.valor_pago || 0), 0)
  );
  if (window._chartRecMensal) window._chartRecMensal.destroy();
  window._chartRecMensal = new Chart(document.getElementById('chart-receita-mensal').getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label:'Receita (R$)', data, backgroundColor:'rgba(12,166,120,0.7)', borderRadius:6, borderSkipped:false }] },
    options: {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false} },
      scales: {
        x:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#a0a0b8'} },
        y:{ grid:{color:'rgba(255,255,255,0.04)'}, ticks:{color:'#5c5c78', callback:v=>`R$${v}`}, beginAtZero:true }
      }
    }
  });
}

function renderChartReceitaPlanos(mrr) {
  const pro  = allAss.filter(a => a.plano_ativo==='pro'  && (a.status==='ativa'||a.status==='trial')).length * 99;
  const ultra= allAss.filter(a => a.plano_ativo==='ultra' && (a.status==='ativa'||a.status==='trial')).length * 249;
  if (window._chartRecPlanos) window._chartRecPlanos.destroy();
  window._chartRecPlanos = new Chart(document.getElementById('chart-receita-planos').getContext('2d'), {
    type: 'doughnut',
    data: { labels:['Pro (R$99)','Ultra (R$249)'], datasets:[{ data:[pro, ultra], backgroundColor:['#3b82f6','#8b5cf6'], borderWidth:0 }] },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{position:'bottom', labels:{color:'#a0a0b8', font:{size:11}, padding:16}} }, cutout:'60%' }
  });
}

function renderFinBreakdown(mrr) {
  const plans = [
    { key:'basico', label:'Básico', price:0 },
    { key:'pro',    label:'Pro ⭐', price:99 },
    { key:'ultra',  label:'Ultra 🚀', price:249 }
  ];
  const barColors = { basico:'#888', pro:'var(--blue)', ultra:'var(--purple)' };
  document.getElementById('fin-breakdown-tbody').innerHTML = plans.map(p => {
    const cnt = allAss.filter(a => a.plano_ativo===p.key && (a.status==='ativa'||a.status==='trial')).length;
    const rev = cnt * p.price;
    const pct = mrr > 0 ? ((rev/mrr)*100).toFixed(1) : 0;
    return `<tr>
      <td><span class="badge plano-${p.key}">${p.label}</span></td>
      <td style="color:var(--text);font-weight:600;">${cnt}</td>
      <td style="color:var(--text2);">R$${p.price}/mês</td>
      <td style="color:var(--text);font-weight:700;">R$${rev.toLocaleString('pt-BR')}</td>
      <td style="min-width:140px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <div class="revenue-bar" style="flex:1;"><div class="revenue-bar-fill" style="width:${pct}%;background:${barColors[p.key]};"></div></div>
          <span style="font-size:0.75rem;color:var(--text3);width:36px;text-align:right;">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

function renderFinVencimentos() {
  const hoje = new Date();
  const em30 = new Date(Date.now() + 30*864e5);
  const venc = allAss.filter(a => { if(!a.fim_periodo) return false; const f=new Date(a.fim_periodo); return f>=hoje && f<=em30 && a.status!=='cancelada'; })
                     .sort((a,b) => new Date(a.fim_periodo)-new Date(b.fim_periodo));
  document.getElementById('fin-venc-count').textContent = `${venc.length} assinaturas`;
  const tbody = document.getElementById('fin-venc-tbody');
  if (!venc.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);">Nenhuma assinatura vence nos próximos 30 dias</td></tr>'; return; }
  tbody.innerHTML = venc.map(a => {
    const user = allUsers.find(u => u.id===a.usuario_id);
    const fim = new Date(a.fim_periodo);
    const dias = Math.ceil((fim-hoje)/864e5);
    const cls = dias<=7?'badge-red':dias<=15?'badge-yellow':'badge-green';
    return `<tr>
      <td><div class="td-name"><div class="td-avatar">${(user?.nome||'?')[0].toUpperCase()}</div>${user?.nome||'Desconhecido'}</div></td>
      <td><span class="badge plano-${a.plano_ativo}">${a.plano_ativo}</span></td>
      <td style="color:var(--text2);">${fim.toLocaleDateString('pt-BR')}</td>
      <td><span class="badge ${cls}">${dias} dias</span></td>
      <td><button class="btn btn-ghost btn-sm" onclick="editAss('${a.usuario_id}')">🔄 Renovar</button></td>
    </tr>`;
  }).join('');
}

function renderFinPagamentos() {
  const sorted = [...allAss].filter(a=>Number(a.valor_pago)>0)
    .sort((a,b)=>new Date(b.criado_em||0)-new Date(a.criado_em||0)).slice(0,20);
  const tbody = document.getElementById('fin-pagamentos-tbody');
  if (!sorted.length) { tbody.innerHTML='<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--text3);">Nenhum pagamento registrado (valor_pago > 0)</td></tr>'; return; }
  tbody.innerHTML = sorted.map(a => {
    const user = allUsers.find(u=>u.id===a.usuario_id);
    const dt = a.inicio_periodo ? new Date(a.inicio_periodo).toLocaleDateString('pt-BR') : '—';
    return `<tr>
      <td><div class="td-name"><div class="td-avatar">${(user?.nome||'?')[0].toUpperCase()}</div>${user?.nome||'Desconhecido'}</div></td>
      <td><span class="badge plano-${a.plano_ativo}">${a.plano_ativo||'—'}</span></td>
      <td style="color:var(--green);font-weight:700;">R$ ${Number(a.valor_pago).toFixed(2)}</td>
      <td style="color:var(--text3);">${dt}</td>
      <td>${badgeStatus(a.status)}</td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════
// ─── QUALIDADE ───
// ══════════════════════════════════════════════
function renderQualidade() {
  const pubProps = allProps.filter(p => p.publicada);
  // Fotos ficam na tabela fotos_imovel (separada das propriedades)
  const propsComFoto = new Set(allFotos.map(f => f.propriedade_id));
  const semFoto = pubProps.filter(p => !propsComFoto.has(p.id)).length;
  const semDesc = pubProps.filter(p => !p.descricao?.trim()).length;
  const semWa   = pubProps.filter(p => !p.whatsapp?.trim()).length;
  const usersComProp = new Set(allProps.map(p => p.usuario_id));
  const semProp = allUsers.filter(u => !usersComProp.has(u.id)).length;

  setValue('q-sem-foto', semFoto);
  setValue('q-sem-desc', semDesc);
  setValue('q-sem-wa',   semWa);
  setValue('q-sem-prop', semProp);

  // Score de qualidade
  let score = 100;
  if (pubProps.length > 0) {
    score -= (semFoto / pubProps.length) * 40;
    score -= (semDesc / pubProps.length) * 30;
    score -= (semWa   / pubProps.length) * 20;
  }
  score = Math.max(0, Math.round(score));
  const color = score>=80 ? 'var(--green)' : score>=50 ? 'var(--yellow)' : 'var(--red)';
  const ring = document.getElementById('quality-ring');
  ring.style.background = `conic-gradient(${color} ${score}%, var(--bg4) ${score}%)`;
  ring.style.color = color;
  ring.style.boxShadow = `0 0 0 4px ${color}22`;
  ring.textContent = score;

  const grade = score>=80 ? '😃 Excelente' : score>=60 ? '😐 Regular' : '😟 Crítico';
  const desc  = score>=80 ? 'Plataforma em ótimo estado! Continue assim.' :
                score>=60 ? 'Alguns perfis precisam de atenção para melhorar conversão.' :
                score>=40 ? 'Vários perfis incompletos — impacta diretamente a conversão.' :
                            'Muitos perfis incompletos — ação urgente necessária!';
  document.getElementById('quality-desc').innerHTML = `
    <strong style="color:${color}">${grade}</strong> — ${desc}<br>
    <span style="color:var(--text3);font-size:0.78rem;">
      ${semFoto} sem foto · ${semDesc} sem descrição · ${semWa} sem WhatsApp · ${semProp} usuários sem propriedade
    </span>`;

  // Propriedades com problemas
  const propsComProblemas = allProps.map(p => {
    const issues = [];
    if (!propsComFoto.has(p.id)) issues.push('📷 Sem foto');
    if (!p.descricao?.trim()) issues.push('📝 Sem descrição');
    if (!p.whatsapp?.trim()) issues.push('📱 Sem WhatsApp');
    if (!p.cidade?.trim()) issues.push('📍 Sem cidade');
    const propScore = Math.round(100 - (issues.length / 4) * 100);
    return { ...p, issues, propScore };
  }).filter(p => p.issues.length > 0).sort((a,b) => a.propScore - b.propScore);

  const tbody = document.getElementById('q-props-tbody');
  if (!propsComProblemas.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:24px;color:var(--green);">✅ Todas as propriedades têm perfil completo!</td></tr>';
  } else {
    tbody.innerHTML = propsComProblemas.slice(0,25).map(p => {
      const owner = allUsers.find(u=>u.id===p.usuario_id);
      const sc = p.propScore;
      const scColor = sc>=70?'var(--yellow)':sc>=40?'var(--red)':'var(--red)';
      return `<tr>
        <td><div class="td-name">
          <div style="width:32px;height:32px;border-radius:7px;background:var(--bg4);display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">🏡</div>
          <span style="font-weight:600;color:var(--text)">${p.nome||'Sem nome'}</span>
        </div></td>
        <td style="color:var(--text2);">${owner?.nome||'—'}</td>
        <td>${p.issues.map(i=>`<span class="badge badge-yellow" style="margin-right:4px;margin-bottom:2px;">${i}</span>`).join('')}</td>
        <td><span style="font-weight:800;color:${scColor};font-family:var(--font-display)">${sc}%</span></td>
        <td><div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="verProp('${p.id}')">👁 Ver</button>
          ${!p.publicada ? `<button class="btn btn-success btn-sm" onclick="liberarProp('${p.id}')">✅</button>` : ''}
        </div></td>
      </tr>`;
    }).join('');
  }

  // Usuários sem propriedade
  const semPropUsers = allUsers.filter(u => !usersComProp.has(u.id));
  const tbody2 = document.getElementById('q-users-tbody');
  if (!semPropUsers.length) {
    tbody2.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--green);">✅ Todos os usuários têm propriedade</td></tr>';
  } else {
    tbody2.innerHTML = semPropUsers.slice(0,20).map(u => {
      const ass = allAss.find(a=>a.usuario_id===u.id);
      const dt = u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR') : '—';
      return `<tr>
        <td><div class="td-name"><div class="td-avatar">${(u.nome||'?')[0].toUpperCase()}</div>${u.nome||'Sem nome'}<span style="color:var(--text3);font-size:0.78rem;margin-left:4px;">@${u.usuario||'—'}</span></div></td>
        <td><span class="badge plano-${ass?.plano_ativo||'basico'}">${ass?.plano_ativo||'básico'}</span></td>
        <td style="color:var(--text3);">${dt}</td>
        <td><div style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick="editUser('${u.id}')">✏️ Editar</button>
          <button class="btn btn-ghost btn-sm" onclick="editAss('${u.id}')">💳 Plano</button>
        </div></td>
      </tr>`;
    }).join('');
  }
}

function exportQualidade() {
  const propsComProblemas = allProps.filter(p => {
    const issues = [];
    if (!p.foto_capa && !p.foto_principal) issues.push('Sem foto');
    if (!p.descricao?.trim()) issues.push('Sem descrição');
    if (!p.whatsapp?.trim()) issues.push('Sem WhatsApp');
    return issues.length > 0;
  });
  const csv = ['Nome,Cidade,Estado,Status,Problemas']
    .concat(propsComProblemas.map(p => {
      const issues = [];
      if (!p.foto_capa && !p.foto_principal) issues.push('Sem foto');
      if (!p.descricao?.trim()) issues.push('Sem descrição');
      if (!p.whatsapp?.trim()) issues.push('Sem WhatsApp');
      return `"${p.nome||''}","${p.cidade||''}","${p.estado||''}","${p.publicada?'Ativa':'Pendente'}","${issues.join('; ')}"`;
    })).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type:'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `qualidade-propriedades-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  addLog('sistema', 'Exportou relatório de qualidade', `${propsComProblemas.length} propriedades`);
  toast('📊 CSV exportado!', 'success');
}

// ══════════════════════════════════════════════
// ─── COMUNICAÇÃO ───
// ══════════════════════════════════════════════
function updateComCount() {
  const dest = document.getElementById('com-destinatario')?.value || 'todos';
  let count = 0;
  if (dest === 'todos') count = allUsers.length;
  else if (['basico','pro','ultra'].includes(dest)) count = allAss.filter(a=>a.plano_ativo===dest && (a.status==='ativa'||a.status==='trial')).length;
  else if (dest === 'trial') count = allAss.filter(a=>a.status==='trial').length;
  else if (dest === 'sem_assinatura') count = allUsers.filter(u=>!allAss.find(a=>a.usuario_id===u.id)).length;
  const el = document.getElementById('com-count-num');
  if (el) el.textContent = count;

  const stats = [
    { label:'👥 Todos os usuários', value:allUsers.length, color:'var(--text)' },
    { label:'⚪ Básico', value:allAss.filter(a=>a.plano_ativo==='basico'&&(a.status==='ativa'||a.status==='trial')).length, color:'var(--text3)' },
    { label:'⭐ Pro', value:allAss.filter(a=>a.plano_ativo==='pro'&&(a.status==='ativa'||a.status==='trial')).length, color:'var(--blue)' },
    { label:'🚀 Ultra', value:allAss.filter(a=>a.plano_ativo==='ultra'&&(a.status==='ativa'||a.status==='trial')).length, color:'var(--purple)' },
    { label:'🎁 Trial', value:allAss.filter(a=>a.status==='trial').length, color:'var(--yellow)' },
    { label:'🔓 Sem assinatura', value:allUsers.filter(u=>!allAss.find(a=>a.usuario_id===u.id)).length, color:'var(--text3)' },
  ];
  const statsEl = document.getElementById('com-stats');
  if (statsEl) statsEl.innerHTML = stats.map(s=>`
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:0.84rem;color:var(--text2);">${s.label}</span>
      <span style="font-family:var(--font-display);font-weight:800;color:${s.color};">${s.value}</span>
    </div>`).join('');
}

function clearCompose() {
  ['com-titulo','com-mensagem'].forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  const d = document.getElementById('com-destinatario'); if(d) d.value='todos';
  const t = document.getElementById('com-tipo'); if(t) t.value='info';
  updateComCount();
}

async function enviarMensagem() {
  const dest   = document.getElementById('com-destinatario').value;
  const tipo   = document.getElementById('com-tipo').value;
  const titulo = document.getElementById('com-titulo').value.trim();
  const msg    = document.getElementById('com-mensagem').value.trim();
  if (!titulo || !msg) { toast('Preencha título e mensagem', 'error'); return; }

  // Monta lista de e-mails baseada no segmento
  let destinatarios = [];
  if (dest === 'todos') destinatarios = allUsers.filter(u => u.email).map(u => u.email);
  else if (['basico','pro','ultra'].includes(dest)) {
    const ids = allAss.filter(a => a.plano_ativo === dest && (a.status === 'ativa' || a.status === 'trial')).map(a => a.usuario_id);
    destinatarios = allUsers.filter(u => ids.includes(u.id) && u.email).map(u => u.email);
  } else if (dest === 'trial') {
    const ids = allAss.filter(a => a.status === 'trial').map(a => a.usuario_id);
    destinatarios = allUsers.filter(u => ids.includes(u.id) && u.email).map(u => u.email);
  } else if (dest === 'sem_assinatura') {
    destinatarios = allUsers.filter(u => !allAss.find(a => a.usuario_id === u.id) && u.email).map(u => u.email);
  }

  const count = destinatarios.length;
  if (!count) { toast('Nenhum destinatário com e-mail cadastrado para este segmento', 'error'); return; }
  if (!confirm(`Enviar e-mail para ${count} usuário(s) do segmento "${dest}"?\n\nIsto enviará e-mails REAIS via Resend.`)) return;

  const btn = document.querySelector('#page-comunicacao .btn-primary');
  if (btn) { btn.textContent = '⏳ Enviando...'; btn.disabled = true; }

  const tipoIcons = { info:'ℹ️', promo:'🎁', alerta:'⚠️', atualizacao:'🔄' };
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
      <div style="background:#0a0a0f;padding:24px;border-radius:12px 12px 0 0;text-align:center;">
        <span style="font-family:Arial,sans-serif;font-size:1.6rem;font-weight:900;color:#fff;letter-spacing:-1px;">VENT<span style="color:#ff385c;">SY</span></span>
      </div>
      <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #eee;">
        <h2 style="margin:0 0 16px;color:#111;">${tipoIcons[tipo]||'📣'} ${titulo}</h2>
        <div style="color:#444;line-height:1.7;font-size:0.95rem;">${msg.replace(/\n/g,'<br>')}</div>
        <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">
        <p style="color:#aaa;font-size:0.78rem;text-align:center;">Ventsy — Encontre o espaço perfeito para o seu evento</p>
      </div>
    </div>`;

  const { data: { session } } = await sb.auth.getSession();
  let enviados = 0, erros = 0;

  // Envia em lotes de 10 para não sobrecarregar
  const lotes = [];
  for (let i = 0; i < destinatarios.length; i += 10) lotes.push(destinatarios.slice(i, i+10));

  for (const lote of lotes) {
    await Promise.all(lote.map(async email => {
      try {
        const res = await fetch(`${SUPA_URL}/functions/v1/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || SUPA_KEY}` },
          body: JSON.stringify({ to: email, subject: titulo, html, from_name: 'Ventsy' }),
        });
        if (res.ok) enviados++; else erros++;
      } catch { erros++; }
    }));
  }

  // Salva no histórico
  const hist = JSON.parse(localStorage.getItem('ventsy_com_historico') || '[]');
  hist.unshift({ titulo, msg, dest, tipo, count: enviados, ts: new Date().toISOString() });
  if (hist.length > 50) hist.splice(50);
  localStorage.setItem('ventsy_com_historico', JSON.stringify(hist));

  addLog('comunicacao', `E-mail enviado: "${titulo}"`, `${enviados} enviados · ${erros} erros · segmento: ${dest}`);
  toast(`📤 ${enviados} e-mail(s) enviados!${erros ? ` (${erros} erros)` : ''}`, enviados > 0 ? 'success' : 'error');
  clearCompose();
  renderComHistorico();
  if (btn) { btn.textContent = '📤 Enviar'; btn.disabled = false; }
}

function renderComHistorico() {
  const hist = JSON.parse(localStorage.getItem('ventsy_com_historico') || '[]');
  const container = document.getElementById('com-historico');
  if (!container) return;
  if (!hist.length) {
    container.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text3);font-size:0.82rem;">Nenhuma mensagem enviada ainda</div>';
    return;
  }
  const tipoIcons = { info:'ℹ️', promo:'🎁', alerta:'⚠️', atualizacao:'🔄' };
  container.innerHTML = hist.slice(0,6).map(h => {
    const dt = new Date(h.ts).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' });
    return `<div class="activity-item">
      <div class="activity-dot" style="background:var(--blue);"></div>
      <div class="activity-text">
        <strong>${tipoIcons[h.tipo]||'📣'} ${h.titulo}</strong><br>
        <span style="font-size:0.75rem;color:var(--text3);">${h.count} dest. · ${h.dest}</span>
      </div>
      <div class="activity-time">${dt}</div>
    </div>`;
  }).join('');
}

// ══════════════════════════════════════════════
// ─── CUPONS ───
// ══════════════════════════════════════════════
let allCupons = [];

async function loadCupons() {
  const { data, error } = await sb.from('cupons').select('*').order('criado_em', { ascending: false });
  if (!error) allCupons = data || [];
  // If table doesn't exist, silently ignore (error.code 42P01)
}

function renderCupons() {
  document.getElementById('cup-count').textContent = `${allCupons.length} cupons`;
  const container = document.getElementById('cupons-list');
  if (!allCupons.length) {
    container.innerHTML = `<div class="empty-state"><div class="icon">🎟️</div><p>Nenhum cupom criado ainda.<br><span style="font-size:0.78rem;">Crie a tabela <code style="color:var(--red);">cupons</code> no Supabase para ativar este módulo.</span></p></div>`;
    return;
  }
  const hoje = new Date();
  container.innerHTML = allCupons.map(c => {
    const expirado = c.validade && new Date(c.validade) < hoje;
    const validade = c.validade ? new Date(c.validade).toLocaleDateString('pt-BR') : '∞';
    return `<div class="coupon-card">
      <div class="coupon-code">${c.codigo}</div>
      <div class="coupon-info">
        <div class="coupon-desc">${c.descricao||'Sem descrição'}</div>
        <div class="coupon-meta">
          💰 ${c.tipo==='percent'?`${c.valor}% off`:`R$${c.valor} off`} &nbsp;·&nbsp;
          🎯 ${c.plano==='todos'?'Todos':c.plano} &nbsp;·&nbsp;
          📅 ${validade} &nbsp;·&nbsp;
          🔢 ${c.usos_atual||0}/${c.limite||'∞'} usos
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;align-items:flex-end;flex-shrink:0;">
        <span class="badge ${expirado?'badge-red':'badge-green'}">${expirado?'Expirado':'Ativo'}</span>
        <button class="btn btn-danger btn-sm" onclick="deletarCupom('${c.id}')">🗑️ Excluir</button>
      </div>
    </div>`;
  }).join('');
}

async function criarCupom() {
  const codigo   = document.getElementById('cup-codigo').value.trim().toUpperCase();
  const valor    = Number(document.getElementById('cup-valor').value);
  const tipo     = document.getElementById('cup-tipo').value;
  const plano    = document.getElementById('cup-plano').value;
  const limite   = Number(document.getElementById('cup-limite').value) || null;
  const validade = document.getElementById('cup-validade').value || null;
  const descricao= document.getElementById('cup-descricao').value.trim();
  if (!codigo || !valor) { toast('Preencha código e valor do desconto', 'error'); return; }

  const { error } = await sb.from('cupons').insert({
    codigo, valor, tipo, plano, limite, validade, descricao, usos_atual:0, criado_em: new Date().toISOString()
  });
  if (error) {
    if (error.code === '42P01') toast('Tabela "cupons" não existe. Crie-a no Supabase SQL Editor primeiro.', 'error');
    else toast('Erro: ' + error.message, 'error');
    return;
  }
  addLog('cupom', `Cupom criado: ${codigo}`, `${valor}${tipo==='percent'?'%':'R$'} · plano ${plano}`);
  toast(`🎟️ Cupom ${codigo} criado!`, 'success');
  await loadCupons();
  renderCupons();
  ['cup-codigo','cup-valor','cup-limite','cup-validade','cup-descricao'].forEach(id => { const el=document.getElementById(id); if(el) el.value=''; });
}

async function deletarCupom(id) {
  const c = allCupons.find(x => x.id == id);
  if (!confirm(`Excluir cupom ${c?.codigo}?`)) return;
  const { error } = await sb.from('cupons').delete().eq('id', id);
  if (error) { toast('Erro: ' + error.message, 'error'); return; }
  addLog('cupom', `Cupom excluído: ${c?.codigo}`, '');
  toast('🗑️ Cupom excluído', 'info');
  await loadCupons();
  renderCupons();
}

// ─── START ───
init();

// ══════════════════════════════════════════════
// ─── CADASTROS INCOMPLETOS ───
// ══════════════════════════════════════════════
let allIncompletos = [];

async function renderIncompletos() {
  await recarregarIncompletos();
}

async function recarregarIncompletos() {
  // Busca registros da tabela perfis onde cadastro_completo = false OU nome é null
  const { data, error } = await sb
    .from('perfis')
    .select('id, email, criado_em, cadastro_completo, nome')
    .or('cadastro_completo.eq.false,nome.is.null')
    .order('criado_em', { ascending: false });

  if (error) {
    toast('Erro ao carregar cadastros incompletos: ' + error.message, 'error');
    allIncompletos = [];
  } else {
    allIncompletos = (data || []).filter(u => !u.nome || !u.cadastro_completo);
  }

  const hoje = new Date().toDateString();
  const incHoje = allIncompletos.filter(u => new Date(u.criado_em).toDateString() === hoje).length;
  const comEmail = allIncompletos.filter(u => u.email).length;

  setValue('inc-total', allIncompletos.length);
  setValue('inc-hoje', incHoje);
  setValue('inc-emails', comEmail);

  // Atualiza badge na sidebar
  const badge = document.getElementById('badge-incompletos');
  if (badge) badge.textContent = allIncompletos.length;

  const tbody = document.getElementById('inc-tbody');
  if (!tbody) return;

  if (!allIncompletos.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text3);">🎉 Nenhum cadastro incompleto encontrado!</td></tr>`;
    return;
  }

  tbody.innerHTML = allIncompletos.map(u => {
    const dt = u.criado_em ? new Date(u.criado_em).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    const agora = new Date();
    const criado = new Date(u.criado_em || agora);
    const diffH = Math.floor((agora - criado) / 36e5);
    const diffStr = diffH < 1 ? 'Há menos de 1h' : diffH < 24 ? `Há ${diffH}h` : `Há ${Math.floor(diffH/24)} dia(s)`;
    const urgColor = diffH < 24 ? 'var(--green)' : diffH < 72 ? 'var(--yellow)' : 'var(--red)';
    const emailDisplay = u.email || '<span style="color:var(--text3);font-style:italic;">sem e-mail</span>';
    return `<tr>
      <td><div class="td-name"><div class="td-avatar" style="background:var(--yellow-dim);color:var(--yellow);">?</div><div>${emailDisplay}</div></div></td>
      <td style="color:var(--text3);">${dt}</td>
      <td><span style="color:${urgColor};font-weight:600;font-size:0.82rem;">${diffStr}</span></td>
      <td><div style="display:flex;gap:6px;">
        ${u.email ? `<button class="btn btn-warn btn-sm" onclick="abrirEmailInc('${u.email}')">📧 E-mail</button>` : '<span style="color:var(--text3);font-size:0.75rem;">sem e-mail</span>'}
        <button class="btn btn-ghost btn-sm" onclick="copiarEmail('${u.email||''}')">📋 Copiar</button>
      </div></td>
    </tr>`;
  }).join('');
}

function abrirEmailInc(email) {
  document.getElementById('email-inc-dest').value = email;
  document.getElementById('email-inc-para').textContent = `Para: ${email}`;
  openModal('modal-email-inc');
}

function copiarEmail(email) {
  if (!email) { toast('Sem e-mail disponível', 'error'); return; }
  navigator.clipboard.writeText(email);
  toast(`📋 E-mail copiado: ${email}`, 'success');
}

async function enviarEmailIncompleto() {
  const to      = document.getElementById('email-inc-dest').value;
  const subject = document.getElementById('email-inc-assunto').value.trim();
  const body    = document.getElementById('email-inc-corpo').value.trim();

  if (!to || !subject || !body) { toast('Preencha todos os campos', 'error'); return; }

  const btn = document.querySelector('#modal-email-inc .btn-primary');
  btn.textContent = '⏳ Enviando...';
  btn.disabled = true;

  try {
    const html = body.replace(/\n/g, '<br>');
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPA_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || SUPA_KEY}`,
      },
      body: JSON.stringify({ to, subject, html, from_name: 'Ventsy' }),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error?.message || JSON.stringify(result.error));
    addLog('comunicacao', `E-mail enviado para cadastro incompleto`, to);
    toast(`✅ E-mail enviado para ${to}!`, 'success');
    closeModal('modal-email-inc');
  } catch (err) {
    toast('Erro ao enviar e-mail: ' + err.message, 'error');
  } finally {
    btn.textContent = '📤 Enviar e-mail';
    btn.disabled = false;
  }
}

async function emailTodosIncompletos() {
  const comEmail = allIncompletos.filter(u => u.email);
  if (!comEmail.length) { toast('Nenhum cadastro incompleto com e-mail', 'error'); return; }
  if (!confirm(`Enviar e-mail de recuperação para ${comEmail.length} usuário(s) com cadastro incompleto?`)) return;

  const subject = 'Finalize seu cadastro na Ventsy 🏡';
  const html = `<p>Olá! 👋</p><p>Notamos que você criou sua conta na <strong>Ventsy</strong> mas ainda não finalizou o cadastro do seu espaço.</p><p>Leva menos de 5 minutos e você começa a receber solicitações imediatamente!</p><p><a href="https://ventsy.com.br/cadastro.html" style="background:#ff385c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">👉 Completar meu cadastro</a></p><br><p>Equipe Ventsy</p>`;

  let enviados = 0;
  const { data: { session } } = await sb.auth.getSession();

  for (const u of comEmail) {
    try {
      await fetch(`${SUPA_URL}/functions/v1/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || SUPA_KEY}` },
        body: JSON.stringify({ to: u.email, subject, html, from_name: 'Ventsy' }),
      });
      enviados++;
    } catch(e) { /* continua */ }
  }
  addLog('comunicacao', `E-mail em massa para cadastros incompletos`, `${enviados} enviados`);
  toast(`✅ ${enviados} e-mail(s) enviados!`, 'success');
}

function exportIncompletos() {
  if (!allIncompletos.length) { toast('Nenhum dado para exportar', 'error'); return; }
  const csv = ['E-mail,Cadastrado em,Completo']
    .concat(allIncompletos.map(u => `"${u.email||''}","${u.criado_em||''}","${u.cadastro_completo?'Sim':'Não'}"`))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cadastros-incompletos-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  toast('📊 CSV exportado!', 'success');
}

// ══════════════════════════════════════════════
// ─── RELATÓRIO DE BUSCAS ───
// ══════════════════════════════════════════════
async function loadBuscasSemResultado() {
  const { data } = await sb
    .from('buscas_log')
    .select('termo, resultados, criado_em')
    .eq('resultados', 0)
    .order('criado_em', { ascending: false })
    .limit(200);
  return data || [];
}

async function recarregarBuscasSemResultado() {
  const tbody = document.getElementById('bsr-tbody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text3);">Carregando...</td></tr>`;

  const data = await loadBuscasSemResultado();
  document.getElementById('bsr-total').textContent = data.length;

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--green);">✅ Nenhuma busca sem resultado nos últimos 30 dias!</td></tr>`;
    return;
  }

  // Agrupar por termo
  const agrupado = {};
  data.forEach(b => {
    const t = b.termo || 'desconhecido';
    if (!agrupado[t]) agrupado[t] = { count: 0, ultima: b.criado_em };
    agrupado[t].count++;
    if (b.criado_em > agrupado[t].ultima) agrupado[t].ultima = b.criado_em;
  });

  const sorted = Object.entries(agrupado).sort((a, b) => b[1].count - a[1].count);

  tbody.innerHTML = sorted.map(([termo, info]) => {
    const dt = new Date(info.ultima).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
    const urgColor = info.count >= 10 ? 'var(--red)' : info.count >= 5 ? 'var(--yellow)' : 'var(--text2)';
    const acao = info.count >= 10
      ? '<span style="color:var(--red);font-size:0.75rem;font-weight:600;">🔴 Adicionar propriedade nessa região</span>'
      : info.count >= 5
      ? '<span style="color:var(--yellow);font-size:0.75rem;">🟡 Considerar expansão</span>'
      : '<span style="color:var(--text3);font-size:0.75rem;">📌 Monitorar</span>';
    return `<tr>
      <td><strong style="color:var(--text);">🔍 ${termo}</strong></td>
      <td><span style="color:${urgColor};font-weight:700;font-family:var(--font-display);">${info.count}x</span></td>
      <td style="color:var(--text3);">${dt}</td>
      <td>${acao}</td>
    </tr>`;
  }).join('');
}

function exportBuscasSemResultado() {
  const rows = document.querySelectorAll('#bsr-tbody tr');
  if (!rows.length || rows[0].cells.length < 3) { toast('Sem dados para exportar', 'error'); return; }
  const csv = ['Termo,Ocorrências,Última busca']
    .concat([...rows].map(r => `"${r.cells[0]?.textContent?.replace('🔍 ','').trim()}","${r.cells[1]?.textContent?.trim()}","${r.cells[2]?.textContent?.trim()}"` ))
    .join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `buscas-sem-resultado-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  toast('📊 CSV exportado!', 'success');
}

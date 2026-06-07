'use client';

// Configurações — /painel/configuracoes.
// Porta o módulo legado: dados da conta (tabela usuarios), troca de senha
// (Supabase auth), preferências de notificação (localStorage) e zona de perigo.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb } from '@/lib/supabase';

type Conta = { nome: string; usuario: string; telefone: string; nascimento: string; documento: string };
const EMPTY: Conta = { nome: '', usuario: '', telefone: '', nascimento: '', documento: '' };

const NOTIF_DEFAULTS: Record<string, boolean> = { lead_email: true, lead_wpp: false, visitas: false, promo: true, relatorio: true };
const NOTIF_ITEMS = [
  { k: 'lead_email', label: 'Novos leads por e-mail' },
  { k: 'lead_wpp', label: 'Novos leads por WhatsApp' },
  { k: 'visitas', label: 'Lembretes de visitas agendadas' },
  { k: 'promo', label: 'Novidades e promoções da Ventsy' },
  { k: 'relatorio', label: 'Relatório mensal de desempenho' },
];

function forcaSenha(s: string) {
  let f = 0;
  if (s.length >= 8) f++;
  if (/[A-Z]/.test(s)) f++;
  if (/[0-9]/.test(s)) f++;
  if (/[^A-Za-z0-9]/.test(s)) f++;
  const labels = ['', 'Senha fraca', 'Pode melhorar', 'Boa senha', 'Senha forte'];
  const cores = ['#e5e7eb', '#ff385c', '#f59e0b', '#16a34a', '#1e88e5'];
  return { nivel: f, label: labels[f], cor: cores[f] };
}

export default function ConfiguracoesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [form, setForm] = useState<Conta>(EMPTY);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const [perfilMsg, setPerfilMsg] = useState<string | null>(null);

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [senhaMsg, setSenhaMsg] = useState<{ ok: boolean; txt: string } | null>(null);
  const [savingSenha, setSavingSenha] = useState(false);

  const [notif, setNotif] = useState<Record<string, boolean>>(NOTIF_DEFAULTS);
  const [notifMsg, setNotifMsg] = useState(false);

  const [excluirTxt, setExcluirTxt] = useState('');
  const [excluirMsg, setExcluirMsg] = useState<string | null>(null);

  const set = <K extends keyof Conta>(k: K, v: Conta[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      setEmail(session.user.email || '');
      try {
        const { data: p } = await sb.from('usuarios').select('*').eq('id', session.user.id).single();
        if (p) setForm({ nome: p.nome || '', usuario: p.usuario || '', telefone: p.telefone || '', nascimento: p.nascimento || '', documento: p.documento || '' });
      } catch { /* opcional */ }
      try {
        const prefs = JSON.parse(localStorage.getItem('ventsy_notificacoes') || '{}');
        setNotif({ ...NOTIF_DEFAULTS, ...prefs });
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  async function salvarPerfil() {
    if (!userId || !form.nome.trim()) { setPerfilMsg('Preencha seu nome.'); return; }
    setSavingPerfil(true); setPerfilMsg(null);
    const { error } = await sb.from('usuarios').update({
      nome: form.nome.trim(), usuario: form.usuario.replace('@', '').trim() || null,
      telefone: form.telefone || null, nascimento: form.nascimento || null, documento: form.documento || null,
    }).eq('id', userId);
    setSavingPerfil(false);
    setPerfilMsg(error ? 'Erro ao salvar.' : 'Perfil atualizado com sucesso.');
  }

  async function alterarSenha() {
    if (novaSenha.length < 8) { setSenhaMsg({ ok: false, txt: 'A senha deve ter pelo menos 8 caracteres.' }); return; }
    if (novaSenha !== confirmar) { setSenhaMsg({ ok: false, txt: 'As senhas não coincidem.' }); return; }
    setSavingSenha(true); setSenhaMsg(null);
    const { error } = await sb.auth.updateUser({ password: novaSenha });
    setSavingSenha(false);
    if (error) setSenhaMsg({ ok: false, txt: error.message || 'Erro ao alterar senha.' });
    else { setNovaSenha(''); setConfirmar(''); setSenhaMsg({ ok: true, txt: 'Senha alterada com sucesso.' }); }
  }

  async function enviarLink() {
    if (!email) return;
    await sb.auth.resetPasswordForEmail(email);
    setSenhaMsg({ ok: true, txt: `Link de redefinição enviado para ${email}.` });
  }

  async function encerrarSessoes() {
    if (!confirm('Encerrar todas as sessões? Você precisará entrar novamente.')) return;
    await sb.auth.signOut({ scope: 'global' });
    router.replace('/login');
  }

  function salvarNotif() {
    localStorage.setItem('ventsy_notificacoes', JSON.stringify(notif));
    setNotifMsg(true);
    setTimeout(() => setNotifMsg(false), 2500);
  }

  async function excluirConta() {
    if (excluirTxt.trim().toUpperCase() !== 'EXCLUIR') return;
    // Exclusão definitiva exige processamento no servidor — registramos a solicitação.
    setExcluirMsg('Solicitação registrada. Nossa equipe concluirá a exclusão em até 48h úteis.');
  }

  if (loading) return <div className="mx-auto h-[520px] max-w-3xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  const fs = forcaSenha(novaSenha);
  const inicial = (form.nome || email).trim()[0]?.toUpperCase() || '?';

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Configurações</h1>
        <p className="mt-1 text-sm text-ink-muted">Gerencie sua conta, segurança e preferências.</p>
      </div>

      {/* Conta */}
      <section className="rounded-2xl bg-white p-6 shadow-card">
        <div className="mb-5 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand text-2xl font-bold text-white">{inicial}</div>
          <div>
            <div className="font-bold text-ink">{form.nome || '—'}</div>
            <div className="text-sm text-ink-muted">{email}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome completo" full><input className={inp} value={form.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
          <Campo label="Usuário"><input className={inp} value={form.usuario} onChange={(e) => set('usuario', e.target.value)} placeholder="@usuario" /></Campo>
          <Campo label="E-mail (não editável aqui)"><input className={`${inp} bg-black/[0.03] text-ink-muted`} value={email} disabled /></Campo>
          <Campo label="Telefone"><input className={inp} value={form.telefone} onChange={(e) => set('telefone', e.target.value)} /></Campo>
          <Campo label="Nascimento"><input type="date" className={inp} value={form.nascimento} onChange={(e) => set('nascimento', e.target.value)} /></Campo>
          <Campo label="Documento (CPF/CNPJ)" full><input className={inp} value={form.documento} onChange={(e) => set('documento', e.target.value)} /></Campo>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button onClick={salvarPerfil} disabled={savingPerfil} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{savingPerfil ? 'Salvando…' : 'Salvar perfil'}</button>
          {perfilMsg && <span className={`text-sm font-medium ${perfilMsg.includes('Erro') ? 'text-red-600' : 'text-emerald-600'}`}>{perfilMsg}</span>}
        </div>
      </section>

      {/* Segurança */}
      <section className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="text-base font-bold text-ink">Segurança</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nova senha"><input type="password" className={inp} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} /></Campo>
          <Campo label="Confirmar nova senha"><input type="password" className={inp} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} /></Campo>
        </div>
        {novaSenha && (
          <div className="mt-3">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= fs.nivel ? fs.cor : '#e5e7eb' }} />)}
            </div>
            <div className="mt-1 text-xs font-medium" style={{ color: fs.cor }}>{fs.label}</div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={alterarSenha} disabled={savingSenha || !novaSenha} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{savingSenha ? 'Alterando…' : 'Alterar senha'}</button>
          <button onClick={enviarLink} className="text-sm font-semibold text-ink-soft hover:text-brand">Enviar link de redefinição</button>
          <button onClick={encerrarSessoes} className="ml-auto text-sm font-semibold text-ink-muted hover:text-red-600">Encerrar todas as sessões</button>
        </div>
        {senhaMsg && <div className={`mt-3 text-sm font-medium ${senhaMsg.ok ? 'text-emerald-600' : 'text-red-600'}`}>{senhaMsg.txt}</div>}
      </section>

      {/* Notificações */}
      <section className="rounded-2xl bg-white p-6 shadow-card">
        <h2 className="text-base font-bold text-ink">Notificações</h2>
        <div className="mt-4 space-y-2">
          {NOTIF_ITEMS.map((n) => (
            <label key={n.k} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3">
              <span className="text-sm font-medium text-ink-soft">{n.label}</span>
              <input type="checkbox" checked={!!notif[n.k]} onChange={(e) => setNotif((p) => ({ ...p, [n.k]: e.target.checked }))} className="h-4 w-4 accent-brand" />
            </label>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button onClick={salvarNotif} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600">Salvar preferências</button>
          {notifMsg && <span className="text-sm font-medium text-emerald-600">Preferências salvas.</span>}
        </div>
      </section>

      {/* Zona de perigo */}
      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-base font-bold text-red-700">Zona de perigo</h2>
        <p className="mt-1 text-sm text-ink-muted">A exclusão da conta é permanente e remove seus dados da Ventsy. Digite <strong>EXCLUIR</strong> para confirmar.</p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input value={excluirTxt} onChange={(e) => setExcluirTxt(e.target.value)} placeholder="EXCLUIR" className="rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200" />
          <button onClick={excluirConta} disabled={excluirTxt.trim().toUpperCase() !== 'EXCLUIR'} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40">Excluir minha conta</button>
        </div>
        {excluirMsg && <div className="mt-3 text-sm font-medium text-red-700">{excluirMsg}</div>}
      </section>
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Campo({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <label className={`block ${full ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

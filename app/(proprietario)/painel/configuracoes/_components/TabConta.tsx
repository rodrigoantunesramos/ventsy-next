'use client';

// Aba Conta & Segurança — perfil do dono (tabela usuarios), e-mail, troca de
// senha (Supabase auth), 2FA/MFA (TOTP) e encerramento de sessões.

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabaseAny as sb } from '@/lib/supabase';
import { maskTelefone, maskCpfCnpj } from '@/lib/masks';
import { useToast } from '@/components/Toast';
import { Section, Campo, SaveBar, inp } from './ui';

type Perfil = { nome: string; usuario: string; telefone: string; nascimento: string; documento: string };
const EMPTY: Perfil = { nome: '', usuario: '', telefone: '', nascimento: '', documento: '' };

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

type Factor = { id: string; status: string; friendly_name?: string };

export default function TabConta({ userId, email }: { userId: string; email: string }) {
  const router = useRouter();
  const toast = useToast();

  const [form, setForm] = useState<Perfil>(EMPTY);
  const [savingPerfil, setSavingPerfil] = useState(false);
  const set = <K extends keyof Perfil>(k: K, v: Perfil[K]) => setForm((f) => ({ ...f, [k]: v }));

  const [novaSenha, setNovaSenha] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [savingSenha, setSavingSenha] = useState(false);

  // 2FA / MFA
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await sb.from('usuarios').select('*').eq('id', userId).single();
        if (data) setForm({ nome: data.nome || '', usuario: data.usuario || '', telefone: data.telefone || '', nascimento: data.nascimento || '', documento: data.documento || '' });
      } catch { /* opcional */ }
      await refreshFactors();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function refreshFactors() {
    try {
      const { data } = await sb.auth.mfa.listFactors();
      setFactors((data?.totp ?? data?.all ?? []) as Factor[]);
    } catch { setFactors([]); }
  }

  async function salvarPerfil() {
    if (!form.nome.trim()) { toast.error('Preencha seu nome.'); return; }
    setSavingPerfil(true);
    const { error } = await sb.from('usuarios').update({
      nome: form.nome.trim(), usuario: form.usuario.replace('@', '').trim() || null,
      telefone: form.telefone || null, nascimento: form.nascimento || null, documento: form.documento || null,
    }).eq('id', userId);
    setSavingPerfil(false);
    error ? toast.error('Erro ao salvar o perfil.') : toast.success('Perfil atualizado.');
  }

  async function alterarSenha() {
    if (novaSenha.length < 8) { toast.error('A senha deve ter ao menos 8 caracteres.'); return; }
    if (novaSenha !== confirmar) { toast.error('As senhas não coincidem.'); return; }
    setSavingSenha(true);
    const { error } = await sb.auth.updateUser({ password: novaSenha });
    setSavingSenha(false);
    if (error) { toast.error(error.message || 'Erro ao alterar a senha.'); return; }
    setNovaSenha(''); setConfirmar(''); toast.success('Senha alterada.');
  }

  async function enviarLink() {
    if (!email) return;
    await sb.auth.resetPasswordForEmail(email);
    toast.info(`Link de redefinição enviado para ${email}.`);
  }

  async function encerrarSessoes() {
    if (!confirm('Encerrar todas as sessões? Você precisará entrar novamente.')) return;
    await sb.auth.signOut({ scope: 'global' });
    router.replace('/login');
  }

  async function iniciar2FA() {
    setMfaBusy(true);
    try {
      const { data, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Ventsy' });
      if (error) throw error;
      setEnroll({ factorId: data.id, qr: data.totp?.qr_code || '', secret: data.totp?.secret || '' });
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'MFA não disponível neste projeto.');
    } finally { setMfaBusy(false); }
  }

  async function confirmar2FA() {
    if (!enroll || code.trim().length < 6) return;
    setMfaBusy(true);
    try {
      const ch = await sb.auth.mfa.challenge({ factorId: enroll.factorId });
      if (ch.error) throw ch.error;
      const { error } = await sb.auth.mfa.verify({ factorId: enroll.factorId, challengeId: ch.data.id, code: code.trim() });
      if (error) throw error;
      toast.success('2FA ativado.');
      setEnroll(null); setCode(''); await refreshFactors();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Código inválido.');
    } finally { setMfaBusy(false); }
  }

  async function desativar2FA(factorId: string) {
    if (!confirm('Desativar a verificação em duas etapas?')) return;
    setMfaBusy(true);
    try {
      const { error } = await sb.auth.mfa.unenroll({ factorId });
      if (error) throw error;
      toast.success('2FA desativado.'); await refreshFactors();
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Erro ao desativar.');
    } finally { setMfaBusy(false); }
  }

  const fs = forcaSenha(novaSenha);
  const ativo2fa = factors.some((f) => f.status === 'verified');

  return (
    <div className="space-y-5">
      <Section title="Perfil" desc="Dados pessoais do titular da conta.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome completo" full><input className={inp} value={form.nome} onChange={(e) => set('nome', e.target.value)} /></Campo>
          <Campo label="Usuário"><input className={inp} value={form.usuario} onChange={(e) => set('usuario', e.target.value)} placeholder="@usuario" /></Campo>
          <Campo label="E-mail" hint="Para alterar o e-mail, fale com o suporte."><input className={`${inp} bg-black/[0.03] text-ink-muted`} value={email} disabled /></Campo>
          <Campo label="Telefone"><input className={inp} value={form.telefone} onChange={(e) => set('telefone', maskTelefone(e.target.value))} /></Campo>
          <Campo label="Nascimento"><input type="date" className={inp} value={form.nascimento} onChange={(e) => set('nascimento', e.target.value)} /></Campo>
          <Campo label="Documento (CPF/CNPJ)" full><input className={inp} value={form.documento} onChange={(e) => set('documento', maskCpfCnpj(e.target.value))} /></Campo>
        </div>
        <div className="mt-5"><SaveBar saving={savingPerfil} onSave={salvarPerfil} label="Salvar perfil" /></div>
      </Section>

      <Section title="Senha">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nova senha"><input type="password" className={inp} value={novaSenha} onChange={(e) => setNovaSenha(e.target.value)} /></Campo>
          <Campo label="Confirmar nova senha"><input type="password" className={inp} value={confirmar} onChange={(e) => setConfirmar(e.target.value)} /></Campo>
        </div>
        {novaSenha && (
          <div className="mt-3">
            <div className="flex gap-1.5">{[1, 2, 3, 4].map((i) => <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= fs.nivel ? fs.cor : '#e5e7eb' }} />)}</div>
            <div className="mt-1 text-xs font-medium" style={{ color: fs.cor }}>{fs.label}</div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={alterarSenha} disabled={savingSenha || !novaSenha} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">{savingSenha ? 'Alterando…' : 'Alterar senha'}</button>
          <button onClick={enviarLink} className="text-sm font-semibold text-ink-soft hover:text-brand">Enviar link de redefinição</button>
        </div>
      </Section>

      <Section title="Verificação em duas etapas (2FA)" desc="Proteja o acesso com um app autenticador (TOTP).">
        {ativo2fa ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">✓ 2FA ativo</span>
            {factors.filter((f) => f.status === 'verified').map((f) => (
              <button key={f.id} onClick={() => desativar2FA(f.id)} disabled={mfaBusy} className="text-sm font-semibold text-ink-muted hover:text-red-600">Desativar</button>
            ))}
          </div>
        ) : enroll ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">Escaneie o QR no seu app autenticador e digite o código de 6 dígitos.</p>
            {enroll.qr && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={enroll.qr} alt="QR code 2FA" className="h-44 w-44 rounded-xl border border-black/10 bg-white p-2" />
            )}
            {enroll.secret && <div className="text-xs text-ink-muted">Ou digite a chave: <code className="rounded bg-black/[0.05] px-1.5 py-0.5">{enroll.secret}</code></div>}
            <div className="flex flex-wrap items-center gap-3">
              <input className={`${inp} max-w-[160px]`} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" inputMode="numeric" />
              <button onClick={confirmar2FA} disabled={mfaBusy || code.length < 6} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">Confirmar</button>
              <button onClick={() => { setEnroll(null); setCode(''); }} className="text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
            </div>
          </div>
        ) : (
          <button onClick={iniciar2FA} disabled={mfaBusy} className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-60">{mfaBusy ? 'Aguarde…' : 'Ativar 2FA'}</button>
        )}
      </Section>

      <Section title="Sessões" desc="Encerre o acesso em todos os dispositivos.">
        <button onClick={encerrarSessoes} className="rounded-xl border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50">Encerrar todas as sessões</button>
      </Section>
    </div>
  );
}

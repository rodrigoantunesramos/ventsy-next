'use client';

// Aba Dados & LGPD — exportar meus dados (JSON), política de retenção e exclusão
// definitiva da conta (anonimização da PII + bloqueio de login, imediata e
// irreversível; exige reautenticação por senha).

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, authHeaders } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { Section, Campo, SaveBar, inp } from './ui';
import type { EmpresaConfig } from '../_lib';

type Props = {
  empresa: EmpresaConfig;
  set: (patch: Partial<EmpresaConfig>) => void;
  saving: boolean;
  onSave: () => void;
};

const RETENCOES = [6, 12, 24, 36, 60];

export default function TabDados({ empresa: e, set, saving, onSave }: Props) {
  const toast = useToast();
  const router = useRouter();
  const [exporting, setExporting] = useState(false);
  const [excluirTxt, setExcluirTxt] = useState('');
  const [senha, setSenha] = useState('');
  const [busy, setBusy] = useState(false);

  async function exportar() {
    setExporting(true);
    try {
      const r = await fetch('/api/conta/exportar', { headers: await authHeaders() });
      if (!r.ok) throw new Error();
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `ventsy-meus-dados-${new Date().toISOString().slice(0, 10)}.json`; a.click();
      URL.revokeObjectURL(url);
      toast.success('Exportação concluída.');
    } catch { toast.error('Não foi possível exportar agora.'); } finally { setExporting(false); }
  }

  async function encerrarConta() {
    if (excluirTxt.trim().toUpperCase() !== 'EXCLUIR' || !senha) return;
    setBusy(true);
    try {
      const r = await fetch('/api/conta/excluir', {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmacao: 'EXCLUIR', senha }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error || 'Não foi possível encerrar a conta.'); return; }
      toast.success('Conta encerrada. Você será desconectado.');
      await supabase.auth.signOut();
      router.replace('/');
    } catch { toast.error('Erro ao encerrar a conta.'); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <Section title="Exportar meus dados" desc="Baixe um arquivo JSON com seus dados pessoais e operacionais (LGPD). Não inclui senhas nem chaves de integração.">
        <button onClick={exportar} disabled={exporting} className="rounded-xl border border-black/10 bg-white px-5 py-2.5 text-sm font-medium hover:bg-black/[0.03] disabled:opacity-60">
          {exporting ? 'Gerando…' : '⬇ Exportar dados (JSON)'}
        </button>
      </Section>

      <Section title="Política de retenção" desc="Por quanto tempo manter logs e registros antes do expurgo.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Reter dados por">
            <select className={inp} value={e.retencao_meses} onChange={(ev) => set({ retencao_meses: Number(ev.target.value) })}>
              {RETENCOES.map((m) => <option key={m} value={m}>{m} meses</option>)}
            </select>
          </Campo>
        </div>
        <div className="mt-5"><SaveBar saving={saving} onSave={onSave} label="Salvar retenção" /></div>
      </Section>

      <Section title="Documentos & jurídico" desc="Termos, contratos e conformidade.">
        <Link href="/painel/juridico" className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-black/[0.03]">Abrir Jurídico →</Link>
      </Section>

      <section className="rounded-2xl border border-red-200 bg-red-50/40 p-6">
        <h2 className="text-base font-bold text-red-700">Encerrar conta</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Ação <strong>imediata e irreversível</strong>: seus dados pessoais são anonimizados e o acesso é
          bloqueado. Registros exigidos por lei (notas fiscais e lançamentos contábeis) são mantidos de forma
          anonimizada. Confirme com sua senha e digite <strong>EXCLUIR</strong>.
        </p>
        <div className="mt-4 grid max-w-sm gap-3">
          <input
            type="password" value={senha} onChange={(ev) => setSenha(ev.target.value)}
            placeholder="Sua senha" autoComplete="current-password"
            className="rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <input
            value={excluirTxt} onChange={(ev) => setExcluirTxt(ev.target.value)} placeholder="EXCLUIR"
            className="rounded-xl border border-red-300 bg-white px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <button
            onClick={encerrarConta}
            disabled={busy || excluirTxt.trim().toUpperCase() !== 'EXCLUIR' || !senha}
            className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? 'Encerrando…' : 'Encerrar minha conta'}
          </button>
        </div>
      </section>
    </div>
  );
}

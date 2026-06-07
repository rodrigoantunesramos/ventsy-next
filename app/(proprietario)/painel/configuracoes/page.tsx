'use client';

// Configurações — /painel/configuracoes.
// Central de configuração de EMPRESA (identidade, marca, fiscal, espaços) e CONTA
// (perfil, segurança, preferências, plano, LGPD) + Equipe & Permissões (RBAC).
// É fundação: idioma/moeda/fuso definidos aqui valem no painel todo via lib/format
// (applyPrefs). Dados em empresa_config / usuarios_papeis (migration
// docs/sql/empresa-config-rbac.sql) — enquanto types não os incluem, usa supabaseAny.

import { useCallback, useEffect, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { applyPrefs } from '@/lib/prefs';
import { carregarEmpresa, salvarEmpresa, EMPTY_EMPRESA, type EmpresaConfig } from './_lib';
import TabEmpresa from './_components/TabEmpresa';
import TabFiscal from './_components/TabFiscal';
import TabEquipe from './_components/TabEquipe';
import TabPreferencias from './_components/TabPreferencias';
import TabConta from './_components/TabConta';
import TabPlano from './_components/TabPlano';
import TabDados from './_components/TabDados';

type AbaId = 'empresa' | 'fiscal' | 'equipe' | 'preferencias' | 'conta' | 'plano' | 'dados';
const ABAS: [AbaId, string][] = [
  ['empresa', 'Empresa'],
  ['fiscal', 'Fiscal'],
  ['equipe', 'Equipe & Permissões'],
  ['preferencias', 'Preferências'],
  ['conta', 'Conta & Segurança'],
  ['plano', 'Plano & Cobrança'],
  ['dados', 'Dados & LGPD'],
];

export default function ConfiguracoesPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [empresa, setEmpresa] = useState<EmpresaConfig>(EMPTY_EMPRESA);
  const [espacosCount, setEspacosCount] = useState(0);
  const [aba, setAba] = useState<AbaId>('empresa');
  const [saving, setSaving] = useState(false);

  const set = useCallback((patch: Partial<EmpresaConfig>) => setEmpresa((e) => ({ ...e, ...patch })), []);

  useEffect(() => {
    // Deep-link por hash (#preferencias, #plano, …).
    const h = (typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '') as AbaId;
    if (ABAS.some(([id]) => id === h)) setAba(h);

    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      setUserId(session.user.id);
      setEmail(session.user.email || '');
      const { data } = await carregarEmpresa(session.user.id);
      setEmpresa(data);
      try {
        const { count } = await sb.from('propriedades').select('id', { count: 'exact', head: true }).eq('usuario_id', session.user.id);
        setEspacosCount(count ?? 0);
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  function trocarAba(id: AbaId) {
    setAba(id);
    if (typeof window !== 'undefined') window.history.replaceState(null, '', `#${id}`);
  }

  const salvar = useCallback(async () => {
    if (!userId) return;
    setSaving(true);
    const err = await salvarEmpresa(userId, empresa);
    setSaving(false);
    if (err) { toast.error('Erro ao salvar as configurações.'); return; }
    // Aplica idioma/moeda/fuso no painel inteiro imediatamente.
    applyPrefs({ idioma: empresa.idioma, moeda: empresa.moeda, fuso: empresa.fuso, formato_data: empresa.preferencias.formato_data });
    toast.success('Configurações salvas.');
  }, [userId, empresa, toast]);

  if (loading) return <div className="mx-auto h-[560px] max-w-4xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  if (!userId) {
    return <div className="mx-auto max-w-4xl rounded-2xl bg-white p-8 text-center text-sm text-ink-muted shadow-card">Faça login para acessar as configurações.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-ink sm:text-2xl">Configurações</h1>
        <p className="mt-1 text-sm text-ink-muted">Empresa, conta, equipe e preferências — a base que o painel inteiro respeita.</p>
      </div>

      {/* Abas (scroll horizontal no mobile) */}
      <div className="-mx-1 flex gap-1 overflow-x-auto rounded-2xl bg-black/[0.04] p-1">
        {ABAS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => trocarAba(id)}
            className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${aba === id ? 'bg-white text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'empresa' && <TabEmpresa empresa={empresa} set={set} saving={saving} onSave={salvar} espacosCount={espacosCount} />}
      {aba === 'fiscal' && <TabFiscal empresa={empresa} set={set} saving={saving} onSave={salvar} />}
      {aba === 'equipe' && <TabEquipe userId={userId} />}
      {aba === 'preferencias' && <TabPreferencias empresa={empresa} set={set} saving={saving} onSave={salvar} />}
      {aba === 'conta' && <TabConta userId={userId} email={email} />}
      {aba === 'plano' && <TabPlano userId={userId} />}
      {aba === 'dados' && <TabDados empresa={empresa} set={set} saving={saving} onSave={salvar} />}
    </div>
  );
}

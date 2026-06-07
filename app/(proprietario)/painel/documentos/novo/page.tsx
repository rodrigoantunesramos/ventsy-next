'use client';

// Criação de documento (/painel/documentos/novo).
// Mostra uma galeria de modelos comuns para casas de eventos; ao escolher,
// pré-preenche o formulário. Também é possível começar do zero.

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DocForm } from '../_components/DocForm';
import { CatIcon } from '../_components/CatIcon';
import { EMPTY_FORM, type DocForm as FormShape, TEMPLATES, type Template, CAT_BY_V } from '../_lib';

const hoje = () => new Date().toISOString().split('T')[0];

export default function NovoDocPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<FormShape>({ ...EMPTY_FORM, emissao: hoje() });
  const [presetKey, setPresetKey] = useState(0);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [galeriaAberta, setGaleriaAberta] = useState(true);

  function aplicar(t: Template) {
    setPreset({
      ...EMPTY_FORM,
      emissao: hoje(),
      nome: t.nome,
      categoria: t.categoria,
      orgao: t.orgao,
      dias_aviso: t.dias_aviso,
      link_renovacao: t.link_renovacao || '',
      passo_online: t.passo_online || '',
    });
    setEscolhido(t.id);
    setPresetKey((k) => k + 1);
    setGaleriaAberta(false);
  }

  function doZero() {
    setPreset({ ...EMPTY_FORM, emissao: hoje() });
    setEscolhido(null);
    setPresetKey((k) => k + 1);
    setGaleriaAberta(false);
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <button onClick={() => router.push('/painel/documentos')} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition hover:text-ink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Documentos
      </button>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Novo documento</h1>
      <p className="mt-0.5 text-sm text-ink-muted">Escolha um modelo comum para casas de eventos ou comece do zero.</p>

      {/* Galeria de modelos */}
      <div className="mt-5 rounded-2xl bg-white p-5 shadow-card">
        <button onClick={() => setGaleriaAberta((o) => !o)} className="flex w-full items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-ink">
            <span className="text-base">✨</span> Modelos prontos
            {escolhido && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand">{CAT_BY_V[preset.categoria]?.label}: {preset.nome}</span>}
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={`h-4 w-4 text-ink-muted transition ${galeriaAberta ? 'rotate-180' : ''}`}><path d="M6 9l6 6 6-6" /></svg>
        </button>

        {galeriaAberta && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {TEMPLATES.map((t) => {
                const cat = CAT_BY_V[t.categoria];
                const ativo = escolhido === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => aplicar(t)}
                    className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${ativo ? 'border-brand bg-brand-50' : 'border-black/[0.06] hover:border-brand/40 hover:bg-black/[0.01]'}`}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: cat.bg }}>
                      <CatIcon catV={t.categoria} color={cat.color} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-tight text-ink">{t.nome}</div>
                      <div className="mt-0.5 text-xs text-ink-muted">{t.descricao}</div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={doZero} className="mt-3 w-full rounded-xl border border-dashed border-black/15 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-brand/40 hover:text-ink">
              Começar do zero
            </button>
          </>
        )}
      </div>

      <div className="mt-5">
        <DocForm key={presetKey} initialForm={preset} />
      </div>
    </div>
  );
}

'use client';

// Edição de documento (/painel/documentos/[id]/editar).

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { DocForm } from '../../_components/DocForm';
import { type Doc, docToForm, type DocForm as FormShape } from '../../_lib';

export default function EditarDocPage() {
  const params = useParams();
  const router = useRouter();
  const id = Number(params.id);

  const [loading, setLoading] = useState(true);
  const [doc, setDoc] = useState<Doc | null>(null);
  const [initial, setInitial] = useState<FormShape | null>(null);

  const carregar = useCallback(async () => {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setLoading(false); return; }
    const { data } = await sb.from('documentos').select('*').eq('id', id).eq('usuario_id', session.user.id).single();
    if (data) { setDoc(data as Doc); setInitial(docToForm(data as Doc)); }
    setLoading(false);
  }, [id]);

  useEffect(() => { carregar(); }, [carregar]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="h-8 w-40 animate-pulse rounded-lg bg-black/[0.05]" />
        {[...Array(4)].map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-black/[0.05]" />)}
      </div>
    );
  }

  if (!doc || !initial) {
    return (
      <div className="mx-auto max-w-md rounded-2xl bg-white p-12 text-center shadow-card">
        <div className="text-4xl">🔍</div>
        <h2 className="mt-3 font-bold text-ink">Documento não encontrado</h2>
        <Link href="/painel/documentos" className="mt-5 inline-block rounded-xl bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
          Voltar para documentos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <button onClick={() => router.push(`/painel/documentos/${id}`)} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition hover:text-ink">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        Voltar ao documento
      </button>

      <h1 className="text-xl font-bold text-ink sm:text-2xl">Editar documento</h1>
      <p className="mt-0.5 text-sm text-ink-muted">Atualize os dados, troque o arquivo ou edite o guia de renovação.</p>

      <div className="mt-5">
        <DocForm
          initialForm={initial}
          docId={doc.id}
          arquivoAtual={doc.arquivo_url ? { url: doc.arquivo_url, nome: doc.arquivo_nome, tipo: doc.arquivo_tipo, tamanho: doc.arquivo_tamanho } : null}
        />
      </div>
    </div>
  );
}

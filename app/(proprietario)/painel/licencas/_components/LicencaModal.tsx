'use client';

// Modal de criar/editar uma LICENÇA (permanente ou por evento). O CRUD é feito
// direto no client via RLS (insert/update em `licencas`) — espelha o padrão de
// briefing/CRUD da Produção. O upload do documento reusa o bucket `documentos`.
// Nada de "R$" hardcoded: o preview de custo usa formatMoney (locale do painel).

import { useMemo, useState } from 'react';
import { supabase as sb } from '@/lib/supabase';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  TIPOS, STATUS_META, tipoMeta, type Licenca, type LicencaStatus,
} from '@/lib/licencas';
import {
  type LicForm, type PropriedadeLite, type EventoLite,
  emptyLicForm, licToForm, formToPayload, eventoLabel, propriedadeLabel,
  uploadDocumento, removeDocumento, signedUrl,
} from '../_lib';
import {
  ModalShell, Campo, inp, btnPrimary, btnSecondary, btnGhost,
  IcoUpload, IcoDoc, IcoTrash, IcoDownload, IcoSparkle,
} from './ui';

const STATUS_OPTS: LicencaStatus[] = ['vigente', 'a_vencer', 'vencida', 'em_processo', 'nao_aplicavel'];

type Props = {
  userId: string;
  escopo: 'permanente' | 'evento';
  evento?: EventoLite | null;        // contexto quando escopo='evento'
  propriedades: PropriedadeLite[];
  editar?: Licenca | null;           // null = criar
  onClose: () => void;
  onSaved: () => void;
};

export default function LicencaModal({ userId, escopo, evento, propriedades, editar, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<LicForm>(() => {
    if (editar) return licToForm(editar);
    const f = emptyLicForm(escopo, evento?.id ?? null);
    if (escopo === 'evento' && evento?.propriedade_id) f.propriedade_id = String(evento.propriedade_id);
    return f;
  });
  const [docUrl, setDocUrl] = useState<string | null>(editar?.documento_url ?? null);
  const [docNome, setDocNome] = useState<string | null>(editar?.documento_nome ?? null);
  const [enviando, setEnviando] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const set = <K extends keyof LicForm>(k: K, v: LicForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  // Ao trocar o tipo, preenche órgão/aviso/título se ainda vazios (sugestão).
  const onTipo = (tipo: string) => {
    const m = tipoMeta(tipo);
    setForm((f) => ({
      ...f,
      tipo,
      orgao: f.orgao.trim() ? f.orgao : m.orgao,
      titulo: f.titulo.trim() ? f.titulo : m.label,
      dias_aviso: f.dias_aviso && f.dias_aviso !== '60' ? f.dias_aviso : String(m.diasAviso),
    }));
  };

  const onArquivo = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    try {
      // Remove o anterior (se houver) antes de subir o novo.
      if (docUrl) await removeDocumento(docUrl).catch(() => {});
      const r = await uploadDocumento(userId, file);
      setDocUrl(r.documento_url);
      setDocNome(r.documento_nome);
      toast.success('Documento anexado.');
    } catch {
      toast.error('Não foi possível enviar o documento.');
    } finally {
      setEnviando(false);
    }
  };

  const abrirDoc = async () => {
    const url = await signedUrl(docUrl);
    if (url) window.open(url, '_blank', 'noopener');
    else toast.error('Não foi possível abrir o documento.');
  };

  const removerDoc = async () => {
    if (docUrl) await removeDocumento(docUrl).catch(() => {});
    setDocUrl(null);
    setDocNome(null);
  };

  const salvar = async () => {
    if (!form.tipo) { toast.error('Escolha o tipo da licença.'); return; }
    setSalvando(true);
    try {
      const payload = {
        ...formToPayload(form),
        documento_url: docUrl,
        documento_nome: docNome,
      };
      if (editar) {
        const { error } = await sb.from('licencas').update(payload).eq('id', editar.id);
        if (error) throw error;
        toast.success('Licença atualizada.');
      } else {
        const { error } = await sb.from('licencas').insert({ ...payload, usuario_id: userId });
        if (error) throw error;
        toast.success('Licença adicionada.');
      }
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const custoPreview = useMemo(() => {
    const n = Number(form.custo);
    return form.custo.trim() && Number.isFinite(n) && n > 0 ? formatMoney(n) : '';
  }, [form.custo]);

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl">
      <h3 className="text-lg font-bold text-ink">
        {editar ? 'Editar licença' : escopo === 'permanente' ? 'Novo alvará / licença permanente' : 'Nova licença do evento'}
      </h3>
      {escopo === 'evento' && evento && (
        <p className="mt-0.5 text-sm text-ink-muted">Vinculada ao evento <strong className="text-ink-soft">{eventoLabel(evento)}</strong>.</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Tipo">
          <select className={inp} value={form.tipo} onChange={(e) => onTipo(e.target.value)}>
            {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Título" hint="Nome como aparece no documento (opcional).">
          <input className={inp} value={form.titulo} onChange={(e) => set('titulo', e.target.value)} placeholder={tipoMeta(form.tipo).label} />
        </Campo>

        <Campo label="Propriedade / espaço">
          <select className={inp} value={form.propriedade_id} onChange={(e) => set('propriedade_id', e.target.value)}>
            <option value="">— Nenhuma —</option>
            {propriedades.map((p) => <option key={p.id} value={p.id}>{propriedadeLabel(p)}</option>)}
          </select>
        </Campo>
        <Campo label="Status">
          <select className={inp} value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUS_OPTS.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </Campo>

        <Campo label="Órgão emissor">
          <input className={inp} value={form.orgao} onChange={(e) => set('orgao', e.target.value)} placeholder={tipoMeta(form.tipo).orgao} />
        </Campo>
        <Campo label="Contato do órgão" hint="Telefone, e-mail ou endereço para protocolo.">
          <input className={inp} value={form.orgao_contato} onChange={(e) => set('orgao_contato', e.target.value)} />
        </Campo>

        <Campo label="Número da licença">
          <input className={inp} value={form.numero} onChange={(e) => set('numero', e.target.value)} />
        </Campo>
        <Campo label="Protocolo" hint="Nº do processo em andamento.">
          <input className={inp} value={form.protocolo} onChange={(e) => set('protocolo', e.target.value)} />
        </Campo>

        <Campo label="Emissão">
          <input type="date" className={inp} value={form.emissao} onChange={(e) => set('emissao', e.target.value)} />
        </Campo>
        <Campo label="Validade" hint="Deixe vazio se não vence (permanente).">
          <input type="date" className={inp} value={form.validade} onChange={(e) => set('validade', e.target.value)} />
        </Campo>

        <Campo label="Avisar com antecedência (dias)">
          <input type="number" min={0} className={inp} value={form.dias_aviso} onChange={(e) => set('dias_aviso', e.target.value)} />
        </Campo>
        <Campo label="Custo (taxa / DAM)" hint={custoPreview ? `Equivale a ${custoPreview}.` : 'Valor numérico — entra no contábil ao lançar.'}>
          <input type="number" min={0} step="0.01" className={inp} value={form.custo} onChange={(e) => set('custo', e.target.value)} />
        </Campo>

        <Campo label="Responsável">
          <input className={inp} value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} placeholder="Quem cuida desta licença" />
        </Campo>
        <label className="flex items-center gap-2.5 self-end rounded-xl border border-black/10 px-3.5 py-2.5">
          <input type="checkbox" className="h-4 w-4 accent-brand" checked={form.obrigatorio} onChange={(e) => set('obrigatorio', e.target.checked)} />
          <span className="text-sm font-medium text-ink-soft">Exigência obrigatória</span>
        </label>

        <Campo label="Observações" full>
          <textarea className={`${inp} min-h-[72px] resize-y`} value={form.obs} onChange={(e) => set('obs', e.target.value)} />
        </Campo>

        {/* Documento */}
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Documento</span>
          {docUrl ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-black/10 bg-black/[0.02] px-3.5 py-2.5">
              <span className="text-ink-muted"><IcoDoc /></span>
              <span className="min-w-0 flex-1 truncate text-sm text-ink-soft">{docNome || 'documento'}</span>
              <button type="button" onClick={abrirDoc} className={btnGhost}><IcoDownload /> Abrir</button>
              <button type="button" onClick={removerDoc} className={`${btnGhost} text-red-600 hover:text-red-700`}><IcoTrash /> Remover</button>
            </div>
          ) : (
            <label className={`${btnSecondary} cursor-pointer`}>
              <IcoUpload /> {enviando ? 'Enviando…' : 'Anexar arquivo (PDF/imagem)'}
              <input type="file" className="hidden" accept="application/pdf,image/*" disabled={enviando}
                onChange={(e) => onArquivo(e.target.files?.[0])} />
            </label>
          )}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={salvando || enviando} className={btnPrimary}>
          <IcoSparkle /> {salvando ? 'Salvando…' : editar ? 'Salvar alterações' : 'Adicionar licença'}
        </button>
      </div>
    </ModalShell>
  );
}

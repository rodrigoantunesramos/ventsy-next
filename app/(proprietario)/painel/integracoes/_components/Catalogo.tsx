'use client';

// Catálogo "conecte/desconecte" estilo marketplace. Cada card mostra status,
// onde a integração é usada, e as ações conectar/testar/desconectar. Os segredos
// só trafegam servidor→cofre; aqui só vemos status mascarado.

import { useMemo, useState } from 'react';
import { formatDateTime } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  CATALOGO, CATEGORIAS, ORIGEM_LABEL, STATUS_META,
  type IntegracaoDef, type Categoria,
} from '@/lib/integracoes';
import type { ConexaoStatusDTO } from '../_lib';
import { salvarConexao, testarConexao, desconectar, iniciarMercadoPago } from '../_lib';
import { Ico, Chip, Field, Modal, inp, btnPrimary, btnGhost } from './ui';

type Props = { conexoes: Record<string, ConexaoStatusDTO>; recarregar: () => Promise<void> };

export default function Catalogo({ conexoes, recarregar }: Props) {
  const [editar, setEditar] = useState<IntegracaoDef | null>(null);
  const [busy, setBusy] = useState<string>('');
  const toast = useToast();

  const porCategoria = useMemo(() => {
    const grupos: { cat: Categoria; itens: IntegracaoDef[] }[] = [];
    for (const def of CATALOGO) {
      let g = grupos.find((x) => x.cat === def.categoria);
      if (!g) { g = { cat: def.categoria, itens: [] }; grupos.push(g); }
      g.itens.push(def);
    }
    return grupos;
  }, []);

  const conectarMP = async () => {
    setBusy('mercadopago');
    try {
      const url = await iniciarMercadoPago();
      window.location.href = url;
    } catch (e) {
      toast.error((e as Error).message || 'Não foi possível iniciar a conexão.');
      setBusy('');
    }
  };

  const testar = async (chave: string) => {
    setBusy(chave);
    try {
      const r = await testarConexao(chave);
      r.ok ? toast.success(r.mensagem) : toast.error(r.mensagem);
      await recarregar();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  };

  const desligar = async (def: IntegracaoDef) => {
    if (!confirm(`Desconectar ${def.nome}? As páginas que usam esta integração voltam ao modo padrão.`)) return;
    setBusy(def.chave);
    try {
      await desconectar(def.chave);
      toast.success(`${def.nome} desconectado.`);
      await recarregar();
    } catch (e) { toast.error((e as Error).message); }
    finally { setBusy(''); }
  };

  return (
    <div className="space-y-7">
      {porCategoria.map(({ cat, itens }) => {
        const meta = CATEGORIAS[cat];
        return (
          <section key={cat}>
            <div className="mb-2.5 flex items-center gap-2">
              <span className={`flex h-6 w-6 items-center justify-center rounded-lg ${meta.chip}`}><Ico name={meta.icon} className="h-3.5 w-3.5" /></span>
              <h2 className="text-sm font-bold uppercase tracking-wide text-ink-soft">{meta.label}</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {itens.map((def) => (
                <Card
                  key={def.chave}
                  def={def}
                  dto={conexoes[def.chave]}
                  busy={busy === def.chave}
                  onEditar={() => setEditar(def)}
                  onConectarMP={conectarMP}
                  onTestar={() => testar(def.chave)}
                  onDesconectar={() => desligar(def)}
                />
              ))}
            </div>
          </section>
        );
      })}

      {editar && (
        <ConectarModal
          def={editar}
          dto={conexoes[editar.chave]}
          onClose={() => setEditar(null)}
          onSalvo={async () => { setEditar(null); await recarregar(); }}
        />
      )}
    </div>
  );
}

function Card({ def, dto, busy, onEditar, onConectarMP, onTestar, onDesconectar }: {
  def: IntegracaoDef; dto?: ConexaoStatusDTO; busy: boolean;
  onEditar: () => void; onConectarMP: () => void; onTestar: () => void; onDesconectar: () => void;
}) {
  const status = dto?.status || 'desconectado';
  const meta = STATUS_META[status];
  const cat = CATEGORIAS[def.categoria];
  const configurado = !!dto?.configurado;
  const temCredUsuario = dto?.origem === 'usuario';
  const oauthIndisponivel = def.conectar === 'oauth' && dto?.config?.oauth_disponivel === false;

  return (
    <div className="flex flex-col rounded-2xl border border-black/[0.06] bg-white p-4 shadow-card">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${cat.chip}`}><Ico name={cat.icon} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-ink">{def.nome}</h3>
            <Chip className={meta.chip}><span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.cor }} />{meta.label}</Chip>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{def.descricao}</p>
        </div>
      </div>

      {/* Onde é usada */}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {def.usadoEm.map((u) => (
          u.href
            ? <a key={u.label} href={u.href} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft hover:bg-brand-50 hover:text-brand">{u.label}</a>
            : <span key={u.label} className="rounded-full bg-black/[0.04] px-2 py-0.5 text-[0.7rem] font-medium text-ink-soft">{u.label}</span>
        ))}
      </div>

      {/* Meta: origem / último uso / erro */}
      <div className="mt-3 space-y-0.5 text-[0.72rem] text-ink-muted">
        {configurado && <div>Credencial: <span className="font-medium text-ink-soft">{ORIGEM_LABEL[dto!.origem]}</span>{dto?.last4 && <> · •••• {dto.last4}</>}</div>}
        {dto?.ultimo_uso && <div>Último teste: {formatDateTime(dto.ultimo_uso)}</div>}
        {status === 'erro' && dto?.ultimo_erro && <div className="text-red-600">{dto.ultimo_erro}</div>}
        {oauthIndisponivel && <div className="text-amber-600">Indisponível: faltam credenciais da plataforma no servidor.</div>}
      </div>

      {/* Ações */}
      <div className="mt-3 flex flex-wrap gap-2 pt-1">
        {def.conectar === 'oauth' ? (
          <button disabled={busy || oauthIndisponivel} onClick={onConectarMP} className={btnPrimary + ' flex-1 !py-2'}>
            <Ico name="link" className="h-4 w-4" />{configurado ? 'Reconectar' : 'Conectar'}
          </button>
        ) : (
          <button disabled={busy} onClick={onEditar} className={btnPrimary + ' flex-1 !py-2'}>
            <Ico name={configurado ? 'cog' : 'plug'} className="h-4 w-4" />{configurado ? 'Editar' : (def.conectar === 'keyless' ? 'Configurar' : 'Conectar')}
          </button>
        )}
        {(configurado || def.keyless) && (
          <button disabled={busy} onClick={onTestar} className={btnGhost + ' !py-2'} title="Testar conexão">
            <Ico name="refresh" className="h-4 w-4" />Testar
          </button>
        )}
        {temCredUsuario && (
          <button disabled={busy} onClick={onDesconectar} className={btnGhost + ' !py-2 !text-red-600'} title="Desconectar">
            <Ico name="trash" className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ConectarModal({ def, dto, onClose, onSalvo }: {
  def: IntegracaoDef; dto?: ConexaoStatusDTO; onClose: () => void; onSalvo: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const jaTem = new Set(dto?.segredosDefinidos || []);
  // Semente: config não-secreta atual; segredos sempre em branco (não voltam ao client).
  const [form, setForm] = useState<Record<string, string>>(() => {
    const f: Record<string, string> = {};
    for (const c of def.campos) {
      if (c.secret) f[c.name] = '';
      else f[c.name] = (dto?.config?.[c.name] != null ? String(dto.config[c.name]) : (c.tipo === 'select' ? (c.opcoes?.[0]?.v ?? '') : ''));
    }
    return f;
  });

  const setCampo = (name: string, v: string) => setForm((s) => ({ ...s, [name]: v }));

  const salvar = async () => {
    setSaving(true);
    try {
      await salvarConexao(def.chave, form);
      toast.success(`${def.nome} salvo.`);
      onSalvo();
    } catch (e) { toast.error((e as Error).message); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={`Conectar ${def.nome}`}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className={btnGhost}>Cancelar</button>
          <button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
        </>
      }
    >
      <p className="mb-4 text-sm text-ink-muted">{def.descricao}</p>
      <div className="space-y-3.5">
        {def.campos.map((c) => (
          <Field key={c.name} label={c.label + (c.required ? '' : ' (opcional)')} hint={c.hint}>
            {c.tipo === 'select' ? (
              <select className={inp} value={form[c.name] ?? ''} onChange={(e) => setCampo(c.name, e.target.value)}>
                {c.opcoes?.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            ) : (
              <input
                className={inp}
                type={c.tipo === 'password' ? 'password' : c.tipo === 'number' ? 'number' : c.tipo === 'email' ? 'email' : 'text'}
                value={form[c.name] ?? ''}
                onChange={(e) => setCampo(c.name, e.target.value)}
                placeholder={c.secret && jaTem.has(c.name) ? '•••• já configurado — deixe em branco para manter' : c.placeholder}
                autoComplete="off"
              />
            )}
          </Field>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl bg-black/[0.03] px-3 py-2.5 text-[0.72rem] text-ink-muted">
        <Ico name="shield" className="mt-0.5 h-4 w-4 text-emerald-600" />
        <span>Os segredos ficam cifrados no servidor (cofre com acesso restrito) e nunca voltam ao navegador. Depois de salvar, use <strong>Testar</strong> no card.</span>
      </div>
      {def.docsUrl && (
        <a href={def.docsUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
          <Ico name="link" className="h-3.5 w-3.5" />Onde encontrar minhas credenciais
        </a>
      )}
    </Modal>
  );
}

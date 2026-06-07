'use client';

// Minha Propriedade — /painel/minha-propriedade.
// Editor em abas da row de `propriedades` (load por usuario_id, update-ou-insert).
// Porta o mapeamento campo→coluna da versão legada (minhapropriedade.js).
// Follow-ups deixados de fora: FAQ, custos extras, upload de foto do responsável, mapa.

import { useEffect, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { CATS, ESTADOS, EVENTOS_CATS } from '@/lib/data';

type Form = {
  nome: string; categoria: string; descricao: string; capacidade: string;
  cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string;
  whatsapp: string; telefone: string; email_contato: string; nome_responsavel: string;
  valor_base: string; valor_hora: string; valor_periodo: string; regras_preco: string;
  acessibilidade: boolean; climatizado: boolean; estacionamento: boolean; som_alto: boolean; som_tarde: boolean;
  instagram: string; facebook: string; site: string; youtube: string; tiktok: string; linkedin: string;
};

const EMPTY: Form = {
  nome: '', categoria: '', descricao: '', capacidade: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  whatsapp: '', telefone: '', email_contato: '', nome_responsavel: '',
  valor_base: '', valor_hora: '', valor_periodo: '', regras_preco: '',
  acessibilidade: false, climatizado: false, estacionamento: false, som_alto: false, som_tarde: false,
  instagram: '', facebook: '', site: '', youtube: '', tiktok: '', linkedin: '',
};

const ABAS = [
  { id: 'sobre', label: 'Sobre' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'contato', label: 'Contato' },
  { id: 'valores', label: 'Valores' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'comodidades', label: 'Comodidades' },
  { id: 'redes', label: 'Redes' },
] as const;
type AbaId = (typeof ABAS)[number]['id'];

export default function MinhaPropriedadePage() {
  const [loading, setLoading] = useState(true);
  const [propId, setPropId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [eventos, setEventos] = useState<Set<string>>(new Set());
  const [aba, setAba] = useState<AbaId>('sobre');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await sb.from('propriedades').select('*').eq('usuario_id', session.user.id).order('id').limit(1);
      const p = data?.[0];
      if (p) {
        setPropId(p.id);
        setForm({
          nome: p.nome ?? '', categoria: p.categoria ?? '', descricao: p.descricao ?? '',
          capacidade: p.capacidade != null ? String(p.capacidade) : '',
          cep: p.cep ?? '', rua: p.rua ?? '', numero: p.numero ?? '', complemento: p.complemento ?? '',
          bairro: p.bairro ?? '', cidade: p.cidade ?? '', estado: p.estado ?? '',
          whatsapp: p.whatsapp ?? '', telefone: p.telefone ?? '', email_contato: p.email_contato ?? '', nome_responsavel: p.nome_responsavel ?? '',
          valor_base: p.valor_base != null ? String(p.valor_base) : '', valor_hora: p.valor_hora != null ? String(p.valor_hora) : '',
          valor_periodo: p.valor_periodo != null ? String(p.valor_periodo) : '', regras_preco: p.regras_preco ?? '',
          acessibilidade: !!p.acessibilidade, climatizado: !!p.climatizado, estacionamento: !!p.estacionamento, som_alto: !!p.som_alto, som_tarde: !!p.som_tarde,
          instagram: p.instagram ?? '', facebook: p.facebook ?? '', site: p.site ?? '', youtube: p.youtube ?? '', tiktok: p.tiktok ?? '', linkedin: p.linkedin ?? '',
        });
        if (p.tipo_evento) setEventos(new Set(String(p.tipo_evento).split(',').map((t: string) => t.trim()).filter(Boolean)));
      }
      setLoading(false);
    })();
  }, []);

  async function buscarCEP() {
    const cep = form.cep.replace(/\D/g, '');
    if (cep.length !== 8) return;
    try {
      const d = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (!d.erro) setForm((f) => ({ ...f, rua: d.logradouro || f.rua, bairro: d.bairro || f.bairro, cidade: d.localidade || f.cidade, estado: d.uf || f.estado }));
    } catch { /* ignore */ }
  }

  function toggleEvento(v: string) {
    setEventos((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }

  async function salvar() {
    setErro(null);
    setSaving(true);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setErro('Sessão expirada. Faça login novamente.'); setSaving(false); return; }

    const payload: Record<string, unknown> = {
      nome: form.nome || null, categoria: form.categoria || null, descricao: form.descricao || null,
      capacidade: form.capacidade ? Number(form.capacidade.replace(/\D/g, '')) : null,
      cep: form.cep || null, rua: form.rua || null, numero: form.numero || null, complemento: form.complemento || null,
      bairro: form.bairro || null, cidade: form.cidade || null, estado: form.estado || null,
      endereco: [form.rua, form.numero, form.complemento].filter(Boolean).join(', ') || null,
      whatsapp: form.whatsapp || null, telefone: form.telefone || null, email_contato: form.email_contato || null, nome_responsavel: form.nome_responsavel || null,
      valor_base: form.valor_base ? Number(form.valor_base) : null, valor_hora: form.valor_hora ? Number(form.valor_hora) : null,
      valor_periodo: form.valor_periodo ? Number(form.valor_periodo) : null, regras_preco: form.regras_preco || null,
      tipo_evento: [...eventos].join(', ') || null,
      acessibilidade: form.acessibilidade, climatizado: form.climatizado, estacionamento: form.estacionamento, som_alto: form.som_alto, som_tarde: form.som_tarde,
      instagram: form.instagram || null, facebook: form.facebook || null, site: form.site || null, youtube: form.youtube || null, tiktok: form.tiktok || null, linkedin: form.linkedin || null,
    };

    let error;
    if (propId) {
      ({ error } = await sb.from('propriedades').update(payload).eq('id', propId));
    } else {
      const res = await sb.from('propriedades').insert({ ...payload, usuario_id: session.user.id }).select('id').single();
      error = res.error;
      if (res.data?.id) setPropId(res.data.id);
    }
    setSaving(false);
    if (error) setErro(error.message || 'Erro ao salvar.');
    else setSavedAt(Date.now());
  }

  if (loading) return <div className="mx-auto h-[480px] max-w-4xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Minha Propriedade</h1>
          <p className="mt-1 text-sm text-ink-muted">Mantenha os dados do seu espaço completos para aparecer melhor nas buscas.</p>
        </div>
        {propId && (
          <a href={`/propriedade/${propId}`} target="_blank" rel="noreferrer" className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand">
            Ver anúncio
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-black/[0.06]">
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
              aba === a.id ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'
            }`}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="mt-5 rounded-2xl bg-white p-6 shadow-card">
        {aba === 'sobre' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do espaço" className="sm:col-span-2"><input className={inp} value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder="Ex: Espaço Aurora" /></Field>
            <Field label="Categoria">
              <select className={inp} value={form.categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="">Selecione…</option>
                {CATS.map((c) => <option key={c.nome} value={c.nome}>{c.emoji} {c.nome}</option>)}
              </select>
            </Field>
            <Field label="Capacidade (pessoas)"><input type="number" min={0} className={inp} value={form.capacidade} onChange={(e) => set('capacidade', e.target.value)} placeholder="Ex: 180" /></Field>
            <Field label="Descrição" className="sm:col-span-2">
              <textarea className={`${inp} min-h-[140px]`} value={form.descricao} onChange={(e) => set('descricao', e.target.value)} placeholder="Descreva o espaço, diferenciais, estrutura…" />
            </Field>
          </div>
        )}

        {aba === 'endereco' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="CEP">
              <div className="flex gap-2">
                <input className={inp} value={form.cep} onChange={(e) => set('cep', e.target.value)} onBlur={buscarCEP} placeholder="00000-000" />
                <button onClick={buscarCEP} className="shrink-0 rounded-xl border border-black/10 px-3 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand">Buscar</button>
              </div>
            </Field>
            <div className="hidden sm:block" />
            <Field label="Rua"><input className={inp} value={form.rua} onChange={(e) => set('rua', e.target.value)} /></Field>
            <Field label="Número"><input className={inp} value={form.numero} onChange={(e) => set('numero', e.target.value)} /></Field>
            <Field label="Complemento"><input className={inp} value={form.complemento} onChange={(e) => set('complemento', e.target.value)} /></Field>
            <Field label="Bairro"><input className={inp} value={form.bairro} onChange={(e) => set('bairro', e.target.value)} /></Field>
            <Field label="Cidade"><input className={inp} value={form.cidade} onChange={(e) => set('cidade', e.target.value)} /></Field>
            <Field label="Estado">
              <select className={inp} value={form.estado} onChange={(e) => set('estado', e.target.value)}>
                <option value="">UF</option>
                {ESTADOS.map((u) => <option key={u.s} value={u.s}>{u.n}</option>)}
              </select>
            </Field>
          </div>
        )}

        {aba === 'contato' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="WhatsApp"><input className={inp} value={form.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="(11) 99999-9999" /></Field>
            <Field label="Telefone"><input className={inp} value={form.telefone} onChange={(e) => set('telefone', e.target.value)} /></Field>
            <Field label="E-mail de contato"><input type="email" className={inp} value={form.email_contato} onChange={(e) => set('email_contato', e.target.value)} /></Field>
            <Field label="Nome do responsável"><input className={inp} value={form.nome_responsavel} onChange={(e) => set('nome_responsavel', e.target.value)} /></Field>
          </div>
        )}

        {aba === 'valores' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Valor base / diária (R$)"><input type="number" min={0} className={inp} value={form.valor_base} onChange={(e) => set('valor_base', e.target.value)} /></Field>
            <Field label="Valor por hora (R$)"><input type="number" min={0} className={inp} value={form.valor_hora} onChange={(e) => set('valor_hora', e.target.value)} /></Field>
            <Field label="Valor por período (R$)"><input type="number" min={0} className={inp} value={form.valor_periodo} onChange={(e) => set('valor_periodo', e.target.value)} /></Field>
            <Field label="Regras de cobrança" className="sm:col-span-3">
              <textarea className={`${inp} min-h-[100px]`} value={form.regras_preco} onChange={(e) => set('regras_preco', e.target.value)} placeholder="Ex: sinal de 30%, política de cancelamento…" />
            </Field>
          </div>
        )}

        {aba === 'eventos' && (
          <div className="space-y-5">
            <p className="text-sm text-ink-muted">Selecione os tipos de evento que seu espaço atende.</p>
            {EVENTOS_CATS.map((grupo) => (
              <div key={grupo.label}>
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{grupo.label}</div>
                <div className="flex flex-wrap gap-2">
                  {grupo.items.map((it) => {
                    const on = eventos.has(it.v);
                    return (
                      <button
                        key={it.v}
                        onClick={() => toggleEvento(it.v)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          on ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-black/10 text-ink-soft hover:border-brand/50'
                        }`}
                      >
                        {it.emoji} {it.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {aba === 'comodidades' && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Toggle label="Climatizado / ar-condicionado" checked={form.climatizado} onChange={(v) => set('climatizado', v)} />
            <Toggle label="Estacionamento" checked={form.estacionamento} onChange={(v) => set('estacionamento', v)} />
            <Toggle label="Acessibilidade" checked={form.acessibilidade} onChange={(v) => set('acessibilidade', v)} />
            <Toggle label="Permite som alto" checked={form.som_alto} onChange={(v) => set('som_alto', v)} />
            <Toggle label="Som permitido até mais tarde" checked={form.som_tarde} onChange={(v) => set('som_tarde', v)} />
          </div>
        )}

        {aba === 'redes' && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Instagram"><input className={inp} value={form.instagram} onChange={(e) => set('instagram', e.target.value)} placeholder="@seuespaco" /></Field>
            <Field label="Facebook"><input className={inp} value={form.facebook} onChange={(e) => set('facebook', e.target.value)} /></Field>
            <Field label="Site"><input className={inp} value={form.site} onChange={(e) => set('site', e.target.value)} /></Field>
            <Field label="YouTube"><input className={inp} value={form.youtube} onChange={(e) => set('youtube', e.target.value)} /></Field>
            <Field label="TikTok"><input className={inp} value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)} /></Field>
            <Field label="LinkedIn"><input className={inp} value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} /></Field>
          </div>
        )}
      </div>

      {/* Barra de salvar */}
      <div className="sticky bottom-0 mt-4 flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white/95 p-4 shadow-card backdrop-blur">
        <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
          {saving ? 'Salvando…' : 'Salvar alterações'}
        </button>
        {savedAt && !saving && <span className="text-sm font-medium text-emerald-600">✓ Alterações salvas</span>}
        {erro && <span className="text-sm font-medium text-red-600">{erro}</span>}
      </div>
    </div>
  );
}

const inp = 'w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-semibold text-ink-soft">{label}</span>
      {children}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-black/10 px-4 py-3">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-brand" />
    </label>
  );
}

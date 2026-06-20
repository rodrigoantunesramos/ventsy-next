'use client';

// Minha Propriedade — /painel/minha-propriedade (premium).
// Editor em abas da row de `propriedades` (multi-propriedade, load-ou-insert).
// Recursos: Força do Anúncio, publicar/despublicar, mapa+geolocalização,
// comodidades ricas (array + sync boolean), FAQ, custos extras, perfil do
// anfitrião, máscaras/validação, prévia ao vivo e aviso de alterações não salvas.

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase as sb, authHeaders } from '@/lib/supabase';
import { comprimirImagem } from '@/lib/imageUpload';
import { CATS, ESTADOS, EVENTOS_CATS, COMODIDADES } from '@/lib/data';
import { maskCEP, maskTelefone, maskMoeda, parseMoeda, moedaFromNumber, onlyDigits, validarEmail, normalizeInstagram } from '@/lib/masks';
import ComodidadesPicker from './_components/ComodidadesPicker';
import FaqEditor, { type FaqItem } from './_components/FaqEditor';
import CustosExtras, { type CustoItem } from './_components/CustosExtras';
import PublishToggle from './_components/PublishToggle';
import ForcaAnuncio, { type AnuncioStats } from './_components/ForcaAnuncio';
import MapaEndereco from './_components/MapaEndereco';
import PreviewAnuncio from './_components/PreviewAnuncio';
import { useUnsavedChanges } from './_components/useUnsavedChanges';

type Form = {
  nome: string; categoria: string; descricao: string; capacidade: string;
  cep: string; rua: string; numero: string; complemento: string; bairro: string; cidade: string; estado: string;
  whatsapp: string; telefone: string; email_contato: string; nome_responsavel: string; bio_responsavel: string; foto_responsavel: string;
  valor_base: string; valor_hora: string; valor_periodo: string; regras_preco: string;
  instagram: string; facebook: string; site: string; youtube: string; tiktok: string; linkedin: string;
  latitude: number | null; longitude: number | null;
};

const EMPTY: Form = {
  nome: '', categoria: '', descricao: '', capacidade: '',
  cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '',
  whatsapp: '', telefone: '', email_contato: '', nome_responsavel: '', bio_responsavel: '', foto_responsavel: '',
  valor_base: '', valor_hora: '', valor_periodo: '', regras_preco: '',
  instagram: '', facebook: '', site: '', youtube: '', tiktok: '', linkedin: '',
  latitude: null, longitude: null,
};

const ABAS = [
  { id: 'sobre', label: 'Sobre' },
  { id: 'anfitriao', label: 'Anfitrião' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'contato', label: 'Contato' },
  { id: 'valores', label: 'Valores' },
  { id: 'eventos', label: 'Eventos' },
  { id: 'comodidades', label: 'Comodidades' },
  { id: 'faq', label: 'FAQ' },
  { id: 'redes', label: 'Redes' },
] as const;
type AbaId = (typeof ABAS)[number]['id'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseArray(val: any): string[] {
  if (Array.isArray(val)) return val.map(String);
  if (!val) return [];
  if (typeof val === 'string') {
    const s = val.trim();
    if (s.startsWith('{')) return s.slice(1, -1).split(',').map((x) => x.trim().replace(/^"|"$/g, '')).filter(Boolean);
    try { const j = JSON.parse(s); return Array.isArray(j) ? j.map(String) : []; } catch { return []; }
  }
  return [];
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseObjArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') { try { const j = JSON.parse(val); return Array.isArray(j) ? j : []; } catch { return []; } }
  return [];
}

function serialize(f: Form, ev: Set<string>, com: Set<string>, fq: FaqItem[], cs: CustoItem[]): string {
  // foto_responsavel e publicada são persistidos imediatamente → fora do snapshot.
  const { foto_responsavel: _omit, ...rest } = f;
  void _omit;
  return JSON.stringify({ rest, ev: [...ev].sort(), com: [...com].sort(), fq, cs });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = any;

export default function MinhaPropriedadePage() {
  const [loading, setLoading] = useState(true);
  const [allProps, setAllProps] = useState<Row[]>([]);
  const [propId, setPropId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [eventos, setEventos] = useState<Set<string>>(new Set());
  const [comodidades, setComodidades] = useState<Set<string>>(new Set());
  const [faq, setFaq] = useState<FaqItem[]>([]);
  const [custos, setCustos] = useState<CustoItem[]>([]);
  const [publicada, setPublicada] = useState(false);
  const [capaUrl, setCapaUrl] = useState<string | null>(null);
  const [nota, setNota] = useState<number | null>(null);
  const [numFotos, setNumFotos] = useState(0);

  const [aba, setAba] = useState<AbaId>('sobre');
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [baseline, setBaseline] = useState('');

  const avatarInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  function applyRow(p: Row | null) {
    const f: Form = p
      ? {
          nome: p.nome ?? '', categoria: p.categoria ?? '', descricao: p.descricao ?? '',
          capacidade: p.capacidade != null ? String(p.capacidade) : '',
          cep: p.cep ?? '', rua: p.rua ?? '', numero: p.numero ?? '', complemento: p.complemento ?? '',
          bairro: p.bairro ?? '', cidade: p.cidade ?? '', estado: p.estado ?? '',
          whatsapp: p.whatsapp ?? '', telefone: p.telefone ?? '', email_contato: p.email_contato ?? '',
          nome_responsavel: p.nome_responsavel ?? '', bio_responsavel: p.bio_responsavel ?? '', foto_responsavel: p.foto_responsavel ?? '',
          valor_base: moedaFromNumber(p.valor_base), valor_hora: moedaFromNumber(p.valor_hora), valor_periodo: moedaFromNumber(p.valor_periodo),
          regras_preco: p.regras_preco ?? '',
          instagram: p.instagram ?? '', facebook: p.facebook ?? '', site: p.site ?? '', youtube: p.youtube ?? '', tiktok: p.tiktok ?? '', linkedin: p.linkedin ?? '',
          latitude: p.latitude ?? null, longitude: p.longitude ?? null,
        }
      : { ...EMPTY };

    const ev = new Set<string>(p?.tipo_evento ? String(p.tipo_evento).split(',').map((s: string) => s.trim()).filter(Boolean) : []);

    const com = new Set<string>(parseArray(p?.comodidades));
    COMODIDADES.forEach((c) => { if (c.boolCol && p?.[c.boolCol]) com.add(c.slug); });

    const fq: FaqItem[] = (Array.isArray(p?.faq) ? p.faq : []).map((x: { pergunta?: string; resposta?: string }) => ({ pergunta: x?.pergunta ?? '', resposta: x?.resposta ?? '' }));
    const cs: CustoItem[] = parseObjArray(p?.custos_extras).map((x: { nome?: string; valor?: number }) => ({ nome: x?.nome ?? '', valor: moedaFromNumber(x?.valor) }));

    setPropId(p?.id ?? null);
    setPublicada(!!p?.publicada);
    setCapaUrl(p?.imagem_url ?? null);
    setNota(p?.avaliacao ?? null);
    setForm(f);
    setEventos(ev);
    setComodidades(com);
    setFaq(fq);
    setCustos(cs);
    setBaseline(serialize(f, ev, com, fq, cs));
  }

  async function carregarFotos(pid: number | null) {
    if (!pid) { setNumFotos(0); return; }
    const { count } = await sb.from('fotos_imovel').select('id', { count: 'exact', head: true }).eq('propriedade_id', pid);
    setNumFotos(count || 0);
  }

  useEffect(() => {
    (async () => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setLoading(false); return; }
      const { data } = await sb.from('propriedades').select('*').eq('usuario_id', session.user.id).order('id');
      const rows = (data || []) as Row[];
      setAllProps(rows);
      applyRow(rows[0] ?? null);
      await carregarFotos(rows[0]?.id ?? null);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function trocarPropriedade(id: number) {
    const row = allProps.find((p) => p.id === id) ?? null;
    applyRow(row);
    carregarFotos(id);
    setSavedAt(null);
    setErro(null);
    setAba('sobre');
  }

  function novoEspaco() {
    applyRow(null);
    setNumFotos(0);
    setSavedAt(null);
    setErro(null);
    setAba('sobre');
  }

  const isDirty = useMemo(() => baseline !== '' && serialize(form, eventos, comodidades, faq, custos) !== baseline, [form, eventos, comodidades, faq, custos, baseline]);
  useUnsavedChanges(isDirty);

  function toggleEvento(v: string) {
    setEventos((s) => { const n = new Set(s); n.has(v) ? n.delete(v) : n.add(v); return n; });
  }
  function toggleComodidade(slug: string) {
    setComodidades((s) => { const n = new Set(s); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });
  }

  async function buscarCEP() {
    const cep = onlyDigits(form.cep);
    if (cep.length !== 8) return;
    try {
      const d = await fetch(`https://viacep.com.br/ws/${cep}/json/`).then((r) => r.json());
      if (!d.erro) setForm((f) => ({ ...f, rua: d.logradouro || f.rua, bairro: d.bairro || f.bairro, cidade: d.localidade || f.cidade, estado: d.uf || f.estado }));
    } catch { /* ignore */ }
  }

  async function enviarAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !propId) return;
    setAvatarBusy(true); setErro(null);
    try {
      const blob = await comprimirImagem(file);
      const fd = new FormData();
      fd.append('propriedadeId', String(propId));
      fd.append('file', blob, 'anfitriao.webp');
      const r = await fetch('/api/propriedade/avatar', { method: 'POST', headers: await authHeaders(), body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Falha ao enviar a foto.');
      set('foto_responsavel', j.url);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao enviar a foto.');
    }
    setAvatarBusy(false);
    if (avatarInput.current) avatarInput.current.value = '';
  }

  const stats: AnuncioStats = {
    numFotos,
    descricaoLen: form.descricao.trim().length,
    temCapacidade: !!form.capacidade,
    enderecoCompleto: !!(form.cidade && form.estado && form.cep),
    geolocalizado: form.latitude != null && form.longitude != null,
    temPreco: parseMoeda(form.valor_base) > 0 || parseMoeda(form.valor_hora) > 0,
    temWhatsapp: !!form.whatsapp.trim(),
    numComodidades: comodidades.size,
    numEventos: eventos.size,
    numFaq: faq.filter((f) => f.pergunta.trim()).length,
    temAnfitriao: !!form.foto_responsavel && !!form.bio_responsavel.trim(),
  };

  const missing: string[] = [];
  if (!form.nome.trim()) missing.push('nome');
  if (!(form.cidade && form.estado)) missing.push('cidade/estado');
  if (numFotos < 1) missing.push('1 foto');
  if (!stats.temPreco) missing.push('preço');
  const canPublish = missing.length === 0;

  const abaOk: Record<AbaId, boolean> = {
    sobre: !!form.nome.trim() && form.descricao.trim().length >= 120 && !!form.capacidade,
    anfitriao: !!form.foto_responsavel && !!form.bio_responsavel.trim(),
    endereco: !!(form.cidade && form.estado && form.cep) && form.latitude != null,
    contato: !!form.whatsapp.trim(),
    valores: stats.temPreco,
    eventos: eventos.size > 0,
    comodidades: comodidades.size >= 3,
    faq: faq.filter((f) => f.pergunta.trim()).length > 0,
    redes: !!(form.instagram || form.facebook || form.site || form.youtube || form.tiktok || form.linkedin),
  };

  async function togglePublicar(v: boolean) {
    if (v && !canPublish) return;
    setPublicada(v);
    if (propId) {
      const { error } = await sb.from('propriedades').update({ publicada: v }).eq('id', propId);
      if (error) { setErro(error.message); setPublicada(!v); return; }
      setAllProps((arr) => arr.map((p) => (p.id === propId ? { ...p, publicada: v } : p)));
    }
  }

  async function salvar() {
    setErro(null);
    if (!validarEmail(form.email_contato)) { setErro('E-mail de contato inválido.'); setAba('contato'); return; }
    setSaving(true);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setErro('Sessão expirada. Faça login novamente.'); setSaving(false); return; }

    const payload: Record<string, unknown> = {
      nome: form.nome || null, categoria: form.categoria || null, descricao: form.descricao || null,
      capacidade: form.capacidade ? Number(onlyDigits(form.capacidade)) : null,
      cep: form.cep || null, rua: form.rua || null, numero: form.numero || null, complemento: form.complemento || null,
      bairro: form.bairro || null, cidade: form.cidade || null, estado: form.estado || null,
      endereco: [form.rua, form.numero, form.complemento].filter(Boolean).join(', ') || null,
      latitude: form.latitude, longitude: form.longitude,
      whatsapp: form.whatsapp || null, telefone: form.telefone || null, email_contato: form.email_contato || null,
      nome_responsavel: form.nome_responsavel || null, bio_responsavel: form.bio_responsavel || null, foto_responsavel: form.foto_responsavel || null,
      valor_base: parseMoeda(form.valor_base) || null, valor_hora: parseMoeda(form.valor_hora) || null, valor_periodo: parseMoeda(form.valor_periodo) || null,
      regras_preco: form.regras_preco || null,
      tipo_evento: [...eventos].join(', ') || null,
      comodidades: [...comodidades],
      custos_extras: custos.filter((c) => c.nome.trim()).map((c) => ({ nome: c.nome.trim(), valor: parseMoeda(c.valor) })),
      faq: faq.filter((f) => f.pergunta.trim()).map((f) => ({ pergunta: f.pergunta.trim(), resposta: f.resposta.trim() })),
      publicada,
    };
    // Sincroniza colunas boolean que a busca filtra a partir das comodidades.
    COMODIDADES.forEach((c) => { if (c.boolCol) payload[c.boolCol] = comodidades.has(c.slug); });

    let error;
    let savedId = propId;
    if (propId) {
      ({ error } = await sb.from('propriedades').update(payload).eq('id', propId));
    } else {
      const res = await sb.from('propriedades').insert({ ...payload, usuario_id: session.user.id }).select('*').single();
      error = res.error;
      if (res.data?.id) { savedId = res.data.id; setPropId(res.data.id); setAllProps((arr) => [...arr, res.data]); }
    }

    setSaving(false);
    if (error) { setErro(error.message || 'Erro ao salvar.'); return; }
    setSavedAt(Date.now());
    setBaseline(serialize(form, eventos, comodidades, faq, custos));
    setAllProps((arr) => arr.map((p) => (p.id === savedId ? { ...p, nome: form.nome, publicada } : p)));
  }

  if (loading) return <div className="mx-auto h-[520px] max-w-6xl animate-pulse rounded-2xl bg-black/[0.05]" />;

  const enderecoQuery = [form.rua, form.numero, form.bairro, form.cidade, form.estado, 'Brasil'].filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-6xl pb-28">
      <input ref={avatarInput} type="file" accept="image/*" hidden onChange={enviarAvatar} />

      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-ink sm:text-2xl">Minha Propriedade</h1>
          <p className="mt-1 text-sm text-ink-muted">Mantenha os dados completos para aparecer melhor nas buscas e converter mais.</p>
          {allProps.length > 1 && (
            <select
              value={propId ?? ''}
              onChange={(e) => trocarPropriedade(Number(e.target.value))}
              className="mt-3 rounded-xl border border-black/10 px-3 py-2 text-sm font-semibold text-ink-soft focus:border-brand focus:outline-none"
            >
              {allProps.map((p) => <option key={p.id} value={p.id}>{p.nome || `Espaço #${p.id}`}</option>)}
            </select>
          )}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <PublishToggle publicada={publicada} canPublish={canPublish} missing={missing} saving={saving} onChange={togglePublicar} />
          <div className="flex items-center gap-2">
            <button onClick={novoEspaco} className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand">
              + Novo espaço
            </button>
            {propId && (
              <a href={`/propriedade/${propId}`} target="_blank" rel="noreferrer" className="rounded-full border border-black/10 px-4 py-2.5 text-sm font-semibold text-ink-soft transition hover:border-brand hover:text-brand">
                Ver anúncio
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Força do anúncio */}
      <div className="mt-5">
        <ForcaAnuncio stats={stats} onJump={(a) => { setAba(a as AbaId); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {/* Tabs */}
          <div className="flex flex-wrap gap-1.5 border-b border-black/[0.06]">
            {ABAS.map((a) => (
              <button
                key={a.id}
                onClick={() => setAba(a.id)}
                className={`flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
                  aba === a.id ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'
                }`}
              >
                {a.label}
                {abaOk[a.id] && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Completo" />}
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
                  <span className={`mt-1 block text-xs ${form.descricao.trim().length >= 120 ? 'text-emerald-600' : 'text-ink-muted'}`}>{form.descricao.trim().length}/120 caracteres recomendados</span>
                </Field>
              </div>
            )}

            {aba === 'anfitriao' && (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-black/[0.05] text-2xl">
                    {form.foto_responsavel
                      ? // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.foto_responsavel} alt="Foto do anfitrião" className="h-full w-full object-cover" />
                      : '🧑'}
                  </div>
                  <div>
                    <button onClick={() => avatarInput.current?.click()} disabled={!propId || avatarBusy} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-60">
                      {avatarBusy ? 'Enviando…' : form.foto_responsavel ? 'Trocar foto' : 'Enviar foto'}
                    </button>
                    {!propId && <p className="mt-1 text-xs text-ink-muted">Salve o espaço primeiro para enviar a foto.</p>}
                  </div>
                </div>
                <Field label="Nome do responsável"><input className={inp} value={form.nome_responsavel} onChange={(e) => set('nome_responsavel', e.target.value)} placeholder="Ex: Maria Souza" /></Field>
                <Field label="Apresentação (bio)">
                  <textarea className={`${inp} min-h-[120px]`} value={form.bio_responsavel} onChange={(e) => set('bio_responsavel', e.target.value)} placeholder="Fale um pouco sobre você e a experiência que oferece aos clientes." />
                </Field>
              </div>
            )}

            {aba === 'endereco' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="CEP">
                    <div className="flex gap-2">
                      <input className={inp} value={form.cep} onChange={(e) => set('cep', maskCEP(e.target.value))} onBlur={buscarCEP} placeholder="00000-000" />
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
                <MapaEndereco
                  query={enderecoQuery}
                  lat={form.latitude}
                  lng={form.longitude}
                  onCoords={(la, lo) => setForm((f) => ({ ...f, latitude: la, longitude: lo }))}
                />
              </div>
            )}

            {aba === 'contato' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="WhatsApp"><input className={inp} value={form.whatsapp} onChange={(e) => set('whatsapp', maskTelefone(e.target.value))} placeholder="(11) 99999-9999" /></Field>
                <Field label="Telefone"><input className={inp} value={form.telefone} onChange={(e) => set('telefone', maskTelefone(e.target.value))} placeholder="(11) 3333-4444" /></Field>
                <Field label="E-mail de contato">
                  <input type="email" className={inp} value={form.email_contato} onChange={(e) => set('email_contato', e.target.value)} />
                  {!validarEmail(form.email_contato) && <span className="mt-1 block text-xs text-red-600">E-mail inválido.</span>}
                </Field>
              </div>
            )}

            {aba === 'valores' && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <MoneyField label="Valor base / diária" value={form.valor_base} onChange={(v) => set('valor_base', v)} />
                  <MoneyField label="Valor por hora" value={form.valor_hora} onChange={(v) => set('valor_hora', v)} />
                  <MoneyField label="Valor por período" value={form.valor_periodo} onChange={(v) => set('valor_periodo', v)} />
                </div>
                <Field label="Regras de cobrança">
                  <textarea className={`${inp} min-h-[90px]`} value={form.regras_preco} onChange={(e) => set('regras_preco', e.target.value)} placeholder="Ex: sinal de 30%, política de cancelamento…" />
                </Field>
                <div>
                  <div className="mb-2 text-sm font-semibold text-ink-soft">Custos / serviços extras</div>
                  <CustosExtras items={custos} onChange={setCustos} />
                </div>
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
                          <button key={it.v} onClick={() => toggleEvento(it.v)} className={`rounded-full border px-3 py-1.5 text-sm transition ${on ? 'border-brand bg-brand-50 font-semibold text-brand' : 'border-black/10 text-ink-soft hover:border-brand/50'}`}>
                            {it.emoji} {it.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {aba === 'comodidades' && <ComodidadesPicker value={comodidades} onToggle={toggleComodidade} />}

            {aba === 'faq' && <FaqEditor items={faq} onChange={setFaq} />}

            {aba === 'redes' && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Instagram"><input className={inp} value={form.instagram} onChange={(e) => set('instagram', e.target.value)} onBlur={(e) => set('instagram', normalizeInstagram(e.target.value))} placeholder="@seuespaco" /></Field>
                <Field label="Facebook"><input className={inp} value={form.facebook} onChange={(e) => set('facebook', e.target.value)} /></Field>
                <Field label="Site"><input className={inp} value={form.site} onChange={(e) => set('site', e.target.value)} /></Field>
                <Field label="YouTube"><input className={inp} value={form.youtube} onChange={(e) => set('youtube', e.target.value)} /></Field>
                <Field label="TikTok"><input className={inp} value={form.tiktok} onChange={(e) => set('tiktok', e.target.value)} /></Field>
                <Field label="LinkedIn"><input className={inp} value={form.linkedin} onChange={(e) => set('linkedin', e.target.value)} /></Field>
              </div>
            )}
          </div>
        </div>

        {/* Prévia ao vivo */}
        <div className="space-y-4">
          <PreviewAnuncio
            data={{
              nome: form.nome, cidade: form.cidade, estado: form.estado, categoria: form.categoria, capacidade: form.capacidade,
              valorBase: parseMoeda(form.valor_base), valorHora: parseMoeda(form.valor_hora), imagem: capaUrl, nota,
            }}
          />
        </div>
      </div>

      {/* Barra de salvar */}
      <div className="fixed bottom-0 left-0 right-0 z-[120] border-t border-black/[0.06] bg-white/95 backdrop-blur md:left-[260px]">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <button onClick={salvar} disabled={saving} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-60">
            {saving ? 'Salvando…' : 'Salvar alterações'}
          </button>
          {isDirty && !saving && <span className="text-sm font-medium text-amber-600">Alterações não salvas</span>}
          {!isDirty && savedAt && !saving && <span className="text-sm font-medium text-emerald-600">✓ Tudo salvo</span>}
          {erro && <span className="text-sm font-medium text-red-600">{erro}</span>}
        </div>
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

function MoneyField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field label={label}>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">R$</span>
        <input className={`${inp} pl-9`} inputMode="numeric" value={value} onChange={(e) => onChange(maskMoeda(e.target.value))} placeholder="0,00" />
      </div>
    </Field>
  );
}

'use client';

// Página PÚBLICA de venda de ingressos — /ingressos/[token]. O comprador abre
// SEM login, escolhe categorias/lotes, aplica cupom, preenche os dados e paga
// via Mercado Pago (Checkout Pro: Pix/cartão/boleto). Ao voltar do pagamento
// (?pedido=<id>), a mesma página mostra o andamento e os ingressos com QR.
// Os dados vêm das rotas service-role /api/bilheteria/* (resolvidas pelo token).
// Sem "R$" hardcoded — a moeda é a da própria bilheteria (lib/format).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { setFormatPrefs, formatMoney, formatDateRange, type Currency, type Locale } from '@/lib/format';
import { cotarPedido, descontoCupom, type Categoria, type CampoExtra } from '@/lib/bilheteria';
import { QrCode } from '../../../(proprietario)/painel/acesso/_components/QrCode';

const LOCALE_BY_MOEDA: Record<string, Locale> = { BRL: 'pt-BR', USD: 'en-US', EUR: 'es-ES' };

// ── Tipos do payload público ──────────────────────────────────────────────────
type CatPub = {
  id: string; nome: string; descricao: string | null; preco_num: number; lote: number; lote_nome: string | null;
  ordem: number; max_por_pedido: number; meia: boolean; meia_percent: number; por_pessoa: boolean;
  kit: Record<string, unknown> | null; quantidade: number; disponivel: number | null; aVenda: boolean; motivo: string | null;
};
type BilhPub = {
  id: string; titulo: string; descricao: string | null; local_texto: string | null; imagem_url: string | null;
  capacidade: number; venda_inicio: string | null; venda_fim: string | null; status: string; taxa_servico: number;
  moeda: string; campos_extras: CampoExtra[]; pagina_token: string;
};
type EventoPub = { nome_evento: string | null; tipo_evento: string | null; data_inicio: string | null; data_fim: string | null } | null;
type Payload = { bilheteria: BilhPub; categorias: CatPub[]; evento: EventoPub; aVenda: boolean; motivo: string | null };

type CartItem = { qtd: number; meia: boolean; titulares: { nome: string; doc: string; extras: Record<string, string> }[] };

const MOTIVO_VENDA: Record<string, string> = {
  rascunho: 'As vendas ainda não foram abertas.',
  encerrada: 'As vendas estão encerradas.',
  nao_iniciada: 'As vendas ainda não começaram.',
  encerrada_data: 'O período de vendas terminou.',
};

const inp = 'w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

export default function IngressosPublicoPage() {
  const params = useParams();
  const search = useSearchParams();
  const token = String(params?.token || '');
  const pedidoId = search?.get('pedido') || '';

  if (pedidoId) return <PedidoView pedidoId={pedidoId} token={token} />;
  return <VendaView token={token} />;
}

// ════════════════════ VENDA ════════════════════
function VendaView({ token }: { token: string }) {
  const [estado, setEstado] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [data, setData] = useState<Payload | null>(null);
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [comprador, setComprador] = useState({ nome: '', email: '', doc: '', telefone: '' });
  const [cupomInput, setCupomInput] = useState('');
  const [cupom, setCupom] = useState<{ codigo: string; tipo: 'percentual' | 'fixo'; valor_num: number } | null>(null);
  const [cupomMsg, setCupomMsg] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/bilheteria/publica?token=${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (!res.ok) { setEstado('notfound'); return; }
      const json = (await res.json()) as Payload;
      if (!json?.bilheteria) { setEstado('notfound'); return; }
      const moeda = (json.bilheteria.moeda as Currency) || 'BRL';
      setFormatPrefs({ currency: moeda, locale: LOCALE_BY_MOEDA[moeda] || 'pt-BR' });
      setData(json);
      setEstado('ready');
    } catch { setEstado('notfound'); }
  }, [token]);

  useEffect(() => { if (token) carregar(); }, [token, carregar]);

  const categorias = data?.categorias || [];
  const catById = useMemo(() => new Map(categorias.map((c) => [c.id, c])), [categorias]);

  // Cotação (mesma engine do servidor).
  const cotacao = useMemo(() => {
    if (!data) return null;
    const itens = Object.entries(cart)
      .filter(([, v]) => v.qtd > 0)
      .map(([id, v]) => ({ categoria: catById.get(id) as unknown as Categoria, qtd: v.qtd, meia: v.meia }))
      .filter((i) => i.categoria);
    const cupomEng = cupom ? { tipo: cupom.tipo, valor_num: cupom.valor_num } : null;
    return cotarPedido(itens, cupomEng, data.bilheteria.taxa_servico, data.bilheteria.moeda);
  }, [cart, cupom, data, catById]);

  const totalIngressos = cotacao?.itens || 0;

  // Precisa coletar titular por ingresso?
  const precisaTitular = useMemo(() => {
    if (!data) return false;
    if ((data.bilheteria.campos_extras || []).length > 0) return true;
    return Object.entries(cart).some(([id, v]) => v.qtd > 0 && catById.get(id)?.por_pessoa);
  }, [cart, data, catById]);

  function setQtd(cat: CatPub, qtd: number) {
    const max = Math.min(
      cat.max_por_pedido > 0 ? cat.max_por_pedido : Infinity,
      cat.disponivel == null ? Infinity : cat.disponivel,
    );
    const q = Math.max(0, Math.min(qtd, max === Infinity ? 99 : max));
    setCart((prev) => {
      const cur = prev[cat.id] || { qtd: 0, meia: false, titulares: [] };
      const titulares = Array.from({ length: q }, (_, k) => cur.titulares[k] || { nome: '', doc: '', extras: {} });
      return { ...prev, [cat.id]: { ...cur, qtd: q, titulares } };
    });
  }
  function setMeia(catId: string, meia: boolean) {
    setCart((prev) => ({ ...prev, [catId]: { ...(prev[catId] || { qtd: 0, titulares: [] }), meia } as CartItem }));
  }
  function setTitular(catId: string, idx: number, patch: Partial<{ nome: string; doc: string }>) {
    setCart((prev) => {
      const cur = prev[catId]; if (!cur) return prev;
      const titulares = cur.titulares.map((t, k) => (k === idx ? { ...t, ...patch } : t));
      return { ...prev, [catId]: { ...cur, titulares } };
    });
  }
  function setTitularExtra(catId: string, idx: number, chave: string, valor: string) {
    setCart((prev) => {
      const cur = prev[catId]; if (!cur) return prev;
      const titulares = cur.titulares.map((t, k) => (k === idx ? { ...t, extras: { ...t.extras, [chave]: valor } } : t));
      return { ...prev, [catId]: { ...cur, titulares } };
    });
  }

  async function aplicarCupom() {
    const codigo = cupomInput.trim();
    if (!codigo) return;
    setCupomMsg(null);
    try {
      const res = await fetch('/api/bilheteria/publica', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, action: 'validar_cupom', codigo }),
      });
      const json = await res.json();
      if (json?.ok) { setCupom(json.cupom); setCupomMsg('Cupom aplicado!'); }
      else { setCupom(null); setCupomMsg('Cupom inválido ou expirado.'); }
    } catch { setCupomMsg('Não foi possível validar o cupom.'); }
  }

  async function finalizar() {
    if (!data || enviando) return;
    setErro(null);
    if (!comprador.nome.trim()) { setErro('Informe seu nome.'); return; }
    if (!comprador.email.trim()) { setErro('Informe seu e-mail para receber os ingressos.'); return; }
    if (totalIngressos === 0) { setErro('Selecione ao menos um ingresso.'); return; }

    const itens = Object.entries(cart)
      .filter(([, v]) => v.qtd > 0)
      .map(([categoria_id, v]) => ({
        categoria_id, qtd: v.qtd, meia: v.meia,
        titulares: precisaTitular ? v.titulares.map((t) => ({ nome: t.nome, doc: t.doc, extras: t.extras })) : undefined,
      }));

    setEnviando(true);
    try {
      const res = await fetch('/api/bilheteria/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, comprador, itens, cupom_codigo: cupom?.codigo || '' }),
      });
      const json = await res.json();
      if (!res.ok) {
        if (json?.error === 'indisponivel') { setErro('Alguns ingressos esgotaram enquanto você comprava. Atualize a página.'); await carregar(); }
        else if (json?.error === 'cupom_invalido') setErro('O cupom não é mais válido.');
        else if (json?.error === 'venda_indisponivel') setErro(MOTIVO_VENDA[json?.motivo] || 'As vendas não estão disponíveis.');
        else setErro(json?.error || 'Não foi possível concluir. Tente novamente.');
        setEnviando(false);
        return;
      }
      if (json.link) { window.location.href = json.link; return; }           // → Mercado Pago
      // Sem link (grátis/cortesia ou pagamento indisponível) → vai p/ a confirmação.
      window.location.href = `/ingressos/${token}?pedido=${json.pedido_id}`;
    } catch {
      setErro('Falha de conexão. Tente novamente.');
      setEnviando(false);
    }
  }

  if (estado === 'loading') return <BrandSplash />;
  if (estado === 'notfound' || !data) return <NotFound titulo="Página de venda não encontrada" texto="O link pode estar incorreto ou as vendas foram retiradas do ar." />;

  const b = data.bilheteria;
  const ev = data.evento;
  const periodo = ev?.data_inicio ? formatDateRange(ev.data_inicio, ev.data_fim || ev.data_inicio) : null;

  return (
    <div className="min-h-screen bg-[#f7f7f8] pb-40">
      <Header titulo={b.titulo} />

      {/* Capa */}
      {b.imagem_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.imagem_url} alt={b.titulo} className="h-48 w-full object-cover sm:h-64" />
      )}

      <main className="mx-auto max-w-2xl px-4">
        <div className="mt-5 rounded-2xl bg-white p-5 shadow-card sm:p-6">
          <h1 className="font-display text-2xl font-bold text-ink sm:text-3xl">{b.titulo}</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-muted">
            {periodo && <span>📅 {periodo}</span>}
            {b.local_texto && <span>📍 {b.local_texto}</span>}
          </div>
          {b.descricao && <p className="mt-3 whitespace-pre-line text-sm text-ink-soft">{b.descricao}</p>}
        </div>

        {!data.aVenda ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-800">
            {MOTIVO_VENDA[data.motivo || ''] || 'As vendas não estão disponíveis no momento.'}
          </div>
        ) : (
          <>
            {/* Categorias */}
            <div className="mt-4 space-y-3">
              {categorias.map((cat) => (
                <CategoriaCard key={cat.id} cat={cat} item={cart[cat.id]} onQtd={(q) => setQtd(cat, q)} onMeia={(m) => setMeia(cat.id, m)} />
              ))}
              {categorias.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-ink-muted shadow-card">Nenhuma categoria de ingresso disponível ainda.</div>
              )}
            </div>

            {/* Titulares (quando exigido) */}
            {precisaTitular && totalIngressos > 0 && (
              <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
                <h2 className="text-base font-bold text-ink">Dados dos participantes</h2>
                <p className="mt-0.5 text-xs text-ink-muted">Preencha os dados de cada ingresso.</p>
                <div className="mt-3 space-y-4">
                  {Object.entries(cart).filter(([, v]) => v.qtd > 0).map(([catId, v]) => {
                    const cat = catById.get(catId)!;
                    return v.titulares.map((t, idx) => (
                      <div key={`${catId}-${idx}`} className="rounded-xl border border-black/[0.06] p-3">
                        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{cat.nome} · ingresso {idx + 1}</div>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <input className={inp} placeholder="Nome completo" value={t.nome} onChange={(e) => setTitular(catId, idx, { nome: e.target.value })} />
                          <input className={inp} placeholder="Documento (CPF/RG)" value={t.doc} onChange={(e) => setTitular(catId, idx, { doc: e.target.value })} />
                          {(data.bilheteria.campos_extras || []).map((campo) => (
                            <ExtraField key={campo.chave} campo={campo} value={t.extras[campo.chave] || ''} onChange={(val) => setTitularExtra(catId, idx, campo.chave, val)} />
                          ))}
                        </div>
                      </div>
                    ));
                  })}
                </div>
              </div>
            )}

            {/* Comprador */}
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">Seus dados</h2>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input className={inp} placeholder="Nome completo *" value={comprador.nome} onChange={(e) => setComprador((c) => ({ ...c, nome: e.target.value }))} />
                <input className={inp} type="email" placeholder="E-mail *" value={comprador.email} onChange={(e) => setComprador((c) => ({ ...c, email: e.target.value }))} />
                <input className={inp} placeholder="Documento (CPF)" value={comprador.doc} onChange={(e) => setComprador((c) => ({ ...c, doc: e.target.value }))} />
                <input className={inp} placeholder="Telefone" value={comprador.telefone} onChange={(e) => setComprador((c) => ({ ...c, telefone: e.target.value }))} />
              </div>
              <p className="mt-2 text-xs text-ink-muted">Os ingressos com QR serão enviados para o seu e-mail.</p>
            </div>

            {/* Cupom */}
            <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
              <h2 className="text-base font-bold text-ink">Cupom de desconto</h2>
              <div className="mt-2 flex gap-2">
                <input className={inp} placeholder="Código do cupom" value={cupomInput} onChange={(e) => setCupomInput(e.target.value.toUpperCase())} />
                <button onClick={aplicarCupom} className="shrink-0 rounded-xl border border-black/10 px-4 py-2.5 text-sm font-semibold hover:bg-black/[0.03]">Aplicar</button>
              </div>
              {cupomMsg && <p className={`mt-2 text-xs font-medium ${cupom ? 'text-emerald-600' : 'text-red-600'}`}>{cupomMsg}</p>}
            </div>
          </>
        )}
      </main>

      {/* Barra fixa de total + checkout */}
      {data.aVenda && cotacao && totalIngressos > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-black/[0.06] bg-white/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto max-w-2xl">
            <div className="mb-2 space-y-0.5 text-sm">
              <Linha label={`Subtotal (${totalIngressos} ${totalIngressos === 1 ? 'ingresso' : 'ingressos'})`} valor={formatMoney(cotacao.subtotal)} />
              {cotacao.desconto > 0 && <Linha label="Desconto" valor={`− ${formatMoney(cotacao.desconto)}`} tone="emerald" />}
              {cotacao.taxa > 0 && <Linha label="Taxa de serviço" valor={formatMoney(cotacao.taxa)} muted />}
            </div>
            {erro && <p className="mb-2 text-xs font-semibold text-red-600">{erro}</p>}
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-[0.7rem] uppercase tracking-wide text-ink-muted">Total</div>
                <div className="font-display text-2xl font-bold text-ink">{formatMoney(cotacao.total)}</div>
              </div>
              <button onClick={finalizar} disabled={enviando}
                className="rounded-xl bg-brand px-6 py-3.5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:opacity-50">
                {enviando ? 'Processando…' : cotacao.total > 0 ? 'Ir para o pagamento' : 'Finalizar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriaCard({ cat, item, onQtd, onMeia }: { cat: CatPub; item: CartItem | undefined; onQtd: (q: number) => void; onMeia: (m: boolean) => void }) {
  const qtd = item?.qtd || 0;
  const meia = item?.meia || false;
  const esgotado = !cat.aVenda && cat.motivo === 'esgotado';
  const indisponivel = !cat.aVenda;
  const precoBase = cat.preco_num;
  const precoMeia = Math.round(precoBase * (cat.meia_percent > 0 && cat.meia_percent <= 1 ? cat.meia_percent : 0.5) * 100) / 100;
  const precoMostrado = meia && cat.meia ? precoMeia : precoBase;

  return (
    <div className={`rounded-2xl bg-white p-4 shadow-card sm:p-5 ${indisponivel ? 'opacity-70' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-bold text-ink">{cat.nome}</h3>
            {cat.lote_nome && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[0.65rem] font-bold text-brand">{cat.lote_nome}</span>}
          </div>
          {cat.descricao && <p className="mt-1 text-sm text-ink-soft">{cat.descricao}</p>}
          <div className="mt-1.5 text-lg font-bold text-ink">{formatMoney(precoMostrado)}</div>
          {!indisponivel && cat.disponivel != null && cat.disponivel <= 10 && (
            <div className="mt-0.5 text-xs font-semibold text-amber-600">Últimas {cat.disponivel} unidades</div>
          )}
          {cat.meia && !indisponivel && (
            <label className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-ink-soft">
              <input type="checkbox" checked={meia} onChange={(e) => onMeia(e.target.checked)} className="rounded border-black/20 text-brand focus:ring-brand/30" />
              Meia-entrada
            </label>
          )}
        </div>
        <div className="shrink-0">
          {indisponivel ? (
            <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${esgotado ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'}`}>{esgotado ? 'Esgotado' : 'Indisponível'}</span>
          ) : (
            <Stepper qtd={qtd} onChange={onQtd} />
          )}
        </div>
      </div>
    </div>
  );
}

function Stepper({ qtd, onChange }: { qtd: number; onChange: (q: number) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button onClick={() => onChange(qtd - 1)} disabled={qtd === 0} aria-label="Diminuir"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-lg font-bold text-ink-soft disabled:opacity-30 enabled:hover:border-brand enabled:hover:text-brand">−</button>
      <span className="w-6 text-center text-base font-bold tabular-nums text-ink">{qtd}</span>
      <button onClick={() => onChange(qtd + 1)} aria-label="Aumentar"
        className="flex h-9 w-9 items-center justify-center rounded-lg border border-black/10 text-lg font-bold text-ink-soft hover:border-brand hover:text-brand">+</button>
    </div>
  );
}

function ExtraField({ campo, value, onChange }: { campo: CampoExtra; value: string; onChange: (v: string) => void }) {
  if (campo.tipo === 'opcoes') {
    return (
      <select className={inp} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{campo.label}{campo.obrigatorio ? ' *' : ''}</option>
        {(campo.opcoes || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  return <input className={inp} type={campo.tipo === 'numero' ? 'number' : 'text'} placeholder={`${campo.label}${campo.obrigatorio ? ' *' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} />;
}

function Linha({ label, valor, tone, muted }: { label: string; valor: string; tone?: 'emerald'; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-ink-muted' : 'text-ink-soft'}>{label}</span>
      <span className={`font-semibold ${tone === 'emerald' ? 'text-emerald-600' : muted ? 'text-ink-muted' : 'text-ink'}`}>{valor}</span>
    </div>
  );
}

// ════════════════════ CONFIRMAÇÃO / INGRESSOS ════════════════════
type PedidoPayload = {
  pedido: { id: string; status: string; canal: string; comprador_nome: string; subtotal_num: number; desconto_num: number; taxa_num: number; total_num: number; moeda: string; criado_em: string; pago_em: string | null };
  bilheteria: { titulo: string; local_texto: string | null };
  ingressos: { id: string; categoria: string; titular: string | null; valor_num: number; meia: boolean; status: string; qr: string | null }[];
};

function PedidoView({ pedidoId, token }: { pedidoId: string; token: string }) {
  const [estado, setEstado] = useState<'loading' | 'ready' | 'notfound'>('loading');
  const [data, setData] = useState<PedidoPayload | null>(null);

  const carregar = useCallback(async () => {
    try {
      const res = await fetch(`/api/bilheteria/pedido?id=${encodeURIComponent(pedidoId)}`, { cache: 'no-store' });
      if (!res.ok) { setEstado('notfound'); return; }
      const json = (await res.json()) as PedidoPayload;
      if (!json?.pedido) { setEstado('notfound'); return; }
      const moeda = (json.pedido.moeda as Currency) || 'BRL';
      setFormatPrefs({ currency: moeda, locale: LOCALE_BY_MOEDA[moeda] || 'pt-BR' });
      setData(json);
      setEstado('ready');
    } catch { setEstado('notfound'); }
  }, [pedidoId]);

  useEffect(() => { carregar(); }, [carregar]);

  // Pendente: faz polling (o webhook do MP pode levar alguns segundos).
  useEffect(() => {
    if (data?.pedido.status !== 'pendente') return;
    const t = setInterval(carregar, 5000);
    return () => clearInterval(t);
  }, [data?.pedido.status, carregar]);

  if (estado === 'loading') return <BrandSplash />;
  if (estado === 'notfound' || !data) return <NotFound titulo="Pedido não encontrado" texto="Verifique o link de confirmação." />;

  const p = data.pedido;
  const pago = p.status === 'pago';
  const pendente = p.status === 'pendente';
  const cancelado = p.status === 'cancelado' || p.status === 'expirado' || p.status === 'reembolsado';

  return (
    <div className="min-h-screen bg-[#f7f7f8] pb-16">
      <Header titulo={data.bilheteria.titulo} />
      <main className="mx-auto max-w-2xl px-4">
        {/* Banner de status */}
        <div className={`mt-5 rounded-2xl border px-5 py-4 ${pago ? 'border-emerald-200 bg-emerald-50' : pendente ? 'border-amber-200 bg-amber-50' : 'border-red-200 bg-red-50'}`}>
          <div className={`text-lg font-bold ${pago ? 'text-emerald-900' : pendente ? 'text-amber-900' : 'text-red-900'}`}>
            {pago ? 'Pagamento confirmado! 🎉' : pendente ? 'Aguardando confirmação do pagamento…' : 'Pedido não concluído'}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {pago ? 'Seus ingressos estão prontos. Apresente o QR na entrada (também enviamos por e-mail).'
              : pendente ? 'Assim que o pagamento for aprovado, seus ingressos aparecem aqui automaticamente.'
              : 'O pedido foi cancelado ou expirou. Você pode tentar comprar novamente.'}
          </p>
          {pendente && <div className="mt-3 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-amber-500" style={{ animation: `bounce-dot 1s ${i * 0.15}s infinite` }} />)}</div>}
        </div>

        {/* Resumo do pedido */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-card">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-muted">Pedido</span>
            <span className="font-mono text-xs text-ink-soft">{p.id.slice(0, 8).toUpperCase()}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-ink-soft">Total</span>
            <span className="font-display text-xl font-bold text-ink">{formatMoney(p.total_num)}</span>
          </div>
        </div>

        {/* Ingressos com QR (quando pagos) */}
        {pago && (
          <div className="mt-4 space-y-3">
            {data.ingressos.map((i) => (
              <div key={i.id} className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card">
                <div className="shrink-0 rounded-xl border border-black/[0.06] p-2">
                  {i.qr ? <QrCode value={i.qr} size={120} title={`Ingresso ${i.categoria}`} /> : <div className="flex h-[120px] w-[120px] items-center justify-center text-xs text-ink-muted">—</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-ink">{i.categoria}{i.meia ? ' · meia' : ''}</div>
                  {i.titular && <div className="mt-0.5 text-sm text-ink-soft">{i.titular}</div>}
                  <div className="mt-1 text-sm font-semibold text-ink">{formatMoney(i.valor_num)}</div>
                  <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${i.status === 'checkin' ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {i.status === 'checkin' ? 'Check-in realizado' : 'Válido'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {cancelado && (
          <a href={`/ingressos/${token}`} className="mt-4 block rounded-xl bg-brand px-4 py-3 text-center text-sm font-bold text-white hover:bg-brand-600">Comprar novamente</a>
        )}
      </main>
    </div>
  );
}

// ════════════════════ Compartilhados ════════════════════
function Header({ titulo }: { titulo: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/90 px-4 py-3 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between">
        <span className="font-display text-lg font-bold italic text-brand">VENTSY</span>
        <span className="truncate pl-3 text-sm font-semibold text-ink">{titulo}</span>
      </div>
    </header>
  );
}
function BrandSplash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f8]">
      <div className="font-display text-[2rem] italic text-brand">VENTSY</div>
      <div className="mt-4 flex gap-1.5">{[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-brand" style={{ animation: `bounce-dot 1s ${i * 0.15}s infinite` }} />)}</div>
    </div>
  );
}
function NotFound({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f7f7f8] px-6 text-center">
      <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-card">🎫</div>
      <h1 className="text-lg font-bold text-ink">{titulo}</h1>
      <p className="mt-1 max-w-sm text-sm text-ink-muted">{texto}</p>
    </div>
  );
}

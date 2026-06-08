'use client';

// Modal único de movimentação de estoque (entrada/saída/perda/ajuste/transferência).
// É a porta de entrada para a API AUTORITATIVA (/api/estoque), que recalcula
// saldo + custo médio. Reusado pela aba Saldo (movimentar rápido) e Movimentações.
//   • entrada  → quantidade + custo unitário (+ lote/validade se perecível)
//   • saída    → quantidade + evento (consumo) + motivo; bloqueia > saldo (force)
//   • perda    → quantidade + motivo; bloqueia > saldo (force)
//   • ajuste   → informa o SALDO CONTADO; envia o delta (contado − saldo atual)
//   • transfer.→ quantidade + local destino (move entre locais; saldo total igual)

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/format';
import { useToast } from '@/components/Toast';
import { num } from '@/lib/estoque';
import {
  type Produto, type EventoLite, type MovPayload, MOV_TIPOS, LOCAIS, localLabel, postMov, ymd, inp,
} from '../_lib';
import { ModalShell } from './ui';
import type { MovTipo } from '@/lib/estoque';

export default function MovModal({ produtos, eventos, preselectProdutoId, preselectTipo, onClose, onDone }: {
  produtos: Produto[];
  eventos: EventoLite[];
  preselectProdutoId?: string;
  preselectTipo?: MovTipo;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const toast = useToast();
  const ativos = useMemo(() => produtos.filter((p) => p.ativo).sort((a, b) => a.nome.localeCompare(b.nome)), [produtos]);

  const [produtoId, setProdutoId] = useState(preselectProdutoId || ativos[0]?.id || '');
  const [tipo, setTipo] = useState<MovTipo>(preselectTipo || 'entrada');
  const [qtd, setQtd] = useState('');
  const [custo, setCusto] = useState('');
  const [evento, setEvento] = useState('');
  const [motivo, setMotivo] = useState('');
  const [lote, setLote] = useState('');
  const [validade, setValidade] = useState('');
  const [destino, setDestino] = useState('');
  const [saving, setSaving] = useState(false);
  const [precisaForce, setPrecisaForce] = useState<{ saldo: number } | null>(null);

  const produto = useMemo(() => ativos.find((p) => p.id === produtoId) || null, [ativos, produtoId]);
  const saldoContadoDelta = produto ? round(num(qtd) - produto.estoque_atual) : 0;

  async function enviar(force = false) {
    if (!produto) { toast.error('Selecione um produto.'); return; }
    const q = num(qtd);
    if (tipo === 'ajuste') {
      if (qtd === '') { toast.error('Informe o saldo contado.'); return; }
      if (saldoContadoDelta === 0) { toast.error('O saldo contado é igual ao do sistema — nada a ajustar.'); return; }
    } else if (tipo !== 'transferencia' && q <= 0) {
      toast.error('Informe uma quantidade maior que zero.'); return;
    } else if (tipo === 'transferencia' && q <= 0) {
      toast.error('Informe a quantidade a transferir.'); return;
    }
    if (tipo === 'entrada' && num(custo) < 0) { toast.error('Custo unitário inválido.'); return; }
    if (tipo === 'transferencia' && !destino) { toast.error('Escolha o local de destino.'); return; }

    const payload: MovPayload = {
      produto_id: produto.id,
      tipo,
      quantidade: tipo === 'ajuste' ? saldoContadoDelta : q,
      motivo: motivo || undefined,
      force,
    };
    if (tipo === 'entrada') {
      payload.custo_unit_num = num(custo);
      if (lote) payload.lote = lote;
      if (validade) payload.validade = validade;
    }
    if (tipo === 'saida') payload.evento_id = evento || null;
    if (tipo === 'transferencia') { payload.local_origem = produto.local; payload.local_destino = destino; }

    setSaving(true);
    const r = await postMov(payload);
    setSaving(false);
    if (!r.ok) {
      if (r.error === 'saldo_insuficiente') { setPrecisaForce({ saldo: num(r.saldo) }); return; }
      toast.error(r.error === 'Não autenticado' ? 'Sessão expirada — entre novamente.' : 'Não foi possível registrar a movimentação.');
      return;
    }
    toast.success('Movimentação registrada!');
    await onDone();
    onClose();
  }

  const tipoMeta = MOV_TIPOS.find((m) => m.v === tipo)!;

  return (
    <ModalShell onClose={onClose} maxW="max-w-lg">
      <h3 className="mb-5 font-display text-xl font-bold text-ink">Nova movimentação</h3>

      {/* Tipo */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {MOV_TIPOS.map((m) => (
          <button key={m.v} onClick={() => { setTipo(m.v); setPrecisaForce(null); }}
            className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${tipo === m.v ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}>
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* Produto */}
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Produto</span>
          <select value={produtoId} onChange={(e) => { setProdutoId(e.target.value); setPrecisaForce(null); }} className={inp}>
            {ativos.length === 0 && <option value="">Nenhum produto cadastrado</option>}
            {ativos.map((p) => <option key={p.id} value={p.id}>{p.nome}{p.sku ? ` · ${p.sku}` : ''}</option>)}
          </select>
          {produto && (
            <span className="mt-1 block text-[0.72rem] text-ink-muted">
              Saldo atual: <b>{produto.estoque_atual} {produto.unidade}</b> · custo médio {formatMoney(produto.custo_medio_num)} · {localLabel(produto.local)}
            </span>
          )}
        </label>

        {/* Quantidade / saldo contado */}
        <div className="grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">
              {tipo === 'ajuste' ? 'Saldo contado' : 'Quantidade'} {produto && <span className="font-normal text-ink-muted">({produto.unidade})</span>}
            </span>
            <input type="number" min={0} step="0.01" value={qtd} onChange={(e) => { setQtd(e.target.value); setPrecisaForce(null); }} className={inp} placeholder="0" autoFocus />
            {tipo === 'ajuste' && produto && qtd !== '' && (
              <span className={`mt-1 block text-[0.72rem] font-semibold ${saldoContadoDelta === 0 ? 'text-ink-muted' : saldoContadoDelta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                Ajuste: {saldoContadoDelta > 0 ? '+' : ''}{saldoContadoDelta} {produto.unidade} (sistema: {produto.estoque_atual})
              </span>
            )}
          </label>

          {tipo === 'entrada' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Custo unitário</span>
              <input type="number" min={0} step="0.01" value={custo} onChange={(e) => setCusto(e.target.value)} className={inp} placeholder="0,00" />
              <span className="mt-1 block text-[0.72rem] text-ink-muted">Recalcula o custo médio móvel.</span>
            </label>
          )}
          {tipo === 'transferencia' && (
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Local de destino</span>
              <select value={destino} onChange={(e) => setDestino(e.target.value)} className={inp}>
                <option value="">Selecione…</option>
                {LOCAIS.filter((l) => l.v !== produto?.local).map((l) => <option key={l.v} value={l.v}>{l.label}</option>)}
              </select>
            </label>
          )}
        </div>

        {/* Entrada: lote + validade (se perecível) */}
        {tipo === 'entrada' && produto?.perecivel && (
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Lote <span className="font-normal text-ink-muted">(opcional)</span></span>
              <input value={lote} onChange={(e) => setLote(e.target.value)} className={inp} placeholder="Ex: L-2026-07" />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Validade</span>
              <input type="date" value={validade} onChange={(e) => setValidade(e.target.value)} className={inp} />
            </label>
          </div>
        )}

        {/* Saída: vínculo com evento (consumo) */}
        {tipo === 'saida' && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Consumo do evento <span className="font-normal text-ink-muted">(opcional)</span></span>
            <select value={evento} onChange={(e) => setEvento(e.target.value)} className={inp}>
              <option value="">Sem evento / uso interno</option>
              {eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nome_evento || 'Evento'}{ev.quem_contratou ? ` · ${ev.quem_contratou}` : ''}{ev.data_inicio ? ` · ${ev.data_inicio}` : ''}</option>)}
            </select>
            <span className="mt-1 block text-[0.72rem] text-ink-muted">Vincular alimenta o custo direto do evento na Contabilidade.</span>
          </label>
        )}

        {/* Motivo (todos menos entrada) */}
        {tipo !== 'entrada' && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Motivo <span className="font-normal text-ink-muted">(opcional)</span></span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inp}
              placeholder={tipo === 'perda' ? 'Ex: quebra, vencimento, avaria' : tipo === 'ajuste' ? 'Ex: contagem cíclica' : 'Observação'} />
          </label>
        )}

        {/* Aviso de saldo insuficiente → confirmar com force */}
        {precisaForce && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Saldo insuficiente — disponível: <b>{precisaForce.saldo} {produto?.unidade}</b>. Registrar mesmo assim deixará o saldo negativo.
            <button onClick={() => enviar(true)} disabled={saving} className="mt-2 block rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-60">Forçar mesmo assim</button>
          </div>
        )}

        <p className="rounded-lg bg-black/[0.03] px-3 py-2 text-[0.72rem] text-ink-muted">
          <b className="text-ink-soft">{tipoMeta.label}</b> — o saldo e o custo médio são recalculados automaticamente. O Kardex é permanente (correções por novo ajuste).
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={() => enviar(false)} disabled={saving || ativos.length === 0} className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-white hover:bg-brand-600 disabled:opacity-60">{saving ? 'Registrando…' : 'Registrar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

function round(n: number): number { return Math.round(n * 100) / 100; }

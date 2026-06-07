'use client';

// Simulador de preço — escolhe espaço + data + convidados + duração e mostra o
// preço calculado pela MESMA engine (lib/pricing.ts) que a Proposta usará.
// Breakdown transparente: base → ajustes (por prioridade) → taxas → total, com
// margem (vs custo) e comparação com a concorrência.

import { useMemo, useState } from 'react';
import { formatMoney, formatPercent, getFormatPrefs } from '@/lib/format';
import { calcularPreco, margem, type PrecoRegra, type PrecoTabela, type Taxa } from '@/lib/pricing';
import { BASE_BY, TIPOS_EVENTO, descreveAjuste, unidadeLabel, ymd, inp } from '../_lib';
import { Field, Icon } from './ui';

export function Simulador({
  tabelas, regras, taxas,
}: {
  tabelas: PrecoTabela[];
  regras: PrecoRegra[];
  taxas: Taxa[];
}) {
  const ativas = useMemo(() => tabelas.filter((t) => t.ativo), [tabelas]);
  const [tabelaId, setTabelaId] = useState(ativas[0]?.id ?? '');
  const hoje = ymd(new Date());
  const [data, setData] = useState(hoje);
  const [dataFim, setDataFim] = useState('');
  const [convidados, setConvidados] = useState('120');
  const [horas, setHoras] = useState('8');
  const [tipoEvento, setTipoEvento] = useState('');
  const [selTaxas, setSelTaxas] = useState<string[]>([]);

  const tabela = useMemo(() => tabelas.find((t) => t.id === tabelaId) ?? ativas[0], [tabelas, tabelaId, ativas]);

  const regrasDaTabela = useMemo(() => (tabela ? regras.filter((r) => r.tabela_id === tabela.id) : []), [regras, tabela]);
  const taxasAplicaveis = useMemo(
    () => (tabela ? taxas.filter((t) => t.ativo !== false && (t.propriedade_id == null || t.propriedade_id === tabela.propriedade_id)) : []),
    [taxas, tabela],
  );

  const breakdown = useMemo(() => {
    if (!tabela) return null;
    return calcularPreco({
      tabela,
      regras: regrasDaTabela,
      taxas: taxasAplicaveis,
      req: {
        data,
        dataFim: dataFim || undefined,
        convidados: Number(convidados) || 0,
        horas: Number(horas) || 0,
        tipoEvento: tipoEvento || undefined,
        hoje,
        taxasSelecionadas: selTaxas,
      },
    });
  }, [tabela, regrasDaTabela, taxasAplicaveis, data, dataFim, convidados, horas, tipoEvento, hoje, selTaxas]);

  if (!tabela) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-card">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand"><Icon name="sparkles" size={22} /></div>
        <p className="text-sm font-semibold text-ink">Crie uma tabela de preço para simular</p>
        <p className="mt-1 text-xs text-ink-muted">O simulador usa as tabelas ativas e suas regras.</p>
      </div>
    );
  }

  const moeda = tabela.moeda;
  const opcionais = taxasAplicaveis.filter((t) => !t.obrigatoria);
  const m = breakdown ? margem(breakdown.total, tabela.custo_num) : null;
  const concorr = tabela.concorrencia_num;
  const toggleTaxa = (id: string) => setSelTaxas((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_380px]">
      {/* Form */}
      <div className="rounded-2xl bg-white p-5 shadow-card">
        <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-ink"><Icon name="sparkles" size={16} /> Simular reserva</h3>
        <div className="space-y-4">
          <Field label="Espaço / tabela">
            <select value={tabelaId} onChange={(e) => { setTabelaId(e.target.value); setSelTaxas([]); }} className={inp}>
              {ativas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Data do evento">
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={inp} />
            </Field>
            <Field label={tabela.base === 'diaria' ? 'Data fim (opcional)' : 'Tipo de evento'}>
              {tabela.base === 'diaria' ? (
                <input type="date" value={dataFim} min={data} onChange={(e) => setDataFim(e.target.value)} className={inp} />
              ) : (
                <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} className={inp}>
                  <option value="">—</option>
                  {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              )}
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Convidados">
              <input type="number" min={0} value={convidados} onChange={(e) => setConvidados(e.target.value)} className={inp} />
            </Field>
            <Field label="Duração (horas)">
              <input type="number" min={0} value={horas} onChange={(e) => setHoras(e.target.value)} className={inp} />
            </Field>
          </div>
          {tabela.base === 'diaria' && (
            <Field label="Tipo de evento">
              <select value={tipoEvento} onChange={(e) => setTipoEvento(e.target.value)} className={inp}>
                <option value="">—</option>
                {TIPOS_EVENTO.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          )}

          {opcionais.length > 0 && (
            <div>
              <span className="mb-2 block text-sm font-semibold text-ink-soft">Adicionais opcionais</span>
              <div className="space-y-1.5">
                {opcionais.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-black/[0.02]">
                    <input type="checkbox" checked={selTaxas.includes(t.id)} onChange={() => toggleTaxa(t.id)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
                    <span className="flex-1 text-sm text-ink-soft">{t.nome}</span>
                    <span className="text-xs text-ink-muted">{taxaResumo(t, moeda)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Resultado */}
      <div className="rounded-2xl border border-brand/15 bg-gradient-to-b from-brand-50/40 to-white p-5 shadow-card">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-bold text-ink">Orçamento estimado</h3>
          <span className="rounded-full bg-white px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wide text-ink-muted ring-1 ring-black/[0.06]">mesma engine da proposta</span>
        </div>
        {breakdown && (
          <div className="space-y-2 text-sm">
            {/* Base */}
            <Row
              label={<>Base <span className="text-ink-muted">· {formatMoney(breakdown.unitario, { currency: moeda })} × {breakdown.quantidade} {unidadeLabel(breakdown.unidade)}{breakdown.quantidade > 1 ? 's' : ''}</span></>}
              value={formatMoney(breakdown.base, { currency: moeda })}
            />
            {/* Ajustes */}
            {breakdown.ajustes.map((a) => (
              <Row
                key={a.id}
                sub
                label={<>{a.nome} <span className="text-ink-muted">· {descreveAjuste(a.ajuste_tipo, a.ajuste_valor, moeda)}</span></>}
                value={<span className={a.delta >= 0 ? 'text-amber-600' : 'text-emerald-600'}>{a.delta >= 0 ? '+' : '−'}{formatMoney(Math.abs(a.delta), { currency: moeda })}</span>}
              />
            ))}
            {breakdown.ajustes.length > 0 && (
              <Row label={<span className="font-semibold">Subtotal</span>} value={<span className="font-semibold">{formatMoney(breakdown.subtotal, { currency: moeda })}</span>} divider />
            )}
            {/* Taxas */}
            {breakdown.taxas.map((t) => (
              <Row
                key={t.id}
                sub
                label={<>{t.nome} {t.obrigatoria ? <span className="ml-1 rounded bg-black/[0.05] px-1 py-0.5 text-[0.58rem] font-semibold uppercase text-ink-muted">obrig.</span> : ''}</>}
                value={<span className="text-ink-soft">+{formatMoney(t.total, { currency: moeda })}</span>}
              />
            ))}
            {/* Total */}
            <div className="mt-2 flex items-end justify-between rounded-xl bg-ink px-4 py-3 text-white">
              <span className="text-sm font-semibold text-white/80">Total estimado</span>
              <span className="font-display text-2xl font-bold">{formatMoney(breakdown.total, { currency: moeda })}</span>
            </div>

            {/* Margem + concorrência */}
            {(m != null || concorr != null) && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                {m != null && (
                  <div className="rounded-xl bg-white p-3 text-center ring-1 ring-black/[0.06]">
                    <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">Margem</div>
                    <div className={`mt-0.5 text-lg font-bold ${m >= 0.3 ? 'text-emerald-600' : m >= 0.1 ? 'text-amber-600' : 'text-red-500'}`}>{formatPercent(m, { maximumFractionDigits: 0 })}</div>
                    <div className="text-[0.6rem] text-ink-muted">custo {formatMoney(tabela.custo_num || 0, { currency: moeda })}</div>
                  </div>
                )}
                {concorr != null && (
                  <div className="rounded-xl bg-white p-3 text-center ring-1 ring-black/[0.06]">
                    <div className="text-[0.62rem] uppercase tracking-wide text-ink-muted">vs concorrência</div>
                    <div className={`mt-0.5 text-lg font-bold ${breakdown.total <= concorr ? 'text-emerald-600' : 'text-red-500'}`}>{breakdown.total <= concorr ? '−' : '+'}{formatMoney(Math.abs(breakdown.total - concorr), { currency: moeda })}</div>
                    <div className="text-[0.6rem] text-ink-muted">deles {formatMoney(concorr, { currency: moeda })}</div>
                  </div>
                )}
              </div>
            )}
            <p className="pt-1 text-center text-[0.68rem] text-ink-muted">{BASE_BY[tabela.base].hint}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, sub, divider }: { label: React.ReactNode; value: React.ReactNode; sub?: boolean; divider?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${divider ? 'border-t border-black/[0.06] pt-2' : ''} ${sub ? 'pl-2 text-[0.82rem]' : ''}`}>
      <span className="min-w-0 truncate text-ink-soft">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

function taxaResumo(t: Taxa, moeda: import('@/lib/format').Currency): string {
  if (t.tipo === 'percentual') return `${t.valor}%`;
  if (t.tipo === 'por_pessoa') return `${formatMoney(t.valor, { currency: moeda })}/conv.`;
  if (t.tipo === 'por_hora') return `${formatMoney(t.valor, { currency: moeda })}/h`;
  return formatMoney(t.valor, { currency: moeda });
}

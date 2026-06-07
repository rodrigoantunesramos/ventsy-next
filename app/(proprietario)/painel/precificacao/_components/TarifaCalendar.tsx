'use client';

// Calendário de tarifas — mapa de calor de 12 meses que colore cada dia pelo
// preço efetivo (base + regras de data), via precoDoDia() da engine. Deixa a
// sazonalidade/fim de semana visíveis de relance (alta = quente, baixa = frio).

import { useMemo, useState } from 'react';
import { formatMoney } from '@/lib/format';
import { precoDoDia, type PrecoRegra, type PrecoTabela } from '@/lib/pricing';
import { MESES_PT, DIAS_SEMANA, ymd, inp } from '../_lib';

// Escala fria→quente (baixa→alta temporada).
const ESCALA = ['#e0f2fe', '#bae6fd', '#fde68a', '#fdba74', '#f87171'];

export function TarifaCalendar({ tabelas, regras }: { tabelas: PrecoTabela[]; regras: PrecoRegra[] }) {
  const ativas = useMemo(() => tabelas.filter((t) => t.ativo), [tabelas]);
  const [tabelaId, setTabelaId] = useState(ativas[0]?.id ?? '');
  const tabela = tabelas.find((t) => t.id === tabelaId) ?? ativas[0];
  const hoje = useMemo(() => new Date(), []);

  const regrasDaTabela = useMemo(() => (tabela ? regras.filter((r) => r.tabela_id === tabela.id) : []), [regras, tabela]);

  // 12 meses a partir do mês atual; preço de cada dia.
  const { meses, min, max } = useMemo(() => {
    if (!tabela) return { meses: [], min: 0, max: 0 };
    const out: { y: number; m: number; dias: { dia: number; data: string; preco: number }[] }[] = [];
    let mn = Infinity, mx = -Infinity;
    for (let i = 0; i < 12; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() + i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const total = new Date(y, m + 1, 0).getDate();
      const dias = Array.from({ length: total }, (_, k) => {
        const data = ymd(new Date(y, m, k + 1));
        const preco = precoDoDia(tabela, regrasDaTabela, data);
        mn = Math.min(mn, preco); mx = Math.max(mx, preco);
        return { dia: k + 1, data, preco };
      });
      out.push({ y, m, dias });
    }
    return { meses: out, min: mn === Infinity ? 0 : mn, max: mx === -Infinity ? 0 : mx };
  }, [tabela, regrasDaTabela, hoje]);

  if (!tabela) return null;
  const uniforme = max - min < 0.01;
  const cor = (p: number) => {
    if (uniforme) return '#e2e8f0';
    const t = (p - min) / (max - min || 1);
    return ESCALA[Math.min(ESCALA.length - 1, Math.floor(t * ESCALA.length))];
  };
  const moeda = tabela.moeda;
  const hojeStr = ymd(hoje);

  return (
    <div className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-ink">Calendário de tarifas</h3>
          <p className="text-xs text-ink-muted">Preço por dia nos próximos 12 meses (base + regras de data).</p>
        </div>
        {ativas.length > 1 && (
          <select value={tabelaId} onChange={(e) => setTabelaId(e.target.value)} className={`${inp} w-auto`}>
            {ativas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </select>
        )}
      </div>

      {uniforme ? (
        <p className="rounded-lg bg-black/[0.02] px-3 py-2 text-xs text-ink-muted">Preço uniforme — adicione regras de temporada, dia da semana ou feriado para diferenciar as tarifas ao longo do ano.</p>
      ) : (
        <div className="mb-4 flex items-center gap-2 text-xs text-ink-muted">
          <span>Baixa {formatMoney(min, { currency: moeda, maximumFractionDigits: 0 })}</span>
          <div className="flex">{ESCALA.map((c) => <span key={c} className="h-3 w-5" style={{ background: c }} />)}</div>
          <span>Alta {formatMoney(max, { currency: moeda, maximumFractionDigits: 0 })}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {meses.map(({ y, m, dias }) => {
          const offset = new Date(y, m, 1).getDay();
          return (
            <div key={`${y}-${m}`}>
              <div className="mb-1.5 text-xs font-bold text-ink-soft">{MESES_PT[m]} <span className="font-normal text-ink-muted">{y}</span></div>
              <div className="grid grid-cols-7 gap-[3px]">
                {DIAS_SEMANA.map((d) => <div key={d.v} className="text-center text-[0.55rem] font-semibold text-ink-muted/60">{d.curto[0]}</div>)}
                {Array.from({ length: offset }, (_, i) => <div key={`o${i}`} />)}
                {dias.map((d) => (
                  <div
                    key={d.dia}
                    title={`${d.data.split('-').reverse().join('/')} · ${formatMoney(d.preco, { currency: moeda })}`}
                    className={`flex aspect-square items-center justify-center rounded-[4px] text-[0.55rem] font-medium ${d.data === hojeStr ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                    style={{ background: cor(d.preco), color: '#334155' }}
                  >{d.dia}</div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

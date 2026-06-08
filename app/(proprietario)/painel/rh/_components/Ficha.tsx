'use client';

// Ficha 360º do funcionário — drawer com abas: Dados, Folha (holerite estimado),
// Documentos (validade/ASO), Ausências (saldo de férias) e Histórico (timeline).
// Carrega rh_documentos/rh_ausencias/rh_eventos_funcionario do colaborador sob
// demanda. Reaproveita os motores lib/folha (holerite) e lib/rh (férias/validade).

import { useEffect, useMemo, useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoney, formatDate } from '@/lib/format';
import { calcularHolerite, DEFAULT_CHARGES, CONTRATO_MAP } from '@/lib/folha';
import {
  saldoFeriasDias, direitoFeriasDias, vencimentoFerias, feriasVencidas, statusValidade,
  tempoCasaLabel, type AusenciaLite,
} from '@/lib/rh';
import {
  mapDoc, mapAus, mapEvt, SEL_DOC, SEL_AUS, SEL_EVT, DOC_LABEL, AUS_BY, STATUS_AUS_BY, VAL_CLS, VAL_LABEL,
  inicial, avatarCor, type Funcionario, type Documento, type Ausencia, type EventoFunc,
} from '../_lib';
import { ModalShell, Chip, IcoEdit } from './ui';

type FichaTab = 'dados' | 'folha' | 'documentos' | 'ausencias' | 'historico';
const TABS: [FichaTab, string][] = [
  ['dados', 'Dados'], ['folha', 'Folha'], ['documentos', 'Documentos'], ['ausencias', 'Ausências'], ['historico', 'Histórico'],
];

export default function Ficha({ funcionario: f, hoje, userId, onClose, onEdit }: {
  funcionario: Funcionario; hoje: string; userId: string; onClose: () => void; onEdit: () => void;
}) {
  const [tab, setTab] = useState<FichaTab>('dados');
  const [docs, setDocs] = useState<Documento[]>([]);
  const [aus, setAus] = useState<Ausencia[]>([]);
  const [evts, setEvts] = useState<EventoFunc[]>([]);

  useEffect(() => {
    (async () => {
      const [d, a, e] = await Promise.all([
        sb.from('rh_documentos').select(SEL_DOC).eq('usuario_id', userId).eq('equipe_id', f.id).order('validade', { nullsFirst: false }),
        sb.from('rh_ausencias').select(SEL_AUS).eq('usuario_id', userId).eq('equipe_id', f.id).order('inicio', { ascending: false, nullsFirst: false }),
        sb.from('rh_eventos_funcionario').select(SEL_EVT).eq('usuario_id', userId).eq('equipe_id', f.id).order('data', { ascending: false }),
      ]);
      setDocs(d.error ? [] : (d.data || []).map(mapDoc));
      setAus(a.error ? [] : (a.data || []).map(mapAus));
      setEvts(e.error ? [] : (e.data || []).map(mapEvt));
    })();
  }, [f.id, userId]);

  const ausLite: AusenciaLite[] = useMemo(() => aus.map((a) => ({ tipo: a.tipo, inicio: a.inicio, fim: a.fim, dias: a.dias, status: a.status })), [aus]);
  const holerite = useMemo(() => calcularHolerite({ salario: f.salario, contrato: f.contrato, dependentes: f.dependentes }), [f]);
  const saldoFerias = useMemo(() => saldoFeriasDias(f.admissao, hoje, ausLite), [f.admissao, hoje, ausLite]);
  const venc = useMemo(() => vencimentoFerias(f.admissao, hoje, ausLite), [f.admissao, hoje, ausLite]);
  const vencida = useMemo(() => feriasVencidas(f.admissao, hoje, ausLite), [f.admissao, hoje, ausLite]);

  return (
    <ModalShell onClose={onClose} maxW="max-w-3xl">
      {/* Cabeçalho */}
      <div className="flex items-start gap-3 pr-10">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: avatarCor(f.id) }}>{inicial(f.nome)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-display text-xl font-bold text-ink">{f.nome}</h3>
            {f.desligado_em && <Chip cls="bg-black/[0.06] text-ink-soft">Desligado</Chip>}
          </div>
          <p className="truncate text-sm text-ink-muted">{f.cargo ?? '—'}{f.departamento ? ` · ${f.departamento}` : ''} · {CONTRATO_MAP[f.contrato] ?? f.contrato}</p>
          <p className="mt-0.5 text-xs text-ink-muted">Na empresa: {tempoCasaLabel(f.admissao, hoje)}{f.admissao ? ` · desde ${formatDate(f.admissao)}` : ''}</p>
        </div>
        <button onClick={onEdit} className="absolute right-14 top-6 flex h-9 items-center gap-1.5 rounded-xl border border-black/10 px-3 text-sm font-medium hover:bg-black/[0.03]"><IcoEdit /> Editar</button>
      </div>

      {/* Abas */}
      <div className="mt-5 flex gap-1 overflow-x-auto border-b border-black/[0.06] pb-px">
        {TABS.map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`shrink-0 rounded-t-xl px-3.5 py-2 text-sm font-semibold transition ${tab === id ? 'border-b-2 border-brand text-brand' : 'text-ink-muted hover:text-ink-soft'}`}>{label}</button>
        ))}
      </div>

      <div className="mt-4 max-h-[55vh] overflow-y-auto pr-1">
        {tab === 'dados' && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Dado t="CPF" v={f.cpf} /><Dado t="RG" v={f.rg} />
            <Dado t="Nascimento" v={f.nascimento ? formatDate(f.nascimento) : null} />
            <Dado t="E-mail" v={f.email} /><Dado t="Telefone" v={f.telefone} />
            <Dado t="Jornada" v={f.jornada} /><Dado t="Dependentes" v={String(f.dependentes)} />
            <Dado t="Banco" v={f.banco?.banco} /><Dado t="Agência" v={f.banco?.agencia} />
            <Dado t="Conta" v={f.banco?.conta ? `${f.banco.conta}${f.banco.tipo ? ` (${f.banco.tipo})` : ''}` : null} />
            <Dado t="PIX" v={f.banco?.pix} />
            {f.obs && <div className="col-span-full rounded-lg bg-black/[0.03] px-3 py-2 text-sm italic text-ink-muted">{f.obs}</div>}
          </div>
        )}

        {tab === 'folha' && (
          <div className="space-y-3">
            <table className="w-full text-sm">
              <tbody>
                {holerite.linhas.map((l, i) => (
                  <tr key={i} className="border-b border-black/[0.04]">
                    <td className="py-2 text-ink-soft">{l.label}</td>
                    <td className={`py-2 text-right font-medium ${l.tipo === 'desconto' ? 'text-red-600' : 'text-emerald-700'}`}>
                      {l.tipo === 'desconto' ? '− ' : ''}{formatMoney(l.valor)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-black/[0.08]">
                  <td className="pt-2 font-bold text-ink">Líquido estimado</td>
                  <td className="pt-2 text-right font-bold text-ink">{formatMoney(holerite.liquido)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <Mini t="FGTS do mês" v={formatMoney(holerite.fgts)} />
              <Mini t="Custo p/ empresa" v={formatMoney(holerite.custoEmpregador)} tone="gold" />
            </div>
            <p className="text-[0.7rem] text-ink-muted">Holerite estimado com encargos padrão — confirme com seu contador. A folha consolidada fica em <span className="font-semibold">Equipe</span>.</p>
          </div>
        )}

        {tab === 'documentos' && (
          docs.length === 0 ? <Vazio>Nenhum documento anexado. Use a aba <strong>Documentos</strong> do RH.</Vazio> : (
            <div className="space-y-2">
              {docs.map((d) => {
                const st = statusValidade(d.validade, hoje, d.dias_aviso);
                return (
                  <div key={d.id} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
                    <div>
                      <div className="font-medium text-ink-soft">{DOC_LABEL[d.tipo] ?? d.tipo}{d.nome ? ` · ${d.nome}` : ''}</div>
                      <div className="text-xs text-ink-muted">{d.validade ? `Validade ${formatDate(d.validade)}` : 'Sem validade'}</div>
                    </div>
                    <Chip cls={VAL_CLS[st]}>{VAL_LABEL[st]}</Chip>
                  </div>
                );
              })}
            </div>
          )
        )}

        {tab === 'ausencias' && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-sm">
              <Mini t="Direito (dias)" v={String(direitoFeriasDias(f.admissao, hoje))} />
              <Mini t="Saldo de férias" v={`${saldoFerias} dia(s)`} tone={saldoFerias > 0 ? 'verde' : 'cinza'} />
              <Mini t="Vencimento" v={venc ? formatDate(venc) : '—'} tone={vencida ? 'vermelho' : 'cinza'} />
            </div>
            {aus.length === 0 ? <Vazio>Nenhuma ausência registrada.</Vazio> : (
              <div className="space-y-2">
                {aus.map((a) => (
                  <div key={a.id} className="flex items-center justify-between rounded-xl border border-black/[0.06] px-3 py-2 text-sm">
                    <div>
                      <Chip cls={AUS_BY[a.tipo]?.cls ?? ''}>{AUS_BY[a.tipo]?.label ?? a.tipo}</Chip>
                      <span className="ml-2 text-xs text-ink-muted">{a.inicio ? formatDate(a.inicio) : '—'}{a.fim ? ` → ${formatDate(a.fim)}` : ''} · {a.dias} dia(s)</span>
                    </div>
                    <Chip cls={STATUS_AUS_BY[a.status]?.cls ?? ''}>{STATUS_AUS_BY[a.status]?.label ?? a.status}</Chip>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'historico' && (
          evts.length === 0 ? <Vazio>Sem eventos na timeline ainda.</Vazio> : (
            <ol className="relative ml-2 space-y-4 border-l border-black/[0.08] pl-5">
              {evts.map((ev) => (
                <li key={ev.id} className="relative">
                  <span className="absolute -left-[1.45rem] top-1 h-2.5 w-2.5 rounded-full bg-brand" />
                  <div className="text-sm font-semibold text-ink">{ev.titulo}</div>
                  <div className="text-xs text-ink-muted">{ev.data ? formatDate(ev.data) : ''}{ev.descricao ? ` · ${ev.descricao}` : ''}</div>
                </li>
              ))}
            </ol>
          )
        )}
      </div>
    </ModalShell>
  );
}

function Dado({ t, v }: { t: string; v: string | null | undefined }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{t}</div>
      <div className="text-sm font-medium text-ink-soft">{v || '—'}</div>
    </div>
  );
}
function Mini({ t, v, tone = 'cinza' }: { t: string; v: string; tone?: 'verde' | 'vermelho' | 'gold' | 'cinza' }) {
  const cls = { verde: 'text-emerald-600', vermelho: 'text-red-600', gold: 'text-amber-600', cinza: 'text-ink' }[tone];
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-2">
      <div className="text-xs text-ink-muted">{t}</div>
      <div className={`text-sm font-bold ${cls}`}>{v}</div>
    </div>
  );
}
function Vazio({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-black/[0.02] py-8 text-center text-sm text-ink-muted">{children}</div>;
}

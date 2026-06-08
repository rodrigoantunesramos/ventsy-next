'use client';

// Visão geral do RH — /painel/rh.
// Cockpit de pessoas: headcount, custo de folha do mês (motor lib/folha), por
// departamento/contrato, turnover e admissões/desligamentos do mês, e os
// ALERTAS acionáveis: férias vencidas (passivo), documentos/ASO vencendo,
// ausências a aprovar, vagas abertas. Dados: contexto (equipe) + cargas leves de
// rh_ausencias/rh_documentos/rh_vagas/rh_candidatos. Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { formatMoneyShort, formatPercent, formatDate } from '@/lib/format';
import { calcCusto, DEFAULT_CHARGES, CONTRATO_MAP } from '@/lib/folha';
import {
  contarPor, turnover as calcTurnover, admitidosNoPeriodo, desligadosNoPeriodo,
  aniversariantesDoMes, feriasVencidas, vencimentoFerias, statusValidade, diffDays,
  type AusenciaLite,
} from '@/lib/rh';
import {
  useRh, mapAus, mapDoc, SEL_AUS, SEL_DOC, type Ausencia, type Documento, DOC_LABEL, inicial, avatarCor,
} from './_lib';
import { Kpi, Card, EmptyState, IcoUsers, IcoAlert, IcoPalm, IcoFolder, IcoBriefcase, IcoCake, IcoChevron } from './_components/ui';

export default function RhVisaoGeral() {
  const { userId, hoje, equipe } = useRh();
  const [ausencias, setAusencias] = useState<Ausencia[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [counts, setCounts] = useState({ vagasAbertas: 0, candidatosFunil: 0 });

  useEffect(() => {
    (async () => {
      const [aRes, dRes, vRes, cRes] = await Promise.all([
        sb.from('rh_ausencias').select(SEL_AUS).eq('usuario_id', userId),
        sb.from('rh_documentos').select(SEL_DOC).eq('usuario_id', userId),
        sb.from('rh_vagas').select('id').eq('usuario_id', userId).eq('status', 'aberta'),
        sb.from('rh_candidatos').select('id,etapa').eq('usuario_id', userId).in('etapa', ['triagem', 'entrevista', 'teste', 'proposta']),
      ]);
      setAusencias(aRes.error ? [] : (aRes.data || []).map(mapAus));
      setDocumentos(dRes.error ? [] : (dRes.data || []).map(mapDoc));
      setCounts({ vagasAbertas: vRes.data?.length || 0, candidatosFunil: cRes.data?.length || 0 });
    })();
  }, [userId]);

  const mesIni = useMemo(() => `${hoje.slice(0, 7)}-01`, [hoje]);
  const mesFim = useMemo(() => {
    const [y, m] = hoje.split('-').map(Number);
    return `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;
  }, [hoje]);
  const mesNum = useMemo(() => Number(hoje.slice(5, 7)), [hoje]);

  // Mapa equipe_id → ausências (p/ cálculo de férias vencidas por pessoa).
  const ausByFunc = useMemo(() => {
    const m = new Map<number, AusenciaLite[]>();
    for (const a of ausencias) {
      const arr = m.get(a.equipe_id) ?? [];
      arr.push({ tipo: a.tipo, inicio: a.inicio, fim: a.fim, dias: a.dias, status: a.status });
      m.set(a.equipe_id, arr);
    }
    return m;
  }, [ausencias]);

  const ativos = useMemo(() => equipe.filter((e) => !e.desligado_em), [equipe]);

  const kpis = useMemo(() => {
    const folha = ativos.reduce((s, e) => s + calcCusto(e.salario, e.contrato, DEFAULT_CHARGES).total, 0);
    const admitidos = admitidosNoPeriodo(equipe, mesIni, mesFim).length;
    const desligados = desligadosNoPeriodo(equipe, mesIni, mesFim).length;
    const hcInicio = ativos.length + desligados - admitidos; // aproxima o headcount no começo do mês
    const to = calcTurnover(desligados, hcInicio, ativos.length);
    return { headcount: ativos.length, folha, admitidos, desligados, turnover: to };
  }, [ativos, equipe, mesIni, mesFim]);

  const porDepartamento = useMemo(() => contarPor(ativos, (e) => e.departamento), [ativos]);
  const porContrato = useMemo(() => contarPor(ativos, (e) => CONTRATO_MAP[e.contrato] ?? e.contrato), [ativos]);

  const feriasPassivo = useMemo(
    () => ativos
      .filter((e) => feriasVencidas(e.admissao, hoje, ausByFunc.get(e.id) ?? []))
      .map((e) => ({ e, venc: vencimentoFerias(e.admissao, hoje, ausByFunc.get(e.id) ?? []) })),
    [ativos, hoje, ausByFunc],
  );

  const docsVencendo = useMemo(
    () => documentos
      .map((d) => ({ d, st: statusValidade(d.validade, hoje, d.dias_aviso) }))
      .filter((x) => x.st === 'vencido' || x.st === 'critico' || x.st === 'atencao')
      .sort((a, b) => (a.d.validade || '').localeCompare(b.d.validade || '')),
    [documentos, hoje],
  );

  const ausPendentes = useMemo(() => ausencias.filter((a) => a.status === 'solicitada'), [ausencias]);
  const aniversariantes = useMemo(() => aniversariantesDoMes(equipe, mesNum), [equipe, mesNum]);
  const nomeFunc = (id: number) => equipe.find((e) => e.id === id)?.nome ?? '—';

  if (equipe.length === 0) {
    return (
      <EmptyState
        icon={<IcoUsers />}
        title="Seu RH começa pelo quadro de funcionários"
        action={<Link href="/painel/rh/funcionarios" className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">Cadastrar funcionários</Link>}
      >
        Cadastre seus colaboradores (CLT fixos e freelancers) para liberar folha, férias, documentos e indicadores. Você também pode abrir uma vaga em <Link href="/painel/rh/recrutamento" className="font-semibold text-brand underline">Recrutamento</Link>.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Headcount" value={String(kpis.headcount)} tone="azul" icon={<IcoUsers />} hint="colaboradores ativos" />
        <Kpi label="Custo de folha/mês" value={formatMoneyShort(kpis.folha)} tone="gold" hint="encargos padrão (estimado)" />
        <Kpi label="Admissões no mês" value={String(kpis.admitidos)} tone="verde" />
        <Kpi label="Desligamentos" value={String(kpis.desligados)} tone="vermelho" />
        <Kpi label="Turnover" value={formatPercent(kpis.turnover)} tone="roxo" hint="no mês" />
      </div>

      {/* Distribuições */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-3 font-bold text-ink">Por departamento</h3>
          <Barras dados={porDepartamento} total={kpis.headcount} cor="#1a73e8" />
        </Card>
        <Card>
          <h3 className="mb-3 font-bold text-ink">Por contrato</h3>
          <Barras dados={porContrato} total={kpis.headcount} cor="#8b5cf6" />
        </Card>
      </div>

      {/* Alertas acionáveis */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Alerta
          icon={<IcoPalm />} tone={feriasPassivo.length ? 'vermelho' : 'verde'}
          titulo="Férias vencidas (passivo)" valor={feriasPassivo.length}
          href="/painel/rh/ferias" vazio="Nenhum passivo de férias 🎉"
        >
          {feriasPassivo.slice(0, 4).map(({ e, venc }) => (
            <LinhaAlerta key={e.id} nome={e.nome} detalhe={venc ? `venceu em ${formatDate(venc)}` : 'férias vencidas'} />
          ))}
        </Alerta>

        <Alerta
          icon={<IcoFolder />} tone={docsVencendo.some((x) => x.st === 'vencido') ? 'vermelho' : docsVencendo.length ? 'gold' : 'verde'}
          titulo="Documentos / ASO vencendo" valor={docsVencendo.length}
          href="/painel/rh/documentos" vazio="Documentação em dia"
        >
          {docsVencendo.slice(0, 4).map(({ d }) => (
            <LinhaAlerta key={d.id} nome={nomeFunc(d.equipe_id)} detalhe={`${DOC_LABEL[d.tipo] ?? d.tipo} · ${d.validade ? formatDate(d.validade) : '—'}`} />
          ))}
        </Alerta>

        <Alerta
          icon={<IcoAlert />} tone={ausPendentes.length ? 'gold' : 'verde'}
          titulo="Ausências a aprovar" valor={ausPendentes.length}
          href="/painel/rh/ferias" vazio="Nada pendente"
        >
          {ausPendentes.slice(0, 4).map((a) => (
            <LinhaAlerta key={a.id} nome={nomeFunc(a.equipe_id)} detalhe={`${a.tipo} · ${a.dias} dia(s)`} />
          ))}
        </Alerta>

        <Alerta
          icon={<IcoBriefcase />} tone="azul"
          titulo="Recrutamento" valor={counts.vagasAbertas}
          href="/painel/rh/recrutamento" vazio="Nenhuma vaga aberta"
          rotuloValor="vaga(s) aberta(s)"
        >
          <LinhaAlerta nome={`${counts.candidatosFunil} candidato(s)`} detalhe="no funil de seleção" />
        </Alerta>
      </div>

      {/* Aniversariantes */}
      {aniversariantes.length > 0 && (
        <Card>
          <h3 className="mb-3 flex items-center gap-2 font-bold text-ink"><IcoCake /> Aniversariantes do mês</h3>
          <div className="flex flex-wrap gap-2">
            {aniversariantes.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-2 rounded-full border border-black/[0.06] bg-white py-1 pl-1 pr-3 text-sm shadow-card">
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: avatarCor(e.id) }}>{inicial(e.nome)}</span>
                {e.nome}{e.nascimento ? <span className="text-xs text-ink-muted">{formatDate(e.nascimento, { style: 'short' }).slice(0, 5)}</span> : null}
              </span>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────
function Barras({ dados, total, cor }: { dados: { chave: string; total: number }[]; total: number; cor: string }) {
  if (dados.length === 0) return <p className="py-4 text-center text-sm text-ink-muted">Sem dados ainda.</p>;
  const max = Math.max(...dados.map((d) => d.total), 1);
  return (
    <div className="space-y-2.5">
      {dados.map((d) => (
        <div key={d.chave}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-ink-soft">{d.chave}</span>
            <span className="text-ink-muted">{d.total}{total ? ` · ${Math.round((d.total / total) * 100)}%` : ''}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/[0.05]">
            <div className="h-full rounded-full" style={{ width: `${(d.total / max) * 100}%`, background: cor }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Alerta({ icon, tone, titulo, valor, href, vazio, rotuloValor, children }: {
  icon: React.ReactNode; tone: 'verde' | 'vermelho' | 'gold' | 'azul'; titulo: string; valor: number;
  href: string; vazio: string; rotuloValor?: string; children?: React.ReactNode;
}) {
  const toneCls = { verde: 'text-emerald-600 bg-emerald-50', vermelho: 'text-red-600 bg-red-50', gold: 'text-amber-600 bg-amber-50', azul: 'text-blue-600 bg-blue-50' }[tone];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${toneCls}`}>{icon}</span>
          <div>
            <div className="text-sm font-bold text-ink">{titulo}</div>
            <div className="text-xs text-ink-muted">{valor} {rotuloValor ?? 'item(ns)'}</div>
          </div>
        </div>
        <Link href={href} aria-label={`Ir para ${titulo}`} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-black/[0.04] hover:text-brand"><IcoChevron /></Link>
      </div>
      <div className="mt-3 space-y-1.5">
        {valor === 0 ? <p className="text-sm text-ink-muted">{vazio}</p> : children}
      </div>
    </Card>
  );
}

function LinhaAlerta({ nome, detalhe }: { nome: string; detalhe: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-black/[0.02] px-3 py-1.5 text-sm">
      <span className="truncate font-medium text-ink-soft">{nome}</span>
      <span className="shrink-0 pl-2 text-xs text-ink-muted">{detalhe}</span>
    </div>
  );
}

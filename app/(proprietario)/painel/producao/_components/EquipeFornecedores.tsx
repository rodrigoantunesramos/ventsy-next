'use client';

// Aba "Equipe & Fornecedores" — quem está no evento. A EQUIPE escalada é PUXADA
// do módulo Ponto/Escala (escalas + alocações do evento), agrupada por função e
// status. Os FORNECEDORES vêm do cadastro + das "ordens de serviço" = tarefas da
// checklist cuja responsabilidade é de fornecedor. Liga de volta à checklist e ao
// Ponto. Read-mostly (a alocação acontece em /painel/ponto). Sem "R$" hardcoded.

import { useMemo } from 'react';
import {
  type ProducaoBag, type Tarefa,
  responsavelLabel, categoriaCor, tarefaStatusMeta,
} from '../_lib';
import { Kpi, EmptyState, Chip, IcoUsers, IcoTruck, IcoCalendar, IcoPhone, IcoChevron, btnSecondary } from './ui';

// status de alocação (Ponto) → rótulo/cor, sem acoplar ao engine de Ponto.
const ALOC_META: Record<string, { label: string; chip: string }> = {
  convocado: { label: 'Convocado', chip: 'bg-amber-50 text-amber-700' },
  confirmado: { label: 'Confirmado', chip: 'bg-sky-50 text-sky-700' },
  presente: { label: 'Presente', chip: 'bg-emerald-50 text-emerald-700' },
  falta: { label: 'Falta', chip: 'bg-red-50 text-red-700' },
  cancelado: { label: 'Cancelado', chip: 'bg-gray-100 text-gray-500' },
};

export default function EquipeFornecedores({ bag, onIrChecklist }: { bag: ProducaoBag; onIrChecklist: () => void }) {
  const { escalas, alocacoes, equipe, freelancers, fornecedores, tarefas } = bag;

  const equipeById = useMemo(() => new Map(equipe.map((e) => [e.id, e])), [equipe]);
  const freelaById = useMemo(() => new Map(freelancers.map((f) => [f.id, f])), [freelancers]);
  const escalaById = useMemo(() => new Map(escalas.map((e) => [e.id, e])), [escalas]);

  // Pessoas escaladas (ativas) agrupadas por função da escala.
  const porFuncao = useMemo(() => {
    const m = new Map<string, { nome: string; tipo: 'fixo' | 'freelancer'; contato: string | null; status: string }[]>();
    for (const a of alocacoes) {
      if (a.status === 'cancelado') continue;
      const esc = escalaById.get(a.escala_id);
      const funcao = esc?.funcao || 'outro';
      let nome = 'Colaborador', tipo: 'fixo' | 'freelancer' = 'fixo', contato: string | null = null;
      if (a.freelancer_id) {
        const f = freelaById.get(a.freelancer_id);
        nome = f?.nome || 'Freelancer'; tipo = 'freelancer'; contato = f?.contato || null;
      } else if (a.equipe_id != null) {
        const e = equipeById.get(a.equipe_id);
        nome = e?.nome || 'Colaborador'; contato = null;
      }
      const arr = m.get(funcao) || [];
      arr.push({ nome, tipo, contato, status: a.status });
      m.set(funcao, arr);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [alocacoes, escalaById, equipeById, freelaById]);

  const totalPessoas = useMemo(() => alocacoes.filter((a) => a.status !== 'cancelado').length, [alocacoes]);

  // Ordens de serviço = tarefas com responsabilidade de fornecedor.
  const ordens = useMemo(() => tarefas.filter((t) => t.responsavel === 'fornecedor'), [tarefas]);
  // Fornecedores envolvidos: os citados nas ordens + nome livre.
  const fornecedoresEnvolvidos = useMemo(() => {
    const nomes = new Set<string>();
    for (const o of ordens) if (o.responsavel_nome) nomes.add(o.responsavel_nome.toLowerCase());
    const doCadastro = fornecedores.filter((f) => nomes.has((f.fantasia || f.nome).toLowerCase()) || nomes.has(f.nome.toLowerCase()));
    return { count: Math.max(nomes.size, doCadastro.length), lista: doCadastro };
  }, [ordens, fornecedores]);

  const semPonto = escalas.length === 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Pessoas escaladas" value={String(totalPessoas)} tone="brand" icon={<IcoUsers />} />
        <Kpi label="Funções" value={String(porFuncao.length)} tone="roxo" icon={<IcoUsers />} />
        <Kpi label="Fornecedores" value={String(fornecedoresEnvolvidos.count)} tone="azul" icon={<IcoTruck />} />
        <Kpi label="Ordens de serviço" value={String(ordens.length)} tone="gold" icon={<IcoTruck />} />
      </div>

      {/* Equipe escalada (do módulo Ponto) */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink"><IcoUsers /> Equipe escalada</h3>
          <a href="/painel/ponto?tab=escala" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Gerir no Ponto <IcoChevron /></a>
        </div>
        {semPonto ? (
          <EmptyState icon={<IcoCalendar />} title="Nenhuma escala para este evento"
            cta={<a href="/painel/ponto?tab=escala" className={btnSecondary}>Montar escala no Ponto</a>}>
            A alocação de equipe e freelancers é feita no módulo <strong>Ponto &amp; Escala</strong>. Crie a escala do evento lá e ela aparece aqui, pronta para o briefing e o run-of-show.
          </EmptyState>
        ) : porFuncao.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Há escalas para o evento, mas ninguém convocado ainda. Convoque equipe/freelancers no Ponto.</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {porFuncao.map(([funcao, pessoas]) => (
              <div key={funcao} className="rounded-xl border border-black/[0.06] p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: categoriaCor('logistica') }} />
                  <span className="text-sm font-bold capitalize text-ink-soft">{funcao}</span>
                  <span className="ml-auto rounded-full bg-black/[0.04] px-2 py-0.5 text-xs font-semibold text-ink-muted">{pessoas.length}</span>
                </div>
                <div className="space-y-1.5">
                  {pessoas.map((p, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[0.6rem] font-bold text-brand">{p.nome.slice(0, 2).toUpperCase()}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink">{p.nome}</span>
                      {p.tipo === 'freelancer' && <span className="text-[0.6rem] uppercase tracking-wide text-ink-muted">freela</span>}
                      <Chip className={ALOC_META[p.status]?.chip || 'bg-gray-100 text-gray-500'}>{ALOC_META[p.status]?.label || p.status}</Chip>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Fornecedores & ordens de serviço */}
      <section className="rounded-2xl bg-white p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink"><IcoTruck /> Fornecedores & ordens de serviço</h3>
          <button onClick={onIrChecklist} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">Ver na checklist <IcoChevron /></button>
        </div>
        {ordens.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Nenhuma tarefa atribuída a fornecedor ainda. Na <button onClick={onIrChecklist} className="font-semibold text-brand hover:underline">checklist</button>, defina o responsável como <em>Fornecedor</em> para gerar ordens de serviço aqui.
          </p>
        ) : (
          <div className="space-y-2.5">
            {ordens.map((o) => <OrdemLinha key={o.id} t={o} />)}
          </div>
        )}
        {fornecedoresEnvolvidos.lista.length > 0 && (
          <div className="mt-4 border-t border-black/[0.05] pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Contatos</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {fornecedoresEnvolvidos.lista.map((f) => (
                <div key={f.id} className="flex items-center gap-2 rounded-xl border border-black/[0.06] p-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><IcoTruck /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-ink">{f.fantasia || f.nome}</div>
                    {f.categoria && <div className="text-[0.7rem] text-ink-muted">{f.categoria}</div>}
                  </div>
                  {(f.whatsapp || f.email) && (
                    <span className="flex items-center gap-1 text-[0.7rem] text-ink-muted"><IcoPhone /> {f.whatsapp || f.email}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function OrdemLinha({ t }: { t: Tarefa }) {
  const meta = tarefaStatusMeta(t.status);
  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/[0.06] p-3">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: categoriaCor(t.categoria) }} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-ink">{t.titulo}</div>
        <div className="text-[0.7rem] text-ink-muted">{t.responsavel_nome || responsavelLabel(t.responsavel)}{t.prazo ? ` · prazo ${t.prazo}` : ''}</div>
      </div>
      <Chip className={meta.chip}>{meta.label}</Chip>
    </div>
  );
}

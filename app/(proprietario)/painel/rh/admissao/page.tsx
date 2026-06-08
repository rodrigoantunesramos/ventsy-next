'use client';

// Admissão / Onboarding — /painel/rh/admissao.
// Checklist de admissão (documentos, ASO, contrato, uniforme/EPI, treinamentos)
// que, ao concluir, CRIA o funcionário em `equipe` (via FuncionarioForm → dispara
// a folha) e registra a admissão na timeline com o checklist. Pode ser semeada
// por um candidato aprovado (?candidato=id) vindo do Recrutamento.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { formatDate } from '@/lib/format';
import { useRh, mapCand, SEL_CAND, SEL_EVT, mapEvt, type Candidato, type EventoFunc, type Funcionario } from '../_lib';
import { Card, Chip, btnPrimary, btnSecondary, IcoUserPlus, IcoCheck, IcoPlus, IcoDoc } from '../_components/ui';
import FuncionarioForm from '../_components/FuncionarioForm';

const CHECKLIST_PADRAO = [
  { k: 'docs', label: 'Documentos pessoais (RG, CPF, CTPS)' },
  { k: 'aso', label: 'Exame admissional (ASO)' },
  { k: 'contrato', label: 'Contrato de trabalho assinado' },
  { k: 'banco', label: 'Dados bancários / PIX' },
  { k: 'uniforme', label: 'Uniforme / EPI entregue' },
  { k: 'treinamentos', label: 'Treinamentos obrigatórios (NRs, brigada)' },
  { k: 'acessos', label: 'Acessos e sistemas' },
];

export default function AdmissaoPage() {
  const { userId, equipe, reloadEquipe } = useRh();
  const toast = useToast();
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [check, setCheck] = useState<Record<string, boolean>>({});
  const [extras, setExtras] = useState<{ label: string; ok: boolean }[]>([]);
  const [novoItem, setNovoItem] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [recentes, setRecentes] = useState<EventoFunc[]>([]);

  // Semente por candidato (vindo do Recrutamento) + admissões recentes.
  useEffect(() => {
    (async () => {
      const cid = new URLSearchParams(window.location.search).get('candidato');
      if (cid) {
        const { data } = await sb.from('rh_candidatos').select(SEL_CAND).eq('id', cid).eq('usuario_id', userId).maybeSingle();
        if (data) setCandidato(mapCand(data));
      }
      const { data: evs } = await sb.from('rh_eventos_funcionario').select(SEL_EVT).eq('usuario_id', userId).eq('tipo', 'admissao').order('data', { ascending: false }).limit(8);
      setRecentes((evs || []).map(mapEvt));
    })();
  }, [userId]);

  const itens = useMemo(() => [
    ...CHECKLIST_PADRAO.map((c) => ({ label: c.label, ok: !!check[c.k], onToggle: () => setCheck((s) => ({ ...s, [c.k]: !s[c.k] })) })),
    ...extras.map((e, i) => ({ label: e.label, ok: e.ok, onToggle: () => setExtras((arr) => arr.map((x, j) => (j === i ? { ...x, ok: !x.ok } : x))) })),
  ], [check, extras]);
  const feitos = itens.filter((i) => i.ok).length;
  const pct = itens.length ? Math.round((feitos / itens.length) * 100) : 0;

  const initialFunc: Partial<Funcionario> | undefined = candidato
    ? { nome: candidato.nome, email: candidato.email, telefone: candidato.telefone, status: 'ativo', admissao: new Date().toISOString().slice(0, 10) }
    : { status: 'ativo', admissao: new Date().toISOString().slice(0, 10) };

  async function aoCriar(novoId: number) {
    setFormOpen(false);
    // Snapshot do checklist na timeline da admissão (substitui o evento básico do form).
    const checklist = itens.map((i) => ({ item: i.label, ok: i.ok }));
    await sb.from('rh_eventos_funcionario').insert({
      usuario_id: userId, equipe_id: novoId, tipo: 'admissao', titulo: 'Onboarding concluído',
      descricao: `${feitos}/${itens.length} itens do checklist`, data: new Date().toISOString().slice(0, 10),
      dados: { checklist, candidato_id: candidato?.id ?? null },
    });
    if (candidato) await sb.from('rh_candidatos').update({ etapa: 'contratado' }).eq('id', candidato.id).eq('usuario_id', userId);
    await reloadEquipe();
    toast.success('Admissão concluída — funcionário criado e folha ativada.');
    setCandidato(null);
    setCheck({}); setExtras([]);
    const { data: evs } = await sb.from('rh_eventos_funcionario').select(SEL_EVT).eq('usuario_id', userId).eq('tipo', 'admissao').order('data', { ascending: false }).limit(8);
    setRecentes((evs || []).map(mapEvt));
  }

  const nomeFunc = (id: number) => equipe.find((e) => e.id === id)?.nome ?? '—';

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Coluna principal: checklist */}
        <div className="space-y-4 lg:col-span-2">
          {candidato && (
            <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <span className="text-emerald-900">Admitindo <strong>{candidato.nome}</strong>{candidato.email ? ` · ${candidato.email}` : ''} (do Recrutamento).</span>
              <button onClick={() => setCandidato(null)} className="text-emerald-700 hover:underline">limpar</button>
            </div>
          )}

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-bold text-ink"><IcoCheck /> Checklist de admissão</h3>
              <span className="text-sm font-semibold text-ink-soft">{feitos}/{itens.length} · {pct}%</span>
            </div>
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-black/[0.06]"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} /></div>

            <div className="space-y-2">
              {itens.map((i, idx) => (
                <button key={idx} onClick={i.onToggle} className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${i.ok ? 'border-emerald-200 bg-emerald-50' : 'border-black/[0.06] hover:bg-black/[0.02]'}`}>
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${i.ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-black/20'}`}>{i.ok && <IcoCheck />}</span>
                  <span className={i.ok ? 'text-ink-soft line-through' : 'text-ink-soft'}>{i.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              <input value={novoItem} onChange={(e) => setNovoItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && novoItem.trim()) { setExtras((a) => [...a, { label: novoItem.trim(), ok: false }]); setNovoItem(''); } }}
                placeholder="Adicionar item ao checklist…" className="flex-1 rounded-xl border border-black/10 px-3 py-2 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
              <button onClick={() => { if (novoItem.trim()) { setExtras((a) => [...a, { label: novoItem.trim(), ok: false }]); setNovoItem(''); } }} className={btnSecondary}><IcoPlus /></button>
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <button onClick={() => setFormOpen(true)} className={btnPrimary}><IcoUserPlus /> Concluir admissão e criar funcionário</button>
            <Link href="/painel/contratos" className={btnSecondary}><IcoDoc /> Gerar contrato</Link>
          </div>
        </div>

        {/* Coluna lateral: explicação + admissões recentes */}
        <div className="space-y-4">
          <Card>
            <h3 className="mb-2 font-bold text-ink">Como funciona</h3>
            <ol className="ml-4 list-decimal space-y-1.5 text-sm text-ink-muted">
              <li>Marque os itens do onboarding conforme conclui.</li>
              <li>Clique em <strong>Concluir admissão</strong> e preencha a ficha.</li>
              <li>O funcionário entra em <Link href="/painel/rh/funcionarios" className="text-brand underline">Funcionários</Link> e a folha é ativada.</li>
              <li>Anexe ASO e certificações em <Link href="/painel/rh/documentos" className="text-brand underline">Documentos</Link>.</li>
            </ol>
          </Card>

          <Card>
            <h3 className="mb-3 font-bold text-ink">Admissões recentes</h3>
            {recentes.length === 0 ? <p className="text-sm text-ink-muted">Nenhuma admissão registrada ainda.</p> : (
              <div className="space-y-2">
                {recentes.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between rounded-xl bg-black/[0.02] px-3 py-2 text-sm">
                    <Link href={`/painel/rh/funcionarios?id=${ev.equipe_id}`} className="truncate font-medium text-ink-soft hover:text-brand">{nomeFunc(ev.equipe_id)}</Link>
                    <Chip cls="bg-emerald-50 text-emerald-700">{ev.data ? formatDate(ev.data, { style: 'short' }) : '—'}</Chip>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {formOpen && (
        <FuncionarioForm
          userId={userId}
          initial={initialFunc}
          gestores={equipe}
          tituloCriar="Concluir admissão"
          onClose={() => setFormOpen(false)}
          onSaved={aoCriar}
        />
      )}
    </div>
  );
}

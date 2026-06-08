'use client';

// Aba "Briefing" — o dossiê do evento que a equipe precisa ter em mãos:
// convidados, horários (montagem→desmontagem), local, contatos-chave e de
// emergência, cardápio, layout, restrições e do's & don'ts. Pré-preenchível a
// partir do que o evento já tem em clientes_eventos (briefingSeedDeEvento). Salva
// o jsonb `producao.briefing` via RLS. Sem "R$" hardcoded.

import { useState } from 'react';
import { useToast } from '@/components/Toast';
import {
  type ProducaoBag, type Briefing as TBriefing, type ContatoChave,
  mesclarBriefing, briefingSeedDeEvento, salvarProducao, inp, selCls, PRODUCAO_STATUS_META,
} from '../_lib';
import { Campo, IcoPlus, IcoTrash, IcoSparkle, IcoPhone, btnPrimary, btnSecondary } from './ui';

const STATUS_OPCOES = ['planejamento', 'pronto', 'em_execucao', 'encerrado'] as const;

export default function Briefing({ bag }: { bag: ProducaoBag }) {
  const toast = useToast();
  const { producao, evento } = bag;
  const [b, setB] = useState<TBriefing>(() => mesclarBriefing(producao.briefing));
  const [obs, setObs] = useState(producao.observacoes || '');
  const [status, setStatus] = useState(producao.status);
  const [salvando, setSalvando] = useState(false);

  const set = <K extends keyof TBriefing>(k: K, v: TBriefing[K]) => setB((p) => ({ ...p, [k]: v }));
  const setHora = (k: keyof TBriefing['horarios'], v: string) => setB((p) => ({ ...p, horarios: { ...p.horarios, [k]: v } }));

  const addContato = () => set('contatosChave', [...b.contatosChave, { nome: '', papel: '', telefone: '' }]);
  const setContato = (i: number, k: keyof ContatoChave, v: string) =>
    set('contatosChave', b.contatosChave.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)));
  const delContato = (i: number) => set('contatosChave', b.contatosChave.filter((_, idx) => idx !== i));

  const puxarDoEvento = () => {
    setB((cur) => briefingSeedDeEvento(
      {
        qtd_adultos: evento.qtd_adultos, qtd_criancas: evento.qtd_criancas,
        horario_inicio: evento.horario_inicio,
      },
      cur,
    ));
    toast.info('Campos vazios preenchidos com os dados do evento.');
  };

  const salvar = async () => {
    setSalvando(true);
    const { error } = await salvarProducao(producao.id, { briefing: b, observacoes: obs.trim() || null, status });
    setSalvando(false);
    if (error) { toast.error('Não foi possível salvar o briefing.'); return; }
    toast.success('Briefing salvo.');
    await bag.recarregar();
  };

  return (
    <div className="space-y-5">
      {/* Barra de ação: estágio + preencher + salvar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-card">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-soft">Estágio:</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={selCls}>
            {STATUS_OPCOES.map((s) => <option key={s} value={s}>{PRODUCAO_STATUS_META[s].label}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={puxarDoEvento} className={btnSecondary}><IcoSparkle /> Preencher do evento</button>
          <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : 'Salvar briefing'}</button>
        </div>
      </div>

      {/* Visão geral */}
      <Secao titulo="Visão geral">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Convidados (total)">
            <input type="number" min={0} value={b.convidados ?? ''} onChange={(e) => set('convidados', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))} className={inp} placeholder="Ex.: 180" />
          </Campo>
          <Campo label="Local / espaço">
            <input value={b.local} onChange={(e) => set('local', e.target.value)} className={inp} placeholder="Salão, endereço, ponto de referência" />
          </Campo>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Campo label="Montagem"><input type="time" value={b.horarios.montagem} onChange={(e) => setHora('montagem', e.target.value)} className={inp} /></Campo>
          <Campo label="Início"><input type="time" value={b.horarios.inicio} onChange={(e) => setHora('inicio', e.target.value)} className={inp} /></Campo>
          <Campo label="Fim"><input type="time" value={b.horarios.fim} onChange={(e) => setHora('fim', e.target.value)} className={inp} /></Campo>
          <Campo label="Desmontagem"><input type="time" value={b.horarios.desmontagem} onChange={(e) => setHora('desmontagem', e.target.value)} className={inp} /></Campo>
        </div>
      </Secao>

      {/* Contatos-chave */}
      <Secao titulo="Contatos-chave" acao={<button onClick={addContato} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"><IcoPlus /> Adicionar</button>}>
        {b.contatosChave.length === 0 ? (
          <p className="py-4 text-center text-sm text-ink-muted">Sem contatos. Adicione cerimonialista, responsável do espaço, fornecedores-chave…</p>
        ) : (
          <div className="space-y-2.5">
            {b.contatosChave.map((c, i) => (
              <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input value={c.nome} onChange={(e) => setContato(i, 'nome', e.target.value)} className={inp} placeholder="Nome" />
                <input value={c.papel} onChange={(e) => setContato(i, 'papel', e.target.value)} className={inp} placeholder="Papel (ex.: Cerimonial)" />
                <input value={c.telefone} onChange={(e) => setContato(i, 'telefone', e.target.value)} className={inp} placeholder="Telefone / WhatsApp" />
                <button onClick={() => delContato(i)} aria-label="Remover contato" className="flex items-center justify-center rounded-xl border border-black/10 px-3 text-ink-muted hover:bg-red-50 hover:text-red-600"><IcoTrash /></button>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4">
          <Campo label="Contatos de emergência" hint="Bombeiros, ambulância, segurança, responsável no local.">
            <textarea value={b.contatosEmergencia} onChange={(e) => set('contatosEmergencia', e.target.value)} rows={2} className={inp} placeholder="Ex.: SAMU 192 · Brigada (11) 9… · Síndico (11) 9…" />
          </Campo>
        </div>
      </Secao>

      {/* Operação */}
      <Secao titulo="Operação">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Cardápio / A&B"><textarea value={b.cardapio} onChange={(e) => set('cardapio', e.target.value)} rows={3} className={inp} placeholder="Entradas, prato principal, bar, horário de serviço…" /></Campo>
          <Campo label="Layout / planta"><textarea value={b.layout} onChange={(e) => set('layout', e.target.value)} rows={3} className={inp} placeholder="Disposição de mesas, palco, pista, banheiros, acessos…" /></Campo>
          <Campo label="Restrições alimentares"><textarea value={b.restricoes} onChange={(e) => set('restricoes', e.target.value)} rows={2} className={inp} placeholder="Veganos, alérgicos, infantil, kosher…" /></Campo>
          <Campo label="Observações gerais"><textarea value={b.observacoes} onChange={(e) => set('observacoes', e.target.value)} rows={2} className={inp} placeholder="Necessidades técnicas, acessibilidade, regras do espaço…" /></Campo>
        </div>
      </Secao>

      {/* Do's & Don'ts */}
      <Secao titulo="Do's & Don'ts">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="✓ Fazer (do's)"><textarea value={b.dos} onChange={(e) => set('dos', e.target.value)} rows={3} className={`${inp} border-emerald-200 focus:border-emerald-400 focus:ring-emerald-100`} placeholder="Recepcionar com…, sinalizar saídas, reservar área VIP…" /></Campo>
          <Campo label="✕ Evitar (don'ts)"><textarea value={b.donts} onChange={(e) => set('donts', e.target.value)} rows={3} className={`${inp} border-red-200 focus:border-red-400 focus:ring-red-100`} placeholder="Não liberar acesso sem credencial, não tocar antes de…" /></Campo>
        </div>
      </Secao>

      {/* Notas internas */}
      <Secao titulo="Notas internas da produção">
        <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} className={inp} placeholder="Anotações livres da equipe de produção." />
      </Secao>

      <div className="flex justify-end gap-2 pb-2">
        <button onClick={salvar} disabled={salvando} className={btnPrimary}>{salvando ? 'Salvando…' : 'Salvar briefing'}</button>
      </div>

      <div className="flex items-start gap-2 rounded-xl bg-brand-50/50 p-3 text-xs text-ink-muted">
        <span className="mt-0.5 text-brand"><IcoPhone /></span>
        <span>Dica: o cliente pode preencher parte do briefing pelo Portal do cliente; aqui você consolida e distribui para a equipe junto com o run-of-show.</span>
      </div>
    </div>
  );
}

function Secao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h3 className="text-base font-bold text-ink">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  );
}

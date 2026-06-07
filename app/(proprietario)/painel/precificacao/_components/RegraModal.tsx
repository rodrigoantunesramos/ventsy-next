'use client';

// Modal de REGRA dinâmica de preço. O editor de condição se adapta ao tipo
// (temporada, dia da semana, feriado, tipo de evento, antecedência, duração,
// nº de convidados). Persiste em precos_regras (com usuario_id p/ RLS).

import { useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import type { AjusteTipo, Condicao, PrecoRegra, PrecoTabela, RegraTipo } from '@/lib/pricing';
import {
  REGRA_TIPOS, REGRA_TIPO_BY, AJUSTES, DIAS_SEMANA, TIPOS_EVENTO,
  condicaoPadrao, inp,
} from '../_lib';
import { ModalShell, Field, MoneyInput, PrimaryBtn, GhostBtn, Icon } from './ui';

const yr = (mmdd?: string) => (mmdd ? `2000-${mmdd}` : ''); // ancora p/ <input type=date>
const toMMDD = (full: string) => (full && full.length >= 10 ? full.slice(5) : '');

export function RegraModal({
  userId, editando, tabelas, defaultTabelaId, onClose, onSaved,
}: {
  userId: string;
  editando: PrecoRegra | null;
  tabelas: PrecoTabela[];
  defaultTabelaId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [tabelaId, setTabelaId] = useState(editando?.tabela_id ?? defaultTabelaId ?? tabelas[0]?.id ?? '');
  const [nome, setNome] = useState(editando?.nome ?? '');
  const [tipo, setTipo] = useState<RegraTipo>(editando?.tipo ?? 'dia_semana');
  const [cond, setCond] = useState<Condicao>(editando?.condicao ?? condicaoPadrao(editando?.tipo ?? 'dia_semana'));
  const [ajusteTipo, setAjusteTipo] = useState<AjusteTipo>(editando?.ajuste_tipo ?? 'percentual');
  const [ajusteValor, setAjusteValor] = useState(editando ? String(editando.ajuste_valor) : '30');
  const [prioridade, setPrioridade] = useState(editando ? String(editando.prioridade) : '0');
  const [ativo, setAtivo] = useState(editando?.ativo ?? true);
  const [saving, setSaving] = useState(false);

  const tabela = tabelas.find((t) => t.id === tabelaId);
  const moeda = tabela?.moeda ?? 'BRL';

  function trocarTipo(t: RegraTipo) { setTipo(t); setCond(condicaoPadrao(t)); }
  const patch = (p: Partial<Condicao>) => setCond((c) => ({ ...c, ...p }));

  async function salvar() {
    if (!tabelaId) { toast.error('Selecione a tabela.'); return; }
    setSaving(true);
    const payload = {
      usuario_id: userId,
      tabela_id: tabelaId,
      nome: nome.trim() || null,
      tipo,
      condicao: cond,
      ajuste_tipo: ajusteTipo,
      ajuste_valor: Number(ajusteValor) || 0,
      prioridade: parseInt(prioridade, 10) || 0,
      ativo,
    };
    const { error } = editando
      ? await sb.from('precos_regras').update(payload).eq('id', editando.id)
      : await sb.from('precos_regras').insert(payload);
    setSaving(false);
    if (error) { toast.error('Não foi possível salvar a regra.'); return; }
    toast.success(editando ? 'Regra atualizada!' : 'Regra criada!');
    onSaved();
  }

  return (
    <ModalShell
      title={editando ? 'Editar regra' : 'Nova regra dinâmica'}
      subtitle="Ajusta o preço conforme o contexto da reserva."
      icon={<Icon name="percent" size={18} />}
      onClose={onClose}
      wide
      footer={<>
        <PrimaryBtn onClick={salvar} disabled={saving || !tabelaId}>{saving ? 'Salvando…' : editando ? 'Salvar alterações' : 'Criar regra'}</PrimaryBtn>
        <GhostBtn onClick={onClose}>Cancelar</GhostBtn>
      </>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Tabela">
            <select value={tabelaId} onChange={(e) => setTabelaId(e.target.value)} className={inp}>
              {tabelas.length === 0 && <option value="">Crie uma tabela primeiro</option>}
              {tabelas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
          </Field>
          <Field label="Nome (opcional)">
            <input value={nome} onChange={(e) => setNome(e.target.value)} className={inp} placeholder="Ex.: Acréscimo de fim de semana" />
          </Field>
        </div>

        {/* Tipo de regra */}
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Quando aplicar</span>
          <div className="flex flex-wrap gap-1.5">
            {REGRA_TIPOS.map((r) => (
              <button
                key={r.v} type="button" onClick={() => trocarTipo(r.v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tipo === r.v ? 'bg-ink text-white' : 'bg-black/[0.04] text-ink-muted hover:bg-black/[0.07]'}`}
              >{r.icon} {r.label}</button>
            ))}
          </div>
          <p className="mt-2 rounded-lg bg-black/[0.02] px-3 py-2 text-xs text-ink-muted">{REGRA_TIPO_BY[tipo].hint}</p>
        </div>

        {/* Editor de condição (varia por tipo) */}
        <div className="rounded-xl border border-black/[0.06] bg-black/[0.015] p-4">
          <CondicaoEditor tipo={tipo} cond={cond} patch={patch} />
        </div>

        {/* Ajuste */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Tipo de ajuste">
            <select value={ajusteTipo} onChange={(e) => setAjusteTipo(e.target.value as AjusteTipo)} className={inp}>
              {AJUSTES.map((a) => <option key={a.v} value={a.v}>{a.label}</option>)}
            </select>
          </Field>
          <Field label={ajusteTipo === 'percentual' ? 'Percentual' : ajusteTipo === 'substitui' ? 'Novo preço' : 'Valor'}>
            {ajusteTipo === 'percentual' ? (
              <div className="relative">
                <input type="number" step="1" value={ajusteValor} onChange={(e) => setAjusteValor(e.target.value)} className={`${inp} pr-8`} placeholder="30" />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-ink-muted">%</span>
              </div>
            ) : (
              <MoneyInput value={ajusteValor} onChange={setAjusteValor} moeda={moeda} />
            )}
          </Field>
          <Field label="Prioridade" hint="Maior vence">
            <input type="number" step="1" value={prioridade} onChange={(e) => setPrioridade(e.target.value)} className={`${inp} w-24`} />
          </Field>
        </div>
        {ajusteTipo === 'percentual' && (
          <p className="-mt-2 text-xs text-ink-muted">Use valores negativos para desconto (ex.: <code className="rounded bg-black/[0.04] px-1">-10</code> para −10%).</p>
        )}

        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} className="h-4 w-4 rounded border-black/20 text-brand focus:ring-brand/30" />
          <span className="text-sm font-medium text-ink-soft">Regra ativa</span>
        </label>
      </div>
    </ModalShell>
  );
}

// ── Editor de condição por tipo ──────────────────────────────────────────────
function CondicaoEditor({ tipo, cond, patch }: { tipo: RegraTipo; cond: Condicao; patch: (p: Partial<Condicao>) => void }) {
  if (tipo === 'temporada') {
    return (
      <div className="grid grid-cols-2 gap-4">
        <Field label="De" hint="Dia/mês (repete todo ano)">
          <input type="date" value={yr(cond.de)} onChange={(e) => patch({ de: toMMDD(e.target.value) })} className={inp} />
        </Field>
        <Field label="Até" hint="Pode virar o ano (dez → fev)">
          <input type="date" value={yr(cond.ate)} onChange={(e) => patch({ ate: toMMDD(e.target.value) })} className={inp} />
        </Field>
      </div>
    );
  }
  if (tipo === 'dia_semana') {
    const dias = cond.dias || [];
    const toggle = (d: number) => patch({ dias: dias.includes(d) ? dias.filter((x) => x !== d) : [...dias, d].sort() });
    return (
      <div>
        <span className="mb-2 block text-sm font-semibold text-ink-soft">Dias da semana</span>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((d) => (
            <button key={d.v} type="button" onClick={() => toggle(d.v)}
              className={`h-10 w-12 rounded-xl text-xs font-bold transition ${dias.includes(d.v) ? 'bg-brand text-white' : 'bg-white text-ink-muted ring-1 ring-black/10 hover:ring-brand/30'}`}
            >{d.curto}</button>
          ))}
        </div>
      </div>
    );
  }
  if (tipo === 'feriado') {
    const datas = cond.datas || [];
    return (
      <div>
        <span className="mb-2 block text-sm font-semibold text-ink-soft">Datas (repetem todo ano)</span>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {datas.length === 0 && <span className="text-xs text-ink-muted">Nenhuma data adicionada.</span>}
          {datas.map((d) => (
            <span key={d} className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-semibold ring-1 ring-black/10">
              {d.split('-').reverse().join('/')}
              <button type="button" onClick={() => patch({ datas: datas.filter((x) => x !== d) })} className="text-ink-muted hover:text-red-600">✕</button>
            </span>
          ))}
        </div>
        <input type="date" className={`${inp} max-w-[200px]`} onChange={(e) => {
          const md = toMMDD(e.target.value);
          if (md && !datas.includes(md)) patch({ datas: [...datas, md].sort() });
          e.currentTarget.value = '';
        }} />
      </div>
    );
  }
  if (tipo === 'tipo_evento') {
    const tipos = cond.tipos || [];
    const toggle = (t: string) => patch({ tipos: tipos.includes(t) ? tipos.filter((x) => x !== t) : [...tipos, t] });
    return (
      <div>
        <span className="mb-2 block text-sm font-semibold text-ink-soft">Tipos de evento</span>
        <div className="flex flex-wrap gap-1.5">
          {TIPOS_EVENTO.map((t) => (
            <button key={t} type="button" onClick={() => toggle(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${tipos.includes(t) ? 'bg-brand text-white' : 'bg-white text-ink-muted ring-1 ring-black/10 hover:ring-brand/30'}`}
            >{t}</button>
          ))}
        </div>
      </div>
    );
  }
  if (tipo === 'antecedencia' || tipo === 'duracao') {
    const isAnt = tipo === 'antecedencia';
    const val = isAnt ? cond.dias_ant : cond.horas;
    return (
      <div className="grid grid-cols-2 gap-4">
        <Field label="Condição">
          <select value={cond.operador || 'menos'} onChange={(e) => patch({ operador: e.target.value as 'menos' | 'mais' })} className={inp}>
            <option value="menos">{isAnt ? 'Faltando até' : 'Até'}</option>
            <option value="mais">{isAnt ? 'Com pelo menos' : 'A partir de'}</option>
          </select>
        </Field>
        <Field label={isAnt ? 'Dias' : 'Horas'}>
          <input type="number" min={0} value={val ?? ''} onChange={(e) => patch(isAnt ? { dias_ant: Number(e.target.value) } : { horas: Number(e.target.value) })} className={inp} />
        </Field>
      </div>
    );
  }
  // qtd_convidados
  return (
    <div className="grid grid-cols-2 gap-4">
      <Field label="Mínimo" hint="Vazio = sem mínimo">
        <input type="number" min={0} value={cond.min ?? ''} onChange={(e) => patch({ min: e.target.value === '' ? null : Number(e.target.value) })} className={inp} />
      </Field>
      <Field label="Máximo" hint="Vazio = sem máximo">
        <input type="number" min={0} value={cond.max ?? ''} onChange={(e) => patch({ max: e.target.value === '' ? null : Number(e.target.value) })} className={inp} />
      </Field>
    </div>
  );
}

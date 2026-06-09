'use client';

// Aba "Direitos do titular" (LGPD) — coração do atendimento a titulares.
//   • Fila de SOLICITAÇÕES (acesso/correção/exclusão/portabilidade/…) com o PRAZO
//     LEGAL de 15 dias (art. 19) e a trilha de resposta; status com SLA (no prazo/
//     a vencer/vencido). Atender abre as ações certas por tipo de pedido.
//   • FERRAMENTA do titular: exporta (acesso/portabilidade) ou ANONIMIZA (exclusão/
//     anonimização) os dados pessoais de um titular varrendo várias tabelas —
//     efetivamente, via /api/juridico (service-role). Exclusão/anonimização efetiva
//     por titular é critério de aceite. Sem "R$" hardcoded.

import { useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type JuridicoBag, type Solicitacao, type TitularTipo, type TipoSolicitacao, type CanalConsentimento,
  type TitularQuery, type ExportTitular,
  TIPOS_SOLICITACAO, tipoSolicitacaoLabel, solicitacaoApagaDados, solicitacaoEncerrada,
  TITULAR_TIPOS, titularTipoLabel, CANAIS_CONSENTIMENTO,
  STATUS_SOLICITACAO_META, slaSolicitacao, PRAZO_LGPD_DIAS,
  novaSolicitacaoRow, criarSolicitacao, salvarSolicitacao,
  exportarTitular, anonimizarTitular, inp, selCls,
} from '../_lib';
import {
  Kpi, ModalShell, Campo, EmptyState, StatusPill, SectionCard, toneClasses,
  IcoShield, IcoPlus, IcoEdit, IcoDownload, IcoEraser, IcoClock, IcoCheck, IcoX, IcoSearch, IcoAlert,
  btnPrimary, btnSecondary, btnDanger,
} from './ui';

// Baixa um objeto como JSON (acesso/portabilidade do titular).
function baixarJSON(name: string, obj: unknown): void {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

// Monta a query de titular a partir de uma solicitação (e-mail se o contato parecer e-mail).
function queryDaSolicitacao(s: Solicitacao): TitularQuery {
  const contato = (s.titular_contato || '').trim();
  const ehEmail = contato.includes('@');
  return {
    nome: s.titular_nome || undefined,
    email: ehEmail ? contato : undefined,
    doc: !ehEmail && contato ? contato : undefined,
    tipo: s.titular_tipo,
    id: s.titular_id || undefined,
  };
}

export default function Direitos({ bag }: { bag: JuridicoBag }) {
  const { hoje } = bag;
  const [nova, setNova] = useState(false);
  const [edit, setEdit] = useState<Solicitacao | null>(null);
  const [atender, setAtender] = useState<Solicitacao | null>(null);

  const lista = useMemo(() => {
    return [...bag.solicitacoes].sort((a, b) => {
      const ea = solicitacaoEncerrada(a.status) ? 1 : 0;
      const eb = solicitacaoEncerrada(b.status) ? 1 : 0;
      return ea - eb || (a.prazo || '9999').localeCompare(b.prazo || '9999');
    });
  }, [bag.solicitacoes]);

  const kpi = useMemo(() => {
    let abertas = 0, vencidas = 0, noPrazo = 0, concluidas = 0;
    for (const s of bag.solicitacoes) {
      if (solicitacaoEncerrada(s.status)) { concluidas++; continue; }
      abertas++;
      const sla = slaSolicitacao(s.prazo, hoje, s.status);
      if (sla.status === 'vencido') vencidas++; else noPrazo++;
    }
    return { abertas, vencidas, noPrazo, concluidas };
  }, [bag.solicitacoes, hoje]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Abertas" value={String(kpi.abertas)} tone={kpi.abertas > 0 ? 'azul' : 'cinza'} icon={<IcoShield />} />
        <Kpi label="Fora do prazo" value={String(kpi.vencidas)} tone={kpi.vencidas > 0 ? 'vermelho' : 'verde'} icon={<IcoAlert />} sub={`prazo legal ${PRAZO_LGPD_DIAS} dias`} />
        <Kpi label="Dentro do prazo" value={String(kpi.noPrazo)} tone="cinza" icon={<IcoClock />} />
        <Kpi label="Concluídas" value={String(kpi.concluidas)} tone="verde" icon={<IcoCheck />} />
      </div>

      <SectionCard
        title="Solicitações de titular"
        desc="Cada pedido tem prazo legal de 15 dias para resposta (LGPD art. 19)."
        action={<button onClick={() => setNova(true)} className={btnPrimary}><IcoPlus /> Nova solicitação</button>}
      >
        {lista.length === 0 ? (
          <EmptyState icon={<IcoShield />} title="Nenhuma solicitação na fila">
            Quando um titular pedir acesso, correção, exclusão ou portabilidade dos dados, registre aqui. O prazo legal é calculado automaticamente e o atendimento fica com trilha.
          </EmptyState>
        ) : (
          <ul className="space-y-2.5">
            {lista.map((s) => <SolicRow key={s.id} s={s} hoje={hoje} onAtender={() => setAtender(s)} onEdit={() => setEdit(s)} />)}
          </ul>
        )}
      </SectionCard>

      <FerramentaTitular bag={bag} />

      {(nova || edit) && <SolicitacaoModal bag={bag} editando={edit} onClose={() => { setNova(false); setEdit(null); }} onSaved={async () => { setNova(false); setEdit(null); await bag.reload(); }} />}
      {atender && <AtenderModal bag={bag} solic={atender} onClose={() => setAtender(null)} onDone={async () => { setAtender(null); await bag.reload(); }} />}
    </div>
  );
}

function SolicRow({ s, hoje, onAtender, onEdit }: { s: Solicitacao; hoje: string; onAtender: () => void; onEdit: () => void }) {
  const meta = STATUS_SOLICITACAO_META[s.status] || STATUS_SOLICITACAO_META.aberta;
  const sla = slaSolicitacao(s.prazo, hoje, s.status);
  const slaT = toneClasses(sla.tone);
  const apaga = solicitacaoApagaDados(s.tipo);
  return (
    <li className="rounded-xl border border-black/[0.06] p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">{s.titular_nome || 'Titular'}</span>
            <span className={`rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${apaga ? 'bg-red-50 text-red-600' : 'bg-black/[0.04] text-ink-muted'}`}>{tipoSolicitacaoLabel(s.tipo)}</span>
            <StatusPill label={meta.label} tone={meta.tone} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-ink-muted">
            <span>{titularTipoLabel(s.titular_tipo)}</span>
            {s.titular_contato && <span>{s.titular_contato}</span>}
            {s.criado_em && <span>Pedido em {formatDate(s.criado_em, { style: 'short' })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!solicitacaoEncerrada(s.status) && s.prazo && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[0.72rem] font-semibold ${slaT.chip}`}>
              <IcoClock /> {sla.dias != null ? (sla.dias < 0 ? `${Math.abs(sla.dias)}d em atraso` : `${sla.dias}d restantes`) : formatDate(s.prazo, { style: 'short' })}
            </span>
          )}
          <button onClick={onEdit} aria-label="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted hover:bg-black/[0.04]"><IcoEdit /></button>
          <button onClick={onAtender} className={btnSecondary + ' !px-3 !py-1.5'}>Atender</button>
        </div>
      </div>
    </li>
  );
}

// ── Modal: nova/editar solicitação ────────────────────────────────────────────
function SolicitacaoModal({ bag, editando, onClose, onSaved }: { bag: JuridicoBag; editando: Solicitacao | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Solicitacao>(() => editando || {
    id: '', titular_nome: '', titular_contato: '', titular_tipo: 'cliente', titular_id: null,
    tipo: 'acesso', canal: 'portal', status: 'aberta', prazo: null, resposta: null, concluida_em: null,
  });
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<Solicitacao>) => setF((v) => ({ ...v, ...patch }));

  const salvar = async () => {
    if (!f.titular_nome?.trim() && !f.titular_contato?.trim()) { toast.error('Informe o nome ou o contato do titular.'); return; }
    setBusy(true);
    if (editando) {
      const { error } = await salvarSolicitacao(editando.id, {
        titular_nome: f.titular_nome || null, titular_contato: f.titular_contato || null,
        titular_tipo: f.titular_tipo, titular_id: f.titular_id || null, tipo: f.tipo, canal: f.canal,
      });
      setBusy(false);
      if (error) { toast.error('Não foi possível salvar.'); return; }
      toast.success('Solicitação atualizada.');
    } else {
      const row = novaSolicitacaoRow(bag.userId, f, bag.hoje);
      const { error } = await criarSolicitacao(row);
      setBusy(false);
      if (error) { toast.error('Não foi possível registrar.'); return; }
      toast.success('Solicitação registrada — prazo legal de 15 dias iniciado.');
    }
    onSaved();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="text-lg font-bold text-ink">{editando ? 'Editar solicitação' : 'Nova solicitação de titular'}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo label="Tipo de pedido" full>
          <select value={f.tipo} onChange={(e) => set({ tipo: e.target.value as TipoSolicitacao })} className={selCls}>
            {TIPOS_SOLICITACAO.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <span className="mt-1 block text-[0.72rem] text-ink-muted">{TIPOS_SOLICITACAO.find((t) => t.key === f.tipo)?.descricao}</span>
        </Campo>
        <Campo label="Nome do titular">
          <input value={f.titular_nome || ''} onChange={(e) => set({ titular_nome: e.target.value })} list="jur-clientes-dir" className={inp} />
          <datalist id="jur-clientes-dir">{bag.clientes.map((c) => <option key={c.id} value={c.nome || ''} />)}</datalist>
        </Campo>
        <Campo label="Contato (e-mail/telefone)">
          <input value={f.titular_contato || ''} onChange={(e) => set({ titular_contato: e.target.value })} className={inp} />
        </Campo>
        <Campo label="Tipo de titular">
          <select value={f.titular_tipo} onChange={(e) => set({ titular_tipo: e.target.value as TitularTipo })} className={selCls}>
            {TITULAR_TIPOS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Campo>
        <Campo label="Canal do pedido">
          <select value={f.canal} onChange={(e) => set({ canal: e.target.value as CanalConsentimento })} className={selCls}>
            {CANAIS_CONSENTIMENTO.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </Campo>
      </div>
      {!editando && <p className="mt-3 rounded-lg bg-blue-50 px-3 py-2 text-[0.78rem] text-blue-700">O prazo legal de resposta ({PRAZO_LGPD_DIAS} dias) é calculado a partir de hoje.</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnSecondary}>Cancelar</button>
        <button onClick={salvar} disabled={busy} className={btnPrimary}>{busy ? 'Salvando…' : 'Salvar'}</button>
      </div>
    </ModalShell>
  );
}

// ── Modal: atender (export/anonimizar + concluir/recusar) ─────────────────────
function AtenderModal({ bag, solic, onClose, onDone }: { bag: JuridicoBag; solic: Solicitacao; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [resposta, setResposta] = useState(solic.resposta || '');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAnon, setConfirmAnon] = useState(false);
  const apaga = solicitacaoApagaDados(solic.tipo);
  const query = queryDaSolicitacao(solic);

  const exportar = async () => {
    setBusy('export');
    const r = await exportarTitular(query);
    setBusy(null);
    if (!r.ok || !r.data) { toast.error(r.error || 'Falha ao exportar.'); return; }
    baixarJSON(`titular-${(solic.titular_nome || 'dados').replace(/\s+/g, '-').toLowerCase()}.json`, r.data);
    toast.success(`${r.data.total} registro(s) exportado(s).`);
  };

  const anonimizar = async () => {
    setBusy('anon');
    const r = await anonimizarTitular(query, solic.id);
    setBusy(null);
    setConfirmAnon(false);
    if (!r.ok || !r.data) { toast.error(r.error || 'Falha ao anonimizar.'); return; }
    toast.success(`Dados anonimizados em ${r.data.total} registro(s). Solicitação concluída.`);
    onDone();
  };

  const concluir = async (status: 'concluida' | 'recusada') => {
    setBusy(status);
    const { error } = await salvarSolicitacao(solic.id, {
      status, resposta: resposta || null, concluida_em: new Date().toISOString(),
    });
    setBusy(null);
    if (error) { toast.error('Não foi possível atualizar.'); return; }
    toast.success(status === 'concluida' ? 'Solicitação concluída.' : 'Solicitação recusada (registrada).');
    onDone();
  };

  const marcarAndamento = async () => {
    setBusy('andamento');
    await salvarSolicitacao(solic.id, { status: 'em_andamento', resposta: resposta || null });
    setBusy(null);
    onDone();
  };

  return (
    <ModalShell onClose={onClose} maxW="max-w-xl">
      <h3 className="text-lg font-bold text-ink">Atender solicitação</h3>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        <span className="font-semibold text-ink-soft">{solic.titular_nome || 'Titular'}</span>
        <span>· {tipoSolicitacaoLabel(solic.tipo)}</span>
        {solic.titular_contato && <span>· {solic.titular_contato}</span>}
      </div>

      {/* Ações de dados conforme o tipo de pedido */}
      <div className="mt-4 rounded-xl border border-black/[0.06] p-3.5">
        <div className="text-sm font-semibold text-ink-soft">Dados do titular</div>
        <p className="mt-0.5 text-[0.78rem] text-ink-muted">
          Varre clientes, eventos, convidados e os registros de LGPD por nome{query.email ? ', e-mail' : ''}{query.doc ? ' e documento' : ''}.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={exportar} disabled={!!busy} className={btnSecondary}>
            <IcoDownload /> {busy === 'export' ? 'Exportando…' : 'Exportar dados (JSON)'}
          </button>
          {apaga && (
            <button onClick={() => setConfirmAnon(true)} disabled={!!busy} className={btnDanger}>
              <IcoEraser /> Anonimizar dados
            </button>
          )}
        </div>
        {apaga && <p className="mt-2 text-[0.72rem] text-ink-muted">A anonimização sobrescreve os dados pessoais de forma irreversível, preservando registros exigidos por obrigação legal (ex.: fiscais).</p>}
      </div>

      {/* Trilha / resposta */}
      <div className="mt-4">
        <Campo label="Resposta / trilha do atendimento">
          <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={3} placeholder="Descreva o que foi feito, o que foi enviado ao titular, etc." className={inp} />
        </Campo>
      </div>

      <div className="mt-5 flex flex-wrap justify-end gap-2">
        {!solicitacaoEncerrada(solic.status) && <button onClick={marcarAndamento} disabled={!!busy} className={btnSecondary}>Em andamento</button>}
        <button onClick={() => concluir('recusada')} disabled={!!busy} className={btnSecondary}><IcoX /> Recusar</button>
        <button onClick={() => concluir('concluida')} disabled={!!busy} className={btnPrimary}><IcoCheck /> Concluir</button>
      </div>

      {confirmAnon && (
        <ModalShell onClose={() => setConfirmAnon(false)} maxW="max-w-sm">
          <h3 className="text-lg font-bold text-ink">Anonimizar dados do titular?</h3>
          <p className="mt-1 text-sm text-ink-muted">Os dados pessoais de <strong>{solic.titular_nome || 'titular'}</strong> serão sobrescritos de forma irreversível e a solicitação será concluída.</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setConfirmAnon(false)} className={btnSecondary + ' flex-1'}>Cancelar</button>
            <button onClick={anonimizar} disabled={busy === 'anon'} className={btnDanger + ' flex-1'}><IcoEraser /> {busy === 'anon' ? 'Anonimizando…' : 'Anonimizar'}</button>
          </div>
        </ModalShell>
      )}
    </ModalShell>
  );
}

// ── Ferramenta avulsa do titular (sem solicitação formal) ─────────────────────
function FerramentaTitular({ bag }: { bag: JuridicoBag }) {
  const toast = useToast();
  const [q, setQ] = useState<{ nome: string; email: string; doc: string }>({ nome: '', email: '', doc: '' });
  const [busy, setBusy] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ExportTitular | null>(null);
  const [confirmAnon, setConfirmAnon] = useState(false);

  const query = (): TitularQuery => ({ nome: q.nome || undefined, email: q.email || undefined, doc: q.doc || undefined });
  const temFiltro = !!(q.nome.trim() || q.email.trim() || q.doc.trim());

  const exportar = async () => {
    if (!temFiltro) { toast.error('Informe ao menos um campo do titular.'); return; }
    setBusy('export');
    const r = await exportarTitular(query());
    setBusy(null);
    if (!r.ok || !r.data) { toast.error(r.error || 'Falha ao buscar.'); return; }
    setResultado(r.data);
    if (r.data.total === 0) toast.info('Nenhum dado encontrado para esse titular.');
  };

  const anonimizar = async () => {
    setBusy('anon');
    const r = await anonimizarTitular(query());
    setBusy(null);
    setConfirmAnon(false);
    if (!r.ok || !r.data) { toast.error(r.error || 'Falha ao anonimizar.'); return; }
    toast.success(`Dados anonimizados em ${r.data.total} registro(s).`);
    setResultado(null);
    await bag.reload();
  };

  return (
    <SectionCard title="Ferramenta do titular" desc="Exporte (acesso/portabilidade) ou anonimize os dados de um titular em todas as tabelas.">
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Nome"><input value={q.nome} onChange={(e) => setQ({ ...q, nome: e.target.value })} className={inp} /></Campo>
        <Campo label="E-mail"><input value={q.email} onChange={(e) => setQ({ ...q, email: e.target.value })} className={inp} /></Campo>
        <Campo label="Documento (CPF/CNPJ)"><input value={q.doc} onChange={(e) => setQ({ ...q, doc: e.target.value })} className={inp} /></Campo>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={exportar} disabled={!!busy} className={btnSecondary}><IcoSearch /> {busy === 'export' ? 'Buscando…' : 'Buscar / exportar'}</button>
        {resultado && resultado.total > 0 && (
          <>
            <button onClick={() => baixarJSON(`titular-${(q.nome || 'dados').replace(/\s+/g, '-').toLowerCase()}.json`, resultado)} className={btnSecondary}><IcoDownload /> Baixar JSON</button>
            <button onClick={() => setConfirmAnon(true)} disabled={!!busy} className={btnDanger}><IcoEraser /> Anonimizar</button>
          </>
        )}
      </div>

      {resultado && (
        <div className="mt-4 rounded-xl bg-black/[0.02] p-3.5">
          <div className="text-sm font-semibold text-ink-soft">{resultado.total} registro(s) encontrado(s)</div>
          {resultado.total === 0 ? (
            <p className="mt-1 text-[0.8rem] text-ink-muted">Nenhum dado pessoal localizado com esses filtros.</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-2">
              {resultado.registros.filter((r) => r.itens.length > 0).map((r) => (
                <li key={r.tabela} className="rounded-full bg-white px-2.5 py-1 text-[0.72rem] font-medium text-ink-soft shadow-card">{r.rotulo}: {r.itens.length}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {confirmAnon && (
        <ModalShell onClose={() => setConfirmAnon(false)} maxW="max-w-sm">
          <h3 className="text-lg font-bold text-ink">Anonimizar este titular?</h3>
          <p className="mt-1 text-sm text-ink-muted">Os dados pessoais serão sobrescritos de forma irreversível em {resultado?.total ?? 0} registro(s).</p>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setConfirmAnon(false)} className={btnSecondary + ' flex-1'}>Cancelar</button>
            <button onClick={anonimizar} disabled={busy === 'anon'} className={btnDanger + ' flex-1'}><IcoEraser /> {busy === 'anon' ? 'Anonimizando…' : 'Anonimizar'}</button>
          </div>
        </ModalShell>
      )}
    </SectionCard>
  );
}

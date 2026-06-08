'use client';

// Formulário de funcionário (ficha cadastral) — cria/edita uma linha em `equipe`.
// Reutilizado por /painel/rh/funcionarios (novo/editar) e por /painel/rh/admissao
// (etapa final do onboarding). Grava via RLS (a tabela é do dono). Ao CRIAR,
// registra um evento 'admissao' na timeline. Sem "R$" hardcoded.

import { useState } from 'react';
import { supabaseAny as sb } from '@/lib/supabase';
import { useToast } from '@/components/Toast';
import { CONTRATOS, STATUS_LIST } from '@/lib/folha';
import { ModalShell, Campo, btnPrimary } from './ui';
import { DEPARTAMENTOS, FUNCOES_EVENTO, inp, type Funcionario } from '../_lib';

type FormState = {
  nome: string; cpf: string; rg: string; nascimento: string; email: string; telefone: string;
  cargo: string; departamento: string; contrato: string; salario: string; status: string;
  admissao: string; jornada: string; dependentes: string; gestor_id: string;
  banco: string; agencia: string; conta: string; tipoConta: string; pix: string; foto_url: string; obs: string;
};

function fromFunc(f?: Partial<Funcionario>): FormState {
  const b = f?.banco ?? {};
  return {
    nome: f?.nome ?? '', cpf: f?.cpf ?? '', rg: f?.rg ?? '', nascimento: f?.nascimento ?? '',
    email: f?.email ?? '', telefone: f?.telefone ?? '', cargo: f?.cargo ?? '',
    departamento: f?.departamento ?? 'Operações', contrato: f?.contrato ?? 'clt',
    salario: f?.salario ? String(f.salario) : '', status: f?.status ?? 'ativo',
    admissao: f?.admissao ?? '', jornada: f?.jornada ?? '', dependentes: f?.dependentes ? String(f.dependentes) : '0',
    gestor_id: f?.gestor_id ? String(f.gestor_id) : '',
    banco: b.banco ?? '', agencia: b.agencia ?? '', conta: b.conta ?? '', tipoConta: b.tipo ?? '', pix: b.pix ?? '',
    foto_url: f?.foto_url ?? '', obs: f?.obs ?? '',
  };
}

export default function FuncionarioForm({
  userId, initial, gestores, onClose, onSaved, tituloCriar = 'Novo funcionário',
}: {
  userId: string;
  initial?: Partial<Funcionario>;
  gestores: Funcionario[];
  onClose: () => void;
  onSaved: (id: number) => void;
  tituloCriar?: string;
}) {
  const toast = useToast();
  const editId = initial?.id ?? null;
  const [f, setF] = useState<FormState>(() => fromFunc(initial));
  const [saving, setSaving] = useState(false);
  const set = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function salvar() {
    if (!f.nome.trim()) { toast.error('Informe o nome.'); return; }
    setSaving(true);
    const banco = { banco: f.banco || undefined, agencia: f.agencia || undefined, conta: f.conta || undefined, tipo: f.tipoConta || undefined, pix: f.pix || undefined };
    const payload = {
      nome: f.nome.trim(), cpf: f.cpf || null, rg: f.rg || null, nascimento: f.nascimento || null,
      email: f.email || null, telefone: f.telefone || null, cargo: f.cargo || null,
      departamento: f.departamento || null, contrato: f.contrato, salario: f.salario ? Number(f.salario) : 0,
      status: f.status, admissao: f.admissao || null, jornada: f.jornada || null,
      dependentes: f.dependentes ? Number(f.dependentes) : 0, gestor_id: f.gestor_id ? Number(f.gestor_id) : null,
      banco, foto_url: f.foto_url || null, obs: f.obs || null,
    };

    if (editId) {
      const { error } = await sb.from('equipe').update(payload).eq('id', editId).eq('usuario_id', userId);
      setSaving(false);
      if (error) { toast.error('Não foi possível salvar.'); return; }
      toast.success('Funcionário atualizado.');
      onSaved(editId);
    } else {
      const { data, error } = await sb.from('equipe').insert({ ...payload, usuario_id: userId }).select('id').single();
      if (!error && data) {
        await sb.from('rh_eventos_funcionario').insert({
          usuario_id: userId, equipe_id: data.id, tipo: 'admissao',
          titulo: 'Admissão', descricao: payload.cargo || null, data: payload.admissao || new Date().toISOString().slice(0, 10),
        });
      }
      setSaving(false);
      if (error || !data) { toast.error('Não foi possível cadastrar.'); return; }
      toast.success('Funcionário cadastrado.');
      onSaved(Number(data.id));
    }
  }

  return (
    <ModalShell onClose={onClose} maxW="max-w-2xl" title={editId ? 'Editar funcionário' : tituloCriar}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Campo label="Nome completo" full>
          <input className={inp} value={f.nome} onChange={set('nome')} autoFocus />
        </Campo>
        <Campo label="CPF"><input className={inp} value={f.cpf} onChange={set('cpf')} inputMode="numeric" /></Campo>
        <Campo label="RG"><input className={inp} value={f.rg} onChange={set('rg')} /></Campo>
        <Campo label="Nascimento"><input type="date" className={inp} value={f.nascimento} onChange={set('nascimento')} /></Campo>
        <Campo label="E-mail"><input type="email" className={inp} value={f.email} onChange={set('email')} /></Campo>
        <Campo label="Telefone"><input className={inp} value={f.telefone} onChange={set('telefone')} /></Campo>
        <Campo label="Cargo / função">
          <input className={inp} value={f.cargo} onChange={set('cargo')} list="rh-funcoes" placeholder="Ex.: Garçom, Coordenação…" />
          <datalist id="rh-funcoes">{FUNCOES_EVENTO.map((x) => <option key={x} value={x} />)}</datalist>
        </Campo>
        <Campo label="Departamento">
          <select className={inp} value={f.departamento} onChange={set('departamento')}>
            {DEPARTAMENTOS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </Campo>
        <Campo label="Contrato">
          <select className={inp} value={f.contrato} onChange={set('contrato')}>{CONTRATOS.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}</select>
        </Campo>
        <Campo label="Salário (bruto mensal)" hint="Apenas o valor — a moeda segue suas preferências.">
          <input type="number" min={0} step="0.01" className={inp} value={f.salario} onChange={set('salario')} />
        </Campo>
        <Campo label="Status">
          <select className={inp} value={f.status} onChange={set('status')}>{STATUS_LIST.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}</select>
        </Campo>
        <Campo label="Admissão"><input type="date" className={inp} value={f.admissao} onChange={set('admissao')} /></Campo>
        <Campo label="Jornada"><input className={inp} value={f.jornada} onChange={set('jornada')} placeholder="Ex.: 44h semanais" /></Campo>
        <Campo label="Dependentes"><input type="number" min={0} className={inp} value={f.dependentes} onChange={set('dependentes')} /></Campo>
        <Campo label="Gestor(a)">
          <select className={inp} value={f.gestor_id} onChange={set('gestor_id')}>
            <option value="">—</option>
            {gestores.filter((g) => g.id !== editId).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
          </select>
        </Campo>

        <div className="sm:col-span-2 mt-1 border-t border-black/[0.06] pt-3 text-xs font-semibold uppercase tracking-wide text-ink-muted">Dados bancários</div>
        <Campo label="Banco"><input className={inp} value={f.banco} onChange={set('banco')} /></Campo>
        <Campo label="Agência"><input className={inp} value={f.agencia} onChange={set('agencia')} /></Campo>
        <Campo label="Conta"><input className={inp} value={f.conta} onChange={set('conta')} /></Campo>
        <Campo label="Tipo de conta">
          <select className={inp} value={f.tipoConta} onChange={set('tipoConta')}>
            <option value="">—</option><option value="corrente">Corrente</option><option value="poupanca">Poupança</option>
          </select>
        </Campo>
        <Campo label="Chave PIX" full><input className={inp} value={f.pix} onChange={set('pix')} /></Campo>

        <Campo label="Observações" full><textarea className={`${inp} min-h-[64px]`} value={f.obs} onChange={set('obs')} /></Campo>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button onClick={salvar} disabled={saving || !f.nome.trim()} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>
        <button onClick={onClose} className="ml-auto text-sm font-medium text-ink-muted hover:text-ink">Cancelar</button>
      </div>
    </ModalShell>
  );
}

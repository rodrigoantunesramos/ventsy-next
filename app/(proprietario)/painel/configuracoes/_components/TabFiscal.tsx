'use client';

// Aba Fiscal — regime, CNAE, código de serviço, alíquotas e dados do emitente.
// Alimenta Faturamento/Contabilidade. Edita empresa.config_fiscal.

import { Section, Campo, SaveBar, Toggle, inp } from './ui';
import { REGIMES, type EmpresaConfig } from '../_lib';

type Props = {
  empresa: EmpresaConfig;
  set: (patch: Partial<EmpresaConfig>) => void;
  saving: boolean;
  onSave: () => void;
};

export default function TabFiscal({ empresa: e, set, saving, onSave }: Props) {
  const f = e.config_fiscal;
  const fis = (p: Partial<EmpresaConfig['config_fiscal']>) => set({ config_fiscal: { ...f, ...p } });

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠️ Confirme estes dados com seu contador — variam por município, atividade e regime tributário.
      </div>

      <Section title="Regime & atividade">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Regime tributário">
            <select className={inp} value={f.regime} onChange={(ev) => fis({ regime: ev.target.value })}>
              {REGIMES.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          </Campo>
          <Campo label="CNAE principal" hint="Código da atividade econômica.">
            <input className={inp} value={f.cnae} onChange={(ev) => fis({ cnae: ev.target.value })} placeholder="0000-0/00" />
          </Campo>
          <Campo label="Código de serviço (LC 116)" hint="Para emissão de NFS-e.">
            <input className={inp} value={f.codigo_servico} onChange={(ev) => fis({ codigo_servico: ev.target.value })} />
          </Campo>
          <Campo label="Alíquota de ISS (%)">
            <input className={inp} type="number" min={0} max={100} step={0.01} value={f.iss} onChange={(ev) => fis({ iss: ev.target.value })} placeholder="ex.: 5" />
          </Campo>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Toggle label="Optante pelo Simples Nacional" checked={f.optante_simples} onChange={(v) => fis({ optante_simples: v })} />
          <Toggle label="Incentivador cultural" checked={f.incentivador_cultural} onChange={(v) => fis({ incentivador_cultural: v })} />
        </div>
      </Section>

      <Section title="Emitente" desc="Dados de quem emite as notas/documentos fiscais.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Nome do emitente">
            <input className={inp} value={f.emitente_nome} onChange={(ev) => fis({ emitente_nome: ev.target.value })} />
          </Campo>
          <Campo label="E-mail do emitente">
            <input className={inp} type="email" value={f.emitente_email} onChange={(ev) => fis({ emitente_email: ev.target.value })} />
          </Campo>
          <Campo label="Observações fiscais" full>
            <textarea className={`${inp} min-h-[80px]`} value={f.observacoes} onChange={(ev) => fis({ observacoes: ev.target.value })} placeholder="Texto padrão para notas (ex.: regime especial, retenções…)" />
          </Campo>
        </div>
      </Section>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

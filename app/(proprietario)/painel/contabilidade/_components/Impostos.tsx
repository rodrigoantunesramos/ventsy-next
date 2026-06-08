'use client'

// Aba Impostos — estimativa de carga tributária por regime sobre a receita do
// período (engine pura). A config (regime + alíquotas) é persistida em
// empresa_config.config_fiscal (compartilhada com Configurações › Fiscal).

import { useMemo, useState } from 'react'
import { useToast } from '@/components/Toast'
import { formatMoney, formatPercent } from '@/lib/format'
import { estimarImpostos, montarDRE, type ConfigImpostos, type Lancamento, type PlanoConta, type Regime, type RegimeTributario } from '@/lib/contabilidade'
import { REGIMES_TRIB, btnPrimary, inp, salvarConfigImpostos } from '../_lib'
import { KpiCard, Section } from './ui'

type Range = { ini: string; fim: string }
type Props = { userId: string; configImpostos: ConfigImpostos; lancamentos: Lancamento[]; contas: PlanoConta[]; regime: Regime; atual: Range; periodoLabel: string; recarregar: () => Promise<void> }

export default function Impostos({ userId, configImpostos, lancamentos, contas, regime, atual, periodoLabel, recarregar }: Props) {
  const toast = useToast()
  const [cfg, setCfg] = useState<ConfigImpostos>(configImpostos)
  const [saving, setSaving] = useState(false)

  const dre = useMemo(() => montarDRE(lancamentos, contas, regime, atual.ini, atual.fim), [lancamentos, contas, regime, atual])
  const est = useMemo(() => estimarImpostos(dre.receitaBruta, cfg, Math.max(0, dre.resultadoLiquido)), [dre, cfg])
  const lucroAposImpostos = dre.resultadoLiquido - est.total

  const set = (p: Partial<ConfigImpostos>) => setCfg((c) => ({ ...c, ...p }))
  const numField = (label: string, k: keyof ConfigImpostos, hint?: string) => (
    <NumField label={label} value={String(cfg[k] ?? '')} onChange={(v) => set({ [k]: Number(v) } as Partial<ConfigImpostos>)} hint={hint} />
  )

  async function salvar() {
    setSaving(true)
    const { error } = await salvarConfigImpostos(userId, cfg)
    setSaving(false)
    if (error) { toast.error('Erro ao salvar configuração fiscal.'); return }
    toast.success('Configuração fiscal salva.'); await recarregar()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Receita bruta" value={formatMoney(dre.receitaBruta)} sub={periodoLabel} tone="azul" />
        <KpiCard label="Impostos estimados" value={formatMoney(est.total)} sub="provisão do período" tone="vermelho" />
        <KpiCard label="Alíquota efetiva" value={formatPercent(est.aliquotaEfetiva, { maximumFractionDigits: 2 })} sub="sobre a receita" tone="gold" />
        <KpiCard label="Resultado após impostos" value={formatMoney(lucroAposImpostos)} sub="estimado" tone={lucroAposImpostos >= 0 ? 'verde' : 'vermelho'} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Section title="Provisão de impostos" hint={`${periodoLabel} · regime ${REGIMES_TRIB.find((r) => r.v === cfg.regime)?.label}`}>
          {est.linhas.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-muted">Sem tributação estimada para este regime.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b border-black/[0.06] text-left text-xs text-ink-muted"><th className="pb-2 font-semibold">Tributo</th><th className="pb-2 text-right font-semibold">Base</th><th className="pb-2 text-right font-semibold">Alíq.</th><th className="pb-2 text-right font-semibold">Valor</th></tr></thead>
              <tbody>
                {est.linhas.map((l) => (
                  <tr key={l.nome} className="border-b border-black/[0.04]">
                    <td className="py-2 font-medium text-ink-soft">{l.nome}</td>
                    <td className="py-2 text-right text-ink-muted">{l.base ? formatMoney(l.base) : '—'}</td>
                    <td className="py-2 text-right text-ink-muted">{l.aliquota ? `${l.aliquota}%` : '—'}</td>
                    <td className="py-2 text-right font-semibold text-red-600">{formatMoney(l.valor)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr className="border-t-2 border-black/[0.1] font-bold"><td className="py-2.5 text-ink" colSpan={3}>Total a recolher</td><td className="py-2.5 text-right text-red-600">{formatMoney(est.total)}</td></tr></tfoot>
            </table>
          )}
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">⚠️ Estimativa gerencial. O valor fiscal exato depende de anexo do Simples, fator-R, créditos e retenções — confirme com seu contador.</p>
        </Section>

        <Section title="Configuração fiscal" action={<button onClick={salvar} disabled={saving} className={btnPrimary}>{saving ? 'Salvando…' : 'Salvar'}</button>}>
          <div className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-semibold text-ink-soft">Regime tributário</span>
              <select value={cfg.regime} onChange={(e) => set({ regime: e.target.value as RegimeTributario })} className={inp}>{REGIMES_TRIB.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}</select>
            </label>
            {cfg.regime === 'simples' && <div className="grid grid-cols-2 gap-4">{numField('Alíquota efetiva (%)', 'aliquotaSimples', 'DAS — alíquota efetiva do seu anexo')}</div>}
            {cfg.regime === 'mei' && <div className="grid grid-cols-2 gap-4">{numField('DAS-MEI mensal', 'dasMei', 'valor fixo do boleto')}</div>}
            {(cfg.regime === 'presumido' || cfg.regime === 'real') && (
              <>
                <div className="grid grid-cols-3 gap-4">{numField('ISS (%)', 'iss')}{numField('PIS (%)', 'pis')}{numField('COFINS (%)', 'cofins')}</div>
                <div className="grid grid-cols-2 gap-4">{numField('IRPJ (%)', 'irpj')}{numField('CSLL (%)', 'csll')}</div>
                {cfg.regime === 'presumido' && <div className="grid grid-cols-2 gap-4">{numField('Base presumida IRPJ (%)', 'presumidoBaseIRPJ', '32% p/ serviços')}{numField('Base presumida CSLL (%)', 'presumidoBaseCSLL')}</div>}
              </>
            )}
            {cfg.regime === 'isento' && <p className="rounded-lg bg-black/[0.02] px-3 py-2 text-xs text-ink-muted">Sem tributação estimada para pessoa física / isento.</p>}
          </div>
        </Section>
      </div>
    </div>
  )
}

function NumField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</span>
      <input type="number" step="0.01" min={0} value={value} onChange={(e) => onChange(e.target.value)} className={inp} />
      {hint && <span className="mt-1 block text-[0.65rem] text-ink-muted">{hint}</span>}
    </label>
  )
}

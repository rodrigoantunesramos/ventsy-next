import { calcularTaxas, FEE_CONFIG, type ModeloTaxa, type Breakdown } from '@/lib/fees'
import { lerPlataformaConfig } from '@/lib/plataformaConfigServer'

// SERVER-ONLY. Calcula as taxas usando os percentuais EDITÁVEIS pelo admin em
// plataforma_config (com fallback ao FEE_CONFIG). Os valores no admin são
// percentuais (15 = 15%); aqui viram fração. Incide no fluxo intermediado
// (checkout de reserva paga via Ventsy) — não no contato direto.
export async function calcularTaxasServer(valorBase: number, modelo?: ModeloTaxa): Promise<Breakdown> {
  const c = await lerPlataformaConfig()
  const frac = (chave: string, padrao: number) => {
    const v = Number(c[chave])
    return Number.isFinite(v) && v >= 0 && v <= 100 ? v / 100 : padrao
  }
  const cfg = {
    taxaAnfitriaoUnica: frac('comissao_anfitriao_unica_pct', FEE_CONFIG.taxaAnfitriaoUnica),
    taxaAnfitriaoSplit: frac('comissao_anfitriao_split_pct', FEE_CONFIG.taxaAnfitriaoSplit),
    taxaHospedeSplit: frac('comissao_hospede_split_pct', FEE_CONFIG.taxaHospedeSplit),
  }
  return calcularTaxas(valorBase, modelo ?? FEE_CONFIG.modelo, cfg)
}

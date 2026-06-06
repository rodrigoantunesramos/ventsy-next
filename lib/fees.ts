// Modelo de taxas da Ventsy — estilo Airbnb, configurável.
//
// Dois modos:
//  - 'anfitriao' (taxa única, maior): o hóspede paga só o aluguel; a Ventsy
//     desconta a taxa do repasse ao anfitrião.
//  - 'dividido': o anfitrião paga uma taxa menor + uma taxa de serviço é
//     somada ao que o hóspede paga (o hóspede "paga" a parte dele).
//
// No split de marketplace do MP, `comissaoVentsy` vira o application_fee e o
// `repasseAnfitriao` cai na conta MP do anfitrião.

export type ModeloTaxa = 'anfitriao' | 'dividido'

export const FEE_CONFIG = {
  modelo: 'anfitriao' as ModeloTaxa, // padrão; pode virar por-anúncio depois
  taxaAnfitriaoUnica: 0.15, // modo 'anfitriao': 15% no anfitrião
  taxaAnfitriaoSplit: 0.03, // modo 'dividido': 3% do anfitrião
  taxaHospedeSplit: 0.12, // modo 'dividido': 12% somado ao hóspede
}

export type Breakdown = {
  modelo: ModeloTaxa
  valorBase: number // aluguel
  taxaHospede: number // somada ao hóspede (0 no modo anfitrião)
  totalHospede: number // o que o hóspede paga (cobrado no checkout)
  taxaAnfitriao: number // descontada do anfitrião
  repasseAnfitriao: number // o que o anfitrião recebe
  comissaoVentsy: number // total que a Ventsy ganha (application_fee no split)
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function calcularTaxas(valorBase: number, modelo: ModeloTaxa = FEE_CONFIG.modelo): Breakdown {
  const base = r2(Math.max(0, valorBase || 0))

  if (modelo === 'dividido') {
    const taxaHospede = r2(base * FEE_CONFIG.taxaHospedeSplit)
    const taxaAnfitriao = r2(base * FEE_CONFIG.taxaAnfitriaoSplit)
    return {
      modelo,
      valorBase: base,
      taxaHospede,
      totalHospede: r2(base + taxaHospede),
      taxaAnfitriao,
      repasseAnfitriao: r2(base - taxaAnfitriao),
      comissaoVentsy: r2(taxaHospede + taxaAnfitriao),
    }
  }

  // modo 'anfitriao' — taxa única, maior
  const taxaAnfitriao = r2(base * FEE_CONFIG.taxaAnfitriaoUnica)
  return {
    modelo,
    valorBase: base,
    taxaHospede: 0,
    totalHospede: base,
    taxaAnfitriao,
    repasseAnfitriao: r2(base - taxaAnfitriao),
    comissaoVentsy: taxaAnfitriao,
  }
}

export function brl(n: number) {
  return (n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

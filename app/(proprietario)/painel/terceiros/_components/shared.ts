// Tipo do "bag" de estado compartilhado entre a shell (page.tsx) e as abas.
// Fica fora de page.tsx para evitar ciclo de import (page → abas → tipo).
// Carrega os dados crus + as agregações já calculadas pelo motor (lib/terceiros),
// para as abas só renderizarem.

import type {
  Terceiro, ResultadoTerceiro, TerceiroAgg, ResumoCarteira,
  FornecedorLite, GastoForn,
} from '../_lib';

export type TerceirosBag = {
  userId: string;
  hoje: string;                              // 'YYYY-MM-DD' — entra no motor puro
  empresa: string;
  // Dados crus:
  terceiros: Terceiro[];
  resultadosByTerceiro: Map<string, ResultadoTerceiro[]>;
  fornecedores: FornecedorLite[];
  fornecedoresMap: Map<string, FornecedorLite>;
  gastoForn: Map<string, GastoForn>;         // custo realizado puxado de Contas a pagar
  // Referências do Financeiro:
  receitaMensalRef: number;                  // p/ % sobre receita e modelo percentual
  eventosMensalRef: number;                  // p/ mensalizar modelo por_evento
  // Agregações já calculadas (custo × retorno, ROI, SLA, decisão, alertas):
  aggs: TerceiroAgg[];
  aggById: Map<string, TerceiroAgg>;
  resumo: ResumoCarteira;
  // Recargas escopadas:
  recarregar: () => Promise<void>;           // terceiros
  recarregarResultados: () => Promise<void>; // medições
};

// Tipo do "bag" de estado compartilhado entre a shell (page.tsx) e as abas.
// Fica fora de page.tsx para evitar ciclo de import (page → abas → tipo).

import type { Periodo, Granularidade } from '@/lib/metas';
import type { MetaRow, OkrRow, MetaFinanceira, PropriedadeLite, Realizado } from '../_lib';

export type MetasBag = {
  userId: string;
  hoje: string;                         // 'YYYY-MM-DD' — entra no motor puro
  periodo: Periodo;                     // período ativo (janela absoluta)
  gran: Granularidade;
  offset: number;                       // 0 = atual, -1 = anterior…
  propriedadeId: number | null;         // filtro de espaço (null = consolidado)
  props: PropriedadeLite[];
  propsMap: Map<number, string>;
  metas: MetaRow[];                     // tabela `metas` (todos os períodos)
  metasFin: MetaFinanceira[];           // metas_financeiras (receita/lucro/adimplência)
  okrs: OkrRow[];
  realizado: Realizado;                 // calculado p/ o período+escopo ativos
  realizadoLoading: boolean;
  recarregar: () => Promise<void>;      // recarrega metas/okrs/metas_financeiras
  definirPeriodo: (gran: Granularidade, offset: number) => void;
  definirPropriedade: (id: number | null) => void;
};

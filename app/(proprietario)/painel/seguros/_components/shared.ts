// Tipo do "bag" de estado compartilhado entre a shell (page.tsx) e as abas.
// Fica fora de page.tsx para evitar ciclo de import (page → abas → tipo).

import type { Seguro, Sinistro, PropriedadeLite, EventoLite } from '../_lib';

export type SegurosBag = {
  userId: string;
  hoje: string;                       // 'YYYY-MM-DD' — entra no motor puro
  empresa: string;
  seguros: Seguro[];
  sinistros: Sinistro[];
  props: PropriedadeLite[];
  eventos: EventoLite[];
  propsMap: Map<number, string>;
  eventosMap: Map<string, EventoLite>;
  recarregar: () => Promise<void>;
};

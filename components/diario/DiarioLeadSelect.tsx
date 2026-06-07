'use client';

import { LeadRef } from '@/types/diario';

interface Props {
  leads: LeadRef[];
  value: string | null;
  onChange: (leadId: string | null) => void;
  className?: string;
  title?: string;
}

// Seletor nativo de evento/cliente (clientes_eventos). Confiável e acessível;
// usado tanto no editor quanto no modo de edição do card.
export default function DiarioLeadSelect({ leads, value, onChange, className = '', title }: Props) {
  return (
    <select
      title={title ?? 'Vincular a um evento/cliente'}
      value={value ?? ''}
      onChange={e => onChange(e.target.value || null)}
      className={`rounded-lg border border-black/[0.08] bg-white px-2.5 py-[6px] text-[.82rem] text-ink-muted outline-none focus:border-brand ${value ? 'bg-violet-50 text-violet-700' : ''} ${className}`}
    >
      <option value="">🔗 Sem evento</option>
      {leads.map(l => (
        <option key={l.id} value={l.id}>
          {l.nome_evento} — {l.quem_contratou}
        </option>
      ))}
    </select>
  );
}

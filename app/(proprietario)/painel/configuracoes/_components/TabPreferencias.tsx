'use client';

// Aba Preferências — idioma, moeda, fuso, formato de data (fundação i18n que vale
// no painel todo via lib/format), primeira hora da agenda, numeração de
// documentos, templates padrão e notificações. Edita o objeto `empresa`.

import { Section, Campo, SaveBar, Toggle, inp } from './ui';
import { IDIOMAS, MOEDAS, FUSOS, FORMATOS_DATA, LOCALE_BY_IDIOMA, MOEDA_BY_IDIOMA, type Idioma, type FormatoData } from '@/lib/prefs';
import { formatMoney, formatDate, formatDateTime } from '@/lib/format';
import { NOTIF_ITEMS, type EmpresaConfig } from '../_lib';

type Props = {
  empresa: EmpresaConfig;
  set: (patch: Partial<EmpresaConfig>) => void;
  saving: boolean;
  onSave: () => void;
};

export default function TabPreferencias({ empresa: e, set, saving, onSave }: Props) {
  const pref = e.preferencias;
  const pr = (p: Partial<EmpresaConfig['preferencias']>) => set({ preferencias: { ...pref, ...p } });
  const setNum = (key: keyof EmpresaConfig['preferencias']['numeracao'], value: string) =>
    pr({ numeracao: { ...pref.numeracao, [key]: value } });
  const notif = (k: string, v: boolean) => set({ notificacoes: { ...e.notificacoes, [k]: v } });

  // Preview ao vivo com os valores selecionados (antes mesmo de salvar).
  const locale = LOCALE_BY_IDIOMA[e.idioma];
  const dateStyle = pref.formato_data === 'auto' ? 'medium' : pref.formato_data;
  const agora = new Date();

  const grupos = Array.from(new Set(NOTIF_ITEMS.map((n) => n.grupo)));

  return (
    <div className="space-y-5">
      <Section title="Idioma, moeda e fuso" desc="Aplicam-se a todo o painel: valores, datas e números seguem estas escolhas.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Idioma">
            <select className={inp} value={e.idioma} onChange={(ev) => set({ idioma: ev.target.value as Idioma })}>
              {IDIOMAS.map((i) => <option key={i.v} value={i.v}>{i.bandeira} {i.label}</option>)}
            </select>
          </Campo>
          <Campo label="Moeda" hint={`Sugestão para o idioma: ${MOEDA_BY_IDIOMA[e.idioma]}`}>
            <select className={inp} value={e.moeda} onChange={(ev) => set({ moeda: ev.target.value as EmpresaConfig['moeda'] })}>
              {MOEDAS.map((m) => <option key={m.v} value={m.v}>{m.simbolo} {m.label}</option>)}
            </select>
          </Campo>
          <Campo label="Fuso horário">
            <select className={inp} value={e.fuso} onChange={(ev) => set({ fuso: ev.target.value })}>
              {FUSOS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </Campo>
          <Campo label="Formato de data">
            <select className={inp} value={pref.formato_data} onChange={(ev) => pr({ formato_data: ev.target.value as FormatoData })}>
              {FORMATOS_DATA.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}
            </select>
          </Campo>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl bg-black/[0.03] p-4 text-sm sm:grid-cols-3">
          <Preview rotulo="Valor" valor={formatMoney(2200, { locale, currency: e.moeda })} />
          <Preview rotulo="Data" valor={formatDate(agora, { locale, style: dateStyle })} />
          <Preview rotulo="Data + hora (fuso)" valor={formatDateTime(agora, { locale, timeZone: e.fuso })} />
        </div>
      </Section>

      <Section title="Agenda & documentos">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Primeira hora da agenda" hint="Início padrão exibido no calendário.">
            <input type="time" className={inp} value={pref.primeira_hora} onChange={(ev) => pr({ primeira_hora: ev.target.value })} />
          </Campo>
        </div>

        <div className="mt-4 text-sm font-semibold text-ink-soft">Numeração de documentos</div>
        <div className="mt-2 space-y-3">
          {([
            ['Propostas', 'proposta_prefixo', 'proposta_proximo'],
            ['Contratos', 'contrato_prefixo', 'contrato_proximo'],
            ['Notas', 'nota_prefixo', 'nota_proximo'],
          ] as const).map(([label, kPref, kProx]) => (
            <div key={label} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[120px_1fr_1fr]">
              <div className="text-sm font-medium text-ink-soft">{label}</div>
              <Campo label="Prefixo">
                <input className={inp} value={pref.numeracao[kPref]} onChange={(ev) => setNum(kPref, ev.target.value)} />
              </Campo>
              <Campo label="Próximo número">
                <input className={inp} type="number" min={1} value={pref.numeracao[kProx]} onChange={(ev) => setNum(kProx, ev.target.value)} />
              </Campo>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-ink-muted">
          Próxima proposta: <strong>{pref.numeracao.proposta_prefixo}{pref.numeracao.proposta_proximo}</strong>
        </p>
      </Section>

      <Section title="Templates padrão" desc="Texto base reutilizado ao gerar propostas e contratos.">
        <div className="grid grid-cols-1 gap-4">
          <Campo label="Template de proposta">
            <textarea className={`${inp} min-h-[90px]`} value={pref.template_proposta} onChange={(ev) => pr({ template_proposta: ev.target.value })} placeholder="Olá {{cliente}}, segue a proposta para {{evento}}…" />
          </Campo>
          <Campo label="Template de contrato">
            <textarea className={`${inp} min-h-[90px]`} value={pref.template_contrato} onChange={(ev) => pr({ template_contrato: ev.target.value })} placeholder="Cláusulas padrão do contrato…" />
          </Campo>
        </div>
      </Section>

      <Section title="Notificações" desc="Escolha o que deseja receber.">
        <div className="space-y-4">
          {grupos.map((g) => (
            <div key={g}>
              <div className="mb-2 text-xs font-bold uppercase tracking-wide text-ink-muted">{g}</div>
              <div className="space-y-2">
                {NOTIF_ITEMS.filter((n) => n.grupo === g).map((n) => (
                  <Toggle key={n.k} label={n.label} checked={!!e.notificacoes[n.k]} onChange={(v) => notif(n.k, v)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

function Preview({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <div className="text-xs text-ink-muted">{rotulo}</div>
      <div className="mt-0.5 font-bold text-ink">{valor}</div>
    </div>
  );
}

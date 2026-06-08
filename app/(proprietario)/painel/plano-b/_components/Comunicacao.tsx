'use client';

// Aba "Comunicação" — gera o comunicado para avisar cliente / equipe / público
// quando o plano B muda (chuva, remarcação, área alternativa). Renderiza o modelo
// do plano com as variáveis do evento, deixa editar e enviar por WhatsApp, e-mail
// ou copiar. Referencia a política de remarcação do Contrato. Sem "R$" hardcoded.

import { useEffect, useMemo, useState } from 'react';
import { formatDate } from '@/lib/format';
import { useToast } from '@/components/Toast';
import {
  type PlanoBBag, type Plano,
  AUDIENCIAS, riscoMeta, nivelMeta, avaliarPlano, renderComunicado, comunicadoSeed, eventoLabel,
} from '../_lib';
import {
  EmptyState, Chip,
  IcoMegafone, IcoCopy, IcoWhats, IcoSend, IcoLink, IcoCloud, IcoAlert,
  btnPrimary, btnSecondary,
} from './ui';

export default function Comunicacao({ bag, onIrPlanos }: { bag: PlanoBBag; onIrPlanos: () => void }) {
  const toast = useToast();
  const { planos, resumo, evento } = bag;

  const ativos = useMemo(() => planos.filter((p) => p.status !== 'descartado'), [planos]);
  const [planoId, setPlanoId] = useState<string>(() => ativos[0]?.id || '');
  const [audiencia, setAudiencia] = useState<string>('cliente');
  const plano = useMemo<Plano | null>(() => ativos.find((p) => p.id === planoId) || null, [ativos, planoId]);

  const vars = useMemo(() => {
    const av = plano ? avaliarPlano(plano, resumo) : null;
    return {
      evento: eventoLabel(evento),
      data: evento.data_inicio ? formatDate(evento.data_inicio, { style: 'long' }) : 'a definir',
      local: bag.meta.local || bag.propriedade?.cidade || 'o local do evento',
      empresa: bag.empresa || 'nossa equipe',
      contato: bag.empresa || 'nossa equipe',
      acao: plano?.acao || 'acionar o plano de contingência',
      risco: plano ? riscoMeta(plano.tipo_risco).label : '',
      nivel: av ? nivelMeta(av.nivel).label : '',
    };
  }, [plano, resumo, evento, bag.meta.local, bag.propriedade, bag.empresa]);

  const baseTemplate = plano?.comunicado_template || (plano ? comunicadoSeed(plano.tipo_risco) : '');
  const [texto, setTexto] = useState('');
  // Recompõe o texto ao trocar de plano/variáveis (mantém edição manual entre toggles de audiência).
  useEffect(() => { setTexto(renderComunicado(baseTemplate, vars)); }, [baseTemplate, vars]);

  const destinoTel = audiencia === 'cliente' ? (evento.telefones?.find(Boolean) || '') : '';
  const destinoEmail = audiencia === 'cliente' ? (evento.email || '') : '';

  const copiar = async () => {
    try { await navigator.clipboard.writeText(texto); toast.success('Comunicado copiado.'); }
    catch { toast.error('Não foi possível copiar.'); }
  };
  const whatsapp = () => {
    const tel = destinoTel.replace(/\D/g, '');
    const url = `https://wa.me/${tel}?text=${encodeURIComponent(texto)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };
  const email = () => {
    const assunto = `Atualização do evento ${vars.evento}`;
    const url = `mailto:${destinoEmail}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
    window.location.href = url;
  };

  if (ativos.length === 0) {
    return (
      <EmptyState icon={<IcoMegafone />} title="Sem planos para comunicar"
        cta={<button onClick={onIrPlanos} className={btnPrimary}><IcoCloud /> Ir para Gatilhos & Planos</button>}>
        Os comunicados vêm do modelo de cada plano de contingência. Crie um plano em <strong>Gatilhos & Planos</strong> para gerar o aviso de mudança ao cliente, equipe e público.
      </EmptyState>
    );
  }

  return (
    <div className="space-y-4">
      {/* Seletores: plano + audiência */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Plano</span>
          <select value={planoId} onChange={(e) => setPlanoId(e.target.value)} className="w-full rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none">
            {ativos.map((p) => <option key={p.id} value={p.id}>{riscoMeta(p.tipo_risco).label}{p.acao ? ` — ${p.acao.slice(0, 40)}` : ''}</option>)}
          </select>
        </label>
        <div>
          <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Para quem</span>
          <div className="flex flex-wrap gap-1.5">
            {AUDIENCIAS.map((a) => (
              <button key={a.v} onClick={() => setAudiencia(a.v)}
                className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${audiencia === a.v ? 'border-brand bg-brand text-white' : 'border-black/10 bg-white text-ink-soft hover:bg-black/[0.03]'}`}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Risco atual do plano selecionado */}
      {plano && (() => {
        const av = avaliarPlano(plano, resumo);
        const nm = nivelMeta(av.nivel);
        return (
          <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${nm.ring}`}>
            <span className={`h-2.5 w-2.5 rounded-full ${nm.dot}`} />
            <span className="font-semibold text-ink-soft">{riscoMeta(plano.tipo_risco).label}: {nm.label}</span>
            {plano.status === 'acionado' && <Chip className="bg-red-50 text-red-700"><IcoAlert /> Plano B acionado</Chip>}
          </div>
        );
      })()}

      {/* Editor do comunicado */}
      <div>
        <span className="mb-1.5 block text-sm font-semibold text-ink-soft">Mensagem</span>
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6}
          className="w-full rounded-xl border border-black/10 px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
        <p className="mt-1 text-[0.7rem] text-ink-muted">Gerado do modelo do plano com os dados do evento. Edite à vontade antes de enviar.</p>
      </div>

      {/* Ações de envio */}
      <div className="flex flex-wrap gap-2">
        <button onClick={copiar} className={btnSecondary}><IcoCopy /> Copiar</button>
        <button onClick={whatsapp} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600">
          <IcoWhats /> WhatsApp{audiencia === 'cliente' && destinoTel ? '' : ''}
        </button>
        <button onClick={email} disabled={audiencia === 'cliente' && !destinoEmail} className={btnSecondary}>
          <IcoSend /> E-mail{audiencia === 'cliente' && destinoEmail ? ` (${destinoEmail})` : ''}
        </button>
      </div>

      {/* Política de remarcação (liga com Contratos) */}
      <div className="rounded-2xl border border-black/[0.06] bg-black/[0.015] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-ink"><IcoLink /> Política de remarcação</h3>
        <p className="mt-1 text-sm text-ink-muted">
          Ao acionar a remarcação ou redução do evento por clima, siga as regras do contrato (multas, prazos, reagendamento). Consulte ou anexe o comunicado ao contrato do evento.
        </p>
        <a href="/painel/contratos" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-600">Abrir Contratos →</a>
      </div>
    </div>
  );
}

'use client';

// Aba Empresa — identidade, contatos, endereço e marca (logo + cores usadas em
// propostas/contratos/portal). Edita o objeto `empresa` do shell; persiste via onSave.

import Link from 'next/link';
import { Section, Campo, ColorField, SaveBar, inp } from './ui';
import { maskCNPJ, maskTelefone, maskCEP, normalizeInstagram } from '@/lib/masks';
import type { EmpresaConfig } from '../_lib';

type Props = {
  empresa: EmpresaConfig;
  set: (patch: Partial<EmpresaConfig>) => void;
  saving: boolean;
  onSave: () => void;
  espacosCount: number;
};

export default function TabEmpresa({ empresa: e, set, saving, onSave, espacosCount }: Props) {
  const endr = (p: Partial<EmpresaConfig['endereco']>) => set({ endereco: { ...e.endereco, ...p } });
  const cont = (p: Partial<EmpresaConfig['contatos']>) => set({ contatos: { ...e.contatos, ...p } });
  const cor = (p: Partial<EmpresaConfig['cores_marca']>) => set({ cores_marca: { ...e.cores_marca, ...p } });

  return (
    <div className="space-y-5">
      <Section title="Identidade" desc="Dados cadastrais da empresa que aparecem em documentos e no portal.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="Razão social" full>
            <input className={inp} value={e.razao_social} onChange={(ev) => set({ razao_social: ev.target.value })} />
          </Campo>
          <Campo label="Nome fantasia">
            <input className={inp} value={e.fantasia} onChange={(ev) => set({ fantasia: ev.target.value })} />
          </Campo>
          <Campo label="CNPJ">
            <input className={inp} value={e.cnpj} onChange={(ev) => set({ cnpj: maskCNPJ(ev.target.value) })} placeholder="00.000.000/0000-00" />
          </Campo>
          <Campo label="Inscrição estadual">
            <input className={inp} value={e.ie} onChange={(ev) => set({ ie: ev.target.value })} />
          </Campo>
          <Campo label="Inscrição municipal">
            <input className={inp} value={e.im} onChange={(ev) => set({ im: ev.target.value })} />
          </Campo>
        </div>
      </Section>

      <Section title="Contatos" desc="Canais públicos exibidos para clientes.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Campo label="E-mail">
            <input className={inp} type="email" value={e.contatos.email} onChange={(ev) => cont({ email: ev.target.value })} />
          </Campo>
          <Campo label="Telefone">
            <input className={inp} value={e.contatos.telefone} onChange={(ev) => cont({ telefone: maskTelefone(ev.target.value) })} />
          </Campo>
          <Campo label="WhatsApp">
            <input className={inp} value={e.contatos.whatsapp} onChange={(ev) => cont({ whatsapp: maskTelefone(ev.target.value) })} />
          </Campo>
          <Campo label="Site">
            <input className={inp} value={e.contatos.site} onChange={(ev) => cont({ site: ev.target.value })} placeholder="https://" />
          </Campo>
          <Campo label="Instagram" full>
            <input className={inp} value={e.contatos.instagram} onChange={(ev) => cont({ instagram: ev.target.value })} onBlur={(ev) => cont({ instagram: normalizeInstagram(ev.target.value) })} placeholder="@seuespaco" />
          </Campo>
        </div>
      </Section>

      <Section title="Endereço">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-6">
          <div className="sm:col-span-2"><Campo label="CEP"><input className={inp} value={e.endereco.cep} onChange={(ev) => endr({ cep: maskCEP(ev.target.value) })} /></Campo></div>
          <div className="sm:col-span-3"><Campo label="Rua / Logradouro"><input className={inp} value={e.endereco.rua} onChange={(ev) => endr({ rua: ev.target.value })} /></Campo></div>
          <div className="sm:col-span-1"><Campo label="Número"><input className={inp} value={e.endereco.numero} onChange={(ev) => endr({ numero: ev.target.value })} /></Campo></div>
          <div className="sm:col-span-3"><Campo label="Complemento"><input className={inp} value={e.endereco.complemento} onChange={(ev) => endr({ complemento: ev.target.value })} /></Campo></div>
          <div className="sm:col-span-3"><Campo label="Bairro"><input className={inp} value={e.endereco.bairro} onChange={(ev) => endr({ bairro: ev.target.value })} /></Campo></div>
          <div className="sm:col-span-4"><Campo label="Cidade"><input className={inp} value={e.endereco.cidade} onChange={(ev) => endr({ cidade: ev.target.value })} /></Campo></div>
          <div className="sm:col-span-2"><Campo label="Estado (UF)"><input className={inp} maxLength={2} value={e.endereco.estado} onChange={(ev) => endr({ estado: ev.target.value.toUpperCase() })} /></Campo></div>
        </div>
      </Section>

      <Section title="Marca" desc="Logo e cores aplicadas em propostas, contratos e no seu portal público.">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-4">
            <Campo label="URL do logo" hint="Cole o link de uma imagem (PNG/SVG com fundo transparente fica melhor).">
              <input className={inp} value={e.logo_url} onChange={(ev) => set({ logo_url: ev.target.value })} placeholder="https://…/logo.png" />
            </Campo>
            <ColorField label="Cor primária (marca)" value={e.cores_marca.primaria} onChange={(v) => cor({ primaria: v })} />
            <ColorField label="Cor secundária" value={e.cores_marca.secundaria} onChange={(v) => cor({ secundaria: v })} />
            <ColorField label="Cor do texto" value={e.cores_marca.texto} onChange={(v) => cor({ texto: v })} />
          </div>
          {/* Preview */}
          <div className="rounded-2xl border border-black/[0.06] p-5" style={{ background: '#fff' }}>
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Pré-visualização</div>
            <div className="mt-3 flex items-center gap-3">
              {e.logo_url
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={e.logo_url} alt="Logo" className="h-12 w-12 rounded-lg object-contain" />
                : <div className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white" style={{ background: e.cores_marca.primaria }}>{(e.fantasia || e.razao_social || 'V')[0]?.toUpperCase()}</div>}
              <div>
                <div className="font-bold" style={{ color: e.cores_marca.texto }}>{e.fantasia || e.razao_social || 'Sua empresa'}</div>
                <div className="text-xs text-ink-muted">{e.contatos.site || 'seusite.com'}</div>
              </div>
            </div>
            <button type="button" className="mt-4 rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: e.cores_marca.primaria }}>
              Botão de ação
            </button>
            <div className="mt-3 text-sm" style={{ color: e.cores_marca.secundaria }}>Texto de destaque na cor secundária.</div>
          </div>
        </div>
      </Section>

      <Section
        title="Espaços / Propriedades"
        desc="Gerencie os espaços anunciados em uma página dedicada."
        action={<Link href="/painel/meus-espacos" className="rounded-xl border border-black/10 bg-white px-4 py-2 text-sm font-medium hover:bg-black/[0.03]">Abrir Meus Espaços →</Link>}
      >
        <div className="rounded-xl bg-black/[0.03] px-4 py-3 text-sm text-ink-soft">
          {espacosCount > 0
            ? <>Você tem <strong>{espacosCount}</strong> {espacosCount === 1 ? 'espaço cadastrado' : 'espaços cadastrados'}.</>
            : 'Nenhum espaço cadastrado ainda.'}
        </div>
      </Section>

      <SaveBar saving={saving} onSave={onSave} />
    </div>
  );
}

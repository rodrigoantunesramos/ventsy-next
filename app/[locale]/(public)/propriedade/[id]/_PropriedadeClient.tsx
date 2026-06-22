'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useParams, notFound } from 'next/navigation'
import Image from 'next/image'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase, authHeaders } from '@/lib/supabase'
import ReviewForm from '@/components/client/ReviewForm'
import type { ReviewFormData } from '@/types/client'
import { comodidadeLabel, COMODIDADES } from '@/lib/data'
import { useT } from '@/components/i18n/I18nProvider'
import { formatMoney } from '@/lib/i18n/format'
import { rotuloDado } from '@/lib/i18n/dados'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import type { PropMeta, FotoMeta } from './_data'
import './propriedade.css'

/* ── tipos ── */
interface Foto { url: string; titulo: string; ordem: number; tipo?: string | null; focal_x?: number | null; focal_y?: number | null; alt?: string | null }
interface Avaliacao { id: string; autor: string; avatar: string; data: string; nota: number; texto: string; verificada: boolean; evento_tipo?: string; resposta?: string | null; respondido_em?: string | null }
interface UsuarioPerfil { nome?: string; foto_perfil?: string; criado_em?: string }
interface Video { url: string; titulo: string }

const AVAL_DEMO: Avaliacao[] = [
  { id:'1', autor:'Mariana Silva',   avatar:'https://i.pravatar.cc/150?u=11', data:'Março de 2025',    nota:5, texto:'Espaço incrível! Exatamente como nas fotos. O campo de futebol e a piscina foram um sucesso com os convidados. Super recomendo!', verificada:true, evento_tipo:'Aniversário' },
  { id:'2', autor:'Ricardo Souza',   avatar:'https://i.pravatar.cc/150?u=12', data:'Fevereiro de 2025', nota:5, texto:'Excelente para confraternização corporativa. Ótima estrutura e o proprietário foi super atencioso com todas as nossas demandas.', verificada:true, evento_tipo:'Corporativo' },
  { id:'3', autor:'Fernanda Lima',   avatar:'https://i.pravatar.cc/150?u=13', data:'Janeiro de 2025',  nota:4, texto:'Lugar lindo, espaço perfeito para o nosso casamento. Único ponto foi o acesso um pouco complicado à noite, mas no geral valeu cada centavo.', verificada:true, evento_tipo:'Casamento' },
  { id:'4', autor:'Carlos Henrique', avatar:'https://i.pravatar.cc/150?u=14', data:'Dezembro de 2024', nota:5, texto:'Churrasqueira completa, piscina limpa, campo bem cuidado. Família toda amou. Com certeza vou repetir no próximo ano!', verificada:true, evento_tipo:'Aniversário' },
  { id:'5', autor:'Ana Beatriz',     avatar:'https://i.pravatar.cc/150?u=15', data:'Novembro de 2024', nota:5, texto:'Contratei para aniversário de 15 anos da minha filha. Tudo perfeito, muito espaço verde, o local é lindo.', verificada:true, evento_tipo:'Aniversário' },
  { id:'6', autor:'Pedro Costa',     avatar:'https://i.pravatar.cc/150?u=16', data:'Outubro de 2024',  nota:4, texto:'Ótima opção para eventos grandes. Boa infraestrutura e proprietário bem comunicativo.', verificada:true, evento_tipo:'Corporativo' },
]

const TIPOS_EVENTO = ['Casamento','Aniversário','Festa Infantil','Debutante','Formatura','Confraternização','Corporativo','Workshop','Show / Festival','Batizado','Encontro Religioso','Provas Hípicas','Pescaria','Radical','Outro']

function parseArray(val: unknown): string[] {
  if (Array.isArray(val)) return val
  if (!val) return []
  if (typeof val === 'string') {
    if (val.startsWith('{')) return val.slice(1,-1).split(',').map(s=>s.trim().replace(/^"|"$/g,'')).filter(Boolean)
    try { return JSON.parse(val) } catch(_) {}
  }
  return []
}

function mascaraTel(v:string) {
  const d = v.replace(/\D/g,'').slice(0,11)
  if (d.length<=2) return d.length?'('+d:''
  if (d.length<=7) return `(${d.slice(0,2)}) ${d.slice(2)}`
  if (d.length<=10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

function FaqItem({pergunta,resposta}:{pergunta:string;resposta:string}) {
  const [open,setOpen]=useState(false)
  return (
    <div className={`pp-faq-item${open?' pp-faq-open':''}`}>
      <button className="pp-faq-pergunta" onClick={()=>setOpen(!open)}>
        {pergunta}<span className="pp-faq-icon">+</span>
      </button>
      <div className="pp-faq-resposta"><p>{resposta}</p></div>
    </div>
  )
}

// next/image só para fotos do nosso bucket (Supabase) ou picsum (demo). URLs
// legadas hotlinkadas (Google/Facebook de propriedades de teste) seguem em <img>
// normal para não quebrar a página com erro de hostname do next/image.
function fotoOtimizavel(url?: string | null) {
  if (!url) return false
  try { const h = new URL(url).hostname; return h.endsWith('.supabase.co') || h.endsWith('picsum.photos') }
  catch { return false }
}

function FotoEspaco({ url, alt, focal_x, focal_y, sizes, priority = false, className = '' }: {
  url: string; alt: string; focal_x?: number | null; focal_y?: number | null; sizes: string; priority?: boolean; className?: string
}) {
  const objectPosition = `${focal_x ?? 50}% ${focal_y ?? 50}%`
  if (fotoOtimizavel(url)) {
    return <Image src={url} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`.trim()} style={{ objectPosition }} />
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} loading={priority ? undefined : 'lazy'} className={`w-full h-full object-cover ${className}`.trim()} style={{ objectPosition }} />
}

function PropriedadeContent({ initialProp, initialFotos }: { initialProp: PropMeta | null; initialFotos: FotoMeta[] }) {
  const params = useParams()
  const propId    = params.id as string
  const propIdNum = Number(propId)
  const { dict, lhref, locale } = useT()
  const t = dict.propriedade
  // Rótulo traduzido de um tipo de evento (valor salvo em PT). Fallback: o próprio valor.
  const tipoEventoLabel = (v: string) => (t.tiposEvento as Record<string, string>)[v] || v
  // Comodidade exibida: preserva o emoji canônico (de lib/data) e traduz só o texto
  // via dict.dados.comodidades (chave = slug). Valores legados/demo (string com emoji,
  // sem slug correspondente) caem no rótulo cru de comodidadeLabel.
  const comodidadeLabelI18n = (c: string) => {
    const item = COMODIDADES.find(x => x.slug === c)
    return item ? `${item.emoji} ${rotuloDado(dict.dados.comodidades, item.slug)}` : comodidadeLabel(c)
  }

  // Semeia o estado com o que veio do servidor (initialProp/initialFotos) para o
  // herói/galeria renderizarem já no HTML — o useEffect re-busca e enriquece.
  const [prop,setProp]         = useState<any>(initialProp ?? null)
  const [fotos,setFotos]       = useState<Foto[]>(
    initialFotos.length
      ? initialFotos
      : initialProp?.imagem_url
        ? [{ url: initialProp.imagem_url, titulo: '', ordem: 0, tipo: null, focal_x: null, focal_y: null, alt: null }]
        : []
  )
  const [videos,setVideos]     = useState<Video[]>([])
  const [avaliacoes,setAval]   = useState<Avaliacao[]>([])
  const [plano,setPlano]       = useState<'basico'|'pro'|'ultra'>('basico')
  const [loading,setLoading]   = useState(!initialProp)
  const [naoEncontrado,setNaoEncontrado] = useState(false)
  const [anfNome,setAnfNome]   = useState('—')
  const [anfTempo,setAnfTempo] = useState('—')
  const [anfAv,setAnfAv]       = useState('')
  const [modalGal,setModalGal] = useState(false)
  const [modalVid,setModalVid] = useState(false)
  const [lbFotos,setLbFotos]   = useState<string[]>([])
  const [lbIdx,setLbIdx]       = useState(0)
  const [lbOpen,setLbOpen]     = useState(false)
  const [shareOpen,setShareOpen]       = useState(false)
  const [linkCopiado,setLinkCopiado]   = useState(false)
  const [fav,setFav]                   = useState(false)
  const [avalFiltro,setAvalFiltro]     = useState('todas')
  const [avalVis,setAvalVis]           = useState(4)
  const [reviewModal,setReviewModal]   = useState(false)
  const [clientUserId,setClientUserId] = useState('')
  const [clientNome,setClientNome]     = useState('')
  const [jaAvaliou,setJaAvaliou]       = useState(false)
  const [reviewToast,setReviewToast]   = useState('')
  const [enviandoReserva,setEnviandoReserva] = useState(false)
  const [reservaToast,setReservaToast] = useState('')
  const [sobreExp,setSobreExp] = useState(false)
  const [formNome,setFormNome] = useState('')
  const [formTel,setFormTel]   = useState('')
  const [formEmail,setFormEmail] = useState('')
  const [formTipo,setFormTipo] = useState('')
  const [formModo,setFormModo] = useState<'hora'|'diaria'>()
  const [formHoras,setFormHoras] = useState(2)
  const [formInicio,setFormInicio] = useState('')
  const [formFim,setFormFim]   = useState('')
  const [formPessoas,setFormPessoas] = useState(50)
  const [formErros,setFormErros] = useState<Record<string,boolean>>({})
  const wppRef = useRef('')

 useEffect(() => {
  const loadDemo = () => {
    setPlano('ultra')
    setProp({
      id:'demo',
      nome:'Chácara Macacu — Sítio para Eventos',
      descricao:`Se você procura natureza, conforto e estrutura completa para celebrar o seu grande dia, acabou de encontrar o lugar perfeito!\n\nA chácara está localizada em Cachoeiras de Macacu, cercada pelo verde, com clima tranquilo e ao mesmo tempo preparada para receber eventos inesquecíveis.\n\nDestaques do espaço: Campo de futebol com grama tapete. Piscina + Chuveirão. Área de churrasqueira completa. Lareira a céu aberto para noites especiais.`,
      capacidade:'1.000',
      tipo_propriedade:'Sítio',
      cidade:'Cachoeiras de Macacu',
      estado:'RJ',
      valor_base:3000,
      valor_hora:500,
      avaliacao:4.9,
      comodidades:['📶 Wi-Fi rápido','🚗 Estacionamento gratuito','🔥 Churrasqueira','🏊 Piscina','⚽ Campo de futebol','🌳 Área verde'],
      whatsapp:'5521999999999',
      faq:[
        {pergunta:'Como funciona o processo de reserva?',resposta:'Entre em contato pelo WhatsApp ou preencha o formulário ao lado. O proprietário responderá para confirmar disponibilidade.'},
        {pergunta:'O espaço aceita pets?',resposta:'Consulte o proprietário diretamente, pois a política varia conforme o evento e o porte do animal.'}
      ]
    })

    setFotos(Array.from({length:5},(_,i)=>({
      url:`https://picsum.photos/seed/chacara${i+1}/800/600`,
      titulo:['Vista principal','Área da piscina','Churrasqueira','Campo de futebol','Lareira'][i],
      ordem:i
    })))

    setVideos([{url:'',titulo:'Tour completo da Chácara'}])
    setAval(AVAL_DEMO)
    setAnfNome('Rodrigo Ramos')
    setAnfTempo('2 anos')
    wppRef.current='5521999999999'
    setLoading(false)
  }

  const withTimeout = <T,>(promise: PromiseLike<T>, ms: number): Promise<T> =>
    Promise.race([Promise.resolve(promise), new Promise<T>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

  const load = async () => {
    try {
      if (!propId || propId === 'demo') {
        loadDemo()
        return
      }

      // Reusa a propriedade já trazida pelo SSR (initialProp = select '*'); só
      // re-busca se ela não veio. Corta uma query e um round-trip serial.
      const p: any =
        initialProp && propId !== 'demo'
          ? initialProp
          : (await withTimeout(
              supabase.from('propriedades').select('*').eq('id', propIdNum).single(),
              8000,
            )).data

      if (!p) {
        if (!initialProp) setNaoEncontrado(true)
        setLoading(false)
        return
      }

      // Fotos + enriquecimento em PARALELO (antes eram awaits sequenciais). Cada
      // item tem .catch próprio — uma falha isolada não derruba os demais.
      const [fts, planoRes, vids, avals, usr] = await withTimeout(Promise.all([
        supabase.from('fotos_imovel').select('*').eq('propriedade_id', propIdNum).order('ordem', { ascending: true })
          .then((r: any) => r.data || [], () => [] as any[]),

        fetch(`/api/planos?usuario_id=${encodeURIComponent(p.usuario_id || '')}`).then(r => r.json()).then(j => j.plano || 'basico').catch(() => 'basico'),

        supabase.from('videos_propriedade').select('url,titulo').eq('propriedade_id', propIdNum)
          .then((r: any) => r.data || [], () => [] as any[]),

        supabase.from('avaliacoes').select('*').eq('propriedade_id', propIdNum).eq('verificada', true).eq('oculta', false).order('criado_em', { ascending: false })
          .then((r: any) => r.data || [], () => [] as any[]),

        supabase.from('perfis_publicos').select('id, id_prop, nome, usuario, criado_em').eq(p.usuario_id?.length === 36 ? 'id' : 'id_prop', p.usuario_id || '').single()
          .then((r: any) => r.data, () => null),
      ]), 8000).catch(() => [[], 'basico', [], [], null] as any)

      if (['basico', 'pro', 'ultra'].includes(planoRes)) {
        setPlano(planoRes as 'basico' | 'pro' | 'ultra')
      } else {
        setPlano('basico')
      }
      setProp(p)
      setFotos((fts || []).map((f:any)=>({
        url:f.url,
        titulo:f.secao || '',
        ordem:f.ordem,
        tipo:f.tipo,
        focal_x:f.focal_x,
        focal_y:f.focal_y,
        alt:f.alt,
      })))

      setVideos(vids || [])
      setAval((avals || []) as Avaliacao[])
      wppRef.current = (p.whatsapp || '').replace(/\D/g, '')
      setFav(JSON.parse(localStorage.getItem('ventsy_favs') || '[]').includes(propId))

      if (usr){
        const u = usr as UsuarioPerfil
        setAnfNome(u.nome || '—')
        setAnfAv(u.foto_perfil || '')

        if (u.criado_em){
          const a = Math.floor((Date.now() - new Date(u.criado_em).getTime()) / 31536000000)
          setAnfTempo(a >= 1 ? `${a} ${a > 1 ? t.anfitriao.anoMuitos : t.anfitriao.anoUm}` : t.anfitriao.menosDeUmAno)
        }
      }

      // Tracking de visualização com geolocalização por IP (fire-and-forget)
      fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propriedade_id: propId, evento_tipo: 'view' }),
      }).catch(() => {})

    } catch(e) {
      // Com dados iniciais do servidor (initialProp), um erro de enriquecimento no
      // cliente NÃO pode derrubar a página: mantém o que veio do SSR. Sem eles,
      // mostra demo (dev) ou "não encontrado" (prod) — nunca a demo em produção.
      if (initialProp) { /* mantém a tela já renderizada com os dados do servidor */ }
      else if (process.env.NODE_ENV !== 'production') loadDemo()
      else setNaoEncontrado(true)
    } finally {
      setLoading(false)
    }
  }

  load()
}, [propId])

  // ── Verificar sessão do cliente ─────────────────────────────────────────
  useEffect(()=>{
    (async()=>{
      const { data: { session } } = await supabase.auth.getSession()
      if(!session) return
      setClientUserId(session.user.id)
      // Buscar nome
      try{
        const { data: u } = await supabase.from('usuarios').select('nome').eq('id',session.user.id).single()
        if(u?.nome) setClientNome(u.nome)
        else setClientNome(session.user.email ?? '')
      }catch{ setClientNome(session.user.email ?? '') }
    })()
  },[])

  // ── Verificar se já avaliou esta propriedade ─────────────────────────────
  // Restaura o rascunho do formulário de reserva após o login (A2).
  useEffect(()=>{
    if(!propId || propId==='demo') return
    try{
      const raw=sessionStorage.getItem(`ventsy_lead_${propId}`)
      if(!raw)return
      const d=JSON.parse(raw)
      if(d.formNome!=null)setFormNome(d.formNome)
      if(d.formTel!=null)setFormTel(d.formTel)
      if(d.formEmail!=null)setFormEmail(d.formEmail)
      if(d.formTipo!=null)setFormTipo(d.formTipo)
      if(d.formModo!=null)setFormModo(d.formModo)
      if(d.formHoras!=null)setFormHoras(d.formHoras)
      if(d.formInicio!=null)setFormInicio(d.formInicio)
      if(d.formFim!=null)setFormFim(d.formFim)
      if(d.formPessoas!=null)setFormPessoas(d.formPessoas)
      sessionStorage.removeItem(`ventsy_lead_${propId}`)
    }catch{}
  },[propId])

  useEffect(()=>{
    if(!clientUserId || !propId || propId==='demo') return
    supabase.from('avaliacoes').select('id').eq('user_id',clientUserId).eq('propriedade_id',Number(propId)).maybeSingle()
      .then(({ data })=>{ if(data) setJaAvaliou(true) })
  },[clientUserId,propId])

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(lbOpen){if(e.key==='Escape')setLbOpen(false);if(e.key==='ArrowLeft')setLbIdx(i=>(i-1+lbFotos.length)%lbFotos.length);if(e.key==='ArrowRight')setLbIdx(i=>(i+1)%lbFotos.length)}
      else if(e.key==='Escape'){setModalGal(false);setModalVid(false)}
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[lbOpen,lbFotos.length])

  useEffect(()=>{document.body.style.overflow=(lbOpen||modalGal||modalVid)?'hidden':'';return()=>{document.body.style.overflow=''}},[lbOpen,modalGal,modalVid])

  // Focus trap dos modais (a11y de diálogo). Quando o lightbox abre sobre a
  // galeria, só o lightbox (que está por cima) prende o foco.
  const modalGalRef = useRef<HTMLDivElement>(null)
  const modalVidRef = useRef<HTMLDivElement>(null)
  const lbRef       = useRef<HTMLDivElement>(null)
  useFocusTrap(modalGalRef, modalGal && !lbOpen)
  useFocusTrap(modalVidRef, modalVid)
  useFocusTrap(lbRef, lbOpen)

  const abrirLb=(urls:string[],i:number)=>{setLbFotos(urls);setLbIdx(i);setLbOpen(true)}
  const toggleFav=()=>{if(!prop?.id)return;const f:string[]=JSON.parse(localStorage.getItem('ventsy_favs')||'[]');const i=f.indexOf(prop.id);if(i>=0)f.splice(i,1);else f.push(prop.id);localStorage.setItem('ventsy_favs',JSON.stringify(f));setFav(i<0)}
  const copiarLink=()=>{navigator.clipboard.writeText(window.location.href);setLinkCopiado(true);setTimeout(()=>setLinkCopiado(false),2000)}
  // Atalho da barra mobile: rola até o card de reserva e foca o primeiro campo.
  const irParaReserva=()=>{const el=document.getElementById('pp-reserva');if(!el)return;el.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>{(el.querySelector('.pp-form input') as HTMLInputElement|null)?.focus()},450)}

  const avalFil=(()=>{const b=avaliacoes;if(avalFiltro==='5')return b.filter(a=>a.nota===5);if(avalFiltro==='4')return b.filter(a=>a.nota===4);if(avalFiltro==='3')return b.filter(a=>a.nota<=3);if(avalFiltro==='verificados')return b.filter(a=>a.verificada);return b})()
  const linhas=(prop?.descricao||'').split('\n').filter((l:string)=>l.trim())
  const sobrePreview=linhas.slice(0,3); const sobreResto=linhas.slice(3)

  const calcTotal=()=>{const vh=parseFloat(prop?.valor_hora)||0;const vd=parseFloat(prop?.valor_base||prop?.preco)||0;if(formModo==='hora')return vh*Math.max(1,formHoras);if(formModo==='diaria'&&formInicio&&formFim){const d=Math.max(0,Math.round((new Date(formFim).getTime()-new Date(formInicio).getTime())/86400000));return vd*Math.max(1,d)}return vd||vh}
  const total=calcTotal()
  // Captura de lead funciona com ou sem preço cadastrado: boa parte do catálogo
  // ainda não tem valor. Sem preço, o "modo de cobrança" deixa de ser obrigatório.
  const temPreco=Number(prop?.valor_hora)>0||Number(prop?.valor_base)>0
  const formValido=formNome.trim().length>=3&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formEmail)&&formTel.replace(/\D/g,'').length===11&&!!formTipo&&(!temPreco||!!formModo)

  const irWppDireto=async()=>{const msg=t.whatsapp.msgDireto.replace('{nome}',prop?.nome||t.whatsapp.nomePadrao);fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({propriedade_id:prop?.id,evento_tipo:'whatsapp'})}).catch(()=>{});window.open(`https://wa.me/${wppRef.current}?text=${encodeURIComponent(msg)}`,'_blank')}

  const enviarWpp=async()=>{
    if(!formValido){const e:Record<string,boolean>={};if(formNome.trim().length<3)e.nome=true;if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formEmail))e.email=true;if(formTel.replace(/\D/g,'').length!==11)e.tel=true;if(!formTipo)e.tipo=true;if(temPreco&&!formModo)e.modo=true;setFormErros(e);return}
    setFormErros({})
    const fmt=(d:string)=>d?formatMoneyDate(d):t.whatsapp.aCombinar
    let db='';if(formModo==='hora')db=`⏱ *${t.whatsapp.tipoLocacao}* ${t.whatsapp.porHora} (${formHoras}h)`;if(formModo==='diaria')db=`📅 *${t.whatsapp.periodo}* ${fmt(formInicio)} ${t.whatsapp.ate} ${fmt(formFim)}`
    const txt=`${t.whatsapp.saudacao}\n\n📍 *${t.whatsapp.espaco}* ${prop?.nome||t.whatsapp.semDado}\n👤 *${t.whatsapp.nome}* ${formNome}\n📞 *${t.whatsapp.telefone}* ${formTel}\n📧 *${t.whatsapp.email}* ${formEmail}\n🎉 *${t.whatsapp.tipoEvento}* ${tipoEventoLabel(formTipo)}\n${db}\n👥 *${t.whatsapp.convidados}* ${formPessoas} ${t.whatsapp.pessoas}\n💰 *${t.whatsapp.estimativaOrcamento}* ${total>0?formatMoney(locale,total):t.whatsapp.aConsultar}\n\n_${t.whatsapp.enviadoPelo}_`
    fetch('/api/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({propriedade_id:prop?.id,evento_tipo:'formulario'})}).catch(()=>{})
    window.open(`https://wa.me/${wppRef.current}?text=${encodeURIComponent(txt)}`,'_blank')
  }

  // Data por extenso sensível ao locale (ex.: "5 de junho de 2025" / "June 5, 2025").
  const formatMoneyDate=(d:string)=>new Intl.DateTimeFormat(locale==='pt'?'pt-BR':locale==='es'?'es-ES':'en-US',{day:'2-digit',month:'long',year:'numeric'}).format(new Date(d+'T12:00:00'))

  const solicitarReserva=async()=>{
    if(enviandoReserva)return
    if(!clientUserId){
      // Sem login: preserva o que já foi preenchido e leva ao login; ao voltar,
      // o rascunho é restaurado (o caminho via WhatsApp não exige login).
      try{ sessionStorage.setItem(`ventsy_lead_${propId}`, JSON.stringify({formNome,formTel,formEmail,formTipo,formModo,formHoras,formInicio,formFim,formPessoas})) }catch{}
      const back = window.location.pathname + window.location.search
      window.location.href = `${lhref('/login')}?redirect=${encodeURIComponent(back)}`
      return
    }
    if(!formValido){setReservaToast(t.reserva.preenchaCampos);setTimeout(()=>setReservaToast(''),4000);return}
    setEnviandoReserva(true)
    try{
      const dataRef=formInicio||new Date().toISOString().split('T')[0]
      if(dataRef){
        const{data:bloq}=await supabase.from('disponibilidade').select('bloqueado').eq('prop_id',prop?.id).eq('data',dataRef).maybeSingle()
        if(bloq?.bloqueado){setReservaToast(t.reserva.dataIndisponivel);setEnviandoReserva(false);setTimeout(()=>setReservaToast(''),4000);return}
      }
      const{error}=await supabase.from('reservas').insert({
        propriedade_id:prop?.id, usuario_id:clientUserId,
        nome:formNome||clientNome, email:formEmail, telefone:formTel,
        tipo_evento:formTipo, modo:formModo||null,
        data_inicio:formInicio||null, data_fim:formModo==='diaria'?(formFim||null):null,
        horas:formModo==='hora'?formHoras:null, pessoas:formPessoas,
        valor_estimado:total||null, status:'solicitada',
      })
      if(error){setReservaToast(t.reserva.naoFoiPossivel+error.message)}
      else{setReservaToast(t.reserva.solicitada)}
      setTimeout(()=>setReservaToast(''),5000)
    }catch(_){
      setReservaToast(t.reserva.erroGenerico);setTimeout(()=>setReservaToast(''),4000)
    }finally{setEnviandoReserva(false)}
  }

  const nota=prop?.avaliacao||prop?.nota_media
  const comodidades=parseArray(prop?.comodidades)
  const fotosEspaco=fotos.filter(f=>!f.tipo||f.tipo==='espaco')
  const fotosEvento=fotos.filter(f=>f.tipo==='evento')
  const faqItems:any[]=Array.isArray(prop?.faq)?prop.faq:[]
  const hostFoto = prop?.foto_responsavel || anfAv
  const hostNome = prop?.nome_responsavel || anfNome
  const hostBio  = prop?.bio_responsavel || ''
  const custosExtras:any[] = Array.isArray(prop?.custos_extras) ? prop.custos_extras.filter((c:any)=>c?.nome) : []

  if (naoEncontrado) notFound()

  if(loading) return(
    <div className="pp-loading">
      <div className="pp-loading-logo"><em>{t.loading.marca}</em></div>
      <div className="pp-loading-dots"><span/><span/><span/></div>
    </div>
  )

  const WPP_SVG = <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12 0C5.373 0 0 5.373 0 12c0 2.09.544 4.05 1.493 5.754L0 24l6.39-1.648A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.847 0-3.579-.5-5.076-1.373l-.364-.213-3.791.977.993-3.682-.236-.38A9.971 9.971 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>

  return (
    <>
      <Header />
      <div className="pp-page">

        {/* Título */}
        <div className="pp-titulo-wrap">
          <div>
            <h1 className="pp-titulo">{prop?.nome||'—'}</h1>
            <div className="pp-meta">
              {nota&&<span className="pp-nota"><span>★</span> {parseFloat(nota).toFixed(1)}</span>}
              {nota&&<span>•</span>}
              <span>{avaliacoes.length} {t.cabecalho.avaliacoes}</span>
              <span>•</span>
              <span>{[prop?.cidade,prop?.estado].filter(Boolean).join(', ')}</span>
              {plano==='ultra'&&<span className="pp-selo-ultra">{t.cabecalho.seloPremium}</span>}
              {plano==='pro'&&<span className="pp-selo-pro">{t.cabecalho.seloPro}</span>}
            </div>
          </div>
          <div className="pp-acoes relative">
            <button className="pp-btn-acao" onClick={()=>setShareOpen(!shareOpen)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              {t.cabecalho.compartilhar}
            </button>
            {shareOpen&&(
              <div className="pp-share-drop">
                <button onClick={copiarLink}>{linkCopiado?t.cabecalho.linkCopiado:t.cabecalho.copiarLink}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent((prop?.nome||t.cabecalho.espacoFallback)+' — '+window.location.href)}`} target="_blank" rel="noopener noreferrer">{t.cabecalho.compartilharWhatsapp}</a>
                <a href={`mailto:?subject=${encodeURIComponent(prop?.nome||'')}&body=${encodeURIComponent(t.cabecalho.confiraEsteEspaco+' '+window.location.href)}`}>{t.cabecalho.compartilharEmail}</a>
              </div>
            )}
            <button className={`pp-btn-acao${fav?' pp-favoritado':''}`} onClick={toggleFav}>
              <svg width="16" height="16" fill={fav?'currentColor':'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              {fav?t.cabecalho.salvo:t.cabecalho.salvar}
            </button>
          </div>
        </div>

        {/* Galeria */}
        <div className="pp-galeria-wrapper">
          <div className="pp-galeria-grid">
            {fotosEspaco.slice(0,5).map((f,i)=>(
              <div key={i} className={`pp-foto-slot${i===0?' pp-foto-main':''} cursor-pointer relative`} onClick={()=>setModalGal(true)}>
                <FotoEspaco url={f.url} alt={f.alt||f.titulo||`${t.galeria.fotoAlt} ${i+1}`} focal_x={f.focal_x} focal_y={f.focal_y} priority={i===0} sizes={i===0?'(min-width:1024px) 50vw, 100vw':'(min-width:1024px) 25vw, 50vw'} />
                {i===4&&fotosEspaco.length>5&&<div className="pp-foto-overlay">+{fotosEspaco.length-4}</div>}
              </div>
            ))}
          </div>
          <div className="pp-galeria-acoes">
            {prop?.fotos_verificadas&&<span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[.8rem] font-semibold text-emerald-700">{t.galeria.fotosVerificadas}</span>}
            {plano==='ultra'&&videos.length>0&&<button className="pp-btn-galeria" onClick={()=>setModalVid(true)}>{t.galeria.verVideos}</button>}
            {plano!=='basico'&&<button className="pp-btn-galeria" onClick={()=>setModalGal(true)}>⊞ {fotosEspaco.length>5?t.galeria.verTodasN.replace('{n}',String(fotosEspaco.length)):t.galeria.mostrarTodas}</button>}
          </div>
        </div>

        {/* Corpo */}
        <div className="pp-corpo">
          <div className="pp-esquerda">

            {/* Anfitrião */}
            <div className="pp-anfitriao">
              {hostFoto?<img src={hostFoto} alt={hostNome} className="pp-avatar"/>:<div className="pp-avatar-inicial">{hostNome.charAt(0)}</div>}
              <div>
                <h3 className="pp-anf-nome">{hostNome}</h3>
                <p className="pp-anf-sub">{t.anfitriao.proprietario} • {t.anfitriao.naVentsyHa} {anfTempo}</p>
                {hostBio&&<p className="mt-1 text-[.86rem] leading-relaxed text-[#666]">{hostBio}</p>}
              </div>
            </div>

            {/* Detalhes */}
            <div className="pp-detalhes">
              {[{label:t.detalhes.capacidade,valor:prop?.capacidade?`${prop.capacidade} ${t.detalhes.pessoas}`:'—'},{label:t.detalhes.tipoEspaco,valor:prop?.tipo_propriedade?rotuloDado(dict.dados.categorias,prop.tipo_propriedade):'—'},{label:t.detalhes.localizacao,valor:prop?.cidade||'—'}].map(d=>(
                <div key={d.label} className="pp-detalhe-item"><span className="pp-det-label">{d.label}</span><span className="pp-det-valor">{d.valor}</span></div>
              ))}
            </div>

            {/* Sobre */}
            <div className="pp-sobre">
              <h2>{t.sobre.titulo}</h2>
              {sobrePreview.map((l:string,i:number)=><p key={i}>{l}</p>)}
              {sobreResto.length>0&&sobreExp&&sobreResto.map((l:string,i:number)=><p key={i}>{l}</p>)}
              {sobreResto.length>0&&!sobreExp&&<button className="pp-expandir" onClick={()=>setSobreExp(true)}>{t.sobre.lerMais}</button>}
            </div>

            {/* Comodidades */}
            <div className="pp-comodidades"><h2>{t.comodidades.titulo}</h2>
              <div className="pp-como-grid">
                {comodidades.length?comodidades.map((c:string,i:number)=><div key={i} className="pp-comodidade">{comodidadeLabelI18n(c)}</div>):<p className="text-[#aaa] text-[.88rem]">{t.comodidades.naoInformado}</p>}
              </div>
            </div>

            {/* Custos extras */}
            {custosExtras.length>0 && (
              <div className="mb-6">
                <h2 className="text-[1.15rem] font-bold text-[#222] mb-3">{t.custosExtras.titulo}</h2>
                <div className="flex flex-col gap-2">
                  {custosExtras.map((c:any,i:number)=>(
                    <div key={i} className="flex items-center justify-between rounded-xl border border-[#eee] px-4 py-2.5">
                      <span className="text-[.9rem] text-[#333]">{c.nome}</span>
                      <span className="text-[.9rem] font-semibold text-[#222]">{formatMoney(locale,Number(c.valor)||0)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Espaço em eventos */}
            {fotosEvento.length>0 && (
              <div className="mb-6">
                <h2 className="text-[1.15rem] font-bold text-[#222] mb-1">{t.emEventos.titulo}</h2>
                <p className="text-[.86rem] text-[#888] mb-3">{t.emEventos.subtitulo}</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {fotosEvento.slice(0,6).map((f,i)=>(
                    <div key={i} className="relative rounded-xl overflow-hidden cursor-pointer aspect-[4/3] group" onClick={()=>abrirLb(fotosEvento.map(x=>x.url),i)}>
                      <FotoEspaco url={f.url} alt={f.alt||f.titulo||t.galeria.fotoEventoAlt} focal_x={f.focal_x} focal_y={f.focal_y} sizes="(min-width:640px) 33vw, 50vw" className="transition-transform duration-300 group-hover:scale-105" />
                      {f.titulo&&<div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-white text-[.78rem] font-semibold">{f.titulo}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Avaliações */}
            <div className="pp-avaliacoes">
              <div className="pp-aval-header">
                <div className="pp-aval-nota">{nota?parseFloat(nota).toFixed(1):'—'}</div>
                <div>
                  <div className="pp-aval-stars">★★★★★</div>
                  <div className="pp-aval-total">{avaliacoes.length} {t.avaliacoes.verificadas}</div>
                </div>
              </div>

              {/* Botão avaliar — só para clientes logados */}
              {clientUserId && propId !== 'demo' && (
                <div className="my-3">
                  {jaAvaliou ? (
                    <div className="text-[.84rem] text-[#27ae60] bg-[#f0faf5] rounded-[10px] px-[14px] py-2 inline-flex items-center gap-[6px]">
                      {t.avaliacoes.jaAvaliou}
                    </div>
                  ) : (
                    <button
                      onClick={()=>setReviewModal(true)}
                      className="bg-brand hover:bg-brand-600 text-white border-none rounded-[10px] px-[18px] py-[9px] text-[.86rem] font-bold cursor-pointer transition-colors duration-150"
                    >
                      {t.avaliacoes.avaliarEspaco}
                    </button>
                  )}
                </div>
              )}
              {!clientUserId && propId !== 'demo' && (
                <div className="text-[.82rem] text-[#888] mt-2 mb-3 bg-[#fafafa] rounded-[10px] px-[14px] py-2">
                  <a href={lhref('/login')} className="text-[#ff385c] font-semibold no-underline">{t.avaliacoes.facaLogin}</a> {t.avaliacoes.paraAvaliar}
                </div>
              )}

              <div className="pp-aval-filtros">
                {[['todas',t.avaliacoes.filtros.todas],['5','★★★★★'],['4',t.avaliacoes.filtros.quatroOuMais],['3',t.avaliacoes.filtros.tresOuMenos],['verificados',t.avaliacoes.filtros.verificados]].map(([k,l])=>(
                  <button key={k} className={`pp-aval-filtro${avalFiltro===k?' pp-aval-ativo':''}`} onClick={()=>{setAvalFiltro(k);setAvalVis(4)}}>{l}</button>
                ))}
              </div>
              <div className="pp-aval-grid">
                {avalFil.slice(0,avalVis).map(a=>(
                  <div key={a.id} className="pp-aval-card">
                    <div className="pp-aval-autor">
                      <img src={a.avatar||`https://i.pravatar.cc/150?u=${a.id}`} alt={a.autor} loading="lazy"/>
                      <div><strong>{a.autor}{a.verificada&&<span className="pp-badge-ver">{t.avaliacoes.badgeVerificado}</span>}</strong><span>{a.data}{a.evento_tipo?` · ${a.evento_tipo}`:''}</span></div>
                    </div>
                    <div className="text-[var(--ouro)] text-[.88rem] mb-[6px]">{'★'.repeat(a.nota)}{'☆'.repeat(5-a.nota)}</div>
                    <p className="pp-aval-texto">{a.texto}</p>
                    {a.resposta&&(
                      <div className="mt-2.5 rounded-[10px] border-l-2 border-[#ff385c] bg-[#fafafa] px-3 py-2">
                        <div className="text-[.74rem] font-semibold text-[#ff385c] mb-0.5">{t.avaliacoes.respostaAnfitriao}</div>
                        <p className="text-[.84rem] text-[#555] leading-[1.5] m-0">{a.resposta}</p>
                      </div>
                    )}
                  </div>
                ))}
                {!avalFil.length&&(
                  <div className="text-[#bbb] [grid-column:1/-1] text-center py-6">
                    <div className="text-[1.6rem] mb-2">⭐</div>
                    <div className="font-semibold text-[#aaa] mb-1">{t.avaliacoes.vazioTitulo}</div>
                    <div className="text-[.82rem]">{t.avaliacoes.vazioSub}</div>
                  </div>
                )}
              </div>
              {avalFil.length>avalVis&&<button className="pp-btn-ver-mais" onClick={()=>setAvalVis(v=>v+4)}>{t.avaliacoes.mostrarMais}</button>}
            </div>

            {/* Modal de avaliação */}
            {reviewModal && (
              <ReviewForm
                propertyName={prop?.nome}
                onClose={()=>setReviewModal(false)}
                onSubmit={async(form: ReviewFormData)=>{
                  const res = await fetch('/api/avaliacoes',{
                    method:'POST',
                    headers:{'Content-Type':'application/json', ...(await authHeaders())},
                    body:JSON.stringify({
                      propriedade_id: propId,
                      nota:        form.nota,
                      texto:       form.texto,
                      autor:       clientNome || t.avaliacoes.autorFallback,
                      evento_tipo: form.evento_tipo,
                    }),
                  })
                  const json = await res.json()
                  if(json.error){ throw new Error(json.error) }
                  // Adicionar à lista localmente
                  setAval(prev=>[{
                    id:         json.data.id,
                    autor:      clientNome || t.avaliacoes.autorFallback,
                    avatar:     '',
                    data:       new Intl.DateTimeFormat(locale==='pt'?'pt-BR':locale==='es'?'es-ES':'en-US',{month:'long',year:'numeric'}).format(new Date()),
                    nota:       form.nota,
                    texto:      form.texto || '',
                    verificada: true,
                    evento_tipo:form.evento_tipo,
                  },...prev])
                  setJaAvaliou(true)
                  setReviewModal(false)
                  setReviewToast(t.avaliacoes.enviadaSucesso)
                  setTimeout(()=>setReviewToast(''),3500)
                }}
              />
            )}

            {/* Toast avaliação */}
            {reviewToast&&(
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#27ae60] text-white rounded-[10px] px-5 py-[10px] text-[.88rem] font-medium shadow-[0_4px_20px_rgba(0,0,0,.2)] z-[9999]">
                {reviewToast}
              </div>
            )}

            {reservaToast&&(
              <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-[#0d0d0d] text-white rounded-[10px] px-5 py-[10px] text-[.88rem] font-medium shadow-[0_4px_20px_rgba(0,0,0,.2)] z-[9999] max-w-[90vw] text-center">
                {reservaToast}
              </div>
            )}

            {/* Mapa */}
            {prop?.cidade&&(
              <div className="pp-mapa"><h2>{t.mapa.titulo}</h2>
                <p className="pp-mapa-end">{[prop?.cidade,prop?.estado,t.mapa.pais].filter(Boolean).join(', ')}</p>
                <div className="pp-mapa-container">
                  <iframe title={t.mapa.iframeTitulo} width="100%" height="350" className="border-0" loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent([prop?.cidade,prop?.estado,t.mapa.pais].filter(Boolean).join(', '))}&output=embed&hl=${locale==='pt'?'pt-BR':locale}`}/>
                </div>
              </div>
            )}

            {/* FAQ */}
            {faqItems.length>0&&(
              <div className="pp-faq"><h2>{t.faq.titulo}</h2>
                {faqItems.map((f,i)=><FaqItem key={i} pergunta={f.pergunta} resposta={f.resposta}/>)}
              </div>
            )}
          </div>

          {/* Card lateral */}
          <div id="pp-reserva" className="pp-card-lateral-outer scroll-mt-24">
            <div className="pp-card-lateral">
              {/* Sinais de confiança — só com dados reais (nada inventado). */}
              {(nota||anfTempo!=='—'||prop?.fotos_verificadas)&&(
                <div className="pp-confianca">
                  {nota&&<div className="pp-conf-item"><span className="pp-conf-ic" aria-hidden="true">⭐</span><span><strong>{parseFloat(nota).toFixed(1)}</strong> · {avaliacoes.length} {t.avaliacoes.verificadas}</span></div>}
                  {anfTempo!=='—'&&<div className="pp-conf-item"><span className="pp-conf-ic" aria-hidden="true">🛡️</span><span>{t.anfitriao.proprietario} · {t.anfitriao.naVentsyHa} {anfTempo}</span></div>}
                  {prop?.fotos_verificadas&&<div className="pp-conf-item"><span>{t.galeria.fotosVerificadas}</span></div>}
                </div>
              )}
              {plano==='ultra'&&(
                <div className="pp-ultra-banner">
                  <div className="pp-ultra-title">{t.cardLateral.ultraBannerTitulo}</div>
                  <div className="pp-ultra-sub">{t.cardLateral.ultraBannerSub}</div>
                </div>
              )}
              <div className="pp-precos">
                {prop?.valor_hora>0&&<div className="pp-preco-item"><span className="pp-preco-label">{t.cardLateral.porHora}</span><span className="pp-preco-valor">{formatMoney(locale,Number(prop.valor_hora))}<em>{t.cardLateral.porHoraSufixo}</em></span></div>}
                {(prop?.valor_base||prop?.preco)>0&&<div className="pp-preco-item"><span className="pp-preco-label">{t.cardLateral.diaria}</span><span className="pp-preco-valor">{formatMoney(locale,Number(prop?.valor_base||prop?.preco))}</span></div>}
                {!temPreco&&<div className="pp-preco-item"><span className="pp-preco-valor">{t.form.aConsultar}</span></div>}
              </div>
              {/* Captura de lead para TODOS os planos; recursos premium (vídeos,
                  selo, prioridade na busca) seguem exclusivos do plano pago. */}
                <>
                  {wppRef.current&&<button className="pp-btn-wpp" onClick={irWppDireto}>{WPP_SVG} {t.cardLateral.whatsappDireto}</button>}
                  <div className="pp-form">
                    {[{id:'nome',label:t.form.nomeLabel,type:'text',val:formNome,set:setFormNome,ph:t.form.nomePlaceholder,err:formErros.nome,onChange:(v:string)=>setFormNome(v)},
                      {id:'tel',label:t.form.telefoneLabel,type:'tel',val:formTel,set:setFormTel,ph:t.form.telefonePlaceholder,err:formErros.tel,onChange:(v:string)=>setFormTel(mascaraTel(v))},
                      {id:'email',label:t.form.emailLabel,type:'email',val:formEmail,set:setFormEmail,ph:t.form.emailPlaceholder,err:formErros.email,onChange:(v:string)=>setFormEmail(v)}
                    ].map(f=>(
                      <div key={f.id} className="pp-form-grupo">
                        <label>{f.label}</label>
                        <input type={f.type} value={f.val} placeholder={f.ph} className={f.err?'pp-campo-erro':''} onChange={e=>f.onChange(e.target.value)}/>
                      </div>
                    ))}
                    <div className="pp-form-grupo">
                      <label>{t.form.tipoEventoLabel}</label>
                      <select value={formTipo} className={formErros.tipo?'pp-campo-erro':''} onChange={e=>setFormTipo(e.target.value)}>
                        <option value="">{t.form.tipoEventoPlaceholder}</option>
                        {TIPOS_EVENTO.map(tp=><option key={tp} value={tp}>{tipoEventoLabel(tp)}</option>)}
                      </select>
                    </div>
                    {temPreco&&(
                    <div className="pp-form-grupo">
                      <label>{t.form.modoCobrancaLabel}</label>
                      <div className="pp-modo-wrap">
                        {prop?.valor_hora>0&&<label className={`pp-modo-btn${formModo==='hora'?' pp-modo-on':''}`}><input type="radio" name="modo" checked={formModo==='hora'} onChange={()=>setFormModo('hora')}/>{t.form.modoHora}</label>}
                        {(prop?.valor_base||prop?.preco)>0&&<label className={`pp-modo-btn${formModo==='diaria'?' pp-modo-on':''}`}><input type="radio" name="modo" checked={formModo==='diaria'} onChange={()=>setFormModo('diaria')}/>{t.form.modoDiaria}</label>}
                      </div>
                    </div>
                    )}
                    {formModo==='hora'&&(
                      <div className="pp-form-grupo"><label>{t.form.horasLabel}</label>
                        <div className="flex gap-[10px] items-center">
                          <input type="range" min={1} max={24} value={formHoras} onChange={e=>setFormHoras(Number(e.target.value))} className="flex-1 accent-[var(--vermelho)]"/>
                          <input type="number" min={1} max={24} value={formHoras} onChange={e=>setFormHoras(Number(e.target.value))} className="w-16 px-2 py-1 border-[1.5px] border-[#ddd] rounded-lg text-center font-[inherit] text-[.85rem]"/>
                        </div>
                      </div>
                    )}
                    {formModo==='diaria'&&(
                      <div className="pp-form-duplo">
                        <div className="pp-form-grupo"><label>{t.form.inicioLabel}</label><input type="date" value={formInicio} min={new Date().toISOString().split('T')[0]} onChange={e=>setFormInicio(e.target.value)}/></div>
                        <div className="pp-form-grupo"><label>{t.form.fimLabel}</label><input type="date" value={formFim} min={formInicio||new Date().toISOString().split('T')[0]} onChange={e=>setFormFim(e.target.value)}/></div>
                      </div>
                    )}
                    <div className="pp-form-grupo"><label>{t.form.convidadosLabel.replace('{n}',String(prop?.capacidade||500))}</label>
                      <div className="flex gap-[10px] items-center">
                        <input type="range" min={1} max={prop?.capacidade||500} value={formPessoas} onChange={e=>setFormPessoas(Number(e.target.value))} className="flex-1 accent-[var(--vermelho)]"/>
                        <input type="number" min={1} max={prop?.capacidade||500} value={formPessoas} onChange={e=>setFormPessoas(Number(e.target.value))} className="w-16 px-2 py-1 border-[1.5px] border-[#ddd] rounded-lg text-center font-[inherit] text-[.85rem]"/>
                      </div>
                    </div>
                    {temPreco?(
                    <div className="pp-simulador">
                      <div className="pp-sim-label">{t.form.estimativaTitulo}</div>
                      <div className="pp-sim-total"><span>{t.form.totalEstimado}</span><span>{total>0?formatMoney(locale,total):t.form.aConsultar}</span></div>
                      <div className="pp-sim-aviso">{t.form.estimativaAviso}</div>
                    </div>
                    ):(
                      <div className="pp-simulador"><div className="pp-sim-aviso">{t.cardLateral.basicoCta}</div></div>
                    )}
                    <button
                      type="button"
                      onClick={solicitarReserva}
                      disabled={enviandoReserva}
                      className="w-full bg-brand hover:bg-brand-600 disabled:opacity-60 text-white font-bold text-[.92rem] rounded-[12px] py-3 transition-colors inline-flex items-center justify-center gap-2"
                    >
                      {enviandoReserva?t.form.enviando:t.form.solicitarReserva}
                    </button>
                    <div className="text-center text-[.72rem] text-[#aaa] my-1">{t.form.ou}</div>
                    <button className={`pp-btn-enviar-wpp${formValido?'':' pp-btn-bloqueado'}`} onClick={enviarWpp}>{WPP_SVG} {t.form.enviarWhatsapp}</button>
                    <p className="pp-form-hint">{t.form.hint}</p>
                  </div>
                </>
            </div>
          </div>
        </div>
      </div>

      {/* Modal galeria */}
      {modalGal&&(
        <div ref={modalGalRef} role="dialog" aria-modal="true" aria-labelledby="pp-gal-titulo" className="pp-modal-galeria">
          <div className="pp-modal-header"><h3 id="pp-gal-titulo">{t.galeria.todasAsFotos} ({fotosEspaco.length})</h3><button className="pp-btn-fechar" aria-label={dict.busca.filtros.fechar} onClick={()=>setModalGal(false)}>✕</button></div>
          {Object.entries(fotosEspaco.reduce((acc:Record<string,Foto[]>,f)=>{const k=f.titulo||t.galeria.geral;(acc[k]=acc[k]||[]).push(f);return acc},{})).map(([sec,arr])=>(
            <div key={sec} className="mb-5">
              <h4 className="text-[1rem] font-bold text-[#222] mb-2.5 px-1">{sec}</h4>
              <div className="pp-modal-grid">
                {arr.map((f,i)=>(
                  <div key={i} className="pp-modal-foto" onClick={()=>abrirLb(fotosEspaco.map(x=>x.url),fotosEspaco.indexOf(f))}>
                    <img src={f.url} alt={f.alt||f.titulo||''} loading="lazy" style={{objectPosition:`${f.focal_x??50}% ${f.focal_y??50}%`}}/>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal vídeos */}
      {modalVid&&(
        <div ref={modalVidRef} role="dialog" aria-modal="true" aria-labelledby="pp-vid-titulo" className="pp-modal-videos">
          <div className="pp-videos-header"><h3 id="pp-vid-titulo">{t.videos.titulo}</h3><button className="pp-btn-fechar" aria-label={dict.busca.filtros.fechar} onClick={()=>setModalVid(false)}>✕</button></div>
          <div className="pp-videos-content">
            {videos.length?videos.map((v,i)=>(
              <div key={i} className="pp-video-item">
                {v.url?<video controls><source src={v.url}/>{t.videos.semSuporte}</video>:<div className="pp-video-placeholder">{t.videos.emBreve}</div>}
                <div className="pp-video-titulo">{v.titulo||t.videos.tituloPadrao}</div>
              </div>
            )):<p className="text-[#888] text-center py-10">{t.videos.nenhum}</p>}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lbOpen&&(
        <div ref={lbRef} role="dialog" aria-modal="true" aria-label={t.galeria.todasAsFotos} className="pp-lightbox" onClick={()=>setLbOpen(false)}>
          <button className="pp-lb-close" aria-label={dict.busca.filtros.fechar} onClick={()=>setLbOpen(false)}>✕</button>
          {lbFotos.length>1&&<button className="pp-lb-nav pp-lb-prev" onClick={e=>{e.stopPropagation();setLbIdx(i=>(i-1+lbFotos.length)%lbFotos.length)}}>‹</button>}
          <div className="pp-lb-img-wrap" onClick={e=>e.stopPropagation()}><img src={lbFotos[lbIdx]} alt=""/></div>
          {lbFotos.length>1&&<button className="pp-lb-nav pp-lb-next" onClick={e=>{e.stopPropagation();setLbIdx(i=>(i+1)%lbFotos.length)}}>›</button>}
          <div className="pp-lb-counter">{lbIdx+1} / {lbFotos.length}</div>
        </div>
      )}

      {/* Barra de ação fixa (mobile): preço + Solicitar + WhatsApp sempre à mão.
          No mobile o card de reserva fica no fim da página — esta barra encurta o
          caminho até a conversão. Some em ≥981px (o card sticky reassume). */}
      <div className="pp-barra-mobile">
        <div className="flex min-w-0 flex-col leading-tight">
          {temPreco ? (
            <>
              <span className="text-[.62rem] font-semibold uppercase tracking-wide text-[var(--pp-muted)]">{dict.componentes.card.aPartirDe}</span>
              <span className="truncate text-[1.05rem] font-extrabold text-[var(--preto)]">
                {Number(prop?.valor_hora) > 0
                  ? <>{formatMoney(locale, Number(prop.valor_hora))}<em className="not-italic text-[.8rem] font-medium text-[var(--pp-muted)]">{t.cardLateral.porHoraSufixo}</em></>
                  : formatMoney(locale, Number(prop?.valor_base || prop?.preco))}
              </span>
            </>
          ) : (
            <span className="text-[1.02rem] font-extrabold text-[var(--preto)]">{dict.componentes.card.sobConsulta}</span>
          )}
        </div>
        <div className="ml-auto flex flex-none items-center gap-2">
          {wppRef.current && (
            <button onClick={irWppDireto} aria-label={t.cardLateral.whatsappDireto} className="flex h-12 w-12 flex-none items-center justify-center rounded-xl bg-[#25d366] text-white">
              {WPP_SVG}
            </button>
          )}
          <button onClick={irParaReserva} className="h-12 whitespace-nowrap rounded-xl bg-brand px-6 font-bold text-white transition-colors hover:bg-brand-600">
            {t.barra.solicitar}
          </button>
        </div>
      </div>

      <Footer/>
    </>
  )
}

export default function PropriedadeClient({ initialProp = null, initialFotos = [] }: { initialProp?: PropMeta | null; initialFotos?: FotoMeta[] }) {
  return (
    <Suspense fallback={<div className="pp-loading"><div className="pp-loading-logo"><em>VENTSY</em></div><div className="pp-loading-dots"><span/><span/><span/></div></div>}>
      <PropriedadeContent initialProp={initialProp} initialFotos={initialFotos}/>
    </Suspense>
  )
}

'use client'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useParams } from 'next/navigation'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import { supabase } from '@/lib/supabase'

/* ── tipos ── */
interface Foto { url: string; titulo: string; ordem: number }
interface Avaliacao { id: any; autor: string; avatar: string; data: string; nota: number; texto: string; verificada: boolean; evento_tipo?: string }
interface Video { url: string; titulo: string }

const AVAL_DEMO: Avaliacao[] = [
  { id:1, autor:'Mariana Silva',   avatar:'https://i.pravatar.cc/150?u=11', data:'Março de 2025',    nota:5, texto:'Espaço incrível! Exatamente como nas fotos. O campo de futebol e a piscina foram um sucesso com os convidados. Super recomendo!', verificada:true, evento_tipo:'Aniversário' },
  { id:2, autor:'Ricardo Souza',   avatar:'https://i.pravatar.cc/150?u=12', data:'Fevereiro de 2025', nota:5, texto:'Excelente para confraternização corporativa. Ótima estrutura e o proprietário foi super atencioso com todas as nossas demandas.', verificada:true, evento_tipo:'Corporativo' },
  { id:3, autor:'Fernanda Lima',   avatar:'https://i.pravatar.cc/150?u=13', data:'Janeiro de 2025',  nota:4, texto:'Lugar lindo, espaço perfeito para o nosso casamento. Único ponto foi o acesso um pouco complicado à noite, mas no geral valeu cada centavo.', verificada:true, evento_tipo:'Casamento' },
  { id:4, autor:'Carlos Henrique', avatar:'https://i.pravatar.cc/150?u=14', data:'Dezembro de 2024', nota:5, texto:'Churrasqueira completa, piscina limpa, campo bem cuidado. Família toda amou. Com certeza vou repetir no próximo ano!', verificada:true, evento_tipo:'Aniversário' },
  { id:5, autor:'Ana Beatriz',     avatar:'https://i.pravatar.cc/150?u=15', data:'Novembro de 2024', nota:5, texto:'Contratei para aniversário de 15 anos da minha filha. Tudo perfeito, muito espaço verde, o local é lindo.', verificada:true, evento_tipo:'Aniversário' },
  { id:6, autor:'Pedro Costa',     avatar:'https://i.pravatar.cc/150?u=16', data:'Outubro de 2024',  nota:4, texto:'Ótima opção para eventos grandes. Boa infraestrutura e proprietário bem comunicativo.', verificada:true, evento_tipo:'Corporativo' },
]

const TIPOS_EVENTO = ['Casamento','Aniversário','Festa Infantil','Debutante','Formatura','Confraternização','Corporativo','Workshop','Show / Festival','Batizado','Encontro Religioso','Provas Hípicas','Pescaria','Radical','Outro']

function parseArray(val: any): string[] {
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

function PropriedadeContent() {
  const params = useParams()
  const propId = params.id as string

  const [prop,setProp]         = useState<any>(null)
  const [fotos,setFotos]       = useState<Foto[]>([])
  const [videos,setVideos]     = useState<Video[]>([])
  const [avaliacoes,setAval]   = useState<Avaliacao[]>([])
  const [plano,setPlano]       = useState<'basico'|'pro'|'ultra'>('basico')
  const [loading,setLoading]   = useState(true)
  const [anfNome,setAnfNome]   = useState('—')
  const [anfTempo,setAnfTempo] = useState('—')
  const [anfAv,setAnfAv]       = useState('')
  const [modalGal,setModalGal] = useState(false)
  const [modalVid,setModalVid] = useState(false)
  const [lbFotos,setLbFotos]   = useState<string[]>([])
  const [lbIdx,setLbIdx]       = useState(0)
  const [lbOpen,setLbOpen]     = useState(false)
  const [shareOpen,setShareOpen]     = useState(false)
  const [linkCopiado,setLinkCopiado] = useState(false)
  const [fav,setFav]           = useState(false)
  const [avalFiltro,setAvalFiltro] = useState('todas')
  const [avalVis,setAvalVis]   = useState(4)
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

      const { data: p } = await withTimeout(
        supabase.from('propriedades').select('*').eq('id', propId).single(),
        8000
      )

      if (!p) {
        loadDemo()
        return
      }

      const { data: fts } = await withTimeout(
        supabase.from('fotos_imovel').select('*').eq('propriedade_id', propId).order('ordem', { ascending: true }) as PromiseLike<{data: any[]}>,
        8000
      ).catch(() => ({ data: [] as any[] }))

      const [{ data: assin }, { data: vids }, { data: avals }, { data: usr }] = await withTimeout(Promise.all([
        supabase
          .from('assinaturas')
          .select('plano_ativo,status')
          .eq('usuario_id', p.usuario_id || '')
          .single()
          .then(res => ({ data: res.data || null })),

        supabase
          .from('videos_propriedade')
          .select('url,titulo')
          .eq('propriedade_id', propId)
          .then(res => ({ data: res.data || [] })),

        supabase
          .from('avaliacoes')
          .select('*')
          .eq('propriedade_id', propId)
          .eq('verificada', true)
          .order('criado_em', { ascending: false })
          .then(res => ({ data: res.data || [] })),

        supabase
          .from('usuarios')
          .select('*')
          .eq('id_prop', p.usuario_id || '')
          .single()
          .then(res => ({ data: res.data || null })),
      ]), 8000).catch(() => [{ data: null }, { data: [] }, { data: [] }, { data: null }])

      setPlano((assin as any)?.plano_ativo || 'basico')
      setProp(p)
      setFotos((fts || []).map((f:any)=>({
        url:f.url,
        titulo:f.secao || '',
        ordem:f.ordem
      })))

      setVideos(vids || [])
      setAval((avals || []).length ? avals as Avaliacao[] : AVAL_DEMO)
      wppRef.current = (p.whatsapp || '').replace(/\D/g, '')
      setFav(JSON.parse(localStorage.getItem('ventsy_favs') || '[]').includes(propId))

      if (usr){
        setAnfNome((usr as any).nome || '—')
        setAnfAv((usr as any).foto_perfil || '')

        if ((usr as any).criado_em){
          const a = Math.floor((Date.now() - new Date((usr as any).criado_em).getTime()) / 31536000000)
          setAnfTempo(a >= 1 ? `${a} ano${a > 1 ? 's' : ''}` : 'menos de 1 ano')
        }
      }

      try {
        await supabase.from('analytics_eventos').insert({
          propriedade_id: propId,
          evento_tipo: 'view'
        })
      } catch (_) {}

    } catch(e) {
      loadDemo()
    } finally {
      setLoading(false)
    }
  }

  load()
}, [propId])

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{
      if(lbOpen){if(e.key==='Escape')setLbOpen(false);if(e.key==='ArrowLeft')setLbIdx(i=>(i-1+lbFotos.length)%lbFotos.length);if(e.key==='ArrowRight')setLbIdx(i=>(i+1)%lbFotos.length)}
      else if(e.key==='Escape'){setModalGal(false);setModalVid(false)}
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[lbOpen,lbFotos.length])

  useEffect(()=>{document.body.style.overflow=(lbOpen||modalGal||modalVid)?'hidden':'';return()=>{document.body.style.overflow=''}},[lbOpen,modalGal,modalVid])

  const abrirLb=(urls:string[],i:number)=>{setLbFotos(urls);setLbIdx(i);setLbOpen(true)}
  const toggleFav=()=>{if(!prop?.id)return;const f:string[]=JSON.parse(localStorage.getItem('ventsy_favs')||'[]');const i=f.indexOf(prop.id);if(i>=0)f.splice(i,1);else f.push(prop.id);localStorage.setItem('ventsy_favs',JSON.stringify(f));setFav(i<0)}
  const copiarLink=()=>{navigator.clipboard.writeText(window.location.href);setLinkCopiado(true);setTimeout(()=>setLinkCopiado(false),2000)}

  const avalFil=(()=>{const b=avaliacoes.length?avaliacoes:AVAL_DEMO;if(avalFiltro==='5')return b.filter(a=>a.nota===5);if(avalFiltro==='4')return b.filter(a=>a.nota===4);if(avalFiltro==='3')return b.filter(a=>a.nota<=3);if(avalFiltro==='verificados')return b.filter(a=>a.verificada);return b})()
  const linhas=(prop?.descricao||'').split('\n').filter((l:string)=>l.trim())
  const sobrePreview=linhas.slice(0,3); const sobreResto=linhas.slice(3)

  const calcTotal=()=>{const vh=parseFloat(prop?.valor_hora)||0;const vd=parseFloat(prop?.valor_base||prop?.preco)||0;if(formModo==='hora')return vh*Math.max(1,formHoras);if(formModo==='diaria'&&formInicio&&formFim){const d=Math.max(0,Math.round((new Date(formFim).getTime()-new Date(formInicio).getTime())/86400000));return vd*Math.max(1,d)}return vd||vh}
  const total=calcTotal()
  const formValido=formNome.trim().length>=3&&/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formEmail)&&formTel.replace(/\D/g,'').length===11&&!!formTipo&&!!formModo

  const irWppDireto=async()=>{const msg=`Olá! Vi seu espaço "${prop?.nome||'no portal VENTSY'}" e gostaria de mais informações.`;try{await supabase.from('analytics_eventos').insert({propriedade_id:prop?.id,evento_tipo:'whatsapp'})}catch(_){};window.open(`https://wa.me/${wppRef.current}?text=${encodeURIComponent(msg)}`,'_blank')}

  const enviarWpp=async()=>{
    if(!formValido){const e:Record<string,boolean>={};if(formNome.trim().length<3)e.nome=true;if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(formEmail))e.email=true;if(formTel.replace(/\D/g,'').length!==11)e.tel=true;if(!formTipo)e.tipo=true;if(!formModo)e.modo=true;setFormErros(e);return}
    setFormErros({})
    const fmt=(d:string)=>d?new Date(d+'T12:00:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'}):'A combinar'
    let db='';if(formModo==='hora')db=`⏱ *Tipo de locação:* Por hora (${formHoras}h)`;if(formModo==='diaria')db=`📅 *Período:* ${fmt(formInicio)} até ${fmt(formFim)}`
    const txt=`Olá, tudo bem? Preenchi o formulário na Ventsy e gostaria de mais informações. Seguem os dados do meu evento:\n\n📍 *Espaço:* ${prop?.nome||'—'}\n👤 *Nome:* ${formNome}\n📞 *Telefone:* ${formTel}\n📧 *E-mail:* ${formEmail}\n🎉 *Tipo de evento:* ${formTipo}\n${db}\n👥 *Convidados:* ${formPessoas} pessoas\n💰 *Estimativa de orçamento:* ${total>0?total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'A consultar'}\n\n_Enviado pelo portal VENTSY_`
    try{await supabase.from('analytics_eventos').insert({propriedade_id:prop?.id,evento_tipo:'formulario'})}catch(_){}
    window.open(`https://wa.me/${wppRef.current}?text=${encodeURIComponent(txt)}`,'_blank')
  }

  const nota=prop?.avaliacao||prop?.nota_media
  const comodidades=parseArray(prop?.comodidades)
  const faqItems:any[]=Array.isArray(prop?.faq)?prop.faq:[]

  if(loading) return(
    <div className="pp-loading">
      <div className="pp-loading-logo"><em>VENTSY</em></div>
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
              <span>{avaliacoes.length||AVAL_DEMO.length} avaliações</span>
              <span>•</span>
              <span>{[prop?.cidade,prop?.estado].filter(Boolean).join(', ')}</span>
              {plano==='ultra'&&<span className="pp-selo-ultra">✦ ESPAÇO PREMIUM</span>}
              {plano==='pro'&&<span className="pp-selo-pro">★ PRO</span>}
            </div>
          </div>
          <div className="pp-acoes" style={{position:'relative'}}>
            <button className="pp-btn-acao" onClick={()=>setShareOpen(!shareOpen)}>
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
              Compartilhar
            </button>
            {shareOpen&&(
              <div className="pp-share-drop">
                <button onClick={copiarLink}>{linkCopiado?'✅ Link copiado!':'🔗 Copiar link'}</button>
                <a href={`https://wa.me/?text=${encodeURIComponent((prop?.nome||'Espaço')+' — '+window.location.href)}`} target="_blank" rel="noopener noreferrer">💬 WhatsApp</a>
                <a href={`mailto:?subject=${encodeURIComponent(prop?.nome||'')}&body=${encodeURIComponent('Confira este espaço: '+window.location.href)}`}>📧 E-mail</a>
              </div>
            )}
            <button className={`pp-btn-acao${fav?' pp-favoritado':''}`} onClick={toggleFav}>
              <svg width="16" height="16" fill={fav?'currentColor':'none'} stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              {fav?'Salvo':'Salvar'}
            </button>
          </div>
        </div>

        {/* Galeria */}
        <div className="pp-galeria-wrapper">
          <div className="pp-galeria-grid">
            {fotos.slice(0,5).map((f,i)=>(
              <div key={i} className={`pp-foto-slot${i===0?' pp-foto-main':''}`} onClick={()=>setModalGal(true)} style={{cursor:'pointer',position:'relative'}}>
                <img src={f.url} alt={f.titulo||`Foto ${i+1}`} loading="lazy" onError={e=>{(e.target as HTMLImageElement).src=`https://picsum.photos/seed/fb${i}/800/600`}}/>
                {i===4&&fotos.length>5&&<div className="pp-foto-overlay">+{fotos.length-4}</div>}
              </div>
            ))}
          </div>
          <div className="pp-galeria-acoes">
            {plano==='ultra'&&videos.length>0&&<button className="pp-btn-galeria" onClick={()=>setModalVid(true)}>🎬 Ver vídeos / Tour 360°</button>}
            {plano!=='basico'&&<button className="pp-btn-galeria" onClick={()=>setModalGal(true)}>⊞ {fotos.length>5?`Ver todas as ${fotos.length} fotos`:'Mostrar todas as fotos'}</button>}
          </div>
        </div>

        {/* Corpo */}
        <div className="pp-corpo">
          <div className="pp-esquerda">

            {/* Anfitrião */}
            <div className="pp-anfitriao">
              {anfAv?<img src={anfAv} alt={anfNome} className="pp-avatar"/>:<div className="pp-avatar-inicial">{anfNome.charAt(0)}</div>}
              <div><h3 className="pp-anf-nome">{anfNome}</h3><p className="pp-anf-sub">Proprietário • Na VENTSY há {anfTempo}</p></div>
            </div>

            {/* Detalhes */}
            <div className="pp-detalhes">
              {[{label:'Capacidade',valor:prop?.capacidade?`${prop.capacidade} pessoas`:'—'},{label:'Tipo do espaço',valor:prop?.tipo_propriedade||'—'},{label:'Localização',valor:prop?.cidade||'—'}].map(d=>(
                <div key={d.label} className="pp-detalhe-item"><span className="pp-det-label">{d.label}</span><span className="pp-det-valor">{d.valor}</span></div>
              ))}
            </div>

            {/* Sobre */}
            <div className="pp-sobre">
              <h2>Sobre este espaço</h2>
              {sobrePreview.map((l:string,i:number)=><p key={i}>{l}</p>)}
              {sobreResto.length>0&&sobreExp&&sobreResto.map((l:string,i:number)=><p key={i}>{l}</p>)}
              {sobreResto.length>0&&!sobreExp&&<button className="pp-expandir" onClick={()=>setSobreExp(true)}>Ler mais →</button>}
            </div>

            {/* Comodidades */}
            <div className="pp-comodidades"><h2>O que o lugar oferece</h2>
              <div className="pp-como-grid">
                {comodidades.length?comodidades.map((c:string,i:number)=><div key={i} className="pp-comodidade">{c}</div>):<p style={{color:'#aaa',fontSize:'.88rem'}}>Não informado.</p>}
              </div>
            </div>

            {/* Avaliações */}
            <div className="pp-avaliacoes">
              <div className="pp-aval-header">
                <div className="pp-aval-nota">{nota?parseFloat(nota).toFixed(1):'—'}</div>
                <div><div className="pp-aval-stars">★★★★★</div><div className="pp-aval-total">{avalFil.length} avaliações verificadas</div></div>
              </div>
              <div className="pp-aval-filtros">
                {[['todas','Todas'],['5','★★★★★'],['4','★★★★'],['3','★★★ ou menos'],['verificados','✓ Verificados']].map(([k,l])=>(
                  <button key={k} className={`pp-aval-filtro${avalFiltro===k?' pp-aval-ativo':''}`} onClick={()=>{setAvalFiltro(k);setAvalVis(4)}}>{l}</button>
                ))}
              </div>
              <div className="pp-aval-grid">
                {avalFil.slice(0,avalVis).map(a=>(
                  <div key={a.id} className="pp-aval-card">
                    <div className="pp-aval-autor">
                      <img src={a.avatar||`https://i.pravatar.cc/150?u=${a.id}`} alt={a.autor} loading="lazy"/>
                      <div><strong>{a.autor}{a.verificada&&<span className="pp-badge-ver">✓ Verificado</span>}</strong><span>{a.data}{a.evento_tipo?` · ${a.evento_tipo}`:''}</span></div>
                    </div>
                    <div style={{color:'var(--ouro)',fontSize:'.88rem',marginBottom:6}}>{'★'.repeat(a.nota)}{'☆'.repeat(5-a.nota)}</div>
                    <p className="pp-aval-texto">{a.texto}</p>
                  </div>
                ))}
                {!avalFil.length&&<p style={{color:'#aaa',gridColumn:'1/-1'}}>Nenhuma avaliação encontrada com este filtro.</p>}
              </div>
              {avalFil.length>avalVis&&<button className="pp-btn-ver-mais" onClick={()=>setAvalVis(v=>v+4)}>Mostrar mais avaliações</button>}
            </div>

            {/* Mapa */}
            {prop?.cidade&&(
              <div className="pp-mapa"><h2>Onde fica este espaço</h2>
                <p className="pp-mapa-end">{[prop?.cidade,prop?.estado,'Brasil'].filter(Boolean).join(', ')}</p>
                <div className="pp-mapa-container">
                  <iframe title="Localização" width="100%" height="350" style={{border:0}} loading="lazy"
                    src={`https://maps.google.com/maps?q=${encodeURIComponent([prop?.cidade,prop?.estado,'Brasil'].filter(Boolean).join(', '))}&output=embed&hl=pt-BR`}/>
                </div>
              </div>
            )}

            {/* FAQ */}
            {faqItems.length>0&&(
              <div className="pp-faq"><h2>Perguntas frequentes</h2>
                {faqItems.map((f,i)=><FaqItem key={i} pergunta={f.pergunta} resposta={f.resposta}/>)}
              </div>
            )}
          </div>

          {/* Card lateral */}
          <div className="pp-card-lateral-outer">
            <div className="pp-card-lateral">
              {plano==='ultra'&&(
                <div className="pp-ultra-banner">
                  <div className="pp-ultra-title">✦ Espaço Premium VENTSY</div>
                  <div className="pp-ultra-sub">Fotos profissionais, vídeos e tour 360° disponíveis. Resposta prioritária garantida.</div>
                </div>
              )}
              <div className="pp-precos">
                {prop?.valor_hora>0&&<div className="pp-preco-item"><span className="pp-preco-label">Por hora</span><span className="pp-preco-valor">R$ {Number(prop.valor_hora).toLocaleString('pt-BR')}<em>/h</em></span></div>}
                {(prop?.valor_base||prop?.preco)>0&&<div className="pp-preco-item"><span className="pp-preco-label">Diária</span><span className="pp-preco-valor">R$ {Number(prop?.valor_base||prop?.preco).toLocaleString('pt-BR')}</span></div>}
              </div>
              {plano!=='basico'?(
                <>
                  {wppRef.current&&<button className="pp-btn-wpp" onClick={irWppDireto}>{WPP_SVG} WhatsApp direto</button>}
                  <div className="pp-form">
                    {[{id:'nome',label:'Nome *',type:'text',val:formNome,set:setFormNome,ph:'Seu nome completo',err:formErros.nome,onChange:(v:string)=>setFormNome(v)},
                      {id:'tel',label:'Telefone *',type:'tel',val:formTel,set:setFormTel,ph:'(11) 99999-9999',err:formErros.tel,onChange:(v:string)=>setFormTel(mascaraTel(v))},
                      {id:'email',label:'E-mail *',type:'email',val:formEmail,set:setFormEmail,ph:'seu@email.com',err:formErros.email,onChange:(v:string)=>setFormEmail(v)}
                    ].map(f=>(
                      <div key={f.id} className="pp-form-grupo">
                        <label>{f.label}</label>
                        <input type={f.type} value={f.val} placeholder={f.ph} className={f.err?'pp-campo-erro':''} onChange={e=>f.onChange(e.target.value)}/>
                      </div>
                    ))}
                    <div className="pp-form-grupo">
                      <label>Tipo de evento *</label>
                      <select value={formTipo} className={formErros.tipo?'pp-campo-erro':''} onChange={e=>setFormTipo(e.target.value)}>
                        <option value="">Selecione o tipo</option>
                        {TIPOS_EVENTO.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div className="pp-form-grupo">
                      <label>Modo de cobrança *</label>
                      <div className="pp-modo-wrap">
                        {prop?.valor_hora>0&&<label className={`pp-modo-btn${formModo==='hora'?' pp-modo-on':''}`}><input type="radio" name="modo" checked={formModo==='hora'} onChange={()=>setFormModo('hora')}/>⏱ Por hora</label>}
                        {(prop?.valor_base||prop?.preco)>0&&<label className={`pp-modo-btn${formModo==='diaria'?' pp-modo-on':''}`}><input type="radio" name="modo" checked={formModo==='diaria'} onChange={()=>setFormModo('diaria')}/>📅 Diária</label>}
                      </div>
                    </div>
                    {formModo==='hora'&&(
                      <div className="pp-form-grupo"><label>Horas</label>
                        <div style={{display:'flex',gap:10,alignItems:'center'}}>
                          <input type="range" min={1} max={24} value={formHoras} onChange={e=>setFormHoras(Number(e.target.value))} style={{flex:1,accentColor:'var(--vermelho)'}}/>
                          <input type="number" min={1} max={24} value={formHoras} onChange={e=>setFormHoras(Number(e.target.value))} style={{width:64,padding:'4px 8px',border:'1.5px solid #ddd',borderRadius:8,textAlign:'center',fontFamily:'inherit',fontSize:'.85rem'}}/>
                        </div>
                      </div>
                    )}
                    {formModo==='diaria'&&(
                      <div className="pp-form-duplo">
                        <div className="pp-form-grupo"><label>Início</label><input type="date" value={formInicio} min={new Date().toISOString().split('T')[0]} onChange={e=>setFormInicio(e.target.value)}/></div>
                        <div className="pp-form-grupo"><label>Fim</label><input type="date" value={formFim} min={formInicio||new Date().toISOString().split('T')[0]} onChange={e=>setFormFim(e.target.value)}/></div>
                      </div>
                    )}
                    <div className="pp-form-grupo"><label>Convidados (máx. {prop?.capacidade||500})</label>
                      <div style={{display:'flex',gap:10,alignItems:'center'}}>
                        <input type="range" min={1} max={prop?.capacidade||500} value={formPessoas} onChange={e=>setFormPessoas(Number(e.target.value))} style={{flex:1,accentColor:'var(--vermelho)'}}/>
                        <input type="number" min={1} max={prop?.capacidade||500} value={formPessoas} onChange={e=>setFormPessoas(Number(e.target.value))} style={{width:64,padding:'4px 8px',border:'1.5px solid #ddd',borderRadius:8,textAlign:'center',fontFamily:'inherit',fontSize:'.85rem'}}/>
                      </div>
                    </div>
                    <div className="pp-simulador">
                      <div className="pp-sim-label">Estimativa de orçamento</div>
                      <div className="pp-sim-total"><span>Total estimado:</span><span>{total>0?total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'}):'A consultar'}</span></div>
                      <div className="pp-sim-aviso">*Valor estimado, sujeito a confirmação do proprietário.</div>
                    </div>
                    <button className={`pp-btn-enviar-wpp${formValido?'':' pp-btn-bloqueado'}`} onClick={enviarWpp}>{WPP_SVG} Enviar solicitação pelo WhatsApp</button>
                    <p className="pp-form-hint">Todas as informações serão enviadas ao proprietário via WhatsApp.</p>
                  </div>
                </>
              ):(
                <div className="pp-basico-cta">
                  <p>Entre em contato com o proprietário para verificar disponibilidade e negociar condições.</p>
                  {wppRef.current&&<button className="pp-btn-wpp" style={{marginTop:16}} onClick={irWppDireto}>💬 Falar pelo WhatsApp</button>}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal galeria */}
      {modalGal&&(
        <div className="pp-modal-galeria">
          <div className="pp-modal-header"><h3>Todas as fotos ({fotos.length})</h3><button className="pp-btn-fechar" onClick={()=>setModalGal(false)}>✕</button></div>
          <div className="pp-modal-grid">
            {fotos.map((f,i)=>(
              <div key={i} className="pp-modal-foto" onClick={()=>abrirLb(fotos.map(x=>x.url),i)}>
                <img src={f.url} alt={f.titulo||''} loading="lazy"/>
                {f.titulo&&<div className="pp-modal-foto-titulo">{f.titulo}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal vídeos */}
      {modalVid&&(
        <div className="pp-modal-videos">
          <div className="pp-videos-header"><h3>🎬 Vídeos do Espaço — Tour 360°</h3><button className="pp-btn-fechar" onClick={()=>setModalVid(false)}>✕</button></div>
          <div className="pp-videos-content">
            {videos.length?videos.map((v,i)=>(
              <div key={i} className="pp-video-item">
                {v.url?<video controls><source src={v.url}/>Seu navegador não suporta vídeo.</video>:<div className="pp-video-placeholder">Vídeo em breve</div>}
                <div className="pp-video-titulo">{v.titulo||'Vídeo do espaço'}</div>
              </div>
            )):<p style={{color:'#888',textAlign:'center',padding:'40px 0'}}>Nenhum vídeo cadastrado ainda.</p>}
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lbOpen&&(
        <div className="pp-lightbox" onClick={()=>setLbOpen(false)}>
          <button className="pp-lb-close" onClick={()=>setLbOpen(false)}>✕</button>
          {lbFotos.length>1&&<button className="pp-lb-nav pp-lb-prev" onClick={e=>{e.stopPropagation();setLbIdx(i=>(i-1+lbFotos.length)%lbFotos.length)}}>‹</button>}
          <div className="pp-lb-img-wrap" onClick={e=>e.stopPropagation()}><img src={lbFotos[lbIdx]} alt=""/></div>
          {lbFotos.length>1&&<button className="pp-lb-nav pp-lb-next" onClick={e=>{e.stopPropagation();setLbIdx(i=>(i+1)%lbFotos.length)}}>›</button>}
          <div className="pp-lb-counter">{lbIdx+1} / {lbFotos.length}</div>
        </div>
      )}

      <Footer/>
    </>
  )
}

export default function PropriedadePage() {
  return (
    <Suspense fallback={<div className="pp-loading"><div className="pp-loading-logo"><em>VENTSY</em></div><div className="pp-loading-dots"><span/><span/><span/></div></div>}>
      <PropriedadeContent/>
    </Suspense>
  )
}

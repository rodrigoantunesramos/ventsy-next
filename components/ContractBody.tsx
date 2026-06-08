// Renderizador "markdown-lite" do corpo de um contrato (snapshot conteudo_final).
// Compartilhado pela ficha do contrato (painel) e pela página pública de
// assinatura. NÃO usa dangerouslySetInnerHTML — o texto é tokenizado e renderizado
// como elementos React, eliminando risco de XSS no conteúdo do dono.
// Suporta: # / ## / ### (títulos), - ou * (lista), **negrito**, e parágrafos.
// O marcador BLANK (____) recebe destaque para indicar preenchimento manual.

import { Fragment, type ReactNode } from 'react'
import { BLANK } from '@/lib/contracts'

function inline(text: string, keyBase: string): ReactNode[] {
  // Quebra em **negrito** e realça o marcador de preenchimento (BLANK).
  const out: ReactNode[] = []
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  parts.forEach((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      out.push(<strong key={`${keyBase}-b${i}`} className="font-semibold text-ink">{part.slice(2, -2)}</strong>)
      return
    }
    // Realça lacunas ____ dentro do trecho normal.
    const sub = part.split(new RegExp(`(${BLANK})`, 'g'))
    sub.forEach((s, j) => {
      if (s === BLANK) out.push(<span key={`${keyBase}-g${i}-${j}`} className="mx-0.5 rounded bg-amber-100/70 px-1 text-amber-800">{BLANK}</span>)
      else if (s) out.push(<Fragment key={`${keyBase}-t${i}-${j}`}>{s}</Fragment>)
    })
  })
  return out
}

export default function ContractBody({ text, className }: { text: string; className?: string }) {
  const lines = (text || '').replace(/\r\n/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let list: string[] = []
  let para: string[] = []

  const flushPara = (k: string) => {
    if (para.length) { blocks.push(<p key={k} className="leading-relaxed text-ink-soft">{inline(para.join(' '), k)}</p>); para = [] }
  }
  const flushList = (k: string) => {
    if (list.length) {
      blocks.push(
        <ul key={k} className="ml-1 list-disc space-y-1 pl-5 text-ink-soft">
          {list.map((li, i) => <li key={`${k}-${i}`} className="leading-relaxed">{inline(li, `${k}-${i}`)}</li>)}
        </ul>,
      )
      list = []
    }
  }

  lines.forEach((raw, idx) => {
    const line = raw.trim()
    const k = `bl-${idx}`
    if (line === '') { flushPara(k); flushList(k); return }
    if (/^#{1,3}\s/.test(line)) {
      flushPara(k); flushList(k)
      const level = line.match(/^#+/)![0].length
      const content = line.replace(/^#{1,3}\s/, '')
      const cls = level === 1
        ? 'font-display text-lg font-bold text-ink mt-1'
        : level === 2
          ? 'text-sm font-bold uppercase tracking-wide text-ink mt-3'
          : 'text-sm font-semibold text-ink mt-2'
      blocks.push(<p key={k} className={cls}>{inline(content, k)}</p>)
      return
    }
    if (/^[-*]\s/.test(line)) { flushPara(k); list.push(line.replace(/^[-*]\s/, '')); return }
    para.push(line)
  })
  flushPara('end-p'); flushList('end-l')

  return <div className={`space-y-3 text-sm ${className || ''}`}>{blocks}</div>
}

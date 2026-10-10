import { useRef, type HTMLAttributes, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

// Cartão com brilho que segue o mouse, borda que acende e leve inclinação (inspirado no Magic Bento
// do React Bits). O JS só grava a posição em variáveis CSS; quem desenha é o CSS (`.cartao-brilho`).
// Só reage a mouse/caneta: no toque não existe "passar por cima".
const INCLINACAO_MAX = 3 // graus: o suficiente para parecer físico sem enjoar

export function CartaoBrilho({ className, children, ...resto }: HTMLAttributes<HTMLDivElement>) {
  const cartao = useRef<HTMLDivElement>(null)

  function aoMover(e: PointerEvent<HTMLDivElement>) {
    const el = cartao.current
    if (!el || e.pointerType === 'touch') return
    const caixa = el.getBoundingClientRect()
    const x = (e.clientX - caixa.left) / caixa.width
    const y = (e.clientY - caixa.top) / caixa.height
    el.style.setProperty('--brilho-x', `${x * 100}%`)
    el.style.setProperty('--brilho-y', `${y * 100}%`)
    el.style.setProperty('--incl-x', `${(0.5 - y) * INCLINACAO_MAX * 2}deg`)
    el.style.setProperty('--incl-y', `${(x - 0.5) * INCLINACAO_MAX * 2}deg`)
    el.dataset.ativo = 'sim'
  }
  function aoSair() {
    const el = cartao.current
    if (!el) return
    el.style.setProperty('--incl-x', '0deg')
    el.style.setProperty('--incl-y', '0deg')
    delete el.dataset.ativo
  }

  return (
    <div ref={cartao} onPointerMove={aoMover} onPointerLeave={aoSair} className={cn('cartao-brilho', className)} {...resto}>
      {children}
    </div>
  )
}

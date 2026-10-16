import { motion, useMotionValue, useReducedMotion, useSpring } from 'motion/react'
import type { PointerEvent, ReactNode } from 'react'

// Botão "magnético": puxa alguns pixels na direção do cursor e volta com mola ao sair.
// Só mouse/caneta (no toque não existe passar por cima); desligado com "reduzir movimento".
const FORCA = 0.25 // fração da distância do cursor até o centro
const MAXIMO = 8 // px

export function Magnetico({ children, className }: { children: ReactNode; className?: string }) {
  const parado = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const mola = { stiffness: 260, damping: 18, mass: 0.6 }
  const sx = useSpring(x, mola)
  const sy = useSpring(y, mola)

  function aoMover(e: PointerEvent<HTMLDivElement>) {
    if (parado || e.pointerType === 'touch') return
    const caixa = e.currentTarget.getBoundingClientRect()
    const limitar = (v: number) => Math.max(-MAXIMO, Math.min(MAXIMO, v))
    x.set(limitar((e.clientX - (caixa.left + caixa.width / 2)) * FORCA))
    y.set(limitar((e.clientY - (caixa.top + caixa.height / 2)) * FORCA))
  }
  function aoSair() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div onPointerMove={aoMover} onPointerLeave={aoSair} style={{ x: sx, y: sy }} className={className}>
      {children}
    </motion.div>
  )
}

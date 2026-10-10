import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useRef, type ReactNode } from 'react'

// A "tela" começa deitada em 3D e se endireita conforme a rolagem (inspirada no Container Scroll
// Animation do 21st.dev). Só transform e opacity: a GPU anima sem recalcular o layout.
export function TelaInclinada({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null)
  const parado = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: caixa, offset: ['start end', 'start 0.25'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [24, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.92, 1])
  const y = useTransform(scrollYProgress, [0, 1], [40, 0])

  return (
    <div ref={caixa} style={{ perspective: 1200 }}>
      <motion.div
        style={parado ? undefined : { rotateX, scale, y, transformOrigin: 'center top' }}
        className="rounded-[1.75rem] bg-background p-2 ring-1 ring-border sombra-alta sm:p-3"
      >
        <div className="rounded-[1.25rem] bg-card p-4 ring-1 ring-border/60 sm:p-6">{children}</div>
      </motion.div>
    </div>
  )
}

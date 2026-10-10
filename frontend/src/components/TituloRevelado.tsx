import { motion, useReducedMotion } from 'motion/react'
import { cn } from '@/lib/utils'

/** Título de seção que surge palavra por palavra, saindo do desfoque, quando entra na tela. */
export function TituloRevelado({ texto, className }: { texto: string; className?: string }) {
  const parado = useReducedMotion()
  const palavras = texto.split(' ')
  if (parado) return <h2 className={className}>{texto}</h2>

  return (
    <motion.h2
      className={cn(className)}
      aria-label={texto}
      initial="escondido"
      whileInView="visivel"
      viewport={{ once: true, amount: 0.6 }}
      transition={{ staggerChildren: 0.06 }}
    >
      {palavras.map((palavra, i) => (
        <span key={i}>
          <motion.span
            aria-hidden
            className="inline-block"
            variants={{
              escondido: { opacity: 0, y: 18, filter: 'blur(8px)' },
              visivel: { opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            {palavra}
          </motion.span>
          {/* espaço comum entre as palavras: é ele que deixa o título quebrar linha */}
          {i < palavras.length - 1 && ' '}
        </span>
      ))}
    </motion.h2>
  )
}

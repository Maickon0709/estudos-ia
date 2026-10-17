import type { ReactNode } from 'react'
import { COTA, TEXTO } from '@/components/figuras/estilo'

export function Svg({ largura, altura, titulo, children }: { largura: number; altura: number; titulo: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${largura} ${altura}`} role="img" aria-label={titulo} className="mx-auto block h-auto w-full" style={{ maxWidth: largura }}>
      <title>{titulo}</title>
      <defs>
        <marker id="fig-seta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0 1 L9 5 L0 9 z" className="fill-muted-foreground" />
        </marker>
      </defs>
      {children}
    </svg>
  )
}

/** Linha de cota: setas nas duas pontas e o rótulo no meio. */
export function Cota({ x1, y1, x2, y2, rotulo, lado = -1 }: { x1: number; y1: number; x2: number; y2: number; rotulo: string; lado?: number }) {
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const vertical = Math.abs(x2 - x1) < Math.abs(y2 - y1)
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} className={COTA} strokeWidth={1.2} markerStart="url(#fig-seta)" markerEnd="url(#fig-seta)" />
      <text
        x={vertical ? mx + lado * 8 : mx}
        y={vertical ? my : my + (lado < 0 ? -8 : 17)}
        textAnchor={vertical ? (lado < 0 ? 'end' : 'start') : 'middle'}
        dominantBaseline={vertical ? 'middle' : 'auto'}
        className={TEXTO}
      >
        {rotulo}
      </text>
    </g>
  )
}

export function Centro({ x, y, texto }: { x: number; y: number; texto: string }) {
  if (!texto) return null
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-primary text-[14px] font-semibold">
      {texto}
    </text>
  )
}

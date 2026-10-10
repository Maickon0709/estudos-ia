import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Grade de pontos que foge do cursor e acende em índigo → ciano (inspirada no Dot Grid do React Bits).
// Canvas 2D puro: sem WebGL e sem dependência nova. Só anima enquanto há movimento e a grade está na tela;
// com "reduzir movimento" desenha a grade parada. `fixo` cobre a janela inteira, atrás da página toda.

const ESPACO = 26
const RAIO = 1.3
const ALCANCE = 130
const EMPURRAO = 14

type Ponto = { x: number; y: number; dx: number; dy: number; brilho: number }

/** Converte qualquer cor CSS (inclusive oklch) para [r, g, b] pintando 1 pixel. */
function rgbDe(cor: string, reserva: [number, number, number]): [number, number, number] {
  const tela = document.createElement('canvas')
  tela.width = tela.height = 1
  const ctx = tela.getContext('2d', { willReadFrequently: true })
  if (!ctx) return reserva
  ctx.fillStyle = `rgb(${reserva.join(',')})`
  ctx.fillStyle = cor
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return [r, g, b]
}

type Rgb = [number, number, number]

function coresDoTema(): { base: Rgb; meio: Rgb; ponta: Rgb } {
  const estilo = getComputedStyle(document.documentElement)
  return {
    base: rgbDe(estilo.getPropertyValue('--muted-foreground').trim(), [120, 125, 150]),
    meio: rgbDe(estilo.getPropertyValue('--primary').trim(), [79, 70, 229]),
    ponta: rgbDe(estilo.getPropertyValue('--destaque').trim(), [6, 182, 212]),
  }
}

/** Mistura base → índigo → ciano conforme o ponto se aproxima do cursor (t de 0 a 1). */
function corDoPonto(c: ReturnType<typeof coresDoTema>, t: number): Rgb {
  const [de, para, k] = t < 0.5 ? [c.base, c.meio, t * 2] : [c.meio, c.ponta, (t - 0.5) * 2]
  return [de[0] + (para[0] - de[0]) * k, de[1] + (para[1] - de[1]) * k, de[2] + (para[2] - de[2]) * k]
}

export function FundoPontos({ className, fixo = false }: { className?: string; fixo?: boolean }) {
  const tela = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = tela.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const opacidadeBase = fixo ? 0.16 : 0.28

    let pontos: Ponto[] = []
    let cores = coresDoTema()
    let largura = 0
    let altura = 0
    let cursor: { x: number; y: number } | null = null
    let quadro = 0
    let visivel = true

    function montar() {
      const caixa = canvas!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      largura = caixa.width
      altura = caixa.height
      canvas!.width = Math.round(largura * dpr)
      canvas!.height = Math.round(altura * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      pontos = []
      for (let y = ESPACO / 2; y < altura; y += ESPACO)
        for (let x = ESPACO / 2; x < largura; x += ESPACO) pontos.push({ x, y, dx: 0, dy: 0, brilho: 0 })
      desenhar()
    }

    /** Desenha um quadro; devolve true se algum ponto ainda está se mexendo. */
    function desenhar(): boolean {
      ctx!.clearRect(0, 0, largura, altura)
      let mexendo = false
      for (const p of pontos) {
        let alvoX = 0
        let alvoY = 0
        let alvoBrilho = 0
        if (cursor && !parado) {
          const vx = p.x - cursor.x
          const vy = p.y - cursor.y
          const dist = Math.hypot(vx, vy)
          if (dist < ALCANCE && dist > 0.01) {
            const forca = 1 - dist / ALCANCE
            alvoX = (vx / dist) * forca * EMPURRAO
            alvoY = (vy / dist) * forca * EMPURRAO
            alvoBrilho = forca
          }
        }
        p.dx += (alvoX - p.dx) * 0.14
        p.dy += (alvoY - p.dy) * 0.14
        p.brilho += (alvoBrilho - p.brilho) * 0.14
        if (Math.abs(p.dx - alvoX) > 0.05 || Math.abs(p.dy - alvoY) > 0.05 || Math.abs(p.brilho - alvoBrilho) > 0.01)
          mexendo = true
        const t = p.brilho
        const [r, g, b] = corDoPonto(cores, t)
        ctx!.fillStyle = `rgba(${r},${g},${b},${opacidadeBase + ((fixo ? 0.7 : 0.95) - opacidadeBase) * t})`
        ctx!.beginPath()
        ctx!.arc(p.x + p.dx, p.y + p.dy, RAIO + t * 1.4, 0, Math.PI * 2)
        ctx!.fill()
      }
      return mexendo
    }

    function animar() {
      quadro = 0
      if (!visivel) return
      if (desenhar() || cursor) quadro = requestAnimationFrame(animar)
    }
    function acordar() {
      if (!quadro && visivel && !parado) quadro = requestAnimationFrame(animar)
    }

    function aoMover(e: PointerEvent) {
      if (e.pointerType === 'touch') return // no toque o dedo cobre a tela: o efeito só atrapalharia a rolagem
      const caixa = canvas!.getBoundingClientRect()
      const x = e.clientX - caixa.left
      const y = e.clientY - caixa.top
      cursor = x >= -ALCANCE && y >= -ALCANCE && x <= largura + ALCANCE && y <= altura + ALCANCE ? { x, y } : null
      acordar()
    }
    function aoSair() {
      cursor = null
      acordar()
    }

    montar()
    const redimensionar = new ResizeObserver(montar)
    redimensionar.observe(canvas)
    const naTela = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      if (visivel) acordar()
    })
    naTela.observe(canvas)
    // Troca de tema claro/escuro muda a classe do <html>: relê as cores.
    const tema = new MutationObserver(() => {
      cores = coresDoTema()
      desenhar()
    })
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('pointermove', aoMover, { passive: true })
    document.addEventListener('pointerleave', aoSair)

    return () => {
      cancelAnimationFrame(quadro)
      redimensionar.disconnect()
      naTela.disconnect()
      tema.disconnect()
      window.removeEventListener('pointermove', aoMover)
      document.removeEventListener('pointerleave', aoSair)
    }
  }, [fixo])

  return (
    <canvas
      ref={tela}
      aria-hidden
      className={cn('pointer-events-none inset-0 size-full', fixo ? 'fixed h-svh w-screen' : 'absolute', className)}
    />
  )
}

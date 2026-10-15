import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

// Fundo fluido: centenas de partículas finas seguindo um "campo de correnteza" que muda devagar com o tempo,
// deixando rastros que se apagam aos poucos (efeito de fumaça/água). Perto do cursor a correnteza vira um
// redemoinho e as linhas acendem no vermelho de destaque. Canvas 2D puro: sem WebGL e sem dependência nova.
// Pausa com a aba escondida ou fora da tela; com "reduzir movimento" desenha um quadro parado e para.

type Rgb = [number, number, number]
type Particula = { x: number; y: number; vida: number; calor: number }

const DENSIDADE = 9000 // px² por partícula
const MAXIMO = 650
const VELOCIDADE = 0.55
const ALCANCE = 190 // raio do redemoinho em volta do cursor
const APAGAR = 0.045 // quanto do rastro some por quadro (maior = rastro mais curto)

/** Converte qualquer cor CSS (inclusive oklch) para [r, g, b] pintando 1 pixel. */
function rgbDe(cor: string, reserva: Rgb): Rgb {
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

function coresDoTema() {
  const estilo = getComputedStyle(document.documentElement)
  return {
    linha: rgbDe(estilo.getPropertyValue('--muted-foreground').trim(), [120, 120, 120]),
    destaque: rgbDe(estilo.getPropertyValue('--destaque').trim(), [217, 71, 59]),
  }
}

/** Ângulo da correnteza num ponto: soma de ondas lentas (barato e suave, sem biblioteca de ruído). */
function angulo(x: number, y: number, t: number) {
  return (
    Math.sin(x * 0.0016 + t * 0.00021) * Math.cos(y * 0.0019 - t * 0.00016) * Math.PI * 1.6 +
    Math.sin((x + y) * 0.0009 + t * 0.00011) * 1.2
  )
}

export function FundoFluido({ className, fixo = false }: { className?: string; fixo?: boolean }) {
  const tela = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = tela.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const parado = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let largura = 0
    let altura = 0
    let particulas: Particula[] = []
    let cores = coresDoTema()
    let cursor: { x: number; y: number } | null = null
    let quadro = 0
    let visivel = true
    let inicio = performance.now()

    const nova = (): Particula => ({ x: Math.random() * largura, y: Math.random() * altura, vida: 200 + Math.random() * 400, calor: 0 })

    function montar() {
      const caixa = canvas!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      largura = caixa.width
      altura = caixa.height
      canvas!.width = Math.round(largura * dpr)
      canvas!.height = Math.round(altura * dpr)
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const total = Math.min(MAXIMO, Math.round((largura * altura) / DENSIDADE))
      particulas = Array.from({ length: total }, nova)
      if (parado) {
        for (let i = 0; i < 90; i++) passo(inicio + i * 16, false) // um quadro "congelado" com rastros
      }
    }

    function passo(agora: number, apagar = true) {
      const t = agora - inicio
      if (apagar) {
        // apaga um pouco do quadro anterior mantendo o canvas transparente (o fundo da página aparece)
        ctx!.globalCompositeOperation = 'destination-out'
        ctx!.fillStyle = `rgba(0,0,0,${APAGAR})`
        ctx!.fillRect(0, 0, largura, altura)
        ctx!.globalCompositeOperation = 'source-over'
      }
      ctx!.lineWidth = 1
      ctx!.lineCap = 'round'
      const [lr, lg, lb] = cores.linha
      const [dr, dg, db] = cores.destaque

      for (const p of particulas) {
        const a = angulo(p.x, p.y, t)
        let vx = Math.cos(a) * VELOCIDADE
        let vy = Math.sin(a) * VELOCIDADE
        let alvoCalor = 0
        if (cursor) {
          const dx = p.x - cursor.x
          const dy = p.y - cursor.y
          const dist = Math.hypot(dx, dy)
          if (dist < ALCANCE && dist > 0.5) {
            const forca = (1 - dist / ALCANCE) ** 2
            // giro em volta do cursor + leve empurrão para fora: vira um redemoinho
            vx += (-dy / dist) * forca * 3.2 + (dx / dist) * forca * 0.8
            vy += (dx / dist) * forca * 3.2 + (dy / dist) * forca * 0.8
            alvoCalor = forca * 2.2
          }
        }
        p.calor += (Math.min(1, alvoCalor) - p.calor) * 0.08
        const x0 = p.x
        const y0 = p.y
        p.x += vx
        p.y += vy
        p.vida -= 1

        const k = p.calor
        const r = lr + (dr - lr) * k
        const g = lg + (dg - lg) * k
        const b = lb + (db - lb) * k
        ctx!.strokeStyle = `rgba(${r | 0},${g | 0},${b | 0},${0.16 + 0.55 * k})`
        ctx!.beginPath()
        ctx!.moveTo(x0, y0)
        ctx!.lineTo(p.x, p.y)
        ctx!.stroke()

        if (p.vida <= 0 || p.x < -10 || p.y < -10 || p.x > largura + 10 || p.y > altura + 10) Object.assign(p, nova())
      }
    }

    function animar(agora: number) {
      quadro = 0
      if (!visivel || document.hidden) return
      passo(agora)
      quadro = requestAnimationFrame(animar)
    }
    function acordar() {
      if (!quadro && visivel && !document.hidden && !parado) quadro = requestAnimationFrame(animar)
    }

    function aoMover(e: PointerEvent) {
      if (e.pointerType === 'touch') return // no celular o fundo só corre sozinho, o dedo não vira redemoinho
      const caixa = canvas!.getBoundingClientRect()
      cursor = { x: e.clientX - caixa.left, y: e.clientY - caixa.top }
    }
    const aoSair = () => { cursor = null }

    montar()
    acordar()
    const redimensionar = new ResizeObserver(() => { montar(); acordar() })
    redimensionar.observe(canvas)
    const naTela = new IntersectionObserver(([e]) => {
      visivel = e.isIntersecting
      acordar()
    })
    naTela.observe(canvas)
    const aoTrocarAba = () => acordar()
    document.addEventListener('visibilitychange', aoTrocarAba)
    // claro/escuro muda a classe do <html>: relê as cores e limpa os rastros da cor antiga
    const tema = new MutationObserver(() => {
      cores = coresDoTema()
      ctx.clearRect(0, 0, largura, altura)
      inicio = performance.now()
    })
    tema.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('pointermove', aoMover, { passive: true })
    document.addEventListener('pointerleave', aoSair)

    return () => {
      cancelAnimationFrame(quadro)
      redimensionar.disconnect()
      naTela.disconnect()
      tema.disconnect()
      document.removeEventListener('visibilitychange', aoTrocarAba)
      window.removeEventListener('pointermove', aoMover)
      document.removeEventListener('pointerleave', aoSair)
    }
  }, [])

  return (
    <canvas
      ref={tela}
      aria-hidden
      className={cn('pointer-events-none inset-0 size-full', fixo ? 'fixed h-svh w-screen' : 'absolute', className)}
    />
  )
}

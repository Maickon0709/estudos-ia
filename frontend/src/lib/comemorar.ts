import confetti from 'canvas-confetti'

const CORES = ['#c4643a', '#7aa37f', '#d9a441', '#5b6f9c', '#f3d9c4']

let disparar: confetti.CreateTypes | null = null

/** Canvas próprio e sem Web Worker: o padrão da biblioteca cria um worker a partir de um
 *  "blob:", que a nossa CSP (script-src 'self') bloqueia, e com razão. */
function canhao() {
  if (!disparar) {
    const canvas = document.createElement('canvas')
    canvas.setAttribute('aria-hidden', 'true')
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:60'
    document.body.appendChild(canvas)
    disparar = confetti.create(canvas, { resize: true, useWorker: false, disableForReducedMotion: true })
  }
  return disparar
}

/** Confete nas conquistas. Quem pede "menos movimento" no sistema não recebe animação. */
export function comemorar(intensidade: 'pequena' | 'grande' = 'pequena') {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const tiro = canhao()
  const base = { colors: CORES }
  if (intensidade === 'pequena') {
    void tiro({ ...base, particleCount: 70, spread: 70, origin: { y: 0.7 } })
    return
  }
  void tiro({ ...base, particleCount: 120, spread: 100, origin: { y: 0.6 } })
  setTimeout(() => void tiro({ ...base, particleCount: 60, angle: 60, spread: 60, origin: { x: 0 } }), 200)
  setTimeout(() => void tiro({ ...base, particleCount: 60, angle: 120, spread: 60, origin: { x: 1 } }), 350)
}

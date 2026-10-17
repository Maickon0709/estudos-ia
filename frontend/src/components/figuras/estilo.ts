/** Classes e contas comuns aos desenhos das figuras do chat. */
export const LINHA = 'stroke-foreground/70'
export const FORMA = 'fill-primary/15 stroke-primary'
export const COTA = 'stroke-muted-foreground'
export const TEXTO = 'fill-foreground text-[13px] font-medium'
export const TEXTO_SUAVE = 'fill-muted-foreground text-[11px]'

/** Ajusta as medidas reais numa caixa de desenho, mantendo a proporção (com um mínimo para não sumir). */
export function escala(a: number, b: number, maxA: number, maxB: number) {
  const k = Math.min(maxA / a, maxB / b)
  return [Math.max(a * k, maxA * 0.18), Math.max(b * k, maxB * 0.18)]
}

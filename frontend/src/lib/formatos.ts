import type { Nivel, StatusEtapa } from './tipos'

export const NOME_NIVEL: Record<Nivel, string> = {
  basico: 'Básico',
  intermediario: 'Intermediário',
  avancado: 'Avançado',
}

export const NOME_STATUS: Record<StatusEtapa, string> = {
  nao_iniciado: 'Não iniciada',
  em_andamento: 'Em andamento',
  concluido: 'Concluída',
}

export const LETRAS = 'ABCDEFGH'

export function duracao(segundos?: number | null): string | null {
  if (!segundos) return null
  const h = Math.floor(segundos / 3600)
  const min = Math.round((segundos % 3600) / 60)
  return h ? `${h}h${String(min).padStart(2, '0')}` : `${min} min`
}

/** "2026-10-10" -> "10/10" sem passar por Date (evita erro de fuso). */
export function diaMes(isoData: string): string {
  const [, mes, dia] = isoData.slice(0, 10).split('-')
  return `${dia}/${mes}`
}

export function porcentagem(valor: number): string {
  return `${Math.round(valor)}%`
}

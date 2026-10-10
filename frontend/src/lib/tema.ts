import { useSyncExternalStore } from 'react'

export type Tema = 'claro' | 'escuro'
const CHAVE = 'estudos-ia:tema'

function preferido(): Tema {
  try {
    const salvo = localStorage.getItem(CHAVE)
    if (salvo === 'claro' || salvo === 'escuro') return salvo
  } catch {
    /* sem localStorage: segue o sistema */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'escuro' : 'claro'
}

/** Aplica o tema na tag <html>. Chamado antes do React montar, para não piscar. */
export function aplicarTema(tema: Tema = preferido()) {
  document.documentElement.classList.toggle('dark', tema === 'escuro')
  document.documentElement.style.colorScheme = tema === 'escuro' ? 'dark' : 'light'
}

export function trocarTema() {
  const novo: Tema = temaAtual() === 'escuro' ? 'claro' : 'escuro'
  try { localStorage.setItem(CHAVE, novo) } catch { /* só nesta visita */ }
  aplicarTema(novo)
  window.dispatchEvent(new Event('tema-mudou'))
}

function temaAtual(): Tema {
  return document.documentElement.classList.contains('dark') ? 'escuro' : 'claro'
}

function assinar(aoMudar: () => void) {
  window.addEventListener('tema-mudou', aoMudar)
  return () => window.removeEventListener('tema-mudou', aoMudar)
}

export function useTema(): Tema {
  return useSyncExternalStore(assinar, temaAtual)
}

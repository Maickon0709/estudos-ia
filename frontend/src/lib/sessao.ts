import { useSyncExternalStore } from 'react'

// O token fica em cookie HttpOnly (o JS não lê). Aqui guardamos só um "sim/não" no
// navegador, para a primeira tela abrir certa sem esperar o servidor; ao carregar,
// o app confere com o servidor (api.verificarSessao) e corrige se preciso.
const CHAVE = 'estudos-ia:logado'

function lerDica(): boolean {
  try {
    return localStorage.getItem(CHAVE) === '1'
  } catch {
    return false
  }
}

let logado = lerDica()

// Versões antigas guardavam o token aqui. Some com ele: o login agora é cookie HttpOnly.
try { localStorage.removeItem('estudos-ia:sessao') } catch { /* nada a limpar */ }

export function estaLogado(): boolean {
  return logado
}

export function definirLogado(valor: boolean) {
  if (valor === logado) return
  logado = valor
  try {
    if (valor) localStorage.setItem(CHAVE, '1')
    else localStorage.removeItem(CHAVE)
  } catch {
    /* sem localStorage: vale só nesta aba */
  }
  window.dispatchEvent(new Event('sessao-mudou'))
}

// Login ou logout em outra aba também atualiza esta.
window.addEventListener('storage', (e) => {
  if (e.key === CHAVE) {
    logado = e.newValue === '1'
    window.dispatchEvent(new Event('sessao-mudou'))
  }
})

function assinar(aoMudar: () => void) {
  window.addEventListener('sessao-mudou', aoMudar)
  return () => window.removeEventListener('sessao-mudou', aoMudar)
}

export function useLogado(): boolean {
  return useSyncExternalStore(assinar, estaLogado)
}

// Regras de segurança do front. O back-end já garante cada uma; aqui é a segunda barreira.

/**
 * Só http/https viram link clicável. Bloqueia `javascript:`, `data:` e afins,
 * que executariam código no navegador do usuário se chegassem a um href.
 */
export function urlSegura(url: unknown): string | null {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null
  } catch {
    return null
  }
}

/** Atributos para links externos: nova aba sem dar acesso a `window.opener`. */
export const LINK_EXTERNO = { target: '_blank', rel: 'noopener noreferrer nofollow' } as const

// Limites iguais aos do back-end, para o usuário ver o erro antes de enviar.
export const LIMITES = {
  nomeCategoria: 80,
  mensagem: 4000,
  objetivo: 300,
  resposta: 2000,
} as const

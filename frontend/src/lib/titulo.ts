import { useEffect } from 'react'

const SITE = 'Estudos IA'
export const DESCRICAO_PADRAO =
  'Plataforma de estudos com IA tutora: trilhas com vídeos e sites verificados, exercícios, flashcards, simulados e revisão espaçada.'

function meta(seletor: string, atributo: 'name' | 'property', chave: string, valor: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(seletor)
  if (!tag) {
    tag = document.createElement('meta')
    tag.setAttribute(atributo, chave)
    document.head.appendChild(tag)
  }
  tag.content = valor
}

/** Título da aba e descrição da página (Google e prévias de link): "Português · Estudos IA". */
export function useTitulo(titulo?: string | null, descricao: string = DESCRICAO_PADRAO) {
  useEffect(() => {
    const completo = titulo ? `${titulo} · ${SITE}` : `${SITE}: estude qualquer assunto com uma IA tutora`
    document.title = completo
    meta('meta[name="description"]', 'name', 'description', descricao)
    meta('meta[property="og:title"]', 'property', 'og:title', completo)
    meta('meta[property="og:description"]', 'property', 'og:description', descricao)
  }, [titulo, descricao])
}

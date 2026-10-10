import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

/** Dados da conta + endereço da foto. A data da foto vai na URL: trocou a foto, troca o cache. */
export function useFotoDePerfil() {
  const conta = useQuery({ queryKey: ['conta'], queryFn: api.conta })
  const versao = conta.data?.avatar_atualizado_em
  // Com a sessão em cookie, o <img> busca a foto direto na API (que confere quem é o dono).
  return { conta: conta.data, url: versao ? api.urlAvatar(versao) : undefined }
}

export function Avatar({ className, tamanho = 'sm' }: { className?: string; tamanho?: 'sm' | 'lg' }) {
  const { conta, url } = useFotoDePerfil()
  const inicial = (conta?.nome || conta?.email || '?').trim().charAt(0).toUpperCase()
  const classe = cn(
    'grid shrink-0 place-items-center overflow-hidden rounded-[30%] bg-accent font-semibold text-accent-foreground',
    tamanho === 'lg' ? 'size-24 text-3xl' : 'size-8 text-sm',
    className,
  )
  return url
    ? <img src={url} alt={`Foto de perfil de ${conta?.nome || 'você'}`} className={cn(classe, 'object-cover')} />
    : <span className={classe} aria-hidden>{inicial}</span>
}

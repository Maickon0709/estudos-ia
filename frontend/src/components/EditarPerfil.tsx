import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Camera, Check, Pencil, Trash2, X } from '@/lib/icones'
import { useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Avatar } from '@/components/Avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { Conta } from '@/lib/api'
import { api } from '@/lib/api'

const TIPOS = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

/** Foto e nome. A API valida e regrava a imagem; aqui só evitamos enviar o que já sabemos que será recusado. */
export function EditarPerfil({ conta }: { conta: Conta }) {
  const queryClient = useQueryClient()
  const arquivo = useRef<HTMLInputElement>(null)
  const [editando, setEditando] = useState(false)
  const [nome, setNome] = useState(conta.nome ?? '')

  const atualizar = (nova: Conta) => queryClient.setQueryData(['conta'], nova)
  const enviar = useMutation({
    mutationFn: api.enviarAvatar,
    onSuccess: (nova) => { atualizar(nova); toast.success('Foto atualizada.') },
  })
  const remover = useMutation({
    mutationFn: api.removerAvatar,
    onSuccess: () => {
      queryClient.setQueryData<Conta>(['conta'], (c) => c && { ...c, avatar_atualizado_em: null })
      toast.success('Foto removida.')
    },
  })
  const renomear = useMutation({
    mutationFn: () => api.renomear(nome),
    onSuccess: (nova) => { atualizar(nova); setEditando(false); toast.success('Nome atualizado.') },
  })

  function aoEscolher(e: ChangeEvent<HTMLInputElement>) {
    const foto = e.target.files?.[0]
    e.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!foto) return
    if (!TIPOS.includes(foto.type)) return void toast.error('Use uma imagem JPG, PNG ou WebP.')
    if (foto.size > MAX_BYTES) return void toast.error('A imagem pode ter no máximo 5 MB.')
    enviar.mutate(foto)
  }

  function aoSalvarNome(e: FormEvent) {
    e.preventDefault()
    if (nome.trim()) renomear.mutate()
  }

  const ocupado = enviar.isPending || remover.isPending
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative">
        <Avatar tamanho="lg" className={ocupado ? 'opacity-60' : undefined} />
        <Button
          size="icon-sm"
          className="absolute -right-1 -bottom-1 rounded-full shadow"
          onClick={() => arquivo.current?.click()}
          disabled={ocupado}
          aria-label={conta.avatar_atualizado_em ? 'Trocar foto de perfil' : 'Enviar foto de perfil'}
          title="Trocar foto"
        >
          <Camera />
        </Button>
        <input ref={arquivo} type="file" accept={TIPOS.join(',')} className="hidden" onChange={aoEscolher} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col items-center gap-2 sm:items-start">
        {editando ? (
          <form onSubmit={aoSalvarNome} className="flex w-full max-w-sm gap-2">
            <Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={80} aria-label="Seu nome" autoFocus />
            <Button type="submit" size="icon" disabled={!nome.trim() || renomear.isPending} aria-label="Salvar nome"><Check /></Button>
            <Button type="button" size="icon" variant="ghost" onClick={() => { setEditando(false); setNome(conta.nome ?? '') }} aria-label="Cancelar"><X /></Button>
          </form>
        ) : (
          <p className="flex items-center gap-2 font-heading text-2xl font-semibold">
            {conta.nome || 'Sem nome'}
            <Button size="icon-xs" variant="ghost" onClick={() => setEditando(true)} aria-label="Editar nome" title="Editar nome"><Pencil /></Button>
          </p>
        )}
        <p className="text-sm break-all text-muted-foreground">{conta.email}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => arquivo.current?.click()} disabled={ocupado}>
            <Camera /> {enviar.isPending ? 'Enviando…' : conta.avatar_atualizado_em ? 'Trocar foto' : 'Adicionar foto'}
          </Button>
          {conta.avatar_atualizado_em && (
            <Button size="sm" variant="ghost" onClick={() => remover.mutate()} disabled={ocupado}><Trash2 /> Remover</Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG ou WebP, até 5 MB. A foto é recortada em quadrado e os dados ocultos (como localização) são apagados.</p>
        {(enviar.isError || remover.isError || renomear.isError) && (
          <p className="text-sm text-destructive" role="alert">{(enviar.error ?? remover.error ?? renomear.error)?.message}</p>
        )}
      </div>
    </div>
  )
}

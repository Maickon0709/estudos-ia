import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, PartyPopper, RotateCcw, Undo2 } from '@/lib/icones'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { comemorar } from '@/lib/comemorar'
import { diaMes } from '@/lib/formatos'
import type { Flashcard } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Cartao = Pick<Flashcard, 'id' | 'frente' | 'verso'> & { contexto?: string }

/** Estudo de flashcards: vira o cartão, responde se lembrou e a revisão espaçada agenda o próximo. */
export function Baralho({ cartoes, aoTerminar }: { cartoes: Cartao[]; aoTerminar?: () => void }) {
  const queryClient = useQueryClient()
  const [fila] = useState(cartoes) // congela a ordem desta sessão de estudo
  const [indice, setIndice] = useState(0)
  const [virado, setVirado] = useState(false)
  const [lembrados, setLembrados] = useState(0)
  const [proxima, setProxima] = useState<string | null>(null)

  const revisar = useMutation({
    mutationFn: ({ id, lembrei }: { id: string; lembrei: boolean }) => api.revisarFlashcard(id, lembrei),
    onSuccess: (cartao, { lembrei }) => {
      if (lembrei) setLembrados((n) => n + 1)
      setProxima(cartao.dominado ? 'dominado' : cartao.proxima_revisao)
      setVirado(false)
      setIndice((i) => i + 1)
      if (indice + 1 >= fila.length) {
        queryClient.invalidateQueries({ queryKey: ['flashcards-hoje'] })
        queryClient.invalidateQueries({ queryKey: ['hoje'] })
        queryClient.invalidateQueries({ queryKey: ['flashcards'] })
        comemorar(lembrei && lembrados + 1 === fila.length ? 'grande' : 'pequena')
      }
    },
  })

  if (indice >= fila.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-10 text-center">
        <PartyPopper className="size-8 text-primary" />
        <h3 className="text-xl font-semibold">Sessão concluída</h3>
        <p className="text-sm text-muted-foreground">
          Você lembrou de {lembrados} de {fila.length} {fila.length === 1 ? 'cartão' : 'cartões'}. Os que você esqueceu voltam amanhã.
        </p>
        {aoTerminar && <Button variant="outline" onClick={aoTerminar}><Undo2 /> Voltar</Button>}
      </div>
    )
  }

  const atual = fila[indice]
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>Cartão {indice + 1} de {fila.length}</span>
        <Progress value={(100 * indice) / fila.length} className="flex-1" aria-label="Progresso da sessão" />
        {proxima && <span>{proxima === 'dominado' ? 'Último: dominado' : `Último volta em ${diaMes(proxima)}`}</span>}
      </div>

      <button
        type="button"
        onClick={() => setVirado((v) => !v)}
        className="group h-64 w-full [perspective:1200px] focus-visible:outline-none"
        aria-label={virado ? 'Mostrar a pergunta' : 'Mostrar a resposta'}
      >
        <div
          className={cn(
            'relative size-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d] motion-reduce:transition-none',
            'group-focus-visible:ring-2 group-focus-visible:ring-ring',
            virado && '[transform:rotateY(180deg)]',
          )}
        >
          <Face rotulo={atual.contexto ?? 'Pergunta'} dica="Toque para ver a resposta">{atual.frente}</Face>
          <Face rotulo="Resposta" verso>{atual.verso}</Face>
        </div>
      </button>

      <div className="grid grid-cols-2 gap-3">
        <Button variant="outline" size="lg" disabled={!virado || revisar.isPending}
          onClick={() => revisar.mutate({ id: atual.id, lembrei: false })}>
          <RotateCcw /> Esqueci
        </Button>
        <Button size="lg" disabled={!virado || revisar.isPending}
          onClick={() => revisar.mutate({ id: atual.id, lembrei: true })}>
          <Check /> Lembrei
        </Button>
      </div>
      {!virado && <p className="-mt-2 text-center text-xs text-muted-foreground">Pense na resposta e vire o cartão.</p>}
      {revisar.isError && <p className="text-center text-sm text-destructive">{revisar.error.message}</p>}
    </div>
  )
}

export function Face({ children, rotulo, dica, verso = false }: { children: string; rotulo: string; dica?: string; verso?: boolean }) {
  return (
    <div
      className={cn(
        'absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl border p-6 text-center [backface-visibility:hidden]',
        verso ? 'bg-accent/40 [transform:rotateY(180deg)]' : 'bg-card',
      )}
    >
      <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{rotulo}</span>
      <p className={cn('font-heading leading-snug', verso ? 'text-lg' : 'text-xl font-semibold')}>{children}</p>
      {dica && <span className="text-xs text-muted-foreground">{dica}</span>}
    </div>
  )
}

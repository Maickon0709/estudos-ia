import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Dumbbell, Layers, PartyPopper, Play } from '@/lib/icones'
import { useState } from 'react'
import { Baralho } from '@/components/Baralho'
import { Carregando, Erro, Vazio } from '@/components/Estados'
import { ExercicioCartao } from '@/components/ExercicioCartao'
import { Dica } from '@/components/Tutorial'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/lib/api'
import type { Revisao } from '@/lib/tipos'
import { useTitulo } from '@/lib/titulo'

export function PaginaRevisoes() {
  useTitulo('Revisões de hoje')
  const revisoes = useQuery({ queryKey: ['revisoes'], queryFn: api.revisoesHoje })
  const flashcards = useQuery({ queryKey: ['flashcards-hoje'], queryFn: api.flashcardsHoje })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold">Revisões de hoje</h1>
        <p className="text-muted-foreground">
          Errou, volta amanhã. Acertando, o intervalo cresce: 3, 7, 15 e 30 dias, até o conteúdo ficar dominado.
        </p>
      </div>

      <Dica id="revisoes" titulo="Revisão espaçada">
        Tudo que você errou ou ainda não domina aparece aqui no dia certo. Responda todo dia um pouco:
        é assim que o conteúdo fica na memória.
      </Dica>

      <Tabs defaultValue="exercicios" className="gap-6">
        <TabsList>
          <TabsTrigger value="exercicios"><Dumbbell /> Exercícios ({revisoes.data?.length ?? '…'})</TabsTrigger>
          <TabsTrigger value="flashcards"><Layers /> Flashcards ({flashcards.data?.length ?? '…'})</TabsTrigger>
        </TabsList>
        <TabsContent value="exercicios"><ExerciciosDoDia /></TabsContent>
        <TabsContent value="flashcards"><FlashcardsDoDia /></TabsContent>
      </Tabs>
    </div>
  )
}

function ExerciciosDoDia() {
  const queryClient = useQueryClient()
  const revisoes = useQuery({ queryKey: ['revisoes'], queryFn: api.revisoesHoje })
  // Guarda a lista do momento em que a página abriu: assim o cartão respondido
  // continua na tela mostrando a correção, em vez de sumir na hora.
  const [fixas, setFixas] = useState<Revisao[] | null>(null)
  const lista = fixas ?? revisoes.data

  function aoCorrigir() {
    if (!fixas && revisoes.data) setFixas(revisoes.data)
    queryClient.invalidateQueries({ queryKey: ['revisoes'] })
    queryClient.invalidateQueries({ queryKey: ['hoje'] })
  }

  if (revisoes.isPending) return <Carregando />
  if (revisoes.isError) return <Erro erro={revisoes.error} />
  if (lista?.length === 0) {
    return (
      <Vazio icone={<PartyPopper className="size-6" />} titulo="Nenhum exercício para hoje">
        Os exercícios que você errar voltam aqui no dia certo.
      </Vazio>
    )
  }
  return (
    <div className="cascata flex flex-col gap-6">
      {lista?.map((r, i) => (
        <div key={r.exercicio_id} className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">{r.categoria} · {r.etapa}</p>
          <ExercicioCartao exercicioId={r.exercicio_id} exercicio={r} numero={i + 1} onCorrigido={aoCorrigir} />
        </div>
      ))}
    </div>
  )
}

function FlashcardsDoDia() {
  const flashcards = useQuery({ queryKey: ['flashcards-hoje'], queryFn: api.flashcardsHoje })
  const [estudando, setEstudando] = useState(false)

  if (flashcards.isPending) return <Carregando />
  if (flashcards.isError) return <Erro erro={flashcards.error} />
  if (estudando) {
    const cartoes = flashcards.data.map((c) => ({ ...c, contexto: `${c.categoria} · ${c.etapa}` }))
    return <Baralho cartoes={cartoes} aoTerminar={() => setEstudando(false)} />
  }
  if (flashcards.data.length === 0) {
    return (
      <Vazio icone={<PartyPopper className="size-6" />} titulo="Nenhum flashcard para hoje">
        Gere flashcards na página de uma etapa. Eles voltam aqui no dia de revisar.
      </Vazio>
    )
  }
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border bg-card p-6">
      <p>
        <strong>{flashcards.data.length}</strong> {flashcards.data.length === 1 ? 'cartão espera' : 'cartões esperam'} por você,
        de {new Set(flashcards.data.map((c) => c.categoria_id)).size} categoria(s).
      </p>
      <Button size="lg" onClick={() => setEstudando(true)}><Play /> Começar a revisão</Button>
    </div>
  )
}

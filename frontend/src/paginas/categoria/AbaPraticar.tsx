import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Dumbbell, Layers, RotateCcw, Route } from 'lucide-react'
import { Link } from 'react-router'
import { Carregando, Erro, Vazio } from '@/components/Estados'
import { Dica } from '@/components/Tutorial'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { api } from '@/lib/api'
import { NOME_STATUS } from '@/lib/formatos'
import { cn } from '@/lib/utils'
import { AbaSimulado } from './AbaSimulado'

/** Tudo para praticar numa categoria: exercícios e flashcards por etapa, revisões e simulado. */
export function AbaPraticar({ categoriaId, irParaConversa }: { categoriaId: string; irParaConversa: () => void }) {
  const trilhas = useQuery({ queryKey: ['trilhas', categoriaId], queryFn: () => api.trilhas(categoriaId) })
  const trilhaId = trilhas.data?.[0]?.id
  const trilha = useQuery({ queryKey: ['trilha', trilhaId], queryFn: () => api.trilha(trilhaId!), enabled: !!trilhaId })
  const revisoes = useQuery({ queryKey: ['revisoes'], queryFn: api.revisoesHoje })
  const flashcards = useQuery({ queryKey: ['flashcards-hoje'], queryFn: api.flashcardsHoje })

  if (trilhas.isPending || (trilhaId && trilha.isPending)) return <Carregando />
  if (trilhas.isError) return <Erro erro={trilhas.error} />
  if (!trilhaId) {
    return (
      <Vazio icone={<Route className="size-6" />} titulo="Primeiro, monte uma trilha">
        <p>Os exercícios, flashcards e simulados nascem das etapas da trilha. Peça uma à tutora na conversa.</p>
        <Button className="mt-4" onClick={irParaConversa}>Ir para a conversa</Button>
      </Vazio>
    )
  }
  if (trilha.isError) return <Erro erro={trilha.error} />

  const revisoesAqui = revisoes.data?.filter((r) => r.categoria_id === categoriaId).length ?? 0
  const flashcardsAqui = flashcards.data?.filter((f) => f.categoria_id === categoriaId).length ?? 0
  const base = `/categorias/${categoriaId}/trilhas/${trilhaId}/etapas`

  return (
    <div className="flex flex-col gap-6">
      <Dica id="praticar" titulo="Hora de praticar">
        Escolha uma etapa e gere exercícios (básico, intermediário e avançado) ou flashcards. Quando tiver
        alguns exercícios, faça um simulado com tempo marcado aqui embaixo.
      </Dica>
      {revisoesAqui + flashcardsAqui > 0 && (
        <Link to="/revisoes" className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-accent/40 px-5 py-4 transition-colors hover:bg-accent">
          <RotateCcw className="size-5 text-primary" />
          <span className="flex-1 text-sm">
            Hoje tem <strong>{revisoesAqui} exercício(s)</strong> e <strong>{flashcardsAqui} flashcard(s)</strong> desta categoria para revisar.
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-heading text-xl"><Dumbbell className="size-5 text-primary" /> Praticar por etapa</CardTitle>
          <CardDescription>
            Exercícios em três níveis (básico, intermediário e avançado) e flashcards gerados dos materiais de cada etapa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="cascata flex flex-col gap-2">
            {trilha.data?.etapas.map((e) => {
              const feita = e.status === 'concluido'
              return (
                <li key={e.id} className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span className={cn('grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
                      feita ? 'bg-sucesso text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                      {feita ? <CircleCheck className="size-4" /> : e.ordem}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{e.titulo}</span>
                      <span className="text-xs text-muted-foreground">{NOME_STATUS[e.status]}</span>
                    </span>
                  </span>
                  <span className="flex gap-2 sm:shrink-0">
                    <Button asChild size="sm" variant="secondary" className="flex-1 sm:flex-none">
                      <Link to={`${base}/${e.id}?aba=exercicios`}><Dumbbell /> Exercícios</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-none">
                      <Link to={`${base}/${e.id}?aba=flashcards`}><Layers /> Flashcards</Link>
                    </Button>
                  </span>
                </li>
              )
            })}
          </ol>
        </CardContent>
      </Card>

      <AbaSimulado categoriaId={categoriaId} />
    </div>
  )
}

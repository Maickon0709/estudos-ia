import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, CircleCheck, Dumbbell, Route } from '@/lib/icones'
import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { ComoCriarTrilha } from '@/components/ComoCriarTrilha'
import { Carregando, Erro, Vazio } from '@/components/Estados'
import { MapaTrilha as Mapa } from '@/components/MapaTrilha'
import { RecursoItem } from '@/components/RecursoItem'
import { Dica } from '@/components/Tutorial'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/api'
import { comemorar } from '@/lib/comemorar'
import { NOME_STATUS } from '@/lib/formatos'
import type { Etapa, StatusEtapa, Trilha } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Props = { categoriaId: string; irParaConversa: () => void; montarTrilha: () => void }

export function AbaTrilha({ categoriaId, irParaConversa, montarTrilha }: Props) {
  const trilhas = useQuery({ queryKey: ['trilhas', categoriaId], queryFn: () => api.trilhas(categoriaId) })
  const [escolhida, setEscolhida] = useState<string | null>(null)
  const trilhaId = escolhida ?? trilhas.data?.[0]?.id // a mais recente por padrão

  if (trilhas.isPending) return <Carregando />
  if (trilhas.isError) return <Erro erro={trilhas.error} />
  if (!trilhaId) {
    return (
      <Vazio icone={<Route className="size-6" />} titulo="Nenhuma trilha ainda">
        <p className="mb-6">Uma trilha organiza o assunto em etapas, do básico ao avançado. Veja como criar a sua:</p>
        <ComoCriarTrilha montarTrilha={montarTrilha} irParaConversa={irParaConversa} />
      </Vazio>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {trilhas.data.length > 1 && (
        <Select value={trilhaId} onValueChange={setEscolhida}>
          <SelectTrigger className="w-full sm:w-96" aria-label="Escolher trilha"><SelectValue /></SelectTrigger>
          <SelectContent>
            {trilhas.data.map((t) => <SelectItem key={t.id} value={t.id}>{t.titulo}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
      <DetalheTrilha trilhaId={trilhaId} categoriaId={categoriaId} />
    </div>
  )
}

function DetalheTrilha({ trilhaId, categoriaId }: { trilhaId: string; categoriaId: string }) {
  const trilha = useQuery({ queryKey: ['trilha', trilhaId], queryFn: () => api.trilha(trilhaId) })

  if (trilha.isPending) return <Carregando />
  if (trilha.isError) return <Erro erro={trilha.error} />
  const { progresso } = trilha.data

  return (
    <div className="flex flex-col gap-6">
      <Dica id="trilha" titulo="Seu mapa de estudos">
        O marcador mostra onde você está. Em cada etapa, abra os materiais, mude o status quando avançar
        ou marque “já sei este conteúdo” para pular o básico.
      </Dica>
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-2xl">{trilha.data.titulo}</CardTitle>
          <CardDescription>
            {progresso.concluidas} de {progresso.total} etapas concluídas
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <Progress value={progresso.pct} aria-label="Progresso da trilha" />
          <Mapa etapas={trilha.data.etapas} />
        </CardContent>
      </Card>

      <ol className="cascata flex flex-col gap-4">
        {trilha.data.etapas.map((etapa) => (
          <EtapaCard key={etapa.id} etapa={etapa} trilhaId={trilhaId} categoriaId={categoriaId} />
        ))}
      </ol>
    </div>
  )
}

function EtapaCard({ etapa, trilhaId, categoriaId }: { etapa: Etapa; trilhaId: string; categoriaId: string }) {
  const queryClient = useQueryClient()
  const atualizar = useMutation({
    mutationFn: (campos: { status?: StatusEtapa; ja_sabia?: boolean }) => api.atualizarEtapa(etapa.id, campos),
    onMutate: async (campos) => {
      // Atualização otimista: o checklist responde na hora, e volta atrás se a API recusar.
      await queryClient.cancelQueries({ queryKey: ['trilha', trilhaId] })
      const anterior = queryClient.getQueryData<Trilha>(['trilha', trilhaId])
      queryClient.setQueryData<Trilha>(['trilha', trilhaId], (t) => t && recalcular({
        ...t,
        etapas: t.etapas.map((e) => (e.id === etapa.id ? { ...e, ...campos } : e)),
      }))
      return { anterior }
    },
    onError: (_e, _c, contexto) => queryClient.setQueryData(['trilha', trilhaId], contexto?.anterior),
    onSuccess: (_r, campos) => {
      if (campos.status !== 'concluido') return
      const trilha = queryClient.getQueryData<Trilha>(['trilha', trilhaId])
      if (trilha && trilha.etapas.every((e) => e.status === 'concluido')) {
        comemorar('grande')
        toast.success('Trilha concluída: do básico ao avançado.')
      } else {
        comemorar()
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['trilha', trilhaId] })
      queryClient.invalidateQueries({ queryKey: ['painel', categoriaId] })
    },
  })
  const concluida = etapa.status === 'concluido'

  return (
    <li id={`etapa-${etapa.id}`} className="scroll-mt-20">
      <Card className={cn(concluida && 'bg-sucesso-suave/40')}>
        <CardHeader className="gap-3">
          <div className="flex items-start gap-3">
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold',
                concluida ? 'bg-sucesso text-primary-foreground' : 'bg-secondary text-secondary-foreground',
              )}
            >
              {concluida ? <CircleCheck className="size-4" /> : etapa.ordem}
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <CardTitle className="text-lg">{etapa.titulo}</CardTitle>
              {etapa.descricao && <CardDescription>{etapa.descricao}</CardDescription>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 sm:pl-11">
            <Select value={etapa.status} onValueChange={(v) => atualizar.mutate({ status: v as StatusEtapa })}>
              <SelectTrigger size="sm" className="w-40" aria-label="Status da etapa"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(NOME_STATUS) as StatusEtapa[]).map((s) => (
                  <SelectItem key={s} value={s}>{NOME_STATUS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`sabia-${etapa.id}`}
                checked={etapa.ja_sabia}
                onCheckedChange={(v) => atualizar.mutate({ ja_sabia: v === true })}
              />
              <Label htmlFor={`sabia-${etapa.id}`} className="text-sm font-normal">Já sei este conteúdo</Label>
            </div>
            <Button asChild size="sm" variant="secondary" className="sm:ml-auto">
              <Link to={`/categorias/${categoriaId}/trilhas/${trilhaId}/etapas/${etapa.id}`}>
                <Dumbbell /> Praticar <ArrowRight />
              </Link>
            </Button>
          </div>
          {atualizar.isError && <p className="text-sm text-destructive sm:pl-11">{atualizar.error.message}</p>}
        </CardHeader>

        {etapa.recursos.length > 0 && (
          <CardContent className="flex flex-col gap-2 sm:pl-17">
            {etapa.recursos.map((r) => <RecursoItem key={r.id ?? r.url} recurso={r} />)}
          </CardContent>
        )}
      </Card>
    </li>
  )
}

function recalcular(t: Trilha): Trilha {
  const concluidas = t.etapas.filter((e) => e.status === 'concluido').length
  const total = t.etapas.length
  return { ...t, progresso: { concluidas, total, pct: total ? Math.round((1000 * concluidas) / total) / 10 : 0 } }
}


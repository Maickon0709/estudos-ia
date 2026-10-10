import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Dumbbell, Layers, Lock, Play, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Baralho } from '@/components/Baralho'
import { Carregando, Erro, Trabalhando, Vazio } from '@/components/Estados'
import { ExercicioCartao } from '@/components/ExercicioCartao'
import { Dica } from '@/components/Tutorial'
import { RecursoItem } from '@/components/RecursoItem'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErroApi, api } from '@/lib/api'
import { comemorar } from '@/lib/comemorar'
import { NOME_NIVEL, diaMes } from '@/lib/formatos'
import { useTitulo } from '@/lib/titulo'
import type { Correcao, Nivel } from '@/lib/tipos'

const NIVEIS: Nivel[] = ['basico', 'intermediario', 'avancado']

export function PaginaEtapa() {
  const { categoriaId = '', trilhaId = '', etapaId = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const aba = params.get('aba') === 'flashcards' ? 'flashcards' : 'exercicios'
  const trilha = useQuery({ queryKey: ['trilha', trilhaId], queryFn: () => api.trilha(trilhaId) })
  useTitulo(trilha.data?.etapas.find((e) => e.id === etapaId)?.titulo)

  if (trilha.isPending) return <Carregando />
  if (trilha.isError) return <Erro erro={trilha.error} />
  const etapa = trilha.data.etapas.find((e) => e.id === etapaId)
  if (!etapa) return <Erro erro={new Error('Etapa não encontrada nesta trilha.')} />

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link to={`/categorias/${categoriaId}?aba=praticar`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> {trilha.data.titulo}
        </Link>
        <h1 className="text-3xl font-semibold">{etapa.ordem}. {etapa.titulo}</h1>
        {etapa.descricao && <p className="text-muted-foreground">{etapa.descricao}</p>}
      </div>

      {etapa.recursos.length > 0 && (
        <details className="group rounded-2xl border bg-card p-4">
          <summary className="cursor-pointer text-sm font-medium">Materiais desta etapa ({etapa.recursos.length})</summary>
          <div className="mt-3 flex flex-col gap-2">
            {etapa.recursos.map((r) => <RecursoItem key={r.id ?? r.url} recurso={r} />)}
          </div>
        </details>
      )}

      <Dica id="etapa" titulo="Como os níveis funcionam">
        Comece pelo básico. Acertando 80% de pelo menos 3 exercícios, o intermediário libera (e depois o avançado).
        Errou e não entendeu? Clique em “Não entendi” para outra explicação.
      </Dica>

      <Tabs value={aba} onValueChange={(v) => setParams({ aba: v }, { replace: true })} className="gap-6">
        <TabsList>
          <TabsTrigger value="exercicios"><Dumbbell /> Exercícios</TabsTrigger>
          <TabsTrigger value="flashcards"><Layers /> Flashcards</TabsTrigger>
        </TabsList>
        <TabsContent value="exercicios">
          <Exercicios etapaId={etapaId} trilhaId={trilhaId} categoriaId={categoriaId} />
        </TabsContent>
        <TabsContent value="flashcards">
          <Flashcards etapaId={etapaId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function Exercicios({ etapaId, trilhaId, categoriaId }: { etapaId: string; trilhaId: string; categoriaId: string }) {
  const queryClient = useQueryClient()
  const [nivel, setNivel] = useState<Nivel>('basico')
  const acertos = useRef(new Map<string, boolean>()) // resultados desta visita, por exercício
  const exercicios = useQuery({
    queryKey: ['exercicios', etapaId, nivel],
    queryFn: () => api.exercicios(etapaId, nivel),
  })

  const gerar = useMutation({
    mutationFn: () => api.gerarExercicios(etapaId, nivel),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exercicios', etapaId, nivel] }),
  })

  function aoCorrigir(exercicioId: string, correcao: Correcao) {
    queryClient.invalidateQueries({ queryKey: ['trilha', trilhaId] })
    queryClient.invalidateQueries({ queryKey: ['painel', categoriaId] })
    queryClient.invalidateQueries({ queryKey: ['revisoes'] })
    queryClient.invalidateQueries({ queryKey: ['hoje'] })
    if (correcao.etapa) gerar.reset() // um nível pode ter sido liberado: some o aviso antigo de bloqueio

    acertos.current.set(exercicioId, correcao.correta)
    const lista = exercicios.data ?? []
    const respondeuTodos = lista.length >= 3 && lista.every((e) => acertos.current.has(e.id))
    if (respondeuTodos && lista.every((e) => acertos.current.get(e.id))) {
      comemorar('grande')
      toast.success(`Gabaritou o nível ${NOME_NIVEL[nivel].toLowerCase()}!`)
    } else if (correcao.etapa?.recomendacao === 'pode_concluir') {
      comemorar()
    }
  }

  // 409 ao gerar = nível ainda bloqueado pela trilha adaptativa (a API explica o motivo).
  const bloqueado = gerar.error instanceof ErroApi && gerar.error.status === 409

  return (
    <div className="flex flex-col gap-6">
      <Tabs value={nivel} onValueChange={(v) => { setNivel(v as Nivel); gerar.reset() }}>
        <TabsList>
          {NIVEIS.map((n) => <TabsTrigger key={n} value={n}>{NOME_NIVEL[n]}</TabsTrigger>)}
        </TabsList>
      </Tabs>

      {exercicios.isPending && <Carregando />}
      {exercicios.isError && <Erro erro={exercicios.error} />}

      {exercicios.data && (
        <div className="cascata flex flex-col gap-4">
          {exercicios.data.length === 0 && !gerar.isPending && !bloqueado && (
            <Vazio icone={<Sparkles className="size-6" />} titulo={`Nenhum exercício ${NOME_NIVEL[nivel].toLowerCase()} ainda`}>
              A IA cria as questões a partir dos materiais verificados desta etapa.
            </Vazio>
          )}
          {exercicios.data.map((ex, i) => (
            <ExercicioCartao key={ex.id} exercicioId={ex.id} exercicio={ex} numero={i + 1}
              onCorrigido={(c) => aoCorrigir(ex.id, c)} />
          ))}

          {bloqueado ? (
            <div className="flex items-start gap-3 rounded-2xl border border-dashed p-5 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>{gerar.error?.message}</p>
            </div>
          ) : gerar.isPending ? (
            <Trabalhando>A IA está criando 3 exercícios…</Trabalhando>
          ) : (
            <Button onClick={() => gerar.mutate()} className="self-start">
              <Sparkles /> Gerar 3 exercícios {NOME_NIVEL[nivel].toLowerCase()}s
            </Button>
          )}
          {gerar.isError && !bloqueado && <p className="text-sm text-destructive">{gerar.error.message}</p>}
        </div>
      )}
    </div>
  )
}

function Flashcards({ etapaId }: { etapaId: string }) {
  const queryClient = useQueryClient()
  const [estudando, setEstudando] = useState(false)
  const cartoes = useQuery({ queryKey: ['flashcards', etapaId], queryFn: () => api.flashcards(etapaId) })
  const gerar = useMutation({
    mutationFn: () => api.gerarFlashcards(etapaId),
    onSuccess: (novos) => {
      toast.success(`${novos.length} flashcards criados.`)
      queryClient.invalidateQueries({ queryKey: ['flashcards', etapaId] })
      queryClient.invalidateQueries({ queryKey: ['flashcards-hoje'] })
      queryClient.invalidateQueries({ queryKey: ['hoje'] })
    },
  })

  if (cartoes.isPending) return <Carregando />
  if (cartoes.isError) return <Erro erro={cartoes.error} />

  const ativos = cartoes.data.filter((c) => !c.dominado)
  if (estudando) {
    return <Baralho cartoes={ativos} aoTerminar={() => { setEstudando(false); cartoes.refetch() }} />
  }

  return (
    <div className="flex flex-col gap-4">
      {cartoes.data.length === 0 && !gerar.isPending && (
        <Vazio icone={<Layers className="size-6" />} titulo="Nenhum flashcard ainda">
          A IA cria cartões de pergunta e resposta a partir dos materiais desta etapa. Ideal para fixar conceitos.
        </Vazio>
      )}

      {cartoes.data.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => setEstudando(true)} disabled={ativos.length === 0}>
              <Play /> Estudar {ativos.length} {ativos.length === 1 ? 'cartão' : 'cartões'}
            </Button>
            <span className="text-sm text-muted-foreground">
              {cartoes.data.length - ativos.length} dominado(s) de {cartoes.data.length}
            </span>
          </div>
          <ul className="cascata grid gap-3 sm:grid-cols-2">
            {cartoes.data.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <p className="font-medium">{c.frente}</p>
                <p className="text-sm text-muted-foreground">{c.verso}</p>
                <span className="mt-auto pt-1">
                  {c.dominado
                    ? <Badge variant="outline" className="border-sucesso/40 text-sucesso">Dominado</Badge>
                    : <Badge variant="secondary">Revisar em {diaMes(c.proxima_revisao)}</Badge>}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {gerar.isPending ? (
        <Trabalhando>A IA está criando os flashcards…</Trabalhando>
      ) : (
        <Button variant={cartoes.data.length ? 'outline' : 'default'} onClick={() => gerar.mutate()} className="self-start">
          <Sparkles /> {cartoes.data.length ? 'Gerar mais flashcards' : 'Gerar flashcards'}
        </Button>
      )}
      {gerar.isError && <p className="text-sm text-destructive">{gerar.error.message}</p>}
    </div>
  )
}

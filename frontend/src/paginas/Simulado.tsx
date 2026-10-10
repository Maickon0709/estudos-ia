import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CircleCheck, CircleX, Clock, Send, Trophy } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Carregando, Erro } from '@/components/Estados'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { comemorar } from '@/lib/comemorar'
import { LETRAS, NOME_NIVEL } from '@/lib/formatos'
import type { Simulado } from '@/lib/tipos'
import { useTitulo } from '@/lib/titulo'
import { cn } from '@/lib/utils'

export function PaginaSimulado() {
  const { simuladoId = '' } = useParams()
  useTitulo('Simulado')
  const simulado = useQuery({ queryKey: ['simulado', simuladoId], queryFn: () => api.simulado(simuladoId) })

  if (simulado.isPending) return <Carregando linhas={4} />
  if (simulado.isError) return <Erro erro={simulado.error} />
  return simulado.data.finalizado_em ? <Resultado s={simulado.data} /> : <Prova s={simulado.data} />
}

function relogio(segundos: number) {
  const s = Math.max(0, Math.ceil(segundos))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function Prova({ s }: { s: Simulado }) {
  const queryClient = useQueryClient()
  const chave = `estudos-ia:simulado:${s.id}`
  // As marcações sobrevivem a um recarregamento da página.
  const [respostas, setRespostas] = useState<Record<number, string>>(() => {
    try { return JSON.parse(localStorage.getItem(chave) ?? '{}') } catch { return {} }
  })
  const [restante, setRestante] = useState(() => (new Date(s.prazo_em).getTime() - Date.now()) / 1000)
  const [confirmar, setConfirmar] = useState(false)
  const enviou = useRef(false)

  const finalizar = useMutation({
    mutationFn: () => api.finalizarSimulado(s.id, respostas),
    onSuccess: (resultado) => {
      try { localStorage.removeItem(chave) } catch { /* nada a limpar */ }
      queryClient.setQueryData(['simulado', s.id], resultado)
      queryClient.invalidateQueries({ queryKey: ['simulados', s.categoria_id] })
      queryClient.invalidateQueries({ queryKey: ['hoje'] })
      if (resultado.acertos !== null && resultado.acertos / resultado.total >= 0.8) comemorar('grande')
    },
    onError: () => { enviou.current = false },
  })

  const entregar = useCallback(() => {
    if (enviou.current) return
    enviou.current = true
    finalizar.mutate()
  }, [finalizar])

  useEffect(() => {
    const id = setInterval(() => {
      const r = (new Date(s.prazo_em).getTime() - Date.now()) / 1000
      setRestante(r)
      // Tempo esgotado: entrega o que tiver. Se a entrega falhar, espera o clique (sem insistir sozinho).
      if (r <= 0 && !finalizar.isError) entregar()
    }, 500)
    return () => clearInterval(id)
  }, [s.prazo_em, entregar, finalizar.isError])

  function marcar(ordem: number, letra: string) {
    const novas = { ...respostas, [ordem]: letra }
    setRespostas(novas)
    try { localStorage.setItem(chave, JSON.stringify(novas)) } catch { /* só na memória */ }
  }

  const questoes = s.questoes ?? []
  const respondidas = questoes.filter((q) => respostas[q.ordem]).length
  const acabando = restante <= 60

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-14 z-10 -mx-4 border-b bg-background/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1.5 rounded-full px-3 py-1 font-heading text-lg font-semibold tabular-nums',
            acabando ? 'bg-destructive/10 text-destructive' : 'bg-accent text-accent-foreground')} aria-live="polite">
            <Clock className="size-4" /> {relogio(restante)}
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">{respondidas} de {questoes.length} respondidas</span>
          <Progress value={(100 * respondidas) / Math.max(1, questoes.length)} className="flex-1" aria-label="Questões respondidas" />
          <Button onClick={() => (respondidas < questoes.length ? setConfirmar(true) : entregar())} disabled={finalizar.isPending}>
            <Send /> {finalizar.isPending ? 'Corrigindo…' : 'Entregar'}
          </Button>
        </div>
        <nav className="mt-3 flex flex-wrap gap-1.5" aria-label="Ir para a questão">
          {questoes.map((q) => (
            <a key={q.ordem} href={`#questao-${q.ordem}`}
              className={cn('grid size-7 place-items-center rounded-lg text-xs font-medium',
                respostas[q.ordem] ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
              {q.ordem}
            </a>
          ))}
        </nav>
      </div>
      {finalizar.isError && <p className="text-sm text-destructive">{finalizar.error.message}</p>}

      {questoes.map((q) => (
        <Card key={q.ordem} id={`questao-${q.ordem}`} className="scroll-mt-40">
          <CardHeader className="gap-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium">Questão {q.ordem}</span>
              <Badge variant="secondary">{NOME_NIVEL[q.exercicio.nivel]}</Badge>
            </div>
            <p className="text-base leading-relaxed whitespace-pre-wrap">{q.exercicio.enunciado}</p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2" role="radiogroup" aria-label={`Alternativas da questão ${q.ordem}`}>
              {(q.exercicio.opcoes ?? []).map((opcao, i) => (
                <button key={i} type="button" role="radio" aria-checked={respostas[q.ordem] === LETRAS[i]}
                  onClick={() => marcar(q.ordem, LETRAS[i])}
                  className={cn('flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors hover:border-primary/40',
                    respostas[q.ordem] === LETRAS[i] && 'border-primary bg-accent/40')}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">{LETRAS[i]}</span>
                  <span className="pt-0.5">{opcao}</span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Entregar com questões em branco?</DialogTitle>
            <DialogDescription>
              Você respondeu {respondidas} de {questoes.length}. Questões em branco contam como erradas.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Continuar respondendo</Button></DialogClose>
            <Button onClick={() => { setConfirmar(false); entregar() }}>Entregar assim mesmo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Resultado({ s }: { s: Simulado }) {
  const acertos = s.acertos ?? 0
  const pct = Math.round((100 * acertos) / s.total)
  const mensagem = pct >= 80 ? 'Excelente! Você domina esse conteúdo.' : pct >= 50 ? 'Bom caminho! Revise os erros abaixo.' : 'Hora de reforçar: veja as explicações abaixo.'
  const duracao = s.finalizado_em ? Math.round((new Date(s.finalizado_em).getTime() - new Date(s.iniciado_em).getTime()) / 1000) : 0

  return (
    <div className="flex flex-col gap-6">
      <Link to={`/categorias/${s.categoria_id}?aba=praticar`} className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Voltar aos simulados
      </Link>

      <Card className={cn(pct >= 80 && 'border-sucesso/50')}>
        <CardContent className="flex flex-col items-center gap-3 py-4 text-center sm:flex-row sm:text-left">
          <span className={cn('grid size-24 shrink-0 place-items-center rounded-3xl font-heading text-3xl font-semibold',
            pct >= 80 ? 'bg-sucesso-suave text-sucesso' : pct >= 50 ? 'bg-accent text-accent-foreground' : 'bg-destructive/10 text-destructive')}>
            {pct}%
          </span>
          <div className="flex flex-col gap-1">
            <h1 className="flex items-center justify-center gap-2 text-2xl font-semibold sm:justify-start">
              {pct >= 80 && <Trophy className="size-6 text-chart-3" />} {acertos} de {s.total} acertos
            </h1>
            <p className="text-muted-foreground">{mensagem}</p>
            <p className="text-xs text-muted-foreground">
              Tempo usado: {relogio(duracao)} de {relogio(s.limite_segundos)}
              {s.dentro_do_prazo === false && ' · entregue fora do tempo'}
            </p>
          </div>
        </CardContent>
      </Card>

      {(s.questoes ?? []).map((q) => {
        const certa = q.exercicio.gabarito ? LETRAS.indexOf(q.exercicio.gabarito) : -1
        const marcada = q.resposta ? LETRAS.indexOf(q.resposta) : -1
        return (
          <Card key={q.ordem} className={cn(q.correta ? 'border-sucesso/40' : 'border-destructive/30')}>
            <CardHeader className="gap-2">
              <div className="flex items-center gap-2 text-xs">
                {q.correta
                  ? <span className="flex items-center gap-1 font-medium text-sucesso"><CircleCheck className="size-4" /> Acertou</span>
                  : <span className="flex items-center gap-1 font-medium text-destructive"><CircleX className="size-4" /> {q.resposta ? 'Errou' : 'Em branco'}</span>}
                <span className="text-muted-foreground">· Questão {q.ordem}</span>
              </div>
              <p className="text-base leading-relaxed whitespace-pre-wrap">{q.exercicio.enunciado}</p>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {(q.exercicio.opcoes ?? []).map((opcao, i) => (
                <div key={i} className={cn('flex items-start gap-3 rounded-xl border p-3 text-sm',
                  i === certa && 'border-sucesso bg-sucesso-suave',
                  i === marcada && i !== certa && 'border-destructive bg-destructive/10')}>
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">{LETRAS[i]}</span>
                  <span className="pt-0.5">{opcao}</span>
                </div>
              ))}
              {q.exercicio.explicacao && (
                <p className="rounded-xl bg-secondary/60 p-3 text-sm whitespace-pre-wrap text-secondary-foreground">{q.exercicio.explicacao}</p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

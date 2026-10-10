import { useMutation } from '@tanstack/react-query'
import { CalendarClock, CircleCheck, CircleHelp, CircleX, Lightbulb, Sparkles, Trophy } from '@/lib/icones'
import { useState } from 'react'
import { Markdown } from '@/components/Markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { LETRAS, NOME_NIVEL, diaMes } from '@/lib/formatos'
import { LIMITES } from '@/lib/seguranca'
import type { Correcao, Exercicio } from '@/lib/tipos'
import { cn } from '@/lib/utils'

type Props = {
  exercicioId: string
  exercicio: Pick<Exercicio, 'tipo' | 'enunciado' | 'opcoes' | 'nivel'>
  numero?: number
  onCorrigido?: (correcao: Correcao) => void
  /** Vitrine da landing: mostra uma resposta já corrigida, sem chamar a API. */
  demonstracao?: { escolha: number; correcao: Correcao }
}

export function ExercicioCartao({ exercicioId, exercicio, numero, onCorrigido, demonstracao }: Props) {
  const [escolha, setEscolha] = useState<number | null>(demonstracao?.escolha ?? null)
  const [texto, setTexto] = useState('')
  const multipla = exercicio.tipo === 'multipla_escolha'

  const responder = useMutation({
    mutationFn: () =>
      api.responder(exercicioId, multipla ? LETRAS[escolha ?? 0] : texto.trim()),
    onSuccess: (correcao) => onCorrigido?.(correcao),
  })
  const correcao = demonstracao?.correcao ?? responder.data
  const pronto = multipla ? escolha !== null : texto.trim().length > 0
  const letraCerta = correcao && multipla ? LETRAS.indexOf(correcao.gabarito) : -1

  return (
    <Card className={cn(correcao && (correcao.correta ? 'border-sucesso/50' : 'border-destructive/40'))}>
      <CardHeader className="gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {numero !== undefined && <span className="font-medium">Questão {numero}</span>}
          <Badge variant="secondary">{NOME_NIVEL[exercicio.nivel]}</Badge>
          <Badge variant="outline">{multipla ? 'Múltipla escolha' : 'Discursiva'}</Badge>
        </div>
        {/* Texto da IA renderizado como texto puro: nada vira HTML. */}
        <p className="whitespace-pre-wrap text-base leading-relaxed">{exercicio.enunciado}</p>
      </CardHeader>

      <CardContent>
        {multipla ? (
          <div className="flex flex-col gap-2" role="radiogroup">
            {(exercicio.opcoes ?? []).map((opcao, i) => {
              const certa = i === letraCerta
              const errada = correcao && i === escolha && !correcao.correta
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={escolha === i}
                  disabled={!!correcao || responder.isPending}
                  onClick={() => setEscolha(i)}
                  className={cn(
                    'flex items-start gap-3 rounded-xl border p-3 text-left text-sm transition-colors',
                    'enabled:hover:border-primary/40 enabled:hover:bg-accent/30',
                    escolha === i && !correcao && 'border-primary bg-accent/40',
                    certa && 'border-sucesso bg-sucesso-suave',
                    errada && 'border-destructive bg-destructive/10',
                  )}
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-lg bg-secondary text-xs font-semibold">
                    {LETRAS[i]}
                  </span>
                  <span className="pt-0.5">{opcao}</span>
                </button>
              )
            })}
          </div>
        ) : (
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={LIMITES.resposta}
            disabled={!!correcao || responder.isPending}
            placeholder="Escreva sua resposta com suas palavras…"
            rows={4}
          />
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-3">
        {!correcao && (
          <Button onClick={() => responder.mutate()} disabled={!pronto || responder.isPending} className="self-start">
            {responder.isPending ? (multipla ? 'Corrigindo…' : 'A IA está corrigindo…') : 'Responder'}
          </Button>
        )}
        {responder.isError && <p className="text-sm text-destructive">{responder.error.message}</p>}
        {correcao && <Resultado correcao={correcao} multipla={multipla} />}
        {correcao && !demonstracao && <NaoEntendi exercicioId={exercicioId} />}
      </CardFooter>
    </Card>
  )
}

function Resultado({ correcao, multipla }: { correcao: Correcao; multipla: boolean }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-secondary/60 p-4 text-sm">
      <p className={cn('flex items-center gap-2 font-semibold', correcao.correta ? 'text-sucesso' : 'text-destructive')}>
        {correcao.correta ? <CircleCheck className="size-4" /> : <CircleX className="size-4" />}
        {correcao.correta ? 'Correto' : multipla ? `Errou. A certa é a ${correcao.gabarito}.` : 'Ainda não'}
      </p>
      <p className="whitespace-pre-wrap text-secondary-foreground">{correcao.feedback}</p>
      {!multipla && (
        <p className="whitespace-pre-wrap text-muted-foreground">
          <span className="font-medium text-foreground">Resposta esperada: </span>
          {correcao.gabarito}
        </p>
      )}
      <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
        {correcao.dominado && (
          <span className="flex items-center gap-1 text-sucesso"><Trophy className="size-3.5" /> Conteúdo dominado: saiu das revisões</span>
        )}
        {correcao.revisao && (
          <span className="flex items-center gap-1">
            <CalendarClock className="size-3.5" /> Revisar em {diaMes(correcao.revisao.proxima_revisao)}
          </span>
        )}
        {correcao.etapa?.recomendacao === 'reforco' && (
          <span className="flex items-center gap-1 text-primary">
            <Sparkles className="size-3.5" /> Vale reforçar esta etapa antes de seguir
          </span>
        )}
        {correcao.etapa?.recomendacao === 'pode_concluir' && (
          <span className="flex items-center gap-1 text-sucesso">
            <Trophy className="size-3.5" /> Você domina a etapa: já pode marcá-la como concluída
          </span>
        )}
      </div>
    </div>
  )
}

/** Outra explicação da IA, mais simples e com analogia. Só aparece depois de responder. */
function NaoEntendi({ exercicioId }: { exercicioId: string }) {
  const explicar = useMutation({ mutationFn: () => api.explicar(exercicioId) })

  if (explicar.data) {
    return (
      <div className="flex gap-3 rounded-xl border border-primary/30 bg-accent/30 p-4 text-sm">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
        <Markdown texto={explicar.data.explicacao} />
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="self-start text-muted-foreground"
        onClick={() => explicar.mutate()}
        disabled={explicar.isPending}
      >
        <CircleHelp /> {explicar.isPending ? 'Pensando em outro jeito de explicar…' : 'Não entendi, explica de outro jeito'}
      </Button>
      {explicar.isError && <p className="text-sm text-destructive">{explicar.error.message}</p>}
    </div>
  )
}

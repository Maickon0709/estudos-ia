import { useEffect, useState, type ReactNode } from 'react'
import { Face } from '@/components/Baralho'
import { Bolha } from '@/components/Bolha'
import { Calendario } from '@/components/Calendario'
import { ExercicioCartao } from '@/components/ExercicioCartao'
import { MapaTrilha } from '@/components/MapaTrilha'
import { RecursoItem } from '@/components/RecursoItem'
import { Flame, Layers, MessageCircle, Route, Sparkles, Target, Trophy } from '@/lib/icones'
import { atividadeExemplo, ETAPAS_EXEMPLO, RECURSOS_EXEMPLO } from '@/lib/exemplos'
import { cn } from '@/lib/utils'

type Passo = { id: string; icone: typeof Route; titulo: string; texto: string; tela: ReactNode }

/** Tour da landing com os componentes REAIS do app, alimentados com dados de exemplo. */
export function TourProduto() {
  const [atual, setAtual] = useState(0)
  const [automatico, setAutomatico] = useState(true)

  useEffect(() => {
    if (!automatico || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setAtual((i) => (i + 1) % PASSOS.length), 7000)
    return () => clearInterval(id)
  }, [automatico])

  const passo = PASSOS[atual]

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.3fr)] lg:items-start">
      <ol className="flex flex-col" role="tablist" aria-label="Partes do tour">
        {PASSOS.map(({ id, icone: Icone, titulo, texto }, i) => {
          const ativo = i === atual
          return (
            <li key={id} className="border-b last:border-b-0">
              <button
                type="button"
                role="tab"
                aria-selected={ativo}
                aria-controls="tela-do-tour"
                onClick={() => { setAtual(i); setAutomatico(false) }}
                className="group relative flex w-full flex-col gap-1 py-4 text-left"
              >
                <span className="flex items-center gap-3">
                  <Icone className={cn('size-5 shrink-0 transition-colors', ativo ? 'text-primary' : 'text-muted-foreground')} weight={ativo ? 'fill' : 'regular'} />
                  <span className={cn('font-medium transition-colors', ativo ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground')}>
                    {titulo}
                  </span>
                </span>
                <span className={cn('grid transition-all duration-300', ativo ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <span className="overflow-hidden pl-8 text-sm text-muted-foreground">{texto}</span>
                </span>
                {ativo && automatico && (
                  <span key={atual} className="absolute -bottom-px left-0 h-px bg-primary motion-safe:animate-[progresso_7s_linear]" aria-hidden />
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <div id="tela-do-tour" role="tabpanel" aria-label={passo.titulo}
        className="pontilhado relative min-h-[26rem] overflow-hidden rounded-2xl border bg-muted/40 p-4 sm:p-6">
        <div key={passo.id} className="surgir">{passo.tela}</div>
      </div>
    </div>
  )
}

function TelaFlashcard() {
  const [virado, setVirado] = useState(false)
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setVirado((v) => !v), 2600)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <button type="button" onClick={() => setVirado((v) => !v)} className="h-60 w-full [perspective:1200px]" aria-label="Virar cartão de exemplo">
        <div className={cn('relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none',
          virado && '[transform:rotateY(180deg)]')}>
          <Face rotulo="Português · Crase" dica="Toque para ver a resposta">“Vou ___ praia amanhã” leva crase?</Face>
          <Face rotulo="Resposta" verso>Sim: “à praia”. Praia é feminina e o verbo “ir” pede a preposição “a”.</Face>
        </div>
      </button>
      <p className="text-center text-sm text-muted-foreground">Lembrou? O cartão volta em 3 dias. Esqueceu? Volta amanhã.</p>
    </div>
  )
}

function TelaProgresso() {
  const hoje = new Date().toISOString().slice(0, 10)
  return (
    <div className="flex flex-col gap-5">
      <dl className="grid grid-cols-3 gap-3">
        {([[Flame, '12', 'dias seguidos'], [Target, '4 de 5', 'dias na meta'], [Trophy, '9/10', 'no último simulado']] as const).map(([Icone, n, t]) => (
          <div key={t} className="rounded-xl bg-card p-3 sombra-suave">
            <Icone className="size-4 text-primary" weight="fill" />
            <dd className="mt-2 font-mono text-xl font-medium tracking-tight">{n}</dd>
            <dt className="text-xs text-muted-foreground">{t}</dt>
          </div>
        ))}
      </dl>
      <div className="rounded-xl bg-card p-4 sombra-suave">
        <Calendario atividade={atividadeExemplo(hoje)} hoje={hoje} semanas={20} />
      </div>
    </div>
  )
}

const PASSOS: Passo[] = [
  {
    id: 'conversa',
    icone: MessageCircle,
    titulo: 'Converse e escolha como estudar',
    texto: 'Conte o que quer aprender. A tutora sugere estudar pelo chat, montar uma trilha com vídeos e sites ou praticar.',
    tela: (
      <div className="flex flex-col gap-3">
        <Bolha mensagem={{ papel: 'user', conteudo: 'Quero aprender crase. Por onde começo?' }} />
        <Bolha mensagem={{
          papel: 'assistant',
          conteudo: 'Dá para estudar de três jeitos:\n\n1. **Aqui no chat**, passo a passo, com exemplos.\n2. **Uma trilha** com vídeos do YouTube e sites, todos conferidos.\n3. **Praticando** com exercícios e flashcards.\n\nQual você prefere?',
        }} />
      </div>
    ),
  },
  {
    id: 'trilha',
    icone: Route,
    titulo: 'Aprove sua trilha',
    texto: 'Materiais reais, cada link conferido, em etapas do básico ao avançado. Nada é criado antes do seu ok.',
    tela: (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl bg-card px-4 pb-2 sombra-suave"><MapaTrilha etapas={ETAPAS_EXEMPLO} /></div>
        <div className="flex flex-col gap-2">{RECURSOS_EXEMPLO.slice(0, 2).map((r) => <RecursoItem key={r.url} recurso={r} />)}</div>
      </div>
    ),
  },
  {
    id: 'praticar',
    icone: Sparkles,
    titulo: 'Pratique por nível',
    texto: 'Básico, intermediário e avançado. A correção sai na hora, com a explicação do porquê.',
    tela: (
      <ExercicioCartao
        exercicioId="exemplo"
        exercicio={{ tipo: 'multipla_escolha', nivel: 'basico', enunciado: 'Qual frase usa a crase corretamente?', opcoes: ['Vou a escola amanhã.', 'Vou à escola amanhã.', 'Vou á escola amanhã.'] }}
        demonstracao={{
          escolha: 1,
          correcao: {
            correta: true, gabarito: 'B', dominado: false, etapa: null, revisao: null,
            feedback: '“Escola” é feminina e aceita o artigo “a”: a preposição + o artigo viram “à”.',
            explicacao: null,
          },
        }}
      />
    ),
  },
  {
    id: 'flashcards',
    icone: Layers,
    titulo: 'Fixe com flashcards',
    texto: 'Vire o cartão e diga se lembrou. A revisão espaçada traz de volta no dia certo.',
    tela: <TelaFlashcard />,
  },
  {
    id: 'progresso',
    icone: Flame,
    titulo: 'Acompanhe a evolução',
    texto: 'Calendário de estudos, sequência de dias e meta da semana, tudo na tela Hoje.',
    tela: <TelaProgresso />,
  },
]

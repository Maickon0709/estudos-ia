import { BadgeCheck, Bot, CircleCheck, Flame, Layers, MessageCircle, Route, Sparkles, Trophy } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Passo = { id: string; icone: typeof Route; titulo: string; texto: string; tela: ReactNode }

const PASSOS: Passo[] = [
  {
    id: 'conversa',
    icone: MessageCircle,
    titulo: 'Converse e escolha como estudar',
    texto: 'Conte o que quer aprender. A tutora oferece três caminhos: estudar pelo chat, montar uma trilha com vídeos e sites ou praticar.',
    tela: <TelaConversa />,
  },
  {
    id: 'trilha',
    icone: Route,
    titulo: 'Aprove sua trilha',
    texto: 'Materiais reais, cada link conferido, organizados do básico ao avançado. Você revisa e confirma.',
    tela: <TelaTrilha />,
  },
  {
    id: 'praticar',
    icone: Sparkles,
    titulo: 'Pratique por nível',
    texto: 'Exercícios em três níveis com correção na hora. Não entendeu? Peça outra explicação.',
    tela: <TelaExercicio />,
  },
  {
    id: 'flashcards',
    icone: Layers,
    titulo: 'Fixe com flashcards',
    texto: 'Vire o cartão, diga se lembrou, e a revisão espaçada traz de volta no dia certo.',
    tela: <TelaFlashcard />,
  },
  {
    id: 'progresso',
    icone: Flame,
    titulo: 'Acompanhe a evolução',
    texto: 'Calendário de estudos, sequência de dias, metas da semana e pontos fracos.',
    tela: <TelaProgresso />,
  },
]

const INTERVALO = 6000

/** Tour da landing: mini telas ilustrativas (dados de exemplo) que mostram cada função. */
export function TourProduto() {
  const [atual, setAtual] = useState(0)
  const [automatico, setAutomatico] = useState(true)

  useEffect(() => {
    if (!automatico || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setAtual((i) => (i + 1) % PASSOS.length), INTERVALO)
    return () => clearInterval(id)
  }, [automatico])

  const escolher = (i: number) => { setAtual(i); setAutomatico(false) }
  const passo = PASSOS[atual]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr] lg:items-center">
      <ol className="flex flex-col gap-2" role="tablist" aria-label="Passos do tour">
        {PASSOS.map(({ id, icone: Icone, titulo, texto }, i) => {
          const ativo = i === atual
          return (
            <li key={id}>
              <button
                type="button"
                role="tab"
                aria-selected={ativo}
                aria-controls="tela-do-tour"
                onClick={() => escolher(i)}
                className={cn(
                  'relative w-full overflow-hidden rounded-2xl border p-4 text-left transition-colors',
                  ativo ? 'border-primary/50 bg-card shadow-sm' : 'border-transparent hover:bg-card/60',
                )}
              >
                <span className="flex items-center gap-3">
                  <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl transition-colors',
                    ativo ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground')}>
                    <Icone className="size-4" />
                  </span>
                  <span className="font-semibold">{titulo}</span>
                </span>
                <span className={cn('grid transition-all duration-300', ativo ? 'mt-2 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
                  <span className="overflow-hidden pl-12 text-sm text-muted-foreground">{texto}</span>
                </span>
                {ativo && automatico && (
                  <span key={atual} className="absolute bottom-0 left-0 h-0.5 bg-primary motion-safe:animate-[progresso_6s_linear]" aria-hidden />
                )}
              </button>
            </li>
          )
        })}
      </ol>

      <div id="tela-do-tour" role="tabpanel" aria-label={passo.titulo}
        className="relative rounded-3xl border bg-card/80 p-2 shadow-xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center gap-1.5 px-3 py-2">
          {['bg-destructive/60', 'bg-chart-3/70', 'bg-sucesso/60'].map((c) => <span key={c} className={cn('size-2.5 rounded-full', c)} />)}
          <span className="ml-3 text-xs text-muted-foreground">Exemplo · {passo.titulo}</span>
        </div>
        <div key={passo.id} className="surgir min-h-80 rounded-2xl bg-background p-5">{passo.tela}</div>
      </div>
    </div>
  )
}

// ---------- mini telas (ilustrativas) ----------
function Bolha({ ia, children }: { ia?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex gap-2', !ia && 'flex-row-reverse')}>
      {ia && <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground"><Bot className="size-3.5" /></span>}
      <div className={cn('max-w-[85%] rounded-2xl px-3 py-2 text-sm', ia ? 'rounded-tl-sm bg-secondary' : 'rounded-tr-sm bg-primary text-primary-foreground')}>{children}</div>
    </div>
  )
}

function TelaConversa() {
  return (
    <div className="cascata flex flex-col gap-3">
      <Bolha>Quero aprender crase. Por onde começo?</Bolha>
      <Bolha ia>
        <p>Boa! Você pode estudar de três jeitos:</p>
        <ol className="mt-1 list-decimal pl-4">
          <li><strong>Aqui no chat</strong>, passo a passo</li>
          <li><strong>Trilha com vídeos e sites</strong> verificados</li>
          <li><strong>Praticar</strong> com exercícios e flashcards</li>
        </ol>
        <p className="mt-1">Qual prefere?</p>
      </Bolha>
      <div className="flex flex-wrap gap-2 pt-1">
        {['Me ensine aqui pelo chat', 'Trilha com vídeos e sites', 'Me teste com perguntas'].map((t) => (
          <span key={t} className="rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">{t}</span>
        ))}
      </div>
    </div>
  )
}

function TelaTrilha() {
  const etapas = [['O que é crase', 'feita'], ['Regras obrigatórias', 'aqui'], ['Casos especiais', ''], ['Simulado final', '']] as const
  return (
    <div className="flex flex-col gap-4">
      <p className="font-heading text-lg font-semibold">Crase do básico ao avançado</p>
      <div className="flex items-start">
        {etapas.map(([titulo, estado], i) => (
          <div key={titulo} className="flex items-start">
            {i > 0 && <span className={cn('mt-[18px] h-1 w-6 rounded-full sm:w-10', i === 1 ? 'bg-sucesso' : 'bg-border')} />}
            <div className="flex w-16 flex-col items-center gap-1 text-center">
              <span className={cn('relative grid size-10 place-items-center rounded-full border-2 text-sm font-semibold',
                estado === 'feita' ? 'border-sucesso bg-sucesso text-primary-foreground'
                  : estado === 'aqui' ? 'border-primary bg-primary text-primary-foreground' : 'bg-card text-muted-foreground')}>
                {estado === 'aqui' && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40 motion-reduce:hidden" />}
                {estado === 'feita' ? <CircleCheck className="size-5" /> : i + 1}
              </span>
              <span className="text-[11px] leading-tight text-muted-foreground">{titulo}</span>
            </div>
          </div>
        ))}
      </div>
      <div className="cascata flex flex-col gap-2">
        {['Crase: quando usar (com exemplos)', 'Aula: as 6 regras mais cobradas'].map((m) => (
          <div key={m} className="flex items-center gap-2 rounded-xl border p-2.5 text-sm">
            <span className="flex-1">{m}</span>
            <span className="flex items-center gap-1 text-xs text-sucesso"><BadgeCheck className="size-3.5" /> Verificado</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function TelaExercicio() {
  const opcoes = ['Vou a escola amanhã.', 'Vou à escola amanhã.', 'Vou á escola amanhã.']
  return (
    <div className="flex flex-col gap-3">
      <span className="w-fit rounded-full bg-secondary px-2 py-0.5 text-xs">Básico · Múltipla escolha</span>
      <p className="text-sm font-medium">Qual frase usa a crase corretamente?</p>
      <div className="cascata flex flex-col gap-2">
        {opcoes.map((o, i) => (
          <div key={o} className={cn('flex items-center gap-2 rounded-xl border p-2.5 text-sm',
            i === 1 && 'border-sucesso bg-sucesso-suave')}>
            <span className="grid size-6 place-items-center rounded-md bg-secondary text-xs font-semibold">{'ABC'[i]}</span>{o}
          </div>
        ))}
      </div>
      <p className="flex items-center gap-1.5 rounded-xl bg-secondary/60 p-2.5 text-sm text-sucesso">
        <CircleCheck className="size-4" /> Você acertou! “Escola” é feminina: a + a = à.
      </p>
    </div>
  )
}

function TelaFlashcard() {
  const [virado, setVirado] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setVirado((v) => !v), 2200)
    return () => clearInterval(id)
  }, [])
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-44 w-full max-w-sm [perspective:1000px]">
        <div className={cn('relative size-full transition-transform duration-700 [transform-style:preserve-3d] motion-reduce:transition-none',
          virado && '[transform:rotateY(180deg)]')}>
          <div className="absolute inset-0 grid place-items-center rounded-2xl border bg-card p-5 text-center [backface-visibility:hidden]">
            <p className="font-heading text-lg font-semibold">“Vou ___ praia” leva crase?</p>
          </div>
          <div className="absolute inset-0 grid place-items-center rounded-2xl border bg-accent/40 p-5 text-center [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <p className="font-heading">Sim: “à praia”. Praia é feminina e o verbo pede “a”.</p>
          </div>
        </div>
      </div>
      <div className="grid w-full max-w-sm grid-cols-2 gap-2 text-sm">
        <span className="rounded-xl border py-2 text-center">Esqueci</span>
        <span className="rounded-xl bg-primary py-2 text-center text-primary-foreground">Lembrei</span>
      </div>
      <p className="text-xs text-muted-foreground">Próxima revisão: em 3 dias</p>
    </div>
  )
}

function TelaProgresso() {
  const niveis = [0, 1, 2, 3, 4]
  const cores = ['bg-muted', 'bg-primary/25', 'bg-primary/50', 'bg-primary/75', 'bg-primary']
  // padrão fixo e determinístico (dados de exemplo)
  const dias = Array.from({ length: 7 * 14 }, (_, i) => niveis[(i * 7 + (i % 5) * 3) % 5 * (i % 4 === 0 ? 0 : 1)])
  return (
    <div className="flex flex-col gap-4">
      <div className="cascata grid grid-cols-3 gap-2">
        {[[<Flame key="f" className="size-4 text-primary" />, '12', 'dias seguidos'], [<Trophy key="t" className="size-4 text-chart-3" />, '9/10', 'no simulado'], [<CircleCheck key="c" className="size-4 text-sucesso" />, '4/5', 'meta da semana']].map(([icone, n, t]) => (
          <div key={t as string} className="rounded-xl border p-3">
            {icone}
            <p className="mt-1 font-heading text-xl font-semibold">{n}</p>
            <p className="text-[11px] text-muted-foreground">{t}</p>
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border p-3">
        <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {dias.map((n, i) => <span key={i} className={cn('size-2.5 rounded-[3px]', cores[n])} />)}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Seu calendário de estudos</p>
      </div>
    </div>
  )
}

import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { Bolha } from '@/components/Bolha'
import { CartaoBrilho } from '@/components/CartaoBrilho'
import { RecursoItem } from '@/components/RecursoItem'
import { BookOpen, Check, CircleCheck, CircleX, Dumbbell, RotateCcw, Route, type Icone } from '@/lib/icones'
import { RECURSOS_EXEMPLO } from '@/lib/exemplos'
import { cn } from '@/lib/utils'

// "Peça ajuda e escolha como estudar": três jeitos, um escolhido por vez. Cada um mostra para quem é,
// como funciona e uma demonstração que dá para mexer (a de prática é uma questão de verdade).

type Jeito = {
  id: string
  icone: Icone
  titulo: string
  resumo: string
  ideal: string
  passos: string[]
  pedido: string
  demo: () => ReactNode
}

const JEITOS: Jeito[] = [
  {
    id: 'chat',
    icone: BookOpen,
    titulo: 'Pelo chat, passo a passo',
    resumo: 'Uma tutora que explica e confere se você entendeu.',
    ideal: 'Para tirar uma dúvida agora ou aprender algo do zero, no seu ritmo.',
    passos: [
      'Explica com exemplos do dia a dia, um pedaço por vez.',
      'Faz uma pergunta no fim para ver se você entendeu antes de seguir.',
      'Se você enviou apostilas, responde com base nelas e diz arquivo e página.',
    ],
    pedido: '“Me explique crase do zero.”',
    demo: () => <DemoChat />,
  },
  {
    id: 'trilha',
    icone: Route,
    titulo: 'Com uma trilha',
    resumo: 'Vídeos e sites verificados, organizados em etapas.',
    ideal: 'Para quem quer dominar um assunto inteiro, com começo, meio e fim.',
    passos: [
      'Você conta o objetivo, o nível e quanto tempo tem.',
      'A plataforma pesquisa e confere cada link antes de mostrar.',
      'Você aprova e segue etapa por etapa, marcando o que já estudou.',
    ],
    pedido: '“Quero dominar SQL para análise de dados.”',
    demo: () => <DemoTrilha />,
  },
  {
    id: 'pratica',
    icone: Dumbbell,
    titulo: 'Praticando',
    resumo: 'Exercícios por nível, flashcards e simulados.',
    ideal: 'Para fixar o que estudou e descobrir onde ainda erra.',
    passos: [
      'Questões do básico ao avançado; a trilha se adapta aos seus acertos.',
      'Múltipla escolha corrigida na hora, com a explicação.',
      'O que você erra volta para revisão em 1, 3, 7, 15 e 30 dias.',
    ],
    pedido: '“Me teste com perguntas.”',
    demo: () => <DemoPratica />,
  },
]

export function EscolhaJeito() {
  const [atual, setAtual] = useState(0)
  const jeito = JEITOS[atual]

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col gap-3" role="tablist" aria-label="Jeitos de estudar">
        {JEITOS.map(({ id, icone: Icone, titulo, resumo }, i) => {
          const ativo = i === atual
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`jeito-${id}`}
              aria-selected={ativo}
              aria-controls="jeito-painel"
              onClick={() => {
                setAtual(i)
                // no celular o painel fica embaixo da lista: leva a pessoa até ele
                if (window.matchMedia('(max-width: 1023px)').matches)
                  document.getElementById('jeito-painel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }}
              className={cn(
                'group relative flex items-start gap-4 overflow-hidden rounded-2xl p-5 text-left transition-all duration-300',
                ativo
                  ? 'bg-gradient-to-br from-primary to-[color-mix(in_oklch,var(--primary)_60%,var(--destaque))] text-primary-foreground shadow-[0_18px_40px_-18px] shadow-primary/60'
                  : 'bg-card ring-1 ring-border hover:-translate-y-0.5 hover:ring-primary/40',
              )}
            >
              <span
                className={cn(
                  'grid size-11 shrink-0 place-items-center rounded-xl transition-colors',
                  ativo ? 'bg-white/15' : 'bg-accent text-primary',
                )}
              >
                <Icone className="size-5" weight={ativo ? 'fill' : 'regular'} />
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-lg font-semibold">{titulo}</span>
                <span className={cn('text-sm', ativo ? 'opacity-90' : 'text-muted-foreground')}>{resumo}</span>
              </span>
              {ativo && <motion.span layoutId="jeito-marca" className="absolute inset-y-4 left-0 w-1 rounded-r-full bg-destaque" />}
            </button>
          )
        })}
        <p className="mt-1 px-1 text-sm text-muted-foreground">Dá para combinar os três: a tutora sugere o próximo passo.</p>
      </div>

      <CartaoBrilho id="jeito-painel" role="tabpanel" aria-labelledby={`jeito-${jeito.id}`} className="rounded-3xl bg-card p-6 ring-1 ring-border sombra-suave sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={jeito.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="grid gap-8 xl:grid-cols-[1fr_1.1fr]"
          >
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="text-2xl">{jeito.titulo}</h3>
                <p className="mt-2 text-muted-foreground">{jeito.ideal}</p>
              </div>
              <ol className="flex flex-col gap-3">
                {jeito.passos.map((passo, i) => (
                  <motion.li
                    key={passo}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="flex gap-3 text-sm"
                  >
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent font-mono text-xs font-semibold text-primary">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{passo}</span>
                  </motion.li>
                ))}
              </ol>
              <p className="mt-auto text-sm text-muted-foreground">
                Experimente pedir: <span className="font-medium text-foreground italic">{jeito.pedido}</span>
              </p>
            </div>
            <div className="rounded-2xl bg-muted/50 p-4 ring-1 ring-border/60">{jeito.demo()}</div>
          </motion.div>
        </AnimatePresence>
      </CartaoBrilho>
    </div>
  )
}

/** Conversa que vai aparecendo, com a tutora "digitando" entre as mensagens. */
function DemoChat() {
  const MENSAGENS = [
    { papel: 'user' as const, conteudo: 'Quando a crase é obrigatória?' },
    {
      papel: 'assistant' as const,
      conteudo: 'Quando a preposição **a** encontra o artigo **a**. Teste: troque por uma palavra masculina. Se virar **ao**, tem crase.\n\n*Vou à escola* → *Vou ao colégio*. Faz sentido?',
    },
    { papel: 'user' as const, conteudo: 'Então “fui à praia” tem crase?' },
    { papel: 'assistant' as const, conteudo: 'Isso. *Fui ao clube* → *fui à praia*. Quer tentar um exercício?' },
  ]
  const [visiveis, setVisiveis] = useState(1)
  useEffect(() => {
    if (visiveis >= MENSAGENS.length) return
    const id = setTimeout(() => setVisiveis((n) => n + 1), visiveis % 2 ? 1500 : 1100)
    return () => clearTimeout(id)
  }, [visiveis, MENSAGENS.length])

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      {MENSAGENS.slice(0, visiveis).map((m, i) => (
        <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }}>
          <Bolha mensagem={m} />
        </motion.div>
      ))}
      {visiveis < MENSAGENS.length && MENSAGENS[visiveis].papel === 'assistant' && (
        <div className="flex items-center gap-1 pl-11" aria-label="A tutora está escrevendo">
          {[0, 1, 2].map((i) => (
            <span key={i} className="size-1.5 animate-bounce rounded-full bg-primary/70" style={{ animationDelay: `${i * 0.12}s` }} />
          ))}
        </div>
      )}
    </div>
  )
}

/** Etapas da trilha com a atual destacada e os materiais conferidos dela. */
function DemoTrilha() {
  const ETAPAS = ['O que é crase', 'Regras obrigatórias', 'Casos especiais', 'Crase em concursos']
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1.5">
        {ETAPAS.map((etapa, i) => (
          <motion.div
            key={etapa}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.15, duration: 0.4 }}
            className={cn('h-2 flex-1 origin-left rounded-full', i === 0 ? 'bg-sucesso' : i === 1 ? 'bg-gradient-to-r from-primary to-destaque' : 'bg-border')}
            title={etapa}
          />
        ))}
      </div>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="font-medium">Etapa 2 · Regras obrigatórias</span>
        <span className="text-xs text-muted-foreground">1 de 4 concluída</span>
      </div>
      <div className="flex flex-col gap-2">
        {RECURSOS_EXEMPLO.slice(0, 2).map((r, i) => (
          <motion.div key={r.url} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 + i * 0.15 }}>
            <RecursoItem recurso={r} />
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Materiais reais que a pesquisa do sistema encontrou e conferiu.</p>
    </div>
  )
}

/** Uma questão de múltipla escolha de verdade: clique, veja se acertou e a explicação. */
function DemoPratica() {
  const OPCOES = ['Vou a escola amanhã.', 'Vou à escola amanhã.', 'Vou á escola amanhã.']
  const CERTA = 1
  const [escolha, setEscolha] = useState<number | null>(null)
  const respondeu = escolha !== null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs">
        <span className="rounded-md bg-accent px-2 py-0.5 font-medium text-accent-foreground">Nível básico</span>
        <span className="text-muted-foreground">Questão 1 de 5</span>
      </div>
      <p className="font-medium">Qual frase usa a crase corretamente?</p>
      <div className="flex flex-col gap-2">
        {OPCOES.map((opcao, i) => {
          const certa = i === CERTA
          const marcada = i === escolha
          return (
            <button
              key={opcao}
              type="button"
              disabled={respondeu}
              onClick={() => setEscolha(i)}
              className={cn(
                'flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-left text-sm transition-all',
                !respondeu && 'hover:-translate-y-0.5 hover:border-primary/60',
                respondeu && certa && 'border-sucesso bg-sucesso-suave',
                respondeu && marcada && !certa && 'border-destructive bg-destructive/10',
                respondeu && !certa && !marcada && 'opacity-50',
              )}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-xs">{String.fromCharCode(65 + i)}</span>
              <span className="flex-1">{opcao}</span>
              {respondeu && certa && <CircleCheck className="size-5 text-sucesso" weight="fill" />}
              {respondeu && marcada && !certa && <CircleX className="size-5 text-destructive" weight="fill" />}
            </button>
          )
        })}
      </div>
      <AnimatePresence>
        {respondeu && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2 rounded-xl bg-card p-3 text-sm ring-1 ring-border">
              <p className="flex items-center gap-1.5 font-medium">
                {escolha === CERTA ? <><Check className="size-4 text-sucesso" weight="bold" /> Acertou.</> : 'Quase.'}
              </p>
              <p className="text-muted-foreground">“Ir” pede a preposição <b>a</b> e “escola” leva o artigo <b>a</b>: a + a = <b>à</b>.</p>
              <button type="button" onClick={() => setEscolha(null)} className="flex w-fit items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                <RotateCcw className="size-3.5" /> Tentar de novo
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {!respondeu && <p className="text-xs text-muted-foreground">Clique numa resposta.</p>}
    </div>
  )
}

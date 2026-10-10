import { motion, useMotionValueEvent, useReducedMotion, useScroll } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router'
import AnimatedContent from '@/components/AnimatedContent'
import { Bolha } from '@/components/Bolha'
import { Calendario } from '@/components/Calendario'
import { CartaoBrilho } from '@/components/CartaoBrilho'
import CountUp from '@/components/CountUp'
import { FundoPontos } from '@/components/FundoPontos'
import { BotaoTema } from '@/components/Layout'
import { Perguntas, type Pergunta } from '@/components/Perguntas'
import { RecursoItem } from '@/components/RecursoItem'
import { Rodape } from '@/components/Rodape'
import RotatingText from '@/components/RotatingText'
import { TelaInclinada } from '@/components/TelaInclinada'
import { TourProduto } from '@/components/TourProduto'
import { Button } from '@/components/ui/button'
import {
  ArrowRight, BadgeCheck, BookOpen, BookOpenText, Brain, Check, ClipboardCheck, Compass, Dumbbell, Layers,
  MessageCircle, Minus, Route, Search, ShieldAlert, Timer,
} from '@/lib/icones'
import { atividadeExemplo, RECURSOS_EXEMPLO } from '@/lib/exemplos'
import { useTitulo } from '@/lib/titulo'
import { cn } from '@/lib/utils'

const CTA = 'Criar conta grátis' // um texto só para a mesma ação, em toda a página

const ARMADILHAS = [
  {
    icone: Compass,
    titulo: 'Muito conteúdo, pouco caminho',
    texto: 'Sobram vídeos e artigos. Falta saber o que estudar primeiro e quando você está pronto para avançar.',
  },
  {
    icone: ShieldAlert,
    titulo: 'IAs inventam fontes',
    texto: 'Chatbots comuns citam vídeos e sites que não existem. Para estudar, fonte falsa é pior do que nenhuma.',
  },
  {
    icone: Brain,
    titulo: 'Sem prática, a gente esquece',
    texto: 'Ler e assistir não basta. Sem exercício e sem revisar no tempo certo, o conteúdo some em poucos dias.',
  },
]

const PASSOS = [
  { icone: MessageCircle, titulo: 'Conte o objetivo', texto: 'Seu nível, seu prazo e o que quer dominar.' },
  { icone: Search, titulo: 'A plataforma pesquisa', texto: 'Vídeos e sites reais, cada link conferido.' },
  { icone: Route, titulo: 'Você aprova a trilha', texto: 'Nada é criado antes do seu ok.' },
  { icone: Dumbbell, titulo: 'Pratique e revise', texto: 'Exercícios por nível e revisão no dia certo.' },
]

const EXTRAS = [
  { icone: BadgeCheck, titulo: 'Fontes conferidas', texto: 'A IA escolhe materiais por número numa lista já verificada. Ela nem vê as URLs.' },
  { icone: Layers, titulo: 'Flashcards', texto: 'Gerados dos materiais da etapa, com revisão espaçada.' },
  { icone: ClipboardCheck, titulo: 'Simulados', texto: 'Prova com tempo marcado e correção comentada na hora.' },
  { icone: Timer, titulo: 'Cronômetro de foco', texto: 'Ciclos de 25 minutos que entram no seu calendário.' },
]

// Só números verdadeiros do produto (LinkValidator, extrator.py e ORDEM_NIVEIS no back-end).
const NUMEROS = [
  { valor: 100, sufixo: '%', texto: 'dos links conferidos antes de chegar a você' },
  { valor: 5, texto: 'formatos de arquivo para a tutora ler: PDF, Word, PowerPoint, .txt e .md' },
  { valor: 3, texto: 'níveis de exercício, e a trilha se adapta aos seus acertos' },
  { valor: 0, prefixo: 'R$ ', texto: 'para usar. Sem cartão e sem período de teste' },
]

// Comparação justa: o que um chat de IA genérico faz sozinho x o que a plataforma acrescenta.
const COMPARACAO = [
  { tema: 'Fontes', comum: 'Pode citar vídeos e sites que não existem.', nosso: 'Cada link é aberto e conferido antes de aparecer.' },
  { tema: 'Caminho', comum: 'Respostas soltas, uma conversa de cada vez.', nosso: 'Trilha em etapas, do básico ao avançado, aprovada por você.' },
  { tema: 'Prática', comum: 'Só se você pedir, e se perde no histórico.', nosso: 'Exercícios por nível, flashcards e simulados salvos.' },
  { tema: 'Revisão', comum: 'Nada avisa a hora de revisar.', nosso: 'O conteúdo volta em 1, 3, 7, 15 e 30 dias.' },
  { tema: 'Progresso', comum: 'Não há o que acompanhar.', nosso: 'Calendário, sequência de dias e painel de acertos.' },
]

// Limites reais (LIMITE_*_DIA em app/config.py; a produção usa os valores padrão).
const LIMITES = [
  { valor: 60, texto: 'mensagens no chat' },
  { valor: 30, texto: 'ações com IA' },
  { valor: 6, texto: 'pesquisas de trilha' },
]

const PERGUNTAS: Pergunta[] = [
  {
    pergunta: 'É grátis mesmo?',
    resposta: 'Sim, sem cartão. Para continuar grátis para todo mundo, cada conta tem um limite por dia: 60 mensagens no chat, 30 ações com IA (gerar exercícios e flashcards, corrigir respostas abertas) e 6 pesquisas de trilha. O contador zera à meia-noite, no horário de Brasília.',
  },
  {
    pergunta: 'Os links são confiáveis?',
    resposta: 'Cada site é aberto e conferido antes de aparecer, e os vídeos são confirmados pela API oficial do YouTube. A IA só escolhe materiais pelo número, numa lista já verificada. Ela nem vê os endereços, então não tem como inventar um link.',
  },
  {
    pergunta: 'A IA pode errar?',
    resposta: 'Pode, como qualquer IA. Por isso a tutora confere se você entendeu antes de seguir, a trilha sempre aponta para o material original e, quando a resposta vem dos seus arquivos, ela mostra de qual arquivo e página tirou.',
  },
  {
    pergunta: 'O que acontece com os arquivos que eu envio?',
    resposta: 'O arquivo em si não fica guardado. O site tira só o texto, divide em trechos e usa os que combinam com a sua pergunta. Aceita PDF, Word, PowerPoint, .txt e .md de até 4 MB, e você apaga quando quiser.',
  },
  {
    pergunta: 'Funciona no celular?',
    resposta: 'Sim, direto no navegador, sem instalar nada.',
  },
  {
    pergunta: 'Posso apagar minha conta?',
    resposta: 'Sim, na página Conta. Antes, se quiser, baixe todos os seus dados. A exclusão apaga tudo de uma vez, inclusive a foto, e não tem volta.',
  },
]

export function PaginaInicio() {
  useTitulo(null)
  const ctaTopo = useRef<HTMLDivElement>(null)
  const rodape = useRef<HTMLDivElement>(null)
  const ctaFixo = useCtaFixo(ctaTopo, rodape)
  const hoje = new Date().toISOString().slice(0, 10)

  return (
    <div className="textura min-h-svh overflow-x-hidden">
      {/* ---------- topo ---------- */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-4 sm:px-6" aria-label="Principal">
          <Link to="/" className="mr-auto flex items-center gap-2 text-[15px] font-semibold tracking-tight" aria-label="Estudos IA: início">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <BookOpenText className="size-4" weight="bold" />
            </span>
            Estudos IA
          </Link>
          <a href="#como-funciona" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Como funciona</a>
          <a href="#perguntas" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Perguntas</a>
          <Link to="/como-usar" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Guia</Link>
          <BotaoTema />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/entrar">Entrar</Link></Button>
          <Button asChild size="sm"><Link to="/entrar?modo=cadastrar">{CTA}</Link></Button>
        </nav>
      </header>

      <main>
        {/* ---------- hero: texto à esquerda, produto real à direita ---------- */}
        <div className="relative isolate">
        <FundoPontos className="mascara-radial -z-10" />
        <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-20 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-20">
          <div className="flex flex-col gap-6">
            <h1 className="text-[2.6rem] leading-[1.04] sm:text-6xl">
              Estude{' '}
              <RotatingText
                texts={['qualquer assunto', 'Português', 'SQL', 'Inglês', 'Python', 'Física']}
                mainClassName="inline-flex overflow-hidden text-primary pb-1"
                staggerFrom="last"
                staggerDuration={0.02}
                rotationInterval={2800}
                splitLevelClassName="overflow-hidden pb-1"
                transition={{ type: 'spring', damping: 32, stiffness: 380 }}
              />
              <br className="hidden sm:block" /> com uma tutora que pesquisa por você.
            </h1>
            <p className="max-w-[46ch] text-lg leading-relaxed text-muted-foreground">
              A plataforma busca vídeos e sites reais, confere cada link e monta sua trilha do básico ao avançado.
            </p>
            <div ref={ctaTopo} className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base">
                <Link to="/entrar?modo=cadastrar">{CTA} <ArrowRight weight="bold" /></Link>
              </Button>
              <a href="#tour" className="group flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Ver por dentro <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </a>
            </div>
          </div>

          {/* Componentes reais do app com dados de exemplo (não é print nem desenho) */}
          <div className="relative" aria-label="Exemplo da interface" role="group">
            <div className="rounded-2xl bg-card p-4 sombra-alta sm:p-5 lg:mr-16">
              <p className="mb-3 text-sm font-medium">Materiais da etapa “Regras obrigatórias”</p>
              <div className="flex flex-col gap-2">
                {RECURSOS_EXEMPLO.slice(0, 2).map((r) => <RecursoItem key={r.url} recurso={r} />)}
              </div>
            </div>
            <div className="relative mt-4 rounded-2xl bg-card p-4 sombra-alta lg:-mt-3 lg:ml-auto lg:w-[22rem]">
              <Calendario atividade={atividadeExemplo(hoje)} hoje={hoje} semanas={15} />
            </div>
          </div>
        </section>
        </div>

        {/* ---------- números verdadeiros, contando ao aparecer ---------- */}
        <section aria-label="Em números" className="border-t">
          <dl className="mx-auto grid max-w-6xl gap-x-10 gap-y-8 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {NUMEROS.map(({ valor, prefixo = '', sufixo = '', texto }) => (
              <div key={texto} className="flex flex-col gap-1">
                <dt className="font-mono text-4xl font-medium tracking-tight text-primary tabular-nums">
                  {prefixo}<CountUp to={valor} duration={1.6} />{sufixo}
                </dt>
                <dd className="max-w-[30ch] text-sm text-muted-foreground">{texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- por que existe: título fixo + lista (sem cartões) ---------- */}
        <section id="por-que" className="border-t bg-card/60">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
            <div className="lg:sticky lg:top-28 lg:self-start">
              <h2 className="text-3xl sm:text-4xl">Estudar sozinho tem três armadilhas.</h2>
              <p className="mt-4 max-w-[42ch] text-muted-foreground">
                O Estudos IA nasceu para resolver as três num lugar só: um caminho claro, fontes que existem e prática que fixa.
              </p>
            </div>
            <ul className="flex flex-col">
              {ARMADILHAS.map(({ icone: Icone, titulo, texto }, i) => (
                <AnimatedContent key={titulo} distance={30} delay={i * 0.06}>
                  <li className="flex gap-5 border-t py-7">
                    <Icone className="mt-1 size-6 shrink-0 text-primary" />
                    <div>
                      <h3 className="text-xl">{titulo}</h3>
                      <p className="mt-2 max-w-[52ch] text-muted-foreground">{texto}</p>
                    </div>
                  </li>
                </AnimatedContent>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- como funciona: linha do tempo horizontal ---------- */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <h2 className="max-w-[20ch] text-3xl sm:text-4xl">Da dúvida à trilha em quatro passos.</h2>
          <LinhaDoTempo />
        </section>

        {/* ---------- tour com componentes reais ---------- */}
        <section id="tour" className="scroll-mt-20 border-y bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 text-sm font-medium text-primary">Por dentro</p>
              <h2 className="text-3xl sm:text-4xl">As telas que você vai usar todo dia.</h2>
              <p className="mt-4 text-muted-foreground">São os componentes do próprio app, com dados de exemplo. Clique para explorar.</p>
            </div>
            <TelaInclinada><TourProduto /></TelaInclinada>
          </div>
        </section>

        {/* ---------- três jeitos: bento assimétrico ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <h2 className="max-w-[22ch] text-3xl sm:text-4xl">Peça ajuda e escolha como estudar.</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-2">
            <Jeito
              className="bg-primary text-primary-foreground"
              icone={<BookOpen className="size-6" />}
              titulo="Pelo chat, passo a passo"
              texto="A tutora explica com exemplos do dia a dia e confere se você entendeu antes de seguir."
              exemplo="“Me explique crase do zero.”"
              grande
            >
              <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 text-card-foreground sombra-alta">
                <Bolha mensagem={{ papel: 'user', conteudo: 'Quando a crase é obrigatória?' }} />
                <Bolha mensagem={{
                  papel: 'assistant',
                  conteudo: 'Quando a preposição **a** encontra o artigo **a**. Um teste rápido: troque a palavra feminina por uma masculina. Se virar **ao**, tem crase.\n\n*Vou à escola* → *Vou ao colégio*. Faz sentido?',
                }} />
              </div>
            </Jeito>
            <Jeito
              className="bg-card sombra-suave"
              icone={<Route className="size-6 text-primary" />}
              titulo="Com uma trilha"
              texto="Vídeos e sites verificados, organizados em etapas."
              exemplo="“Quero dominar SQL para análise de dados.”"
            />
            <Jeito
              className="pontilhado bg-muted/60"
              icone={<Dumbbell className="size-6 text-primary" />}
              titulo="Praticando"
              texto="Exercícios por nível, flashcards e simulados."
              exemplo="“Me teste com perguntas.”"
            />
          </div>

          <dl className="mt-16 grid gap-x-10 gap-y-8 border-t pt-12 sm:grid-cols-2 lg:grid-cols-4">
            {EXTRAS.map(({ icone: Icone, titulo, texto }) => (
              <div key={titulo}>
                <dt className="flex items-center gap-2 font-medium"><Icone className="size-5 text-primary" /> {titulo}</dt>
                <dd className="mt-2 text-sm text-muted-foreground">{texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- comparação: o que a plataforma acrescenta a um chat de IA ---------- */}
        <section className="border-y bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <h2 className="max-w-[24ch] text-3xl sm:text-4xl">Por que não estudar só com um chat de IA?</h2>
            <p className="mt-4 max-w-[56ch] text-muted-foreground">
              Um chat explica bem. Estudar pede mais: fonte que existe, ordem certa, prática e revisão na hora certa.
            </p>
            <div className="mt-12" role="table" aria-label="Chat de IA comum comparado ao Estudos IA">
              <div role="row" className="hidden gap-6 pb-4 text-sm font-medium sm:grid sm:grid-cols-[9rem_1fr_1fr]">
                <span role="columnheader"><span className="sr-only">Tema</span></span>
                <span role="columnheader" className="text-muted-foreground">Chat de IA comum</span>
                <span role="columnheader" className="px-3 text-primary">Estudos IA</span>
              </div>
              {COMPARACAO.map(({ tema, comum, nosso }, i) => (
                <AnimatedContent key={tema} distance={20} delay={i * 0.05}>
                  <div role="row" className="grid gap-3 border-t py-5 sm:grid-cols-[9rem_1fr_1fr] sm:items-start sm:gap-6">
                    <span role="rowheader" className="font-medium">{tema}</span>
                    <span role="cell" className="flex gap-3 text-muted-foreground">
                      <Minus className="mt-1 size-4 shrink-0" aria-hidden />
                      <span><span className="sm:sr-only">Chat de IA comum: </span>{comum}</span>
                    </span>
                    <span role="cell" className="flex gap-3 rounded-xl bg-accent px-3 py-2 text-accent-foreground sm:-my-2">
                      <Check className="mt-1 size-4 shrink-0 text-primary" weight="bold" aria-hidden />
                      <span><span className="font-medium sm:sr-only">Estudos IA: </span>{nosso}</span>
                    </span>
                  </div>
                </AnimatedContent>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- grátis + perguntas frequentes ---------- */}
        <section id="perguntas" className="mx-auto grid max-w-6xl scroll-mt-20 gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
          <div className="flex flex-col gap-8 lg:sticky lg:top-28 lg:self-start">
            <h2 className="text-3xl sm:text-4xl">Perguntas frequentes</h2>
            <CartaoBrilho className="rounded-3xl bg-card p-7 sombra-suave">
              <p className="font-medium">Grátis, com um limite por dia</p>
              <p className="mt-1 text-sm text-muted-foreground">Por conta, zerando à meia-noite.</p>
              <dl className="mt-6 grid grid-cols-3 gap-4">
                {LIMITES.map(({ valor, texto }) => (
                  <div key={texto}>
                    <dt className="font-mono text-3xl font-medium tracking-tight tabular-nums"><CountUp to={valor} duration={1.4} /></dt>
                    <dd className="mt-1 text-xs text-muted-foreground">{texto}</dd>
                  </div>
                ))}
              </dl>
            </CartaoBrilho>
          </div>
          <Perguntas itens={PERGUNTAS} />
        </section>

        {/* ---------- chamada final ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="pontilhado flex flex-col items-start gap-6 rounded-3xl bg-accent px-6 py-14 sm:px-12 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="max-w-[22ch] text-3xl text-accent-foreground sm:text-4xl">Seu próximo assunto pode começar hoje.</h2>
              <p className="mt-3 max-w-[50ch] text-accent-foreground/80">
                Grátis, sem cartão. Projeto de portfólio com o código aberto no GitHub.
              </p>
            </div>
            <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base">
              <Link to="/entrar?modo=cadastrar">{CTA} <ArrowRight weight="bold" /></Link>
            </Button>
          </div>
        </section>
      </main>

      <div ref={rodape} className="max-sm:pb-20"><Rodape /></div>

      {/* CTA fixo no celular: aparece depois que o botão do topo sai da tela e some perto do rodapé */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 sm:hidden',
          ctaFixo ? 'translate-y-0' : 'translate-y-full',
        )}
        aria-hidden={!ctaFixo}
      >
        <Button asChild size="lg" className="h-12 w-full rounded-xl text-base" tabIndex={ctaFixo ? 0 : -1}>
          <Link to="/entrar?modo=cadastrar">{CTA} <ArrowRight weight="bold" /></Link>
        </Button>
      </div>
    </div>
  )
}

function Jeito({ className, icone, titulo, texto, exemplo, grande = false, children }: {
  className?: string; icone: ReactNode; titulo: string; texto: string; exemplo: string; grande?: boolean; children?: ReactNode
}) {
  return (
    <AnimatedContent distance={30} className={cn('flex', grande && 'lg:row-span-2')}>
      <CartaoBrilho className={cn('flex flex-1 flex-col justify-between gap-8 rounded-3xl p-7 sm:p-9', className)}>
        <div className="flex flex-col gap-3">
          {icone}
          <h3 className={grande ? 'text-3xl' : 'text-xl'}>{titulo}</h3>
          <p className={cn('max-w-[40ch]', grande ? 'text-lg opacity-90' : 'text-muted-foreground')}>{texto}</p>
        </div>
        {children}
        <p className={cn('text-sm italic', grande ? 'opacity-80' : 'text-muted-foreground')}>{exemplo}</p>
      </CartaoBrilho>
    </AnimatedContent>
  )
}

/** Os quatro passos: a linha se desenha com a rolagem e cada passo acende quando ela chega nele. */
function LinhaDoTempo() {
  const lista = useRef<HTMLOListElement>(null)
  const parado = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: lista, offset: ['start 0.85', 'end 0.55'] })
  const [acesos, setAcesos] = useState(0)
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    setAcesos(Math.min(PASSOS.length, Math.floor(p * (PASSOS.length - 1) + 1.02)))
  })
  const total = parado ? PASSOS.length : acesos

  return (
    <ol ref={lista} className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
      <span aria-hidden className="absolute top-5 right-0 left-0 hidden h-px bg-border lg:block" />
      <motion.span
        aria-hidden
        className="absolute top-5 right-0 left-0 hidden h-0.5 -translate-y-px origin-left bg-primary lg:block"
        style={{ scaleX: parado ? 1 : scrollYProgress }}
      />
      {PASSOS.map(({ icone: Icone, titulo, texto }, i) => {
        const aceso = i < total
        return (
          <li key={titulo} className="relative flex flex-col gap-3">
            <span
              className={cn(
                'relative grid size-10 place-items-center rounded-xl ring-1 transition-all duration-500 motion-reduce:transition-none',
                aceso ? 'scale-110 bg-primary text-primary-foreground shadow-[0_0_0_6px] shadow-primary/15 ring-primary' : 'bg-background text-primary ring-border',
              )}
            >
              <Icone className="size-5" weight={aceso ? 'fill' : 'regular'} />
            </span>
            <h3 className={cn('text-lg transition-opacity duration-500', !aceso && 'opacity-60')}>{titulo}</h3>
            <p className="text-sm text-muted-foreground">{texto}</p>
          </li>
        )
      })}
    </ol>
  )
}

/** Mostra o CTA fixo enquanto nem o botão do topo nem o rodapé estão visíveis. */
function useCtaFixo(topo: RefObject<HTMLElement | null>, fim: RefObject<HTMLElement | null>) {
  const [visiveis, setVisiveis] = useState({ topo: true, fim: false })
  useEffect(() => {
    if (!('IntersectionObserver' in window) || !topo.current || !fim.current) return
    const observador = new IntersectionObserver((entradas) => {
      setVisiveis((v) => {
        const novo = { ...v }
        for (const e of entradas) {
          if (e.target === topo.current) novo.topo = e.isIntersecting
          if (e.target === fim.current) novo.fim = e.isIntersecting
        }
        return novo
      })
    })
    observador.observe(topo.current)
    observador.observe(fim.current)
    return () => observador.disconnect()
  }, [topo, fim])
  return !visiveis.topo && !visiveis.fim
}

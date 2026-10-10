import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router'
import AnimatedContent from '@/components/AnimatedContent'
import { Bolha } from '@/components/Bolha'
import { Calendario } from '@/components/Calendario'
import { BotaoTema } from '@/components/Layout'
import { RecursoItem } from '@/components/RecursoItem'
import { Rodape } from '@/components/Rodape'
import RotatingText from '@/components/RotatingText'
import { TourProduto } from '@/components/TourProduto'
import { Button } from '@/components/ui/button'
import {
  ArrowRight, BadgeCheck, BookOpen, BookOpenText, Brain, ClipboardCheck, Compass, Dumbbell, Layers,
  MessageCircle, Route, Search, ShieldAlert, Timer,
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
          <Link to="/como-usar" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Guia</Link>
          <BotaoTema />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/entrar">Entrar</Link></Button>
          <Button asChild size="sm"><Link to="/entrar?modo=cadastrar">{CTA}</Link></Button>
        </nav>
      </header>

      <main>
        {/* ---------- hero: texto à esquerda, produto real à direita ---------- */}
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
          <ol className="relative mt-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
            <span aria-hidden className="absolute top-5 right-0 left-0 hidden h-px bg-border lg:block" />
            {PASSOS.map(({ icone: Icone, titulo, texto }, i) => (
              <AnimatedContent key={titulo} distance={24} delay={i * 0.08}>
                <li className="relative flex flex-col gap-3">
                  <span className="relative grid size-10 place-items-center rounded-xl bg-background text-primary ring-1 ring-border">
                    <Icone className="size-5" />
                  </span>
                  <h3 className="text-lg">{titulo}</h3>
                  <p className="text-sm text-muted-foreground">{texto}</p>
                </li>
              </AnimatedContent>
            ))}
          </ol>
        </section>

        {/* ---------- tour com componentes reais ---------- */}
        <section id="tour" className="scroll-mt-20 border-y bg-card/60">
          <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
            <div className="mb-12 max-w-2xl">
              <p className="mb-3 text-sm font-medium text-primary">Por dentro</p>
              <h2 className="text-3xl sm:text-4xl">As telas que você vai usar todo dia.</h2>
              <p className="mt-4 text-muted-foreground">São os componentes do próprio app, com dados de exemplo. Clique para explorar.</p>
            </div>
            <TourProduto />
          </div>
        </section>

        {/* ---------- três jeitos: bento assimétrico ---------- */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <h2 className="max-w-[22ch] text-3xl sm:text-4xl">Peça ajuda e escolha como estudar.</h2>
          <div className="mt-12 grid gap-4 lg:grid-cols-[1.25fr_1fr] lg:grid-rows-2">
            <Jeito
              className="bg-primary text-primary-foreground lg:row-span-2"
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
    <AnimatedContent distance={30} className={cn('flex flex-col justify-between gap-8 rounded-3xl p-7 sm:p-9', className)}>
      <div className="flex flex-col gap-3">
        {icone}
        <h3 className={grande ? 'text-3xl' : 'text-xl'}>{titulo}</h3>
        <p className={cn('max-w-[40ch]', grande ? 'text-lg opacity-90' : 'text-muted-foreground')}>{texto}</p>
      </div>
      {children}
      <p className={cn('text-sm italic', grande ? 'opacity-80' : 'text-muted-foreground')}>{exemplo}</p>
    </AnimatedContent>
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

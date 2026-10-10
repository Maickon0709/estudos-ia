import {
  ArrowRight, BadgeCheck, BookOpen, BookOpenText, Brain, ChartColumn, CircleCheck, Dumbbell, Flame,
  Brain as Cerebro, Compass, Layers, MessageCircle, Route, Search, ShieldAlert, Timer, Trophy,
} from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import AnimatedContent from '@/components/AnimatedContent'
import Aurora from '@/components/Aurora'
import GradientText from '@/components/GradientText'
import RotatingText from '@/components/RotatingText'
import { BotaoTema } from '@/components/Layout'
import { Rodape } from '@/components/Rodape'
import { TourProduto } from '@/components/TourProduto'
import ShinyText from '@/components/ShinyText'
import SpotlightCard from '@/components/SpotlightCard'
import StarBorder from '@/components/StarBorder'
import { Button } from '@/components/ui/button'
import { useTema } from '@/lib/tema'
import { useTitulo } from '@/lib/titulo'
import { cn } from '@/lib/utils'

const PROBLEMAS = [
  {
    icone: Compass,
    titulo: 'Muito conteúdo, pouco caminho',
    texto: 'Sobram vídeos e artigos, mas falta saber o que estudar primeiro, o que vem depois e quando você está pronto para avançar.',
  },
  {
    icone: ShieldAlert,
    titulo: 'IAs inventam fontes',
    texto: 'Chatbots comuns citam vídeos, livros e sites que não existem. Para estudar, uma fonte falsa é pior do que nenhuma.',
  },
  {
    icone: Cerebro,
    titulo: 'Sem prática, a gente esquece',
    texto: 'Ler e assistir não basta. Sem exercícios e sem revisar no tempo certo, boa parte do que se aprende some em poucos dias.',
  },
]

const JEITOS = [
  {
    icone: BookOpen,
    titulo: 'Estudar pelo chat',
    texto: 'A tutora explica passo a passo, com exemplos do dia a dia, e confere seu entendimento com perguntas.',
    exemplo: '“Me explique crase do zero.”',
  },
  {
    icone: Route,
    titulo: 'Trilha com vídeos e sites',
    texto: 'A plataforma pesquisa vídeos no YouTube e sites confiáveis, confere cada link e organiza em etapas para você aprovar.',
    exemplo: '“Quero dominar SQL para análise de dados.”',
  },
  {
    icone: Dumbbell,
    titulo: 'Praticar e revisar',
    texto: 'Exercícios em três níveis, flashcards, simulados cronometrados e revisões no dia certo.',
    exemplo: '“Me teste com perguntas.”',
  },
]

const PASSOS = [
  { icone: MessageCircle, titulo: 'Conte o que quer aprender', texto: 'Converse com a tutora sobre seu objetivo, seu nível e seu tempo.' },
  { icone: Search, titulo: 'Ela pesquisa por você', texto: 'Links e vídeos reais, cada um conferido antes de chegar até você.' },
  { icone: Route, titulo: 'Você aprova a trilha', texto: 'Nada é criado sem o seu clique. Revise as etapas e confirme.' },
  { icone: Trophy, titulo: 'Pratique e evolua', texto: 'Exercícios, flashcards e simulados que se adaptam ao seu desempenho.' },
]

const RECURSOS: { icone: typeof Route; titulo: string; texto: string; classe?: string }[] = [
  {
    icone: BadgeCheck,
    titulo: 'Nenhum link inventado',
    texto: 'A IA escolhe os materiais pelo número de uma lista verificada e nem vê as URLs. Vídeos são confirmados na API oficial do YouTube.',
    classe: 'md:col-span-2',
  },
  { icone: Route, titulo: 'Trilha que se adapta', texto: 'Acertou 80% no básico? O intermediário libera. Errou muito? A etapa pede reforço.' },
  { icone: Brain, titulo: 'Revisão espaçada', texto: 'O que você errou volta no dia certo: 1, 3, 7, 15 e 30 dias depois.' },
  { icone: Layers, titulo: 'Flashcards e simulados', texto: 'Cartões gerados das suas fontes e provas cronometradas com correção na hora.' },
  { icone: Timer, titulo: 'Cronômetro de foco', texto: 'Ciclos de 25 minutos que entram direto no seu calendário.' },
  {
    icone: ChartColumn,
    titulo: 'Seu progresso à vista',
    texto: 'Calendário de estudos estilo GitHub, sequência de dias, metas da semana, acerto por nível, tempo de foco e pontos fracos.',
    classe: 'md:col-span-3',
  },
]

export function PaginaInicio() {
  useTitulo(null)
  const escuro = useTema() === 'escuro'
  const ctaTopo = useRef<HTMLDivElement>(null)
  const rodape = useRef<HTMLDivElement>(null)
  const ctaFixo = useCtaFixo(ctaTopo, rodape)

  return (
    <div className="min-h-svh overflow-x-hidden">
      {/* ---------- topo ---------- */}
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4">
          <Link to="/" className="mr-auto flex items-center gap-2 font-heading text-lg font-semibold" aria-label="Estudos IA: início">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenText className="size-4" />
            </span>
            Estudos IA
          </Link>
          <a href="#por-que" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground lg:block">Por que</a>
          <a href="#tour" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground md:block">Tour</a>
          <a href="#como-funciona" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground lg:block">Como funciona</a>
          <a href="#recursos" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground md:block">Recursos</a>
          <Link to="/como-usar" className="hidden px-3 text-sm text-muted-foreground hover:text-foreground sm:block">Como usar</Link>
          <BotaoTema />
          <Button asChild variant="ghost" size="sm"><Link to="/entrar">Entrar</Link></Button>
        </div>
      </header>

      {/* ---------- hero ---------- */}
      <section className="relative isolate overflow-hidden pt-32 pb-16 sm:pt-40">
        <div className="absolute inset-0 -z-10 opacity-70" aria-hidden>
          <Aurora
            colorStops={escuro ? ['#7a3a1f', '#c4643a', '#3f5a44'] : ['#f6c9a6', '#e07a4a', '#e8c27a']}
            amplitude={1.1}
            blend={0.6}
            speed={0.6}
            lightMode={!escuro}
          />
        </div>
        <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-background" aria-hidden />

        <div className="mx-auto flex max-w-4xl flex-col items-center gap-7 px-4 text-center">
          <span className="rounded-full border border-primary/30 bg-background/70 px-4 py-1.5 text-sm backdrop-blur">
            <ShinyText
              text="✦ Tutora com IA e fontes verificadas"
              speed={3}
              color={escuro ? '#d9c6b6' : '#6b5546'}
              shineColor={escuro ? '#ffd9b8' : '#c4643a'}
            />
          </span>
          <h1 className="text-4xl leading-[1.08] font-semibold sm:text-6xl">
            Estude{' '}
            <RotatingText
              texts={['qualquer assunto', 'Português', 'SQL', 'Inglês', 'Python', 'Matemática']}
              mainClassName="inline-flex overflow-hidden rounded-2xl bg-primary px-3 pb-1 text-primary-foreground sm:pb-2"
              staggerFrom="last"
              staggerDuration={0.025}
              rotationInterval={2600}
              splitLevelClassName="overflow-hidden"
              transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            />{' '}
            com uma{' '}
            <GradientText
              className="inline-flex"
              colors={['#c4643a', '#d9a441', '#7aa37f', '#c4643a']}
              animationSpeed={6}
            >
              tutora que pesquisa
            </GradientText>{' '}
            por você
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Diga o que quer aprender. A IA busca materiais reais, monta uma trilha do básico ao avançado,
            cria exercícios e flashcards e acompanha sua evolução, dia após dia.
          </p>
          <div ref={ctaTopo} className="flex flex-col gap-3 sm:flex-row">
            <StarBorder
              as={Link}
              to="/entrar?modo=cadastrar"
              backgroundColor="var(--primary)"
              textColor="var(--primary-foreground)"
              borderColor="rgba(255, 255, 255, 0.25)"
              color="#ffe2c4"
              radius={12}
              className="h-11 px-6 text-base"
            >
              Começar grátis <ArrowRight className="size-4" />
            </StarBorder>
            <Button asChild size="lg" variant="outline" className="h-11 bg-background/60 px-6 text-base backdrop-blur">
              <a href="#como-funciona">Ver como funciona</a>
            </Button>
          </div>
        </div>

        <AnimatedContent distance={60} duration={1} delay={0.2}>
          <PreviaDoProduto />
        </AnimatedContent>
      </section>

      {/* ---------- números (fatos do produto, não métricas inventadas) ---------- */}
      <section className="mx-auto grid max-w-5xl grid-cols-2 gap-4 px-4 py-10 md:grid-cols-4">
        {[
          ['0', 'links inventados'],
          ['3', 'níveis de exercício'],
          ['5', 'intervalos de revisão'],
          ['100%', 'das trilhas aprovadas por você'],
        ].map(([numero, texto]) => (
          <div key={texto} className="rounded-2xl border bg-card/60 p-5 text-center">
            <p className="font-heading text-3xl font-semibold text-primary">{numero}</p>
            <p className="mt-1 text-sm text-muted-foreground">{texto}</p>
          </div>
        ))}
      </section>

      {/* ---------- por que existe ---------- */}
      <section id="por-que" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16">
        <Titulo selo="Por que existe" titulo="Estudar sozinho tem três armadilhas" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {PROBLEMAS.map(({ icone: Icone, titulo, texto }, i) => (
            <AnimatedContent key={titulo} distance={40} delay={i * 0.08} className="h-full">
              <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
                  <Icone className="size-5" />
                </span>
                <h3 className="text-lg font-semibold">{titulo}</h3>
                <p className="text-sm text-muted-foreground">{texto}</p>
              </div>
            </AnimatedContent>
          ))}
        </div>
        <AnimatedContent distance={40}>
          <div className="mt-6 rounded-3xl border border-primary/30 bg-accent/30 p-6 sm:p-8">
            <p className="font-heading text-xl font-semibold sm:text-2xl">
              O Estudos IA junta as três respostas num lugar só.
            </p>
            <p className="mt-3 text-muted-foreground">
              Uma tutora que conversa com você e monta o caminho; uma pesquisa que só aceita links reais e conferidos;
              e prática com revisão espaçada para o conteúdo ficar. Nasceu como projeto de portfólio de um estudante de
              Análise e Desenvolvimento de Sistemas, com o código aberto no GitHub.
            </p>
          </div>
        </AnimatedContent>
      </section>

      {/* ---------- como funciona ---------- */}
      <section id="como-funciona" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16">
        <Titulo selo="Como funciona" titulo="Da dúvida ao domínio em quatro passos" />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PASSOS.map(({ icone: Icone, titulo, texto }, i) => (
            <AnimatedContent key={titulo} distance={40} delay={i * 0.08}>
              <li className="relative flex h-full flex-col gap-3 rounded-2xl border bg-card p-5">
                <span className="absolute top-4 right-4 font-heading text-4xl font-semibold text-primary/15">{i + 1}</span>
                <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                  <Icone className="size-5" />
                </span>
                <h3 className="text-lg font-semibold">{titulo}</h3>
                <p className="text-sm text-muted-foreground">{texto}</p>
              </li>
            </AnimatedContent>
          ))}
        </ol>
      </section>

      {/* ---------- tour interativo ---------- */}
      <section id="tour" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16">
        <Titulo selo="Veja na prática" titulo="Um tour rápido pelo Estudos IA" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          Clique em cada passo para ver como a tela funciona. São dados de exemplo.
        </p>
        <div className="mt-10"><TourProduto /></div>
      </section>

      {/* ---------- três jeitos de estudar (as mesmas opções que a tutora oferece) ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <Titulo selo="Do seu jeito" titulo="Três jeitos de estudar, na mesma conversa" />
        <p className="mx-auto mt-4 max-w-2xl text-center text-muted-foreground">
          É só pedir ajuda: a tutora apresenta as opções e você escolhe. Dá para trocar a qualquer momento.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {JEITOS.map(({ icone: Icone, titulo, texto, exemplo }, i) => (
            <AnimatedContent key={titulo} distance={40} delay={i * 0.08} className="h-full">
              <div className="flex h-full flex-col gap-3 rounded-2xl border bg-card p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground">
                  <Icone className="size-5" />
                </span>
                <h3 className="text-xl font-semibold">{titulo}</h3>
                <p className="flex-1 text-muted-foreground">{texto}</p>
                <p className="rounded-xl bg-secondary/70 px-3 py-2 text-sm text-secondary-foreground italic">{exemplo}</p>
              </div>
            </AnimatedContent>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Button asChild variant="outline" size="lg">
            <Link to="/como-usar">Ver o guia completo de uso <ArrowRight /></Link>
          </Button>
        </div>
      </section>

      {/* ---------- recursos (bento) ---------- */}
      <section id="recursos" className="mx-auto max-w-5xl scroll-mt-20 px-4 py-16">
        <Titulo selo="Recursos" titulo="Feito para você aprender de verdade" />
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {RECURSOS.map(({ icone: Icone, titulo, texto, classe }, i) => (
            <AnimatedContent key={titulo} distance={40} delay={(i % 3) * 0.08} className={cn('h-full', classe)}>
              <SpotlightCard
                theme={escuro ? 'dark' : 'light'}
                spotlightColor="rgba(196, 100, 58, 0.18)"
                className="h-full rounded-2xl border bg-card p-6"
              >
                <div className="flex h-full flex-col gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icone className="size-5" />
                  </span>
                  <h3 className="text-xl font-semibold">{titulo}</h3>
                  <p className="text-muted-foreground">{texto}</p>
                </div>
              </SpotlightCard>
            </AnimatedContent>
          ))}
        </div>
      </section>

      {/* ---------- chamada final ---------- */}
      <section className="mx-auto max-w-5xl px-4 py-16">
        <AnimatedContent distance={40}>
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <div className="absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl" aria-hidden />
            <div className="absolute -bottom-24 -left-24 size-72 rounded-full bg-black/10 blur-2xl" aria-hidden />
            <h2 className="relative text-3xl font-semibold sm:text-4xl">Seu próximo assunto começa hoje.</h2>
            <p className="relative mx-auto mt-3 max-w-xl opacity-90">
              Crie sua conta, conte o que quer aprender e receba uma trilha com materiais reais em segundos.
            </p>
            <Button asChild size="lg" variant="secondary" className="relative mt-8 h-11 px-6 text-base">
              <Link to="/entrar?modo=cadastrar">Criar minha conta <ArrowRight /></Link>
            </Button>
          </div>
        </AnimatedContent>
      </section>

      <div ref={rodape} className="max-sm:pb-20"><Rodape /></div>

      {/* CTA fixo no celular: aparece depois que o botão do topo sai da tela e some perto do rodapé */}
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur transition-transform duration-300 sm:hidden',
          ctaFixo ? 'translate-y-0' : 'translate-y-full',
        )}
        aria-hidden={!ctaFixo}
      >
        <Button asChild size="lg" className="h-11 w-full text-base" tabIndex={ctaFixo ? 0 : -1}>
          <Link to="/entrar?modo=cadastrar">Começar grátis <ArrowRight /></Link>
        </Button>
      </div>
    </div>
  )
}

function Titulo({ selo, titulo }: { selo: string; titulo: string }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">{selo}</span>
      <h2 className="max-w-2xl text-3xl font-semibold sm:text-4xl">{titulo}</h2>
    </div>
  )
}

/** Ilustração da interface (dados de exemplo), no lugar de um print estático. */
function PreviaDoProduto() {
  const etapas = [
    { titulo: 'O que é crase', estado: 'feita' },
    { titulo: 'Regras obrigatórias', estado: 'atual' },
    { titulo: 'Casos especiais', estado: 'proxima' },
  ] as const
  return (
    <div className="mx-auto mt-16 max-w-4xl px-4" aria-label="Exemplo da interface" role="img">
      <div className="rounded-3xl border bg-card/80 p-2 shadow-2xl shadow-primary/10 backdrop-blur">
        <div className="flex items-center gap-1.5 px-3 py-2">
          {['bg-destructive/60', 'bg-chart-3/70', 'bg-sucesso/60'].map((c) => <span key={c} className={cn('size-2.5 rounded-full', c)} />)}
          <span className="ml-3 text-xs text-muted-foreground">Português · Trilha de exemplo</span>
        </div>
        <div className="grid gap-3 rounded-2xl bg-background p-4 text-left md:grid-cols-[1.4fr_1fr]">
          <div className="flex flex-col gap-3">
            <p className="font-heading text-lg font-semibold">Crase do básico ao avançado</p>
            {etapas.map((e, i) => (
              <div key={e.titulo} className={cn('flex items-center gap-3 rounded-xl border p-3',
                e.estado === 'atual' && 'border-primary/50 bg-accent/40')}>
                <span className={cn('grid size-7 place-items-center rounded-full text-xs font-semibold',
                  e.estado === 'feita' ? 'bg-sucesso text-primary-foreground' : 'bg-secondary')}>
                  {e.estado === 'feita' ? <CircleCheck className="size-4" /> : i + 1}
                </span>
                <span className="flex-1 text-sm font-medium">{e.titulo}</span>
                {e.estado === 'atual' && <span className="text-xs text-primary">Você está aqui</span>}
              </div>
            ))}
            <div className="flex items-center gap-2 rounded-xl bg-secondary/60 p-3 text-xs">
              <BadgeCheck className="size-4 text-sucesso" />
              <span className="flex-1">Crase: quando usar (com exemplos)</span>
              <span className="text-sucesso">Verificado</span>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <Miniatura icone={<Flame className="text-primary" />} titulo="12 dias seguidos" texto="Meta da semana: 4 de 5 dias" />
            <div className="flex flex-1 flex-col justify-center rounded-xl border bg-card p-4 text-center">
              <p className="text-xs text-muted-foreground">Flashcard</p>
              <p className="mt-1 font-heading text-base font-semibold">“Vou ___ escola” leva crase?</p>
              <p className="mt-2 text-xs text-muted-foreground">Toque para virar</p>
            </div>
            <Miniatura icone={<Trophy className="text-chart-3" />} titulo="Simulado: 9 de 10" texto="Dentro do tempo" />
          </div>
        </div>
      </div>
    </div>
  )
}

function Miniatura({ icone, titulo, texto }: { icone: ReactNode; titulo: string; texto: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-3 [&_svg]:size-5">
      {icone}
      <div>
        <p className="text-sm font-semibold">{titulo}</p>
        <p className="text-xs text-muted-foreground">{texto}</p>
      </div>
    </div>
  )
}

/** Mostra o CTA fixo enquanto nem o botão do topo nem o rodapé estão visíveis. */
function useCtaFixo(topo: React.RefObject<HTMLElement | null>, fim: React.RefObject<HTMLElement | null>) {
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

import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link } from 'react-router'
import AnimatedContent from '@/components/AnimatedContent'
import { CartaoBrilho } from '@/components/CartaoBrilho'
import CountUp from '@/components/CountUp'
import { EscolhaJeito } from '@/components/EscolhaJeito'
import { FundoFluido } from '@/components/FundoFluido'
import { JanelaProduto } from '@/components/JanelaProduto'
import { BotaoTema } from '@/components/Layout'
import { Magnetico } from '@/components/Magnetico'
import { Rodape } from '@/components/Rodape'
import { TelaInclinada } from '@/components/TelaInclinada'
import { TituloRevelado } from '@/components/TituloRevelado'
import { TourProduto } from '@/components/TourProduto'
import { Button } from '@/components/ui/button'
import { ArrowRight, BookOpenText, Brain, Compass, ShieldAlert } from '@/lib/icones'
import { useTitulo } from '@/lib/titulo'
import { cn } from '@/lib/utils'

// Landing no tema "caderno" (mockup A1: produto no centro). Tokens em .tema-caderno (index.css).

const CTA = 'Criar conta grátis' // um texto só para a mesma ação, em toda a página

// Fotos do Unsplash (licença livre para uso comercial, sem atribuição obrigatória; créditos no README),
// guardadas em public/imagens em WebP, sem metadados. A CSP só aceita imagens do próprio site.
const MATERIAS = [
  { foto: 'portugues', materia: 'Português', pedido: 'Quero acertar crase e vírgula para o ENEM.', recebe: 'Trilha com regras, exemplos e exercícios de crase.', alt: 'Mão escrevendo com caneta vermelha num caderno' },
  { foto: 'matematica', materia: 'Matemática', pedido: 'Me explique derivadas do zero.', recebe: 'Explicação passo a passo e questões por nível.', alt: 'Professor escrevendo fórmulas de cálculo num quadro-negro' },
  { foto: 'programacao', materia: 'Programação', pedido: 'Quero aprender Python para análise de dados.', recebe: 'Vídeos e tutoriais conferidos, do print ao pandas.', alt: 'Pessoa programando num notebook' },
  { foto: 'ingles', materia: 'Inglês', pedido: 'Preciso de inglês para entrevista de emprego.', recebe: 'Vocabulário em flashcards e revisão espaçada.', alt: 'Livro de inglês com capa amarela sobre uma mesa' },
  { foto: 'quimica', materia: 'Química', pedido: 'Me teste com perguntas de estequiometria.', recebe: 'Simulado cronometrado, com gabarito comentado ao finalizar.', alt: 'Pesquisadora usando uma pipeta em tubos de ensaio' },
  { foto: 'fisica', materia: 'Física', pedido: 'Monte uma trilha de cinemática para o vestibular.', recebe: 'Etapas do básico ao avançado, aprovadas por você.', alt: 'Professor resolvendo um problema de física no quadro' },
]

const ASSUNTOS = [
  'Python', 'SQL', 'Inglês', 'Crase', 'Física', 'Excel', 'Estatística', 'Redação', 'Química',
  'Git', 'Matemática financeira', 'Biologia', 'Power BI', 'Espanhol', 'História', 'Lógica de programação',
]

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

// Só números verdadeiros do produto (LinkValidator, extrator.py e ORDEM_NIVEIS no back-end).
const NUMEROS = [
  { valor: 100, sufixo: '%', texto: 'dos links conferidos antes de chegar a você' },
  { valor: 5, texto: 'formatos para a tutora ler: PDF, Word, PowerPoint, .txt e .md' },
  { valor: 3, texto: 'níveis de exercício, e a trilha se adapta aos seus acertos' },
  { valor: 0, prefixo: 'R$ ', texto: 'para usar. Sem cartão e sem período de teste' },
]

const PASSOS = [
  { titulo: 'Conte o objetivo', texto: 'Seu nível, seu prazo e o que quer dominar.' },
  { titulo: 'A plataforma pesquisa', texto: 'Vídeos e sites reais, cada link conferido.' },
  { titulo: 'Você aprova a trilha', texto: 'Nada é criado antes do seu ok.' },
  { titulo: 'Pratique e revise', texto: 'Exercícios por nível e revisão no dia certo.' },
]

// Intervalos reais da revisão espaçada (INTERVALOS em app/services/regras/revisao.py).
const INTERVALOS = [1, 3, 7, 15, 30]

// Exemplo da conferência: a IA só vê os números; o descartado nunca vira material.
const CONFERENCIA = [
  { item: '[1] pandas.pydata.org/docs', status: 'conferido', ok: true },
  { item: '[2] youtube.com/watch?v=…', status: 'API do YouTube', ok: true },
  { item: '[3] curso-pandas.exemplo', status: 'descartado', ok: false },
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
const PERGUNTAS = [
  {
    pergunta: 'É grátis mesmo?',
    resposta: 'Sim, sem cartão. Cada conta tem um limite por dia: 60 mensagens no chat, 30 ações com IA (gerar exercícios e flashcards, corrigir respostas abertas) e 6 pesquisas de trilha. Zera à meia-noite, no horário de Brasília.',
  },
  {
    pergunta: 'Os links são confiáveis?',
    resposta: 'Cada site é aberto e conferido antes de aparecer, e os vídeos são confirmados pela API oficial do YouTube. A IA escolhe materiais só pelo número, numa lista já verificada: ela nem vê os endereços.',
  },
  {
    pergunta: 'A IA pode errar?',
    resposta: 'Pode, como qualquer IA. Estudando pelo chat, a tutora faz uma pergunta ao fim de cada parte para conferir o que você entendeu; a trilha sempre aponta para o material original; e, quando a resposta vem dos seus arquivos, ela mostra o arquivo e a página.',
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

const TITULO_SECAO = 'max-w-[20ch] text-[clamp(2.1rem,4.4vw,3rem)] leading-none'
const CARTAO = 'rounded-[18px] bg-card ring-1 ring-border'

export function PaginaInicio() {
  useTitulo(null)
  const ctaTopo = useRef<HTMLDivElement>(null)
  const rodape = useRef<HTMLDivElement>(null)
  const ctaFixo = useCtaFixo(ctaTopo, rodape)

  return (
    <div className="tema-caderno min-h-svh overflow-x-hidden">
      {/* correnteza de linhas finas por cima do quadriculado, que vira redemoinho em volta do mouse */}
      <FundoFluido fixo className="-z-10" />
      {/* ---------- topo ---------- */}
      <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center gap-1 px-4 sm:px-6" aria-label="Principal">
          <Link to="/" className="mr-auto flex items-center gap-2 font-heading text-base font-bold tracking-tight" aria-label="Estudos IA: início">
            <span className="grid size-8 place-items-center rounded-[9px] bg-primary text-primary-foreground">
              <BookOpenText className="size-4" weight="bold" />
            </span>
            Estudos IA
          </Link>
          <a href="#como-funciona" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Como funciona</a>
          <a href="#recursos" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Recursos</a>
          <a href="#perguntas" className="hidden rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground md:block">Perguntas</a>
          <BotaoTema />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex"><Link to="/entrar">Entrar</Link></Button>
          <Button asChild size="sm" className="rounded-[10px]"><Link to="/entrar?modo=cadastrar">{CTA}</Link></Button>
        </nav>
      </header>

      <main>
        {/* ---------- hero: texto centralizado e o produto embaixo ---------- */}
        <section className="cascata mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 pt-16 text-center sm:px-6 sm:pt-22">
          <h1 className="max-w-[15ch] text-[clamp(2.7rem,6.4vw,5rem)] leading-[0.98]">
            Estude qualquer assunto com uma tutora <span className="text-destaque">que pesquisa por você.</span>
          </h1>
          <p className="max-w-[52ch] text-lg leading-relaxed text-muted-foreground sm:text-[19px]">
            A plataforma busca vídeos e sites reais, confere cada link e monta sua trilha do básico ao avançado.
            Você aprova antes de começar.
          </p>
          <div ref={ctaTopo} className="flex flex-wrap justify-center gap-3">
            <Magnetico>
              <Button asChild size="lg" className="h-12 rounded-xl px-6 text-base">
                <Link to="/entrar?modo=cadastrar">{CTA} <ArrowRight weight="bold" /></Link>
              </Button>
            </Magnetico>
            <Button asChild size="lg" variant="outline" className="h-12 rounded-xl bg-card px-5 text-base">
              <a href="#tour">Ver por dentro</a>
            </Button>
          </div>
          <p className="text-[13px] text-muted-foreground">Grátis, sem cartão. Funciona no navegador do celular.</p>
          <ProdutoEmPe>
            <CartaoBrilho className="rounded-[20px]">
              <JanelaProduto />
            </CartaoBrilho>
          </ProdutoEmPe>
        </section>

        {/* ---------- faixa infinita de assuntos ---------- */}
        <div className="mascara-lados mt-16 overflow-hidden py-5" aria-label="Exemplos de assuntos">
          <ul className="faixa-rolando flex w-max gap-3">
            {[...ASSUNTOS, ...ASSUNTOS].map((assunto, i) => (
              <li
                key={i}
                aria-hidden={i >= ASSUNTOS.length}
                className="rounded-full bg-card/80 px-4 py-1.5 text-sm text-muted-foreground ring-1 ring-border backdrop-blur"
              >
                {assunto}
              </li>
            ))}
          </ul>
        </div>

        {/* ---------- números verdadeiros, contando ao aparecer ---------- */}
        <section aria-label="Em números" className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6">
          <dl className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {NUMEROS.map(({ valor, prefixo = '', sufixo = '', texto }) => (
              <div key={texto}>
                <dt className="font-mono text-[40px] font-medium text-destaque tabular-nums">
                  {prefixo}<CountUp to={valor} duration={1.6} />{sufixo}
                </dt>
                <dd className="mt-1.5 max-w-[28ch] text-sm text-muted-foreground">{texto}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* ---------- para qualquer matéria: fotos + o que pedir + o que você recebe ---------- */}
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
          <TituloRevelado texto="Funciona para qualquer matéria." className={cn(TITULO_SECAO, 'max-w-[22ch]')} />
          <p className="mt-4 max-w-[56ch] text-muted-foreground">
            Escreva o que quer aprender do seu jeito. Veja exemplos de pedidos e o que a plataforma devolve.
          </p>
          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MATERIAS.map(({ foto, materia, pedido, recebe, alt }, i) => (
              <AnimatedContent key={materia} distance={24} delay={(i % 3) * 0.07}>
                <li className={cn(CARTAO, 'group flex h-full flex-col overflow-hidden')} tabIndex={0}>
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={`/imagens/${foto}.webp`} alt={alt} width={900} height={675} loading="lazy" decoding="async" className="foto-pb size-full object-cover" />
                    <span className="absolute top-3 left-3 rounded-md bg-background/90 px-2.5 py-1 text-sm font-medium backdrop-blur">{materia}</span>
                  </div>
                  <div className="flex flex-1 flex-col gap-3 p-5">
                    <p className="text-sm"><span className="text-muted-foreground">Você pede: </span><span className="italic">“{pedido}”</span></p>
                    <p className="mt-auto flex gap-2 text-sm">
                      <ArrowRight className="mt-0.5 size-4 shrink-0 text-destaque" weight="bold" aria-hidden />
                      <span>{recebe}</span>
                    </p>
                  </div>
                </li>
              </AnimatedContent>
            ))}
          </ul>
        </section>

        {/* ---------- por que existe: título fixo + lista ---------- */}
        <section id="por-que" className="mx-auto grid max-w-6xl gap-10 px-4 pt-24 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <TituloRevelado texto="Estudar sozinho tem três armadilhas." className={TITULO_SECAO} />
            <p className="mt-4 max-w-[42ch] text-muted-foreground">
              O Estudos IA nasceu para resolver as três num lugar só: um caminho claro, fontes que existem e prática que fixa.
            </p>
            <img
              src="/imagens/estudante.webp"
              alt="Pessoa estudando com notebook, caderno de anotações e régua sobre a mesa"
              width={1000}
              height={750}
              loading="lazy"
              decoding="async"
              className="mt-8 hidden aspect-[4/3] w-full max-w-md rounded-[18px] object-cover ring-1 ring-border grayscale lg:block"
            />
          </div>
          <ul className="flex flex-col gap-4">
            {ARMADILHAS.map(({ icone: Icone, titulo, texto }, i) => (
              <AnimatedContent key={titulo} distance={30} delay={i * 0.06}>
                <li>
                  <CartaoBrilho className={cn(CARTAO, 'group flex gap-5 p-6')}>
                    <Icone className="mt-1 size-6 shrink-0 text-destaque transition-transform duration-500 ease-[var(--mola)] group-hover:scale-110 group-hover:-rotate-6" />
                    <div>
                      <h3 className="text-xl">{titulo}</h3>
                      <p className="mt-2 max-w-[52ch] text-muted-foreground">{texto}</p>
                    </div>
                  </CartaoBrilho>
                </li>
              </AnimatedContent>
            ))}
          </ul>
        </section>

        {/* ---------- quatro passos ---------- */}
        <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
          <TituloRevelado texto="Da dúvida à trilha em quatro passos." className={TITULO_SECAO} />
          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PASSOS.map(({ titulo, texto }, i) => (
              <AnimatedContent key={titulo} distance={24} delay={i * 0.06}>
                <li className="h-full">
                  <CartaoBrilho className={cn(CARTAO, 'flex h-full flex-col gap-2.5 p-6')}>
                    <span className="font-mono text-[13px] text-accent-foreground">{String(i + 1).padStart(2, '0')}</span>
                    <h3 className="text-[19px]">{titulo}</h3>
                    <p className="text-[15px] text-muted-foreground">{texto}</p>
                  </CartaoBrilho>
                </li>
              </AnimatedContent>
            ))}
          </ol>
        </section>

        {/* ---------- tour com componentes reais ---------- */}
        <section id="tour" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
          <div className="mb-12 max-w-2xl">
            <p className="mb-3 font-mono text-[13px] text-accent-foreground">Por dentro</p>
            <TituloRevelado texto="As telas que você vai usar todo dia." className={TITULO_SECAO} />
            <p className="mt-4 text-muted-foreground">São os componentes do próprio app, com dados de exemplo. Clique para explorar.</p>
          </div>
          <TelaInclinada><TourProduto /></TelaInclinada>
        </section>

        {/* ---------- três jeitos: escolha um e veja como funciona ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <TituloRevelado texto="Peça ajuda e escolha como estudar." className={cn(TITULO_SECAO, 'max-w-[22ch]')} />
          <p className="mt-4 max-w-[56ch] text-muted-foreground">Clique em cada jeito para ver para quem é, como funciona e um exemplo que dá para mexer.</p>
          <EscolhaJeito />
        </section>

        {/* ---------- recursos em bento ---------- */}
        <section id="recursos" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
          <TituloRevelado texto="Tudo o que um chat solto não faz por você." className={TITULO_SECAO} />
          <div className="mt-12 grid gap-4 lg:grid-cols-6">
            <CartaoBrilho className="flex min-h-[280px] flex-col gap-5 rounded-3xl bg-[var(--escuro)] p-8 text-[#F4F3EF] ring-1 ring-border lg:col-span-4">
              <h3 className="text-[26px]">Fontes conferidas</h3>
              <p className="max-w-[44ch] text-[#F4F3EF]/75">
                A IA escolhe materiais por número numa lista já verificada. Ela nem vê as URLs, então não tem como inventar um link.
              </p>
              <ul className="mt-auto flex flex-col gap-2 font-mono text-[13px]">
                {CONFERENCIA.map(({ item, status, ok }) => (
                  <li key={item} className={cn('flex justify-between gap-3 rounded-[10px] bg-white/[0.07] px-3.5 py-2.5', !ok && 'text-[#F4F3EF]/50')}>
                    <span className="truncate">{item}</span>
                    <span className={cn('shrink-0', ok ? 'text-[#7FD1A5]' : 'text-[#F08A80]')}>{status}</span>
                  </li>
                ))}
              </ul>
            </CartaoBrilho>
            <CartaoBrilho className="flex flex-col gap-3 rounded-3xl bg-card p-7 ring-1 ring-border lg:col-span-2">
              <h3 className="text-[21px]">Revisão espaçada</h3>
              <p className="text-[15px] text-muted-foreground">O conteúdo volta no dia certo, antes de você esquecer.</p>
              <ul className="mt-auto flex flex-wrap gap-1.5 font-mono text-[13px]" aria-label="Intervalos de revisão">
                {INTERVALOS.map((d) => (
                  <li key={d} className="rounded-[7px] bg-accent px-2.5 py-1.5 text-accent-foreground">{d}d</li>
                ))}
              </ul>
            </CartaoBrilho>
            <CartaoBrilho className="flex flex-col gap-3 rounded-3xl bg-card p-7 ring-1 ring-border lg:col-span-2">
              <h3 className="text-[21px]">Flashcards</h3>
              <p className="text-[15px] text-muted-foreground">Gerados dos materiais da etapa, com revisão espaçada.</p>
            </CartaoBrilho>
            <CartaoBrilho className="flex flex-col gap-3 rounded-3xl bg-card p-7 ring-1 ring-border lg:col-span-2">
              <h3 className="text-[21px]">Simulados</h3>
              {/* gabarito só depois de finalizar (invariante 8): nada de "correção na hora" */}
              <p className="text-[15px] text-muted-foreground">Prova com tempo marcado. Ao finalizar, você vê os acertos, o gabarito e a explicação de cada questão.</p>
              <span className="mt-auto font-mono text-[28px] font-medium tabular-nums" aria-hidden>24:59</span>
            </CartaoBrilho>
            <CartaoBrilho className="flex flex-col gap-3 rounded-3xl bg-card p-7 ring-1 ring-border lg:col-span-2">
              <h3 className="text-[21px]">Cronômetro de foco</h3>
              <p className="text-[15px] text-muted-foreground">Ciclos de 25 minutos que entram no seu calendário.</p>
            </CartaoBrilho>
            <CartaoBrilho className="flex flex-col gap-3 rounded-3xl bg-accent p-7 text-accent-foreground lg:col-span-6 lg:flex-row lg:items-baseline lg:gap-8">
              <h3 className="shrink-0 text-[21px]">Trilha que se adapta</h3>
              <p className="text-[15px]">Três níveis de exercício. Errou muito, a trilha reforça. Acertou, ela avança.</p>
            </CartaoBrilho>
          </div>
        </section>

        {/* ---------- comparação: o que a plataforma acrescenta a um chat de IA ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <TituloRevelado texto="Por que não estudar só com um chat de IA?" className={cn(TITULO_SECAO, 'max-w-[22ch]')} />
          <div role="table" aria-label="Chat de IA comum comparado ao Estudos IA" className="mt-10 rounded-3xl bg-card px-5 py-2 ring-1 ring-border sm:px-7">
            <div role="row" className="hidden gap-6 py-4.5 text-sm font-medium sm:grid sm:grid-cols-[9rem_1fr_1fr]">
              <span role="columnheader"><span className="sr-only">Tema</span></span>
              <span role="columnheader" className="text-muted-foreground">Chat de IA comum</span>
              <span role="columnheader" className="text-accent-foreground">Estudos IA</span>
            </div>
            {COMPARACAO.map(({ tema, comum, nosso }, i) => (
              <div key={tema} role="row" className={cn('-mx-3 grid gap-2 rounded-xl px-3 py-4.5 transition-colors duration-300 hover:bg-muted sm:grid-cols-[9rem_1fr_1fr] sm:gap-6', i > 0 ? 'border-t' : 'sm:border-t')}>
                <span role="rowheader" className="font-semibold">{tema}</span>
                <span role="cell" className="text-muted-foreground"><span className="sm:sr-only">Chat de IA comum: </span>{comum}</span>
                <span role="cell"><span className="font-medium text-accent-foreground sm:sr-only">Estudos IA: </span>{nosso}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ---------- perguntas frequentes ---------- */}
        <section id="perguntas" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
          <TituloRevelado texto="Perguntas frequentes" className={TITULO_SECAO} />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {PERGUNTAS.map(({ pergunta, resposta }, i) => (
              <AnimatedContent key={pergunta} distance={20} delay={(i % 2) * 0.06}>
                <CartaoBrilho className={cn(CARTAO, 'h-full p-6')}>
                  <h3 className="font-sans text-[17px] font-semibold tracking-normal">{pergunta}</h3>
                  <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{resposta}</p>
                </CartaoBrilho>
              </AnimatedContent>
            ))}
          </div>
        </section>

        {/* ---------- chamada final ---------- */}
        <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-6 rounded-[28px] bg-[var(--escuro)] px-6 py-14 text-[#F4F3EF] ring-1 ring-border sm:px-12 sm:py-16">
            <div>
              <h2 className="max-w-[18ch] text-[clamp(1.9rem,3.8vw,2.7rem)] leading-none">
                Seu próximo assunto pode <span className="text-[#F08A80]">começar hoje.</span>
              </h2>
              <p className="mt-3 text-[#F4F3EF]/75">Grátis, sem cartão. Código aberto no GitHub.</p>
            </div>
            <Magnetico>
              <Button asChild size="lg" className="h-12 rounded-xl bg-[#F4F3EF] px-6 text-base text-[#151514] hover:bg-[#F4F3EF]/90">
                <Link to="/entrar?modo=cadastrar">{CTA} <ArrowRight weight="bold" /></Link>
              </Button>
            </Magnetico>
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

/** O produto do hero começa levemente deitado em 3D e fica de pé conforme a rolagem. */
function ProdutoEmPe({ children }: { children: ReactNode }) {
  const caixa = useRef<HTMLDivElement>(null)
  const parado = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: caixa, offset: ['start end', 'start 0.35'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [14, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.94, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.4], [0.6, 1])
  return (
    <div ref={caixa} className="mt-10 w-full" style={{ perspective: 1400 }}>
      <motion.div style={parado ? undefined : { rotateX, scale, opacity, transformOrigin: 'center top' }}>{children}</motion.div>
    </div>
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

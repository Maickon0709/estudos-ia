import {
  ArrowRight, BadgeCheck, CalendarDays, ClipboardCheck, Dumbbell, FileText, FolderPlus, Layers, MessageCircle,
  Moon, RotateCcw, Route, Target, Timer, UserRound,
} from '@/lib/icones'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { PaginaPublica } from '@/components/PaginaPublica'
import { Button } from '@/components/ui/button'
import { useLogado } from '@/lib/sessao'
import { useTitulo } from '@/lib/titulo'

const PASSOS: { icone: typeof Route; titulo: string; onde: string; texto: ReactNode }[] = [
  {
    icone: FolderPlus,
    titulo: 'Crie uma categoria',
    onde: 'Menu “Categorias”',
    texto: 'Uma categoria é um assunto que você quer estudar: Português, SQL, Inglês… Cada uma tem sua conversa, sua trilha e seus exercícios.',
  },
  {
    icone: MessageCircle,
    titulo: 'Converse com a tutora e escolha como estudar',
    onde: 'Categoria → aba “Conversa”',
    texto: (
      <>
        Conte o que quer aprender e o que já sabe. A tutora oferece três caminhos:
        <strong> estudar ali mesmo pelo chat</strong>, com explicações e perguntas;
        <strong> montar uma trilha</strong> com vídeos do YouTube e sites verificados; ou
        <strong> praticar</strong> com exercícios, flashcards e simulados. Os botões de atalho acima do campo de mensagem levam direto a cada um.
        Importante: a tutora conversa, mas não cria nada sozinha. Pedir “faça uma trilha” no chat não cria a trilha; use o botão do próximo passo.
      </>
    ),
  },
  {
    icone: Route,
    titulo: 'Aprove a trilha',
    onde: 'Botão “Montar trilha de estudo”',
    texto: 'Clique em “Montar trilha de estudo”, abaixo do chat, descreva seu objetivo e escolha a fonte: “Tudo junto” (seus PDFs e slides mais vídeos e sites verificados), “Só meus arquivos” ou “Só vídeos e sites”. Nada é criado antes de você clicar em Confirmar; aí a trilha aparece na aba “Trilha”.',
  },
  {
    icone: BadgeCheck,
    titulo: 'Siga as etapas e marque o checklist',
    onde: 'Categoria → aba “Trilha”',
    texto: 'O mapa mostra onde você está. Abra os materiais, mude o status da etapa (não iniciada, em andamento, concluída) ou marque “já sei este conteúdo”.',
  },
  {
    icone: Dumbbell,
    titulo: 'Pratique',
    onde: 'Categoria → aba “Praticar”',
    texto: 'Para cada etapa: exercícios em três níveis (o intermediário libera com 80% de acerto no básico) e flashcards. Não entendeu uma correção? Peça outra explicação.',
  },
  {
    icone: ClipboardCheck,
    titulo: 'Faça um simulado',
    onde: 'Aba “Praticar” → Simulado',
    texto: 'Uma prova com tempo marcado, sorteada entre os exercícios que você já gerou. A correção sai na hora, com o gabarito comentado.',
  },
  {
    icone: RotateCcw,
    titulo: 'Revise no dia certo',
    onde: 'Menu “Revisões”',
    texto: 'O que você errou volta no dia seguinte; acertando, o intervalo cresce (3, 7, 15 e 30 dias). Flashcards seguem a mesma regra.',
  },
  {
    icone: CalendarDays,
    titulo: 'Acompanhe sua evolução',
    onde: 'Menu “Hoje” e aba “Painel”',
    texto: 'Calendário de estudos, sequência de dias, meta da semana, acerto por nível, pontos fracos e tempo de foco por semana.',
  },
]

const EXTRAS = [
  { icone: FileText, titulo: 'Seus materiais', texto: 'Aba “Materiais” da categoria: envie PDF, Word, PowerPoint ou texto e a tutora responde com base neles, dizendo o arquivo e a página. Peça “resuma meus materiais” para uma visão geral ou pergunte sobre um tema específico, como “explique a fase de especificação”.' },
  { icone: Timer, titulo: 'Cronômetro de foco', texto: 'Ícone de relógio no topo: ciclos de 25 minutos de foco e 5 de pausa. O tempo vai para o calendário.' },
  { icone: Target, titulo: 'Meta da semana', texto: 'Na tela Hoje, defina quantos dias por semana quer estudar e acompanhe o andamento.' },
  { icone: Layers, titulo: 'Flashcards', texto: 'Vire o cartão, responda se lembrou e a revisão espaçada cuida do resto.' },
  { icone: Moon, titulo: 'Tema escuro', texto: 'Ícone de lua no topo. A escolha fica salva no seu navegador.' },
  { icone: UserRound, titulo: 'Sua conta', texto: 'Baixe todos os seus dados ou exclua a conta quando quiser.' },
]

const PERGUNTAS = [
  ['A IA pode inventar links?', 'Não. A IA só escolhe materiais pelo número de uma lista que a plataforma já pesquisou e verificou; ela nem vê as URLs. Vídeos são confirmados na API oficial do YouTube.'],
  ['Pedi uma trilha no chat e a aba Trilha continua vazia. Por quê?', 'A tutora só conversa: ela não cria trilhas. Quando você pede uma, aparece um cartão com o botão “Montar trilha de estudo” logo abaixo da resposta. Clique nele (ou no botão abaixo do chat), confira o objetivo e confirme a proposta. Só então a trilha aparece na aba Trilha.'],
  ['A trilha pode usar os PDFs que eu enviei?', 'Pode. Ao montar a trilha, escolha “Tudo junto” (seus arquivos como base, mais vídeos e sites verificados para completar) ou “Só meus arquivos”. A IA organiza as partes dos seus PDFs e slides em etapas, do básico ao avançado, e os exercícios e flashcards de cada etapa usam o texto delas. “Só vídeos e sites” pesquisa apenas na internet.'],
  ['A tutora leu meus arquivos inteiros?', 'Não. A cada pergunta, ela recebe a lista de todos os arquivos e os trechos que mais combinam com o que você perguntou. Para uma visão geral, peça “resuma meus materiais”; para detalhes, pergunte sobre o tema.'],
  ['Preciso montar uma trilha para usar?', 'Não. Você pode estudar só pela conversa com a tutora. A trilha serve para organizar materiais e liberar exercícios, flashcards e simulados.'],
  ['Por que o nível intermediário está bloqueado?', 'Ele libera quando você acerta 80% de pelo menos 3 exercícios do básico, ou quando marca “já sei este conteúdo” na etapa.'],
  ['As respostas da IA estão sempre certas?', 'Não. A IA pode errar. Use as fontes indicadas para conferir pontos importantes.'],
  ['Como apago meus dados?', 'Na página Conta (ícone de pessoa no topo), em “Excluir conta”. Tudo é apagado na hora.'],
]

export function PaginaComoUsar() {
  useTitulo('Como usar', 'Guia passo a passo do Estudos IA: criar categorias, conversar com a tutora, montar trilhas, praticar com exercícios, flashcards e simulados e revisar no dia certo.')
  const logado = useLogado()
  return (
    <PaginaPublica>
      <div className="flex flex-col gap-12">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">Guia</span>
          <h1 className="text-3xl font-semibold sm:text-5xl">Como usar o Estudos IA</h1>
          <p className="max-w-2xl text-muted-foreground">Do primeiro assunto à revisão espaçada, em oito passos.</p>
        </div>

        <ol className="relative flex flex-col gap-4 before:absolute before:top-4 before:bottom-4 before:left-6 before:w-0.5 before:bg-border">
          {PASSOS.map(({ icone: Icone, titulo, onde, texto }, i) => (
            <li key={titulo} className="relative flex gap-4">
              <span className="z-10 grid size-12 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Icone className="size-5" />
              </span>
              <div className="flex flex-1 flex-col gap-1 rounded-2xl border bg-card p-5">
                <span className="text-xs font-medium text-primary">Passo {i + 1} · {onde}</span>
                <h2 className="text-lg font-semibold">{titulo}</h2>
                <p className="text-sm text-muted-foreground">{texto}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Recursos que ajudam</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {EXTRAS.map(({ icone: Icone, titulo, texto }) => (
              <div key={titulo} className="flex gap-3 rounded-2xl border bg-card p-4">
                <Icone className="mt-0.5 size-5 shrink-0 text-primary" />
                <div>
                  <h3 className="font-semibold">{titulo}</h3>
                  <p className="text-sm text-muted-foreground">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">Perguntas frequentes</h2>
          <div className="flex flex-col gap-2">
            {PERGUNTAS.map(([pergunta, resposta]) => (
              <details key={pergunta} className="group rounded-2xl border bg-card p-4">
                <summary className="cursor-pointer font-medium">{pergunta}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{resposta}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="flex justify-center">
          <Button asChild size="lg">
            {logado ? <Link to="/categorias">Ir para minhas categorias <ArrowRight /></Link>
              : <Link to="/entrar?modo=cadastrar">Criar minha conta <ArrowRight /></Link>}
          </Button>
        </div>
      </div>
    </PaginaPublica>
  )
}

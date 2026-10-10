import {
  ArrowLeft, ArrowRight, Camera, Dumbbell, FolderPlus, Lightbulb, MessageCircle, Moon, PartyPopper,
  RotateCcw, Timer, X,
} from 'lucide-react'
import { useState, useSyncExternalStore, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { comemorar } from '@/lib/comemorar'
import { cn } from '@/lib/utils'

// Preferências de interface, não dados sensíveis: ficam no navegador.
const CHAVE_BOAS_VINDAS = 'estudos-ia:tutorial-v1'
const PREFIXO_DICA = 'estudos-ia:dica-v1:'

function ler(chave: string) {
  try { return localStorage.getItem(chave) === '1' } catch { return false }
}
function gravar(chave: string, valor: boolean) {
  try { if (valor) localStorage.setItem(chave, '1'); else localStorage.removeItem(chave) } catch { /* só nesta visita */ }
  window.dispatchEvent(new Event('tutorial-mudou'))
}
function assinar(aoMudar: () => void) {
  window.addEventListener('tutorial-mudou', aoMudar)
  return () => window.removeEventListener('tutorial-mudou', aoMudar)
}

/** Volta a mostrar as boas-vindas e todas as dicas (botão "Rever tutorial"). */
export function reverTutorial() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(PREFIXO_DICA)).forEach((k) => localStorage.removeItem(k))
  } catch { /* nada a limpar */ }
  gravar(CHAVE_BOAS_VINDAS, false)
}

// ---------- boas-vindas ----------
const PASSOS: { icone: typeof Lightbulb; titulo: string; onde: string; texto: ReactNode }[] = [
  {
    icone: PartyPopper,
    titulo: 'Boas-vindas ao Estudos IA!',
    onde: 'Leva um minuto',
    texto: 'Vamos mostrar rapidinho onde fica cada coisa. Dá para pular e rever depois na página Conta.',
  },
  {
    icone: FolderPlus,
    titulo: 'Tudo começa numa categoria',
    onde: 'Menu “Categorias”',
    texto: 'Uma categoria é um assunto: Português, SQL, Inglês… Cada uma tem sua conversa, trilha, exercícios e painel.',
  },
  {
    icone: MessageCircle,
    titulo: 'Converse e escolha como estudar',
    onde: 'Categoria → aba “Conversa”',
    texto: (
      <>A tutora oferece três caminhos: <strong>estudar pelo chat</strong>, <strong>montar uma trilha</strong> com vídeos
        do YouTube e sites verificados, ou <strong>praticar</strong>. Os atalhos acima do campo de mensagem ajudam.</>
    ),
  },
  {
    icone: Dumbbell,
    titulo: 'Pratique e faça simulados',
    onde: 'Categoria → aba “Praticar”',
    texto: 'Exercícios em três níveis, flashcards e simulados cronometrados, etapa por etapa. Errou? Peça outra explicação.',
  },
  {
    icone: RotateCcw,
    titulo: 'Revise e acompanhe',
    onde: 'Menus “Revisões” e “Hoje”',
    texto: (
      <span className="flex flex-col gap-2">
        <span>O que você errou volta no dia certo. A tela Hoje mostra sua sequência, meta da semana e calendário.</span>
        <span className="flex flex-wrap gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1"><Timer className="size-3" /> Cronômetro de foco no topo</span>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1"><Moon className="size-3" /> Tema escuro</span>
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1"><Camera className="size-3" /> Foto de perfil na Conta</span>
        </span>
      </span>
    ),
  },
]

export function BoasVindas() {
  const visto = useSyncExternalStore(assinar, () => ler(CHAVE_BOAS_VINDAS))
  const [passo, setPasso] = useState(0)
  const navigate = useNavigate()
  const fechar = () => { gravar(CHAVE_BOAS_VINDAS, true); setPasso(0) }
  const ultimo = passo === PASSOS.length - 1
  const { icone: Icone, titulo, onde, texto } = PASSOS[passo]

  return (
    <Dialog open={!visto} onOpenChange={(aberto) => { if (!aberto) fechar() }}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-md">
        <div className="relative grid place-items-center bg-gradient-to-br from-accent via-secondary to-background px-6 pt-10 pb-8">
          <span key={passo} className="surgir grid size-16 place-items-center rounded-3xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Icone className="size-8" />
          </span>
        </div>
        <div key={`t${passo}`} className="surgir flex flex-col gap-2 px-6 pt-5">
          <span className="text-xs font-medium text-primary">{onde}</span>
          <DialogTitle className="font-heading text-2xl">{titulo}</DialogTitle>
          <DialogDescription asChild><div className="text-sm text-muted-foreground">{texto}</div></DialogDescription>
        </div>
        <div className="flex items-center gap-2 px-6 pt-6 pb-5">
          <div className="mr-auto flex gap-1.5" aria-label={`Passo ${passo + 1} de ${PASSOS.length}`}>
            {PASSOS.map((_, i) => (
              <span key={i} className={cn('h-1.5 rounded-full transition-all', i === passo ? 'w-5 bg-primary' : 'w-1.5 bg-border')} />
            ))}
          </div>
          {passo === 0
            ? <Button variant="ghost" size="sm" onClick={fechar}>Pular</Button>
            : <Button variant="ghost" size="icon-sm" onClick={() => setPasso((p) => p - 1)} aria-label="Voltar"><ArrowLeft /></Button>}
          {ultimo ? (
            <Button size="sm" onClick={() => { fechar(); comemorar(); navigate('/categorias') }}>
              Criar minha primeira categoria <ArrowRight />
            </Button>
          ) : (
            <Button size="sm" onClick={() => setPasso((p) => p + 1)}>Próximo <ArrowRight /></Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ---------- dicas de primeira visita ----------
/** Cartão de dica que aparece na primeira visita a uma tela e some ao clicar em "Entendi". */
export function Dica({ id, titulo, children, className }: { id: string; titulo: string; children: ReactNode; className?: string }) {
  const chave = PREFIXO_DICA + id
  const vista = useSyncExternalStore(assinar, () => ler(chave))
  const boasVindasVista = useSyncExternalStore(assinar, () => ler(CHAVE_BOAS_VINDAS))
  if (vista || !boasVindasVista) return null // uma coisa de cada vez: primeiro as boas-vindas
  return (
    <div role="note" className={cn('surgir flex gap-3 rounded-2xl border border-primary/30 bg-accent/40 p-4 text-sm', className)}>
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-semibold">{titulo}</p>
        <div className="mt-1 text-muted-foreground">{children}</div>
        <Button size="xs" variant="outline" className="mt-3" onClick={() => gravar(chave, true)}>Entendi</Button>
      </div>
      <button type="button" onClick={() => gravar(chave, true)} aria-label="Fechar dica" className="self-start text-muted-foreground hover:text-foreground">
        <X className="size-4" />
      </button>
    </div>
  )
}

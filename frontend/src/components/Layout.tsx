import { useQuery } from '@tanstack/react-query'
import { BookOpenText, House, Library, Moon, RotateCcw, Sun } from '@/lib/icones'
import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { Avatar } from '@/components/Avatar'
import { Cronometro } from '@/components/Cronometro'
import { Rodape } from '@/components/Rodape'
import { BoasVindas } from '@/components/Tutorial'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/api'
import { trocarTema, useTema } from '@/lib/tema'
import { cn } from '@/lib/utils'

function ItemMenu({ to, icone, rotulo, extra }: { to: string; icone: ReactNode; rotulo: string; extra?: ReactNode }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      aria-label={rotulo}
      title={rotulo}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm transition-colors sm:px-3 [&_svg]:size-4',
          isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {icone}
      <span className="hidden sm:inline">{rotulo}</span>
      {extra}
    </NavLink>
  )
}

export function BotaoTema() {
  const escuro = useTema() === 'escuro'
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={trocarTema}
      aria-label={escuro ? 'Usar tema claro' : 'Usar tema escuro'}
      title={escuro ? 'Tema claro' : 'Tema escuro'}
    >
      {escuro ? <Sun /> : <Moon />}
    </Button>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const revisoes = useQuery({ queryKey: ['revisoes'], queryFn: api.revisoesHoje })
  const flashcards = useQuery({ queryKey: ['flashcards-hoje'], queryFn: api.flashcardsHoje })
  const pendentes = (revisoes.data?.length ?? 0) + (flashcards.data?.length ?? 0)
  const selo = pendentes > 0 && (
    <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{pendentes}</span>
  )

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-1 px-4 sm:gap-2">
          <Link to="/" aria-label="Estudos IA: início" className="mr-auto flex items-center gap-2 font-heading text-lg font-semibold">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenText className="size-4" />
            </span>
            <span className="sm:max-md:hidden">Estudos IA</span>
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Menu principal">
            <ItemMenu to="/" icone={<House />} rotulo="Hoje" />
            <ItemMenu to="/categorias" icone={<Library />} rotulo="Categorias" />
            <ItemMenu to="/revisoes" icone={<RotateCcw />} rotulo="Revisões" extra={selo} />
          </nav>
          <Cronometro />
          <BotaoTema />
          <NavLink to="/conta" aria-label="Sua conta" title="Sua conta" className="hidden rounded-[30%] ring-offset-2 ring-offset-background sm:block [&.active]:ring-2 [&.active]:ring-primary">
            <Avatar />
          </NavLink>
        </div>
      </header>
      {/* pb extra no celular: a barra de baixo não pode cobrir o conteúdo */}
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-8 pb-28 sm:pb-8">{children}</main>
      <div className="max-sm:pb-16"><Rodape /></div>
      <BarraInferior selo={selo} />
      <BoasVindas />
    </div>
  )
}

/** Navegação de app no celular: os destinos principais ao alcance do polegar. */
function BarraInferior({ selo }: { selo: ReactNode }) {
  const item = (to: string, rotulo: string, icone: ReactNode, extra?: ReactNode) => (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => cn(
        'relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] transition-colors [&_svg]:size-5',
        isActive ? 'text-primary' : 'text-muted-foreground',
      )}
    >
      {icone}
      {rotulo}
      {extra && <span className="absolute top-0.5 left-1/2 ml-2">{extra}</span>}
    </NavLink>
  )
  return (
    <nav
      aria-label="Menu principal"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur sm:hidden"
    >
      <div className="flex">
        {item('/', 'Hoje', <House />)}
        {item('/categorias', 'Categorias', <Library />)}
        {item('/revisoes', 'Revisões', <RotateCcw />, selo)}
        {item('/conta', 'Conta', <Avatar className="size-5 text-[10px]" />)}
      </div>
    </nav>
  )
}

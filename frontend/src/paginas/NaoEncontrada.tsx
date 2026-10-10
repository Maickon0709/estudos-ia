import { Compass } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { useTitulo } from '@/lib/titulo'

export function PaginaNaoEncontrada() {
  useTitulo('Página não encontrada')
  return (
    <div className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-accent text-accent-foreground">
        <Compass className="size-7" />
      </div>
      <p className="font-heading text-6xl font-semibold text-primary">404</p>
      <h1 className="text-2xl font-semibold">Essa página não existe</h1>
      <p className="max-w-sm text-muted-foreground">O endereço pode ter mudado ou sido digitado errado.</p>
      <Button asChild size="lg">
        <Link to="/">Voltar para o início</Link>
      </Button>
    </div>
  )
}

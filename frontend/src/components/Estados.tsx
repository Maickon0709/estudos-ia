import { CircleAlert, Loader2 } from '@/lib/icones'
import type { ReactNode } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'

export function Carregando({ linhas = 3 }: { linhas?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }, (_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  )
}

export function Erro({ erro, titulo = 'Não deu certo' }: { erro: unknown; titulo?: string }) {
  const mensagem = erro instanceof Error ? erro.message : 'Algo deu errado. Tente novamente.'
  return (
    <Alert variant="destructive">
      <CircleAlert />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription>{mensagem}</AlertDescription>
    </Alert>
  )
}

export function Vazio({ icone, titulo, children }: { icone: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-accent text-accent-foreground">{icone}</div>
      <h3 className="text-lg font-semibold">{titulo}</h3>
      {children && <div className="max-w-md text-sm text-muted-foreground">{children}</div>}
    </div>
  )
}

/** Aviso para ações lentas (IA + busca levam alguns segundos). */
export function Trabalhando({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-accent/60 px-4 py-3 text-sm text-accent-foreground">
      <Loader2 className="size-4 animate-spin" />
      {children}
    </div>
  )
}

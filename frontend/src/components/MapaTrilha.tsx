import { CircleCheck } from '@/lib/icones'
import type { Etapa } from '@/lib/tipos'
import { cn } from '@/lib/utils'

export /** Mapa da trilha: um caminho com as etapas em ordem e o marcador de onde você está. */
function MapaTrilha({ etapas }: { etapas: Pick<Etapa, 'id' | 'ordem' | 'titulo' | 'status'>[] }) {
  const atual = etapas.findIndex((e) => e.status !== 'concluido')
  return (
    <nav aria-label="Mapa da trilha" className="-mx-2 overflow-x-auto px-2 pt-7 pb-2">
      <ol className="flex min-w-max items-start">
        {etapas.map((e, i) => {
          const feita = e.status === 'concluido'
          const aqui = i === atual
          return (
            <li key={e.id} className="flex items-start">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn('mt-[18px] h-1 w-10 rounded-full sm:w-16', etapas[i - 1].status === 'concluido' ? 'bg-sucesso' : 'bg-border')}
                />
              )}
              <a
                href={`#etapa-${e.id}`}
                className="group relative flex w-20 flex-col items-center gap-2 text-center"
                aria-current={aqui ? 'step' : undefined}
              >
                {aqui && (
                  <span className="absolute -top-7 rounded-full bg-primary px-2 py-0.5 text-[10px] font-medium whitespace-nowrap text-primary-foreground">
                    Você está aqui
                  </span>
                )}
                <span
                  className={cn(
                    'relative grid size-10 place-items-center rounded-full border-2 text-sm font-semibold transition-transform group-hover:scale-110',
                    feita && 'border-sucesso bg-sucesso text-primary-foreground',
                    aqui && 'border-primary bg-primary text-primary-foreground',
                    !feita && !aqui && 'border-border bg-card text-muted-foreground',
                  )}
                >
                  {aqui && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40 motion-reduce:hidden" aria-hidden />}
                  {feita ? <CircleCheck className="size-5" /> : e.ordem}
                </span>
                <span className={cn('line-clamp-2 text-xs', aqui ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                  {e.titulo}
                </span>
              </a>
            </li>
          )
        })}
        {atual === -1 && etapas.length > 0 && (
          <li className="ml-3 flex items-center gap-1 self-center pb-6 text-sm font-medium text-sucesso">🏁 Concluída</li>
        )}
      </ol>
    </nav>
  )
}

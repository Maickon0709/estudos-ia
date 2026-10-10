import { useId, useState, type ReactNode } from 'react'
import { Plus } from '@/lib/icones'
import { cn } from '@/lib/utils'

export type Pergunta = { pergunta: string; resposta: ReactNode }

/** Lista de perguntas frequentes: uma aberta por vez, altura animada só com CSS (grid 0fr → 1fr). */
export function Perguntas({ itens }: { itens: Pergunta[] }) {
  const [aberta, setAberta] = useState<number | null>(0)
  const base = useId()

  return (
    <ul className="flex flex-col">
      {itens.map(({ pergunta, resposta }, i) => {
        const ativa = aberta === i
        const id = `${base}-${i}`
        return (
          <li key={pergunta} className="border-b first:border-t">
            <h3>
              <button
                type="button"
                aria-expanded={ativa}
                aria-controls={id}
                onClick={() => setAberta(ativa ? null : i)}
                className="group flex w-full items-center gap-4 py-5 text-left text-lg font-medium"
              >
                <span className="mr-auto transition-colors group-hover:text-primary">{pergunta}</span>
                <Plus
                  className={cn('size-5 shrink-0 text-primary transition-transform duration-300 motion-reduce:transition-none', ativa && 'rotate-45')}
                  weight="bold"
                />
              </button>
            </h3>
            <div
              id={id}
              role="region"
              aria-label={pergunta}
              className={cn(
                'grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none',
                ativa ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              )}
              inert={!ativa}
            >
              <div className="overflow-hidden">
                <div className="max-w-[62ch] pb-6 text-muted-foreground">{resposta}</div>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

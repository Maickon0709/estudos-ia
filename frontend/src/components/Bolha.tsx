import { Bot } from '@/lib/icones'
import { Markdown } from '@/components/Markdown'
import type { Mensagem } from '@/lib/tipos'
import { cn } from '@/lib/utils'

/** Balão do chat: estudante em texto puro; tutora em markdown seguro (sem HTML e sem links). */
export function Bolha({ mensagem, escrevendo = false }: { mensagem: Pick<Mensagem, 'papel' | 'conteudo'>; escrevendo?: boolean }) {
  const usuario = mensagem.papel === 'user'
  return (
    <div className={cn('flex gap-3', usuario && 'flex-row-reverse')}>
      {!usuario && (
        <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
          <Bot className="size-4" />
        </span>
      )}
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          usuario ? 'rounded-tr-sm bg-primary whitespace-pre-wrap text-primary-foreground' : 'rounded-tl-sm bg-secondary',
        )}
      >
        {/* Mensagem do estudante: texto puro. Da IA: markdown seguro (sem HTML e sem links). */}
        {usuario ? mensagem.conteudo : <Markdown texto={mensagem.conteudo} escrevendo={escrevendo} />}
        {escrevendo && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse rounded-sm bg-primary align-text-bottom" aria-hidden />}
      </div>
    </div>
  )
}

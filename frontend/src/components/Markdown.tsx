import ReactMarkdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

/**
 * Markdown da IA com segurança:
 * - HTML cru é ignorado (sem rehype-raw): nada que a IA escreva vira tag.
 * - Links viram texto: a IA não pode criar link (invariante 2 do projeto).
 * - Imagens viram o texto alternativo: nada é carregado de fora.
 */
const COMPONENTES: Components = {
  a: ({ children }) => <span className="underline decoration-dotted underline-offset-2">{children}</span>,
  img: ({ alt }) => (alt ? <span>[{alt}]</span> : null),
  code: ({ children }) => (
    <code className="rounded-md bg-background/60 px-1.5 py-0.5 font-mono text-[0.9em]">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="overflow-x-auto rounded-xl bg-background/60 p-3 text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b px-2 py-1 font-semibold">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/50 px-2 py-1">{children}</td>,
}

export function Markdown({ texto, className }: { texto: string; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-2 leading-relaxed break-words',
        '[&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:my-0.5',
        '[&_h1]:font-heading [&_h1]:text-base [&_h1]:font-semibold [&_h2]:font-heading [&_h2]:text-base [&_h2]:font-semibold',
        '[&_h3]:font-semibold [&_strong]:font-semibold',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:pl-3 [&_blockquote]:italic',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTES} skipHtml>
        {texto}
      </ReactMarkdown>
    </div>
  )
}

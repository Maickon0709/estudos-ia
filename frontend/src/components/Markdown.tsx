import 'katex/dist/katex.min.css'
import ReactMarkdown, { type Components, type Options } from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import { prepararFormulas } from '@/lib/formulas'
import { cn } from '@/lib/utils'

/**
 * Markdown da IA com segurança:
 * - HTML cru é ignorado (sem rehype-raw): nada que a IA escreva vira tag.
 * - Links viram texto: a IA não pode criar link (invariante 2 do projeto).
 * - Imagens viram o texto alternativo: nada é carregado de fora.
 * - Fórmulas (LaTeX entre $$) viram desenho com o KaTeX. trust: false barra \href, \url e afins
 *   (nada vira link); maxSize/maxExpand evitam que uma fórmula gigante trave a página. Erro de LaTeX
 *   aparece como o próprio texto, sem quebrar a mensagem. Um $ sozinho não abre fórmula (é o "R$").
 */
const MATEMATICA: Options['remarkPlugins'] = [remarkGfm, [remarkMath, { singleDollarTextMath: false }]]
const KATEX: Options['rehypePlugins'] = [[rehypeKatex, { throwOnError: false, trust: false, strict: 'ignore', maxSize: 20, maxExpand: 200 }]]

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
        // fórmula em destaque vira um quadro (.quadro-formula em index.css); a do meio da frase cresce um pouco
        'quadro-formula [&_.katex]:text-[1.08em]',
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={MATEMATICA} rehypePlugins={KATEX} components={COMPONENTES} skipHtml>
        {prepararFormulas(texto)}
      </ReactMarkdown>
    </div>
  )
}

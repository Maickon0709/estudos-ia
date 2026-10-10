import { BookOpenText } from '@/lib/icones'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { BotaoTema, Layout } from '@/components/Layout'
import { Rodape } from '@/components/Rodape'
import { Button } from '@/components/ui/button'
import { useLogado } from '@/lib/sessao'

/** Páginas abertas a todos (guia, termos): com o menu do app para quem está logado. */
export function PaginaPublica({ children }: { children: ReactNode }) {
  const logado = useLogado()
  if (logado) return <Layout><div className="surgir">{children}</div></Layout>
  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
          <Link to="/" className="mr-auto flex items-center gap-2 font-heading text-lg font-semibold" aria-label="Estudos IA: início">
            <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground">
              <BookOpenText className="size-4" />
            </span>
            Estudos IA
          </Link>
          <BotaoTema />
          <Button asChild variant="ghost" size="sm"><Link to="/entrar">Entrar</Link></Button>
          <Button asChild size="sm" className="hidden sm:inline-flex"><Link to="/entrar?modo=cadastrar">Criar conta</Link></Button>
        </div>
      </header>
      <main className="surgir mx-auto w-full max-w-5xl flex-1 px-4 py-10">{children}</main>
      <Rodape />
    </div>
  )
}

/** Tipografia de documento (termos, privacidade). */
export function Documento({ titulo, versao, children }: { titulo: string; versao: string; children: ReactNode }) {
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-4 leading-relaxed [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_li]:my-1 [&_p]:text-muted-foreground [&_li]:text-muted-foreground [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5">
      <h1 className="text-3xl font-semibold sm:text-4xl">{titulo}</h1>
      <p className="text-sm">Versão de {versao}</p>
      {children}
    </article>
  )
}

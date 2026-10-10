import { CodeXml } from 'lucide-react'
import { Link } from 'react-router'
import { LINK_EXTERNO } from '@/lib/seguranca'

export const REPOSITORIO = 'https://github.com/Maickon0709/estudos-ia'

export function Rodape() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground md:flex-row">
        <p>© {new Date().getFullYear()} Estudos IA · Projeto de portfólio</p>
        <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2" aria-label="Links do rodapé">
          <Link to="/como-usar" className="hover:text-foreground">Como usar</Link>
          <Link to="/termos" className="hover:text-foreground">Termos de Uso</Link>
          <Link to="/privacidade" className="hover:text-foreground">Privacidade</Link>
          <a href={REPOSITORIO} {...LINK_EXTERNO} className="flex items-center gap-1.5 hover:text-foreground">
            <CodeXml className="size-4" /> Código no GitHub
          </a>
        </nav>
      </div>
    </footer>
  )
}

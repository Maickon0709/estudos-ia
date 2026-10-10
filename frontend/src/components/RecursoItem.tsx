import { BadgeCheck, CircleHelp, ExternalLink, FileText, ListVideo, PlayCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { duracao } from '@/lib/formatos'
import { LINK_EXTERNO, urlSegura } from '@/lib/seguranca'
import type { Recurso } from '@/lib/tipos'

const ICONE = { link: FileText, video: PlayCircle, playlist: ListVideo }

export function RecursoItem({ recurso }: { recurso: Recurso }) {
  const href = urlSegura(recurso.url)
  const Icone = ICONE[recurso.tipo] ?? FileText
  const detalhes = [
    recurso.canal,
    duracao(recurso.duracao_segundos),
    recurso.total_videos ? `${recurso.total_videos} vídeos` : null,
  ].filter(Boolean)
  const host = href ? new URL(href).hostname.replace(/^www\./, '') : null

  const conteudo = (
    <>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-secondary-foreground">
        <Icone className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm font-medium">{recurso.titulo}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          {host}
          {detalhes.map((d) => <span key={d}>· {d}</span>)}
        </span>
      </span>
      {recurso.verificacao === 'verificado' ? (
        <Badge variant="outline" className="shrink-0 border-sucesso/40 text-sucesso" title="Link conferido pelo sistema">
          <BadgeCheck /> <span className="sr-only sm:not-sr-only">Verificado</span>
        </Badge>
      ) : (
        <Badge variant="outline" className="shrink-0 text-muted-foreground" title="Sem confirmação da API do YouTube">
          <CircleHelp /> <span className="sr-only sm:not-sr-only">Não verificado</span>
        </Badge>
      )}
      {href && <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />}
    </>
  )

  const classe = 'flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors'
  // URL que não passou na checagem vira texto, nunca link clicável.
  return href ? (
    <a href={href} {...LINK_EXTERNO} className={`${classe} hover:border-primary/40 hover:bg-accent/30`}>
      {conteudo}
    </a>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

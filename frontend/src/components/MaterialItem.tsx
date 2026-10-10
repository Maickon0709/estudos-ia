import { FileText } from '@/lib/icones'
import { rotuloMaterial } from '@/lib/formatos'
import type { MaterialEtapa } from '@/lib/tipos'

/** Parte de um arquivo do aluno usada numa etapa (não é link: o arquivo original não fica guardado). */
export function MaterialItem({ material }: { material: Pick<MaterialEtapa, 'nome' | 'pagina_inicio' | 'pagina_fim'> }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-destaque">
        <FileText className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{rotuloMaterial(material)}</p>
        <p className="text-xs text-muted-foreground">Do seu material · os exercícios desta etapa usam este trecho</p>
      </div>
    </div>
  )
}

import type { DiaAtividade } from '@/lib/tipos'
import { cn } from '@/lib/utils'

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const DIAS_SEMANA = ['seg', '', 'qua', '', 'sex', '', '']

/** Data "AAAA-MM-DD" -> Date ao meio-dia UTC (evita erro de fuso ao somar dias). */
function data(iso: string) {
  return new Date(`${iso}T12:00:00Z`)
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function nivel(total: number) {
  if (total <= 0) return 0
  if (total <= 2) return 1
  if (total <= 5) return 2
  if (total <= 9) return 3
  return 4
}

const COR = ['bg-muted', 'bg-primary/25', 'bg-primary/50', 'bg-primary/75', 'bg-primary']

function descrever(d: DiaAtividade | undefined, dia: string) {
  const [a, m, dd] = dia.split('-')
  const quando = `${dd}/${m}/${a}`
  if (!d || d.total === 0) return `${quando}: sem estudo`
  const partes = [
    d.respostas && `${d.respostas} exercício${d.respostas > 1 ? 's' : ''}`,
    d.flashcards && `${d.flashcards} flashcard${d.flashcards > 1 ? 's' : ''}`,
    d.minutos && `${d.minutos} min de foco`,
    d.simulados && `${d.simulados} simulado${d.simulados > 1 ? 's' : ''}`,
  ].filter(Boolean)
  return `${quando}: ${partes.join(', ')}`
}

/** Calendário de calor estilo GitHub: colunas = semanas (seg a dom), cor = quanto estudou. */
export function Calendario({ atividade, hoje, semanas = 26 }: { atividade: DiaAtividade[]; hoje: string; semanas?: number }) {
  const porDia = new Map(atividade.map((a) => [a.dia, a]))
  const fim = data(hoje)
  const segundaAtual = new Date(fim)
  segundaAtual.setUTCDate(fim.getUTCDate() - ((fim.getUTCDay() + 6) % 7))
  const inicio = new Date(segundaAtual)
  inicio.setUTCDate(segundaAtual.getUTCDate() - (semanas - 1) * 7)

  const colunas: string[][] = []
  for (let s = 0; s < semanas; s++) {
    const coluna: string[] = []
    for (let d = 0; d < 7; d++) {
      const dia = new Date(inicio)
      dia.setUTCDate(inicio.getUTCDate() + s * 7 + d)
      coluna.push(iso(dia))
    }
    colunas.push(coluna)
  }

  const totalDias = atividade.filter((a) => a.total > 0).length

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1.5">
          <div className="grid grid-rows-[auto_repeat(7,0.75rem)] gap-[3px] pr-1 text-[10px] text-muted-foreground">
            <span className="h-3" />
            {DIAS_SEMANA.map((d, i) => <span key={i} className="leading-3">{d}</span>)}
          </div>
          {colunas.map((coluna, s) => {
            const primeiro = data(coluna[0])
            const mostraMes = s === 0 || primeiro.getUTCDate() <= 7
            return (
              <div key={coluna[0]} className="grid grid-rows-[auto_repeat(7,0.75rem)] gap-[3px]">
                <span className="h-3 text-[10px] leading-3 whitespace-nowrap text-muted-foreground">
                  {mostraMes ? MESES[primeiro.getUTCMonth()] : ''}
                </span>
                {coluna.map((dia) => {
                  const futuro = dia > hoje
                  const registro = porDia.get(dia)
                  return (
                    <span
                      key={dia}
                      title={futuro ? undefined : descrever(registro, dia)}
                      className={cn(
                        'size-3 rounded-[3px]',
                        futuro ? 'bg-transparent' : COR[nivel(registro?.total ?? 0)],
                        dia === hoje && 'ring-1 ring-foreground/50 ring-offset-1 ring-offset-card',
                      )}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>{totalDias} {totalDias === 1 ? 'dia' : 'dias'} de estudo nos últimos 6 meses</span>
        <span className="flex items-center gap-1">
          Menos {COR.map((c) => <span key={c} className={cn('size-3 rounded-[3px]', c)} />)} Mais
        </span>
      </div>
    </div>
  )
}

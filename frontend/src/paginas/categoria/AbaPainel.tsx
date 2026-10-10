import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Flame, ListChecks, RotateCcw, Timer, TrendingDown } from '@/lib/icones'
import { useState, type ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import CountUp from '@/components/CountUp'
import { Carregando, Erro } from '@/components/Estados'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { Progress } from '@/components/ui/progress'
import { api } from '@/lib/api'
import { NOME_NIVEL, diaMes, porcentagem } from '@/lib/formatos'

const configGrafico = {
  taxa: { label: 'Acerto (%)', color: 'var(--chart-1)' },
} satisfies ChartConfig

const configMinutos = {
  minutos: { label: 'Minutos', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function AbaPainel({ categoriaId }: { categoriaId: string }) {
  const painel = useQuery({ queryKey: ['painel', categoriaId], queryFn: () => api.painel(categoriaId) })

  if (painel.isPending) return <Carregando />
  if (painel.isError) return <Erro erro={painel.error} />
  const p = painel.data

  const dadosGrafico = p.acerto_por_nivel.map((n) => ({
    nivel: NOME_NIVEL[n.nivel],
    taxa: Math.round(n.taxa_acerto),
    respostas: n.total_respostas,
  }))
  const respondeuAlgo = p.acerto_por_nivel.some((n) => n.total_respostas > 0)

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Numero icone={<ListChecks />} rotulo="Etapas concluídas" valor={p.progresso.etapas_concluidas}
          detalhe={`de ${p.progresso.total_etapas}`} />
        <Numero icone={<CalendarCheck />} rotulo="Concluído" valor={Math.round(p.progresso.pct_concluido)} sufixo="%" />
        <Numero icone={<Flame />} rotulo="Dias seguidos" valor={p.sequencia_dias}
          detalhe={p.estudou_hoje ? 'Você já estudou hoje' : 'Estude hoje para manter'} />
        <Numero icone={<RotateCcw />} rotulo="Revisões hoje" valor={p.revisoes_pendentes} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-xl">Progresso da categoria</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={p.progresso.pct_concluido} aria-label="Progresso da categoria" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Acerto por nível</CardTitle>
            <CardDescription>Percentual de respostas certas em cada nível.</CardDescription>
          </CardHeader>
          <CardContent>
            {respondeuAlgo ? (
              <ChartContainer config={configGrafico} className="h-56 w-full">
                <BarChart data={dadosGrafico} margin={{ left: -16 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="nivel" tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tickLine={false} axisLine={false} unit="%" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="taxa" fill="var(--color-taxa)" radius={8} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">Responda alguns exercícios para ver o gráfico.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-xl">Pontos fracos</CardTitle>
            <CardDescription>Etapas com menor taxa de acerto.</CardDescription>
          </CardHeader>
          <CardContent>
            {p.pontos_fracos.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Nenhum ponto fraco por enquanto.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {p.pontos_fracos.map((f) => (
                  <li key={f.etapa_id} className="flex items-center gap-3 rounded-xl bg-secondary/60 px-4 py-3">
                    <TrendingDown className="size-4 shrink-0 text-destructive" />
                    <span className="min-w-0 flex-1 truncate text-sm">{f.etapa}</span>
                    <span className="text-sm font-semibold">{porcentagem(f.taxa_acerto)}</span>
                    <span className="text-xs text-muted-foreground">{f.tentativas} tent.</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <MinutosPorSemana semanas={p.minutos_por_semana ?? []} />
    </div>
  )
}

function MinutosPorSemana({ semanas }: { semanas: { semana: string; minutos: number }[] }) {
  const total = semanas.reduce((soma, s) => soma + s.minutos, 0)
  const dados = semanas.map((s) => ({ semana: diaMes(s.semana), minutos: s.minutos }))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-heading text-xl"><Timer className="size-5 text-primary" /> Tempo de foco por semana</CardTitle>
        <CardDescription>Minutos do cronômetro nas últimas 8 semanas (a semana começa na segunda).</CardDescription>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <ChartContainer config={configMinutos} className="h-56 w-full">
            <BarChart data={dados} margin={{ left: -16 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="semana" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="minutos" fill="var(--color-minutos)" radius={8} />
            </BarChart>
          </ChartContainer>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Use o cronômetro (ícone de relógio no topo) escolhendo esta categoria para ver seu tempo aqui.
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Numero({ icone, rotulo, valor, sufixo, detalhe }: {
  icone: ReactNode; rotulo: string; valor: number; sufixo?: string; detalhe?: string
}) {
  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-row items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-primary">
        {icone} {rotulo}
      </CardHeader>
      <CardContent>
        <p className="font-heading text-4xl font-semibold tabular-nums">
          <NumeroAnimado valor={valor} />{sufixo}
        </p>
        {detalhe && <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>}
      </CardContent>
    </Card>
  )
}

/** CountUp anima com uma "mola" que demora a chegar ao alvo (mostrava 19 em vez de 20).
 *  Ao fim da animação, trocamos pelo valor exato. */
function NumeroAnimado({ valor }: { valor: number }) {
  const [terminou, setTerminou] = useState(false)
  return terminou ? <span>{valor}</span> : <CountUp to={valor} duration={1} onEnd={() => setTerminou(true)} />
}
